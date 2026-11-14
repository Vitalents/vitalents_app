// Vitalents brand marks, drawn from the exact vector paths in the team brand files (brandPaths.ts).
// Colours come only from tokens: mark = --deep, wordmark = --ink, blob = --tint. Never redraw or recolour.
import { BLOB_PATH, EMBLEM_MARK_PATHS, EMBLEM_VIEWBOX, LOCKUP_VIEWBOX, MARK_PATHS, MARK_VIEWBOX, WORD_PATHS } from './brandPaths'

/** Full lockup: figure mark + lowercase "vitalents" wordmark. */
export function Logo({ height = 26, title = 'Vitalents' }: { height?: number; title?: string }) {
  return (
    <svg className="logo" viewBox={LOCKUP_VIEWBOX} height={height} role="img" aria-label={title}>
      <g fill="var(--deep)" fillRule="evenodd">{MARK_PATHS.map((d) => <path key={d.slice(0, 24)} d={d} />)}</g>
      <g fill="var(--ink)">{WORD_PATHS.map((d) => <path key={d.slice(0, 24)} d={d} />)}</g>
    </svg>
  )
}

/** The figure mark alone (phones, compact places). Decorative unless a title is given. */
export function Mark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg className="logo-mark" viewBox={MARK_VIEWBOX} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="var(--deep)" fillRule="evenodd">{MARK_PATHS.map((d) => <path key={d.slice(0, 24)} d={d} />)}</g>
    </svg>
  )
}

/** Mark on the soft brand blob, for identity moments: loading, empty states, onboarding. Decorative. */
export function Emblem({ size = 96 }: { size?: number }) {
  return (
    <svg className="emblem" viewBox={EMBLEM_VIEWBOX} height={size} aria-hidden="true">
      <path d={BLOB_PATH} fill="var(--tint)" />
      <g fill="var(--deep)" fillRule="evenodd">{EMBLEM_MARK_PATHS.map((d) => <path key={d.slice(0, 24)} d={d} />)}</g>
    </svg>
  )
}
