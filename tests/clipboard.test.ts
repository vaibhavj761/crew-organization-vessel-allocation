import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from '../src/utils/clipboard'

function setClipboard(writeText: ((value: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

function setExecCommand(result: boolean) {
  const execCommand = vi.fn().mockReturnValue(result)
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  })
  return execCommand
}

describe('clipboard helper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setClipboard(undefined)
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    await expect(copyTextToClipboard('setup-link')).resolves.toBe('clipboard')
    expect(writeText).toHaveBeenCalledWith('setup-link')
  })

  it('falls back when Clipboard API is blocked by browser security', async () => {
    setClipboard(vi.fn().mockRejectedValue(new DOMException('Blocked', 'SecurityError')))
    const execCommand = setExecCommand(true)

    await expect(copyTextToClipboard('setup-link')).resolves.toBe('fallback')
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns a user-safe error when automatic copy is unavailable', async () => {
    setClipboard(vi.fn().mockRejectedValue(new DOMException('Blocked', 'SecurityError')))
    setExecCommand(false)

    await expect(copyTextToClipboard('setup-link')).rejects.toThrow('Could not copy automatically')
  })
})
