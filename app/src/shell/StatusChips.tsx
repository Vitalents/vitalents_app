// The two per-area labels (follow-up, data) are separate components on purpose: never merge them (FR-MAP-02).
import { S } from '../content/strings'
import { reasonText } from '../content/format'

export function FollowChip({ status, compact = false }: { status: string; compact?: boolean }) {
  return (
    <span className={`chip follow follow-${status}`} title={`${S.followPrefix}: ${S.follow[status]}`}>
      <span aria-hidden="true" className="chip-symbol">{S.followSymbol[status]}</span>
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
