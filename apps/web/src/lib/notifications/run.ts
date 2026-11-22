import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { monitoringHealth } from '@/lib/apartments/health'
import { displayName } from '@/lib/apartments/meta'
import { opportunityBand } from '@/lib/apartments/opportunity'
import { loadOpportunities } from '@/lib/apartments/opportunity-data'
import type { Database } from '@/lib/database.types'
import { type EmailConfig, emailConfig, isDigestHour, localDateKey, renderAlertsEmail, renderDigestEmail, sendEmail } from './email'
import { type NotificationInsert, accessErrorNotification, notificationForChange } from './plan'

type Admin = SupabaseClient<Database, 'tracker'>

export type NotificationRun = { created: number; emailed: number; digests: number; errors: string[] }

const DEFAULT_PREFS = { min_change_abs: 50, min_change_pct: 2 }
const UNAVAILABLE = new Set(['possivelmente_alugado', 'indisponivel', 'removido'])

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Roda no cron de hora em hora (cliente admin):
 *  1. cria notificações a partir das mudanças das últimas 48 h (dedupe_key evita repetição);
 *  2. avisa uma vez quando um anúncio falha 3 vezes seguidas;
 *  3. envia por e-mail o que ainda não foi enviado (se o Resend estiver configurado e o usuário quiser);
 *  4. no horário escolhido, gera o resumo diário (no site e por e-mail), uma vez por dia.
 */
