#!/usr/bin/env python3
"""Check content/rules.json (SRS 6) and the plan frequencies in content/domains.json. Exit 1 on any error.

rules.json must be in the shape app/src/engine/rules.ts evaluates (interface Rule), plus governance fields:
  - required fields and enums (category, attention, decision owner, operators, opens)
  - attention agrees with the category (SRS 19 #5 attention order)
  - every fact in `when` and every {placeholder} in `finding` is a fact computeFacts produces (read from rules.ts)
  - source_id is a lib: id in content/library.json; team rules and placeholder sources carry TODO(source) or TODO(review)
  - no forbidden wording (scripts/check_language.py), no percentages
  - each rule projects to a record that validates against contracts/rule_definition.schema.json
domains.json: every indicator has frequency daily | weekly | as_needed; weekly needs due_days as ISO weekdays 1-7.

Usage: python3 scripts/check_rules.py
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from check_language import scan_text  # noqa: E402

CATEGORY_ATTENTION = {
    "REVIEW_REQUEST": {"urgent", "due_follow_up"},
    "MEASUREMENT_ISSUE": {"missing"},
    "PLAN_NEED": {"change"},
    "INSUFFICIENT_REFERENCE": {"reference"},
}
ATTENTION_ORDER = ["urgent", "due_follow_up", "change", "missing", "reference"]
STEP_CATEGORY = {  # rules.ts STEP_CATEGORY
    "REVIEW_REQUEST": "request_review", "MEASUREMENT_ISSUE": "complete_measurement",
    "PLAN_NEED": "approved_plan_step", "INSUFFICIENT_REFERENCE": "observe",
}
OPS = {"==", "!=", ">", ">=", "<", "<=", "in"}
OWNERS = {"astronaut", "medical", "planner"}
OPENS = {"schedule_alternatives"}
SOURCE_TYPES = {"nasa", "research", "team_rule"}
RULE_CLASSES = {"data_quality", "descriptive_change", "approved_plan", "approved_medical_condition"}
APPROVAL = {"draft", "reviewed", "approved"}
ID_RE = re.compile(r"^R-[A-Z]+-\d{2}$")
PLACEHOLDER_RE = re.compile(r"\{([a-z_.0-9]+)\}")
FREQUENCIES = {"daily", "weekly", "as_needed"}


def known_facts():
    """Fact names returned by computeFacts in app/src/engine/rules.ts."""
    src = (ROOT / "app/src/engine/rules.ts").read_text(encoding="utf-8")
    body = src[src.index("export function computeFacts"):]
    return set(re.findall(r"'([a-z_]+\.[a-z_0-9]+)':", body))


def walk_when(w, where, facts, errors, used):
    if not isinstance(w, dict) or not (w.get("all") or w.get("any")):
        errors.append(f"{where}: needs a non-empty 'all' or 'any'"); return
    for k in w:
        if k not in ("all", "any"):
            errors.append(f"{where}: unknown key '{k}'")
    for group in ("all", "any"):
        for i, c in enumerate(w.get(group) or []):
            at = f"{where}.{group}[{i}]"
            if "fact" in c:
                used.add(c["fact"])
                if c["fact"] not in facts:
                    errors.append(f"{at}: unknown fact '{c['fact']}' (not produced by computeFacts)")
                if c.get("op") not in OPS:
                    errors.append(f"{at}: op must be one of {sorted(OPS)}")
                if "value" not in c:
                    errors.append(f"{at}: missing value")
                elif c.get("op") == "in" and not isinstance(c["value"], list):
                    errors.append(f"{at}: 'in' needs a list value")
                elif c.get("op") in (">", ">=", "<", "<=") and not isinstance(c["value"], (int, float)):
                    errors.append(f"{at}: '{c['op']}' needs a number")
            else:
                walk_when(c, at, facts, errors, used)


def to_rule_definition(rule, created_at):
    """Projects an app rule onto the contract record (CONTRACT_P0: rule_definition lives in content/rules.json)."""
    used = set()
    walk_when(rule["when"], "", known_facts(), [], used)
    return {
        "rule_definition_id": f"rule:{rule['id']}",
        "schema_version": "1.0",
        "data_origin": "application_generated",
        "created_at_utc": created_at,
        "rule_version": rule["version"],
        "rule_class": rule["rule_class"],
        "required_metric_codes": sorted(used),
        "required_quality": rule.get("required_quality"),
        "condition_description": rule["condition_description"],
        "observation_template": rule["finding"],
        "allowed_next_step": STEP_CATEGORY.get(rule["category"]),
        "owner_role": rule["step"]["decision_owner"],
        "evidence_source_id": rule["source_id"],
        "approval_state": rule["approval_state"],
    }


def check_rules(errors):
    data = json.loads((ROOT / "content/rules.json").read_text(encoding="utf-8"))
    library = {s["id"] for s in json.loads((ROOT / "content/library.json").read_text(encoding="utf-8"))["sources"]}
    facts = known_facts()
    if not facts:
        errors.append("could not read fact names from app/src/engine/rules.ts")
    for k in ("rules_version", "created_at_utc", "review_status", "rules"):
        if k not in data:
            errors.append(f"rules.json: missing top-level '{k}'")
    if data.get("attention_order") != ATTENTION_ORDER:
        errors.append(f"rules.json: attention_order must be {ATTENTION_ORDER} (SRS 19 #5, rules.ts ATTENTION_ORDER)")
    validator = None
    try:
        from jsonschema import Draft202012Validator
        validator = Draft202012Validator(json.loads((ROOT / "contracts/rule_definition.schema.json").read_text()))
    except ImportError:
        print("check_rules: jsonschema not installed, contract projection skipped")

    seen = set()
    rules = data.get("rules", [])
    for n, r in enumerate(rules):
        rid = r.get("id", f"#{n}")
        at = f"rules.json:{rid}"
        if not ID_RE.match(str(r.get("id", ""))):
            errors.append(f"{at}: id must look like R-PLAN-01")
        if rid in seen:
            errors.append(f"{at}: duplicate id")
        seen.add(rid)
        for k in ("version", "category", "attention", "priority", "when", "finding", "step", "source_id",
                  "source_type", "limits", "rule_class", "condition_description", "approval_state"):
            if k not in r or r[k] in (None, ""):
                errors.append(f"{at}: missing '{k}'")
        if "required_quality" not in r:
            errors.append(f"{at}: missing 'required_quality' (null is allowed)")
        cat, att = r.get("category"), r.get("attention")
        if cat not in CATEGORY_ATTENTION:
            errors.append(f"{at}: unknown category '{cat}'")
        elif att not in CATEGORY_ATTENTION[cat]:
            errors.append(f"{at}: attention '{att}' does not fit category {cat}; allowed {sorted(CATEGORY_ATTENTION[cat])}")
        if not isinstance(r.get("priority"), int) or r["priority"] < 1:
            errors.append(f"{at}: priority must be an integer >= 1")
        used = set()
        walk_when(r.get("when"), f"{at}.when", facts, errors, used)
        step = r.get("step") or {}
        if not step.get("title"):
            errors.append(f"{at}: step.title missing")
        if step.get("decision_owner") not in OWNERS:
            errors.append(f"{at}: step.decision_owner must be one of {sorted(OWNERS)}")
        if not isinstance(step.get("followup_days"), int) or step["followup_days"] < 0:
            errors.append(f"{at}: step.followup_days must be an integer >= 0")
        if "opens" in step and step["opens"] not in OPENS:
            errors.append(f"{at}: step.opens must be one of {sorted(OPENS)}")
        for ph in PLACEHOLDER_RE.findall(r.get("finding", "")):
            if ph not in facts:
                errors.append(f"{at}: placeholder {{{ph}}} is not a computed fact")
        if r.get("source_id") not in library:
            errors.append(f"{at}: source_id '{r.get('source_id')}' is not in content/library.json")
        if r.get("source_type") not in SOURCE_TYPES:
            errors.append(f"{at}: source_type must be one of {sorted(SOURCE_TYPES)}")
        if r.get("source_type") == "team_rule" and "TODO(" not in str(r.get("review_status", "")):
            errors.append(f"{at}: a team rule needs a TODO(source) or TODO(review) note")
        if r.get("rule_class") not in RULE_CLASSES:
            errors.append(f"{at}: rule_class must be one of {sorted(RULE_CLASSES)}")
        if r.get("approval_state") not in APPROVAL:
            errors.append(f"{at}: approval_state must be one of {sorted(APPROVAL)}")
        if r.get("approval_state") == "approved" and "TODO(" in str(r.get("review_status", "")):
            errors.append(f"{at}: an approved rule cannot carry an open TODO")
        for field, text in (("finding", r.get("finding", "")), ("step.title", step.get("title", "")), ("limits", r.get("limits", ""))):
            for label in scan_text(text):
                errors.append(f"{at}.{field}: forbidden wording '{label}'")
            if "%" in text:
                errors.append(f"{at}.{field}: no percentages")
        if validator and not any(e.startswith(at) for e in errors):
            for e in validator.iter_errors(to_rule_definition(r, data.get("created_at_utc"))):
                errors.append(f"{at}: rule_definition projection: {e.message}")
    return rules


def check_domains(errors):
    data = json.loads((ROOT / "content/domains.json").read_text(encoding="utf-8"))
    for d in data["domains"]:
        if not d.get("sources"):
            errors.append(f"domains.json:{d['id']}: needs at least one source")
        for f in ("why_space", "limits_note"):
            if not d.get(f):
                errors.append(f"domains.json:{d['id']}: missing {f}")
        if d["id"] in ("nutrition", "movement", "radiation") and d.get("sample") is not True:
            errors.append(f"domains.json:{d['id']}: sample domain must have sample: true")
        for ind in d.get("indicators", []):
            at = f"domains.json:{d['id']}.{ind.get('id')}"
            freq = ind.get("frequency")
            if freq not in FREQUENCIES:
                errors.append(f"{at}: frequency must be one of {sorted(FREQUENCIES)}")
            days = ind.get("due_days")
            if freq == "weekly":
                if not isinstance(days, list) or not days or any(not isinstance(x, int) or not 1 <= x <= 7 for x in days):
                    errors.append(f"{at}: weekly needs due_days as ISO weekdays 1 (Mon) to 7 (Sun)")
            elif days not in (None, []):
                errors.append(f"{at}: due_days only applies to weekly indicators")


def main():
    errors = []
    rules = check_rules(errors)
    check_domains(errors)
    for e in errors:
        print(e)
    order = sorted(rules, key=lambda r: (ATTENTION_ORDER.index(r["attention"]) if r.get("attention") in ATTENTION_ORDER else 99,
                                         r.get("priority", 99), r.get("id", "")))
    print("attention order: " + " > ".join(r.get("id", "?") for r in order))
    print(f"\ncheck_rules: {len(rules)} rule(s), {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
