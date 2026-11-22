import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { type Opportunity, computeOpportunity } from './opportunity'
import { recentDropPct } from './price-stats'

type Client = SupabaseClient<Database, 'tracker'>

/** Calcula o indicador de oportunidade de todos os imóveis ativos do usuário (RLS). */
export async function loadOpportunities(supabase: Client, now = new Date(), userId?: string): Promise<Map<string, Opportunity>> {
  const since = new Date(now.getTime() - 14 * 86_400_000).toISOString()
  // Com o cliente do usuário a RLS já filtra; com o cliente admin (cron) é obrigatório passar userId.
  let aptQuery = supabase.from('apartments').select('id, bedrooms, total_monthly, area_m2, priority, status').is('archived_at', null)
  let histQuery = supabase.from('apartment_price_history').select('apartment_id, recorded_at, rent').gte('recorded_at', since)
  if (userId) {
    aptQuery = aptQuery.eq('user_id', userId)
    histQuery = histQuery.eq('user_id', userId)
  }
  const [apts, hist] = await Promise.all([aptQuery, histQuery])
  if (apts.error) throw new Error(`Falha ao calcular oportunidades: ${apts.error.message}`)
  const byApt = new Map<string, { recorded_at: string; rent: number | null }[]>()
  for (const h of hist.data ?? []) {
    const list = byApt.get(h.apartment_id) ?? []
    list.push(h)
    byApt.set(h.apartment_id, list)
  }
  const inputs = apts.data.map((a) => ({
    ...a,
    total_monthly: a.total_monthly === null ? null : Number(a.total_monthly),
    area_m2: a.area_m2 === null ? null : Number(a.area_m2),
    dropPct: recentDropPct(byApt.get(a.id) ?? [], now),
  }))
  return new Map(inputs.map((i) => [i.id, computeOpportunity(i, inputs)]))
}

/** Histórico completo de preços de um imóvel (mais antigo primeiro) — alimenta o gráfico. */
export async function priceHistory(supabase: Client, apartmentId: string) {
  const { data, error } = await supabase
    .from('apartment_price_history')
    .select('recorded_at, rent, condo_fee, iptu, total_monthly, source')
    .eq('apartment_id', apartmentId)
    .order('recorded_at', { ascending: true })
    .limit(1000)
  if (error) throw new Error(`Falha ao carregar o histórico: ${error.message}`)
  return data
}
