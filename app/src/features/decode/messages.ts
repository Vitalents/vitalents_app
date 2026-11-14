// Messages from Earth come from content/messages.json.
import { EARTH_MESSAGES } from '../../content/content'
export { EARTH_MESSAGES }

export function messageFor(dayIndex: number): string {
  return EARTH_MESSAGES[((dayIndex % EARTH_MESSAGES.length) + EARTH_MESSAGES.length) % EARTH_MESSAGES.length]
}
