// FR-MAP-05: the plan mark. A calendar symbol plus text, plain ink on no fill, so it never reads
// as a follow-up pill (circles, triangles, tick) or a data tag (hatched square). Three-state rule.
import type { DueState } from '../../engine/due'
import { M } from './strings'
import './map.css'

/** Calendar glyph in a 12 × 12 box. Use inside an <svg> or via DueMark. */
export function DueGlyph({ state }: { state: DueState }) {
  return (
    <>
      <rect x="1.25" y="2.25" width="9.5" height="8.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 4.9h9M4 1v2.4M8 1v2.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {state === 'done' && <path d="M3.7 7.6 5.3 9.1 8.4 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      {state === 'not_due' && <path d="M4.2 7.7h3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
      {state === 'due' && <circle cx="6" cy="7.7" r="1.3" fill="currentColor" />}
    </>
  )
}

export function DueMark({ state, compact = false }: { state: DueState | null; compact?: boolean }) {
  if (state === null) return null
  return (
    <span className={`due-mark due-${state}`} title={`${M.duePrefix}: ${M.due[state]}`}>
      <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false">
        <DueGlyph state={state} />
      </svg>
      {compact ? <span className="sr-only">{M.due[state]}</span> : M.due[state]}
    </span>
  )
}
