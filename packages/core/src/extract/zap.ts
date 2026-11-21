import { decodeEntities, readJsonLd } from '../html'
import { parseBRL } from '../money'
import type { ParsedListingUrl } from '../types'
import { extractGeneric, pageGuard } from './generic'
import { UNAVAILABLE, availabilityName, images, obj, str, typeIs } from './jsonld-utils'
import { type Extraction, emptyExtraction, setField } from './types'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function innerText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Texto do primeiro elemento com o atributo informado (ex.: data-testid="condoFee"). */
function textByAttr(html: string, attr: string, value: string): string | undefined {
  const re = new RegExp(`<([a-z0-9]+)\\b[^>]*\\b${attr}\\s*=\\s*["']${escapeRe(value)}["'][^>]*>([\\s\\S]*?)</\\1>`, 'i')
  const m = re.exec(html)
  return m ? innerText(m[2] ?? '') : undefined
}

const firstInt = (text: string | undefined) => {
  const m = text?.match(/\d+/)
  return m ? Number.parseInt(m[0], 10) : undefined
}

/**
 * ZAP Imóveis / Viva Real (mesmo grupo). Estrutura verificada num anúncio real aberto
 * num navegador em 2026-11-20: JSON-LD Product + marcação data-testid / itemprop.
 * Usado pela extensão (o servidor é bloqueado nesses sites).
 */
export function extractZap(html: string, parsed: ParsedListingUrl, status: number): Extraction {
  const guarded = pageGuard(html, parsed, status)
  if (guarded) return guarded

  const product = readJsonLd(html).find((n) => typeIs(n, 'Product'))
  if (!product) return { ...extractGeneric(html, parsed, status), platform: parsed.platform }

  const e = emptyExtraction(parsed, 'listing')
  const offer = obj(product.offers)
  const sku = str(product.sku)
  if (!e.externalId && sku) e.externalId = sku

  setField(e, 'rent', parseBRL(str(offer?.price)), 'jsonld')

  // "Imóvel em Afonso Pena, São José dos Pinhais - PR"
  const name = str(product.name)
  setField(e, 'title', name, 'jsonld')
  const place = name?.match(/\bem\s+(.+?),\s*(.+?)\s*-\s*[A-Z]{2}\s*$/)
  if (place) {
    setField(e, 'neighborhood', place[1], 'jsonld')
    setField(e, 'city', place[2], 'jsonld')
  }

  e.images = images(product.image)
  setField(e, 'mainImageUrl', e.images[0], 'jsonld')
  setField(e, 'description', str(product.description), 'jsonld')

  const condo = textByAttr(html, 'data-testid', 'condoFee')
  if (condo) setField(e, 'condoFee', /isento/i.test(condo) ? 0 : parseBRL(condo), 'meta')
  const iptu = textByAttr(html, 'data-testid', 'iptu')
  if (iptu) setField(e, 'iptu', /isento/i.test(iptu) ? 0 : parseBRL(iptu), 'meta')

  setField(e, 'areaM2', firstInt(textByAttr(html, 'itemprop', 'floorSize')), 'meta')
  setField(e, 'bedrooms', firstInt(textByAttr(html, 'itemprop', 'numberOfRooms')), 'meta')
  setField(e, 'bathrooms', firstInt(textByAttr(html, 'itemprop', 'numberOfBathroomsTotal')), 'meta')
  setField(e, 'parking', firstInt(textByAttr(html, 'itemprop', 'numberOfParkingSpaces')), 'meta')

  const avail = availabilityName(offer?.availability)
  if (avail === 'InStock') e.availability = 'active'
  else if (avail && UNAVAILABLE.has(avail)) {
    e.availability = 'explicit_unavailable'
    e.evidence.push(`Oferta marcada como ${avail} nos dados estruturados do anúncio.`)
  }
  return e
}
