// Messages from Earth, shown after every completed round regardless of the result.
// TODO(review: Amr provides content/messages.json; these placeholders contain no health content.)
export const EARTH_MESSAGES = [
  'Ground team: the photos from the window last night made our whole shift. Thank you for sending them.',
  "From home: the kids drew the station on the fridge again. You're in the top corner, waving.",
  'Mission control: the long-range antenna test finished on schedule. Nice work on yesterday’s setup.',
  'From your training class: we watched the docking replay together. Same jokes as always.',
  'Ground team: it rained here all morning. We saved you the view from the roof for when you’re back.',
  'From home: your plants on the balcony are doing better than the ones up there, apparently.',
]

export function messageFor(dayIndex: number): string {
  return EARTH_MESSAGES[((dayIndex % EARTH_MESSAGES.length) + EARTH_MESSAGES.length) % EARTH_MESSAGES.length]
}
