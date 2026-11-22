'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { emailConfig, renderAlertsEmail, sendEmail } from '@/lib/notifications/email'
import { createServerSupabase } from '@/lib/supabase/server'

export type PrefsResult = { ok: true; message: string } | { ok: false; error: string }

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect(LOGIN_PATH)
  return { supabase, userId }
}

const checkbox = z.preprocess((v) => v === 'on' || v === 'true', z.boolean())
const prefsSchema = z.object({
  notifyEmail: z.union([z.literal(''), z.email('E-mail inválido.').max(200)]),
  emailEnabled: checkbox,
  dailyDigestEnabled: checkbox,
  dailyDigestHour: z.coerce.number().int().min(0).max(23),
  minChangeAbs: z.coerce.number().min(0, 'Valor mínimo inválido.').max(100_000),
  minChangePct: z.coerce.number().min(0, 'Percentual inválido.').max(100),
})

export async function savePreferencesAction(form: FormData): Promise<PrefsResult> {
  const raw = Object.fromEntries(form.entries())
  const parsed = prefsSchema.safeParse({
    ...raw,
    emailEnabled: raw.emailEnabled ?? 'false',
    dailyDigestEnabled: raw.dailyDigestEnabled ?? 'false',
    minChangeAbs: String(raw.minChangeAbs ?? '').replace(',', '.'),
    minChangePct: String(raw.minChangePct ?? '').replace(',', '.'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }
  const { supabase, userId } = await requireUser()
  const p = parsed.data
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    notify_email: p.notifyEmail || null,
    email_enabled: p.emailEnabled,
    daily_digest_enabled: p.dailyDigestEnabled,
    daily_digest_hour: p.dailyDigestHour,
    min_change_abs: p.minChangeAbs,
    min_change_pct: p.minChangePct,
  })
  if (error) return { ok: false, error: 'Não foi possível salvar agora. Tente novamente.' }
  revalidatePath('/configuracoes')
  return { ok: true, message: 'Preferências salvas.' }
}

export async function sendTestEmailAction(): Promise<PrefsResult> {
  const { supabase } = await requireUser()
  const cfg = emailConfig()
  if (!cfg) return { ok: false, error: 'E-mail ainda não configurado no servidor (falta RESEND_API_KEY).' }
  const { data } = await supabase.from('user_preferences').select('notify_email').maybeSingle()
  if (!data?.notify_email) return { ok: false, error: 'Salve um e-mail para avisos primeiro.' }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  try {
    await sendEmail(
      cfg,
      data.notify_email,
      renderAlertsEmail([{ title: 'E-mail de teste', body: 'Se você recebeu isto, os avisos por e-mail estão funcionando.', apartmentId: null }], site),
    )
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao enviar.' }
  }
  return { ok: true, message: `E-mail de teste enviado para ${data.notify_email}.` }
}
