# Data dictionary

The [v0.9 workbook](Vitalents_Task2_Data_Dictionary.xlsx) records source-field mappings and the original entity model. Current application fields, enums and decisions are defined by [the v1.0 contract](../CONTRACT_P0.md) and generated schemas under `contracts/`. The workbook is a source document, not runtime validation.

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

The original dictionary audit reported **70 repeated `(id,date,hour)` keys** (69 rows exact duplicates except export index + one conflicting keyed record in heart-zone columns). `id + date + hour` is **not a safe unique primary key** for original hourly CSV. These historical audit counts were not recalculated from participant files in this repository. Preserve source row locator and flag the conflict; don't silently overwrite.


## Reading the workbook

Start with `README`, `Entity Overview`, `Core Entity Fields`, `Enumerations`, `Relationships` and `Field Mapping`. The workbook’s original `Open Decisions` sheet is historical; current remaining research boundaries are recorded in [remaining questions](../../science/task2_contract/remaining-questions.md).
