// Check & Decode (Increment 2): daily check -> intro -> practice -> measured round -> interruption question -> reward -> result.
// Order is always preparation -> measurement -> story and reward (FR-DEC-01).
import { useMemo, useState } from 'react'
import type { DecodeSession } from '../../data/contract'
import {
  DEMO_MS, MEASURE_MS, PRACTICE_MS, buildRoundRecords, makeDifferentKey, makeKey, makeSequence, newSeed, type Quality,
} from '../../engine/decodeSession'
import { useStore } from '../../store/store'
import { DecodeRound } from '../decode/DecodeRound'
import { DataBadge, ResultView } from '../decode/ResultView'
import { Emblem } from '../../shell/Logo'
import { messageFor } from '../decode/messages'
import { S } from '../decode/strings'
import type { RoundEnd } from '../decode/useRound'
import { DailyCheck, todaysAlertness, type CheckContext } from './DailyCheck'
import '../decode/decode.css'

type Step = 'check' | 'intro' | 'practice' | 'between' | 'round' | 'interruption' | 'reward' | 'result' | 'stopped'

function useCheckContext(): CheckContext {
  const data = useStore((s) => s.data)
  return useMemo(() => {
    const subjectId = data.subject_profile[0]?.subject_profile_id ?? 'sim:crew:fahim'
    const reviews = [...data.daily_review].sort((a, b) => a.review_date.localeCompare(b.review_date))
    const today = reviews[reviews.length - 1]?.review_date ?? new Date().toISOString().slice(0, 10)
    return { subjectId, today }
  }, [data.subject_profile, data.daily_review])
}

