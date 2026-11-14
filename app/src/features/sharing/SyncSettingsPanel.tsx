// Simulated link settings (FR-SY-02). Intended for the Settings screen.
import './share.css'
import { useId } from 'react'
import { roundTripMs, type LinkSettings } from '../../sync/engine'
import { useLink } from '../../sync/link'
import { T } from './strings'

const DELAYS: LinkSettings['oneWayDelayMin'][] = [0, 4, 12, 24]

export function SyncSettingsPanel() {
  const { link, setLink } = useLink()
  const id = useId()
  const rtMin = link.oneWayDelayMin * 2
  const rtSec = link.accelerated ? Math.round(roundTripMs(link) / 1000) : null

  return (
    <section className="card sh-settings" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>{T.link.title}</h2>
      <p className="muted small">{T.link.lede}</p>

      <div className="sh-setting">
        <span id={`${id}-up`} className="sh-setting-label">{T.link.up}</span>
        <button
          type="button"
          role="switch"
          aria-checked={link.linkUp}
          aria-labelledby={`${id}-up`}
          className={`sh-switch${link.linkUp ? ' is-on' : ''}`}
          onClick={() => setLink({ linkUp: !link.linkUp })}
        >
          <span className="sh-switch-knob" aria-hidden="true" />
          <span className="sh-switch-text">{link.linkUp ? T.link.upOn : T.link.upOff}</span>
        </button>
      </div>

      <fieldset className="sh-setting sh-delays">
        <legend className="sh-setting-label">{T.link.delay}</legend>
        <div className="seg">
          {DELAYS.map((d) => (
            <label key={d} className={link.oneWayDelayMin === d ? 'on' : undefined}>
              <input
                type="radio"
                name={`${id}-delay`}
                value={d}
                checked={link.oneWayDelayMin === d}
                onChange={() => setLink({ oneWayDelayMin: d })}
              />
              {T.link.delayMin(d)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="sh-check">
        <input type="checkbox" checked={link.accelerated} onChange={(e) => setLink({ accelerated: e.target.checked })} />
        <span>{T.link.accelerated}</span>
      </label>

      <p className="sh-rt small">{T.link.roundTrip(rtMin, rtSec)}</p>
    </section>
  )
}
