'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { createServerSupabase } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect(LOGIN_PATH)
  return supabase
}

/** Marca uma (id) ou todas as notificações como lidas. RLS: só as do próprio usuário. */
export async function markReadAction(id?: number): Promise<void> {
  const supabase = await requireUser()
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (id !== undefined) {
    if (!z.number().int().positive().safeParse(id).success) return
    q = q.eq('id', id)
  }
  await q
  revalidatePath('/notificacoes')
}
