import 'server-only'
import type { ParsedListingUrl } from '@deniels/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { displayName } from './meta'

type Client = SupabaseClient<Database, 'tracker'>

export type DuplicateInfo = { id: string; name: string }

export const CARD_COLUMNS =
  'id, custom_name, source_title, platform, neighborhood, city, rent, condo_fee, iptu, total_monthly, bedrooms, parking, area_m2, main_image_url, monitor_mode, status, confidence, last_success_at, last_source, created_at' as const

export async function listApartments(supabase: Client) {
  const { data, error } = await supabase
    .from('apartments')
    .select(CARD_COLUMNS)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Falha ao carregar apartamentos: ${error.message}`)
  return data
}

export type ApartmentCardData = Awaited<ReturnType<typeof listApartments>>[number]

export async function getApartment(supabase: Client, id: string) {
  const { data, error } = await supabase.from('apartments').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`Falha ao carregar o imóvel: ${error.message}`)
  return data
}

/** Último aluguel e o anterior diferente, por imóvel (view tracker.apartment_price_trend). */
export async function listPriceTrends(supabase: Client) {
  const { data, error } = await supabase.from('apartment_price_trend').select('apartment_id, latest_rent, previous_rent')
  if (error) throw new Error(`Falha ao carregar tendências: ${error.message}`)
  return new Map(data.map((t) => [t.apartment_id, t]))
}

/** Mudanças detectadas nos últimos `days` dias (mais recentes primeiro). */
export async function recentChanges(supabase: Client, opts: { days: number; limit: number; apartmentId?: string }) {
  const since = new Date(Date.now() - opts.days * 86_400_000).toISOString()
  let query = supabase.from('apartment_changes').select('*').gte('detected_at', since).order('detected_at', { ascending: false }).limit(opts.limit)
  if (opts.apartmentId) query = query.eq('apartment_id', opts.apartmentId)
  const { data, error } = await query
  if (error) throw new Error(`Falha ao carregar alterações: ${error.message}`)
  return data
}

/** Já existe um imóvel com o mesmo link normalizado ou o mesmo código do anúncio? (RLS: só do usuário) */
export async function findDuplicate(supabase: Client, parsed: ParsedListingUrl): Promise<DuplicateInfo | null> {
  const pick = 'id, custom_name, source_title, platform, bedrooms, city'
  const byUrl = await supabase.from('apartments').select(pick).eq('url_normalized', parsed.normalized).limit(1).maybeSingle()
  let row = byUrl.data
  if (!row && parsed.externalId) {
    const byId = await supabase
      .from('apartments')
      .select(pick)
      .eq('platform', parsed.platform)
      .eq('external_listing_id', parsed.externalId)
      .limit(1)
      .maybeSingle()
    row = byId.data
  }
  return row ? { id: row.id, name: displayName(row) } : null
}
