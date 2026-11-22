import { PLATFORM_LABEL, type Platform } from '@deniels/core'
import { ArrowLeft, ExternalLink, House, Info, LineChart, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Freshness } from '@/components/apartments/freshness'
import { ModeBadge, StatusBadge } from '@/components/apartments/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MODE_META, STATUS_META, displayName } from '@/lib/apartments/meta'
import { getApartment, recentChanges } from '@/lib/apartments/queries'
import { describeChange } from '@/lib/apartments/trend'
import { ChangeIcon } from '@/components/apartments/change-icon'
import { OpportunityBadge } from '@/components/apartments/opportunity-badge'
import { PriceChart } from '@/components/apartments/price-chart'
import { OPPORTUNITY_DISCLAIMER, type Opportunity, opportunityBand } from '@/lib/apartments/opportunity'
import { loadOpportunities, priceHistory } from '@/lib/apartments/opportunity-data'
import { priceStats } from '@/lib/apartments/price-stats'
import { formatBRL, formatDateTime, formatRelative } from '@/lib/format'
import { createServerSupabase } from '@/lib/supabase/server'
import { DeleteApartmentButton } from './delete-button'
import { EditDetailsDialog } from './edit-details-dialog'
import { ManualUpdateDialog } from './manual-update-dialog'
import { RefreshButton } from './refresh-button'