export async function processNotifications(admin: Admin, now = new Date()): Promise<NotificationRun> {
  const out: NotificationRun = { created: 0, emailed: 0, digests: 0, errors: [] }
  const since48 = new Date(now.getTime() - 48 * 3_600_000).toISOString()

  const [changesRes, prefsRes, aptsRes] = await Promise.all([
    admin.from('apartment_changes').select('*').gte('detected_at', since48).order('detected_at', { ascending: true }),
    admin.from('user_preferences').select('*'),
    admin
      .from('apartments')
      .select('id, user_id, custom_name, source_title, platform, bedrooms, city, status, monitor_mode, consecutive_failures, last_success_at, url_original')
      .is('archived_at', null),
  ])
  if (changesRes.error || prefsRes.error || aptsRes.error) {
    out.errors.push('Falha ao carregar dados para notificações.')
    return out
  }
  const apts = aptsRes.data
  const aptById = new Map(apts.map((a) => [a.id, a]))
  const prefsByUser = new Map(prefsRes.data.map((p) => [p.user_id, p]))

  // 1 e 2 — notificações no site
  const rows: NotificationInsert[] = []
  for (const c of changesRes.data) {
    const apt = aptById.get(c.apartment_id)
    if (!apt) continue
    const n = notificationForChange(c, displayName(apt), prefsByUser.get(c.user_id) ?? DEFAULT_PREFS)
    if (n) rows.push(n)
  }
  for (const a of apts) {
    const n = accessErrorNotification(a, displayName(a))
    if (n) rows.push(n)
  }
  if (rows.length) {
    const { data, error } = await admin.from('notifications').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id')
    if (error) out.errors.push(`Falha ao gravar notificações: ${error.message}`)
    else out.created = data.length
  }

  const cfg = emailConfig()

  // 3 — e-mails de alerta pendentes, agrupados por usuário
  if (cfg) {
    const { data: pending } = await admin
      .from('notifications')
      .select('id, user_id, title, body, apartment_id')
      .is('emailed_at', null)
      .neq('kind', 'digest')
      .gte('created_at', since48)
      .order('created_at', { ascending: true })
    const byUser = new Map<string, NonNullable<typeof pending>>()
    for (const n of pending ?? []) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n])
    for (const [userId, items] of byUser) {
      const prefs = prefsByUser.get(userId)
      if (!prefs?.email_enabled || !prefs.notify_email) continue
      const msg = renderAlertsEmail(
        items.map((i) => ({ title: i.title, body: i.body, apartmentId: i.apartment_id })),
        siteUrl(),
      )
      const sent = await trySend(cfg, prefs.notify_email, msg, out)
      if (sent !== null) {
        await admin
          .from('notifications')
          .update({ emailed_at: now.toISOString(), channel_deliveries: { email: { id: sent, at: now.toISOString() } } })
          .in(
            'id',
            items.map((i) => i.id),
          )
        out.emailed += items.length
      }
    }
  }

  // 4 — resumo diário
  const dateKey = localDateKey(now)
  const [y, m, d] = dateKey.split('-')
  const dateLabel = `${d}/${m}/${y}`
  const since24 = now.getTime() - 24 * 3_600_000
  for (const prefs of prefsRes.data) {
    if (!prefs.daily_digest_enabled || !isDigestHour(prefs.daily_digest_hour, now)) continue
    const userId = prefs.user_id
    const mine = apts.filter((a) => a.user_id === userId)
    if (mine.length === 0) continue
    const recent = changesRes.data.filter((c) => c.user_id === userId && new Date(c.detected_at).getTime() >= since24)
    const priceChanges = new Set(recent.filter((c) => c.kind === 'price_down' || c.kind === 'price_up').map((c) => c.apartment_id)).size
    const unavailable = new Set(recent.filter((c) => c.kind === 'status_change' && UNAVAILABLE.has(c.new_value ?? '')).map((c) => c.apartment_id)).size
    let top: { name: string; score: number; label: string; apartmentId: string }[] = []
    try {
      const opps = await loadOpportunities(admin, now, userId)
      top = mine
        .flatMap((a) => {
          const o = opps.get(a.id)
          return o?.ok ? [{ name: displayName(a), score: o.score, label: opportunityBand(o.score).label, apartmentId: a.id }] : []
        })
        .sort((p, q) => q.score - p.score)
        .slice(0, 3)
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : 'Falha ao calcular oportunidades.')
    }
    const stale = monitoringHealth(mine, now).staleExtension.map((a) => ({ name: displayName(a), url: a.url_original }))
    const data = { dateLabel, total: mine.length, priceChanges, unavailable, top, stale }

    const { data: inserted, error } = await admin
      .from('notifications')
      .upsert(
        [
          {
            user_id: userId,
            kind: 'digest',
            title: `Resumo de ${dateLabel}`,
            body: `${data.total} monitorados · ${priceChanges} com mudança de preço · ${unavailable} indisponíveis${stale.length ? ` · ${stale.length} para abrir (extensão)` : ''}`,
            dedupe_key: `digest:${userId}:${dateKey}`,
          },
        ],
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      .select('id')
    if (error) {
      out.errors.push(`Falha ao gravar o resumo: ${error.message}`)
      continue
    }
    if (!inserted.length) continue // já gerado hoje
    out.digests++
    if (cfg && prefs.email_enabled && prefs.notify_email) {
      const sent = await trySend(cfg, prefs.notify_email, renderDigestEmail(data, siteUrl()), out)
      if (sent !== null) {
        await admin.from('notifications').update({ emailed_at: now.toISOString() }).eq('id', inserted[0].id)
        out.emailed++
      }
    }
  }

  // Retenção: o JSON bruto das leituras é mantido por 90 dias (cabe no plano gratuito).
  const cutoff90 = new Date(now.getTime() - 90 * 86_400_000).toISOString()
  await admin.from('apartment_snapshots').update({ raw: null }).lt('checked_at', cutoff90).not('raw', 'is', null)

  return out
}

async function trySend(cfg: EmailConfig, to: string, msg: Parameters<typeof sendEmail>[2], out: NotificationRun): Promise<string | null> {
  try {
    return await sendEmail(cfg, to, msg)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'falha ao enviar e-mail'
    console.error('[notificações] e-mail', message)
    out.errors.push(message)
    return null
  }
}
