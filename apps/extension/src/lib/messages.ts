export type ExternalMessage =
  | {
      type: 'connect'
      session: { accessToken: string; refreshToken: string; expiresAt: number; email: string }
      siteUrl: string
      supabaseUrl: string
      publishableKey: string
    }
  | { type: 'disconnect' }
  | { type: 'status' }

const isStr = (v: unknown, max = 4096): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/**
 * Valida mensagens vindas de páginas web (externally_connectable).
 * Só aceita o site configurado; a sessão precisa vir do mesmo site que a envia.
 */
export function validateExternalMessage(msg: unknown, senderOrigin: string | undefined, allowedOrigins: string[]): ExternalMessage | null {
  if (!senderOrigin || !allowedOrigins.includes(senderOrigin)) return null
  if (!msg || typeof msg !== 'object') return null
  const m = msg as Record<string, unknown>

  if (m.type === 'status' || m.type === 'disconnect') return { type: m.type }
  if (m.type !== 'connect') return null

  const s = m.session as Record<string, unknown> | undefined
  if (!s || !isStr(s.accessToken) || !isStr(s.refreshToken) || typeof s.expiresAt !== 'number' || typeof s.email !== 'string') return null
  if (!isStr(m.siteUrl, 300) || m.siteUrl !== senderOrigin) return null
  if (!isStr(m.supabaseUrl, 300) || !/^https:\/\/[a-z0-9.-]+$/i.test(m.supabaseUrl)) return null
  if (!isStr(m.publishableKey, 300)) return null

  return {
    type: 'connect',
    session: { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt, email: s.email.slice(0, 200) },
    siteUrl: m.siteUrl,
    supabaseUrl: m.supabaseUrl,
    publishableKey: m.publishableKey,
  }
}
