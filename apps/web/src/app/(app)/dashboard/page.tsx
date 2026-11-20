import { Activity, Building2, CheckCircle2, TrendingDown, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AddApartmentButton } from '@/components/add-apartment-button'
import { ApartmentCard } from '@/components/apartments/apartment-card'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { listApartments } from '@/lib/apartments/queries'
import { formatBRL } from '@/lib/format'
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
  const apartments = await listApartments(supabase)
  const now = new Date()

  const available = apartments.filter((a) => a.status === 'ativo').length
  const withRent = apartments.filter((a) => a.rent !== null)
  const avg = withRent.length ? withRent.reduce((s, a) => s + a.total_monthly, 0) / withRent.length : null

  return (
    <>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Kpi label="Monitorados" icon={Building2} value={String(apartments.length)} caption="imóveis cadastrados" />
        <Kpi label="Disponíveis" icon={CheckCircle2} value={String(available)} caption="ativos na última leitura" />
        <Kpi label="Reduções recentes" icon={TrendingDown} value="—" caption="a partir da Etapa 3" muted />
        <Kpi label="Com alterações" icon={Activity} value="—" caption="a partir da Etapa 3" muted />
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
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h3 className="font-semibold">Adicionados recentemente</h3>
            <Link href="/apartamentos" className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {apartments.slice(0, 3).map((a) => (
              <ApartmentCard key={a.id} apartment={a} now={now} />
            ))}
          </div>
        </section>
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
