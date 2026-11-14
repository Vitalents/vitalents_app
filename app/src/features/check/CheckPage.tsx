// Preparation -> fixed measurement -> storage status -> optional story and result.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DEMO_MS, MEASURE_MS, PRACTICE_MS, buildRoundRecords, makeDifferentKey, makeKey, makeSequence, newSeed, type BuiltRecords,
} from '../../engine/decodeSession'
import { baselineSessions } from '../../engine/decodeValidity'
import { referenceForDate } from '../../engine/reference'
import { missionDay, MISSION_ANCHOR } from '../../engine/mission'
import { useStore } from '../../store/store'
import { DecodeRound } from '../decode/DecodeRound'
import { DataBadge, ResultView } from '../decode/ResultView'
import { RewardView } from '../decode/RewardView'
import { S as SH } from '../../content/strings'
import { Emblem } from '../../shell/Logo'
import { storyFor } from '../decode/messages'
import { S } from '../decode/strings'
import type { RoundEnd } from '../decode/useRound'
import { DailyCheck, todaysAlertness, type CheckContext } from './DailyCheck'
import '../decode/decode.css'

type Step = 'check' | 'intro' | 'practice' | 'between' | 'round' | 'interruption' | 'saving' | 'save_error' | 'reward' | 'result' | 'stopped'

function useCheckContext(): CheckContext {
  const data = useStore((s) => s.data)
  return useMemo(() => {
    const subjectId = data.subject_profile[0]?.subject_profile_id ?? 'sim:crew:fahim'
    const reviews = data.daily_review.filter((r) => r.subject_id === subjectId)
      .sort((a, b) => a.review_date.localeCompare(b.review_date))
    return { subjectId, today: reviews.at(-1)?.review_date ?? MISSION_ANCHOR.date }
  }, [data.subject_profile, data.daily_review])
}