export const metadata: Metadata = { title: 'Detalhes do imóvel' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const supabase = await createServerSupabase()
  const now = new Date()
  const [a, changes, history, opportunities] = await Promise.all([
    getApartment(supabase, id),
    recentChanges(supabase, { days: 3650, limit: 30, apartmentId: id }),
    priceHistory(supabase, id),
    loadOpportunities(supabase, now),
  ])
  if (!a) notFound()
  const stats = priceStats(history)
  const opportunity = opportunities.get(a.id)

  const name = displayName(a)
  const dash = (v: number | string | null, suffix = '') => (v === null || v === '' ? '—' : `${v}${suffix}`)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="line-clamp-3 text-xl font-semibold tracking-tight sm:text-2xl" title={name}>
            {name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[a.neighborhood, a.city].filter(Boolean).join(' · ') || 'Localização não informada'} ·{' '}
            {PLATFORM_LABEL[a.platform as Platform] ?? a.platform}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            <ModeBadge mode={a.monitor_mode} className="border" />
            <OpportunityBadge opportunity={opportunity} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {a.monitor_mode === 'auto' && <RefreshButton id={a.id} />}
          <Button variant={a.monitor_mode === 'auto' ? 'outline' : 'default'} asChild>
            <a href={a.url_original} target="_blank" rel="noreferrer noopener">
              {a.monitor_mode === 'extension' ? 'Abrir anúncio para atualizar' : 'Abrir anúncio'} <ExternalLink />
            </a>
          </Button>
          <ManualUpdateDialog id={a.id} rent={a.rent} condoFee={a.condo_fee} iptu={a.iptu} />
          <EditDetailsDialog id={a.id} customName={a.custom_name} priority={a.priority} notes={a.notes} />
          <DeleteApartmentButton id={a.id} name={name} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          {a.main_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.main_image_url} alt="" referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-cover" />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center bg-muted text-muted-foreground">
              <House className="size-12 opacity-40" />
            </div>
          )}
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Total mensal estimado</p>
            <p className="text-3xl font-semibold tracking-tight">{a.rent === null ? '—' : formatBRL(a.total_monthly)}</p>
            <Freshness
              lastSuccessAt={a.last_success_at}
              lastSource={a.last_source}
              confidence={a.confidence}
              now={now}
              className="mt-2"
            />
            <p className="mt-3 text-xs text-muted-foreground">{STATUS_META[a.status].hint}</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h3 className="font-semibold">Valores</h3>
            <dl className="mt-2 divide-y">
              <Row label="Aluguel" value={formatBRL(a.rent)} />
              <Row label="Condomínio" value={formatBRL(a.condo_fee)} />
              <Row label="IPTU" value={formatBRL(a.iptu)} />
            </dl>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h3 className="font-semibold">Características</h3>
            <dl className="mt-2 divide-y">
              <Row label="Quartos" value={dash(a.bedrooms)} />
              <Row label="Banheiros" value={dash(a.bathrooms)} />
              <Row label="Vagas" value={dash(a.parking)} />
              <Row label="Área" value={dash(a.area_m2, ' m²')} />
              <Row label="Prioridade" value={`${a.priority} de 5`} />
            </dl>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h3 className="font-semibold">Monitoramento</h3>
            <dl className="mt-2 divide-y">
              <Row label="Modo" value={MODE_META[a.monitor_mode].label} />
              <Row label="Última tentativa" value={formatDateTime(a.last_check_at)} />
              <Row label="Último dado válido" value={formatDateTime(a.last_success_at)} />
              <Row label="Cadastrado em" value={formatDateTime(a.created_at)} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{MODE_META[a.monitor_mode].hint}</p>
          </section>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <LineChart className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Evolução do preço</h3>
          </div>
          {stats ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Inicial" value={formatBRL(stats.initial)} />
                <Stat label="Atual" value={formatBRL(stats.current)} />
                <Stat label="Mínimo" value={formatBRL(stats.min)} />
                <Stat label="Máximo" value={formatBRL(stats.max)} />
                <Stat
                  label="Desde o cadastro"
                  value={`${stats.pctSinceStart > 0 ? '+' : ''}${stats.pctSinceStart.toLocaleString('pt-BR')}%`}
                  className={stats.pctSinceStart < 0 ? 'text-success' : stats.pctSinceStart > 0 ? 'text-destructive' : undefined}
                />
              </dl>
              <div className="mt-4">
                <PriceChart
                  points={history.map((h) => ({
                    at: h.recorded_at,
                    rent: h.rent === null ? null : Number(h.rent),
                    total: h.total_monthly === null ? null : Number(h.total_monthly),
                    source: h.source,
                  }))}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.readings} {stats.readings === 1 ? 'leitura registrada' : 'leituras registradas'}. Uma nova leitura é guardada quando
                o valor muda ou uma vez por dia de monitoramento.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Ainda não há leituras de preço confiáveis para este imóvel.</p>
          )}
        </div>
        <OpportunityCard opportunity={opportunity} missingFees={a.condo_fee === null || a.iptu === null} />
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <h3 className="font-semibold">Observações</h3>
        <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
          {a.notes || 'Nenhuma observação ainda. Use “Editar” para anotar impressões da visita, contato do corretor etc.'}
        </p>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-xs">
        <h3 className="font-semibold">Linha do tempo</h3>
        {changes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma mudança detectada até agora.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {changes.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <ChangeIcon kind={c.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{describeChange(c)}</p>
                  <p className="text-xs text-muted-foreground" title={formatDateTime(c.detected_at)}>
                    {formatRelative(c.detected_at, now)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

    </div>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-semibold ${className ?? ''}`}>{value}</dd>
    </div>
  )
}

function OpportunityCard({ opportunity, missingFees }: { opportunity?: Opportunity; missingFees: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-muted-foreground" />
        <h3 className="font-semibold">Indicador de oportunidade</h3>
      </div>
      {opportunity?.ok ? (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{opportunity.score}</span>
            <span className="text-sm text-muted-foreground">de 100 · {opportunityBand(opportunity.score).label}</span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {opportunity.parts.map((p) => (
              <li key={p.key}>
                <div className="flex justify-between text-xs">
                  <span>
                    {p.label} <span className="text-muted-foreground">({p.weight}%)</span>
                  </span>
                  <span className="font-medium">{Math.round(p.value * 100)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(p.value * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Comparado com {opportunity.comparables} imóveis com o mesmo nº de quartos (mediana do total: {formatBRL(opportunity.median)}).
          </p>
          {missingFees && (
            <p className="mt-2 rounded-lg bg-warning/15 px-2.5 py-1.5 text-xs">
              Condomínio ou IPTU não informados: o total pode estar subestimado e a nota, otimista.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {opportunity?.reason === 'no_price'
            ? 'Sem total mensal verificado para calcular.'
            : `Dados insuficientes para comparar: são necessários pelo menos 3 imóveis ativos com o mesmo nº de quartos (hoje: ${opportunity?.comparables ?? 0}).`}
        </p>
      )}
      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-foreground">
          <Info className="size-3.5" /> Como calculamos
        </summary>
        <p className="mt-2">
          40% total mensal comparado à mediana dos seus imóveis com o mesmo nº de quartos · 20% redução de preço nos últimos 14 dias · 20%
          sua prioridade · 20% custo por m² (quando há área informada; senão o peso é redistribuído).
        </p>
        <p className="mt-2 italic">{OPPORTUNITY_DISCLAIMER}</p>
      </details>
    </div>
  )
}

export default function ApartmentDetailPage({ params }: PageProps<'/apartamentos/[id]'>) {
  return (
    <div className="space-y-4">
      <Link
        href="/apartamentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Meus Apartamentos
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  )
}
