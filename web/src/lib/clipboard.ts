/**
 * Copy text to the clipboard
 *
 * The clipboard API only exists in secure contexts (HTTPS or localhost).
 * The hub is usually opened over plain HTTP in the LAN, so a hidden text
 * field with execCommand('copy') is the fallback there.
 */
export interface ClipboardEnv {
  clipboard?: { writeText(text: string): Promise<void> }
  isSecureContext: boolean
  document: Document
}

function browserEnv(): ClipboardEnv {
  return { clipboard: navigator.clipboard, isSecureContext: window.isSecureContext, document }
}

export async function copyText(text: string, env: ClipboardEnv = browserEnv()): Promise<boolean> {
  if (env.isSecureContext && env.clipboard) {
    try {
      await env.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied: try the fallback
    }
  }

  const textarea = env.document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  env.document.body.appendChild(textarea)
  try {
    textarea.select()
    // Deprecated, but the only way to copy without a secure context
    return env.document.execCommand('copy')
  } catch {
    return false
  } finally {
    env.document.body.removeChild(textarea)
  }
}
