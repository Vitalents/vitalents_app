"""
Ask NASA: onboard, offline RAG for the Vitalents demo (Ollama + LangChain + FastAPI).

Setup
  pip install fastapi uvicorn langchain-ollama langchain-community langchain-text-splitters pypdf
  ollama pull gpt-oss:20b && ollama pull nomic-embed-text

Corpus: put NASA PDFs (or .md/.txt with page text) in ./corpus plus corpus/sources.json:
  {"sleep-risk.pdf": {"title": "Risk from Inadequate Sleep and Irregular Schedules", "url": "https://..."}}

Run
  python ask_nasa.py --build            # index ./corpus -> index.json
  python ask_nasa.py --eval eval.json   # [{"q": "...", "answerable": true, "expect": "Sleep"}, ...]
  uvicorn ask_nasa:app --port 8008      # POST /ask, POST /consult

Swap models: VITA_LLM="<your qwen 27b tag>" uvicorn ask_nasa:app --port 8008
"""
import json, os, pathlib, re, sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_community.document_loaders import PyPDFLoader
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

LLM_MODEL = os.getenv("VITA_LLM", "gpt-oss:20b")
EMBED_MODEL = os.getenv("VITA_EMBED", "nomic-embed-text")
MIN_SCORE = float(os.getenv("VITA_MIN_SCORE", "0.55"))  # tune on your eval set
K = 4
CORPUS, INDEX = pathlib.Path("corpus"), pathlib.Path("index.json")
NOT_IN_LIB = "That isn't in the onboard NASA library. I've added it to the consult note for Earth."

emb = OllamaEmbeddings(model=EMBED_MODEL)
llm = ChatOllama(model=LLM_MODEL, temperature=0)
store = InMemoryVectorStore.load(str(INDEX), emb) if INDEX.exists() else None

ASK_RULES = """You are the onboard reference librarian of a crew health app on a long-duration mission.
Answer ONLY from the numbered NASA sources. Cite every sentence with [S#].
Never diagnose, never name medications or doses, never override the flight surgeon.
If the sources do not answer the question, set not_in_library to true.
Use only numbers that appear in the sources or the crew data. Max 4 sentences.
Reply with JSON only: {"answer": "...", "citations": ["S1"], "not_in_library": false}"""

CONSULT_RULES = """Write a consult note for a flight surgeon on Earth from the crew data JSON.
Use exactly these sections: TREND, CONTEXT, WHAT WAS TRIED, CREW QUESTION, REQUESTED DECISION.
Use only facts and numbers present in the JSON. No diagnosis, no medications. Plain text, max 180 words."""

NUM = re.compile(r"\d+(?:\.\d+)?")


def unsupported_numbers(text: str, *contexts: str) -> list[str]:
    """Numbers in the output that never appear in the inputs (guards against invented values)."""
    allowed = {float(n) for n in NUM.findall(" ".join(contexts))}
    return [n for n in NUM.findall(re.sub(r"\[S\d+\]", "", text)) if float(n) not in allowed]


def parse_json(text: str):
    m = re.search(r"\{.*\}", text, re.S)
    try:
        return json.loads(m.group(0)) if m else None
    except json.JSONDecodeError:
        return None


def build():
    meta = json.loads((CORPUS / "sources.json").read_text(encoding="utf-8"))
    docs = []
    for path in sorted(CORPUS.iterdir()):
        info = meta.get(path.name)
        if not info:
            continue
        if path.suffix == ".pdf":
            pages = PyPDFLoader(str(path)).load()
        elif path.suffix in (".md", ".txt"):
            pages = [Document(page_content=path.read_text(encoding="utf-8"), metadata={"page": 0})]
        else:
            continue
        for p in pages:
            p.metadata = {"title": info["title"], "url": info["url"], "page": p.metadata.get("page", 0) + 1}
        docs.extend(pages)
    chunks = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150).split_documents(docs)
    s = InMemoryVectorStore(emb)
    s.add_documents(chunks)
    s.dump(str(INDEX))
    print(f"Indexed {len(chunks)} chunks from {len(meta)} sources -> {INDEX}")


app = FastAPI(title="Vitalents onboard library")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class AskIn(BaseModel):
    question: str
    readiness: dict | None = None  # today's readiness JSON, so "why am I amber?" works


class ConsultIn(BaseModel):
    readiness: dict


def refuse(status="not_in_library", **extra):
    return {"status": status, "answer": NOT_IN_LIB, "citations": [], "model": LLM_MODEL, **extra}


@app.post("/ask")
def ask(req: AskIn):
    if store is None:
        raise HTTPException(503, "Index missing: run python ask_nasa.py --build")
    hits = store.similarity_search_with_score(req.question, k=K)
    if not hits or hits[0][1] < MIN_SCORE:
        return refuse(top_score=hits[0][1] if hits else None)
    ids = {f"S{i + 1}": d for i, (d, _) in enumerate(hits)}
    sources = "\n\n".join(f"[{sid}] {d.metadata['title']} (p.{d.metadata['page']})\n{d.page_content}" for sid, d in ids.items())
    crew = json.dumps(req.readiness or {})
    msg = f"SOURCES:\n{sources}\n\nCREW DATA:\n{crew}\n\nQUESTION: {req.question}"
    out = parse_json(llm.invoke([("system", ASK_RULES), ("human", msg)]).content)
    if not out or out.get("not_in_library") or not out.get("answer"):
        return refuse()
    cites = [c for c in out.get("citations", []) if c in ids]
    bad = unsupported_numbers(out["answer"], sources, crew, req.question)
    if not cites or bad:
        return refuse("blocked", reason="uncited" if not cites else f"unsupported numbers {bad}")
    return {
        "status": "answered",
        "answer": out["answer"],
        "citations": [{"id": c, **ids[c].metadata} for c in cites],
        "model": LLM_MODEL,
    }


@app.post("/consult")
def consult(req: ConsultIn):
    data = json.dumps(req.readiness)
    note = llm.invoke([("system", CONSULT_RULES), ("human", data)]).content.strip()
    bad = unsupported_numbers(note, data)
    return {"status": "blocked" if bad else "ok", "note": None if bad else note, "unsupported": bad, "model": LLM_MODEL}


def run_eval(path: str):
    rows = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    passed = 0
    for r in rows:
        res = ask(AskIn(question=r["q"]))
        if r["answerable"]:
            ok = res["status"] == "answered" and any(r["expect"].lower() in c["title"].lower() for c in res["citations"])
        else:
            ok = res["status"] != "answered"
        passed += ok
        print("PASS" if ok else "FAIL", f"[{res['status']}]", r["q"])
    print(f"\n{LLM_MODEL}: {passed}/{len(rows)} correct (answerable -> right source cited, unanswerable -> refused)")


if __name__ == "__main__":
    if "--build" in sys.argv:
        build()
    elif "--eval" in sys.argv:
        run_eval(sys.argv[sys.argv.index("--eval") + 1])
    else:
        print(__doc__)
