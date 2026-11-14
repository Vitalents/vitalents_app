// Before/after timeline of tonight (FR-SCH-01). The viewBox follows the real width so labels stay readable on phones.
import { useLayoutEffect, useRef, useState } from 'react'
import type { RestWindowInput, ScheduleItemInput } from '../../engine/schedule'
import { longestFreeBlock } from '../../engine/schedule'
import { fmtMinutes, hm, T } from '../followups/strings'

export interface Lane {
  label: string
  items: ScheduleItemInput[]
  movedIds?: Set<string>
}

const t = (iso: string) => Date.parse(iso)
const HOUR = 3_600_000

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(640)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function Timeline({ window: win, lanes, caption }: { window: RestWindowInput; lanes: Lane[]; caption: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  if (!win.start || !win.end) return null
  const all = lanes.flatMap((l) => l.items.flatMap((i) => [t(i.start) - ((i.prep_minutes ?? 0) + (i.travel_minutes ?? 0)) * 60_000, t(i.end)]))
  const from = Math.floor(Math.min(t(win.start), ...all) / HOUR) * HOUR - HOUR
  const to = Math.ceil(Math.max(t(win.end), ...all) / HOUR) * HOUR
  const phone = width < 560
  const labelW = phone ? 0 : 128
  const x = (ms: number) => labelW + ((ms - from) / (to - from)) * (width - labelW)
  const laneH = 44, gap = phone ? 44 : 30, top = phone ? 22 : 8
  const laneY = (i: number) => top + i * (laneH + gap)
  const height = laneY(lanes.length - 1) + laneH + 34
  const step = phone ? 2 : 1
  const ticks: number[] = []
  for (let h = from; h <= to; h += HOUR) if (((h - from) / HOUR) % step === 0) ticks.push(h)

  return (
    <figure className="act-timeline" style={{ margin: 0 }}>
      <div ref={ref}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption}>
          <defs>
            <pattern id="tl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="tl-hatch-line" />
            </pattern>
          </defs>
          {ticks.map((h) => (
            <g key={h}>
              <line className="tl-tick" x1={x(h)} x2={x(h)} y1={top - 4} y2={height - 26} />
              <text className="tl-tick-text" x={x(h)} y={height - 8} textAnchor="middle">{new Date(h).toISOString().slice(11, 13)}</text>
            </g>
          ))}
          {lanes.map((lane, i) => {
            const y = laneY(i)
            const free = longestFreeBlock(win, lane.items)
            return (
              <g key={lane.label}>
                <text className="tl-lane-label" x={phone ? 0 : 0} y={phone ? y - 8 : y + laneH / 2 + 5}>{lane.label}</text>
                <rect className="tl-window" x={x(t(win.start!))} y={y} width={x(t(win.end!)) - x(t(win.start!))} height={laneH} rx={6} />
                {free && (
                  <>
                    <rect className="tl-free" x={x(t(free.start))} y={y + laneH - 6} width={x(t(free.end)) - x(t(free.start))} height={6} rx={2} />
                    <text className="tl-free-text" x={(x(t(free.start)) + x(t(free.end))) / 2} y={y + laneH / 2 + 2} textAnchor="middle">
                      {fmtMinutes(Math.round((t(free.end) - t(free.start)) / 60_000))}
                    </text>
                  </>
                )}
                {lane.items.map((it) => {
                  const pre = ((it.prep_minutes ?? 0) + (it.travel_minutes ?? 0)) * 60_000
                  const moved = lane.movedIds?.has(it.item_id)
                  const cls = it.is_fixed ? 'tl-fixed' : moved ? 'tl-moved' : 'tl-movable'
                  const x0 = x(t(it.start)), x1 = x(t(it.end))
                  const full = it.label ?? ''
                  const room = (txt: string) => x1 - x0 > txt.length * 6.8 + 12
                  const short = !phone && room(full) ? full : full.split(' ')[0]
                  const fits = room(short)
                  return (
                    <g key={it.item_id}>
                      <title>{`${it.label ?? it.item_id}, ${hm(it.start)}–${hm(it.end)} ${T.utc}${it.is_fixed ? `, ${T.fixed}` : ''}`}</title>
                      {pre > 0 && <rect className="tl-prep" x={x(t(it.start) - pre)} y={y + 4} width={x0 - x(t(it.start) - pre)} height={laneH - 8} />}
                      <rect className={cls} x={x0} y={y + 4} width={Math.max(2, x1 - x0)} height={laneH - 8} rx={4} />
                      {fits && (
                        <text className={`tl-item-text ${cls === 'tl-movable' ? 'on-light' : 'on-dark'}`} x={(x0 + x1) / 2} y={y + laneH / 2 + 4} textAnchor="middle">{short}</text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption>
        <ul className="act-legend">
          <li><svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" rx="3" className="tl-fixed" /></svg>{T.legendFixed}</li>
          <li><svg width="14" height="14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="3" className="tl-movable" /></svg>{T.legendMovable}</li>
          {lanes.some((l) => l.items.some((i) => (i.prep_minutes ?? 0) + (i.travel_minutes ?? 0) > 0)) && (
            <li><svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" className="tl-prep" /></svg>{T.legendPrep}</li>
          )}
          <li><svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" rx="3" className="tl-window" /></svg>{T.restWindow}</li>
          <li><svg width="14" height="6" aria-hidden="true"><rect width="14" height="6" rx="2" className="tl-free" /></svg>{T.legendFree}</li>
          <li>{T.utc} hours</li>
        </ul>
      </figcaption>
    </figure>
  )
}
