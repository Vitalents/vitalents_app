// Dev entry for Increment 5 (open /share-dev.html on the dev server). Not part of the production build.
// The role switcher picks the screen; every screen reads through filterData for that role.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import './share.css'
import { Emblem, Logo } from '../../shell/Logo'
import { useRole } from '../../store/role'
import { useStore } from '../../store/store'
import { sendOperationalRequest, useOutboxTicker } from '../../sync/link'
import { plannerRequest } from '../schedule/request'
import { MedicalView } from '../roles/MedicalView'
import { PlannerView } from '../roles/PlannerView'
import { RoleSwitcher } from '../roles/RoleSwitcher'
import { SharePage } from './SharePage'
import { SyncSettingsPanel } from './SyncSettingsPanel'
import { T } from './strings'

const SUBJECT = 'sim:crew:fahim'

/** Dev only: what the rest-window page does when the astronaut asks the planner to move the meeting. */
async function simulateRestWindowRequest() {
  const { data, put } = useStore.getState()
  const meeting = data.mission_schedule.find((m) => m.mission_schedule_id === 'sim:mission_schedule:meeting-d27')
  if (!meeting) return
  const action = plannerRequest(
    [{ item_id: meeting.mission_schedule_id, new_start: '2026-11-14T21:30:00Z', new_end: '2026-11-14T22:30:00Z' }],
    data.mission_schedule, 0, 420, new Date(),
  )
  await put('action', [action])
  await sendOperationalRequest(action, 'astronaut')
}

function DevApp() {
  const { ready, error, init, loadScenario } = useStore()
  const role = useRole((s) => s.role)
  useOutboxTicker()
  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="app">
      <div className="banner" role="note">{T.dev.simulated}</div>
      <header className="topbar">
        <span className="brand"><Logo height={24} /></span>
        <span className="mission small muted sh-dev-title">{T.dev.title}</span>
        <button type="button" className="btn" onClick={() => void simulateRestWindowRequest()}>{T.dev.restRequest}</button>
        <button type="button" className="btn" onClick={() => void loadScenario('S1')}>{T.dev.reset}</button>
      </header>
      <div className="sh-dev">
        <aside className="sh-dev-side" aria-label="Demo settings">
          <div className="card pad"><RoleSwitcher /></div>
          <SyncSettingsPanel />
        </aside>
        <main className="sh-dev-main" id="main">
          {!ready ? (
            <div className="loading-state" role="status"><Emblem size={88} /><p className="muted">{T.dev.loading}</p></div>
          ) : error ? (
            <p className="card pad">{error}</p>
          ) : role === 'astronaut' ? (
            <SharePage subjectId={SUBJECT} />
          ) : role === 'medical' ? (
            <MedicalView subjectId={SUBJECT} />
          ) : (
            <PlannerView subjectId={SUBJECT} />
          )}
        </main>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevApp />
  </StrictMode>,
)
