import { useEffect, useMemo, useState } from 'react'
import { filterData } from '../../store/permissions'
import { useRole } from '../../store/role'
import { useStore, type Data } from '../../store/store'

/** What the current demo role may see, filtered and redacted in the data layer. */
export function useVisibleData(subjectId: string): Data {
  const role = useRole((s) => s.role)
  const data = useStore((s) => s.data)
  return useMemo(() => filterData(role, data, { subjectId }), [role, data, subjectId])
}

/** Wall-clock time, refreshed every `ms`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
