// Question box + answer. Used full-width on /ask and compact inside a domain card's Understand tab.
import { useId, useState, type FormEvent } from 'react'
import { ask, buildContext, type AskResult } from '../../assistant/client'
import { domainById, DOMAINS, type DomainId } from '../../content/content'
import { useVisibleStoreData } from '../../store/selectors'
import { AnswerCard } from './AnswerCard'
import { DOMAIN_SUGGESTIONS, GENERAL_SUGGESTIONS } from './suggestions'
import { S } from './strings'
import './ask.css'

export function AskBox({ domainId, compact = false }: { domainId?: DomainId; compact?: boolean }) {
  const data = useVisibleStoreData()
  const uid = useId()
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const suggestions = domainId ? DOMAIN_SUGGESTIONS[domainId] : GENERAL_SUGGESTIONS

  const run = async (q: string) => {
    const text = q.trim()
    if (!text || busy) return
    setQuestion(text)
    setAsked(text)
    setBusy(true)
    setResult(null)
    try {
      // Context carries only labelled values; private notes never leave the device (rule 9).
      setResult(await ask(text, buildContext(data, domainId)))
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(question)
  }

  return (
    <div className={`ask-box${compact ? ' ask-box--compact' : ''}`}>
      <form className="ask-form" onSubmit={submit} role="search">
        <label htmlFor={`${uid}-q`} className="ask-sr">
          {S.placeholder}
        </label>
        <input
          id={`${uid}-q`}
          className="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={S.placeholder}
          autoComplete="off"
          maxLength={500}
        />
        <button className="ask-btn" type="submit" disabled={busy || !question.trim()}>
          {S.ask}
        </button>
      </form>

      <p className="ask-suggest__label" id={`${uid}-sg`}>
        {S.suggested}
      </p>
      <ul className="ask-suggest" aria-labelledby={`${uid}-sg`}>
        {suggestions.map((s) => (
          <li key={s}>
            <button type="button" className="ask-pill" onClick={() => void run(s)} disabled={busy}>
              {s}
            </button>
          </li>
        ))}
      </ul>

      <p className="ask-status" role="status" aria-live="polite">
        {busy ? S.asking : ''}
      </p>
      {result && result.source === 'unavailable' && <ReviewedFallback domainId={domainId} />}
      {result && result.source !== 'unavailable' && <AnswerCard question={asked} result={result} />}
      {!compact && <p className="ask-foot">{S.disclaimer}</p>}
    </div>
  )
}

/** FR-AS-06: the assistant is down, so show fixed reviewed text instead of nothing. */
export function ReviewedFallback({ domainId }: { domainId?: DomainId }) {
  const one = domainId ? domainById(domainId) : undefined
  const domains = one ? [one] : DOMAINS.filter((d) => d.live)
  return (
    <article className="ask-answer ask-answer--fallback">
      <span className="ask-chip ask-chip--muted">{S.unavailableTitle}</span>
      <p>{S.unavailableBody}</p>
      {domains.map((d) => (
        <section key={d.id} className="ask-section">
          <h3>{d.name}</h3>
          <p>
            <strong>{S.whySpace}:</strong> {d.why_space}
          </p>
          <p>
            <strong>{S.limitsNote}:</strong> {d.limits_note}
          </p>
        </section>
      ))}
    </article>
  )
}
