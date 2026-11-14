// Dev-only entry: renders CheckPage without the shell (served by `npm run dev` at /decode-dev.html).
import { StrictMode, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
// same self-hosted font and shared styles as the app (main.tsx), so the dev page looks like the real screen
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import { useStore } from '../../store/store'
import { CheckPage } from '../check/CheckPage'
import { HELP_EVENT } from './useRound'

function Dev() {
  const ready = useStore((s) => s.ready)
  const error = useStore((s) => s.error)
  const init = useStore((s) => s.init)
  useEffect(() => {
    void init()
  }, [init])
  useEffect(() => {
    const onHelp = (e: Event) => console.log('[decode-dev] request help', JSON.stringify((e as CustomEvent).detail ?? null))
    window.addEventListener(HELP_EVENT, onHelp)
    return () => window.removeEventListener(HELP_EVENT, onHelp)
  }, [])
  if (error) return <p>Error: {error}</p>
  if (!ready) return <p>Loading…</p>
  return <CheckPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><Dev /></BrowserRouter>
  </StrictMode>,
)
