import {
  type Extraction,
  type FieldMethod,
  type ParsedListingUrl,
  type Platform,
  SERVER_FETCH_ALLOWED,
  computeConfidence,
} from '@deniels/core'
import type { ApartmentStatus, MonitorMode, TablesInsert } from '@/lib/database.types'
import type { NewApartmentInput } from './schema'

/** Resultado da tentativa de ler a página no servidor. */
export type FetchOutcome = 'fetched' | 'not_allowed' | 'blocked' | 'failed'

const EXTENSION_PLATFORMS = new Set<Platform>(['zap', 'vivareal', 'olx', 'imovelweb'])

type Child<T extends 'apartment_snapshots' | 'apartment_price_history' | 'apartment_status_history'> = Omit<
  TablesInsert<T>,
  'apartment_id'
>

export type ApartmentInsertPlan = {
  apartment: TablesInsert<'apartments'>
  snapshot: Child<'apartment_snapshots'> | null
  price: Child<'apartment_price_history'> | null
  status: Child<'apartment_status_history'>
}

export function initialMonitorMode(platform: Platform): MonitorMode {
  if (SERVER_FETCH_ALLOWED[platform]) return 'auto'
  if (EXTENSION_PLATFORMS.has(platform)) return 'extension'
  return 'manual'
}

function initialStatus(fetch: FetchOutcome, extraction: Extraction | null): ApartmentStatus {
  if (fetch === 'failed') return 'erro_acesso'
  if (fetch !== 'fetched' || !extraction) return 'nao_verificado'
  if (extraction.pageKind === 'challenge') return 'erro_acesso'
  if (extraction.pageKind === 'not_found') return 'verificacao_necessaria'
  if (extraction.pageKind !== 'listing') return 'erro_acesso'
  if (extraction.availability === 'explicit_unavailable') return 'indisponivel'
  if (extraction.availability === 'active') return 'ativo'
  return 'verificacao_necessaria'
}

/** Como o aluguel salvo foi obtido (o que o usuário vê/edita no formulário prevalece). */
function rentMethod(input: NewApartmentInput, extraction: Extraction | null): FieldMethod | 'user' | undefined {
  if (input.rent === undefined) return undefined
  const origin = input.fieldOrigins.rent
  if (origin === 'page' && extraction?.fields.rent === input.rent) return extraction.methods.rent ?? 'user'
  return 'user'
}

const nul = <T,>(v: T | undefined): T | null => (v === undefined ? null : v)

/** Monta as linhas a gravar no cadastro de um novo imóvel (função pura, testada). */
export function buildApartmentInsert(
  input: NewApartmentInput,
  ctx: {
    userId: string
    parsed: ParsedListingUrl
    extraction: Extraction | null
    fetch: FetchOutcome
    httpStatus?: number
    now: Date
  },
): ApartmentInsertPlan {
  const { userId, parsed, extraction, fetch, httpStatus, now } = ctx
  const nowIso = now.toISOString()
  const status = initialStatus(fetch, extraction)
  const readPage = fetch === 'fetched' && extraction?.pageKind === 'listing'
  const attempted = fetch === 'fetched' || fetch === 'failed'

  const method = rentMethod(input, extraction)
  const complete = input.rent !== undefined && input.bedrooms !== undefined && Boolean(input.city)
  const confidence = computeConfidence({ rentMethod: method, ageHours: 0, complete })
  const priceFromServer = readPage && method !== undefined && method !== 'user' && method !== 'slug'
  const userProvidedData = input.rent !== undefined

  const lastSource = readPage ? 'server' : userProvidedData ? 'manual' : null
  const title = typeof extraction?.fields.title === 'string' ? extraction.fields.title : undefined
  const image = typeof extraction?.fields.mainImageUrl === 'string' ? extraction.fields.mainImageUrl : undefined

  const apartment: TablesInsert<'apartments'> = {
    user_id: userId,
    url_original: parsed.url.toString(),
    url_normalized: parsed.normalized,
    platform: parsed.platform,
    external_listing_id: nul(parsed.externalId),
    custom_name: nul(input.customName),
    source_title: nul(title),
    neighborhood: nul(input.neighborhood),
    city: nul(input.city),
    rent: nul(input.rent),
    condo_fee: nul(input.condoFee),
    iptu: nul(input.iptu),
    bedrooms: nul(input.bedrooms),
    bathrooms: nul(input.bathrooms),
    parking: nul(input.parking),
    area_m2: nul(input.areaM2),
    priority: input.priority,
    notes: nul(input.notes),
    main_image_url: nul(image),
    monitor_mode: initialMonitorMode(parsed.platform),
    status,
    confidence,
    last_check_at: attempted ? nowIso : null,
    last_success_at: lastSource ? nowIso : null,
    last_source: lastSource,
    consecutive_failures: status === 'erro_acesso' ? 1 : 0,
    consecutive_not_found: status === 'verificacao_necessaria' && extraction?.pageKind === 'not_found' ? 1 : 0,
  }

  let snapshot: ApartmentInsertPlan['snapshot'] = null
  if (attempted) {
    const f = extraction?.fields ?? {}
    const numOrNull = (v: unknown) => (typeof v === 'number' ? v : null)
    const rawFields = { ...f }
    delete rawFields.description
    snapshot = {
      user_id: userId,
      checked_at: nowIso,
      source: 'server',
      http_status: nul(httpStatus),
      page_kind: extraction?.pageKind ?? null,
      rent: numOrNull(f.rent),
      condo_fee: numOrNull(f.condoFee),
      iptu: numOrNull(f.iptu),
      bedrooms: numOrNull(f.bedrooms),
      bathrooms: numOrNull(f.bathrooms),
      parking: numOrNull(f.parking),
      area_m2: numOrNull(f.areaM2),
      availability: extraction?.availability ?? null,
      confidence: readPage ? confidence : null,
      raw: extraction
        ? { fields: rawFields, methods: extraction.methods, images: extraction.images, evidence: extraction.evidence }
        : null,
      error: fetch === 'failed' ? 'Não foi possível acessar o anúncio (rede ou tempo esgotado).' : null,
    }
  }

  const price: ApartmentInsertPlan['price'] =
    input.rent === undefined
      ? null
      : {
          user_id: userId,
          recorded_at: nowIso,
          rent: input.rent,
          condo_fee: nul(input.condoFee),
          iptu: nul(input.iptu),
          source: priceFromServer ? 'server' : 'manual',
        }

  return {
    apartment,
    snapshot,
    price,
    status: {
      user_id: userId,
      changed_at: nowIso,
      from_status: null,
      to_status: status,
      evidence: extraction?.evidence.length ? extraction.evidence.join(' ') : null,
      source: attempted ? 'server' : 'manual',
    },
  }
}
