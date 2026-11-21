import { looksLikeChallenge, readJsonLd, readMeta } from '../html'
import { parseBRL } from '../money'
import type { ParsedListingUrl } from '../types'
import { availabilityName, images, obj, str, typeIs } from './jsonld-utils'
import { type Extraction, emptyExtraction, setField } from './types'

/** Base comum para qualquer página: status, desafio e "não encontrado". */
export function pageGuard(html: string, parsed: ParsedListingUrl, status: number): Extraction | null {
  if (status === 404 || status === 410) return emptyExtraction(parsed, 'not_found')
  if (looksLikeChallenge(html, status)) return emptyExtraction(parsed, 'challenge')
  if (status >= 400) return emptyExtraction(parsed, 'other')
  return null
}

/**
 * Leitor genérico: Schema.org (Offer/Product) + Open Graph.
 * Nunca afirma "indisponível" — sem conhecer o site, isso seria palpite.
 */
export function extractGeneric(html: string, parsed: ParsedListingUrl, status: number): Extraction {
  const guarded = pageGuard(html, parsed, status)
  if (guarded) return guarded

  const e = emptyExtraction(parsed, 'listing')
  const nodes = readJsonLd(html)
  const meta = readMeta(html)

  const offer = nodes.find((n) => typeIs(n, 'Offer')) ?? nodes.map((n) => obj(n.offers)).find(Boolean)
  const product = nodes.find((n) => typeIs(n, 'Product', 'RealEstateListing', 'Apartment', 'House', 'Residence', 'Accommodation'))

  if (offer) {
    setField(e, 'rent', parseBRL(str(offer.price)), 'jsonld')
    if (availabilityName(offer.availability) === 'InStock') e.availability = 'active'
  }
  setField(e, 'title', str(product?.name), 'jsonld')
  setField(e, 'title', e.fields.title === undefined ? (meta['og:title'] ?? meta.title) : undefined, 'meta')

  const imgs = images(product?.image)
  if (imgs.length) {
    e.images = imgs
    setField(e, 'mainImageUrl', imgs[0], 'jsonld')
  } else {
    e.images = images(meta['og:image'])
    setField(e, 'mainImageUrl', e.images[0], 'meta')
  }

  setField(e, 'description', str(product?.description), 'jsonld')
  setField(e, 'description', e.fields.description === undefined ? meta['og:description'] : undefined, 'meta')
  return e
}
