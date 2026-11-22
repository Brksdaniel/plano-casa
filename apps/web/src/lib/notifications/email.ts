/**
 * E-mail via Resend (API HTTP, sem SDK). Sem RESEND_API_KEY o envio fica desativado e nada quebra.
 * O remetente de teste do Resend (onboarding@resend.dev) só entrega para o e-mail dono da conta Resend.
 */

const TZ = 'America/Sao_Paulo'

export function localHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(now))
}

export function isDigestHour(preferredHour: number, now: Date): boolean {
  return localHour(now) === preferredHour
}

/** AAAA-MM-DD no fuso de São Paulo (usado para deduplicar o resumo do dia). */
export function localDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export type EmailConfig = { apiKey: string; from: string }

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  if (!env.RESEND_API_KEY) return null
  return { apiKey: env.RESEND_API_KEY, from: env.NOTIFY_FROM_EMAIL || 'Deniels Home Tracker <onboarding@resend.dev>' }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export type EmailMessage = { subject: string; html: string; text: string }

function layout(title: string, inner: string, siteUrl: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f6fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2233">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="font-weight:700;letter-spacing:.02em;color:#5b4ff5;margin-bottom:16px">DENIELS HOME TRACKER</div>
<div style="background:#fff;border:1px solid #e8e9ef;border-radius:16px;padding:20px">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>${inner}</div>
<p style="font-size:12px;color:#6b6f80;margin-top:16px">Você recebe este e-mail porque ativou avisos no Deniels. Para mudar, abra <a href="${siteUrl}/configuracoes" style="color:#5b4ff5">Configurações</a>.</p>
</div></body></html>`
}

export type AlertItem = { title: string; body: string | null; apartmentId: string | null }

export function renderAlertsEmail(items: AlertItem[], siteUrl: string): EmailMessage {
  const subject = items.length === 1 ? `Deniels: ${items[0].title}` : `Deniels: ${items.length} novidades nos seus apartamentos`
  const rows = items
    .map((i) => {
      const href = i.apartmentId ? `${siteUrl}/apartamentos/${i.apartmentId}` : `${siteUrl}/notificacoes`
      return `<li style="margin:0 0 12px"><a href="${href}" style="color:#1f2233;font-weight:600;text-decoration:none">${escapeHtml(i.title)}</a>${
        i.body ? `<br><span style="color:#6b6f80;font-size:14px">${escapeHtml(i.body)}</span>` : ''
      }</li>`
    })
    .join('')
  const html = layout(subject.replace('Deniels: ', ''), `<ul style="padding-left:18px;margin:0">${rows}</ul>`, siteUrl)
  const text = items.map((i) => `• ${i.title}${i.body ? `\n  ${i.body}` : ''}`).join('\n') + `\n\n${siteUrl}/notificacoes`
  return { subject, html, text }
}

export type DigestData = {
  dateLabel: string
  total: number
  priceChanges: number
  unavailable: number
  top: { name: string; score: number; label: string; apartmentId: string }[]
  stale: { name: string; url: string }[]
}

export function renderDigestEmail(d: DigestData, siteUrl: string): EmailMessage {
  const subject = `Deniels: resumo de ${d.dateLabel}`
  const stats = [
    `${d.total} imóveis monitorados`,
    `${d.priceChanges} com mudança de preço nas últimas 24 h`,
    `${d.unavailable} ficaram indisponíveis nas últimas 24 h`,
  ]
  const top = d.top.length
    ? `<h2 style="font-size:15px;margin:20px 0 8px">Melhores oportunidades</h2><ol style="padding-left:18px;margin:0">${d.top
        .map(
          (t) =>
            `<li style="margin-bottom:6px"><a href="${siteUrl}/apartamentos/${t.apartmentId}" style="color:#1f2233">${escapeHtml(t.name)}</a> — <b>${t.score}</b> (${escapeHtml(t.label)})</li>`,
        )
        .join('')}</ol><p style="font-size:12px;color:#6b6f80">Estimativa baseada nos critérios cadastrados, não é avaliação imobiliária profissional.</p>`
    : ''
  const stale = d.stale.length
    ? `<h2 style="font-size:15px;margin:20px 0 8px">Abra para atualizar (via extensão)</h2><ul style="padding-left:18px;margin:0">${d.stale
        .map((s) => `<li style="margin-bottom:6px"><a href="${escapeHtml(s.url)}" style="color:#5b4ff5">${escapeHtml(s.name)}</a></li>`)
        .join('')}</ul>`
    : ''
  const html = layout(
    `Resumo de ${d.dateLabel}`,
    `<ul style="padding-left:18px;margin:0">${stats.map((s) => `<li>${s}</li>`).join('')}</ul>${top}${stale}<p style="margin-top:20px"><a href="${siteUrl}/dashboard" style="display:inline-block;background:#5b4ff5;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Abrir o painel</a></p>`,
    siteUrl,
  )
  const text = [
    `Resumo de ${d.dateLabel}`,
    ...stats.map((s) => `• ${s}`),
    ...(d.top.length ? ['', 'Melhores oportunidades:', ...d.top.map((t) => `• ${t.name} — ${t.score} (${t.label})`)] : []),
    ...(d.stale.length ? ['', 'Abra para atualizar:', ...d.stale.map((s) => `• ${s.name}: ${s.url}`)] : []),
    '',
    `${siteUrl}/dashboard`,
  ].join('\n')
  return { subject, html, text }
}

/** Envia pelo Resend. Lança erro com a resposta quando falha (quem chama decide o que registrar). */
export async function sendEmail(cfg: EmailConfig, to: string, msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to: [to], subject: msg.subject, html: msg.html, text: msg.text }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'falha ao enviar'}`)
  return body.id ?? ''
}
