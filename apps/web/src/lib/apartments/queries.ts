import 'server-only'
import type { ParsedListingUrl } from '@deniels/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

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

/** Já existe um imóvel com o mesmo link normalizado ou o mesmo código do anúncio? (RLS: só do usuário) */
export async function findDuplicate(supabase: Client, parsed: ParsedListingUrl): Promise<DuplicateInfo | null> {
  const pick = 'id, custom_name, source_title'
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
  return row ? { id: row.id, name: row.custom_name ?? row.source_title ?? 'Imóvel sem nome' } : null
}
