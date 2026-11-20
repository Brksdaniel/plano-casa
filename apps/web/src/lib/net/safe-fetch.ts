import 'server-only'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

function ipv4Private(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = p as [number, number, number, number]
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

/** Endereços internos/reservados que o servidor nunca deve acessar (proteção SSRF). */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return ipv4Private(ip)
  if (kind !== 6) return true
  const v6 = ip.toLowerCase()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)?.[1]
  if (mapped) return ipv4Private(mapped)
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff')
}

export type SafeFetchResult =
  | { ok: true; status: number; html: string; finalUrl: string }
  | { ok: false; reason: 'invalid_url' | 'blocked_address' | 'timeout' | 'too_large' | 'network' }

type Options = {
  timeoutMs?: number
  maxBytes?: number
  lookup?: (host: string) => Promise<string[]>
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
}

async function defaultLookup(host: string): Promise<string[]> {
  const results = await dnsLookup(host, { all: true, verbatim: true })
  return results.map((r) => r.address)
}

async function isAllowedHost(url: URL, lookup: (host: string) => Promise<string[]>): Promise<boolean> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return !isPrivateAddress(host)
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  const addresses = await lookup(host)
  return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a))
}

async function readLimited(res: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) return null
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks))
}

/**
 * Baixa o HTML de uma página pública com proteções:
 * só http(s), nunca IP interno (inclusive após redirect), até 3 redirects, timeout e limite de tamanho.
 * Devolve também respostas 4xx/5xx — quem decide o que significam é o core (desafio ≠ alugado).
 */
export async function safeFetchHtml(rawUrl: string, opts: Options = {}): Promise<SafeFetchResult> {
  const { timeoutMs = 15_000, maxBytes = 3 * 1024 * 1024, lookup = defaultLookup, fetchImpl = fetch } = opts

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    for (let hop = 0; hop <= 3; hop++) {
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'invalid_url' }
      if (!(await isAllowedHost(url, lookup))) return { ok: false, reason: 'blocked_address' }

      const res = await fetchImpl(url.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      })

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = new URL(res.headers.get('location') as string, url)
        continue
      }

      const html = await readLimited(res, maxBytes)
      if (html === null) return { ok: false, reason: 'too_large' }
      return { ok: true, status: res.status, html, finalUrl: url.toString() }
    }
    return { ok: false, reason: 'network' }
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return { ok: false, reason: 'timeout' }
    }
    return { ok: false, reason: 'network' }
  } finally {
    clearTimeout(timer)
  }
}
