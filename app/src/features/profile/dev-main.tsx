// Dev entry for FR-SH-04 (profile-dev.html): the mission profile outside the shell. Not part of the build.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import { useStore } from '../../store/store'
import { ProfilePage } from './ProfilePage'

function Dev() {
  const { ready, error, init, loadScenario } = useStore()
  useEffect(() => { init() }, [init])
  return (
    <div className="app">
      <div className="banner">Simulated data · not a medical device</div>
      <nav aria-label="Dev views" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        {['S1', 'S2', 'S3', 'S5'].map((s) => <button key={s} className="btn" onClick={() => loadScenario(s)}>Load {s}</button>)}
      </nav>
      <main style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
        {!ready ? <p>Loading…</p> : error ? <p role="alert">{error}</p> : <ProfilePage />}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Dev /></StrictMode>)
