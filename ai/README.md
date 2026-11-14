# Ask NASA: the onboard library assistant

A local RAG service. It answers only from the documents in `ai/corpus/`, cites every sentence, and refuses rather than guesses. It runs on the demo laptop with Ollama and never needs the internet. The public site never calls it; it shows recorded answers instead.

It only explains and summarises. It never sets a status, chooses an action, diagnoses, or names a medication or dose. Every core app function works without it.

## Setup (once)

```bash
cd ai
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ollama pull gpt-oss:20b && ollama pull nomic-embed-text      # plus your Qwen 27B tag if you want to compare
```

## Add the library

Put the files (`.pdf`, `.md`, `.txt`) in `ai/corpus/` and describe each one in `ai/corpus/sources.json`:

```json
[
  {"file": "sleep-risk.pdf", "id": "lib:nasa-sleep-risk", "title": "Risk from Inadequate Sleep and Irregular Schedules",
   "publisher": "NASA Human Research Program", "url": "https://...", "date": "2024-05-01",
   "license": "public domain", "scope": "sleep", "approval_status": "reviewed"}
]
```

`id` should match the `lib:` IDs used in `content/library.json`. Items with `approval_status: "rejected"` are skipped. Never put `tests/injection.md` in the corpus.

## Build, run, evaluate

```bash
python ask_nasa.py --build                                   # ai/corpus -> ai/index.json (+ index.meta.json)
uvicorn ask_nasa:app --port 8008                             # POST /ask, POST /consult, GET /health
python ask_nasa.py --eval ../content/eval.json --out ../science/out/assistant_eval_gptoss.json
VITA_LLM="YOUR-QWEN-TAG" python ask_nasa.py --eval ../content/eval.json --out ../science/out/assistant_eval_qwen.json
```

`eval.json`: `[{"q": "...", "answerable": true, "expect": "title substring"}, {"q": "...", "answerable": false}]`. The eval prints PASS/FAIL per question and counts of correct source, correct abstention and blocked answers. Tune `VITA_MIN_SCORE` (default 0.55) so answerable questions pass and the unanswerable ones stay refused.

```bash
curl -s localhost:8008/health
curl -s localhost:8008/ask -H 'Content-Type: application/json' \
  -d '{"question":"Why does sleep matter on a long mission?","context":{"crew_id":"sim:crew:fahim","day":27,"sleep_h":5.2}}'
```

## The `/ask` contract (SRS section 11)

Request: `{"question": "...", "context": {...}}`. The context is today's data from the app; private notes are never sent to the model.

Response:

| Field | Meaning |
|---|---|
| `status` | `answered`, `not_in_library` (abstained), or `blocked` (a guardrail stopped it) |
| `question_id` | ID of the trace in `ai/traces/` |
| `your_data` | Restates values from `context` only, built in code, never by the model |
| `science` | The model's explanation, every sentence cited `[S#]` |
| `citations` | `[{id, source_id, title, url, page, excerpt}]`, only retrieved chunks |
| `limits` | What the answer is not (or why it was refused) |
| `model` | Model name |

## The `/consult` contract (FR-AS-09)

Request: `{"summary": {"events": [...], "measurements": [...], "symptoms": [...], "actions": [...], "question": "..." | null}}`.
Each item is a labelled value `{label, date, data_status, reasons, limits}`, built from the share preview the astronaut sees
(`app/src/assistant/consult.ts` `toConsultInput`). Any other field (for example a private note) is rejected with 422.

Response: `{status: "drafted" | "blocked", consult_id, sections: {trend, context, what_was_tried, crew_question, requested_decision} | null, note, unsupported_numbers: [], reason, limits, model}`.

- `crew_question` is the astronaut's question restated in code (or "No question added."), never model-written.
- Blocked, with no text returned, when a section is missing, a number is absent from the summary, or the wording is forbidden (negated restatements such as "not a diagnosis" are allowed).
- The app re-checks the numbers, and builds the same five sections from the record when the service is down, in cached mode, or when the draft is blocked ("Drafted without the assistant").

```bash
curl -s localhost:8008/consult -H 'Content-Type: application/json' \
  -d '{"summary":{"measurements":[{"label":"Recorded sleep: 5.2 h","date":"2026-11-14"}],"question":"Should I change my exercise plan?"}}'
```

## Guardrails

1. Medication, supplement and dose questions are refused **before** retrieval.
2. If the best retrieval score is below `VITA_MIN_SCORE`, the service refuses **without calling the model**.
3. Retrieved text sits inside `<source>` tags; the rules say it is data and never instructions, and tag-like text inside a document is neutralised.
4. An answer is blocked if it is uncited, cites a chunk that wasn't retrieved, contains a number absent from the sources/context/question, or uses forbidden wording (ready / fit for duty / diagnosis / dose / caused by …).
5. Temperature 0. One JSON trace per question in `ai/traces/` (git-ignored).

## Cached mode for the public site

The public build (`VITE_ASSISTANT_MODE=cached`) reads `app/public/data/cached_answers.json`:

```json
[{"question": "...", "response": {"status": "answered", "...": "..."}, "label": "Recorded from the onboard model"}]
```

Record it from the running service, check every answer by hand, then commit:

```bash
python record_answers.py                     # default 5 questions -> ../app/public/data/cached_answers.json
python record_answers.py --questions my_questions.json
```

## Tests (no Ollama needed)

```bash
python -m pytest -q
```

The tests use keyword embeddings and scripted fake models. They prove the guardrails in code (threshold refusal, dose refusal, citation filtering, unsupported numbers, `your_data` from context only, injection fencing, and that a model which obeys an injected instruction still gets blocked). They do not prove answer quality with the real models; the eval does that. `VITA_FAKE=1` runs the service with keyword embeddings and a model that always abstains, for wiring tests.
