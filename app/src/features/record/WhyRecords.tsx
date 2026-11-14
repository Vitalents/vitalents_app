// "Why?" disclosure (DESIGN.md `Why`): the records behind a number, each with its date, value and data status.
import type { ReactNode } from 'react'
import { describeRecord, reasonText } from '../../content/format'
import { S } from '../../content/strings'
import { infoStatusOf } from '../../engine/view'
import { useDataSet, useRecordIndex } from '../../store/selectors'
import { T } from './strings'

export function WhyRecords({ ids, caption, summary = T.why, children }: { ids: string[]; caption: string; summary?: string; children?: ReactNode }) {
  const idx = useRecordIndex()
  const data = useDataSet()
  return (
    <details className="why tr-why">
      <summary>{summary}</summary>
      <div className="why-body">
        <table className="why-table">
          <caption>{caption}</caption>
          <thead>
            <tr><th scope="col">{T.whyCols.what}</th><th scope="col">{T.whyCols.date}</th><th scope="col">{T.whyCols.value}</th><th scope="col">{T.whyCols.status}</th></tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const r = idx.get(id)
              if (!r) {
                return (
                  <tr key={id}>
                    <td>{T.table.noRecord}<code className="rec-id">{id}</code></td><td>—</td><td>—</td><td>{S.info.no_reading}</td>
                  </tr>
                )
              }
              const d = describeRecord(r)
              const st = r.entity === 'personal_reference' ? null : infoStatusOf(data, id)
              return (
                <tr key={id}>
                  <td>{d.label}<code className="rec-id">{id}</code></td>
                  <td>{d.date}</td>
                  <td className="num">{d.value}</td>
                  <td>{st ? `${S.info[st.status]}${st.reasons.length ? ` (${reasonText(st.reasons)})` : ''}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {children}
      </div>
    </details>
  )
}
