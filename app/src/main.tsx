import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import './styles/tokens.css'
import './styles/app.css'
import { Layout } from './shell/Layout'
import { MapPage } from './features/map/MapPage'
import { CheckPage } from './features/check/CheckPage'
import { ReviewPage } from './features/review/ReviewPage'
import { RecordPage, SharePage } from './features/placeholder/Placeholder'
import { PlanPage } from './features/plan/PlanPage'
import { DomainPage } from './features/domain/DomainPage'
import { SettingsPage } from './features/settings/SettingsPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <MapPage /> },
      { path: 'check', element: <CheckPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'record', element: <RecordPage /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'share', element: <SharePage /> },
      { path: 'domain/:id', element: <DomainPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <MapPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
