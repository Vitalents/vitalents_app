// Sync status with the proof time of each step (FR-SY-03). Its own visual language: never the
import './share.css'
// follow-up or data colours (CLAUDE.md rule 2).
import type { SharePackage, SyncEvent } from '../../data/contract'
import { SYNC_STATES, eventsFor, roundTripMs } from '../../sync/engine'
import { useLink } from '../../sync/link'
import { useNow } from '../roles/hooks'
import { T, utcTime } from './strings'

export function SyncStatusRow({ pkg, events, compact = false }: { pkg: SharePackage; events: SyncEvent[]; compact?: boolean }) {
  const link = useLink((s) => s.link)
  const now = useNow(500)
  const list = eventsFor(events, pkg.share_package_id)
  const at = (s: SyncEvent['sync_status']) => list.find((e) => e.sync_status === s)?.occurred_at_utc ?? null
  const current = list.length ? list[list.length - 1].sync_status : null
  const reachedIndex = current ? SYNC_STATES.indexOf(current) : -1

  let note: string | null = null
  if (current === 'queued' && !link.linkUp) note = T.sync.linkDown
  else if (current === 'sent') {
    const sent = at('sent')
    const left = sent ? Math.max(0, Math.ceil((Date.parse(sent) + roundTripMs(link) - now) / 1000)) : 0
    note = link.linkUp ? T.sync.inTransit(left) : T.sync.linkDown
  } else if (current === 'delivered') note = T.sync.waitingReview

  return (
    <section className={`sh-track${compact ? ' is-compact' : ''}`} aria-label={T.sync.title}>
      <ol className="sh-stops" style={{ ['--reached' as string]: Math.max(0, reachedIndex) }}>
        {SYNC_STATES.map((s, i) => {
          const time = at(s)
          const state = i < reachedIndex ? 'is-done' : i === reachedIndex ? 'is-current' : 'is-ahead'
          return (
            <li key={s} className={`sh-stop ${state}`} aria-current={i === reachedIndex ? 'step' : undefined}>
              <span className="sh-dot" aria-hidden="true" />
              <span className="sh-stop-label">{T.sync.labels[s]}</span>
              {time ? (
                <time className="sh-stop-time" dateTime={time}>
                  {utcTime(time)}
                </time>
              ) : (
                <span className="sh-stop-time is-empty">{T.sync.notYet}</span>
              )}
            </li>
          )
        })}
      </ol>
      {!compact && (
        // one live region per screen: the full track only, so lists of packages stay quiet
        <p className="sh-sr-only" role="status" aria-live="polite">
          {current ? `${T.sync.title}: ${T.sync.labels[current]}` : ''}
        </p>
      )}
      {!compact && (
        <p className="sh-track-note">
          {note ? <span>{note} </span> : null}
          <span className="muted">{T.sync.proof}</span>
        </p>
      )}
    </section>
  )
}
