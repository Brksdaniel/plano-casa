import 'server-only'
import { readListing } from '@/lib/apartments/read-listing'
import type { ApartmentStatus } from '@/lib/database.types'
import type { AdminClient } from '@/lib/supabase/admin'
import { type CheckOutcome, planCheck } from './plan-check'

export type RunCheckResult = {
  apartmentId: string
  outcome: CheckOutcome | 'skipped' | 'error'
  status?: ApartmentStatus
  changes: number
  message?: string
}

/** Verifica um imóvel agora e grava tudo (snapshot, mudanças, preço, status, log). */
export async function runCheck(
  admin: AdminClient,
  apartmentId: string,
  opts: { trigger: 'cron' | 'manual'; runId: string; now?: Date },
): Promise<RunCheckResult> {
  const started = Date.now()
  const { data: apt, error } = await admin.from('apartments').select('*').eq('id', apartmentId).maybeSingle()
  if (error || !apt) return { apartmentId, outcome: 'error', changes: 0, message: 'Imóvel não encontrado.' }
  if (apt.monitor_mode !== 'auto') return { apartmentId, outcome: 'skipped', changes: 0, message: 'Imóvel não é monitorado pelo servidor.' }

  const [read, lastPrice, lastSnapshot] = await Promise.all([
    readListing(apt.url_original),
    admin
      .from('apartment_price_history')
      .select('rent, condo_fee, iptu, recorded_at')
      .eq('apartment_id', apt.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('apartment_snapshots')
      .select('rent, condo_fee, iptu, bedrooms, bathrooms, parking, area_m2, description_hash, images_hash')
      .eq('apartment_id', apt.id)
      .eq('page_kind', 'listing')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const plan = planCheck({
    apartment: apt,
    read,
    lastPrice: lastPrice.data ?? null,
    lastSnapshot: lastSnapshot.data ?? null,
    now: opts.now ?? new Date(),
    runId: opts.runId,
    trigger: opts.trigger,
  })

  const writes = await Promise.all([
    admin.from('apartment_snapshots').insert(plan.snapshot),
    plan.changes.length
      ? admin.from('apartment_changes').upsert(plan.changes, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      : null,
    plan.price ? admin.from('apartment_price_history').insert(plan.price) : null,
    plan.statusRow ? admin.from('apartment_status_history').insert(plan.statusRow) : null,
  ])
  const writeError = writes.find((w) => w?.error)?.error
  const updated = writeError ? null : await admin.from('apartments').update(plan.apartmentUpdate).eq('id', apt.id)
  const finalError = writeError ?? updated?.error ?? null

  await admin.from('monitoring_logs').insert({
    ...plan.log,
    outcome: finalError ? 'error' : plan.log.outcome,
    error_message: finalError ? `Falha ao gravar: ${finalError.message}` : plan.log.error_message,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
  })

  if (finalError) {
    console.error('[monitor] falha ao gravar verificação', apartmentId, finalError)
    return { apartmentId, outcome: 'error', changes: 0, message: 'Falha ao gravar a verificação.' }
  }
  return {
    apartmentId,
    outcome: plan.log.outcome as CheckOutcome,
    status: plan.apartmentUpdate.status,
    changes: plan.changes.length,
  }
}
