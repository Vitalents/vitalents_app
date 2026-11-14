// Small line icons for navigation. Decorative: every icon sits next to a text label.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      {name === 'map' && (<><circle cx="12" cy="5" r="2.5" {...P} /><path d="M12 8v7M8 10h8M10 21l2-6 2 6" {...P} /></>)}
      {name === 'check' && (<><rect x="4" y="4" width="16" height="16" rx="3" {...P} /><path d="M8 9h3M8 13h8M8 17h5M14 8.5l1.5 1.5L18 7" {...P} /></>)}
      {name === 'review' && (<><path d="M5 4h10l4 4v12H5z" {...P} /><path d="M8 11h8M8 15h6" {...P} /></>)}
      {name === 'record' && (<path d="M4 18l5-6 4 3 7-9M4 21h16" {...P} />)}
      {name === 'plan' && (<><rect x="4" y="5" width="16" height="15" rx="2" {...P} /><path d="M8 3v4M16 3v4M4 10h16M8 14h3" {...P} /></>)}
      {name === 'share' && (<><path d="M12 4v11M8 8l4-4 4 4" {...P} /><path d="M5 13v6h14v-6" {...P} /></>)}
      {name === 'settings' && (<><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" {...P} /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...P} /></>)}
      {name === 'ask' && (<><path d="M4 5h16v11H9l-5 4z" {...P} /><path d="M10 9.5a2 2 0 1 1 2.8 1.8c-.5.2-.8.7-.8 1.2M12 14.5v.01" {...P} /></>)}
      {name === 'help' && (<><circle cx="12" cy="12" r="9" {...P} /><path d="M12 7v6M12 16.5v.5" {...P} /></>)}
      {name === 'report' && (<><path d="M5 19h4l10-10-4-4L5 15z" {...P} /><path d="M13 7l4 4" {...P} /></>)}
    </svg>
  )
}
