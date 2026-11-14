"""Replay four fictional, versioned mission scenarios through the Python engines."""
import argparse
from dataclasses import asdict
from datetime import timedelta
import json
from pathlib import Path
from random import Random

from . import decode, reference, rules, schedule, status

FIXTURE = Path(__file__).with_name("fixtures") / "mission_s1_s4.json"
ORIGIN = "simulated_mission"
MODE = "mission_simulation"
DEMO_POLICIES = {
    "sleep": reference.Policy("sleep_record", "minutes_asleep", "sim-sleep-v1", 14, 5),
    "decode": reference.Policy("decode_session", "median_correct_rt_ms", "sim-decode-v1", 14, 5),
}
LIMIT = "Fictional software-validation data. DECODE describes task performance only."


def _record(kind, label, at, *, subject_id=None, origin=ORIGIN, **fields):
    record = {
        kind + "_id": f"{subject_id or 'sim'}:{kind}:{label}", "schema_version": "0.9",
        "data_origin": origin, "created_at_utc": at, "is_simulated": True, **fields,
    }
    if subject_id is not None:
        record["subject_id"] = subject_id
    return record


def _utc(instant):
    return instant.isoformat().replace("+00:00", "Z")


def _sleep(subject_id, day, minutes):
    return _record(
        "sleep_record", day, day + "T07:00:00Z", subject_id=subject_id, observation_date=day,
        minutes_asleep=minutes, minutes_awake=480 - minutes, recorded_interval_ms=28_800_000,
        recorded_interval_hours=8, sleep_metric_method="Synthetic nightly record",
    )


def _keys():
    return {
        "sim-key-even": {f"sym_{i}": i for i in range(1, 10)},
        "sim-key-odd": {f"sym_{i}": i % 9 + 1 for i in range(1, 10)},
    }


