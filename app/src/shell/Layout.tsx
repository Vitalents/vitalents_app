// App frame: simulated-data banner (FR-SH-07), header with mission day and separate sync label,
// six navigation entries (FR-SH-01), and Request help / Report something on every screen.
import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { S } from '../content/strings'
import { formatDate, missionDay } from '../engine/mission'
import { useReviewDate, useSubject, useWaitingToSend } from '../store/selectors'
import { useStore } from '../store/store'
import { HelpDialog, ReportDialog } from './Dialogs'
import { Icon } from './Icons'
import { Emblem, Logo, Mark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { HELP_EVENT, REPORT_EVENT } from '../features/decode/useRound'
import { useOutboxTicker } from '../sync/link'
import { OfflineNote } from '../pwa'
import { useRole } from '../store/role'

export const NAV = [
  { to: '/', key: 'map', end: true },
  { to: '/check', key: 'check' },
  { to: '/review', key: 'review' },
  { to: '/record', key: 'record' },
  { to: '/plan', key: 'plan' },
  { to: '/share', key: 'share' },
  { to: '/ask', key: 'ask' },
] as const

export function Layout() {
  const { ready, error, init } = useStore()
  const role = useRole((s) => s.role)
  const subject = useSubject()
  const date = useReviewDate()
  const waiting = useWaitingToSend()
  const [dialog, setDialog] = useState<'help' | 'report' | null>(null)
  const activeDialog = role === 'astronaut' ? dialog : null
  const { pathname } = useLocation()
  useOutboxTicker() // moves shared packages through the simulated link (FR-SY-02)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  // Dismiss rather than hide an old role's dialog, so switching back cannot reopen it.
  useEffect(() => useRole.subscribe((next, previous) => {
    if (next.role !== previous.role) setDialog(null)
  }), [])

  // Both entry points use the same event: an active Decode round stops before typing begins.
  useEffect(() => {
    const open = () => { if (role === 'astronaut') setDialog('help') }
    const report = () => { if (role === 'astronaut') setDialog('report') }
    window.addEventListener(HELP_EVENT, open)
    window.addEventListener(REPORT_EVENT, report)
    return () => {
      window.removeEventListener(HELP_EVENT, open)
      window.removeEventListener(REPORT_EVENT, report)
    }
  }, [role])

  return (
    <div className="app">
      <aside className="banner" aria-label="Data notice">{S.banner}</aside>
      <header className="topbar" inert={activeDialog !== null}>
        <Link to="/" className="brand" aria-label={S.appName}>
          <span className="brand-full"><Logo height={24} /></span>
          <span className="brand-compact"><Mark size={28} title={S.appName} /></span>
        </Link>
        <div className="mission">
          <strong className="mission-day">
            <span className="long">{S.header.missionDay(missionDay(date), formatDate(date))}</span>
            <span className="short">{S.header.missionDayShort(missionDay(date))}</span>
          </strong>
          <Link to="/profile" className="crew" title="Mission profile">{subject?.crew_label ?? '—'}</Link>
          <span className="sync" title={S.header.syncNone}>{waiting ? S.header.syncWaiting(waiting) : S.header.syncNone}</span>
        </div>
        <div className="top-actions">
          {role === 'astronaut' && <button className="btn danger tb-help" onClick={() => window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: { from: 'header' } }))}><Icon name="help" /><span>{S.header.help}</span></button>}
          {role === 'astronaut' && <button className="btn tb-report" onClick={() => window.dispatchEvent(new CustomEvent(REPORT_EVENT, { detail: { from: 'header' } }))}><Icon name="report" /><span>{S.header.report}</span></button>}
          <span className="tb-tools"><ThemeToggle /><NavLink to="/settings" className="icon-btn tb-settings" aria-label={S.nav.settings} title={S.nav.settings}><Icon name="settings" /></NavLink></span>
        </div>
      </header>

      <div className="body" inert={activeDialog !== null}>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false} className="nav-item">
              <Icon name={n.key} />
              <span className="nav-full">{S.nav[n.key].full}</span>
              <span className="nav-short">{S.nav[n.key].short}</span>
            </NavLink>
          ))}
          <OfflineNote />
        </nav>
        <main className="main" id="main">
          {!ready ? (
            <div className="loading-state" role="status"><Emblem size={88} /><p className="muted">{S.loading}</p></div>
          ) : error ? (
            <div className="card pad">
              <p>{S.loadError}</p>
              <p className="muted small">{error}</p>
              <button className="btn" onClick={() => useStore.getState().loadScenario('S1')}>{S.retry}</button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {activeDialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {activeDialog === 'report' && <ReportDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
