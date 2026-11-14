// Dev-only entry (app/ask-dev.html): renders Ask NASA without the shell so it can be built in parallel.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import { useStore } from '../../store/store'
import { AskBox } from './AskBox'
import { AskPage } from './AskPage'

function Dev() {
  const loaded = useStore((s) => s.ready)
  useEffect(() => {
    void useStore.getState().init()
  }, [])
  return (
    <main className="dev-wrap">
      <AskPage />
      <section className="dev-domain card pad" aria-label="Compact box in a domain card">
        <p className="eyebrow">Dev preview: domain card, Understand tab (cognition)</p>
        <AskBox domainId="cognition" compact />
      </section>
      {!loaded && <p className="muted small">Loading record…</p>}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dev />
  </StrictMode>,
)
