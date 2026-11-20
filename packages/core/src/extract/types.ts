import type { ParsedListingUrl, Platform } from '../types'

export type FieldKey =
  | 'title'
  | 'rent'
  | 'condoFee'
  | 'iptu'
  | 'bedrooms'
  | 'bathrooms'
  | 'parking'
  | 'areaM2'
  | 'neighborhood'
  | 'city'
  | 'mainImageUrl'
  | 'description'

export const FIELD_KEYS: FieldKey[] = [
  'title',
  'rent',
  'condoFee',
  'iptu',
  'bedrooms',
  'bathrooms',
  'parking',
  'areaM2',
  'neighborhood',
  'city',
  'mainImageUrl',
  'description',
]

/** Como o campo foi obtido: dado estruturado, metadado, texto livre da página, ou o próprio link. */
export type FieldMethod = 'jsonld' | 'meta' | 'text' | 'slug'

export type Extraction = {
  platform: Platform
  externalId?: string
  fields: Partial<Record<FieldKey, string | number>>
  images: string[]
  methods: Partial<Record<FieldKey, FieldMethod>>
  availability: 'active' | 'explicit_unavailable' | 'unknown'
  pageKind: 'listing' | 'challenge' | 'not_found' | 'other'
  evidence: string[]
}

export function emptyExtraction(parsed: ParsedListingUrl, pageKind: Extraction['pageKind'] = 'other'): Extraction {
  return {
    platform: parsed.platform,
    ...(parsed.externalId ? { externalId: parsed.externalId } : {}),
    fields: {},
    images: [],
    methods: {},
    availability: 'unknown',
    pageKind,
    evidence: [],
  }
}

export function setField(e: Extraction, key: FieldKey, value: string | number | undefined, method: FieldMethod) {
  if (value === undefined || value === null || value === '') return
  if (typeof value === 'number' && !Number.isFinite(value)) return
  e.fields[key] = typeof value === 'string' ? value.trim() : value
  e.methods[key] = method
}
