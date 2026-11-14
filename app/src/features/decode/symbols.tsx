// The nine fixed Decode symbols (task version decode-1.0). Simple geometric glyphs: never letters or digits.
// Changing any glyph means a new task version.
import type { ReactElement } from 'react'
import type { SymbolId } from '../../engine/decodeSession'

const PATHS: Record<SymbolId, ReactElement> = {
  g1: <circle cx="24" cy="24" r="14" />,
  g2: <path d="M24 9 L39 37 L9 37 Z" />,
  g3: <rect x="11" y="11" width="26" height="26" rx="2" />,
  g4: <path d="M24 7 L41 24 L24 41 L7 24 Z" />,
  g5: <path d="M24 9 V39 M9 24 H39" />,
  g6: (
    <>
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="3.5" className="fill" />
    </>
  ),
  g7: <path d="M30 9 A15 15 0 1 0 30 39 A11 11 0 1 1 30 9 Z" />,
  g8: <path d="M10 33 L24 15 L38 33" />,
  g9: <path d="M16 10 H32 L40 24 L32 38 H16 L8 24 Z" />,
}

export function Glyph({ id, size = 48, label }: { id: SymbolId; size?: number; label?: string }) {
  return (
    <svg
      className="glyph"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[id]}
    </svg>
  )
}
