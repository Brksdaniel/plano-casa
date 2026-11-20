import type { ParsedListingUrl, Platform } from './types'

const TRACKING_PARAMS = new Set(['source', 'fbclid', 'gclid', 'ref'])

const DOMAINS: { platform: Platform; domain: string }[] = [
  { platform: 'zap', domain: 'zapimoveis.com.br' },
  { platform: 'vivareal', domain: 'vivareal.com.br' },
  { platform: 'chavesnamao', domain: 'chavesnamao.com.br' },
  { platform: 'quintoandar', domain: 'quintoandar.com.br' },
  { platform: 'olx', domain: 'olx.com.br' },
  { platform: 'imovelweb', domain: 'imovelweb.com.br' },
]

function detectPlatform(host: string): Platform {
  for (const { platform, domain } of DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return platform
  }
  return 'generic'
}

const ID_PATTERNS: Partial<Record<Platform, RegExp>> = {
  zap: /[-/]id-(\d+)/,
  vivareal: /[-/]id-(\d+)/,
  chavesnamao: /[-/]id-(\d+)/,
  quintoandar: /\/imovel\/(\d+)/,
  olx: /-(\d{6,})$/,
  imovelweb: /-(\d{6,})\.html$/,
}

export function parseListingUrl(
  input: string,
): { ok: true; value: ParsedListingUrl } | { ok: false; error: string } {
  const raw = input.trim()
  if (!raw) return { ok: false, error: 'Cole o link do anúncio.' }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'Isso não parece um link válido. Copie o endereço completo do anúncio (começa com https://).' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Use um link de página da web (http ou https).' }
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const platform = detectPlatform(host)
  const path = url.pathname.replace(/\/+$/, '')

  let query = ''
  if (platform === 'generic') {
    const kept = [...url.searchParams.entries()]
      .filter(([k]) => !k.toLowerCase().startsWith('utm_') && !TRACKING_PARAMS.has(k.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
    if (kept.length) query = `?${new URLSearchParams(kept).toString()}`
  }

  const pattern = ID_PATTERNS[platform]
  const externalId = pattern?.exec(path)?.[1]

  return { ok: true, value: { url, normalized: `${host}${path}${query}`, platform, ...(externalId ? { externalId } : {}) } }
}
