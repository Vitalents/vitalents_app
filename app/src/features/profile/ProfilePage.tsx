// FR-SH-04: read-only mission profile (DR-16, contract subject_profile + mission_schedule).
// Nothing here can be edited. Data comes through the role filter in the data layer (CLAUDE.md rule 12).
// TODO(question: DR-16 lists `sharing_policy`, `reminders[]` and `sources[]`, but subject_profile in contracts/ has no such fields; add them to the contract before this screen shows them)
import domainsJson from '../../../../content/domains.json'
import { DOMAINS } from '../../content/content'
import type { MissionSchedule, SubjectProfile } from '../../data/contract'
import { formatDate, missionDay } from '../../engine/mission'
import { useReviewDate, useSubject } from '../../store/selectors'
import { useVisibleData } from '../roles/hooks'
import { P } from './strings'
import './profile.css'

const label = (map: Record<string, string>, v: string | null | undefined) => (v == null ? P.notSet : map[v] ?? v)
const realmOf = (id: string) => id.split(':')[0]
const hm = (iso: string) => iso.slice(11, 16)

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ScheduleItem({ it }: { it: MissionSchedule }) {
  const crosses = it.end_at.slice(0, 10) > it.mission_day
  const kind = it.item_kind === 'rest_window' ? 'rest' : it.is_fixed ? 'fixed' : 'movable'
  const move = it.is_fixed ? 'fixed' : 'movable'
  const earliest = it.movable_earliest_start ?? null
  const latest = it.movable_latest_end ?? null
  return (
    <li className={`pf-item pf-${kind}`}>
      <p className="pf-time num">
        {hm(it.start_at)}–{hm(it.end_at)}
        <span className="pf-utc"> {P.utc}</span>
        {crosses && <span className="pf-next">{P.nextDay}</span>}
      </p>
      <div className="pf-what">
        <p className="pf-label">{it.activity_label}</p>
        <p className="pf-meta">
          {kind === 'rest' && it.activity_label !== P.restWindow && <span className="pf-tag pf-tag-rest">{P.restWindow}</span>}
          <span className={`pf-tag pf-tag-${move}`}>{move === 'fixed' ? P.fixed : P.movable}</span>
          {move === 'movable' && (
            <span className="muted">{earliest && latest ? `${P.window(hm(earliest), hm(latest))} ${P.utc}` : P.windowUnknown}</span>
          )}
          {move === 'movable' && <span className="muted">{P.approval(label(P.role, it.approval_role))}</span>}
        </p>
      </div>
    </li>
  )
}

export function ProfileView({ profile, schedule, date }: { profile: SubjectProfile; schedule: MissionSchedule[]; date: string }) {
  const today = schedule
    .filter((s) => s.subject_id === profile.subject_profile_id && s.mission_day === date)
    .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.end_at.localeCompare(b.end_at))
  const clocks = [...new Set(today.map((s) => s.clock_reference))]
  const lang = profile.preferred_language
  return (
    <div className="page profile">
      <header className="page-head">
        <p className="eyebrow">{profile.crew_label ?? P.notSet}</p>
        <h1>{P.title}</h1>
        <p className="muted">{P.lead}</p>
      </header>

      <div className="callout pf-sim" role="note">
        <p><strong>{P.simulated}.</strong> {P.simulatedText}</p>
        <p className="muted small">{P.readOnly}</p>
      </div>

      <div className="pf-grid">
        <section className="card pad pf-facts" aria-labelledby="pf-mission">
          <h2 id="pf-mission">{P.missionTitle}</h2>
          <p className="pf-day">
            <span className="pf-day-n num">{P.day(missionDay(date))}</span>
            <span className="muted">{formatDate(date)}</span>
          </p>
          <dl className="facts pf-dl">
            <Fact k={P.f.phase}>{label(P.phase, profile.mission_phase)}</Fact>
            <Fact k={P.f.timezone}>{label(P.timezone, profile.timezone_basis)}</Fact>
            <Fact k={P.f.version}>{profile.mission_profile_version ?? P.notSet}</Fact>
            <Fact k={P.f.language}>{lang == null ? P.notSet : P.language[lang] ? `${P.language[lang]} (${lang})` : lang}</Fact>
          </dl>

          <h2 className="pf-sub">{P.identityTitle}</h2>
          <dl className="facts pf-dl">
            <Fact k={P.f.crew}>{profile.crew_label ?? P.notSet}</Fact>
            <Fact k={P.f.mode}>{label(P.mode, profile.subject_mode)}</Fact>
            <Fact k={P.f.origin}>{label(P.origin, profile.data_origin)}</Fact>
            <Fact k={P.f.realm}>{label(P.realm, realmOf(profile.subject_profile_id))}</Fact>
            <Fact k={P.f.id}><code>{profile.subject_profile_id}</code></Fact>
            <Fact k={P.f.schema}>{profile.schema_version}</Fact>
            {profile.profile_source_uri && (
              <Fact k={P.f.source}><a href={profile.profile_source_uri} target="_blank" rel="noreferrer">{profile.profile_source_uri}</a></Fact>
            )}
          </dl>
        </section>

        <section className="card pad pf-schedule" aria-labelledby="pf-schedule">
          <h2 id="pf-schedule">{P.scheduleTitle}</h2>
          <p className="muted small">{P.scheduleLead}{clocks.length > 0 && ` ${P.clock(clocks.join(', '))}.`}</p>
          {today.length === 0 ? (
            <p className="muted">{P.scheduleEmpty}</p>
          ) : (
            <ol className="pf-list">{today.map((it) => <ScheduleItem key={it.mission_schedule_id} it={it} />)}</ol>
          )}
        </section>

        <section className="card pad pf-plan" aria-labelledby="pf-plan">
          <h2 id="pf-plan">{P.planTitle}</h2>
          <p className="muted small">{P.planLead}</p>
          <ul className="pf-plan-list">
            {DOMAINS.map((d) => (
              <li key={d.id}>
                <span className="pf-plan-domain">{d.name}</span>
                {d.live && d.indicators.length > 0 ? (
                  <ul className="pf-ind">
                    {d.indicators.map((i) => (
                      <li key={i.id}>
                        <span>{i.name}</span>
                        <span className="pf-freq">{i.frequency ? P.freq[i.frequency] ?? i.frequency : P.freqUnknown}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted small">{P.sample}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="muted small pf-source">{P.planSource(String(domainsJson.content_version).replace(/-draft$/, ''))}</p>
        </section>
      </div>
    </div>
  )
}

/** Route /profile. */
export function ProfilePage() {
  const subject = useSubject()
  const date = useReviewDate()
  const data = useVisibleData(subject?.subject_profile_id ?? '')
  const profile = subject ? data.subject_profile.find((p) => p.subject_profile_id === subject.subject_profile_id) ?? null : null
  if (!profile) return <p className="card pad muted">{P.noProfile}</p>
  return <ProfileView profile={profile} schedule={data.mission_schedule} date={date} />
}
