// Dev entry for Increment 6 (proof-dev.html): the Proof screen outside the shell. Not part of the build.
// "#file" fetches the real /data/proof.json. "#layout" renders a SYNTHETIC sample to check the generated layout:
// its numbers are made up for layout only, are labelled as such on screen, and never ship.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '../../styles/tokens.css'
import '../../styles/app.css'
import { ProofPage } from './ProofPage'
import { LAYOUT_SAMPLE } from './layoutSample'

const VIEWS = [
  ['file', 'proof.json (real)'],
  ['layout', 'Layout sample (synthetic)'],
  ['none', 'No file'],
] as const
type View = (typeof VIEWS)[number][0]

function Dev() {
  const read = () => (location.hash.slice(1) || 'file') as View
  const [view, setView] = useState<View>(read)
  useEffect(() => {
    const on = () => setView(read())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return (
    <div className="app">
      <div className="banner">Simulated data · not a medical device</div>
      <nav aria-label="Dev views" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        {VIEWS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="btn" aria-current={view === k ? 'page' : undefined} style={view === k ? { background: 'var(--tint)' } : undefined}>{label}</a>
        ))}
      </nav>
      {view === 'layout' && (
        <p role="note" style={{ margin: 0, padding: '8px 16px', background: 'var(--ink)', color: 'var(--paper)', fontSize: '0.8rem' }}>
          Synthetic layout sample: these numbers are made up to check the layout. They are not results.
        </p>
      )}
      <main style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
        {view === 'file' && <ProofPage key="file" />}
        {view === 'layout' && <ProofPage key="layout" proof={LAYOUT_SAMPLE} />}
        {view === 'none' && <ProofPage key="none" proof={null} />}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Dev /></StrictMode>)
