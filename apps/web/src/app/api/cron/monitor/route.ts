import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { MissingEnvError, getServiceEnv } from '@/lib/env'
import { MAX_PER_RUN, SAME_PLATFORM_DELAY_MS, dueCutoff, isAuthorizedCron } from '@/lib/monitor/cron-auth'
import { type RunCheckResult, runCheck } from '@/lib/monitor/run-check'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const maxDuration = 60

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Chamado pelo pg_cron (de hora em hora) e pelo Vercel Cron (reserva diária).
 * Verifica até 8 imóveis "auto" cuja última tentativa tem mais de 6 h.
 */
async function handle(request: NextRequest) {
  let cronSecret: string
  try {
    cronSecret = getServiceEnv().cronSecret
  } catch (error) {
    const variable = error instanceof MissingEnvError ? error.variable : 'desconhecida'
    return NextResponse.json({ error: `Configuração incompleta: ${variable}` }, { status: 500 })
  }
  if (!isAuthorizedCron(request.headers.get('authorization'), cronSecret)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminSupabase()
  const runId = randomUUID()
  const cutoff = dueCutoff(new Date())

  const { data: due, error } = await admin
    .from('apartments')
    .select('id, platform')
    .eq('monitor_mode', 'auto')
    .is('archived_at', null)
    .or(`last_check_at.is.null,last_check_at.lt.${cutoff}`)
    .order('last_check_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN)
  if (error) return NextResponse.json({ error: 'Falha ao buscar imóveis', runId }, { status: 500 })

  const results: RunCheckResult[] = []
  let lastPlatform: string | null = null
  for (const apt of due ?? []) {
    if (lastPlatform === apt.platform) await sleep(SAME_PLATFORM_DELAY_MS)
    lastPlatform = apt.platform
    try {
      results.push(await runCheck(admin, apt.id, { trigger: 'cron', runId }))
    } catch (e) {
      console.error('[monitor] erro inesperado', apt.id, e)
      results.push({ apartmentId: apt.id, outcome: 'error', changes: 0 })
    }
  }

  return NextResponse.json({ runId, checked: results.length, results })
}

export const GET = handle
export const POST = handle