def _game(subject, day, spec, randomizer):
    subject_id = subject["subject_profile_id"]
    start = day + "T10:00:00Z"
    planned = status.DECODE_WINDOW_MS
    interrupted = "interrupted_at_ms" in spec
    elapsed = spec.get("interrupted_at_ms", planned)
    end = _utc(status.parse_utc(start) + timedelta(milliseconds=elapsed))
    key_version = "sim-key-odd" if int(day[-2:]) % 2 else "sim-key-even"
    key_registry = _keys()
    key = key_registry[key_version]
    session = _record(
        "decode_session", day, end, subject_id=subject_id, protocol_version="sim-decode-90s-v1",
        key_version=key_version, start_at_utc=start, end_at_utc=end, planned_duration_ms=planned,
        elapsed_monotonic_ms=elapsed, is_practice=False, input_method="keyboard",
        session_state="interrupted" if interrupted else "completed",
        interruption_reasons=["simulated_focus_loss"] if interrupted else [],
        app_version="sim-client-v1", technical_context="Synthetic fixed display and keyboard",
    )
    events = []
    attempts = spec["attempts"]
    errors = set(randomizer.sample(range(attempts), attempts - spec["correct"]))
    correct_seen = 0
    for trial in range(attempts + int(interrupted)):
        shown = trial * (planned // attempts) if not interrupted else trial * 1500
        symbol = f"sym_{randomizer.randint(1, 9)}"
        is_interrupted = trial == attempts
        correct = trial not in errors and not is_interrupted
        rt = spec["median_rt_ms"] + (-40, 0, 40)[correct_seen % 3]
        correct_seen += int(correct)
        events.append(_record(
            "decode_response_event", f"{day}:{trial}", end, subject_id=subject_id,
            decode_session_id=session["decode_session_id"], trial_index=trial, symbol_id=symbol,
            correct_digit=key[symbol],
            response_digit=None if is_interrupted else (key[symbol] if correct else key[symbol] % 9 + 1),
            stimulus_monotonic_ms=shown, response_monotonic_ms=None if is_interrupted else shown + rt,
            response_time_ms=None if is_interrupted else rt,
            response_state="interrupted" if is_interrupted else ("correct" if correct else "incorrect"),
            is_accepted=not is_interrupted, input_method="keyboard",
            focus_state="background" if is_interrupted else "foreground",
        ))
    seal = [event["decode_response_event_id"] for event in events]
    audit = decode.verify(session, events, subject=subject, key_registry=key_registry, expected_event_ids=seal)
    if audit["issues"] or not audit["events_verified"] or (not interrupted and audit["summary"] is None):
        raise ValueError(f"Invalid synthetic DECODE ledger for {session['decode_session_id']}")
    session.update({field: (audit["summary"] or {}).get(field) for field in decode.SCORE_FIELDS})
    return {"session": session, "events": events, "expected_event_ids": seal, "verification": audit}


def _reading(slot, subject, current, history, as_of):
    policy = DEMO_POLICIES[slot]
    target = reference.Observation(None, {}) if current is None else current
    candidate = reference.build_reference(target, history, policy)
    reference_id = f"{subject['subject_profile_id']}:reference:{slot}:v1"
    series = reference.ReferenceSeries()
    if candidate.reference_status == "usable_for_question":
        series = series.activate(
            candidate, reference_id=reference_id, expected_reference_id=None,
            decision=reference.Decision(
                reference_id + ":decision", "sim:medical-role", "medical", as_of,
                "Explicit activation for this fictional comparison.",
            ),
        ).decide("freeze", reference_id=reference_id, decision=reference.Decision(
            reference_id + ":freeze", "sim:medical-role", "medical", as_of,
            "Freeze this fictional reference for replay.",
        ))
    return rules.Reading(slot, policy.kind, target, policy, series), {
        "status": candidate.reference_status, "reason": candidate.reason,
        "source_ids": [source.record_id for source in candidate.sources],
        "exclusions": [asdict(exclusion) for exclusion in candidate.exclusions],
        "record": reference.task2_record(series.active, schema_version="0.9") if series.active else None,
        "decisions": [asdict(event.decision) for event in series.events],
    }


def _schedule(subject_id, scenario, day, next_day, clock, as_of):
    resource = f"{subject_id}:console"
    horizon = schedule.Interval(day + "T20:00:00Z", next_day + "T08:00:00Z", clock)
    rest_window = schedule.Interval(day + "T23:00:00Z", next_day + "T06:00:00Z", clock)
    earlier = schedule.Interval(day + "T22:00:00Z", day + "T23:00:00Z", clock)
    rows = [_record(
        "mission_schedule", "handover", as_of, subject_id=subject_id, mission_day=day,
        clock_reference=clock, activity_label="Habitat handover", start_at=rest_window.start_at,
        end_at=next_day + "T00:00:00Z", is_fixed=scenario in ("S2", "S4"),
        prep_minutes=0, travel_minutes=0, resource_constraints=[resource], approval_role="planner",
    )]
    proposals = []
    if scenario in ("S1", "S3"):
        proposals.append(schedule.Alternative("earlier-handover", (
            schedule.Move(rows[0]["mission_schedule_id"], earlier),
        )))
    if scenario == "S3":
        rows.append(_record(
            "mission_schedule", "contact", as_of, subject_id=subject_id, mission_day=day,
            clock_reference=clock, activity_label="Fixed communications window",
            start_at=earlier.start_at, end_at=earlier.end_at, is_fixed=True,
            prep_minutes=0, travel_minutes=0, resource_constraints=[resource], approval_role="planner",
        ))
        previous = schedule.Interval(day + "T21:00:00Z", day + "T22:00:00Z", clock)
        proposals.append(schedule.Alternative("move-fixed-contact", (
            schedule.Move(rows[-1]["mission_schedule_id"], previous),
        )))
    result = schedule.compare(
        rows, subject_id=subject_id, clock_reference=clock, clock_basis="UTC", horizon=horizon,
        rest_window=rest_window, resource_availability={resource: [horizon]}, alternatives=proposals,
    )
    return {
        "records": rows, "horizon": asdict(horizon), "rest_window": asdict(rest_window),
        "resource_availability": {resource: [asdict(horizon)]}, "clock_basis": "UTC",
        "candidates": [asdict(proposal) for proposal in proposals], "comparison": result,
    }


def _plan(subject_id, day, as_of):
    """Immutable IDs of the exact fixture inputs reviewed for the fictional plan."""
    definition = _record(
        "rule_definition", "record-observations", as_of, origin="application_generated",
        rule_version="sim-rule-v1", rule_class="approved_plan", approval_state="approved",
        required_metric_codes=["sleep_minutes_asleep", "median_correct_rt_ms"],
        required_quality="reference_eligible", allowed_next_step="approved_plan_step",
        owner_role="medical", evidence_source_id="sim:evidence_source:plan",
        condition_description="The two designated fictional observations are available for follow-up.",
        observation_template="Keep the two observations available for the simulation follow-up.",
    )
    source = _record(
        "evidence_source", "plan", as_of, origin="scientific_evidence",
        source_version="sim-plan-v1", source_kind="approved_plan",
        claim_limitations="Fictional plan for software replay only.",
        source_title="Synthetic observation logging plan", retrieval_date=day,
        license_status="Internal fictional fixture",
    )
    rule_key = (definition["rule_definition_id"], definition["rule_version"])
    evidence_key = (source["evidence_source_id"], source["source_version"])
    assertion = rules.ApprovedMatch(
        *rule_key, subject_id, MODE, f"{subject_id}:approval:plan-v1", "medical",
        *evidence_key, "Log sleep and DECODE observations separately and revisit at the next check.",
        ("sleep", "decode"), (f"{subject_id}:sleep_record:{day}", f"{subject_id}:decode_session:{day}"),
        (f"{subject_id}:reference:sleep:v1", f"{subject_id}:reference:decode:v1"),
    )
    return {
        "rule_definitions": {rule_key: definition}, "evidence_sources": {evidence_key: source},
        "approved_matches": [assertion],
    }


def _run_case(spec, subject, fixture, crew_ids):
    code = spec["scenario_code"]
    subject_id = subject["subject_profile_id"]
    day = fixture["review_date"]
    as_of = day + "T12:00:00Z"
    next_day = (status.parse_utc(as_of) + timedelta(days=1)).date().isoformat()

    def observation(record, **context):
        return reference.Observation(record, {"subject": subject, "conditions_compatible": True, **context})

    sleep_rows = [_sleep(subject_id, day[:8] + date, minutes)
                  for date, minutes in sorted(spec["sleep_minutes_by_day"].items())]
    current_sleep = next((observation(row) for row in sleep_rows if row["observation_date"] == day), None)
    sleep_slot, sleep_ref = _reading("sleep", subject, current_sleep, [
        observation(row) for row in sleep_rows if row["observation_date"] < day
    ], as_of)

    randomizer = Random(f"{fixture['seed']}:{code}")
    games = [_game(subject, day[:8] + f"{date:02}", spec["decode_history"], randomizer)
             for date in range(10, 20)] if "decode_history" in spec else []
    today_game = _game(subject, day, spec["decode_today"], randomizer)

    def game_observation(game):
        return observation(game["session"], events_verified=game["verification"]["events_verified"],
                           decode_familiarization_verified=True, decode_exposure_band="synthetic familiarized")

    game_slot, game_ref = _reading("decode", subject, game_observation(today_game),
                                   [game_observation(game) for game in games], as_of)
    hr = _record(
        "measurement", "resting-hr", day + "T09:05:00Z", subject_id=subject_id,
        observation_date=day, observed_at_utc=day + "T09:00:00Z", metric_code="hr_resting_bpm",
        value=spec["resting_hr_bpm"], unit="bpm", capture_method="simulator",
        source_metric_granularity="daily", measurement_context="Synthetic seated morning reading",
    )
    measurements = [hr]
    readings = [sleep_slot, game_slot, rules.Reading("resting_hr", "measurement", observation(hr))]
    reports = [_record(
        "self_report", "daily-check", day + "T09:45:00Z", subject_id=subject_id,
        origin="application_generated", report_kind="daily_check_alertness", report_date=day,
        submitted_at_utc=day + "T09:45:00Z", alertness_rating=spec["alertness_rating"],
    )]
    symptoms = []
    if "symptom_text" in spec:
        symptoms.append(_record(
            "self_report", "symptom", day + "T11:00:00Z", subject_id=subject_id,
            origin="application_generated", report_kind="symptom", report_date=day,
            submitted_at_utc=day + "T11:00:00Z", symptom_text=spec["symptom_text"],
            private_note="Synthetic private note excluded from specialist preview.",
        ))
        temperature = _record(
            "measurement", "skin-temperature", day + "T11:10:00Z", subject_id=subject_id,
            observation_date=day, observed_at_utc=day + "T07:00:00Z", metric_code="nightly_skin_temperature",
            value=spec["skin_temperature_c"], unit="\u00b0C", capture_method="simulator",
            source_metric_granularity="daily", measurement_context="Synthetic overnight skin temperature",
        )
        measurements.append(temperature)
        readings.append(rules.Reading("skin_temperature", "measurement", observation(temperature)))

    # Replay an existing Task 2 follow-up snapshot. The underlying engine stays read-only.
    options = _plan(subject_id, day, as_of) if code == "S1" else {}
    initial = rules.evaluate(readings, subject_id=subject_id, subject_mode=MODE, as_of_utc=as_of,
                             symptom_reports=symptoms, **options)
    step = initial["main_next_step"]
    review_id = f"{subject_id}:daily_review:{day}"
    findings = [_record(
        "finding", str(index), as_of, subject_id=subject_id, origin="application_generated",
        review_id=review_id, **finding,
    ) for index, finding in enumerate(initial["observations"])]
    action = _record(
        "action", "current", as_of, subject_id=subject_id, origin="application_generated",
        finding_id=next((row["finding_id"] for row in findings if row["finding_kind"] == {
            "approved_plan_step": "approved_plan_step", "request_review": "review_request",
            "complete_measurement": "missing_data", "observe": "context_conflict",
        }[step["step_category"]]), None),
        follow_up_due_utc=next_day + "T12:00:00Z",
        **{field: step[field] for field in ("step_category", "reason_text", "action_text",
                                           "owner_role", "execution_status")},
    )
    follow_spec = spec["follow_up"]
    if action["step_category"] != follow_spec["step_category"]:
        raise ValueError(f"Unexpected next-step category for {code}")
    followup = _record(
        "follow_up", "current", as_of, subject_id=subject_id, origin="application_generated",
        action_id=action["action_id"], followup_status=follow_spec["followup_status"],
        assigned_role=follow_spec["assigned_role"], opened_at_utc=as_of,
        next_review_due_utc=next_day + "T12:00:00Z", closing_reason=None, outcome_note=None,
    )
    review = rules.evaluate(readings, subject_id=subject_id, subject_mode=MODE, as_of_utc=as_of,
                            symptom_reports=symptoms, follow_ups=[followup], **options)

    review_record = _record(
        "daily_review", day, as_of, subject_id=subject_id, origin="application_generated",
        review_date=day, reading_ids=[row["measurement_id"] for row in measurements],
        sleep_record_id=current_sleep.record["sleep_record_id"] if current_sleep else None,
        decode_session_id=today_game["session"]["decode_session_id"],
        self_report_ids=[row["self_report_id"] for row in (*reports, *symptoms)],
        finding_ids=[row["finding_id"] for row in findings],
        selected_action_id=action["action_id"], review_explanation=LIMIT,
    )
    all_games = [*games, today_game]
    schedule_result = _schedule(subject_id, code, day, next_day, fixture["scenario_clock_basis"], as_of)
    references = [entry["record"] for entry in (sleep_ref, game_ref) if entry["record"] is not None]
    records = [
        *sleep_rows, *measurements, *reports, *symptoms, *findings, review_record, action, followup,
        *schedule_result["records"], *references, *(game["session"] for game in all_games),
        *(event for game in all_games for event in game["events"]),
    ]
    plan_records = None
    if options:
        plan_records = {
            "rule_definition": next(iter(options["rule_definitions"].values())),
            "evidence_source": next(iter(options["evidence_sources"].values())),
            "approval_match": asdict(options["approved_matches"][0]),
        }
        records.extend(plan_records[kind] for kind in ("rule_definition", "evidence_source"))
    fixture_ids = [next(value for field, value in record.items() if field.endswith("_id")) for record in records]
    scenario = _record(
        "simulator_scenario", code, as_of, scenario_code=code,
        crew_subject_ids=crew_ids, fixture_record_ids=fixture_ids,
        **{key: fixture[key] for key in (
            "seed", "scenario_version", "simulation_banner", "scenario_clock_basis",
        )},
        expected_outcomes=spec["expected_outcomes"],
    )
    preview = {
        "status": "preview_only", "intended_role": "medical",
        "included_record_ids": [symptoms[0]["self_report_id"], measurements[-1]["measurement_id"]],
        "explanation": "Fictional symptom and associated skin temperature for specialist review.",
    } if symptoms else None
    return {
        "scenario": scenario, "crew_profile": subject, "crew_role": spec["role"], "measurements": measurements,
        "sleep_records": sleep_rows, "self_reports": [*reports, *symptoms], "decode": all_games,
        "references": {"sleep": sleep_ref, "decode": game_ref},
        "review": review, "daily_review": review_record, "findings": findings, "action": action, "follow_up": followup,
        "specialist_preview": preview, "schedule": schedule_result,
        "synthetic_plan": plan_records,
    }


def run_all():
    """Return the complete synthetic replay, with no persistence side effects."""
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8-sig"))
    created = "2026-11-01T00:00:00Z"
    profiles = [_record(
        "subject_profile", spec["subject_id"], created, subject_mode=MODE,
        subject_profile_id=spec["subject_id"], crew_label=spec["crew_label"], timezone_basis="mission_defined", mission_phase="during",
        mission_profile_version=fixture["scenario_version"],
    ) for spec in fixture["crew"]]
    crew_ids = [profile["subject_profile_id"] for profile in profiles]
    if len(crew_ids) != 4 or len(set(crew_ids)) != 4 or any(not value.startswith("sim:crew:") for value in crew_ids):
        raise ValueError("Fixture crew identity mismatch")
    return {
        "simulation_banner": fixture["simulation_banner"], "interpretation": LIMIT,
        "decode_key_registry": _keys(),
        "scenarios": [_run_case(spec, profile, fixture, crew_ids)
                      for spec, profile in zip(fixture["crew"], profiles, strict=True)],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="Write the deterministic replay to a JSON file")
    options = parser.parse_args()
    contents = json.dumps(run_all(), indent=2, sort_keys=True, allow_nan=False) + "\n"
    if options.out:
        options.out.write_text(contents, encoding="utf-8", newline="\n")
    else:
        print(contents, end="")


if __name__ == "__main__":
    main()
