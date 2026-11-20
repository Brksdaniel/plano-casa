import {
  type FieldKey,
  type FieldMethod,
  type ObservedValues,
  type Observation,
  computeConfidence,
  detectChanges,
  hashList,
  hashText,
  nextStatus,
} from '@deniels/core'
import type { ListingRead } from '@/lib/apartments/read-listing'
import type { ApartmentStatus, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'

type Child<T extends 'apartment_snapshots' | 'apartment_price_history' | 'apartment_status_history' | 'apartment_changes'> =
  TablesInsert<T>

export type SnapshotValues = Pick<
  Tables<'apartment_snapshots'>,
  'rent' | 'condo_fee' | 'iptu' | 'bedrooms' | 'bathrooms' | 'parking' | 'area_m2' | 'description_hash' | 'images_hash'
>
export type PriceValues = Pick<Tables<'apartment_price_history'>, 'rent' | 'condo_fee' | 'iptu' | 'recorded_at'>

export type CheckPlan = {
  apartmentUpdate: TablesUpdate<'apartments'>
  snapshot: Child<'apartment_snapshots'>
  price: Child<'apartment_price_history'> | null
  statusRow: Child<'apartment_status_history'> | null
  changes: Child<'apartment_changes'>[]
  log: TablesInsert<'monitoring_logs'>
}

export type CheckOutcome = 'ok' | 'changed' | 'blocked' | 'not_found' | 'failed' | 'other'

/** Só dados lidos da PÁGINA (não do link) atualizam o imóvel; nunca apagam o que o usuário digitou. */
const TRUSTED: FieldMethod[] = ['jsonld', 'text', 'meta']
const FIELD_COLUMN: [FieldKey, keyof TablesUpdate<'apartments'>][] = [
  ['rent', 'rent'],
  ['condoFee', 'condo_fee'],
  ['iptu', 'iptu'],
  ['bedrooms', 'bedrooms'],
  ['bathrooms', 'bathrooms'],
  ['parking', 'parking'],
  ['areaM2', 'area_m2'],
  ['neighborhood', 'neighborhood'],
  ['city', 'city'],
]
const PRICE_REFRESH_HOURS = 20

const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
const orUndef = <T,>(v: T | null | undefined) => (v === null ? undefined : v)

function observationFrom(read: ListingRead): Observation {
  if (!read.ok || read.fetch === 'failed') return { kind: 'failed' }
  if (read.fetch !== 'fetched') return { kind: 'other' }
  const e = read.extraction
  if (e.pageKind === 'listing') return { kind: 'listing', availability: e.availability, evidence: e.evidence }
  if (e.pageKind === 'not_found') return { kind: 'not_found' }
  if (e.pageKind === 'challenge') return { kind: 'blocked' }
  return { kind: 'other' }
}

/**
 * Transforma uma leitura do anúncio + o estado anterior nas linhas a gravar.
 * Função pura: toda regra de negócio do monitoramento automático passa por aqui.
 */
export function planCheck(input: {
  apartment: Tables<'apartments'>
  read: ListingRead
  lastPrice: PriceValues | null
  lastSnapshot: SnapshotValues | null
  now: Date
  runId: string
  trigger: 'cron' | 'manual'
}): CheckPlan {
  const { apartment: apt, read, lastPrice, lastSnapshot, now, runId, trigger } = input
  const nowIso = now.toISOString()
  const obs = observationFrom(read)
  const extraction = read.ok ? read.extraction : null
  const isListing = obs.kind === 'listing' && extraction !== null

  const result = nextStatus(
    {
      status: apt.status,
      consecutiveFailures: apt.consecutive_failures,
      consecutiveNotFound: apt.consecutive_not_found,
      lastNotFoundAt: apt.last_not_found_at,
      mode: apt.monitor_mode,
    },
    obs,
    now,
  )
  const status = result.status as ApartmentStatus

  // Valores observados agora (só quando a página foi lida).
  const next: ObservedValues = {}
  if (isListing) {
    const f = extraction.fields
    next.rent = num(f.rent)
    next.condoFee = num(f.condoFee)
    next.iptu = num(f.iptu)
    next.bedrooms = num(f.bedrooms)
    next.bathrooms = num(f.bathrooms)
    next.parking = num(f.parking)
    next.areaM2 = num(f.areaM2)
    if (typeof f.description === 'string') next.descriptionHash = hashText(f.description)
    if (extraction.images.length) next.imagesHash = hashList(extraction.images)
  }
  const prev: ObservedValues = lastSnapshot
    ? {
        rent: orUndef(lastSnapshot.rent),
        condoFee: orUndef(lastSnapshot.condo_fee),
        iptu: orUndef(lastSnapshot.iptu),
        bedrooms: orUndef(lastSnapshot.bedrooms),
        bathrooms: orUndef(lastSnapshot.bathrooms),
        parking: orUndef(lastSnapshot.parking),
        areaM2: orUndef(lastSnapshot.area_m2),
        descriptionHash: orUndef(lastSnapshot.description_hash),
        imagesHash: orUndef(lastSnapshot.images_hash),
      }
    : { rent: orUndef(apt.rent), condoFee: orUndef(apt.condo_fee), iptu: orUndef(apt.iptu) }

  const drafts = detectChanges(prev, next, apt.status, status)
  const changes: Child<'apartment_changes'>[] = drafts.map((d) => ({
    user_id: apt.user_id,
    apartment_id: apt.id,
    detected_at: nowIso,
    kind: d.kind,
    old_value: d.oldValue,
    new_value: d.newValue,
    diff_abs: d.diffAbs,
    diff_pct: d.diffPct,
    dedupe_key: `snap:${runId}:${apt.id}:${d.kind}`,
  }))

  // Atualização do imóvel
  const update: TablesUpdate<'apartments'> = {
    last_check_at: nowIso,
    status,
    consecutive_failures: result.consecutiveFailures,
    consecutive_not_found: result.consecutiveNotFound,
    last_not_found_at: result.lastNotFoundAt,
  }
  if (result.demoted) update.monitor_mode = 'extension'

  const merged = { rent: apt.rent, condo_fee: apt.condo_fee, iptu: apt.iptu, bedrooms: apt.bedrooms, city: apt.city }
  if (isListing) {
    update.last_success_at = nowIso
    update.last_source = 'server'
    for (const [key, column] of FIELD_COLUMN) {
      const value = extraction.fields[key]
      const method = extraction.methods[key]
      if (value !== undefined && method && TRUSTED.includes(method)) {
        ;(update as Record<string, unknown>)[column] = value
        if (column in merged) (merged as Record<string, unknown>)[column] = value
      }
    }
    if (typeof extraction.fields.title === 'string') update.source_title = extraction.fields.title
    if (typeof extraction.fields.mainImageUrl === 'string') update.main_image_url = extraction.fields.mainImageUrl
    const rentMethod = extraction.methods.rent && next.rent !== undefined ? extraction.methods.rent : merged.rent !== null ? 'user' : undefined
    update.confidence = computeConfidence({
      rentMethod,
      ageHours: 0,
      complete: merged.rent !== null && merged.bedrooms !== null && Boolean(merged.city),
    })
  }

  // Histórico de preço: quando muda ou para manter um ponto por dia no gráfico.
  let price: CheckPlan['price'] = null
  if (isListing && next.rent !== undefined) {
    const values = { rent: merged.rent, condo_fee: merged.condo_fee, iptu: merged.iptu }
    const changed =
      !lastPrice || lastPrice.rent !== values.rent || lastPrice.condo_fee !== values.condo_fee || lastPrice.iptu !== values.iptu
    const stale = !lastPrice || now.getTime() - new Date(lastPrice.recorded_at).getTime() > PRICE_REFRESH_HOURS * 3_600_000
    if (changed || stale) {
      price = { user_id: apt.user_id, apartment_id: apt.id, recorded_at: nowIso, ...values, source: 'server' }
    }
  }

  const statusRow: CheckPlan['statusRow'] =
    status !== apt.status || result.demoted
      ? {
          user_id: apt.user_id,
          apartment_id: apt.id,
          changed_at: nowIso,
          from_status: apt.status,
          to_status: status,
          evidence: result.evidence,
          source: 'server',
        }
      : null

  const httpStatus = read.ok ? (read.httpStatus ?? null) : null
  const snapshot: CheckPlan['snapshot'] = {
    user_id: apt.user_id,
    apartment_id: apt.id,
    checked_at: nowIso,
    source: 'server',
    run_id: runId,
    http_status: httpStatus,
    page_kind: read.ok && read.fetch === 'fetched' ? read.extraction.pageKind : null,
    rent: next.rent ?? null,
    condo_fee: next.condoFee ?? null,
    iptu: next.iptu ?? null,
    bedrooms: next.bedrooms ?? null,
    bathrooms: next.bathrooms ?? null,
    parking: next.parking ?? null,
    area_m2: next.areaM2 ?? null,
    availability: isListing ? extraction.availability : null,
    description_hash: next.descriptionHash ?? null,
    images_hash: next.imagesHash ?? null,
    confidence: isListing ? (update.confidence ?? null) : null,
    raw: isListing ? { methods: extraction.methods, images: extraction.images, evidence: extraction.evidence } : null,
    error: obs.kind === 'failed' ? 'Não foi possível acessar o anúncio (rede ou tempo esgotado).' : null,
  }

  const outcome: CheckOutcome =
    obs.kind === 'listing'
      ? changes.length
        ? 'changed'
        : 'ok'
      : obs.kind === 'blocked'
        ? 'blocked'
        : obs.kind === 'not_found'
          ? 'not_found'
          : obs.kind === 'failed'
            ? 'failed'
            : 'other'

  return {
    apartmentUpdate: update,
    snapshot,
    price,
    statusRow,
    changes,
    log: {
      user_id: apt.user_id,
      run_id: runId,
      trigger,
      apartment_id: apt.id,
      platform: apt.platform,
      http_status: httpStatus,
      outcome,
      error_message: result.evidence && obs.kind !== 'listing' ? result.evidence : null,
      started_at: nowIso,
    },
  }
}
