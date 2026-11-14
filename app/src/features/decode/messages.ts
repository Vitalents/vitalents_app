import { EARTH_STORIES, type EarthStory } from '../../content/content'

export interface StorySelection {
  current: EarthStory | null
  next: EarthStory | null
}

/** Mission date, not a score, attempt count, or wall-clock delivery event, selects the story. */
export function storyFor(subjectId: string, missionDay: number, stories: EarthStory[] = EARTH_STORIES): StorySelection {
  const available = stories.filter((s) => s.subject_scopes.includes(subjectId) && s.locale === 'en' && s.fictional)
    .map((s) => s.actor_subject_id === subjectId ? s : { ...s, sender_label: s.observer_sender_label })
  const current = available.filter((s) => s.mission_day <= missionDay)
    .sort((a, b) => a.mission_day - b.mission_day).at(-1) ?? null
  const next = current?.next_episode_id
    ? available.find((s) => s.id === current.next_episode_id && s.mission_day === missionDay + 1 && !!s.transcript.trim()) ?? null
    : null
  return { current, next }
}
