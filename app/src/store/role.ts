// Demo role switcher state (FR-SH-02). Visibility itself is enforced in permissions.ts, not here.
import { create } from 'zustand'

export type Role = 'astronaut' | 'medical' | 'planner'
export const ROLES: Role[] = ['astronaut', 'medical', 'planner']

const KEY = 'vitalents.role'

function initial(): Role {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'astronaut' || v === 'medical' || v === 'planner') return v
  } catch {
    /* storage unavailable: default role */
  }
  return 'astronaut'
}

export const useRole = create<{ role: Role; setRole: (r: Role) => void }>((set) => ({
  role: initial(),
  setRole: (role) => {
    try {
      localStorage.setItem(KEY, role)
    } catch {
      /* ignore */
    }
    set({ role })
  },
}))
