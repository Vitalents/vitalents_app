// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpDialog } from './Dialogs'
import { S } from '../content/strings'

afterEach(cleanup)

describe('modal focus', () => {
  it('focuses the first field, wraps Tab in both directions, and restores the opener', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const onClose = vi.fn()
    const view = render(<HelpDialog onClose={onClose} />)
    const first = screen.getByRole('textbox')
    const last = screen.getByRole('button', { name: S.help.submit })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    opener.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    view.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('does not reset focus when a parent changes the close callback, and uses its latest callback', () => {
    const initial = vi.fn()
    const latest = vi.fn()
    const view = render(<HelpDialog onClose={initial} />)
    const cancel = screen.getByRole('button', { name: S.help.cancel })
    cancel.focus()
    view.rerender(<HelpDialog onClose={latest} />)
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Escape' })
    expect(initial).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
  })
})
