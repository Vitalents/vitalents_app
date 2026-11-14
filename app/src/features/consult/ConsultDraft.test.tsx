// @vitest-environment jsdom
// FR-AS-09: the draft works without the assistant, is labelled, is editable, and an unsupported number
// is highlighted and blocks sending.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FAHIM, SECRET, loadS1WithPrivate } from '../../sync/testkit'
import { buildSummary } from '../sharing/summary'
import { templateSections } from './draft'
import { toConsultInput } from '../../assistant/consult'
import { ConsultDraft, type ConsultDraftState } from './ConsultDraft'
import { C } from './strings'

const summary = buildSummary(loadS1WithPrivate(), FAHIM, 'Should I change my exercise plan?')
afterEach(cleanup)

function setup(props: Partial<Parameters<typeof ConsultDraft>[0]> = {}) {
  const states: (ConsultDraftState | null)[] = []
  render(<ConsultDraft summary={summary} mode="cached" onChange={(s) => states.push(s)} {...props} />)
  return { states, last: () => states[states.length - 1] }
}
const draftNow = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: C.draft }))
  })
}

describe('ConsultDraft', () => {
  it('public mode: builds the five sections without the assistant, labelled, and never calls fetch', async () => {
    const fetchImpl = vi.fn()
    const { last } = setup({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(last()).toBeNull()
    await draftNow()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(screen.getByText(C.draftLabel)).toBeTruthy()
    expect(screen.getByText(C.withoutAssistant)).toBeTruthy()
    for (const title of Object.values(C.sections)) expect(screen.getByLabelText(title)).toBeTruthy()
    const s = last()!
    expect(s.sendable).toBe(true)
    expect(s.origin).toEqual({ kind: 'template', why: 'not_live' })
    expect(s.text).not.toContain(SECRET)
    expect(screen.getByText(C.allOk)).toBeTruthy()
  })

  it('editing in a number that is not in the record highlights it and blocks sending', async () => {
    const { last } = setup()
    await draftNow()
    const field = screen.getByLabelText(C.sections.context) as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: 'Back pain rated 8.5 of 10 after 45 minutes.' } })
    expect(last()!.sendable).toBe(false)
    expect(field.getAttribute('aria-invalid')).toBe('true')
    const marks = [...document.querySelectorAll('.cd-issue mark')].map((m) => m.textContent)
    expect(marks).toEqual(expect.arrayContaining(['8.5', '45']))
    expect(document.querySelectorAll('.cd-layer mark').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(C.blockedSend(1))).toBeTruthy()
    // the edit is what goes in the package
    expect(last()!.text).toContain('Back pain rated 8.5 of 10')
    fireEvent.change(field, { target: { value: 'Mild back pain after exercise.' } })
    expect(last()!.sendable).toBe(true)
  })

  it('an empty section blocks sending', async () => {
    const { last } = setup()
    await draftNow()
    fireEvent.change(screen.getByLabelText(C.sections.trend), { target: { value: '  ' } })
    expect(last()!.sendable).toBe(false)
  })

  it('live mode uses the assistant draft, with the crew question verbatim', async () => {
    const model = { ...templateSections(toConsultInput(summary)), trend: 'Decode correct answers: 37 vs 41-44.', crew_question: 'rewritten' }
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'drafted', sections: model, model: 'gpt-oss:20b', unsupported_numbers: [] }) }))
    const { last } = setup({ mode: 'live', fetchImpl: fetchImpl as unknown as typeof fetch })
    await draftNow()
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(screen.getByText(C.byAssistant('gpt-oss:20b'))).toBeTruthy()
    expect((screen.getByLabelText(C.sections.trend) as HTMLTextAreaElement).value).toBe('Decode correct answers: 37 vs 41-44.')
    expect((screen.getByLabelText(C.sections.crew_question) as HTMLTextAreaElement).value).toBe('Should I change my exercise plan?')
    expect(last()!.origin).toEqual({ kind: 'assistant', model: 'gpt-oss:20b' })
  })

  it('live mode with the service down falls back to the record, and says so', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    setup({ mode: 'live', fetchImpl: fetchImpl as unknown as typeof fetch })
    await draftNow()
    expect(screen.getByText(C.withoutAssistant)).toBeTruthy()
    expect(screen.getByText(C.notice.unavailable)).toBeTruthy()
  })

  it('a blocked assistant draft is set aside, never shown', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'blocked', sections: null, unsupported_numbers: ['9.5'], model: 'm' }) }))
    setup({ mode: 'live', fetchImpl: fetchImpl as unknown as typeof fetch })
    await draftNow()
    expect(screen.getByText(C.notice.blocked)).toBeTruthy()
    expect(document.body.textContent).not.toContain('9.5')
  })

  it('removing the note reports null', async () => {
    const { last } = setup()
    await draftNow()
    fireEvent.click(screen.getByRole('button', { name: C.remove }))
    expect(last()).toBeNull()
    expect(screen.getByText(C.removed)).toBeTruthy()
  })
})
