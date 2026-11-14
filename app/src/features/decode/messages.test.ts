import { describe, expect, it } from 'vitest'
import { EARTH_STORIES } from '../../content/content'
import { storyFor } from './messages'

describe('prepared mission stories', () => {
  it('keeps the same day stable and advances only at the authored mission day', () => {
    const today = storyFor('sim:crew:fahim', 27)
    expect(today.current?.id).toBe('home-drawing-v1')
    expect(storyFor('sim:crew:fahim', 27)).toEqual(today)
    expect(today.next?.id).toBe('home-old-friend-v1')
    expect(storyFor('sim:crew:fahim', 28).current?.id).toBe(today.next?.id)
    expect(storyFor('sim:crew:fahim', 60).current?.id).toBe('home-old-friend-v1')
    expect(storyFor('sim:crew:fahim', 60).next).toBeNull()
  })
  it('does not make up a story before release, for another person, or from a broken teaser', () => {
    expect(storyFor('sim:crew:fahim', 26).current).toBeNull()
    expect(storyFor('live:crew:person', 27).current).toBeNull()
    expect(storyFor('sim:crew:fahim', 27, [EARTH_STORIES[0]]).next).toBeNull()
  })
  it('provides the same fiction to every demo crew without inventing family relationships', () => {
    expect(storyFor('sim:crew:fahim', 27).current?.sender_label).toBe('Your daughter')
    for (const id of ['c2', 'c3', 'c4']) {
      const story = storyFor(`sim:crew:${id}`, 27).current
      expect(story?.sender_label).toBe('Fahim’s daughter')
      expect(story?.transcript).toBe(EARTH_STORIES[0].transcript)
    }
  })
  it('keeps the recorded transcript exact', () => {
    expect(EARTH_STORIES[0].transcript).toBe('Hi Dad! I made you a drawing today. It is on the fridge, right beside your photo. I gave you the biggest star. Send me a little story when you can. I miss you.')
  })
})
