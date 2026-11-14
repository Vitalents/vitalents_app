// Dev entry for Increment 3 (act-dev.html): the act-and-follow screens outside the shell. Not part of the build.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import type { MissionSchedule } from '../../data/contract'
import { useStore } from '../../store/store'
import { RestWindowPage } from '../schedule/RestWindowPage'
import { FollowUpList } from './FollowUpList'

const VIEWS = [
  ['followups', 'Plan & follow-ups'],
  ['rest', 'Rest window'],
  ['rest-fixed', 'Rest window: no alternative'],
  ['planner', 'Planner view'],
] as const
type View = (typeof VIEWS)[number][0]
const NOW = () => '2026-11-14T08:30:00Z' // mission day 27 morning (simulated clock)

function Dev() {
  const { ready, error, init, loadScenario, data } = useStore()
  const read = () => (location.hash.slice(1) || 'followups') as View
  const [view, setView] = useState<View>(read)
  useEffect(() => { init() }, [init])
  useEffect(() => {
    const on = () => setView(read())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const fixed: MissionSchedule[] = data.mission_schedule.map((r) => (r.item_kind === 'task' ? { ...r, is_fixed: true } : r))

  return (
    <div className="app">
      <div className="banner">Simulated data · not a medical device</div>
      <nav aria-label="Dev views" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        {VIEWS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="btn" aria-current={view === k ? 'page' : undefined} style={view === k ? { background: 'var(--tint)' } : undefined}>{label}</a>
        ))}
        <button className="btn" onClick={() => loadScenario('S1')}>Reset S1</button>
      </nav>
      <main style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
        {!ready ? <p>Loading…</p> : error ? <p role="alert">{error}</p> : (
          <>
            {view === 'followups' && <FollowUpList scheduleHref="#rest" now={NOW} />}
            {view === 'rest' && <RestWindowPage now={NOW} backHref="#followups" />}
            {view === 'rest-fixed' && <RestWindowPage now={NOW} schedule={fixed} backHref="#followups" />}
            {view === 'planner' && <FollowUpList role="planner" now={NOW} />}
          </>
        )}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Dev /></StrictMode>)
