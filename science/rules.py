"""Read-only daily review over the Task 3-5 quality and reference engines."""

from collections.abc import Mapping
from dataclasses import dataclass

from . import reference, status

ENGINE_VERSION = "rules-1.0.0"
FOLLOWUP_STATES = (
    "no_open_follow_up", "watching", "action_open", "review_requested",
    "under_specialist_review", "closed",
)
PRIORITY = ("request_review", "complete_measurement", "approved_plan_step", "observe")
WORKFLOW_SOURCE = {"basis": "Vitalents Product Scope v1.2, M4 and M8"}


@dataclass(frozen=True)
class Reading:
    """One explicitly expected slot and optional selected reference metric."""

    slot_id: str
    kind: str
    observation: reference.Observation
    policy: reference.Policy | None = None
    series: reference.ReferenceSeries = reference.ReferenceSeries()


@dataclass(frozen=True)
class ApprovedMatch:
    """Trusted workflow assertion of applicability, bound to exact records and versions.

    The caller verifies the signed approval, decision role, expiry and applicability
    before supplying this assertion. Task 2 condition descriptions are prose.
    """

    rule_id: str
    rule_version: str
    subject_id: str
    subject_mode: str
    approval_record_id: str
    approver_role: str
    evidence_id: str
    evidence_version: str
    action_text: str
    slot_ids: tuple[str, ...]
    supporting_record_ids: tuple[str, ...]
    reference_ids: tuple[str | None, ...]


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _scoped(record, subject_id, subject_mode):
    if not isinstance(record, Mapping) or record.get("subject_id") != subject_id:
        return False
    origin = record.get("data_origin")
    simulated = subject_mode == "mission_simulation"
    return record.get("is_simulated") is simulated and (
        (origin == "application_generated" and subject_mode != "real_research")
        or (isinstance(origin, str) and status.MODES.get(origin) == subject_mode)
    )


def _step(category, reason, owner, **details):
    return {"step_category": category, "reason_text": reason,
            "owner_role": owner, "execution_status": "proposed", **details}


def _assess(slot):
    context = {key: value for key, value in slot.observation.context.items() if key != "comparison"}
    raw = status.evaluate(slot.kind, slot.observation.record, context=context)
    result = {"slot_id": slot.slot_id, "kind": slot.kind, "raw_information_status": raw,
              "information_status": raw, "comparison": None}
    record = slot.observation.record
    if slot.kind == "measurement" and isinstance(record, Mapping) and _text(record.get("metric_code")):
        result["metric"] = record["metric_code"]
    return result


def _compare(slot, result, as_of_utc):
    if slot.policy is None:
        return
    compared = reference.compare(slot.observation, slot.policy, slot.series, as_of_utc=as_of_utc)
    if slot.kind != "measurement":
        result["metric"] = slot.policy.metric
    result["information_status"] = compared.information_status
    result["comparison"] = {
        "metric": slot.policy.metric,
        "reference_status": compared.reference_status, "reason": compared.reason,
        "reference_id": compared.reference_id, "reference_value": compared.reference_value,
        "observed_value": compared.observed_value, "difference": compared.difference,
        "policy_version": slot.policy.version, "engine_version": reference.ENGINE_VERSION,
        "limitations": list(compared.limitations),
    }


def _reading_finding(result):
    raw, assessed = result["raw_information_status"], result["information_status"]
    comparison = result["comparison"]
    if "unsupported_metric" in raw["reason_codes"]:
        return ("context_conflict", "This metric is outside the supported assessment.",
                "No interpretation is available for this metric.")
    if (raw["status"] in ("no_reading", "incomplete") or assessed["status"] == "no_reading"
            or "session_interrupted" in raw["reason_codes"]
            or (comparison and comparison["reason"] == "missing_selected_value")):
        return ("missing_data", "An expected reading is missing or needs verification.",
                "Data quality alone does not establish a health state.")
    if comparison and comparison["difference"] is not None:
        if comparison["difference"] != 0:
            direction = "higher" if comparison["difference"] > 0 else "lower"
            metric = comparison["metric"]
            return ("descriptive_change", f"The recorded {metric} is {direction} than its personal reference.",
                    "The difference is descriptive and establishes neither cause nor readiness.")
    elif comparison or raw["status"] == "not_comparable":
        return ("context_conflict", "A compatible comparison is unavailable.",
                "The available information cannot establish personal change.")
    return None


