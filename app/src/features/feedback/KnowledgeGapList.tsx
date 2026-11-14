// FR-PE-04 Knowledge-gap log for the Medical role (DR-12): questions the assistant could not answer. Read-only.
// Reads through the permission layer; the planner never receives knowledge_gap records.
import { formatDay } from '../../engine/mission'
import { useRole } from '../../store/role'
import { useVisibleData } from '../roles/hooks'
import { gapDomains } from './records'
import { F } from './strings'
import './feedback.css'

export function KnowledgeGapList({ subjectId }: { subjectId: string }) {
  const role = useRole((s) => s.role)
  const data = useVisibleData(subjectId)
  if (role === 'planner') return null
  const gaps = [...data.knowledge_gap].sort((a, b) => b.created_at_utc.localeCompare(a.created_at_utc))

  return (
    <section className="fb fb-gaps card" aria-labelledby="fb-gaps-h">
      <header className="fb-head">
        <p className="kicker">{F.gaps.kicker}</p>
        <h2 id="fb-gaps-h">{F.gaps.title}</h2>
        <p className="muted">{F.gaps.lede}</p>
      </header>
      {gaps.length === 0 ? (
        <p className="muted">{F.gaps.empty}</p>
      ) : (
        <ul className="fb-gap-list">
          {gaps.map((g) => {
            const { names, general } = gapDomains(g)
            const searched = g.retrieved_source_ids?.length ?? 0
            return (
              <li key={g.knowledge_gap_id} className="fb-gap">
                <p className="fb-gap-q">{g.question_redacted}</p>
                <dl className="fb-gap-facts">
                  <div><dt>{F.gaps.asked}</dt><dd className="fb-num">{formatDay(g.created_at_utc)}</dd></div>
                  <div>
                    <dt>{F.gaps.domain}</dt>
                    <dd>{names.length ? names.join(', ') : <span className="muted">{general ? F.gaps.general : F.gaps.noDomain}</span>}</dd>
                  </div>
                  <div>
                    <dt>{F.gaps.status}</dt>
                    <dd>{F.gapStatus[g.status]}{searched > 0 && <span className="muted">, {F.gaps.sourcesSearched(searched)}</span>}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
