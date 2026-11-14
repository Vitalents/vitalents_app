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
      {name === 'settings' && (<><circle cx="12" cy="12" r="3" {...P} /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" {...P} /></>)}
      {name === 'help' && (<><circle cx="12" cy="12" r="9" {...P} /><path d="M12 7v6M12 16.5v.5" {...P} /></>)}
      {name === 'report' && (<><path d="M5 19h4l10-10-4-4L5 15z" {...P} /><path d="M13 7l4 4" {...P} /></>)}
    </svg>
  )
}
