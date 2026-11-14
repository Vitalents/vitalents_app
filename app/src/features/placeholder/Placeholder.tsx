import { S } from '../../content/strings'

export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
      </header>
      <p className="card pad muted">{text}</p>
    </div>
  )
}

export const RecordPage = () => <Placeholder title={S.nav.record.full} text={S.placeholder.record} />
export const SharePage = () => <Placeholder title={S.nav.share.full} text={S.placeholder.share} />
