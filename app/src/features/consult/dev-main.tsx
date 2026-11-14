// Dev entry for FR-AS-09 (open /consult-dev.html on the dev server; add ?mode=live to call the local service).
// Not part of the production build. Shows the draft as it would sit under the share preview, and the package text.
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import { Emblem, Logo } from '../../shell/Logo'
import { useStore } from '../../store/store'
import { useVisibleData } from '../roles/hooks'
import { buildSummary } from '../sharing/summary'
import { ConsultDraft, type ConsultDraftState } from './ConsultDraft'
import { C } from './strings'

const SUBJECT = 'sim:crew:fahim'
const mode = new URLSearchParams(location.search).get('mode') === 'live' ? 'live' : 'cached'

function DevApp() {
  const { ready, error, init } = useStore()
  const data = useVisibleData(SUBJECT)
  const summary = useMemo(() => buildSummary(data, SUBJECT, C.dev.question), [data])
  const [state, setState] = useState<ConsultDraftState | null>(null)
  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="app">
      <div className="banner" role="note">{C.dev.simulated}</div>
      <header className="topbar">
        <span className="brand"><Logo height={24} /></span>
        <span className="mission small muted">{C.dev.title}</span>
      </header>
      <main className="main" id="main">
        <div className="page stack" style={{ maxWidth: 760 }}>
          {!ready ? (
            <div className="loading-state" role="status"><Emblem size={88} /><p className="muted">{C.dev.loading}</p></div>
          ) : error ? (
            <p className="card pad">{error}</p>
          ) : (
            <>
              <ConsultDraft summary={summary} onChange={setState} mode={mode} />
              <section className="card pad">
                <h2>{C.dev.package}</h2>
                {!state ? (
                  <p className="muted small">{C.dev.nothing}</p>
                ) : (
                  <>
                    {!state.sendable && <p className="field-error">{C.dev.blocked}</p>}
                    <pre className="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{state.text}</pre>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevApp />
  </StrictMode>,
)
