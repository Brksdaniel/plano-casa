'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { createServerSupabase } from '@/lib/supabase/server'

/** Apaga o imóvel e todo o histórico (cascata no banco). A RLS garante que só o dono consegue. */
export async function deleteApartmentAction(id: string): Promise<{ error: string } | void> {
  if (!z.uuid().safeParse(id).success) return { error: 'Imóvel inválido.' }

  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect(LOGIN_PATH)

  const { error, count } = await supabase.from('apartments').delete({ count: 'exact' }).eq('id', id)
  if (error) return { error: 'Não foi possível excluir agora. Tente novamente.' }
  if (!count) return { error: 'Imóvel não encontrado.' }

  redirect('/apartamentos')
}
