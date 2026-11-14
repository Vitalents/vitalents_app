#!/usr/bin/env python3
"""FR-RT-01 research track: a transparent per-person model on SIMULATED data only.

Research prototype on simulated data. It is not used for any step, alert, finding or reference
in the app, and it needs independent validation before anyone relies on it.

What it does, per simulated crew member:
  inputs   recorded sleep of the night before the Decode round (hours) and the self-rated alertness
           (1-10) of the same morning, both from the astronaut's own record;
  output   an expected range of Decode correct answers *on simulated data*;
  model    Bayesian linear regression (scikit-learn BayesianRidge, its default non-informative
           hyperpriors) on the two inputs, standardised inside each training fold;
  baseline the personal median of the training days (the same idea as the personal reference);
  checks   leave-one-day-out (as asked) and forward-only (each day from earlier days only, which
           avoids using later days to explain earlier ones). Mean absolute error, days closer than
           the baseline, coverage and width of the 80 % ranges.

Rows used: completed, non-practice Decode sessions whose latest information status is `valid`, with a
valid sleep record of the same observation date (the night that ended that morning) and an alertness
rating of the same date. Anything else is listed in `excluded` with its reason, never filled in.

Usage: python3 research/model.py            # reads app/public/data/fixtures/, writes research/out/
       python3 research/model.py --fixtures DIR --out DIR
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys
from dataclasses import dataclass, field

import numpy as np
from scipy import stats
from sklearn.linear_model import BayesianRidge

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "app/public/data/fixtures"
OUT = pathlib.Path(__file__).resolve().parent / "out"

MODEL_VERSION = "research-model-0.1"
RANGE_LEVEL = 0.80          # design choice: an 80 % expected range
FORWARD_MIN_TRAIN = 5       # design choice: forward-only starts once 5 earlier days exist
COLLINEAR = 0.7            # design choice: above this |correlation| the slopes are reported as not separable
LOW_Q, HIGH_Q = 10, 90      # baseline range: 10th to 90th percentile of the training days (matches 80 %)
INPUTS = [
    {"key": "sleep_h", "label": "Recorded sleep the night before", "unit": "h",
     "source": "sleep_record.recorded_interval_ms (simulated wrist estimate)"},
    {"key": "alertness", "label": "Self-rated alertness that morning", "unit": "1-10",
     "source": "self_report.alertness_rating (daily_check_alertness)"},
]
TARGET = {"key": "decode_correct_count", "label": "Decode correct answers", "unit": "count",
          "source": "decode_session.correct_count"}


class NotSimulated(ValueError):
    """Raised when a bundle holds anything other than simulated mission data."""


@dataclass
class Row:
    date: str
    sleep_h: float
    alertness: float
    correct: float
    record_ids: list[str]


@dataclass
class Subject:
    subject_id: str
    scenario: str
    file: str
    sha256: str
    rows: list[Row] = field(default_factory=list)
    excluded: list[dict] = field(default_factory=list)


# ---- loading ------------------------------------------------------------------------------------

def _check_simulated(bundle: dict, name: str) -> None:
    for prof in bundle.get("subject_profile", []):
        if prof.get("subject_mode") != "mission_simulation":
            raise NotSimulated(f"{name}: subject_mode {prof.get('subject_mode')!r} is not mission_simulation")
    for entity in ("sleep_record", "self_report", "decode_session", "information_status"):
        for rec in bundle.get(entity, []):
            rid = rec.get(f"{entity}_id", "")
            if not rid.startswith("sim:") or rec.get("is_simulated") is not True:
                raise NotSimulated(f"{name}: {entity} {rid!r} is not simulated (realm sim, is_simulated true)")


def _latest_status(bundle: dict) -> dict[str, str]:
    rows = sorted(bundle.get("information_status", []), key=lambda r: r["created_at_utc"])
    out: dict[str, str] = {}
    for r in rows:
        out[r["record_ref"]] = r["status"]
    return out


def rows_from_bundle(bundle: dict) -> tuple[list[Row], list[dict]]:
    """Joined model rows for one bundle, plus every excluded session with its reason."""
    status = _latest_status(bundle)
    st = lambda rid: status.get(rid, "valid")  # same default as app/src/engine/view.ts infoStatusOf
    sleep = {}
    for s in bundle.get("sleep_record", []):
        sleep.setdefault(s["observation_date"], []).append(s)
    alert = {}
    for r in bundle.get("self_report", []):
        if r["report_kind"] == "daily_check_alertness":
            alert.setdefault(r["report_date"], []).append(r)

    rows, excluded = [], []
    sessions = sorted(bundle.get("decode_session", []), key=lambda s: s["start_at_utc"])
    for s in sessions:
        sid, day = s["decode_session_id"], s["start_at_utc"][:10]
        reason = None
        if s["is_practice"]:
            reason = "practice session"
        elif st(sid) != "valid":
            reason = f"Decode information status is {st(sid)}"
        elif s.get("correct_count") is None:
            reason = "no Decode correct count"
        if reason:
            excluded.append({"date": day, "record_id": sid, "reason": reason})
            continue
        sl = [x for x in sleep.get(day, []) if st(x["sleep_record_id"]) == "valid" and x.get("recorded_interval_ms") is not None]
        al = [x for x in alert.get(day, []) if st(x["self_report_id"]) == "valid" and x.get("alertness_rating") is not None]
        if not sl:
            excluded.append({"date": day, "record_id": sid, "reason": "no valid sleep record for the night before"})
            continue
        if not al:
            excluded.append({"date": day, "record_id": sid, "reason": "no alertness rating that morning"})
            continue
        sl0, al0 = sorted(sl, key=lambda x: x["sleep_record_id"])[-1], sorted(al, key=lambda x: x["submitted_at_utc"] or "")[-1]
        rows.append(Row(day, sl0["recorded_interval_ms"] / 3_600_000, float(al0["alertness_rating"]), float(s["correct_count"]),
                        [sid, sl0["sleep_record_id"], al0["self_report_id"]]))
    return rows, excluded


def load_subjects(fixtures: pathlib.Path) -> list[Subject]:
    """One subject per simulated crew member: the first scenario in index.json that holds them."""
    index = json.loads((fixtures / "index.json").read_text(encoding="utf-8"))
    seen: dict[str, Subject] = {}
    for sc in index["scenarios"]:
        if sc["subject_id"] in seen:
            continue
        path = fixtures / sc["file"]
        raw = path.read_bytes()
        bundle = json.loads(raw)
        _check_simulated(bundle, sc["file"])
        rows, excluded = rows_from_bundle(bundle)
        seen[sc["subject_id"]] = Subject(sc["subject_id"], sc["code"], f"app/public/data/fixtures/{sc['file']}",
                                         hashlib.sha256(raw).hexdigest(), rows, excluded)
    return list(seen.values())


# ---- model ---------------------------------------------------------------------------------------

Z = float(stats.norm.ppf(0.5 + RANGE_LEVEL / 2))


def _design(rows: list[Row]) -> np.ndarray:
    return np.array([[r.sleep_h, r.alertness] for r in rows], dtype=float)


def fit(rows: list[Row]):
    """Fit on rows; returns a predictor and the inputs it could use (constant inputs carry no information)."""
    X, y = _design(rows), np.array([r.correct for r in rows])
    mu, sd = X.mean(axis=0), X.std(axis=0)
    used = sd > 1e-9
    if not used.any():
        return None, used, mu, sd
    m = BayesianRidge(fit_intercept=True).fit((X[:, used] - mu[used]) / sd[used], y)
    return m, used, mu, sd


def predict(fitted, rows: list[Row], train_y: np.ndarray) -> list[tuple[float, float, float]]:
    """(expected, low, high) per row. With no usable input, the model falls back to the training mean ± its spread."""
    m, used, mu, sd = fitted
    if m is None:
        mean = float(train_y.mean())
        s = float(train_y.std(ddof=1)) if len(train_y) > 1 else 0.0
        return [(mean, mean - Z * s, mean + Z * s) for _ in rows]
    X = _design(rows)
    mean, std = m.predict((X[:, used] - mu[used]) / sd[used], return_std=True)
    return [(float(a), float(a - Z * b), float(a + Z * b)) for a, b in zip(mean, std)]


def baseline(train_y: np.ndarray) -> tuple[float, float, float]:
    return float(np.median(train_y)), float(np.percentile(train_y, LOW_Q)), float(np.percentile(train_y, HIGH_Q))


def _evaluate(rows: list[Row], splits) -> dict:
    """splits yields (train_idx, test_idx). Every held-out row is predicted from its training rows only."""
    days = []
    for train, test in splits:
        tr = [rows[i] for i in train]
        ty = np.array([r.correct for r in tr])
        fitted = fit(tr)
        preds = predict(fitted, [rows[i] for i in test], ty)
        b = baseline(ty)
        for i, (e, lo, hi) in zip(test, preds):
            r = rows[i]
            days.append({
                "date": r.date, "record_ids": r.record_ids, "sleep_h": round(r.sleep_h, 3), "alertness": r.alertness,
                "actual": r.correct, "train_days": len(tr),
                "model": {"expected": round(e, 3), "low": round(lo, 3), "high": round(hi, 3)},
                "baseline": {"expected": round(b[0], 3), "low": round(b[1], 3), "high": round(b[2], 3)},
                "model_abs_error": round(abs(r.correct - e), 3), "baseline_abs_error": round(abs(r.correct - b[0]), 3),
                "model_in_range": lo <= r.correct <= hi, "baseline_in_range": b[1] <= r.correct <= b[2],
            })
    n = len(days)
    if n == 0:
        return {"held_out_days": 0, "days": [], "summary": None}
    me = np.array([d["model_abs_error"] for d in days])
    be = np.array([d["baseline_abs_error"] for d in days])
    summary = {
        "model_mae": round(float(me.mean()), 3),
        "baseline_mae": round(float(be.mean()), 3),
        "model_closer_days": int((me < be - 1e-9).sum()),
        "baseline_closer_days": int((be < me - 1e-9).sum()),
        "tied_days": int((np.abs(me - be) <= 1e-9).sum()),
        "model_in_range_days": int(sum(d["model_in_range"] for d in days)),
        "baseline_in_range_days": int(sum(d["baseline_in_range"] for d in days)),
        "model_mean_range_width": round(float(np.mean([d["model"]["high"] - d["model"]["low"] for d in days])), 3),
        "baseline_mean_range_width": round(float(np.mean([d["baseline"]["high"] - d["baseline"]["low"] for d in days])), 3),
        "beats_baseline": bool(me.mean() < be.mean() - 1e-9),
    }
    return {"held_out_days": n, "days": days, "summary": summary}


def leave_one_day_out(rows: list[Row]) -> dict:
    dates = sorted({r.date for r in rows})
    splits = [([i for i, r in enumerate(rows) if r.date != d], [i for i, r in enumerate(rows) if r.date == d]) for d in dates]
    out = _evaluate(rows, [s for s in splits if len(s[0]) >= 2])
    out["method"] = "Leave one day out: each day is held out in turn and its expected range comes from all other days, including later ones."
    return out


def forward_only(rows: list[Row], min_train: int = FORWARD_MIN_TRAIN) -> dict:
    dates = sorted({r.date for r in rows})
    splits = []
    for k, d in enumerate(dates):
        train = [i for i, r in enumerate(rows) if r.date < d]
        if len({rows[i].date for i in train}) >= min_train:
            splits.append((train, [i for i, r in enumerate(rows) if r.date == d]))
    out = _evaluate(rows, splits)
    out["method"] = f"Forward only: each day's expected range comes from earlier days only, starting once {min_train} earlier days exist."
    return out


def final_fit(rows: list[Row]) -> dict:
    """The model on every row, with its slopes in original units (per hour of sleep, per alertness point)."""
    m, used, mu, sd = fit(rows)
    coefs = []
    for k, spec in enumerate(INPUTS):
        if m is None or not used[k]:
            coefs.append({"input": spec["key"], "used": False, "per_unit": None, "per_unit_sd": None,
                          "note": "This input did not vary in the record, so it carries no information here."})
            continue
        j = int(used[: k + 1].sum() - 1)
        slope = m.coef_[j] / sd[k]
        slope_sd = float(np.sqrt(m.sigma_[j, j])) / sd[k]
        coefs.append({"input": spec["key"], "used": True, "per_unit": round(float(slope), 3), "per_unit_sd": round(slope_sd, 3), "note": None})
    X = _design(rows)
    corr = float(np.corrcoef(X[:, 0], X[:, 1])[0, 1]) if used.all() else None
    return {
        "rows": len(rows),
        "coefficients": coefs,
        "input_correlation": round(corr, 3) if corr is not None else None,
        "noise_sd": round(float(1 / np.sqrt(m.alpha_)), 3) if m is not None else None,
        "input_means": {spec["key"]: round(float(mu[k]), 3) for k, spec in enumerate(INPUTS)},
        "expected_at_input_means": round(float(m.intercept_), 3) if m is not None else None,
    }


VERDICT_RULE = (
    "Better: a lower average miss than the baseline in both checks, and closer on more than half of the held-out days in each. "
    "Mixed: a lower average miss when leaving one day out, but not in the forward-only check or not on most days. "
    "Not better: no lower average miss than the baseline when leaving one day out. "
    "Not checked: too few days."
)


def verdict(loo: dict | None, fwd: dict | None) -> str:
    """Plain verdict against the personal-median baseline (rule in VERDICT_RULE)."""
    a = loo["summary"] if loo else None
    if a is None:
        return "not_evaluated"
    if not a["beats_baseline"]:
        return "not_better"
    b = fwd["summary"] if fwd else None
    majority = lambda x: x["model_closer_days"] * 2 > (x["model_closer_days"] + x["baseline_closer_days"] + x["tied_days"])
    if b is not None and b["beats_baseline"] and majority(a) and majority(b):
        return "better"
    return "mixed"


def run_subject(s: Subject) -> dict:
    key = s.subject_id.split(":")[-1]
    loo, fwd = (leave_one_day_out(s.rows), forward_only(s.rows)) if len(s.rows) >= 3 else (None, None)
    fitted = final_fit(s.rows) if len(s.rows) >= 3 else None
    extra = []
    corr = fitted["input_correlation"] if fitted else None
    if corr is not None and abs(corr) >= COLLINEAR:
        extra.append(f"The two inputs moved together in this record (correlation {corr:.2f}), so the model cannot tell their slopes apart; "
                     "read the slopes as one combined pattern, not as two separate effects.")
    if fitted and any(not c["used"] for c in fitted["coefficients"]):
        extra.append("An input that never changed in this record was left out of the model.")
    return {
        "research_model_id": f"sim:research_model:{key}",
        "model_version": MODEL_VERSION,
        "is_simulated": True,
        "label": "Research prototype on simulated data — not used for any step or alert",
        "subject_id": s.subject_id,
        "scenario_code": s.scenario,
        "source_file": s.file,
        "source_sha256": s.sha256,
        "inputs": INPUTS,
        "target": TARGET,
        "model": {
            "name": "Bayesian linear regression (scikit-learn BayesianRidge)",
            "settings": "Default non-informative hyperpriors; inputs standardised inside each training fold; an input that does not vary in a fold is dropped.",
            "range": f"{int(RANGE_LEVEL * 100)} % expected range: expected value ± {Z:.3f} × predictive standard deviation.",
            "baseline": f"Personal median of the training days; its range is their {LOW_Q}th to {HIGH_Q}th percentile.",
        },
        "rows_used": [{"date": r.date, "sleep_h": round(r.sleep_h, 3), "alertness": r.alertness, "actual": r.correct, "record_ids": r.record_ids} for r in s.rows],
        "excluded": s.excluded,
        "fit": fitted,
        "evaluation": {"leave_one_day_out": loo, "forward_only": fwd},
        "verdict": verdict(loo, fwd),
        "verdict_rule": VERDICT_RULE,
        "limits": [
            "Simulated data only: whoever wrote the simulated data decided how sleep and Decode relate, so this model can at best recover those assumptions.",
            f"Very few days ({len(s.rows)} usable for this person); every number here is unstable.",
            "Leave-one-day-out uses later days to explain earlier ones; the forward-only check does not.",
            "Practice gains over the first sessions are not an input, so early days count against the model.",
            "Two observations that happen together are a pattern in the record, not a cause.",
            *extra,
            "Not used for any step, alert, finding or reference. Needs independent validation.",
        ],
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--fixtures", type=pathlib.Path, default=FIXTURES)
    ap.add_argument("--out", type=pathlib.Path, default=OUT)
    a = ap.parse_args(argv)
    a.out.mkdir(parents=True, exist_ok=True)
    for s in load_subjects(a.fixtures):
        res = run_subject(s)
        key = s.subject_id.split(":")[-1]
        path = a.out / f"model_{key}.json"
        path.write_text(json.dumps(res, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        ev = res["evaluation"]["leave_one_day_out"]
        sm = ev["summary"] if ev else None
        msg = f"model MAE {sm['model_mae']} vs baseline {sm['baseline_mae']}" if sm else "too few days to evaluate"
        print(f"{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}: {len(s.rows)} rows, {msg}, verdict {res['verdict']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
