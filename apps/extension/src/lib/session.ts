/** Sessão do Supabase entregue pelo site (botão "Conectar extensão"). */
export type StoredSession = {
  accessToken: string
  refreshToken: string
  /** Segundos desde a época (formato do Supabase). */
  expiresAt: number
  email: string
  siteUrl: string
  supabaseUrl: string
  publishableKey: string
}

export interface SessionStore {
  get(): Promise<StoredSession | null>
  set(s: StoredSession): Promise<void>
  clear(): Promise<void>
  needsReconnect(): Promise<boolean>
  setNeedsReconnect(v: boolean): Promise<void>
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** Renova quando faltar menos de 60 s para expirar. */
export function needsRefresh(s: StoredSession, nowMs: number): boolean {
  return s.expiresAt * 1000 - nowMs < 60_000
}

export async function refreshSession(s: StoredSession, fetchImpl: FetchLike): Promise<StoredSession> {
  const res = await fetchImpl(`${s.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: s.publishableKey },
    body: JSON.stringify({ refresh_token: s.refreshToken }),
  })
  if (!res.ok) throw new Error(`Falha ao renovar a sessão (${res.status})`)
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_at?: number; user?: { email?: string } }
  if (!body.access_token || !body.refresh_token || !body.expires_at) throw new Error('Resposta de renovação inválida')
  return { ...s, accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: body.expires_at, email: body.user?.email ?? s.email }
}

async function renewOrDisconnect(store: SessionStore, s: StoredSession, fetchImpl: FetchLike): Promise<StoredSession> {
  try {
    const renewed = await refreshSession(s, fetchImpl)
    await store.set(renewed)
    return renewed
  } catch {
    await store.clear()
    await store.setNeedsReconnect(true)
    throw new Error('Sessão expirada: reconecte a extensão pelo site (Configurações).')
  }
}

/** Executa uma chamada autenticada: renova antes se preciso e, em 401, renova uma vez e repete. */
export async function withAuth(
  store: SessionStore,
  call: (accessToken: string, session: StoredSession) => Promise<Response>,
  fetchImpl: FetchLike,
  nowMs: number = Date.now(),
): Promise<Response> {
  let s = await store.get()
  if (!s) throw new Error('Extensão não conectada.')
  if (needsRefresh(s, nowMs)) s = await renewOrDisconnect(store, s, fetchImpl)

  const res = await call(s.accessToken, s)
  if (res.status !== 401) return res
  s = await renewOrDisconnect(store, s, fetchImpl)
  return call(s.accessToken, s)
}

export function memoryStore(initial: StoredSession | null): SessionStore {
  let session = initial
  let reconnect = false
  return {
    get: async () => session,
    set: async (s) => {
      session = s
      reconnect = false
    },
    clear: async () => {
      session = null
    },
    needsReconnect: async () => reconnect,
    setNeedsReconnect: async (v) => {
      reconnect = v
    },
  }
}

/** Armazenamento real da extensão (chrome.storage.local). */
export function chromeStore(): SessionStore {
  const KEY = 'session'
  const FLAG = 'needsReconnect'
  return {
    get: async () => ((await chrome.storage.local.get(KEY))[KEY] as StoredSession | undefined) ?? null,
    set: async (s) => chrome.storage.local.set({ [KEY]: s, [FLAG]: false }),
    clear: async () => chrome.storage.local.remove(KEY),
    needsReconnect: async () => Boolean((await chrome.storage.local.get(FLAG))[FLAG]),
    setNeedsReconnect: async (v) => chrome.storage.local.set({ [FLAG]: v }),
  }
}
