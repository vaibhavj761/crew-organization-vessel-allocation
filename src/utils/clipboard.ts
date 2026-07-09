export async function copyTextToClipboard(value: string): Promise<'clipboard' | 'fallback'> {
  if (!value) throw new Error('Nothing to copy.')

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return 'clipboard'
    } catch {
      // Fall back for browsers/origins that block Clipboard API with SecurityError.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Could not copy automatically. Please copy the text manually.')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const copied = document.execCommand?.('copy') ?? false
    if (!copied) throw new Error('Copy command unavailable.')
    return 'fallback'
  } catch {
    throw new Error('Could not copy automatically. Please copy the text manually.')
  } finally {
    textarea.remove()
  }
}
