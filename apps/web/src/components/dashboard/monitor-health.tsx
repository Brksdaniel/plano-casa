import { AlertTriangle, CheckCircle2, ExternalLink, Mail, Puzzle, Timer, XCircle } from 'lucide-react'
import Link from 'next/link'
import { displayName } from '@/lib/apartments/meta'
import { STALE_EXTENSION_DAYS } from '@/lib/apartments/health'
import { formatRelative } from '@/lib/format'

type Stale = { id: string; custom_name: string | null; source_title: string | null; url_original: string; last_success_at: string | null }

export function MonitorHealth({
  counts,
  stale,
  lastCronAt,
  emailConfigured,
  now,
}: {
  counts: { disponiveis: number; atencao: number; indisponiveis: number }
  stale: Stale[]
  lastCronAt: string | null
  emailConfigured: boolean
  now: Date
}) {
  const cronOk = lastCronAt !== null && now.getTime() - new Date(lastCronAt).getTime() < 26 * 3_600_000
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">Saúde do monitoramento</h3>
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-success/10 px-2 py-2.5">
            <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" /> Disponíveis
            </dt>
            <dd className="text-xl font-semibold">{counts.disponiveis}</dd>
          </div>
          <div className="rounded-xl bg-warning/15 px-2 py-2.5">
            <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 text-warning-foreground dark:text-warning" /> Atenção
            </dt>
            <dd className="text-xl font-semibold">{counts.atencao}</dd>
          </div>
          <div className="rounded-xl bg-muted px-2 py-2.5">
            <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <XCircle className="size-3.5" /> Indisponíveis
            </dt>
            <dd className="text-xl font-semibold">{counts.indisponiveis}</dd>
          </div>
        </dl>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Timer className={`mt-0.5 size-4 shrink-0 ${cronOk ? 'text-success' : 'text-warning-foreground dark:text-warning'}`} />
            <span>
              Verificação automática:{' '}
              {lastCronAt ? `última leitura ${formatRelative(lastCronAt, now)}` : 'ainda sem leituras agendadas'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Mail className={`mt-0.5 size-4 shrink-0 ${emailConfigured ? 'text-success' : 'text-muted-foreground'}`} />
            <span>
              E-mail:{' '}
              {emailConfigured ? (
                'ativo'
              ) : (
                <Link href="/configuracoes" className="underline">
                  não configurado
                </Link>
              )}
            </span>
          </li>
        </ul>

        <div className="border-t pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Puzzle className="size-4 text-muted-foreground" /> Abra para atualizar ({stale.length})
          </p>
          {stale.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum anúncio “via extensão” está há mais de {STALE_EXTENSION_DAYS} dias sem atualização.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stale.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url_original}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="truncate">{displayName(a)}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {a.last_success_at ? formatRelative(a.last_success_at, now) : 'nunca lido'} <ExternalLink className="size-3" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
