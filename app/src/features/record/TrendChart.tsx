// Trend chart (UI-07): valid values as a line, the personal reference as a median line over a min–max band.
// A value with a data problem is a hatched diamond off the line; a day with no reading is a labelled gap, never 0.
import { useId } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatValue } from '../../content/format'
import { S } from '../../content/strings'
import { formatDay, missionDay } from '../../engine/mission'
import { trendDomain, trendTicks, type TrendPoint } from '../../engine/trends'
import type { PersonalReference } from '../../data/contract'
import { T } from './strings'

type Row = TrendPoint & { k: number }
interface DotProps { cx?: number; cy?: number; index?: number; value?: number | null }

export function TrendChart({ points, reference, unit, name }: { points: TrendPoint[]; reference: PersonalReference | null; unit: string | null; name: string }) {
  const uid = useId().replace(/:/g, '')
  const rows: Row[] = points.map((p, k) => ({ ...p, k }))
  const domain = trendDomain(points, reference)
  const ref = reference && reference.range_low != null && reference.range_high != null && reference.reference_value !== null ? reference : null
  const bandFrom = ref ? rows.find((r) => r.date >= ref.start_date)?.k : undefined
  const last = rows.length - 1
  const gaps = rows.filter((r) => r.kind === 'no_reading')
  const tick = (k: number) => (rows[k] ? String(missionDay(rows[k].date)) : '')
  const every = Math.max(0, Math.ceil(rows.length / 8) - 1)

  return (
    <div className="tr-chart">
      <ResponsiveContainer width="100%" height={232}>
        <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} accessibilityLayer title={T.chartLabel(name)}>
          <defs>
            <pattern id={`hatch-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="var(--card)" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--data-hatch)" strokeWidth="1.6" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.7} />
          <XAxis
            dataKey="k" type="category" interval={every} tickFormatter={tick} tickLine={false}
            axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }}
          />
          <YAxis
            domain={domain ?? ['auto', 'auto']} ticks={domain ? trendTicks(domain) : undefined} width={36} tickLine={false} axisLine={false} allowDecimals={unit !== 'count' && unit !== 'bpm'}
            tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(v: number) => formatNumber(v)}
          />
          {ref && bandFrom !== undefined && (
            <ReferenceArea x1={bandFrom} x2={last} y1={ref.range_low!} y2={ref.range_high!} fill="var(--tint)" fillOpacity={0.75} stroke="none" ifOverflow="extendDomain" />
          )}
          {ref && bandFrom !== undefined && (
            <ReferenceLine
              segment={[{ x: bandFrom, y: ref.reference_value! }, { x: last, y: ref.reference_value! }]}
              stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="6 4" ifOverflow="extendDomain"
            />
          )}
          {gaps.map((g) => (
            <ReferenceLine key={`gap-${g.k}`} x={g.k} stroke="var(--data-hatch)" strokeDasharray="2 4" strokeOpacity={0.8} label={<GapLabel />} />
          ))}
          <Tooltip content={<TrendTooltip unit={unit} />} cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }} isAnimationActive={false} />
          <Line
            dataKey="valid" name={T.legend.valid} connectNulls={false} stroke="var(--deep)" strokeWidth={2} isAnimationActive={false}
            dot={(p: DotProps) => <ValidDot key={`v-${p.index}`} {...p} />}
            activeDot={(p: DotProps) => <ValidDot key={`va-${p.index}`} {...p} active />}
          />
          <Line
            dataKey="problem" name={T.legend.problem} stroke="none" isAnimationActive={false} legendType="none"
            dot={(p: DotProps) => <ProblemDot key={`p-${p.index}`} {...p} fill={`url(#hatch-${uid})`} />}
            activeDot={(p: DotProps) => <ProblemDot key={`pa-${p.index}`} {...p} fill={`url(#hatch-${uid})`} active />}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="tr-axis-note muted" aria-hidden="true">{T.axisDay}</p>
    </div>
  )
}

function ValidDot({ cx, cy, value, active }: DotProps & { active?: boolean }) {
  if (cx == null || cy == null || value == null) return <g />
  return <circle cx={cx} cy={cy} r={active ? 6 : 4.5} fill="var(--deep)" stroke="var(--card)" strokeWidth={2} />
}

function ProblemDot({ cx, cy, value, fill, active }: DotProps & { fill: string; active?: boolean }) {
  if (cx == null || cy == null || value == null) return <g />
  const s = active ? 8 : 6.5
  return (
    <g>
      <path d={`M${cx} ${cy - s - 2}L${cx + s + 2} ${cy}L${cx} ${cy + s + 2}L${cx - s - 2} ${cy}Z`} fill="var(--card)" />
      <path d={`M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`} fill={fill} stroke="var(--data-hatch)" strokeWidth={1.5} />
    </g>
  )
}

/** Vertical "No reading" label at the foot of a gap, so the gap is never read as a value. */
function GapLabel({ viewBox }: { viewBox?: { x: number; y: number; height: number } }) {
  if (!viewBox) return null
  const x = viewBox.x
  const y = viewBox.y + viewBox.height - 6
  return (
    <text x={x} y={y} transform={`rotate(-90 ${x} ${y})`} dy={-5} className="tr-gap-label" fill="var(--muted)" fontSize={11} fontWeight={600}>
      {T.noReading}
    </text>
  )
}

function TrendTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Row }[]; unit: string | null }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  const c = p.comparison
  return (
    <div className="tr-tip" role="status">
      <p className="tr-tip-date">{formatDay(p.date)}</p>
      <p className="tr-tip-value num">{p.value === null ? T.noReading : formatValue(p.value, unit)}</p>
      <p className="tr-tip-status">{S.infoPrefix}: {S.info[p.status]}</p>
      {c && c.absolute_change !== null && (
        <p className="tr-tip-ref">{T.changeFromRef}: {c.absolute_change > 0 ? '+' : ''}{formatNumber(c.absolute_change)} · {S.position[c.position]}</p>
      )}
      {p.inReference && <p className="tr-tip-ref">{T.table.usedInRef}</p>}
    </div>
  )
}