def _approved_step(match, rules, evidence, assessments, subject_id, subject_mode):
    if not isinstance(match, ApprovedMatch):
        return None, "invalid_match"
    if (match.subject_id, match.subject_mode) != (subject_id, subject_mode):
        return None, "match_outside_subject_partition"
    if not all(_text(value) for value in (match.rule_id, match.rule_version,
                                           match.evidence_id, match.evidence_version,
                                           match.approval_record_id, match.action_text)):
        return None, "approval_or_version_missing"
    rule = rules.get((match.rule_id, match.rule_version))
    if (not isinstance(rule, Mapping) or rule.get("rule_definition_id") != match.rule_id
            or rule.get("rule_version") != match.rule_version
            or rule.get("approval_state") != "approved"):
        return None, "approved_rule_version_unavailable"
    categories = {"approved_plan": "approved_plan_step", "approved_medical_condition": "request_review"}
    rule_class = rule.get("rule_class")
    category = categories.get(rule_class) if _text(rule_class) else None
    owner = rule.get("owner_role")
    if (category is None or rule.get("allowed_next_step") != category
            or owner not in ("astronaut", "medical", "planner")
            or (category == "request_review" and owner != "medical")
            or match.approver_role != ("planner" if owner == "planner" else "medical")):
        return None, "rule_scope_or_approval_role_mismatch"
    source = evidence.get((match.evidence_id, match.evidence_version))
    if (not isinstance(source, Mapping) or rule.get("evidence_source_id") != match.evidence_id
            or source.get("evidence_source_id") != match.evidence_id
            or source.get("source_version") != match.evidence_version
            or source.get("data_origin") != "scientific_evidence"
            or source.get("source_kind") not in ("NASA_resource", "published_research", "approved_plan")
            or (category == "approved_plan_step" and source.get("source_kind") != "approved_plan")
            or not _text(source.get("claim_limitations"))):
        return None, "versioned_evidence_unavailable"

    metrics = rule.get("required_metric_codes")
    quality = rule.get("required_quality")
    if (not isinstance(metrics, (list, tuple)) or any(not _text(metric) for metric in metrics)
            or quality not in ("valid", "reference_eligible")):
        return None, "unsupported_rule_input_requirements"
    if (not isinstance(match.slot_ids, tuple) or any(not _text(key) for key in match.slot_ids)
            or len(set(match.slot_ids)) != len(match.slot_ids)):
        return None, "invalid_match_slots"
    selected = [assessments.get(key) for key in match.slot_ids]
    if any(item is None for item in selected):
        return None, "required_readings_unavailable"
    record_ids = tuple(item["raw_information_status"]["record_ref"] for item in selected)
    if match.supporting_record_ids != record_ids:
        return None, "approval_record_binding_mismatch"
    available_metrics = set()
    for item in selected:
        raw, assessed = item["raw_information_status"], item["information_status"]
        if (raw["status"] != "valid" or assessed["status"] in ("no_reading", "incomplete")
                or (item["comparison"] and item["comparison"]["reason"] in (
                    "missing_selected_value", "unsupported_reference_metric", "comparison_metric_mismatch",
                ))
                or "duplicate_observation" in raw["reason_codes"]
                or (quality == "reference_eligible" and assessed["reference_eligible"] is not True)):
            return None, "required_readings_unavailable"
        metric = item.get("metric")
        available_metrics.add(metric)
        if item["kind"] == "sleep_record" and metric is not None:
            available_metrics.add("sleep_" + metric)
    if not set(metrics).issubset(available_metrics):
        return None, "required_readings_unavailable"
    reference_ids = tuple((item["comparison"] or {}).get("reference_id") for item in selected)
    if match.reference_ids != reference_ids:
        return None, "approval_reference_binding_mismatch"

    return _step(
        category, "The authorized workflow matched this record set to an approved rule version.", owner,
        action_text=match.action_text if category == "approved_plan_step" else "Request specialist review.",
        rule_id=match.rule_id, rule_version=match.rule_version,
        source_reference_id=match.evidence_id, source_version=match.evidence_version,
        approval_record_id=match.approval_record_id, limitations=source["claim_limitations"],
        supporting_record_ids=list(record_ids), reference_ids=list(reference_ids),
    ), None


