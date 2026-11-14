// "Demo role" switcher (FR-SH-02). Changing the role changes what filterData returns.
import '../sharing/share.css'
import { ROLES, useRole } from '../../store/role'
import { T } from '../sharing/strings'

export function RoleSwitcher() {
  const { role, setRole } = useRole()
  return (
    <fieldset className="field sh-role">
      <legend className="kicker">{T.roleLabel}</legend>
      <div className="seg">
        {ROLES.map((r) => (
          <label key={r} className={role === r ? 'on' : undefined}>
            <input type="radio" name="demo-role" value={r} checked={role === r} onChange={() => setRole(r)} />
            {T.roles[r]}
          </label>
        ))}
      </div>
      <p className="muted small">{T.roleHint}</p>
    </fieldset>
  )
}
