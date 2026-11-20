import { describe, expect, it, vi } from 'vitest'
import { type StoredSession, memoryStore, needsRefresh, refreshSession, withAuth } from './session'

const base: StoredSession = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: 1_000,
  email: 'eu@exemplo.com',
  siteUrl: 'https://web-two-pi-26.vercel.app',
  supabaseUrl: 'https://exemplo.supabase.co',
  publishableKey: 'sb_publishable_x',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('needsRefresh', () => {
  it('expira em 30 s → renovar', () => expect(needsRefresh({ ...base, expiresAt: 1_030 }, 1_000_000)).toBe(true))
  it('expira em 10 min → não', () => expect(needsRefresh({ ...base, expiresAt: 1_600 }, 1_000_000)).toBe(false))
})

describe('refreshSession', () => {
  it('troca os tokens', async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: 'new-a', refresh_token: 'new-r', expires_at: 9_999 }))
    const s = await refreshSession(base, fetchImpl)
    expect(s).toMatchObject({ accessToken: 'new-a', refreshToken: 'new-r', expiresAt: 9_999, email: base.email })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://exemplo.supabase.co/auth/v1/token?grant_type=refresh_token')
    expect((init.headers as Record<string, string>).apikey).toBe('sb_publishable_x')
  })
  it('400 → erro', async () => {
    await expect(refreshSession(base, async () => json({ error: 'invalid_grant' }, 400))).rejects.toThrow()
  })
})

describe('withAuth', () => {
  it('401 → renova uma vez e repete', async () => {
    const store = memoryStore({ ...base, expiresAt: 10_000_000_000 })
    const fetchImpl = vi.fn(async () => json({ access_token: 'new-a', refresh_token: 'new-r', expires_at: 10_000_000_000 }))
    const call = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const res = await withAuth(store, call, fetchImpl, 1_000_000)
    expect(res.status).toBe(200)
    expect(call.mock.calls.map((c) => c[0])).toEqual(['old-access', 'new-a'])
    expect((await store.get())?.accessToken).toBe('new-a')
  })

  it('renovação falha → limpa a sessão e marca reconectar', async () => {
    const store = memoryStore({ ...base, expiresAt: 0 })
    await expect(withAuth(store, vi.fn(), async () => json({}, 400), 1_000_000)).rejects.toThrow(/reconect/i)
    expect(await store.get()).toBeNull()
    expect(await store.needsReconnect()).toBe(true)
  })

  it('sem sessão → erro "não conectada"', async () => {
    await expect(withAuth(memoryStore(null), vi.fn(), vi.fn(), 0)).rejects.toThrow(/não conectada/i)
  })
})
