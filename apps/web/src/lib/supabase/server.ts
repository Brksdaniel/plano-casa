import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import { getPublicEnv } from '@/lib/env'

/** Cliente Supabase para Server Components, Server Actions e Route Handlers (sessão do usuário). */
export async function createServerSupabase() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv()
  const cookieStore = await cookies()

  return createServerClient<Database, 'tracker'>(supabaseUrl, supabasePublishableKey, {
    db: { schema: 'tracker' },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Server Components não podem gravar cookies; o proxy.ts renova a sessão.
        }
      },
    },
  })
}
