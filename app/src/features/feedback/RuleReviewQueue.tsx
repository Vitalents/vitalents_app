// FR-PE-02/03 Rule-review queue for the Medical role: alerts rated false alarm, grouped by rule id + version.
// Input comes from ruleReviewItems() in the data layer, which exposes rule metadata and the rating only.
// Read-only: nothing on this screen changes a rule, limit or reference.
import { useMemo } from 'react'
import { formatDay } from '../../engine/mission'
import { ruleReviewItems } from '../../store/permissions'
import { useRole } from '../../store/role'
import { useStore } from '../../store/store'
import { ruleGroups } from './records'
import { F } from './strings'
import './feedback.css'

export function RuleReviewQueue({ subjectId }: { subjectId: string }) {
  const role = useRole((s) => s.role)
  const data = useStore((s) => s.data)
  const groups = useMemo(() => (role === 'planner' ? [] : ruleGroups(ruleReviewItems(role, data, { subjectId }))), [role, data, subjectId])
  if (role === 'planner') return null

  return (
    <section className="fb fb-queue card" aria-labelledby="fb-queue-h">
      <header className="fb-head">
        <p className="kicker">{F.queue.kicker}</p>
        <h2 id="fb-queue-h">{F.queue.title}</h2>
        <p className="muted">{F.queue.lede}</p>
      </header>
      <p className="callout fb-callout">{F.neverChanges}</p>

      {groups.length === 0 ? (
        <p className="muted">{F.queue.empty}</p>
      ) : (
        <ul className="fb-groups">
          {groups.map((g) => (
            <li key={`${g.rule_id}@${g.rule_version}`} className="fb-group">
              <div className="fb-group-head">
                <h3 className="fb-rule"><code>{F.queue.rule(g.rule_id, g.rule_version)}</code></h3>
                <p className="fb-counts fb-num">
                  <span className="fb-count">{F.queue.falseAlarms(g.falseAlarms.length)}</span>
                  <span className="muted">{F.queue.useful(g.usefulCount)}</span>
                </p>
              </div>
              <ul className="fb-items">
                {g.falseAlarms.map((it) => (
                  <li key={it.feedback_entry_id} className="fb-item">
                    <span className="fb-item-date fb-num">{F.queue.rated} {formatDay(it.rated_at_utc)}</span>
                    <span className="fb-item-kind">{F.findingKind[it.finding_kind]}</span>
                    <span className={`fb-item-reason${it.reason ? '' : ' muted'}`}>
                      <span className="sr-only">{F.queue.reason}: </span>
                      {it.reason ?? F.queue.noReason}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="fb-review small">
                <strong>{F.queue.review}.</strong> {F.queue.reviewNote}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
