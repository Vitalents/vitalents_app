// Mission calendar for the simulation (contract D-2: day 27 = 2026-11-14).
// TODO(question: contract needs the mission day-1 date on subject_profile or simulator_scenario)
export const MISSION_ANCHOR = { date: '2026-11-14', day: 27 }

const DAY = 86_400_000

/** Accepts a date ("2026-11-14") or a UTC timestamp ("2026-11-14T07:28:00Z"); only the date part counts. */
export function missionDay(date: string): number {
  return MISSION_ANCHOR.day + Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${MISSION_ANCHOR.date}T00:00:00Z`)) / DAY)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Nov 2026" */
export function formatDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "13 Nov (day 26)" */
export function formatDay(date: string): string {
  const [, m, d] = date.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} (day ${missionDay(date)})`
}

/** "07:28 UTC" from an ISO timestamp */
export function formatTime(iso: string): string {
  return `${iso.slice(11, 16)} UTC`
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
}
