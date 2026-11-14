"""Generate JSON Schemas (contract v1.0) from Shaimaa's data dictionary v0.9.

Usage: python3 -I gen_schemas.py <Data_Dictionary.xlsx> <out_contracts_dir>
Field names, types, enums and required flags come from the dictionary. The only
changes are the v1.0 decisions in docs/CONTRACT_P0.md (ADDITIONS / NULLABLE_REQUIRED).
"""
import json, sys, os
from openpyxl import load_workbook

xlsx, out = sys.argv[1], sys.argv[2]
rows = list(load_workbook(xlsx, read_only=True)["Core Entity Fields"].iter_rows(values_only=True))
H = rows[0]
ix = {h: i for i, h in enumerate(H)}

ID_PATTERN = r"^(sim|live|research|lib|rule):[A-Za-z0-9_.:-]+$"
DATE = r"^\d{4}-\d{2}-\d{2}$"
UTC = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$"

# Decisions D-6 / D-7 / D-8 in docs/CONTRACT_P0.md
ENUM_ADD = {
    ("information_status", "status"): ["stale", "limited"],
    ("action", "execution_status"): ["unable", "awaiting_impact_review"],
}
# Measured values: key always present, null when missing (decision D-3)
NULLABLE_REQUIRED = {
    "measurement": ["value"],
    "sleep_record": ["recorded_interval_ms", "minutes_asleep", "minutes_awake"],
    "decode_session": ["end_at_utc", "accepted_responses", "correct_count", "accuracy_percent", "median_correct_rt_ms"],
    "decode_response_event": ["response_digit", "response_monotonic_ms", "response_time_ms"],
    "personal_reference": ["reference_value"],
}
ADDITIONS = {
    "mission_schedule": {
        "item_kind": ({"enum": ["task", "rest_window"]}, True),
        "movable_earliest_start": ({"type": ["string", "null"], "pattern": UTC}, False),
        "movable_latest_end": ({"type": ["string", "null"], "pattern": UTC}, False),
    },
    "personal_reference": {
        "range_low": ({"type": ["number", "null"]}, False),
        "range_high": ({"type": ["number", "null"]}, False),
        "frozen": ({"type": "boolean"}, False),
    },
    "decode_session": {
        "played_live_into_simulation": ({"type": "boolean"}, False),
    },
}
RANGES = {
    ("self_report", "alertness_rating"): {"minimum": 1, "maximum": 10},
    ("decode_response_event", "correct_digit"): {"minimum": 1, "maximum": 9},
    ("decode_response_event", "response_digit"): {"minimum": 1, "maximum": 9},
    ("measurement", "hour_local"): {"minimum": 0, "maximum": 23},
    ("decode_session", "accuracy_percent"): {"minimum": 0, "maximum": 100},
}

def base_type(dtype, allowed):
    d = dtype.strip()
    if d.startswith("String (UUID"): return {"type": "string", "pattern": ID_PATTERN}
    if d == "Enum": return {"enum": [v.strip() for v in str(allowed).split(",")]}
    if d in ("DateTime ISO8601 UTC", "DateTime"): return {"type": "string", "pattern": UTC}
    if d == "Date": return {"type": "string", "pattern": DATE}
    if d == "String URI": return {"type": "string", "format": "uri"}
    if d == "String list": return {"type": "array", "items": {"type": "string"}}
    if d == "Integer": return {"type": "integer"}
    if d == "Float": return {"type": "number"}
    if d == "Boolean": return {"type": "boolean"}
    return {"type": "string"}

def nullable(s):
    s = dict(s)
    if "enum" in s: s["enum"] = s["enum"] + [None]; return s
    t = s.get("type")
    s["type"] = [t, "null"] if isinstance(t, str) else t
    return s

entities = {}
for r in rows[1:]:
    ent, field = r[ix["Entity"]], r[ix["Field Name"]]
    e = entities.setdefault(ent, {"props": {}, "required": [], "priority": r[ix["MVP Priority"]]})
    s = base_type(r[ix["Data Type"]], r[ix["Allowed Values"]])
    if "enum" in s and (ent, field) in ENUM_ADD: s["enum"] += ENUM_ADD[(ent, field)]
    s.update(RANGES.get((ent, field), {}))
    s["description"] = (r[ix["Description"]] or "").strip()
    if r[ix["Unit"]] not in (None, "N/A"): s["description"] = s["description"].rstrip(".") + f". Unit: {r[ix['Unit']]}."
    is_req = str(r[ix["Required / Optional"]]).startswith("Required")
    is_pk = field == f"{ent}_id"
    if field.endswith("_id") and not is_pk and s.get("pattern") is None and s.get("type") == "string" and field not in ("source_participant_id", "symbol_id", "message_id"):
        s["pattern"] = ID_PATTERN
    if field in NULLABLE_REQUIRED.get(ent, []):
        s = nullable(s); is_req = True
    elif not is_req:
        s = nullable(s)
    e["props"][field] = s
    if is_req: e["required"].append(field)

os.makedirs(out, exist_ok=True)
index = []
for ent, e in entities.items():
    for f, (s, req) in ADDITIONS.get(ent, {}).items():
        e["props"][f] = s
        if req: e["required"].append(f)
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://vitalents.life/contracts/{ent}.schema.json",
        "title": ent,
        "description": f"Vitalents contract v1.0 (from Data Dictionary v0.9). MVP priority: {e['priority']}.",
        "type": "object",
        "properties": e["props"],
        "required": e["required"],
        "additionalProperties": False,
    }
    json.dump(schema, open(os.path.join(out, f"{ent}.schema.json"), "w"), indent=2, ensure_ascii=False)
    index.append({"entity": ent, "primary_key": f"{ent}_id", "priority": e["priority"], "fields": len(e["props"])})
json.dump({"contract_version": "1.0", "source": "Vitalents_Task2_Data_Dictionary.xlsx v0.9", "entities": index},
          open(os.path.join(out, "index.json"), "w"), indent=2)
print(len(index), "schemas;", sum(i["fields"] for i in index), "fields")
