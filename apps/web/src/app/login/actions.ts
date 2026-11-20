'use server'

import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/auth/paths'
import { createServerSupabase } from '@/lib/supabase/server'

export type LoginState = { error?: string; email?: string }

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const next = safeNext(String(form.get('next') ?? ''))

  if (!email || !password) return { error: 'Informe e-mail e senha.', email }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const invalid = error.code === 'invalid_credentials' || error.status === 400
    return {
      error: invalid ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.',
      email,
    }
  }

  redirect(next)
}
