// SVG body figure with seven tappable regions. Fill shows the follow-up status, a hatch overlay
// shows a data problem, and every region carries a text label for screen readers (FR-MAP-01/02).
import { useNavigate } from 'react-router-dom'
import { S } from '../../content/strings'
import type { DomainView } from '../../engine/view'

const SHAPES: Record<string, { el: React.ReactNode; label: [number, number] }> = {
  radiation: {
    el: <ellipse cx="130" cy="200" rx="116" ry="186" className="ring" />,
    label: [218, 352],
  },
  cognition: { el: <circle cx="130" cy="58" r="30" />, label: [130, 62] },
  sleep: {
    el: <path d="M196 30a26 26 0 1 0 20 42 22 22 0 1 1 -20 -42z" />,
    label: [198, 58],
  },
  heart: { el: <rect x="96" y="96" width="68" height="64" rx="16" />, label: [130, 132] },
  nutrition: { el: <rect x="100" y="164" width="60" height="54" rx="14" />, label: [130, 195] },
  symptoms: {
    el: (
      <>
        <path d="M90 102c-14 4-22 14-24 30l-8 86c-1 8 4 12 10 12s10-4 11-11l9-74z" />
        <path d="M170 102c14 4 22 14 24 30l8 86c1 8 -4 12 -10 12s-10 -4 -11 -11l-9 -74z" />
      </>
    ),
    label: [66, 176],
  },
  movement: {
    el: (
      <>
        <path d="M102 222h24l-2 134c0 8-5 12-11 12s-11-4-11-12z" />
        <path d="M134 222h24l0 134c0 8-5 12-11 12s-11-4-11-12z" />
      </>
    ),
    label: [130, 300],
  },
}

export function BodyMap({ views }: { views: DomainView[] }) {
  const navigate = useNavigate()
  const order = ['radiation', 'symptoms', 'movement', 'nutrition', 'heart', 'sleep', 'cognition']
  return (
    <svg className="bodymap" viewBox="0 0 260 400" role="group" aria-label="Body map">
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="hatch-line" />
        </pattern>
      </defs>
      {order.map((id) => {
        const v = views.find((x) => x.content.id === id)
        const shape = SHAPES[id]
        if (!v || !shape) return null
        const problem = v.dataStatus !== null && v.dataStatus !== 'valid'
        const label = `${v.content.name}. ${S.followPrefix}: ${S.follow[v.followStatus]}. ${v.dataStatus === null ? S.sampleCard : `${S.infoPrefix}: ${S.info[v.dataStatus]}`}`
        const go = () => navigate(`/domain/${id}`)
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
            <g className="shape">{shape.el}</g>
            {problem && <g className="shape hatch" aria-hidden="true">{shape.el}</g>}
            <text x={shape.label[0]} y={shape.label[1]} className="region-symbol" aria-hidden="true">
              {S.followSymbol[v.followStatus]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
