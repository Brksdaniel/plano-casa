import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getPublicEnv, getServiceEnv } from '@/lib/env'

/**
 * Cliente com a chave secreta: ignora a RLS. Use SOMENTE no servidor, para o monitoramento
 * agendado (que roda sem usuário logado). Nunca importe em Client Components.
 */
export function createAdminSupabase() {
  const { supabaseUrl } = getPublicEnv()
  const { supabaseSecretKey } = getServiceEnv()
  return createClient<Database, 'tracker'>(supabaseUrl, supabaseSecretKey, {
    db: { schema: 'tracker' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type AdminClient = ReturnType<typeof createAdminSupabase>
