import type { ParsedListingUrl, Platform } from '../types'
import { extractChavesNaMao } from './chavesnamao'
import { extractGeneric } from './generic'
import { extractZap } from './zap'
import { extractFromSlug } from './slug'
import { type Extraction, FIELD_KEYS, emptyExtraction } from './types'

const SLUG_PLATFORMS = new Set<Platform>(['zap', 'vivareal', 'olx', 'imovelweb'])

/** O que dá para saber só pelo link, sem abrir a página. */
export function extractFromUrlOnly(parsed: ParsedListingUrl): Extraction {
  return SLUG_PLATFORMS.has(parsed.platform) ? extractFromSlug(parsed) : emptyExtraction(parsed, 'other')
}

/** Lê uma página já baixada e completa com o link só os campos que a página não trouxe. */
export function extractFromPage(html: string, parsed: ParsedListingUrl, status: number): Extraction {
  const page =
    parsed.platform === 'chavesnamao'
      ? extractChavesNaMao(html, parsed, status)
      : parsed.platform === 'zap' || parsed.platform === 'vivareal'
        ? extractZap(html, parsed, status)
        : extractGeneric(html, parsed, status)
  if (page.pageKind !== 'listing') return page

  const fromUrl = extractFromUrlOnly(parsed)
  for (const key of FIELD_KEYS) {
    if (page.fields[key] === undefined && fromUrl.fields[key] !== undefined) {
      page.fields[key] = fromUrl.fields[key]
      page.methods[key] = fromUrl.methods[key]
    }
  }
  return page
}
