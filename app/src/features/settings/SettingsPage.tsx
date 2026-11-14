// Settings (UI-14): scenario loader for the demo (FR-SH-08, S1 only in Increment 1).
import { useState } from 'react'
import { S } from '../../content/strings'
import { useStore } from '../../store/store'

export function SettingsPage() {
  const { scenario, loadScenario } = useStore()
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)
  async function reload() {
    await loadScenario('S1')
    setConfirm(false)
    setDone(true)
  }
  return (
    <div className="page">
      <header className="page-head">
        <h1>{S.settings.title}</h1>
      </header>
      <section className="card pad">
        <h2>{S.settings.scenario}</h2>
        <p>{S.settings.current(scenario)}</p>
        {!confirm ? (
          <button className="btn" onClick={() => { setConfirm(true); setDone(false) }}>{S.settings.reload}</button>
        ) : (
          <div className="row-gap">
            <button className="btn primary" onClick={reload}>{S.settings.reloadConfirm}</button>
            <button className="btn" onClick={() => setConfirm(false)}>{S.help.cancel}</button>
          </div>
        )}
        {done && <p role="status" className="ok-note">{S.settings.reloaded}</p>}
        <p className="muted small">{S.settings.moreLater}</p>
      </section>
    </div>
  )
}
