// Entry: fonts, tokens and the router. Screens load on demand so the first page stays small.
import { lazy, StrictMode, Suspense, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import './styles/tokens.css'
import './styles/app.css'
import { Layout } from './shell/Layout'
import { registerPwa, UpdateToast } from './pwa'
import { applyStoredTheme } from './store/preferences'
import { MapPage } from './features/map/MapPage'
import { S } from './content/strings'
import { useActiveSubjectId } from './store/selectors'
import { RequireRole } from './shell/RequireRole'

const pick = <M,>(load: () => Promise<M>, name: keyof M) =>
  lazy(async () => ({ default: (await load())[name] as unknown as ComponentType<Record<string, unknown>> }))

const CheckPage = pick(() => import('./features/check/CheckPage'), 'CheckPage')
const ReviewPage = pick(() => import('./features/review/ReviewPage'), 'ReviewPage')
const RecordPage = pick(() => import('./features/record/RecordPage'), 'RecordPage')
const FollowUpList = pick(() => import('./features/followups/FollowUpList'), 'FollowUpList')
const TriedActionsLog = pick(() => import('./features/feedback/TriedActionsLog'), 'TriedActionsLog')
const RestWindowPage = pick(() => import('./features/schedule/RestWindowPage'), 'RestWindowPage')
const DomainPage = pick(() => import('./features/domain/DomainPage'), 'DomainPage')
const SettingsPage = pick(() => import('./features/settings/SettingsPage'), 'SettingsPage')
const AskPage = pick(() => import('./features/ask/AskPage'), 'AskPage')
const SharePage = pick(() => import('./features/sharing/SharePage'), 'SharePage')
const MedicalView = pick(() => import('./features/roles/MedicalView'), 'MedicalView')
const PlannerView = pick(() => import('./features/roles/PlannerView'), 'PlannerView')
const ProfilePage = pick(() => import('./features/profile/ProfilePage'), 'ProfilePage')
const ProofPage = pick(() => import('./features/proof/ProofPage'), 'ProofPage')
const ResearchPage = pick(() => import('./features/research/ResearchPage'), 'ResearchPage')

const page = (node: ReactNode) => <Suspense fallback={<p className="muted pad" role="status">{S.loading}</p>}>{node}</Suspense>
const astronautPage = (node: ReactNode) => <RequireRole roles={['astronaut']}>{page(node)}</RequireRole>

// Role screens follow the loaded scenario's subject.
function WithSubject({ C }: { C: ComponentType<Record<string, unknown>> }) {
  const id = useActiveSubjectId()
  return id ? page(<C subjectId={id} />) : null
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: astronautPage(<MapPage />) },
      { path: 'check', element: astronautPage(<CheckPage />) },
      { path: 'review', element: astronautPage(<ReviewPage />) },
      { path: 'record', element: astronautPage(<RecordPage />) },
      { path: 'plan', element: <RequireRole roles={['astronaut', 'medical']}>{page(<><FollowUpList scheduleHref="/rest-window" /><div className="page"><TriedActionsLog /></div></>)}</RequireRole> },
      { path: 'rest-window', element: astronautPage(<RestWindowPage backHref="/plan" />) },
      { path: 'share', element: <WithSubject C={SharePage} /> },
      { path: 'medical', element: <RequireRole roles={['medical']}><WithSubject C={MedicalView} /></RequireRole> },
      { path: 'planner', element: <RequireRole roles={['planner']}><WithSubject C={PlannerView} /></RequireRole> },
      { path: 'domain/:id', element: astronautPage(<DomainPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'ask', element: astronautPage(<AskPage />) },
      { path: 'profile', element: astronautPage(<ProfilePage />) },
      { path: 'proof', element: page(<ProofPage />) },
      { path: 'research', element: astronautPage(<ResearchPage />) },
      { path: '*', element: astronautPage(<MapPage />) },
    ],
  },
])

applyStoredTheme() // remembered light/dark choice before the first screen
registerPwa() // offline after one visit; never caches the local assistant

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <UpdateToast />
  </StrictMode>,
)
