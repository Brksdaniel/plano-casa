/** Mensagens que o site envia para a extensão (via externally_connectable). */
export type BridgeMessage =
  | {
      type: 'connect'
      session: { accessToken: string; refreshToken: string; expiresAt: number; email: string }
      siteUrl: string
      supabaseUrl: string
      publishableKey: string
    }
  | { type: 'disconnect' }
  | { type: 'status' }

export type BridgeReply = { ok: boolean; connected?: boolean; email?: string; error?: string }

type ChromeRuntime = {
  lastError?: { message?: string }
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
}

const TIMEOUT_MS = 3000

/** Fala com a extensão instalada no Chrome. Sem extensão (ou sem Chrome) → not_installed. */
export function sendToExtension(extensionId: string, message: BridgeMessage): Promise<BridgeReply> {
  const runtime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
  if (!runtime?.sendMessage || !extensionId) return Promise.resolve({ ok: false, error: 'not_installed' })

  return new Promise((resolve) => {
    let done = false
    const finish = (r: BridgeReply) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(r)
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), TIMEOUT_MS)
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        if (runtime.lastError || !response) return finish({ ok: false, error: 'not_installed' })
        finish(response as BridgeReply)
      })
    } catch {
      finish({ ok: false, error: 'not_installed' })
    }
  })
}
