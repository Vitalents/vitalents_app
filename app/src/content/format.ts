// Formats contract values for display. Never invents a value: null stays "No reading".
import type { DecodeSession, Measurement, PersonalReference, SelfReport, SleepRecord } from '../data/contract'
import type { AnyRecord } from '../engine/view'
import { formatDay } from '../engine/mission'
import { LIBRARY } from './content'
import { S } from './strings'

export function formatNumber(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(digits)
}

export function formatValue(v: number | null, unit: string | null): string {
  if (v === null) return S.info.no_reading
  if (unit === 'h') return `${formatNumber(v)} h`
  if (unit === 'bpm') return `${formatNumber(v, 0)} bpm`
  if (unit === '1-10') return `${formatNumber(v, 0)} / 10`
  if (unit === 'count') return `${formatNumber(v, 0)} correct`
  return unit ? `${formatNumber(v)} ${unit}` : formatNumber(v)
}

/** One-line description of any measured record, for Recorded and "Why?" lists. */
export function describeRecord(r: AnyRecord): { label: string; value: string; date: string; source: string | null } {
  const date = formatDay(r.date)
  switch (r.entity) {
    case 'sleep_record': {
      const s = r.record as unknown as SleepRecord
      return { label: S.entity.sleep_record, value: formatValue(s.recorded_interval_ms === null ? null : s.recorded_interval_ms / 3_600_000, 'h'), date, source: s.sleep_metric_method ?? null }
    }
    case 'measurement': {
      const m = r.record as unknown as Measurement
      return { label: S.metric[m.metric_code] ?? m.metric_code, value: formatValue(m.value, m.unit), date, source: m.capture_method ?? null }
    }
    case 'self_report': {
      const s = r.record as unknown as SelfReport
      if (s.report_kind === 'symptom') return { label: 'Reported symptom', value: s.symptom_text ?? '—', date, source: 'Self-report' }
      return { label: 'Self-rated alertness', value: formatValue(s.alertness_rating ?? null, '1-10'), date, source: 'Self-report' }
    }
    case 'decode_session': {
      const d = r.record as unknown as DecodeSession
      const acc = d.accuracy_percent === null ? '' : ` · ${formatNumber(d.accuracy_percent, 0)}% accuracy`
      return { label: S.entity.decode_session, value: `${formatValue(d.correct_count, 'count')}${acc}`, date, source: `Decode ${d.protocol_version}` }
    }
    case 'personal_reference': {
      const p = r.record as unknown as PersonalReference
      const v = p.reference_value === null ? S.refStatus.not_built : S.domain.referenceValue(formatNumber(p.reference_value), formatNumber(p.range_low ?? null), formatNumber(p.range_high ?? null))
      return { label: `${S.entity.personal_reference} · ${S.metric[p.metric_code] ?? p.metric_code}`, value: `${v}${p.frozen ? ` · ${S.domain.frozen}` : ''}`, date, source: p.method }
    }
    default:
      return { label: r.entity, value: '—', date, source: null }
  }
}

export function sourceTitle(id: string | null | undefined): string {
  if (!id) return S.review.noSource
  const s = LIBRARY.get(id)
  return s ? `${s.title} · ${s.publisher}` : id
}

export function reasonText(codes: string[]): string {
  return codes.map((c) => S.reason[c] ?? c.replace(/_/g, ' ')).join(', ')
}
