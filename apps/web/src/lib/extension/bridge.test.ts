import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendToExtension } from './bridge'

const g = globalThis as unknown as { chrome?: unknown }
afterEach(() => {
  delete g.chrome
  vi.useRealTimers()
})

describe('sendToExtension', () => {
  it('sem chrome.runtime → not_installed', async () => {
    expect(await sendToExtension('abc', { type: 'status' })).toEqual({ ok: false, error: 'not_installed' })
  })

  it('lastError (extensão ausente) → not_installed', async () => {
    g.chrome = {
      runtime: {
        lastError: undefined as unknown,
        sendMessage(_id: string, _msg: unknown, cb: (r: unknown) => void) {
          ;(g.chrome as { runtime: { lastError: unknown } }).runtime.lastError = { message: 'Could not establish connection' }
          cb(undefined)
        },
      },
    }
    expect(await sendToExtension('abc', { type: 'status' })).toEqual({ ok: false, error: 'not_installed' })
  })

  it('repassa a resposta da extensão', async () => {
    g.chrome = { runtime: { sendMessage: (_id: string, _m: unknown, cb: (r: unknown) => void) => cb({ ok: true, connected: true, email: 'a@b.c' }) } }
    expect(await sendToExtension('abc', { type: 'status' })).toEqual({ ok: true, connected: true, email: 'a@b.c' })
  })

  it('sem resposta em 3 s → timeout', async () => {
    vi.useFakeTimers()
    g.chrome = { runtime: { sendMessage: () => {} } }
    const p = sendToExtension('abc', { type: 'status' })
    vi.advanceTimersByTime(3100)
    expect(await p).toEqual({ ok: false, error: 'timeout' })
  })
})
