// Runs one Decode round (practice or measured). Timing uses performance.now() from the moment the window opens.
// Rules are fixed (FR-DEC-03): one symbol per trial, identical feedback, no score during the round.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HIDDEN_LIMIT_MS, NEXT_ITEM_DELAY_MS, type DecodeKey, type RawResponse, type SessionState, type SymbolId,
} from '../../engine/decodeSession'
import { deviceClassFrom, type DeviceClass, type Span } from '../../engine/decodeValidity'

export const HELP_EVENT = 'vitalents:request-help'
export const REPORT_EVENT = 'vitalents:report-something'
const LATE_GRACE_MS = 400

export interface RoundEnd {
  state: SessionState
  raw: RawResponse[]
  interruptionReasons: string[]
  cutMs: number | null // monotonic ms when an interruption ended the round
  startedAt: Date // UTC moment the window opened
  elapsedMs: number
  inputMethod: 'keyboard' | 'touch' | 'other'
  hidden: Span[] // monotonic spans with the page hidden (never counted as pauses)
  deviceClass: DeviceClass | null
}

/** Device class as the browser reports it (SRS 7.3 device_change). Null when the browser cannot tell. */
export function currentDeviceClass(): DeviceClass | null {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const shortSidePx = Math.min(window.screen.width, window.screen.height)
    return shortSidePx > 0 ? deviceClassFrom({ coarsePointer: coarse, shortSidePx }) : null
  } catch {
    return null
  }
}

export interface RoundView {
  symbol: SymbolId | null
  pulse: number // increments on every answer
  waiting: boolean // true in the 150 ms gap after an answer: the same static acknowledgement for right and wrong, no motion
  progress: number // 0..1 of the window elapsed
  ended: boolean
}