export function CheckPage() {
  const ctx = useCheckContext()
  const location = useLocation()
  const data = useStore((s) => s.data)
  const putMany = useStore((s) => s.putMany)
  const [step, setStep] = useState<Step>(() => new URLSearchParams(location.search).get('story') === 'home' ? 'reward' : 'check')
  const stepRef = useRef(step)
  stepRef.current = step
  const page = useRef<HTMLDivElement>(null)
  const storyReturn = useRef<Step>('check')
  const [preview, setPreview] = useState(false)
  const [demo, setDemo] = useState(false)
  const [seed, setSeed] = useState(() => newSeed())
  const keyMap = useMemo(() => makeKey(seed), [seed])
  const practiceKey = useMemo(() => makeDifferentKey(seed + 1, keyMap), [seed, keyMap])
  const sequence = useMemo(() => makeSequence(seed), [seed])
  const practiceSeq = useMemo(() => makeSequence(seed + 7), [seed])
  const [pending, setPending] = useState<RoundEnd | null>(null)
  const [saved, setSaved] = useState<BuiltRecords | null>(null)
  // Checkpoints and both finalisation phases update one attempt. Each retry retains its exact batch.
  const roundKey = useRef(crypto.randomUUID())
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve())
  const attempt = useRef<{ built: BuiltRecords; destination: 'interruption' | 'result' | 'stopped' } | null>(null)
  const saving = useRef(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error' | 'saved'>('idle')
  const durationMs = demo ? DEMO_MS : MEASURE_MS
  const selection = storyFor(ctx.subjectId, missionDay(ctx.today))
  const displayedStory = preview ? selection.next : selection.current

  useEffect(() => {
    if (new URLSearchParams(location.search).get('story') === 'home' && !['round', 'practice'].includes(stepRef.current)) {
      if (stepRef.current !== 'reward') storyReturn.current = stepRef.current
      setPreview(false)
      setStep('reward')
    }
  }, [location.key, location.search])

  useEffect(() => {
    // The round owns its input focus. Never steal focus from the help dialog it opens.
    if (step === 'round' || step === 'practice' || document.querySelector('dialog[open], [role="dialog"]')) return
    const heading = [...(page.current?.querySelectorAll<HTMLElement>('h2') ?? [])].find((h) => !h.closest('[hidden]'))
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
  }, [step, preview])

  const buildAttempt = (end: RoundEnd, extraReasons: string[]) => {
    let n = 0
    const key = roundKey.current
    return buildRoundRecords({
      subjectId: ctx.subjectId, seed, raw: end.raw, plannedMs: durationMs, isPractice: demo, state: end.state,
      interruptionReasons: [...end.interruptionReasons, ...extraReasons], interruptedAtMs: end.cutMs,
      startedAt: end.startedAt, elapsedMs: end.elapsedMs, inputMethod: end.inputMethod,
      hidden: end.hidden, deviceClass: end.deviceClass,
      baseline: baselineSessions(data, ctx.subjectId, end.startedAt.toISOString()),
      uuid: () => `${key}-${n++}`,
    })
  }

  const enqueueWrite = (built: BuiltRecords) => {
    // A slow checkpoint cannot land after finalisation and turn a completed round back into started.
    const write = writeQueue.current.catch(() => undefined).then(() => putMany({
      decode_session: [built.session], decode_response_event: built.events, information_status: [built.info],
    }))
    writeQueue.current = write
    return write
  }

  const persistAttempt = async () => {
    const request = attempt.current
    if (!request || saving.current) return
    const { built, destination } = request
    saving.current = true
    setSaveState('saving')
    if (stepRef.current !== 'reward') setStep('saving')
    try {
      await enqueueWrite(built)
      if (destination !== 'interruption') { setSaved(built); setPending(null) }
      setSaveState('saved')
      storyReturn.current = destination
      if (stepRef.current !== 'reward') setStep(destination === 'result' ? 'reward' : destination)
    } catch {
      setSaveState('error')
      storyReturn.current = 'save_error'
      if (stepRef.current !== 'reward') setStep('save_error')
    } finally {
      saving.current = false
    }
  }

  const prepareSave = (end: RoundEnd, extraReasons: string[], destination: 'interruption' | 'result' | 'stopped') => {
    if (saving.current || attempt.current?.destination === destination) return
    attempt.current = { built: buildAttempt(end, extraReasons), destination }
    void persistAttempt()
  }

  const onCheckpoint = (end: RoundEnd) => {
    // Once finalisation has begun, only its retained batch may update the attempt.
    if (attempt.current) return
    // Keep the measurement window neutral. Final persistence exposes an error and retry if needed.
    void enqueueWrite(buildAttempt(end, [])).catch(() => undefined)
  }

  const onRoundEnd = (end: RoundEnd) => {
    if (end.state === 'completed') {
      setPending(end)
      // Persist the full ledger before asking about conditions, while comparison stays ineligible.
      prepareSave(end, ['pending_interruption_check'], 'interruption')
    } else prepareSave(end, [], 'stopped')
  }

  const answerInterruption = (yes: boolean) => {
    if (pending) prepareSave(pending, yes ? ['reported_interruption'] : [], 'result')
  }

  const openStory = () => {
    storyReturn.current = step
    setPreview(false)
    setStep('reward')
  }
  const closeStory = () => {
    setPreview(false)
    const target = storyReturn.current
    setStep(target === 'saving' ? (saveState === 'error' ? 'save_error' : saveState === 'saved' ? attempt.current?.destination ?? 'stopped' : 'saving') : target)
  }
  const restart = () => {
    setSeed(newSeed()); setSaved(null); setPending(null); attempt.current = null
    roundKey.current = crypto.randomUUID()
    setSaveState('idle'); setStep('intro')
  }

  const selfRating = todaysAlertness(data, ctx)?.alertness_rating ?? null
  const reference = useMemo(
    () => referenceForDate(data.personal_reference, 'decode_correct_count', saved?.session.start_at_utc.slice(0, 10) ?? ctx.today, ctx.subjectId),
    [data.personal_reference, ctx.subjectId, ctx.today, saved],
  )
  const storyLink = <button type="button" className="dc-text-button" onClick={openStory}>{S.openStory}</button>
  const returnLabel = storyReturn.current === 'result' ? S.showResult : storyReturn.current === 'check' ? S.backToCheck : S.backToRoundStatus

  return (
    <div ref={page} className={`dc-page${step === 'reward' ? ' dc-page-story' : ''}`}>
      <h1 className="sr-only">{SH.nav.check.full}</h1>
      {/* Keep this person's draft and pending save alive during a story detour. Hidden removes it
          from keyboard/accessibility navigation; a new person/day gets a fresh form. */}
      <div hidden={step !== 'check'} key={`${ctx.subjectId}:${ctx.today}`}>
        <DailyCheck ctx={ctx} onDone={() => { if (stepRef.current === 'check') setStep('intro') }} />
        <div className="dc-story-entry">{storyLink}<span>{S.storyAccess}</span></div>
      </div>
      {step === 'intro' && <section className="dc-card" aria-labelledby="dc-intro-title">
        <Emblem size={72} />
        <p className="eyebrow">{S.stepOf(2, 2)}</p>
        <h2 id="dc-intro-title">{S.decodeTitle}</h2>
        <p className="dc-story">{S.decodeStory}</p><p>{S.decodeHow}</p><p className="dc-muted">{S.decodeRules}</p>
        <label className="dc-toggle"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /><span>{S.demoToggle}</span></label>
        {demo && <p className="dc-small">{S.demoHelp}</p>}
        <p className="dc-small">{S.validationLabel}</p>
        <button type="button" className="dc-btn" onClick={() => setStep('practice')}>{S.startPractice}</button>
        <div className="dc-story-entry">{storyLink}<span>{S.storyAccess}</span></div>
      </section>}
      {step === 'practice' && <DecodeRound key={`p-${seed}`} keyMap={practiceKey} sequence={practiceSeq} durationMs={PRACTICE_MS} label={S.practiceLabel}
        onEnd={(end) => setStep(end.state === 'completed' ? 'between' : 'intro')} />}
      {step === 'between' && <section className="dc-card" aria-labelledby="dc-between-title">
        <h2 id="dc-between-title">{S.betweenTitle}</h2><p>{S.betweenText(durationMs / 1000)}</p>
        {demo && <p className="dc-small">{S.demoHelp}</p>}
        <button type="button" className="dc-btn" onClick={() => setStep('round')}>{S.startRound}</button>
      </section>}
      {step === 'round' && <DecodeRound key={`m-${seed}`} keyMap={keyMap} sequence={sequence} durationMs={durationMs}
        label={demo ? S.demoLabel : S.measureLabel} onEnd={onRoundEnd} onCheckpoint={onCheckpoint} />}
      {step === 'interruption' && <section className="dc-card" aria-labelledby="dc-int-title">
        <h2 id="dc-int-title">{S.interruptionTitle}</h2><p className="dc-muted">{S.interruptionHelp}</p>
        <div className="dc-row"><button type="button" className="dc-btn dc-btn-secondary" onClick={() => answerInterruption(true)}>{S.yes}</button>
          <button type="button" className="dc-btn" onClick={() => answerInterruption(false)}>{S.no}</button></div>
      </section>}
      {(step === 'saving' || step === 'save_error') && <section className="dc-card" aria-labelledby="dc-save-title">
        <h2 id="dc-save-title">{step === 'saving' ? S.savingTitle : S.saveErrorTitle}</h2>
        <p role={step === 'save_error' ? 'alert' : 'status'}>{step === 'saving' ? S.savingText : S.saveErrorText}</p>
        {step === 'save_error' && <button type="button" className="dc-btn" onClick={() => void persistAttempt()}>{S.retrySave}</button>}
        <div className="dc-story-entry">{storyLink}<span>{S.storyAccess}</span></div>
      </section>}
      {step === 'reward' && <>
        {saveState !== 'idle' && <p className="dc-save-note" role={saveState === 'error' ? 'alert' : 'status'}>
          {saveState === 'saved' ? S.roundSaved : saveState === 'saving' ? S.savingTitle : S.saveErrorText}
          {saveState === 'error' && <button type="button" className="dc-text-button" onClick={() => void persistAttempt()}>{S.retrySave}</button>}
        </p>}
        <RewardView key={displayedStory?.id ?? 'empty'} story={displayedStory} next={selection.next} preview={preview}
          onPreview={() => setPreview(true)} onClosePreview={() => setPreview(false)} onContinue={closeStory} continueLabel={returnLabel} />
      </>}
      {step === 'result' && saved && <ResultView session={saved.session} quality={saved.quality} eventCount={saved.events.length}
        ruleset={saved.info.ruleset_version} selfRating={selfRating} reference={reference} onAgain={restart} onStory={openStory} />}
      {step === 'stopped' && saved && <section className="dc-card" aria-labelledby="dc-stop-title">
        <h2 id="dc-stop-title">{saved.session.session_state === 'interrupted' ? S.interruptedTitle : S.abortedTitle}</h2>
        <p>{saved.session.session_state === 'interrupted' ? S.interruptedText : S.abortedText}</p>
        <p className="dc-small">{S.dataStatus}: <DataBadge status={saved.quality.status} />
          {saved.quality.reason_codes.length > 0 && <>, {saved.quality.reason_codes.map((r) => S.reasonLabels[r] ?? r).join(', ')}</>}</p>
        <button type="button" className="dc-btn" onClick={restart}>{S.backToStart}</button>
        <div className="dc-story-entry">{storyLink}<span>{S.storyAccess}</span></div>
      </section>}
    </div>
  )
}
export default CheckPage
