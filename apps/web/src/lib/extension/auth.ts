import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getPublicEnv } from '@/lib/env'

export type UserClient = SupabaseClient<Database, 'tracker'>

/**
 * Cliente Supabase "como o usuário" a partir do token enviado pela extensão
 * (Authorization: Bearer <access_token>). A RLS continua valendo.
 */
export async function userClientFromBearer(authorization: string | null): Promise<{ supabase: UserClient; userId: string } | null> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token || token.length > 4096) return null

  const { supabaseUrl, supabasePublishableKey } = getPublicEnv()
  const supabase = createClient<Database, 'tracker'>(supabaseUrl, supabasePublishableKey, {
    db: { schema: 'tracker' },
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    const { data, error } = await supabase.auth.getClaims(token)
    const userId = data?.claims?.sub
    if (error || !userId) return null
    return { supabase, userId }
  } catch {
    // Token malformado faz getClaims lançar (ex.: "Invalid UTF-8 sequence") → não autorizado.
    return null
  }
}
