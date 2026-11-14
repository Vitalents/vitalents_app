// Read-only selectors over the store. Screens use these instead of touching raw tables.
import { useMemo } from 'react'
import { DOMAINS } from '../content/content'
import type { DailyReview, SubjectProfile } from '../data/contract'
import { buildDomainViews, buildReview, indexRecords, type DataSet } from '../engine/view'
import { MISSION_ANCHOR } from '../engine/mission'
import { useStore } from './store'
import { useRole } from './role'
import { filterData } from './permissions'

/** Identifier used to select the loaded simulation; never grants access to its health records. */
export function useActiveSubjectId(): string | null {
  return useStore((s) => s.data.subject_profile[0]?.subject_profile_id ?? null)
}

export function useVisibleStoreData() {
  const data = useStore((s) => s.data)
  const role = useRole((s) => s.role)
  const subjectId = data.subject_profile[0]?.subject_profile_id ?? ''
  return useMemo(() => filterData(role, data, { subjectId }), [data, role, subjectId])
}

export function useDataSet(): DataSet {
  return useVisibleStoreData() as unknown as DataSet
}

export function useCurrentReview(): DailyReview | null {
  const reviews = useVisibleStoreData().daily_review
  return useMemo(() => [...reviews].sort((a, b) => a.review_date.localeCompare(b.review_date) || a.created_at_utc.localeCompare(b.created_at_utc) || a.daily_review_id.localeCompare(b.daily_review_id)).at(-1) ?? null, [reviews])
}

export function useSubject(): SubjectProfile | null {
  const subjects = useVisibleStoreData().subject_profile
  return subjects[0] ?? null
}

export function useReviewDate(): string {
  return useCurrentReview()?.review_date ?? MISSION_ANCHOR.date
}

export function useDomainViews() {
  const data = useDataSet()
  const review = useCurrentReview()
  const date = review?.review_date ?? MISSION_ANCHOR.date
  return useMemo(() => buildDomainViews(data, DOMAINS, date, review?.created_at_utc), [data, date, review?.created_at_utc])
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
  const events = useVisibleStoreData().sync_event
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
