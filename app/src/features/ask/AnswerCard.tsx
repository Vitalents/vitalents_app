// Renders one /ask result: Your data and Scientific information kept apart (FR-AS-03), citations with excerpts (FR-AS-02).
import { useState } from 'react'
import { LIBRARY } from '../../content/content'
import { Emblem } from '../../shell/Logo'
import type { AskResult, Citation } from '../../assistant/client'
import { useStore } from '../../store/store'
import { makeKnowledgeGap } from './knowledgeGap'
import { S } from './strings'

const citeTitle = (c: Citation): string =>
  c.title ?? (c.source_id ? LIBRARY.get(c.source_id)?.title : undefined) ?? c.source_id ?? c.id

/** Entries in cached_answers.json that stand in until real answers are recorded. */
const isPlaceholder = (r: AskResult['response']) => !!r && r.question_id.startsWith('placeholder-')

export function AnswerCard({ question, result }: { question: string; result: AskResult }) {
  const put = useStore((s) => s.put)
  const [added, setAdded] = useState(false)
  const r = isPlaceholder(result.response) ? null : result.response
  const sourceLabel = result.source === 'live' ? S.labelLive : (result.label ?? S.labelCached)

  // FR-AS-04: an unanswered question becomes a knowledge_gap record for specialist review.
  const addForReview = async () => {
    const ids = (r?.citations ?? []).map((c) => c.source_id).filter((x): x is string => !!x)
    await put('knowledge_gap', [makeKnowledgeGap(question, ids)])
    setAdded(true)
  }

  const gapButton = added ? (
    <p className="ask-note" role="status">
      {S.added}
    </p>
  ) : (
    <button type="button" className="ask-btn ask-btn--ghost" onClick={addForReview}>
      {S.addForReview}
    </button>
  )

  if (!r) {
    return (
      <article className="ask-answer ask-answer--empty" aria-label={S.answerFor(question)}>
        <Emblem size={56} />
        <div>
          <span className="ask-chip ask-chip--muted">{result.label ?? S.noRecordedChip}</span>
          <p>{S.noRecorded}</p>
          {gapButton}
        </div>
      </article>
    )
  }

  return (
    <article className="ask-answer" aria-label={S.answerFor(question)}>
      <div className="ask-answer__meta">
        <span className="ask-chip">{sourceLabel}</span>
        <span className="ask-model">
          {S.model}: {r.model}
        </span>
      </div>
      {result.matchedQuestion && (
        <p className="ask-matched">
          {S.matchedRecorded} “{result.matchedQuestion}”
        </p>
      )}

      <section className="ask-section ask-section--data callout">
        <h3>{S.yourData}</h3>
        <p>{r.your_data ?? S.yourDataEmpty}</p>
      </section>

      <section className="ask-section ask-section--science">
        <h3>{S.science}</h3>
        {r.status === 'answered' && r.science ? (
          <p>{r.science}</p>
        ) : (
          <>
            <p>{r.status === 'blocked' ? S.blocked : S.notInLibrary}</p>
            {gapButton}
          </>
        )}
      </section>

      {r.citations.length > 0 && (
        <section className="ask-section">
          <h3>{S.sources}</h3>
          <ol className="ask-cites">
            {r.citations.map((c) => (
              <li key={c.id} className="ask-cite">
                <span className="ask-cite__id num-badge" aria-hidden="true">
                  {c.id}
                </span>
                <div>
                  <span className="ask-sr">
                    {S.source} {c.id}:{' '}
                  </span>
                  <span className="ask-cite__title">{citeTitle(c)}</span>
                  {c.page != null && (
                    <span className="ask-cite__page">
                      , {S.page} {c.page}
                    </span>
                  )}
                  <blockquote className="ask-cite__excerpt">{c.excerpt}</blockquote>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      {S.openSource}
                      <span className="ask-sr">
                        {' '}
                        {citeTitle(c)} {S.newTab}
                      </span>
                    </a>
                  ) : (
                    <span className="ask-cite__nolink">{S.noLink}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="ask-limits">
        <strong>{S.limits}:</strong> {r.limits}
      </p>
    </article>
  )
}
