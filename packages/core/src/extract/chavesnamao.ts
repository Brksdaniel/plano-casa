import { readJsonLd } from '../html'
import { parseBRL } from '../money'
import type { ParsedListingUrl } from '../types'
import { extractGeneric, pageGuard } from './generic'
import { UNAVAILABLE, availabilityName, images, int, num, obj, str, typeIs } from './jsonld-utils'
import { fillFromText } from './text-fields'
import { type Extraction, emptyExtraction, setField } from './types'

/**
 * Chaves na Mão: JSON-LD RealEstateListing → about.offers (Offer) → itemOffered.
 * Estrutura verificada em anúncios reais de 2026-11-20 (apartamento e casa).
 */
export function extractChavesNaMao(html: string, parsed: ParsedListingUrl, status: number): Extraction {
  const guarded = pageGuard(html, parsed, status)
  if (guarded) return guarded

  const listing = readJsonLd(html).find((n) => typeIs(n, 'RealEstateListing'))
  if (!listing) return { ...extractGeneric(html, parsed, status), platform: 'chavesnamao' }

  const about = obj(listing.about)
  const offer = obj(listing.offers) ?? obj(about?.offers)
  const item = obj(offer?.itemOffered)
  const address = obj(item?.address)

  const e = emptyExtraction(parsed, 'listing')
  setField(e, 'title', str(listing.name) ?? str(about?.name), 'jsonld')
  setField(e, 'rent', parseBRL(str(offer?.price)), 'jsonld')
  setField(e, 'bedrooms', int(item?.numberOfBedrooms) ?? int(item?.numberOfRooms), 'jsonld')
  setField(e, 'bathrooms', int(item?.numberOfBathroomsTotal), 'jsonld')
  setField(e, 'areaM2', num(obj(item?.floorSize)?.value), 'jsonld')

  // addressLocality = "Bairro, Cidade"
  const locality = str(address?.addressLocality)
  if (locality) {
    const parts = locality.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      setField(e, 'neighborhood', parts[0], 'jsonld')
      setField(e, 'city', parts[parts.length - 1], 'jsonld')
    } else {
      setField(e, 'city', parts[0], 'jsonld')
    }
  }

  e.images = images(about?.image ?? listing.image)
  setField(e, 'mainImageUrl', e.images[0], 'jsonld')

  const description = str(offer?.description) ?? str(listing.description) ?? str(about?.description)
  setField(e, 'description', description, 'jsonld')
  fillFromText(e, description)

  const avail = availabilityName(offer?.availability)
  if (avail === 'InStock') e.availability = 'active'
  else if (avail && UNAVAILABLE.has(avail)) {
    e.availability = 'explicit_unavailable'
    e.evidence.push(`Oferta marcada como ${avail} nos dados estruturados do anúncio.`)
  }
  return e
}
