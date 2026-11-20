/** Leitura de HTML sem DOM (funciona no servidor e na extensão). */

export type JsonLdNode = Record<string, unknown>

export function readJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = []
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== 'object') return
    const node = value as JsonLdNode
    if (Array.isArray(node['@graph'])) {
      ;(node['@graph'] as unknown[]).forEach(visit)
      const { '@graph': _graph, ...rest } = node
      if (rest['@type']) nodes.push(rest)
      return
    }
    nodes.push(node)
  }

  for (const match of html.matchAll(re)) {
    try {
      visit(JSON.parse((match[1] ?? '').trim()))
    } catch {
      // JSON inválido: ignora o bloco
    }
  }
  return nodes
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? (m[2] ?? m[3]) : undefined
}

/** Metadados: og:*, description, twitter:* e o <title>. */
export function readMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const key = (attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase()
    const content = attr(tag, 'content')
    if (key && content !== undefined && !(key in meta)) meta[key] = decodeEntities(content).trim()
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  if (title) meta.title = decodeEntities(title).replace(/\s+/g, ' ').trim()
  return meta
}

/**
 * Página de bloqueio/desafio anti-robô (Cloudflare etc.).
 * Atenção: páginas NORMAIS protegidas pelo Cloudflare também carregam
 * "/cdn-cgi/challenge-platform/" e formulários com reCAPTCHA — isso não conta.
 */
export function looksLikeChallenge(html: string, status?: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''
  if (/just a moment|attention required|um momento|access denied|acesso negado/i.test(title)) return true
  return /cf_chl_opt|cf-chl-widget|id="challenge-form"/i.test(html)
}
