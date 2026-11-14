// Settings (UI-14): scenario loader S1–S5 (FR-SH-08), demo role (FR-PR-01) and the simulated link (FR-SY-03).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { S } from '../../content/strings'
import { useStore } from '../../store/store'
import { RoleSwitcher } from '../roles/RoleSwitcher'
import { SyncSettingsPanel } from '../sharing/SyncSettingsPanel'

interface ScenarioEntry { code: string; title: string; description: string }

export function SettingsPage() {
  const { scenario, loadScenario } = useStore()
  const [list, setList] = useState<ScenarioEntry[]>([])
  const [pick, setPick] = useState(scenario)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    fetch('/data/fixtures/index.json')
      .then((r) => (r.ok ? r.json() : { scenarios: [] }))
      .then((j: { scenarios: ScenarioEntry[] }) => setList(j.scenarios))
      .catch(() => setList([]))
  }, [])

  async function load() {
    await loadScenario(pick)
    setConfirm(false)
    setDone(pick)
  }

  const chosen = list.find((s) => s.code === pick)
  return (
    <div className="page stack">
      <header className="page-head">
        <h1>{S.settings.title}</h1>
      </header>

      <section className="card pad">
        <h2>{S.settings.scenario}</h2>
        <p>{S.settings.current(scenario)}</p>
        <label className="field">
          <span>{S.settings.choose}</span>
          <select value={pick} onChange={(e) => { setPick(e.target.value); setConfirm(false); setDone(null) }}>
            {(list.length ? list : [{ code: 'S1', title: '', description: '' }]).map((s) => (
              <option key={s.code} value={s.code}>{s.title ? `${s.code} · ${s.title}` : s.code}</option>
            ))}
          </select>
        </label>
        {chosen && <p className="muted small">{chosen.description}</p>}
        {!confirm ? (
          <button className="btn" onClick={() => { setConfirm(true); setDone(null) }}>{S.settings.reload(pick)}</button>
        ) : (
          <div className="row-gap">
            <button className="btn primary" onClick={load}>{S.settings.reloadConfirm(pick)}</button>
            <button className="btn" onClick={() => setConfirm(false)}>{S.help.cancel}</button>
          </div>
        )}
        {done && <p role="status" className="ok-note">{S.settings.reloaded(done)}</p>}
      </section>

      <section className="card pad">
        <h2>{S.settings.roleTitle}</h2>
        <RoleSwitcher />
        <p className="muted small">{S.settings.roleViews}</p>
        <div className="row-gap">
          <Link className="btn" to="/medical">{S.settings.medicalView}</Link>
          <Link className="btn" to="/planner">{S.settings.plannerView}</Link>
          <Link className="btn" to="/profile">{S.settings.profileView}</Link>
        </div>
      </section>

      <section className="card pad">
        <h2>{S.settings.linkTitle}</h2>
        <SyncSettingsPanel />
      </section>
    </div>
  )
}
