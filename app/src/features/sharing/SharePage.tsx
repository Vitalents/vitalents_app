// Share screen (route /share): question, preview, confirm, then delivery with proof times.
// Built from filterData output: only the astronaut's own role sees and shares the full record.
import './share.css'
import { useMemo, useState } from 'react'
import { create } from 'zustand'
import { Emblem } from '../../shell/Logo'
import { useRole } from '../../store/role'
import { newPackageId } from '../../sync/share'
import { confirmShare } from '../../sync/link'
import { useVisibleData } from '../roles/hooks'
import { SharePreview } from './SharePreview'
import { SyncStatusRow } from './SyncStatusRow'
import { buildSummary } from './summary'
import { T, utcDateTime } from './strings'

/** The open draft survives leaving the screen or switching the demo role (not a reload). */
const useDraft = create<{ ids: Record<string, string>; questions: Record<string, string> }>(() => ({ ids: {}, questions: {} }))

export function SharePage({ subjectId }: { subjectId: string }) {
  const role = useRole((s) => s.role)
  const data = useVisibleData(subjectId)
  const question = useDraft((s) => s.questions[subjectId] ?? '')
  const storedId = useDraft((s) => s.ids[subjectId])
  const [fallbackId] = useState(() => newPackageId(subjectId))
  const draftId = storedId ?? fallbackId
  const setQuestion = (q: string) => useDraft.setState((s) => ({ questions: { ...s.questions, [subjectId]: q }, ids: { ...s.ids, [subjectId]: draftId } }))
  const setDraftId = (id: string) => useDraft.setState((s) => ({ ids: { ...s.ids, [subjectId]: id } }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => buildSummary(data, subjectId, question), [data, subjectId, question])
  const sent = data.share_package.find((p) => p.share_package_id === draftId) ?? null
  const earlier = data.share_package
    .filter((p) => p.share_package_id !== draftId)
    .sort((a, b) => b.prepared_at_utc.localeCompare(a.prepared_at_utc))

  if (role !== 'astronaut') {
    return (
      <div className="page sh-page">
        <div className="loading-state">
          <Emblem size={88} />
          <p className="muted">{T.share.onlyAstronaut}</p>
        </div>
      </div>
    )
  }

  async function onConfirm() {
    setBusy(true)
    setError(null)
    setDraftId(draftId)
    try {
      await confirmShare(
        {
          subjectId,
          packageId: draftId,
          previewedRecordIds: summary.previewedRecordIds,
          excludedFieldCodes: summary.excludedFieldCodes,
          summaryText: summary.summaryText,
        },
        role,
      )
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  function startNew() {
    useDraft.setState((s) => ({ ids: { ...s.ids, [subjectId]: newPackageId(subjectId) }, questions: { ...s.questions, [subjectId]: '' } }))
  }

  return (
    <div className="page sh-page">
      <header className="page-head">
        <p className="eyebrow">{T.share.kicker}</p>
        <h1>{T.share.title}</h1>
        <p className="muted">{T.share.lede}</p>
      </header>

      {!sent ? (
        <>
          <section className="sh-step" aria-labelledby="sh-step-q">
            <h2 id="sh-step-q" className="sh-step-head">
              <span className="num-badge" aria-hidden="true">01</span>
              {T.share.stepQuestion}
            </h2>
            <div className="card pad">
              <label className="field" htmlFor="sh-question">
                <span>{T.share.questionLabel}</span>
                <span className="muted small" id="sh-question-hint">{T.share.questionHint}</span>
                <textarea
                  id="sh-question"
                  rows={3}
                  aria-describedby="sh-question-hint"
                  placeholder={T.share.questionPlaceholder}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="sh-step" aria-labelledby="sh-step-p">
            <h2 id="sh-step-p" className="sh-step-head">
              <span className="num-badge" aria-hidden="true">02</span>
              {T.share.stepPreview}
            </h2>
            <SharePreview summary={summary} onConfirm={onConfirm} busy={busy} />
            {error && <p className="field-error" role="alert">{error}</p>}
          </section>
        </>
      ) : (
        <section className="sh-step" aria-labelledby="sh-step-d">
          <h2 id="sh-step-d" className="sh-step-head">
            <span className="num-badge" aria-hidden="true">03</span>
            {T.sync.title}
          </h2>
          <div className="card pad sh-delivery">
            <p className="sh-delivery-meta">
              <span>{T.share.recipient}</span>
              <span className="muted small">{T.medical.prepared} {utcDateTime(sent.prepared_at_utc)}</span>
            </p>
            <SyncStatusRow pkg={sent} events={data.sync_event} />
            <button type="button" className="btn" onClick={startNew}>{T.share.another}</button>
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <section className="sh-earlier" aria-labelledby="sh-earlier">
          <h2 id="sh-earlier">{T.share.earlier}</h2>
          <ul className="sh-earlier-list">
            {earlier.map((p) => (
              <li key={p.share_package_id} className="card sh-earlier-item">
                <p className="small muted">{T.medical.prepared} {utcDateTime(p.prepared_at_utc)}</p>
                <SyncStatusRow pkg={p} events={data.sync_event} compact />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
