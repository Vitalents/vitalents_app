// FR-RT-01 evaluation chart: each held-out day's recorded Decode count, the model's expected range (80 %)
// and the personal-median baseline. One y-axis (correct answers). A table view sits beside it in ResearchPage.
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../../content/format'
import { formatDay, missionDay } from '../../engine/mission'
import { R } from './strings'
import type { HeldOutDay } from './types'

type Row = HeldOutDay & { day: number; range: [number, number]; expected: number; median: number }
interface DotProps { cx?: number; cy?: number; index?: number; value?: number | null }

export function HeldOutChart({ days, label }: { days: HeldOutDay[]; label: string }) {
  const rows: Row[] = days.map((d) => ({ ...d, day: missionDay(d.date), range: [d.model.low, d.model.high], expected: d.model.expected, median: d.baseline.expected }))
  const vals = rows.flatMap((r) => [r.actual, r.model.low, r.model.high, r.median])
  const lo = Math.floor(Math.min(...vals) - 1)
  const hi = Math.ceil(Math.max(...vals) + 1)
  const step = hi - lo > 12 ? 4 : 2
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  return (
    <div className="rs-chart">
      <ResponsiveContainer width="100%" height={248}>
        <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%" accessibilityLayer title={label}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.7} />
          <XAxis dataKey="day" type="category" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }} interval={rows.length > 10 ? 1 : 0} />
          <YAxis domain={[lo, hi]} ticks={ticks} width={32} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--tint-soft)' }} isAnimationActive={false} />
          <Bar dataKey="range" name={R.legend.range} fill="var(--tint)" stroke="var(--deep)" strokeWidth={1} radius={4} maxBarSize={22} isAnimationActive={false} />
          <Line dataKey="median" name={R.legend.baseline} type="linear" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
          <Line
            dataKey="actual" name={R.legend.actual} stroke="none" isAnimationActive={false}
            dot={(p: DotProps) => <ActualDot key={`a-${p.index}`} {...p} />}
            activeDot={(p: DotProps) => <ActualDot key={`aa-${p.index}`} {...p} active />}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="rs-axis-note muted" aria-hidden="true">{R.axisDay}</p>
    </div>
  )
}

function ActualDot({ cx, cy, value, active }: DotProps & { active?: boolean }) {
  if (cx == null || cy == null || value == null) return <g />
  return <circle cx={cx} cy={cy} r={active ? 6 : 4.5} fill="var(--ink)" stroke="var(--card)" strokeWidth={2} />
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const r = active ? payload?.[0]?.payload : undefined
  if (!r) return null
  return (
    <div className="rs-tip" role="status">
      <p className="rs-tip-date">{formatDay(r.date)}</p>
      <p><span className="muted">{R.tip.actual}</span> <b className="num">{formatNumber(r.actual, 0)}</b></p>
      <p><span className="muted">{R.tip.expected}</span> <span className="num">{formatNumber(r.model.expected)} ({formatNumber(r.model.low)}–{formatNumber(r.model.high)})</span></p>
      <p><span className="muted">{R.tip.baseline}</span> <span className="num">{formatNumber(r.median)}</span></p>
      <p className="muted">{R.tip.inputs(formatNumber(r.sleep_h), r.alertness)}</p>
    </div>
  )
}
