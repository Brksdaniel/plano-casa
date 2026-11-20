import { Activity, Building2, CheckCircle2, TrendingDown, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AddApartmentButton } from '@/components/add-apartment-button'
import { ApartmentCard } from '@/components/apartments/apartment-card'
import { ChangeIcon } from '@/components/apartments/change-icon'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { displayName } from '@/lib/apartments/meta'
import { listApartments, listPriceTrends, recentChanges } from '@/lib/apartments/queries'
import { describeChange, priceTrend } from '@/lib/apartments/trend'
import { formatBRL, formatRelative } from '@/lib/format'
import { createServerSupabase } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

function Kpi({
  label,
  icon: Icon,
  value,
  caption,
  muted,
  className,
}: {
  label: string
  icon: typeof Building2
  value: string
  caption: string
  muted?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-4 shadow-xs sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tracking-tight', muted && 'text-muted-foreground/60')}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}

async function Overview() {
  const supabase = await createServerSupabase()
  const [apartments, trends, changes] = await Promise.all([
    listApartments(supabase),
    listPriceTrends(supabase),
    recentChanges(supabase, { days: 30, limit: 60 }),
  ])
  const now = new Date()
  const byId = new Map(apartments.map((a) => [a.id, a]))
  const within = (iso: string, days: number) => now.getTime() - new Date(iso).getTime() <= days * 86_400_000

  const available = apartments.filter((a) => a.status === 'ativo').length
  const withRent = apartments.filter((a) => a.rent !== null)
  const avg = withRent.length ? withRent.reduce((s, a) => s + a.total_monthly, 0) / withRent.length : null
  const reductions = new Set(changes.filter((c) => c.kind === 'price_down' && within(c.detected_at, 14)).map((c) => c.apartment_id))
  const changed = new Set(changes.filter((c) => within(c.detected_at, 7)).map((c) => c.apartment_id))
  const timeline = changes.filter((c) => byId.has(c.apartment_id)).slice(0, 8)

  return (
    <>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Kpi label="Monitorados" icon={Building2} value={String(apartments.length)} caption="imóveis cadastrados" />
        <Kpi label="Disponíveis" icon={CheckCircle2} value={String(available)} caption="ativos na última leitura" />
        <Kpi label="Reduções recentes" icon={TrendingDown} value={String(reductions.size)} caption="aluguel caiu nos últimos 14 dias" />
        <Kpi label="Com alterações" icon={Activity} value={String(changed.size)} caption="mudaram nos últimos 7 dias" />
        <Kpi
          label="Média do total mensal"
          icon={Wallet}
          value={avg === null ? '—' : formatBRL(Math.round(avg))}
          caption={withRent.length ? `de ${withRent.length} com aluguel informado` : 'sem valores ainda'}
          muted={avg === null}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      {apartments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum apartamento monitorado"
          description="Quando você adicionar o link de um anúncio, as novidades, oportunidades e o status do monitoramento aparecem aqui."
          action={<AddApartmentButton />}
        />
      ) : (
        <>
          <section className="space-y-4">
            <h3 className="font-semibold">Novidades</h3>
            {timeline.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">
                Nenhuma mudança detectada nos últimos 30 dias. As verificações automáticas aparecem aqui quando algo mudar.
              </p>
            ) : (
              <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
                {timeline.map((c) => {
                  const apt = byId.get(c.apartment_id)!
                  return (
                    <li key={c.id}>
                      <Link href={`/apartamentos/${apt.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                        <ChangeIcon kind={c.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{displayName(apt)}</p>
                          <p className="text-sm text-muted-foreground">{describeChange(c)}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.detected_at, now)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h3 className="font-semibold">Adicionados recentemente</h3>
              <Link href="/apartamentos" className="text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {apartments.slice(0, 3).map((a) => (
                <ApartmentCard
                  key={a.id}
                  apartment={a}
                  now={now}
                  trend={priceTrend(trends.get(a.id)?.latest_rent ?? null, trends.get(a.id)?.previous_rent ?? null)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
          <p className="mt-1 text-sm text-muted-foreground">O resumo dos apartamentos que você acompanha.</p>
        </div>
        <AddApartmentButton />
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        }
      >
        <Overview />
      </Suspense>
    </div>
  )
}
