import { useEffect, useRef, useState } from 'react'
import type { EarthStory } from '../../content/content'
import { Emblem } from '../../shell/Logo'
import { S } from './strings'

/** A local story. It has no score, quality, storage or delivery inputs. */
export function RewardView({ story, next, preview, onPreview, onClosePreview, onContinue, continueLabel }: {
  story: EarthStory | null
  next: EarthStory | null
  preview: boolean
  onPreview: () => void
  onClosePreview: () => void
  onContinue: () => void
  continueLabel: string
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [audioFailed, setAudioFailed] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    const player = audio.current
    if (!player) return
    const failed = () => setAudioFailed(true)
    const loaded = () => {
      if (Number.isFinite(player.duration)) setDuration(player.duration)
    }
    player.addEventListener('error', failed)
    player.addEventListener('loadedmetadata', loaded)
    // A lazy route can preload while React's tree is still detached. Its error/metadata
    // event may precede the committed UI, so reconcile the media element's durable state.
    if (player.error) failed()
    loaded()
    return () => {
      player.removeEventListener('error', failed)
      player.removeEventListener('loadedmetadata', loaded)
      player.pause()
    }
  }, [story?.id])

  if (!story) return (
    <section className="dc-card" aria-labelledby="dc-reward-title">
      <Emblem size={64} />
      <h2 id="dc-reward-title" tabIndex={-1}>{S.storyUnavailableTitle}</h2>
      <p>{S.storyUnavailable}</p>
      <button className="dc-btn" type="button" onClick={onContinue}>{continueLabel}</button>
    </section>
  )

  return (
    <section className="dc-reward" aria-labelledby="dc-reward-title">
      <div className="dc-reward-top"><p>{S.rewardTitle}</p><span>{S.storyDay(story.mission_day)}</span></div>
      {preview && <p className="dc-preview-note" role="status">{S.storyPreviewNote}</p>}
      <div className={`dc-letter${story.image ? '' : ' dc-letter-text'}`}>
        {story.image && <figure className="dc-letter-photo">
          {!imageFailed
            ? <img src={story.image.src} alt={story.image.alt} onError={() => setImageFailed(true)} />
            : <div className="dc-photo-fallback"><Emblem size={80} /><p>{S.storyImageUnavailable}</p></div>}
          <figcaption>{story.image.caption}</figcaption>
        </figure>}
        <div className="dc-letter-body">
          <p className="dc-letter-from">{story.sender_label}</p>
          <h2 id="dc-reward-title" tabIndex={-1}>{story.title}</h2>
          <p className="dc-letter-transcript">{story.transcript}</p>
          {story.audio && <div className="dc-letter-audio">
            <div className="dc-audio-label"><span>{S.storyListen}</span>{duration !== null && <span>{S.storyDuration(duration)}</span>}</div>
            <audio ref={audio} controls preload="metadata" aria-label={S.storyAudioLabel(story.sender_label)}
              src={story.audio.src} onError={() => setAudioFailed(true)}
              onLoadedMetadata={(e) => {
                const value = e.currentTarget.duration
                if (Number.isFinite(value)) setDuration(value)
              }} />
            {audioFailed && <p className="dc-small" role="status">{S.storyAudioUnavailable}</p>}
          </div>}
          <p className="dc-story-disclosure">{story.audio?.production === 'synthetic' ? S.storySyntheticDisclosure : S.storyDisclosure}</p>
        </div>
      </div>
      {!preview && next && <div className="dc-next-story">
        <div className="dc-next-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><rect x="4" y="7" width="24" height="18" rx="3" /><path d="m5 9 11 8L27 9" /></svg></div>
        <div><h3>{S.storyNextDay(next.mission_day)}</h3><p>{story.teaser_text}</p></div>
        <button type="button" className="dc-text-button" onClick={onPreview}>{S.storyPreview}</button>
      </div>}
      <div className="dc-reward-actions">
        {preview && <button type="button" className="dc-btn dc-btn-secondary" onClick={onClosePreview}>{S.storyBack}</button>}
        <button type="button" className="dc-btn" onClick={onContinue}>{continueLabel}</button>
      </div>
    </section>
  )
}