export function useRound(opts: {
  keyMap: DecodeKey
  sequence: SymbolId[]
  durationMs: number
  onEnd: (end: RoundEnd) => void
  onCheckpoint?: (checkpoint: RoundEnd) => void
}) {
  const { keyMap, sequence, durationMs } = opts
  const onEnd = useRef(opts.onEnd)
  onEnd.current = opts.onEnd
  const onCheckpoint = useRef(opts.onCheckpoint)
  onCheckpoint.current = opts.onCheckpoint

  const [view, setView] = useState<RoundView>({ symbol: sequence[0] ?? null, pulse: 0, waiting: false, progress: 0, ended: false })

  const s = useRef({
    t0: 0,
    startedAt: new Date(),
    trial: 1,
    stimulus: 0,
    answered: false,
    raw: [] as RawResponse[],
    ended: false,
    finalised: false,
    armed: false,
    hiddenTotal: 0,
    hiddenSince: null as number | null,
    hidden: [] as Span[],
    method: null as 'keyboard' | 'touch' | 'other' | null,
    timers: [] as number[],
    raf: 0,
  })

  // monotonic ms since the window opened, captured at 0.1 ms so stored events and summaries agree exactly
  const now = () => Math.round((performance.now() - s.current.t0) * 10) / 10

  const checkpoint = useCallback(() => {
    const st = s.current
    if (st.finalised || !onCheckpoint.current) return
    const raw = [...st.raw]
    if (!st.answered) {
      const symbol = sequence[st.trial - 1]
      raw.push({ trial_index: st.trial, symbol_id: symbol, correct_digit: keyMap[symbol], stimulus_ms: st.stimulus, response_ms: null, response_digit: null })
    }
    onCheckpoint.current({ state: 'started', raw, interruptionReasons: [], cutMs: null, startedAt: st.startedAt,
      elapsedMs: now(), inputMethod: st.method ?? 'other', hidden: [...st.hidden], deviceClass: currentDeviceClass() })
  }, [keyMap, sequence])

  const finalise = useCallback((state: SessionState, reasons: string[], cut: number | null) => {
    const st = s.current
    if (st.finalised) return
    st.finalised = true
    st.timers.forEach((t) => window.clearTimeout(t))
    cancelAnimationFrame(st.raf)
    if (st.hiddenSince !== null) st.hidden.push([st.hiddenSince, now()]) // still hidden when the round ended
    // the trial still open when the round ended stays in the log with no response (missed / interrupted)
    if (!st.answered) {
      const sym = sequence[st.trial - 1]
      st.raw.push({ trial_index: st.trial, symbol_id: sym, correct_digit: keyMap[sym], stimulus_ms: st.stimulus, response_ms: null, response_digit: null })
    }
    onEnd.current({
      state, raw: st.raw, interruptionReasons: reasons, cutMs: cut, startedAt: st.startedAt,
      elapsedMs: cut ?? durationMs, inputMethod: st.method ?? 'other',
      hidden: st.hidden, deviceClass: currentDeviceClass(),
    })
  }, [durationMs, keyMap, sequence])

  const end = useCallback((state: SessionState, reasons: string[] = [], cut: number | null = null) => {
    const st = s.current
    if (st.ended) return
    st.ended = true
    setView((v) => ({ ...v, ended: true, progress: state === 'completed' ? 1 : v.progress }))
    if (state === 'completed') {
      // keep listening briefly so a press after the window is logged as late, not lost
      st.timers.push(window.setTimeout(() => finalise(state, reasons, cut), LATE_GRACE_MS))
    } else finalise(state, reasons, cut)
  }, [finalise])

  const respond = useCallback((digit: number, method: 'keyboard' | 'touch' | 'other') => {
    const st = s.current
    if (st.finalised) return
    st.method ??= method
    const t = now()
    const sym = sequence[st.trial - 1]
    if (st.ended) {
      // after the window closed: the open trial gets a late response (not counted, not wrong)
      if (!st.answered) {
        st.raw.push({ trial_index: st.trial, symbol_id: sym, correct_digit: keyMap[sym], stimulus_ms: st.stimulus, response_ms: t, response_digit: digit })
        st.answered = true
        checkpoint()
      }
      return
    }
    st.raw.push({ trial_index: st.trial, symbol_id: sym, correct_digit: keyMap[sym], stimulus_ms: st.stimulus, response_ms: t, response_digit: digit })
    if (st.answered) { checkpoint(); return } // duplicate press during the gap: logged, classified as duplicate
    st.answered = true
    checkpoint()
    setView((v) => ({ ...v, pulse: v.pulse + 1, waiting: true }))
    st.timers.push(
      window.setTimeout(() => {
        if (st.ended) return
        st.trial += 1
        st.stimulus = now()
        st.answered = false
        setView((v) => ({ ...v, symbol: sequence[st.trial - 1] ?? null, waiting: false }))
      }, NEXT_ITEM_DELAY_MS),
    )
  }, [keyMap, sequence, checkpoint])

  const quit = useCallback(() => end('aborted', ['quit_early'], now()), [end])
  const help = useCallback(() => end('interrupted', ['interrupted_help'], now()), [end])

  useEffect(() => {
    const st = s.current
    Object.assign(st, {
      t0: performance.now(), startedAt: new Date(), trial: 1, stimulus: 0, answered: false, raw: [],
      ended: false, finalised: false, armed: false, hiddenTotal: 0, hiddenSince: null, hidden: [], method: null, timers: [],
    })
    setView({ symbol: sequence[0] ?? null, pulse: 0, waiting: false, progress: 0, ended: false })
    // React StrictMode performs a synchronous setup/cleanup probe. Arm persistence on the real mounted task.
    st.timers.push(window.setTimeout(() => { st.armed = true; checkpoint() }, 0))

    const tick = () => {
      const t = now()
      if (!st.ended && t >= durationMs) end('completed')
      else if (!st.ended) {
        setView((v) => ({ ...v, progress: Math.min(1, t / durationMs) }))
        st.raf = requestAnimationFrame(tick)
      }
    }
    st.raf = requestAnimationFrame(tick)
    // backstop if animation frames are throttled
    st.timers.push(window.setTimeout(() => { if (!st.ended) end('completed') }, durationMs + 50))

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      // A dialog, field or editable region owns its typing; numeric shortcuts must never consume it.
      if (e.composedPath().some((target) => target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return
      const d = Number(e.key)
      if (Number.isInteger(d) && d >= 1 && d <= 9) {
        e.preventDefault()
        respond(d, 'keyboard')
      }
    }
    const onVisibility = () => {
      if (st.ended) return
      if (document.hidden) {
        st.hiddenSince = now()
        const left = HIDDEN_LIMIT_MS - st.hiddenTotal
        st.timers.push(window.setTimeout(() => {
          if (!st.ended && document.hidden && st.hiddenSince !== null) end('interrupted', ['interrupted_page_hidden'], st.hiddenSince)
        }, left))
      } else if (st.hiddenSince !== null) {
        const since = st.hiddenSince
        const back = now()
        st.hidden.push([since, back])
        st.hiddenTotal += back - since
        st.hiddenSince = null
        if (st.hiddenTotal > HIDDEN_LIMIT_MS) end('interrupted', ['interrupted_page_hidden'], since)
      }
    }
    const onHelp = () => { if (!st.ended) end('interrupted', ['interrupted_help'], now()) }
    const onReport = () => { if (!st.ended) end('interrupted', ['reported_interruption'], now()) }
    const persistOnExit = () => {
      if (!st.armed || st.finalised) return
      // The completed window can still be listening for late presses. Navigation must not downgrade it.
      if (st.ended) finalise('completed', [], null)
      else finalise('aborted', ['aborted'], now())
    }
    const onPageHide = () => { if (onCheckpoint.current) persistOnExit() }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener(HELP_EVENT, onHelp)
    window.addEventListener(REPORT_EVENT, onReport)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener(HELP_EVENT, onHelp)
      window.removeEventListener(REPORT_EVENT, onReport)
      window.removeEventListener('pagehide', onPageHide)
      // Route navigation must preserve the partial round just as the explicit Quit button does.
      if (onCheckpoint.current) persistOnExit()
      st.timers.forEach((t) => window.clearTimeout(t))
      cancelAnimationFrame(st.raf)
      st.ended = true
      st.finalised = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { view, respond, quit, help }
}
