"""Cross-check the scenario fixtures against science/status.py (S-07 stand-in, FR-SIM-02).

For every measurement, sleep_record and decode_session in app/public/data/fixtures/S*.json, run
status.evaluate() with that record's subject context and compare with the fixture's stored
information_status row. events_verified is True only when the session's decode_response_event
rows exist and rescore (contract D-9) to exactly the stored summaries.

Every fixture status must agree with the evaluator; no scenario is exempted.

Run: python3 -B -m unittest discover -s science/tests -t .
"""
import json
import statistics
import unittest
from pathlib import Path

from science.status import KINDS, evaluate

FIXTURES = Path(__file__).resolve().parents[2] / "app/public/data/fixtures"

def rescore(events):
    """Contract D-9 summaries from the stored event ledger."""
    accepted = [e for e in events if e["is_accepted"]]
    correct = [e for e in accepted if e["response_state"] == "correct"]
    for e in events:
        state = e["response_state"]
        if (state in ("correct", "incorrect")) != e["is_accepted"]:
            return None
        if state == "correct" and e["response_digit"] != e["correct_digit"]:
            return None
        if state == "incorrect" and e["response_digit"] in (None, e["correct_digit"]):
            return None
    rts = [e["response_monotonic_ms"] - e["stimulus_monotonic_ms"] for e in correct]
    return {
        "accepted_responses": len(accepted),
        "correct_count": len(correct),
        "accuracy_percent": (100 * len(correct)) / len(accepted) if accepted else None,
        "median_correct_rt_ms": float(statistics.median(rts)) if rts else None,
    }


def events_verified(session, events):
    if not events:
        return False
    if sorted(e["trial_index"] for e in events) != list(range(1, len(events) + 1)):
        return False
    summary = rescore(events)
    return summary is not None and all(session.get(k) == v for k, v in summary.items())


def comparisons():
    """Yield (file, record id, kind, stored status, engine result)."""
    for path in sorted(FIXTURES.glob("S*.json")):
        bundle = json.loads(path.read_text(encoding="utf-8"))
        profiles = {p["subject_profile_id"]: p for p in bundle.get("subject_profile", [])}
        stored = {s["record_ref"]: s["status"] for s in bundle.get("information_status", [])}
        events = {}
        for e in bundle.get("decode_response_event", []):
            events.setdefault(e["decode_session_id"], []).append(e)
        for kind in KINDS:
            for rec in bundle.get(kind, []):
                rid = rec[f"{kind}_id"]
                prof = profiles[rec["subject_id"]]
                ctx = {"subject": {"subject_profile_id": prof["subject_profile_id"], "subject_mode": prof["subject_mode"]}}
                if kind == "decode_session":
                    ctx["events_verified"] = events_verified(rec, events.get(rid, []))
                yield path.name, rid, kind, stored.get(rid), evaluate(kind, rec, context=ctx)


class FixtureStatusTest(unittest.TestCase):
    def setUp(self):
        self.rows = list(comparisons())

    def test_every_record_has_a_stored_status(self):
        missing = [(f, rid) for f, rid, _, st, _ in self.rows if st is None]
        self.assertEqual(missing, [])
        self.assertTrue(any(f == "S2.json" for f, *_ in self.rows))

    def test_statuses_match_engine(self):
        bad = [(f, rid, st, r["status"], r.get("reason_codes")) for f, rid, _, st, r in self.rows
               if st != r["status"]]
        self.assertEqual(bad, [], "fixture information_status disagrees with status.py")

    def test_new_scenarios_verify_their_events(self):
        """All five scenarios preserve their verifiable event ledgers."""
        for f, rid, kind, st, r in self.rows:
            if kind == "decode_session":
                with self.subTest(file=f, record=rid):
                    self.assertNotIn("unverified_decode_events", r.get("reason_codes", []))

    def test_scenario_expectations(self):
        s2 = json.loads((FIXTURES / "S2.json").read_text())
        self.assertNotIn("sim:sleep_record:c2-d27", {s["sleep_record_id"] for s in s2["sleep_record"]})
        d27 = next(s for s in s2["decode_session"] if s["decode_session_id"] == "sim:decode_session:c2-d27")
        self.assertEqual(d27["session_state"], "interrupted")
        s3 = json.loads((FIXTURES / "S3.json").read_text())
        self.assertTrue(all(i["is_fixed"] for i in s3["mission_schedule"]))
        s4 = json.loads((FIXTURES / "S4.json").read_text())
        self.assertEqual(s4["follow_up"][0]["followup_status"], "review_requested")
        s5 = json.loads((FIXTURES / "S5.json").read_text())
        self.assertEqual(s5["sync_event"][0]["sync_status"], "saved_locally")


if __name__ == "__main__":
    unittest.main()
