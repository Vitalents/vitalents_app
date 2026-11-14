// The two per-area labels (follow-up, data) are separate components on purpose: never merge them (FR-MAP-02).
// Symbols are drawn as SVG so they look the same on every device (DESIGN.md: ● ◐ ◑ ▲ ▲ ✓).
import { S } from '../content/strings'
import { reasonText } from '../content/format'

/** Follow-up symbol in a 12 × 12 box, centred on (6, 6). Use inside an <svg> or via FollowSymbol. */
export function FollowGlyph({ status }: { status: string }) {
  switch (status) {
    case 'watching':
      return (
        <>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 0 0 9z" fill="currentColor" />
        </>
      )
    case 'action_open':
      return (
        <>
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
        </>
      )
    case 'review_requested':
    case 'under_specialist_review':
      return <path d="M6 1.2 11 10.4H1z" fill="currentColor" strokeLinejoin="round" />
    case 'closed':
      return <path d="M2 6.4 4.9 9.2 10 2.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    default:
      return <circle cx="6" cy="6" r="3.5" fill="currentColor" />
  }
}

export function FollowSymbol({ status }: { status: string }) {
  return (
    <svg className="chip-symbol" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <FollowGlyph status={status} />
    </svg>
  )
}

export function FollowChip({ status, compact = false }: { status: string; compact?: boolean }) {
  return (
    <span className={`chip follow follow-${status}`} title={`${S.followPrefix}: ${S.follow[status]}`}>
      <FollowSymbol status={status} />
      {!compact && <span className="chip-prefix">{S.followPrefix}: </span>}
      {S.follow[status] ?? status}
    </span>
  )
}

export function DataBadge({ status, reasons = [], compact = false }: { status: string | null; reasons?: string[]; compact?: boolean }) {
  if (status === null) return <span className="chip data data-sample">{S.sampleCard}</span>
  const why = reasons.length ? ` (${reasonText(reasons)})` : ''
  return (
    <span className={`chip data data-${status}`} title={`${S.infoPrefix}: ${S.info[status]}${why}`}>
      {!compact && <span className="chip-prefix">{S.infoPrefix}: </span>}
      {S.info[status] ?? status}
      {!compact && why && <span className="chip-why">{why}</span>}
    </span>
  )
}
