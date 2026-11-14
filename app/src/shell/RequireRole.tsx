import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useRole, type Role } from '../store/role'
import { S } from '../content/strings'

/** Direct URLs are subject to the same role boundary as navigation. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useRole((s) => s.role)
  if (roles.includes(role)) return children
  const home = role === 'medical' ? '/medical' : role === 'planner' ? '/planner' : '/'
  return (
    <section className="page stack">
      <h1>{S.access.title}</h1>
      <p>{S.access.unavailable}</p>
      <Link className="btn primary" to={home}>{S.access.openRole}</Link>
      <Link to="/settings">{S.access.chooseRole}</Link>
    </section>
  )
}
