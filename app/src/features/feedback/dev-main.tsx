// Dev entry for FR-PE-01..04 (feedback-dev.html): the feedback screens outside the shell. Not part of the build.
// Seeds a few simulated records on top of S1 so every state is visible. Dev only; never shipped.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import type { DecodeSession } from '../../data/contract'
import { useRole, type Role } from '../../store/role'
import { useStore } from '../../store/store'
import { makeKnowledgeGap } from '../ask/knowledgeGap'
import { FollowUpList } from '../followups/FollowUpList'
import { OUTCOME_TEXT, rate } from '../followups/records'
import { MedicalView } from '../roles/MedicalView'
import { AlertRating } from './AlertRating'
import { alertFeedback } from './records'
import { TriedActionsLog } from './TriedActionsLog'

const VIEWS = [
  ['plan', 'Plan + tried log', 'astronaut'],
  ['review', 'Review: alert rating', 'astronaut'],
  ['medical', 'Medical view', 'medical'],
  ['planner', 'Planner (nothing)', 'planner'],
] as const
type View = (typeof VIEWS)[number][0]
const NOW = () => '2026-11-15T09:00:00Z'
const FAHIM = 'sim:crew:fahim'

let seeding: Promise<void> | null = null
const seedOnce = () => (seeding ??= seed())

async function seed() {
  await useStore.getState().loadScenario('S1')
  const { data, put } = useStore.getState()
  const d25 = data.decode_session.find((s) => s.decode_session_id === 'sim:decode_session:d25')!
  const d28: DecodeSession = { ...d25, decode_session_id: 'sim:decode_session:d28', key_version: 'seed-28', start_at_utc: '2026-11-15T07:30:00Z', end_at_utc: '2026-11-15T07:31:30Z', correct_count: 42, accepted_responses: 43 }
  await put('decode_session', [d28])
  const a = data.action.find((x) => x.action_id === 'sim:action:dec-d25')!
  const r = rate({ ...a, execution_status: 'completed', completed_at_utc: '2026-11-15T08:00:00Z' }, 'useful', '2026-11-15T08:05:00Z')
  await put('action', [r.action])
  await put('feedback_entry', [r.feedback_entry])
  const fu = data.follow_up.find((f) => f.action_id === a.action_id)!
  await put('follow_up', [{ ...fu, outcome_note: OUTCOME_TEXT.within }])
  const f = (id: string) => data.finding.find((x) => x.finding_id === id)!
  await put('feedback_entry', [
    alertFeedback(f('sim:finding:dec-d25'), 'false_alarm', 'I was interrupted by a call during the session.', '2026-11-14T08:10:00Z'),
    alertFeedback(f('sim:finding:pain-d20'), 'useful', '', '2026-11-14T08:12:00Z'),
  ])
  await put('knowledge_gap', [
    makeKnowledgeGap('Does a 20-minute nap before the Decode task change the result?', ['lib:nasa-sleep-risk', 'lib:cognition-battery'], new Date('2026-11-14T07:40:00Z')),
    makeKnowledgeGap('How long after exercise should a resting pulse reading wait?', ['lib:nasa-hrp-risks'], new Date('2026-11-13T18:02:00Z')),
    makeKnowledgeGap('Is there a reference for reaction time under cabin noise?', [], new Date('2026-11-12T09:15:00Z')),
  ])
}

function Dev() {
  const { ready, error, data } = useStore()
  const setRole = useRole((s) => s.setRole)
  const read = () => (location.hash.slice(1) || 'plan') as View
  const [view, setView] = useState<View>(read)
  useEffect(() => { void seedOnce() }, [])
  useEffect(() => {
    const on = () => setView(read())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { setRole(VIEWS.find((v) => v[0] === view)![2] as Role) }, [view, setRole])
  const changed = data.finding.filter((x) => x.finding_kind === 'descriptive_change')

  return (
    <div className="app">
      <div className="banner">Simulated data · not a medical device</div>
      <nav aria-label="Dev views" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        {VIEWS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="btn" aria-current={view === k ? 'page' : undefined} style={view === k ? { background: 'var(--tint)' } : undefined}>{label}</a>
        ))}
        <button className="btn" onClick={() => void seed()}>Reset</button>
      </nav>
      <main style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
        {!ready ? <p>Loading…</p> : error ? <p role="alert">{error}</p> : (
          <>
            {view === 'plan' && <><FollowUpList now={NOW} /><TriedActionsLog subjectId={FAHIM} /></>}
            {view === 'review' && (
              <div className="page">
                <section className="card pad block block-changed" aria-labelledby="block-2" style={{ maxWidth: 560 }}>
                  <h2 id="block-2"><span className="num-badge" aria-hidden="true">02</span>Changed</h2>
                  {changed.map((x) => (
                    <div key={x.finding_id} className="finding">
                      <p>{x.explanation}</p>
                      <p className="muted small">{x.limitations}</p>
                      <AlertRating finding={x} now={NOW} />
                    </div>
                  ))}
                </section>
              </div>
            )}
            {view === 'medical' && <MedicalView subjectId={FAHIM} />}
            {view === 'planner' && <><TriedActionsLog subjectId={FAHIM} /><p className="muted">Planner: the feedback components render nothing.</p></>}
          </>
        )}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Dev /></StrictMode>)
