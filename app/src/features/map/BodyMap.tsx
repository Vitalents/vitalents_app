// SVG body figure with seven tappable regions (FR-MAP-01/02), plus the plan mark per region (FR-MAP-05). A simple line figure, not anatomical:
// fill shows the follow-up status, a hatch overlay shows a data problem, a symbol badge repeats the
// follow-up status so colour never carries meaning alone, and every region has an accessible name.
import { useNavigate } from 'react-router-dom'
import { S } from '../../content/strings'
import type { DomainView } from '../../engine/view'
import type { DueState } from '../../engine/due'
import { FollowGlyph } from '../../shell/StatusChips'
import { DueGlyph } from './DueMark'
import { M } from './strings'

type Shape = {
  /** Visible parts of the region. */
  el: React.ReactNode
  /** Larger invisible tap area, so small regions still give a 44 px target. */
  hit?: React.ReactNode
  /** Where the follow-up symbol badge sits. */
  badge: [number, number]
  /** Where the plan mark (FR-MAP-05) sits, clear of the follow-up badge. */
  due: [number, number]
}

const SHAPES: Record<string, Shape> = {
  radiation: {
    el: <ellipse cx="130" cy="214" rx="112" ry="194" className="ring" />,
    hit: <ellipse cx="130" cy="214" rx="112" ry="194" className="ring-hit" />,
    badge: [215, 340],
    due: [238, 306],
  },
  cognition: {
    el: <circle cx="130" cy="64" r="27" />,
    badge: [130, 64],
    due: [167, 44],
  },
  sleep: {
    el: <path transform="translate(232 40) scale(0.85)" vectorEffect="non-scaling-stroke" d="M2 -20a26 26 0 1 0 20 42 22 22 0 1 1 -20 -42z" />,
    hit: <circle cx="230" cy="42" r="26" className="hit" />,
    badge: [219, 46],
    due: [252, 22],
  },
  heart: {
    el: <path d="M110 99h40c15 0 24 8 25 22l-7 51H92l-7-51c1-14 10-22 25-22z" />,
    badge: [130, 134],
    due: [152, 158],
  },
  nutrition: {
    el: <path d="M92 176h76l-2 46c-1 9-7 14-15 14h-42c-8 0-14-5-15-14z" />,
    badge: [130, 205],
    due: [152, 224],
  },
  symptoms: {
    el: (
      <>
        <path d="M79 106c-8 2-12 9-13 18l-8 86c-1 12 3 21 11 21s11-8 11-17l5-62v-38c0-5-2-8-6-8z" />
        <path d="M181 106c8 2 12 9 13 18l8 86c1 12-3 21-11 21s-11-8-11-17l-5-62v-38c0-5 2-8 6-8z" />
      </>
    ),
    badge: [70, 176],
    due: [190, 176],
  },
  movement: {
    el: (
      <>
        <path d="M101 240h26l-3 128c0 9-4 14-12 14H98c-6 0-8-6-4-10l5-5z" />
        <path d="M159 240h-26l3 128c0 9 4 14 12 14h14c6 0 8-6 4-10l-5-5z" />
      </>
    ),
    badge: [130, 306],
    due: [150, 352],
  },
}

/** Order matters: later regions paint on top and receive the tap first. */
const ORDER = ['radiation', 'movement', 'nutrition', 'heart', 'symptoms', 'cognition', 'sleep']

export function BodyMap({ views, due }: { views: DomainView[]; due?: Map<string, DueState | null> }) {
  const navigate = useNavigate()
  return (
    <svg className="bodymap" viewBox="0 0 270 424" role="group" aria-label={S.map.figureLabel}>
      <defs>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="hatch-line" />
        </pattern>
        <path id="ring-label-path" d="M30 214a100 182 0 0 1 200 0" />
      </defs>

      {/* Neck: part of the drawing, not a region. */}
      <path d="M122 90v10M138 90v10" className="figure-line" aria-hidden="true" />

      {ORDER.map((id) => {
        const v = views.find((x) => x.content.id === id)
        const shape = SHAPES[id]
        if (!v || !shape) return null
        const problem = v.dataStatus !== null && v.dataStatus !== 'valid'
        const plan = due?.get(id) ?? null
        const label = `${v.content.name}. ${S.followPrefix}: ${S.follow[v.followStatus]}. ${v.dataStatus === null ? M.sampleData : `${S.infoPrefix}: ${S.info[v.dataStatus]}`}${plan ? `. ${M.duePrefix}: ${M.due[plan]}` : ''}`
        const go = () => navigate(`/domain/${id}`)
        const [bx, by] = shape.badge
        const [dx, dy] = shape.due
        return (
          <g
            key={id}
            className={`region region-${id} follow-${v.followStatus} ${v.dataStatus === null ? 'sample' : ''}`}
            role="link"
            tabIndex={0}
            aria-label={label}
            onClick={go}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go())}
          >
            <title>{label}</title>
            {shape.hit}
            <g className="shape">{shape.el}</g>
            {problem && <g className="shape hatch" aria-hidden="true">{shape.el}</g>}
            <g className="badge" transform={`translate(${bx - 9} ${by - 9})`} aria-hidden="true">
              <circle cx="9" cy="9" r="9" className="badge-bg" />
              <g transform="translate(3 3)" className="badge-glyph"><FollowGlyph status={v.followStatus} /></g>
            </g>
            {plan && (
              <g className={`due-badge due-${plan}`} transform={`translate(${dx - 9} ${dy - 9})`} aria-hidden="true">
                <rect width="18" height="18" rx="4" className="due-badge-bg" />
                <g transform="translate(3 3)"><DueGlyph state={plan} /></g>
              </g>
            )}
          </g>
        )
      })}

      {/* Plain-word labels for the two regions that are symbols rather than body parts. */}
      <text className="figure-label" x="230" y="80" textAnchor="middle" aria-hidden="true">{S.map.figureSleep}</text>
      <text className="figure-label" aria-hidden="true">
        <textPath href="#ring-label-path" startOffset="14%">{S.map.figureRadiation}</textPath>
      </text>
    </svg>
  )
}
