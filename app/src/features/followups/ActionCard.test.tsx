// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixtures/S1.json'
import { ENTITY_NAMES, type Action, type FollowUp } from '../../data/contract'
import { useRole } from '../../store/role'
import { useStore, type Data } from '../../store/store'
import { ActionCard, type ActionWrites } from './ActionCard'
import { FollowUpList } from './FollowUpList'
import type { LaterReading } from './records'

const watch = fixture.action.find((a) => a.action_id === 'sim:action:dec-d25') as Action
const followUp = fixture.follow_up.find((f) => f.action_id === watch.action_id) as FollowUp
const DONE = '2026-11-14T08:30:00Z'
const REVIEW = '2026-11-15T10:00:00Z'
afterEach(() => { cleanup(); useRole.setState({ role: 'astronaut' }) })

describe('FR-FU-04/06 follow-up controls', () => {
  it('offers a later review after Mark done, then an explicit close with reason', async () => {
    let current = DONE
    let next: LaterReading = null
    const writes: ActionWrites[] = []
    const onWrite = vi.fn(async (w: ActionWrites) => { writes.push(w) })
    const props = { role: 'astronaut' as const, onWrite, now: () => current, laterReading: () => next }
    const view = render(<ActionCard {...props} action={watch} followUp={followUp} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledTimes(1))
    const waiting = writes[0]
    expect(waiting.action?.execution_status).toBe('awaiting_impact_review')
    view.rerender(<ActionCard {...props} action={waiting.action!} followUp={waiting.follow_up!} />)
    expect((screen.getByRole('button', { name: 'Record review of this observation' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Close follow-up' })).toBeNull()

    current = REVIEW
    next = { position: 'within', record_id: 'sim:decode_session:later', reference_id: 'sim:personal_reference:retained' }
    view.rerender(<ActionCard {...props} action={waiting.action!} followUp={waiting.follow_up!} />)
    expect(onWrite).toHaveBeenCalledTimes(1) // a new reading never closes or changes the step automatically
    expect((screen.getByRole('button', { name: 'Record review of this observation' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Record review of this observation' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledTimes(2))
    const reviewed = writes[1]
    expect(reviewed.action?.execution_status).toBe('completed')
    expect(reviewed.action?.completed_at_utc).toBe(DONE)
    expect(reviewed.follow_up?.followup_status).toBe('watching')
    view.rerender(<ActionCard {...props} action={reviewed.action!} followUp={reviewed.follow_up!} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close follow-up' }))
    fireEvent.change(screen.getByLabelText('Why are you closing it?'), { target: { value: 'Reviewed the later observation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close follow-up' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledTimes(3))
    expect(writes[2].follow_up?.followup_status).toBe('closed')
    expect(writes[2].follow_up?.closing_reason).toBe('Reviewed the later observation')
  })

  it('reads the selected Planner role even when no role prop is supplied', () => {
    const data = Object.fromEntries(ENTITY_NAMES.map((e) => [e, (fixture as Record<string, unknown>)[e] ?? []])) as Data
    useStore.setState({ data })
    useRole.setState({ role: 'planner' })
    render(<FollowUpList now={() => DONE} />)
    expect(screen.queryByText(watch.action_text)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
    expect(screen.getByText('Operational requests only. Health records are not shared with this role.')).toBeTruthy()
  })
})
