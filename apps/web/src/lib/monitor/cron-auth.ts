import { timingSafeEqual } from 'node:crypto'

export const MAX_PER_RUN = 8
export const RECHECK_HOURS = 6
export const SAME_PLATFORM_DELAY_MS = 2500

/** "Authorization: Bearer <CRON_SECRET>" com comparação em tempo constante. */
export function isAuthorizedCron(authorization: string | null, secret: string): boolean {
  if (!secret || !authorization?.startsWith('Bearer ')) return false
  const given = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Imóveis verificados antes deste instante estão "na vez". */
export function dueCutoff(now: Date): string {
  return new Date(now.getTime() - RECHECK_HOURS * 3_600_000).toISOString()
}
