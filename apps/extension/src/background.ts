import { type Extraction, parseListingUrl } from '@deniels/core'
import { DEFAULT_SITE, SITE_ORIGINS } from './config'
import { validateExternalMessage } from './lib/messages'
import { chromeStore, withAuth } from './lib/session'
import { TRACKED_TTL_MS, type TrackedItem, matchTracked } from './lib/tracked'

const store = chromeStore()

export type PageMessage = { type: 'page'; url: string; httpStatus: number; extraction: Extraction }
export type PageReply =
  | { badge: 'connect'; siteUrl: string }
  | { badge: 'add'; addUrl: string }
  | { badge: 'synced'; result: string; changes: number; name: string; detailUrl: string }
  | { badge: 'error'; message: string }
  | { badge: 'none' }

// ---- Site → extensão (Conectar / Desconectar / Status) ----
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const m = validateExternalMessage(msg, sender.origin, SITE_ORIGINS)
  if (!m) {
    sendResponse({ ok: false, error: 'invalid' })
    return false
  }
  void (async () => {
    if (m.type === 'connect') {
      await store.set({ ...m.session, siteUrl: m.siteUrl, supabaseUrl: m.supabaseUrl, publishableKey: m.publishableKey })
      await chrome.storage.local.remove('tracked')
      sendResponse({ ok: true, connected: true, email: m.session.email })
    } else if (m.type === 'disconnect') {
      await store.clear()
      await chrome.storage.local.remove('tracked')
      sendResponse({ ok: true, connected: false })
    } else {
      const s = await store.get()
      sendResponse({ ok: true, connected: Boolean(s), email: s?.email })
    }
  })()
  return true
})

async function trackedItems(force = false): Promise<TrackedItem[]> {
  const cached = (await chrome.storage.local.get('tracked')).tracked as { at: number; items: TrackedItem[] } | undefined
  if (!force && cached && Date.now() - cached.at < TRACKED_TTL_MS) return cached.items
  const res = await withAuth(store, (token, s) => fetch(`${s.siteUrl}/api/extension/tracked`, { headers: { Authorization: `Bearer ${token}` } }), fetch)
  if (!res.ok) throw new Error(`Falha ao carregar a lista (${res.status})`)
  const { items } = (await res.json()) as { items: TrackedItem[] }
  await chrome.storage.local.set({ tracked: { at: Date.now(), items } })
  return items
}

async function handlePage(msg: PageMessage): Promise<PageReply> {
  const session = await store.get()
  if (!session) return { badge: 'connect', siteUrl: DEFAULT_SITE }

  const parsed = parseListingUrl(msg.url)
  if (!parsed.ok) return { badge: 'none' }

  let match = matchTracked(parsed.value, await trackedItems())
  // Pode ter sido cadastrado há pouco: recarrega a lista uma vez antes de oferecer "Adicionar".
  if (!match) match = matchTracked(parsed.value, await trackedItems(true))
  if (!match) return { badge: 'add', addUrl: `${session.siteUrl}/apartamentos/novo?url=${encodeURIComponent(msg.url)}` }

  const res = await withAuth(
    store,
    (token, s) =>
      fetch(`${s.siteUrl}/api/extension/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: msg.url, httpStatus: msg.httpStatus, extraction: msg.extraction }),
      }),
    fetch,
  )
  if (!res.ok) return { badge: 'error', message: `O site respondeu ${res.status}.` }
  const body = (await res.json()) as { result: string; changes: number }
  return { badge: 'synced', result: body.result, changes: body.changes, name: match.name, detailUrl: `${session.siteUrl}/apartamentos/${match.id}` }
}

// ---- Página do anúncio → extensão ----
chrome.runtime.onMessage.addListener((msg: PageMessage, sender, sendResponse) => {
  if (msg?.type !== 'page' || !sender.tab) return false
  handlePage(msg)
    .then(sendResponse)
    .catch((e: unknown) => sendResponse({ badge: 'error', message: e instanceof Error ? e.message : 'Erro inesperado.' }))
  return true
})
