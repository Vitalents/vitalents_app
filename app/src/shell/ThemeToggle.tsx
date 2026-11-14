// Theme switch (FR-PE-05): light (default) → dark → device setting → light. Remembered on this device; the label says what is on now.
import { nextTheme, usePreferences, type Theme } from '../store/preferences'

const LABEL: Record<Theme, string> = { system: 'Theme: follows your device', light: 'Theme: light', dark: 'Theme: dark' }

export function ThemeToggle() {
  const theme = usePreferences((s) => s.theme)
  const setPref = usePreferences((s) => s.set)
  const next = nextTheme(theme)
  return (
    <button
      type="button"
      className="icon-btn tb-theme"
      onClick={() => setPref('theme', next)}
      aria-label={`${LABEL[theme]}. Switch to ${next === 'system' ? 'device setting' : next}.`}
      title={LABEL[theme]}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {theme === 'light' && (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)}
        {theme === 'dark' && <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
        {theme === 'system' && (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /><path d="M12 7v6" /></>)}
      </svg>
    </button>
  )
}
