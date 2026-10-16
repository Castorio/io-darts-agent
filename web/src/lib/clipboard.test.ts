import { describe, it, expect, vi } from 'vitest'
import { copyText } from './clipboard'

function fakeDocument(execResult: boolean) {
  const textarea = { value: '', style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn() }
  return {
    textarea,
    doc: {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand: vi.fn(() => execResult),
    },
  }
}

describe('copyText', () => {
  it('uses the clipboard API when the page is a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { doc } = fakeDocument(true)

    expect(await copyText('http://x/a.webm', { clipboard: { writeText }, isSecureContext: true, document: doc as never })).toBe(true)
    expect(writeText).toHaveBeenCalledWith('http://x/a.webm')
    expect(doc.execCommand).not.toHaveBeenCalled()
  })

  it('falls back to a hidden text field over plain HTTP in the LAN', async () => {
    const { doc, textarea } = fakeDocument(true)

    expect(await copyText('http://x/a.webm', { clipboard: undefined, isSecureContext: false, document: doc as never })).toBe(true)
    expect(textarea.value).toBe('http://x/a.webm')
    expect(doc.execCommand).toHaveBeenCalledWith('copy')
    expect(doc.body.removeChild).toHaveBeenCalledWith(textarea)
  })

  it('reports failure when the browser refuses both ways', async () => {
    const { doc } = fakeDocument(false)

    expect(await copyText('x', { clipboard: undefined, isSecureContext: false, document: doc as never })).toBe(false)
  })
})
