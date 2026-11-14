// The round screen: key at the top, one symbol, keypad 1-9. No score, no streaks, no speed-up (FR-DEC-03/04).
import { SYMBOL_IDS, type DecodeKey, type SymbolId } from '../../engine/decodeSession'
import { Glyph } from './symbols'
import { HELP_EVENT, useRound, type RoundEnd } from './useRound'
import { S } from './strings'

export function DecodeRound(props: {
  keyMap: DecodeKey
  sequence: SymbolId[]
  durationMs: number
  label: string
  onEnd: (end: RoundEnd) => void
}) {
  const { view, respond, quit } = useRound(props)
  const requestHelp = () => {
    window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: { from: 'decode' } }))
  }
  return (
    <section className="dc-round" aria-label={props.label}>
      <div className="dc-round-top">
        <span className="dc-round-label">{props.label}</span>
        <div className="dc-actions">
          <button type="button" className="dc-link" onClick={quit}>{S.quit}</button>
          <button type="button" className="dc-help" onClick={requestHelp}>{S.requestHelp}</button>
        </div>
      </div>
      <div className="dc-progress" role="progressbar" aria-label={S.timeElapsed} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.progress * 100)}>
        <span style={{ width: `${view.progress * 100}%` }} />
      </div>
      <ol className="dc-key" aria-label={S.keyLabel}>
        {SYMBOL_IDS.map((id) => (
          <li key={id}>
            <Glyph id={id} size={30} />
            <span className="dc-key-digit">{props.keyMap[id]}</span>
          </li>
        ))}
      </ol>
      <div className="dc-stage">
        {/* No motion inside the measurement window (DESIGN.md): an instant, identical acknowledgement after every answer */}
        <div className={`dc-current${view.waiting ? ' dc-ack' : ''}`}>
          {view.symbol && !view.waiting && <Glyph id={view.symbol} size={112} label={S.currentSymbol} />}
        </div>
      </div>
      <div className="dc-keypad" role="group" aria-label={S.keypadLabel}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            type="button"
            className="dc-digit"
            aria-label={`${S.digit} ${d}`}
            disabled={view.ended}
            onKeyDown={(e) => {
              // Ignoring repeat in the global digit listener is not enough: native buttons
              // generate repeated Enter clicks unless their keyboard default is cancelled.
              if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault()
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 || e.isPrimary === false) return
              e.preventDefault()
              respond(d, e.pointerType === 'mouse' ? 'other' : 'touch')
            }}
            onClick={(e) => {
              // Enter/Space and assistive activation click with detail 0. Pointer clicks were
              // already timed on pointerdown; accepting those again would create duplicates.
              if (e.detail === 0) respond(d, 'keyboard')
            }}
          >
            {d}
          </button>
        ))}
      </div>
    </section>
  )
}