def evaluate(readings, *, subject_id, subject_mode, as_of_utc, symptom_reports=(),
             review_request_ids=(), follow_ups=(), approved_matches=(), rule_definitions=None,
             evidence_sources=None, expected_rule_versions=()):
    """Return JSON-ready observations and one next-step proposal for one subject.

    Review request IDs and ApprovedMatch instances come from an authorized,
    current/as-of workflow, never directly from client input. The full result is
    for that subject's authorized review context. It creates no application records.
    """
    if (not _text(subject_id) or subject_mode not in status.MODES.values()
            or status.parse_utc(as_of_utc) is None):
        raise ValueError("A subject partition and explicit as-of UTC time are required")
    observations, limitations, proposals, assessments, visible_follow_ups = [], [], [], {}, []
    seen_slots = set()
    for slot in readings:
        if not _text(slot.slot_id) or slot.slot_id in seen_slots:
            raise ValueError("Expected reading slots must have unique nonempty IDs")
        seen_slots.add(slot.slot_id)
        if slot.policy is not None and slot.policy.kind != slot.kind:
            raise ValueError("Reference policy kind must match the expected slot")
        record = slot.observation.record
        if isinstance(record, Mapping) and not _scoped(record, subject_id, subject_mode):
            limitations.append({"code": "reading_outside_subject_partition", "slot_id": slot.slot_id})
            continue
        result = _assess(slot)
        _compare(slot, result, as_of_utc)
        assessments[slot.slot_id] = result
        finding = _reading_finding(result)
        if finding:
            kind, explanation, limit = finding
            record_id = result["raw_information_status"]["record_ref"]
            observations.append({"finding_kind": kind, "slot_id": slot.slot_id,
                                 "supporting_record_ids": [record_id] if record_id else [],
                                 "explanation": explanation, "limitations": limit})
            if kind == "missing_data":
                proposals.append(_step("complete_measurement", explanation, "astronaut",
                                       slot_id=slot.slot_id,
                                       action_text="Complete or verify the expected entry when permitted.",
                                       **WORKFLOW_SOURCE))

    review_refs = []
    for report in symptom_reports:
        if not _scoped(report, subject_id, subject_mode):
            limitations.append({"code": "symptom_outside_subject_partition"})
        elif report.get("report_kind") == "symptom" and _text(report.get("self_report_id")):
            # The report itself remains available by ID even if its text is incomplete.
            review_refs.append(report["self_report_id"])
    for request_id in review_request_ids:
        if not _text(request_id):
            limitations.append({"code": "invalid_review_request_reference"})
            continue
        review_refs.append(request_id)
    for follow_up in follow_ups:
        if (not _scoped(follow_up, subject_id, subject_mode)
                or not _text(follow_up.get("follow_up_id"))
                or follow_up.get("followup_status") not in FOLLOWUP_STATES):
            limitations.append({"code": "invalid_or_out_of_scope_follow_up"})
            continue
        followup_status = follow_up["followup_status"]
        followup_id = follow_up["follow_up_id"]
        visible_follow_ups.append({"follow_up_id": followup_id, "followup_status": followup_status})
        if followup_status in ("review_requested", "under_specialist_review"):
            review_refs.append(followup_id)
    if review_refs:
        refs = list(dict.fromkeys(review_refs))
        reason = "A symptom or review request is available to the specialist."
        observations.append({"finding_kind": "review_request", "explanation": reason,
                             "supporting_record_ids": refs, "owner_role": "medical"})
        proposals.append(_step("request_review", reason, "medical", supporting_record_ids=refs,
                               action_text="Prepare or continue the specialist review.", **WORKFLOW_SOURCE))

    supplied_versions = set()
    for match in approved_matches:
        if isinstance(match, ApprovedMatch) and _text(match.rule_id) and _text(match.rule_version):
            supplied_versions.add((match.rule_id, match.rule_version))
        proposal, limitation = _approved_step(
            match, rule_definitions or {}, evidence_sources or {}, assessments, subject_id, subject_mode,
        )
        if limitation:
            detail = {"code": limitation}
            if isinstance(match, ApprovedMatch) and _text(match.rule_id) and _text(match.rule_version):
                detail.update(rule_id=match.rule_id, rule_version=match.rule_version)
            limitations.append(detail)
            continue
        observations.append({
            "finding_kind": "review_request" if proposal["step_category"] == "request_review"
            else "approved_plan_step",
            "explanation": proposal["reason_text"],
            "limitations": proposal["limitations"],
            "supporting_record_ids": proposal["supporting_record_ids"],
            "rule_id": proposal["rule_id"], "rule_version": proposal["rule_version"],
            "source_reference_id": proposal["source_reference_id"], "source_version": proposal["source_version"],
            "owner_role": proposal["owner_role"],
        })
        proposals.append(proposal)
    for rule_id, rule_version in expected_rule_versions:
        if (rule_id, rule_version) not in supplied_versions:
            limitations.append({"code": "approved_match_unavailable",
                                "rule_id": rule_id, "rule_version": rule_version})

    if not proposals:
        proposals.append(_step("observe", "Continue documenting available observations.", "astronaut",
                               action_text="Keep the observations available for follow-up.", **WORKFLOW_SOURCE))
    proposals.sort(key=lambda item: PRIORITY.index(item["step_category"]))
    return {"engine_version": ENGINE_VERSION, "subject_id": subject_id, "subject_mode": subject_mode,
            "as_of_utc": as_of_utc, "readings": list(assessments.values()), "observations": observations,
            "follow_ups": visible_follow_ups, "main_next_step": proposals[0],
            "other_next_steps": proposals[1:], "limitations": limitations}
