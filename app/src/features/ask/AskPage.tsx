// /ask: the onboard library and the question box (FR-AS-01..07).
import { LIBRARY } from '../../content/content'
import { Emblem } from '../../shell/Logo'
import { AskBox } from './AskBox'
import { S } from './strings'
import './ask.css'

export function AskPage() {
  const sources = [...LIBRARY.values()]
  const draft = sources.some((s) => !s.url)
  return (
    <div className="ask-page">
      <header className="ask-head">
        <Emblem size={72} />
        <div>
          <p className="eyebrow">{S.kicker}</p>
          <h1>{S.title}</h1>
        </div>
      </header>
      <p className="ask-intro">{S.intro}</p>

      <AskBox />

      <section className="ask-library" aria-labelledby="ask-lib-h">
        <h2 id="ask-lib-h">
          {S.library} <span className="ask-library__count">{sources.length} {S.sourcesCount}</span>
        </h2>
        {draft && <p className="ask-library__note">{S.libraryDraft}</p>}
        <ul>
          {sources.map((s) => (
            <li key={s.id}>
              <span className="ask-lib__title">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                    <span className="ask-sr"> {S.newTab}</span>
                  </a>
                ) : (
                  s.title
                )}
              </span>
              <span className="ask-lib__pub">{s.publisher}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default AskPage
