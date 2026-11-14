// Read-only selectors over the store. Screens use these instead of touching raw tables.
import { useMemo } from 'react'
import { DOMAINS } from '../content/content'
import type { DailyReview, SubjectProfile } from '../data/contract'
import { buildDomainViews, buildReview, indexRecords, type DataSet } from '../engine/view'
import { MISSION_ANCHOR } from '../engine/mission'
import { useStore } from './store'

export function useDataSet(): DataSet {
  return useStore((s) => s.data) as unknown as DataSet
}

export function useCurrentReview(): DailyReview | null {
  const reviews = useStore((s) => s.data.daily_review)
  return useMemo(() => [...reviews].sort((a, b) => a.review_date.localeCompare(b.review_date)).at(-1) ?? null, [reviews])
}

export function useSubject(): SubjectProfile | null {
  const subjects = useStore((s) => s.data.subject_profile)
  return subjects[0] ?? null
}

export function useReviewDate(): string {
  return useCurrentReview()?.review_date ?? MISSION_ANCHOR.date
}

export function useDomainViews() {
  const data = useDataSet()
  const date = useReviewDate()
  return useMemo(() => buildDomainViews(data, DOMAINS, date), [data, date])
}

export function useReviewView() {
  const data = useDataSet()
  const review = useCurrentReview()
  return useMemo(() => (review ? buildReview(data, DOMAINS, review) : null), [data, review])
}

export function useRecordIndex() {
  const data = useDataSet()
  return useMemo(() => new Map(indexRecords(data).map((r) => [r.id, r])), [data])
}

/** Connection state is its own label (CLAUDE.md rule 2): packages whose latest sync event is not delivered or reviewed. */
export function useWaitingToSend(): number {
  const events = useStore((s) => s.data.sync_event)
  return useMemo(() => {
    const latest = new Map<string, { status: string; at: string }>()
    for (const e of events) {
      const key = e.share_package_id ?? e.message_id
      const prev = latest.get(key)
      if (!prev || e.occurred_at_utc > prev.at) latest.set(key, { status: e.sync_status, at: e.occurred_at_utc })
    }
    return [...latest.values()].filter((v) => v.status === 'saved_locally' || v.status === 'queued' || v.status === 'sent').length
  }, [events])
}
