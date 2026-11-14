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
import { MapPage } from './features/map/MapPage'
import { S } from './content/strings'
import { useSubject } from './store/selectors'

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

// Role screens follow the loaded scenario's subject.
function WithSubject({ C }: { C: ComponentType<Record<string, unknown>> }) {
  const id = useSubject()?.subject_profile_id
  return id ? page(<C subjectId={id} />) : null
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <MapPage /> },
      { path: 'check', element: page(<CheckPage />) },
      { path: 'review', element: page(<ReviewPage />) },
      { path: 'record', element: page(<RecordPage />) },
      { path: 'plan', element: page(<><FollowUpList scheduleHref="/rest-window" /><div className="page"><TriedActionsLog /></div></>) },
      { path: 'rest-window', element: page(<RestWindowPage backHref="/plan" />) },
      { path: 'share', element: <WithSubject C={SharePage} /> },
      { path: 'medical', element: <WithSubject C={MedicalView} /> },
      { path: 'planner', element: <WithSubject C={PlannerView} /> },
      { path: 'domain/:id', element: page(<DomainPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'ask', element: page(<AskPage />) },
      { path: 'profile', element: page(<ProfilePage />) },
      { path: 'proof', element: page(<ProofPage />) },
      { path: 'research', element: page(<ResearchPage />) },
      { path: '*', element: <MapPage /> },
    ],
  },
])

registerPwa() // offline after one visit; never caches the local assistant

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <UpdateToast />
  </StrictMode>,
)
