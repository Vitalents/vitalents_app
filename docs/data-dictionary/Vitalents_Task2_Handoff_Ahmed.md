# Vitalents — Task 2 Handoff to Ahmed

**Status:** FOR TEAM REVIEW | **Owner of dictionary:** Shaimaa | **Schema implementation owner:** Ahmed | **Date:** 2026-11-14

## Files to open first

1. `Vitalents_Task2_Data_Dictionary.xlsx` — start at `README`, `Entity Overview`, `Core Entity Fields`, `Enumerations`, `Relationships`, `Field Mapping`, and `Open Decisions`.
2. `Vitalents_Task2_Example_Records.json` — illustrative **synthetic** JSON records, not real astronaut or participant records.
3. `Vitalents_Task2_Architecture_Summary.docx` — source isolation and complete flow.
4. `Vitalents_Task2_LifeSnaps_Audit.docx` — verified counts and hazards.
5. `Vitalents_Task2_Open_Decisions.md` — only decisions still needing owners.

## What I defined vs what you implement

I defined proposed field names, types, units (including NOT VERIFIED), which fields are required/optional, allowed enums, relationship keys, provenance contracts, original CSV mapping, and quality constraints. **I have not written JSON Schema or TypeScript interfaces, frontend components, DB migrations, or runtime validation.** Those remain yours.

## Contract boundaries

- 21 proposed entities, 325 proposed app field definitions and 114 directly observed CSV source fields; 41 explicit mapping rows.
- All source data must distinguish `real_research`, `simulated_mission`, `live_decode`, and `application_generated` (scientific evidence separately classified).
- `subject_mode` partitions participants: `real_research`, `mission_simulation`, `live_player`. Same string ID **never** means same identity across modes.
- Preserve original LifeSnaps `id` (`daily`/`hourly`) and `user_id` (`stai`/`panas`) as raw source fields, and map them to the same research-only identity when applicable.
- Keep `observation_date` (research local calendar date) separate from `created_at_utc` (our ingestion time); hourly `hour_local` alone does **not** support UTC reconstruction.
- A missing numeric value is `null`/unavailable, **not** 0; don't interpolate or fill average in descriptive history.
- `sleep_duration` is **milliseconds** (recorded interval). `minutesAsleep` is **minutes** (estimated asleep); don't conflate them. If showing hours: `sleep_duration / 3_600_000`.
- `bpm` and `resting_hr` are different metrics; preserve daily/hourly aggregation differences.
- Don't treat signed `hourly.temperature` as absolute/body temperature; source unit and meaning not verified. `scl_avg` cannot power the main stress logic.
- STAI/PANAS were **weekly** (not per-day repeated measurements); preserve observed survey categories, no clinical label.
- DECODE raw trial events are required to verify `correct_count`, `accuracy_percent`, `median_correct_rt_ms`. Zero accepted answers => accuracy `null`, not 0. No readiness prediction.
- Data `information_status` stays separate from `followup_status` and `sync_status`; a missing measurement cannot imply no health issue.
- Share package includes only previewed records. Planner must not access private notes, medical record, or DECODE scores.

## Import caveat: hourly duplicate keys

Direct audit found **70 repeated `(id,date,hour)` keys** (69 rows exact duplicates except export index + one conflicting keyed record in heart-zone columns). `id + date + hour` is **not a safe unique primary key** for original hourly CSV. Preserve source row locator and flag the conflict; don't silently overwrite.

## Recommended review sequence

1. Agree common PK naming, references and namespaces (`subject_id` and `subject_profile_id` alias resolution).
2. Confirm whether optional fields are explicitly `null` or omitted, per entity.
3. Freeze enums and local-date/UTC contract for sim, live DECODE and LifeSnaps research.
4. Implement your JSON Schema / TypeScript interfaces in the app; do not reuse my document as runtime validation.
5. Use synthetic examples to test valid records, missing-data records and cross-mode join rejection.
6. Only then implement ingestion of the real dataset once license/hosting constraints are checked.

## Unresolved approvals (not scientific findings)

- Team: latest Scope Update approval; NASA 2026 official Resource integration; LifeSnaps v4 file reuse/license.
- Ahmed: duplicate resolution, PK and schema types, timestamp contract and null representation.
- Shaimaa: labels/units for uncertain temperature fields, later reference eligibility algorithm.
- Team: DECODE interruption semantics before quality and scoring tests.

**Release gate:** `READY FOR TEAM REVIEW`, not a frozen implementation contract.
