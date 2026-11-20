import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { getPublicEnv } from '@/lib/env'

/** Cliente Supabase para Client Components (usa só a chave publicável). */
export function createBrowserSupabase() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv()
  return createBrowserClient<Database, 'tracker'>(supabaseUrl, supabasePublishableKey, {
    db: { schema: 'tracker' },
  })
}
