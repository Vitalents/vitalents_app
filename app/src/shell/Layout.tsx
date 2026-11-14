// App frame: simulated-data banner (FR-SH-07), header with mission day and separate sync label,
// six navigation entries (FR-SH-01), and Request help / Report something on every screen.
import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { CONTENT_IS_DRAFT } from '../content/content'
import { S } from '../content/strings'
import { formatDate, missionDay } from '../engine/mission'
import { useReviewDate, useSubject, useWaitingToSend } from '../store/selectors'
import { useStore } from '../store/store'
import { HelpDialog, ReportDialog } from './Dialogs'
import { Icon } from './Icons'
import { Emblem, Logo, Mark } from './Logo'
import { HELP_EVENT } from '../features/decode/useRound'
import { useOutboxTicker } from '../sync/link'
import { OfflineNote } from '../pwa'

export const NAV = [
  { to: '/', key: 'map', end: true },
  { to: '/check', key: 'check' },
  { to: '/review', key: 'review' },
  { to: '/record', key: 'record' },
  { to: '/plan', key: 'plan' },
  { to: '/share', key: 'share' },
] as const

export function Layout() {
  const { ready, error, init } = useStore()
  const subject = useSubject()
  const date = useReviewDate()
  const waiting = useWaitingToSend()
  const [dialog, setDialog] = useState<'help' | 'report' | null>(null)
  useOutboxTicker() // moves shared packages through the simulated link (FR-SY-02)

  useEffect(() => {
    init()
  }, [init])

  // The Decode round asks for help through an event so it never imports the shell (FR-DEC-06).
  useEffect(() => {
    const open = () => setDialog('help')
    window.addEventListener(HELP_EVENT, open)
    return () => window.removeEventListener(HELP_EVENT, open)
  }, [])

  return (
    <div className="app">
      <aside className="banner" aria-label="Data notice">{S.banner}</aside>
      <header className="topbar">
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
          <button className="btn danger tb-help" onClick={() => setDialog('help')}><Icon name="help" /><span>{S.header.help}</span></button>
          <button className="btn tb-report" onClick={() => setDialog('report')}><Icon name="report" /><span>{S.header.report}</span></button>
          <NavLink to="/settings" className="icon-btn tb-settings" aria-label={S.nav.settings} title={S.nav.settings}><Icon name="settings" /></NavLink>
        </div>
      </header>

      <div className="body">
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n ? n.end : false} className="nav-item">
              <Icon name={n.key} />
              <span className="nav-full">{S.nav[n.key].full}</span>
              <span className="nav-short">{S.nav[n.key].short}</span>
            </NavLink>
          ))}
          <OfflineNote />
          {CONTENT_IS_DRAFT && <p className="draft-note">{S.draftContent}</p>}
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

      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'report' && <ReportDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
