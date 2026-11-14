// Dev entry for Record & trends (open /record-dev.html on the dev server). Not part of the production build.
// Mounts the real shell with only this route; ?s=S3 loads another scenario.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import { Layout } from '../../shell/Layout'
import { useStore } from '../../store/store'
import { RecordPage } from './RecordPage'

function Scenario() {
  const { ready, scenario, loadScenario } = useStore()
  const want = new URLSearchParams(location.search).get('s')
  useEffect(() => {
    if (ready && want && want !== scenario) loadScenario(want)
  }, [ready, want, scenario, loadScenario])
  return <RecordPage />
}

const router = createMemoryRouter(
  [{ path: '/', element: <Layout />, children: [{ path: 'record', element: <Scenario /> }, { path: '*', element: <p className="pad">Dev: only /record is mounted.</p> }] }],
  { initialEntries: ['/record'] },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
