import type { ParsedListingUrl } from '@deniels/core'

export type TrackedItem = { id: string; normalized: string; platform: string; externalId: string | null; name: string }

/** O anúncio aberto é um dos acompanhados? Por link normalizado ou por (plataforma + código). */
export function matchTracked(parsed: ParsedListingUrl, items: TrackedItem[]): TrackedItem | null {
  return (
    items.find((i) => i.normalized === parsed.normalized) ??
    (parsed.externalId ? items.find((i) => i.platform === parsed.platform && i.externalId === parsed.externalId) : undefined) ??
    null
  )
}

export const TRACKED_TTL_MS = 30 * 60_000
