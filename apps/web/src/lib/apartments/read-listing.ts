import 'server-only'
import {
  type Extraction,
  type ParsedListingUrl,
  SERVER_FETCH_ALLOWED,
  extractFromPage,
  extractFromUrlOnly,
  parseListingUrl,
} from '@deniels/core'
import { safeFetchHtml } from '@/lib/net/safe-fetch'
import type { FetchOutcome } from './build-insert'

export type ListingRead =
  | { ok: true; parsed: ParsedListingUrl; extraction: Extraction; fetch: FetchOutcome; httpStatus?: number }
  | { ok: false; error: string }

/**
 * Lê um anúncio: valida o link, busca a página só se a plataforma permitir
 * e extrai os dados. Nunca inventa: o que não foi lido fica de fora.
 */
export async function readListing(input: string): Promise<ListingRead> {
  const parsedResult = parseListingUrl(input)
  if (!parsedResult.ok) return { ok: false, error: parsedResult.error }
  const parsed = parsedResult.value

  if (!SERVER_FETCH_ALLOWED[parsed.platform]) {
    return { ok: true, parsed, extraction: extractFromUrlOnly(parsed), fetch: 'not_allowed' }
  }

  const res = await safeFetchHtml(parsed.url.toString())
  if (!res.ok) {
    if (res.reason === 'blocked_address' || res.reason === 'invalid_url') {
      return { ok: false, error: 'Este endereço não pode ser acessado. Use o link público do anúncio.' }
    }
    return { ok: true, parsed, extraction: extractFromUrlOnly(parsed), fetch: 'failed' }
  }

  return { ok: true, parsed, extraction: extractFromPage(res.html, parsed, res.status), fetch: 'fetched', httpStatus: res.status }
}
