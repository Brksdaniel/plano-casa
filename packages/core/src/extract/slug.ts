import type { ParsedListingUrl } from '../types'
import { type Extraction, emptyExtraction, setField } from './types'

export const KNOWN_CITIES: { slug: string; name: string; uf: string }[] = [
  { slug: 'sao-jose-dos-pinhais', name: 'São José dos Pinhais', uf: 'pr' },
  { slug: 'curitiba', name: 'Curitiba', uf: 'pr' },
]

/**
 * Lê o que o próprio link informa (ZAP, Viva Real...). Nada é buscado na internet.
 * Bairro não é extraído: as palavras de característica variam e o palpite seria inseguro.
 */
export function extractFromSlug(parsed: ParsedListingUrl): Extraction {
  const e = emptyExtraction(parsed, 'other')
  const slug = decodeURIComponent(parsed.url.pathname).toLowerCase()

  const bedrooms = /(?:^|[-/])(\d{1,2})-quartos?(?:[-/]|$)/.exec(slug)?.[1]
  if (bedrooms) setField(e, 'bedrooms', Number.parseInt(bedrooms, 10), 'slug')

  const area = /(?:^|[-/])(\d{2,4})m2(?:[-/]|$)/.exec(slug)?.[1]
  if (area) setField(e, 'areaM2', Number.parseInt(area, 10), 'slug')

  for (const city of KNOWN_CITIES) {
    if (new RegExp(`-${city.slug}-${city.uf}(?:[-/]|$)`).test(slug)) {
      setField(e, 'city', city.name, 'slug')
      break
    }
  }
  return e
}
