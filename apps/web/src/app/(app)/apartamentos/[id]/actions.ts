'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { moneyField } from '@/lib/apartments/schema'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { MissingEnvError } from '@/lib/env'
import { refreshWaitMinutes } from '@/lib/monitor/cooldown'
import { planManualUpdate } from '@/lib/monitor/plan-manual'
import { runCheck } from '@/lib/monitor/run-check'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect(LOGIN_PATH)
  return supabase
}

/** Apaga o imóvel e todo o histórico (cascata no banco). A RLS garante que só o dono consegue. */
export async function deleteApartmentAction(id: string): Promise<{ error: string } | void> {
  if (!z.uuid().safeParse(id).success) return { error: 'Imóvel inválido.' }
  const supabase = await requireUser()

  const { error, count } = await supabase.from('apartments').delete({ count: 'exact' }).eq('id', id)
  if (error) return { error: 'Não foi possível excluir agora. Tente novamente.' }
  if (!count) return { error: 'Imóvel não encontrado.' }

  redirect('/apartamentos')
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const OUTCOME_MESSAGE: Record<string, string> = {
  ok: 'Anúncio verificado agora: nada mudou.',
  blocked: 'O site bloqueou a leitura neste momento. Isso não significa que foi alugado; tentaremos de novo depois.',
  not_found: 'A página do anúncio não foi encontrada nesta verificação. Se continuar assim por 12 h, ele será marcado como removido.',
  failed: 'O site não respondeu. Tente de novo mais tarde.',
  other: 'Não foi possível ler o anúncio agora.',
}

/** "Atualizar anúncio agora" para imóveis monitorados pelo servidor (máx. 1 vez a cada 10 min). */
export async function refreshApartmentAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Imóvel inválido.' }
  const supabase = await requireUser()

  // A RLS garante que o imóvel é do usuário logado.
  const { data: apt } = await supabase.from('apartments').select('id, monitor_mode, last_check_at').eq('id', id).maybeSingle()
  if (!apt) return { ok: false, error: 'Imóvel não encontrado.' }
  if (apt.monitor_mode !== 'auto') return { ok: false, error: 'Este anúncio não é verificado pelo servidor. Use a atualização manual.' }

  const wait = refreshWaitMinutes(apt.last_check_at, new Date())
  if (wait > 0) return { ok: false, error: `Verificado há pouco. Tente de novo em ${wait} min.` }

  let admin
  try {
    admin = createAdminSupabase()
  } catch (e) {
    if (e instanceof MissingEnvError) return { ok: false, error: `Configuração incompleta no servidor (${e.variable}).` }
    throw e
  }

  const result = await runCheck(admin, id, { trigger: 'manual', runId: randomUUID() })
  if (result.outcome === 'error' || result.outcome === 'skipped') return { ok: false, error: result.message ?? 'Falha na verificação.' }
  if (result.outcome === 'changed') {
    return { ok: true, message: `Anúncio verificado: ${result.changes} ${result.changes === 1 ? 'mudança encontrada' : 'mudanças encontradas'}.` }
  }
  return { ok: true, message: OUTCOME_MESSAGE[result.outcome] ?? 'Anúncio verificado.' }
}

const manualSchema = z.object({
  rent: moneyField,
  condoFee: moneyField,
  iptu: moneyField,
  availability: z.enum(['available', 'rented', 'unknown']),
})

/** Atualização manual (aluguel, condomínio, IPTU e situação). Grava com o cliente do usuário (RLS). */
export async function manualUpdateAction(id: string, form: FormData): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Imóvel inválido.' }
  const parsed = manualSchema.safeParse(Object.fromEntries(form.entries()))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Confira os valores.' }
  const supabase = await requireUser()

  const { data: apt } = await supabase.from('apartments').select('*').eq('id', id).maybeSingle()
  if (!apt) return { ok: false, error: 'Imóvel não encontrado.' }

  const plan = planManualUpdate({ apartment: apt, ...parsed.data, now: new Date(), runId: randomUUID() })
  const writes = await Promise.all([
    supabase.from('apartment_snapshots').insert(plan.snapshot),
    plan.changes.length ? supabase.from('apartment_changes').insert(plan.changes) : null,
    plan.price ? supabase.from('apartment_price_history').insert(plan.price) : null,
    plan.statusRow ? supabase.from('apartment_status_history').insert(plan.statusRow) : null,
  ])
  const writeError = writes.find((w) => w?.error)?.error
  if (writeError) {
    console.error('[manual] falha ao gravar histórico', writeError)
    return { ok: false, error: 'Não foi possível salvar agora. Tente novamente.' }
  }
  const { error } = await supabase.from('apartments').update(plan.apartmentUpdate).eq('id', id)
  if (error) return { ok: false, error: 'Não foi possível salvar agora. Tente novamente.' }

  return {
    ok: true,
    message: plan.changes.length ? `Atualizado: ${plan.changes.length} ${plan.changes.length === 1 ? 'mudança registrada' : 'mudanças registradas'}.` : 'Atualizado: nada mudou.',
  }
}

const detailsSchema = z.object({
  customName: z.string().trim().max(120, 'Nome muito longo (máx. 120).'),
  priority: z.coerce.number().int().min(1).max(5),
  notes: z.string().trim().max(5000, 'Observações muito longas (máx. 5000).'),
})

/** Edita nome personalizado, prioridade e observações (RLS: só o dono). */
export async function updateDetailsAction(id: string, form: FormData): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Imóvel inválido.' }
  const parsed = detailsSchema.safeParse(Object.fromEntries(form.entries()))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }
  const supabase = await requireUser()
  const { customName, priority, notes } = parsed.data
  const { error, count } = await supabase
    .from('apartments')
    .update({ custom_name: customName || null, priority, notes: notes || null }, { count: 'exact' })
    .eq('id', id)
  if (error) return { ok: false, error: 'Não foi possível salvar agora. Tente novamente.' }
  if (!count) return { ok: false, error: 'Imóvel não encontrado.' }
  return { ok: true, message: 'Dados do imóvel salvos.' }
}
