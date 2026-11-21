import { parseListingUrl } from '@deniels/core'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { userClientFromBearer } from '@/lib/extension/auth'
import { MAX_CAPTURE_BYTES, parseCapture } from '@/lib/extension/capture-schema'
import { REFRESH_COOLDOWN_MINUTES } from '@/lib/monitor/cooldown'
import { planCheck } from '@/lib/monitor/plan-check'
import { createAdminSupabase } from '@/lib/supabase/admin'

type Result = 'updated' | 'unchanged' | 'untracked' | 'too_soon' | 'blocked'
const reply = (result: Result, extra: Record<string, unknown> = {}) => NextResponse.json({ result, changes: 0, ...extra })

/**
 * Recebe o que a extensão leu da página aberta pelo usuário e atualiza o imóvel
 * (mesmas regras do monitoramento do servidor, com origem "extensão").
 */
export async function POST(request: NextRequest) {
  const auth = await userClientFromBearer(request.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { supabase, userId } = auth

  const raw = await request.text()
  if (raw.length > MAX_CAPTURE_BYTES) return NextResponse.json({ error: 'Dados grandes demais' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsedBody = parseCapture(body)
  if (!parsedBody.success) return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  const { url, httpStatus, extraction } = parsedBody.data

  const parsedUrl = parseListingUrl(url)
  if (!parsedUrl.ok) return NextResponse.json({ error: parsedUrl.error }, { status: 400 })
  const parsed = parsedUrl.value
  // A extensão nunca deve mandar desafio; se mandar, não grava nada.
  if (extraction.pageKind === 'challenge') return reply('blocked')

  // Só imóveis do próprio usuário (RLS) — por link normalizado ou código do anúncio.
  const select = '*'
  let { data: apt } = await supabase.from('apartments').select(select).eq('url_normalized', parsed.normalized).maybeSingle()
  const externalId = parsed.externalId ?? extraction.externalId
  if (!apt && externalId) {
    ;({ data: apt } = await supabase
      .from('apartments')
      .select(select)
      .eq('platform', parsed.platform)
      .eq('external_listing_id', externalId)
      .maybeSingle())
  }
  if (!apt || apt.user_id !== userId) return reply('untracked')

  if (apt.last_source === 'extension' && apt.last_success_at) {
    const minutes = (Date.now() - new Date(apt.last_success_at).getTime()) / 60_000
    if (minutes < REFRESH_COOLDOWN_MINUTES) return reply('too_soon', { apartmentId: apt.id })
  }

  const [lastPrice, lastSnapshot] = await Promise.all([
    supabase
      .from('apartment_price_history')
      .select('rent, condo_fee, iptu, recorded_at')
      .eq('apartment_id', apt.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('apartment_snapshots')
      .select('rent, condo_fee, iptu, bedrooms, bathrooms, parking, area_m2, description_hash, images_hash')
      .eq('apartment_id', apt.id)
      .eq('page_kind', 'listing')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const started = Date.now()
  const plan = planCheck({
    apartment: apt,
    read: { ok: true, parsed, extraction, fetch: 'fetched', httpStatus },
    lastPrice: lastPrice.data ?? null,
    lastSnapshot: lastSnapshot.data ?? null,
    now: new Date(),
    runId: randomUUID(),
    trigger: 'extension',
    source: 'extension',
  })

  const writes = await Promise.all([
    supabase.from('apartment_snapshots').insert(plan.snapshot),
    plan.changes.length
      ? supabase.from('apartment_changes').upsert(plan.changes, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      : null,
    plan.price ? supabase.from('apartment_price_history').insert(plan.price) : null,
    plan.statusRow ? supabase.from('apartment_status_history').insert(plan.statusRow) : null,
  ])
  const writeError = writes.find((w) => w?.error)?.error
  const updated = writeError ? null : await supabase.from('apartments').update(plan.apartmentUpdate).eq('id', apt.id)
  const finalError = writeError ?? updated?.error ?? null

  // Log com o cliente admin (a tabela de logs é só leitura para o usuário). Falha no log não derruba a captura.
  try {
    await createAdminSupabase()
      .from('monitoring_logs')
      .insert({
        ...plan.log,
        outcome: finalError ? 'error' : plan.log.outcome,
        error_message: finalError ? `Falha ao gravar: ${finalError.message}` : plan.log.error_message,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
      })
  } catch (e) {
    console.error('[extensao] falha ao gravar log', e)
  }

  if (finalError) {
    console.error('[extensao] falha ao gravar captura', finalError)
    return NextResponse.json({ error: 'Falha ao gravar' }, { status: 500 })
  }
  return NextResponse.json({
    result: plan.changes.length ? 'updated' : 'unchanged',
    changes: plan.changes.length,
    apartmentId: apt.id,
  })
}
