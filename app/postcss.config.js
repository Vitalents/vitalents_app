// Dark mode follows the system by default; the header switch sets <html data-theme="light|dark"> to override it.
// postcss-dark-theme-class rewrites every `@media (prefers-color-scheme: dark)` block to honour that attribute.
import darkThemeClass from 'postcss-dark-theme-class'

export default {
  plugins: [darkThemeClass({ darkSelector: '[data-theme="dark"]', lightSelector: '[data-theme="light"]' })],
}