/** Consecutive days (ending today) with at least one completed round. A reward for completing, not for the score. */
function completionStreak(sessions: DecodeSession[], subjectId: string, today: string): number {
  const days = new Set(sessions.filter((s) => s.subject_id === subjectId && s.session_state === 'completed').map((s) => s.start_at_utc.slice(0, 10)))
  let n = 0
  const d = new Date(`${today}T00:00:00Z`)
  while (days.has(d.toISOString().slice(0, 10))) {
    n += 1
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return n
}

export function CheckPage() {
  const ctx = useCheckContext()
  const data = useStore((s) => s.data)
  const put = useStore((s) => s.put)
  const [step, setStep] = useState<Step>('check')
  const [demo, setDemo] = useState(false)
  const [seed, setSeed] = useState(() => newSeed())
  const keyMap = useMemo(() => makeKey(seed), [seed])
  const practiceKey = useMemo(() => makeDifferentKey(seed + 1, keyMap), [seed, keyMap])
  const sequence = useMemo(() => makeSequence(seed), [seed])
  const practiceSeq = useMemo(() => makeSequence(seed + 7), [seed])
  const [pending, setPending] = useState<RoundEnd | null>(null)
  const [saved, setSaved] = useState<{ session: DecodeSession; quality: Quality; eventCount: number; ruleset: string } | null>(null)

  const durationMs = demo ? DEMO_MS : MEASURE_MS

  const save = async (end: RoundEnd, extraReasons: string[]) => {
    const built = buildRoundRecords({
      subjectId: ctx.subjectId, seed, raw: end.raw, plannedMs: durationMs, isPractice: demo, state: end.state,
      interruptionReasons: [...end.interruptionReasons, ...extraReasons], interruptedAtMs: end.cutMs,
      startedAt: end.startedAt, elapsedMs: end.elapsedMs, inputMethod: end.inputMethod,
    })
    await put('decode_session', [built.session])
    await put('decode_response_event', built.events)
    await put('information_status', [built.info])
    setSaved({ session: built.session, quality: built.quality, eventCount: built.events.length, ruleset: built.info.ruleset_version })
    return built
  }

  const onRoundEnd = async (end: RoundEnd) => {
    if (end.state === 'completed') {
      setPending(end)
      setStep('interruption')
    } else {
      await save(end, [])
      setStep('stopped')
    }
  }

  const answerInterruption = async (yes: boolean) => {
    if (!pending) return
    await save(pending, yes ? ['reported_interruption'] : [])
    setPending(null)
    setStep('reward')
  }

  const restart = () => {
    setSeed(newSeed())
    setSaved(null)
    setPending(null)
    setStep('intro')
  }

  const selfRating = todaysAlertness(data, ctx)?.alertness_rating ?? null
  const reference = useMemo(
    () => [...data.personal_reference].filter((r) => r.subject_id === ctx.subjectId && r.metric_code === 'decode_correct_count')
      .sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc)).pop() ?? null,
    [data.personal_reference, ctx.subjectId],
  )
  const streak = completionStreak(data.decode_session, ctx.subjectId, ctx.today)
  const dayIndex = Math.round(Date.parse(`${ctx.today}T00:00:00Z`) / 86_400_000)

  return (
    <div className="dc-page">
      {step === 'check' && <DailyCheck ctx={ctx} onDone={() => setStep('intro')} />}

      {step === 'intro' && (
        <section className="dc-card" aria-labelledby="dc-intro-title">
          <Emblem size={72} />
          <p className="eyebrow">{S.stepOf(2, 2)}</p>
          <h2 id="dc-intro-title">{S.decodeTitle}</h2>
          <p className="dc-story">{S.decodeStory}</p>
          <p>{S.decodeHow}</p>
          <p className="dc-muted">{S.decodeRules}</p>
          <label className="dc-toggle">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            <span>{S.demoToggle}</span>
          </label>
          {demo && <p className="dc-small">{S.demoHelp}</p>}
          <p className="dc-small">{S.validationLabel}</p>
          <button type="button" className="dc-btn" onClick={() => setStep('practice')}>{S.startPractice}</button>
        </section>
      )}

      {step === 'practice' && (
        <DecodeRound key={`p-${seed}`} keyMap={practiceKey} sequence={practiceSeq} durationMs={PRACTICE_MS} label={S.practiceLabel}
          onEnd={(end) => setStep(end.state === 'completed' ? 'between' : 'intro')} />
      )}

      {step === 'between' && (
        <section className="dc-card" aria-labelledby="dc-between-title">
          <h2 id="dc-between-title">{S.betweenTitle}</h2>
          <p>{S.betweenText(durationMs / 1000)}</p>
          {demo && <p className="dc-small">{S.demoHelp}</p>}
          <button type="button" className="dc-btn" onClick={() => setStep('round')}>{S.startRound}</button>
        </section>
      )}

      {step === 'round' && (
        <DecodeRound key={`m-${seed}`} keyMap={keyMap} sequence={sequence} durationMs={durationMs}
          label={demo ? S.demoLabel : S.measureLabel} onEnd={onRoundEnd} />
      )}

      {step === 'interruption' && (
        <section className="dc-card" aria-labelledby="dc-int-title">
          <h2 id="dc-int-title">{S.interruptionTitle}</h2>
          <p className="dc-muted">{S.interruptionHelp}</p>
          <div className="dc-row">
            <button type="button" className="dc-btn dc-btn-secondary" onClick={() => answerInterruption(true)}>{S.yes}</button>
            <button type="button" className="dc-btn" onClick={() => answerInterruption(false)}>{S.no}</button>
          </div>
        </section>
      )}

      {step === 'reward' && (
        <section className="dc-card" aria-labelledby="dc-reward-title">
          <p id="dc-reward-title" className="eyebrow">{S.rewardTitle}</p>
          <blockquote className="dc-message">{messageFor(dayIndex)}</blockquote>
          <p className="dc-streak">{S.rewardStreak(streak)}</p>
          <button type="button" className="dc-btn" onClick={() => setStep('result')}>{S.showResult}</button>
        </section>
      )}

      {step === 'result' && saved && (
        <ResultView session={saved.session} quality={saved.quality} eventCount={saved.eventCount} ruleset={saved.ruleset} selfRating={selfRating} reference={reference} onAgain={restart} />
      )}

      {step === 'stopped' && saved && (
        <section className="dc-card" aria-labelledby="dc-stop-title">
          <h2 id="dc-stop-title">{saved.session.session_state === 'interrupted' ? S.interruptedTitle : S.abortedTitle}</h2>
          <p>{saved.session.session_state === 'interrupted' ? S.interruptedText : S.abortedText}</p>
          <p className="dc-small">
            {S.dataStatus}: <DataBadge status={saved.quality.status} />
            {saved.quality.reason_codes.length > 0 && <>, {saved.quality.reason_codes.map((r) => S.reasonLabels[r] ?? r).join(', ')}</>}
          </p>
          <button type="button" className="dc-btn" onClick={restart}>{S.backToStart}</button>
        </section>
      )}
    </div>
  )
}

export default CheckPage
