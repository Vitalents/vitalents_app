// Daily check (FR-CHK-01..03): imported sleep with its source, alertness 1-10, mood, private note.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { SelfReport, SleepRecord } from '../../data/contract'
import { useStore } from '../../store/store'
import { S } from '../decode/strings'
import { DataBadge } from '../decode/ResultView'

export interface CheckContext {
  subjectId: string
  today: string // YYYY-MM-DD, the review date
}

export function todaysSleep(data: ReturnType<typeof useStore.getState>['data'], ctx: CheckContext) {
  const sleep = data.sleep_record
    .filter((r: SleepRecord) => r.subject_id === ctx.subjectId && r.observation_date === ctx.today)
    .sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc))
    .pop()
  const status = sleep
    ? data.information_status.filter((i) => i.record_ref === sleep.sleep_record_id).sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc)).pop()
    : undefined
  return { sleep, status }
}

export function todaysAlertness(data: ReturnType<typeof useStore.getState>['data'], ctx: CheckContext): SelfReport | undefined {
  return data.self_report
    .filter((r) => r.subject_id === ctx.subjectId && r.report_kind === 'daily_check_alertness' && r.report_date === ctx.today)
    .sort((a, b) => (a.submitted_at_utc ?? a.created_at_utc).localeCompare(b.submitted_at_utc ?? b.created_at_utc))
    .pop()
}


// ARIA radio pattern: one tab stop per group (the checked option, else the first), arrow keys move and select.
const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)
function rovingTab<T>(current: T | null, value: T, first: T) {
  return (current ?? first) === value ? 0 : -1
}
function radioKeys<T>(e: KeyboardEvent<HTMLButtonElement>, values: T[], current: T | null, set: (v: T) => void) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  const edge = e.key === 'Home' ? 0 : e.key === 'End' ? values.length - 1 : null
  if (step === undefined && edge === null) return
  e.preventDefault()
  const at = current === null ? 0 : values.indexOf(current)
  const next = edge ?? (at + (step as number) + values.length) % values.length
  set(values[next])
  ;(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
}

// Section number in a tint circle (.num-badge): the four parts of the check are a real sequence.
function SectionHead({ n, title }: { n: number; title: string }) {
  return (
    <span className="dc-sec-head">
      <span className="num-badge" aria-hidden="true">{String(n).padStart(2, '0')}</span>
      <h3>{title}</h3>
    </span>
  )
}

export function DailyCheck({ ctx, onDone }: { ctx: CheckContext; onDone: () => void }) {
  const data = useStore((s) => s.data)
  const put = useStore((s) => s.put)
  const { sleep, status } = todaysSleep(data, ctx)
  const existing = todaysAlertness(data, ctx)
  const [alertness, setAlertness] = useState<number | null>(null)
  const [mood, setMood] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const pendingId = useRef<string | null>(null)
  const saveLock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const save = async () => {
    if (alertness === null || saveLock.current) return
    saveLock.current = true
    setSaving(true)
    setSaveError(false)
    const realm = ctx.subjectId.split(':', 1)[0]
    const now = new Date().toISOString()
    const rec: SelfReport = {
      self_report_id: pendingId.current ?? `${realm}:self_report:${crypto.randomUUID()}`,
      schema_version: '1.0',
      subject_id: ctx.subjectId,
      data_origin: 'application_generated',
      // entered live during the demo for a simulated crew member; the sim realm keeps is_simulated true
      is_simulated: realm === 'sim',
      created_at_utc: now,
      report_kind: 'daily_check_alertness',
      report_date: ctx.today,
      submitted_at_utc: now,
      alertness_rating: alertness,
      mood_code: mood,
      private_note: note.trim() ? note.trim() : null,
    }
    pendingId.current = rec.self_report_id
    try {
      await put('self_report', [rec])
      pendingId.current = null
      if (mounted.current) onDone()
    } catch {
      if (mounted.current) setSaveError(true)
    } finally {
      saveLock.current = false
      if (mounted.current) setSaving(false)
    }
  }

  const hours = sleep?.recorded_interval_ms != null ? (sleep.recorded_interval_ms / 3_600_000).toFixed(1) : null

  return (
    <section className="dc-card" aria-labelledby="dc-check-title">
      <p className="eyebrow">{S.stepOf(1, 2)}</p>
      <h2 id="dc-check-title">{S.checkTitle}</h2>
      <p className="dc-muted">{S.checkIntro}</p>

      <div className="dc-block">
        <SectionHead n={1} title={S.sleepTitle} />
        {sleep && hours !== null ? (
          <div className="dc-sleep">
            <p className="dc-big">{S.sleepRecorded(hours)}</p>
            {sleep.minutes_asleep != null && <p className="dc-muted">{S.sleepAsleep(Math.round(sleep.minutes_asleep))}</p>}
            <dl className="dc-stats">
              <div><dt>{S.sleepSource}</dt><dd>{sleep.sleep_metric_method ?? sleep.source_file ?? S.sourceNotRecorded}</dd></div>
              {status && <div><dt>{S.dataStatus}</dt><dd><DataBadge status={status.status} /></dd></div>}
            </dl>
          </div>
        ) : (
          <div className="dc-sleep">
            <p><DataBadge status="no_reading" /></p>
            <p className="dc-muted">{S.sleepNoReadingHelp}</p>
            {/* TODO(question: the contract has no field for a manually entered sleep estimate; FR-CHK-02 manual entry needs one) */}
          </div>
        )}
      </div>

      {existing?.alertness_rating != null && (
        <div className="callout dc-callout">
          <p>{S.alreadyRecorded(existing.alertness_rating)}</p>
          <button type="button" className="dc-btn dc-btn-secondary" onClick={onDone}>{S.skipToDecode}</button>
        </div>
      )}

      <fieldset className="dc-block" disabled={saving}>
        <legend><SectionHead n={2} title={S.alertnessTitle} /></legend>
        <div className="dc-scale" role="radiogroup" aria-label={S.alertnessTitle}>
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={alertness === n}
              tabIndex={rovingTab(alertness, n, 1)}
              onKeyDown={(e) => radioKeys(e, SCALE, alertness, setAlertness)}
              className={`dc-scale-btn ${alertness === n ? 'is-on' : ''}`}
              onClick={() => setAlertness(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="dc-small">{S.alertnessScale}</p>
      </fieldset>

      <fieldset className="dc-block" disabled={saving}>
        <legend><SectionHead n={3} title={S.moodTitle} /></legend>
        <div className="dc-pills" role="radiogroup" aria-label={S.moodTitle}>
          {S.moods.map((m) => (
            <button key={m.code} type="button" role="radio" aria-checked={mood === m.code}
              tabIndex={rovingTab(mood, m.code, S.moods[0].code)}
              onKeyDown={(e) => radioKeys(e, S.moods.map((x) => x.code), mood, setMood)} className={`dc-pill ${mood === m.code ? 'is-on' : ''}`} onClick={() => setMood(m.code)}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="dc-block">
        <label htmlFor="dc-note"><SectionHead n={4} title={S.noteTitle} /></label>
        <textarea id="dc-note" className="dc-textarea" rows={3} value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} />
        <p className="dc-small">{S.noteHelp}</p>
      </div>

      {saveError && <p className="dc-save-error" role="alert">{S.saveCheckError}</p>}
      <button type="button" className="dc-btn" disabled={alertness === null || saving} onClick={() => void save()}>
        {saving ? S.savingCheck : S.saveCheck}
      </button>
    </section>
  )
}
