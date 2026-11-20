import 'server-only'
import type { ParsedListingUrl } from '@deniels/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Client = SupabaseClient<Database, 'tracker'>

export type DuplicateInfo = { id: string; name: string }

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
