// Dev entry for the research track and the pattern card (open /research-dev.html on the dev server).
// Not part of the production build. ?p=pattern shows the PatternCard alone; ?s=S3 loads another scenario.
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
import { PatternCard } from './PatternCard'
import { ResearchPage } from './ResearchPage'

function Scenario({ children }: { children: React.ReactNode }) {
  const { ready, scenario, loadScenario } = useStore()
  const want = new URLSearchParams(location.search).get('s')
  useEffect(() => {
    if (ready && want && want !== scenario) loadScenario(want)
  }, [ready, want, scenario, loadScenario])
  return <>{children}</>
}

const start = new URLSearchParams(location.search).get('p') === 'pattern' ? '/pattern' : '/research'
const router = createMemoryRouter(
  [{
    path: '/', element: <Layout />, children: [
      { path: 'research', element: <Scenario><ResearchPage /></Scenario> },
      { path: 'pattern', element: <Scenario><div className="page"><PatternCard /></div></Scenario> },
      { path: '*', element: <p className="pad">Dev: only /research and /pattern are mounted.</p> },
    ],
  }],
  { initialEntries: [start] },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
