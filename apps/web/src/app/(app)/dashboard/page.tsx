import { Activity, Building2, CheckCircle2, TrendingDown, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import { AddApartmentButton } from '@/components/add-apartment-button'
import { EmptyState } from '@/components/empty-state'

export const metadata: Metadata = { title: 'Dashboard' }

const KPIS = [
  { label: 'Monitorados', icon: Building2 },
  { label: 'Disponíveis', icon: CheckCircle2 },
  { label: 'Reduções recentes', icon: TrendingDown },
  { label: 'Com alterações', icon: Activity },
  { label: 'Média do total mensal', icon: Wallet },
] as const

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O resumo dos apartamentos que você acompanha aparece aqui.
          </p>
        </div>
        <AddApartmentButton />
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {KPIS.map(({ label, icon: Icon }, i) => (
          <div
            key={label}
            className={`rounded-2xl border bg-card p-4 shadow-xs sm:p-5 ${i === KPIS.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-muted-foreground/60">—</p>
            <p className="mt-1 text-xs text-muted-foreground">Sem dados ainda</p>
          </div>
        ))}
      </section>

      <EmptyState
        icon={Building2}
        title="Nenhum apartamento monitorado"
        description="Quando você adicionar o link de um anúncio, as novidades, oportunidades e o status do monitoramento aparecem aqui."
        action={<AddApartmentButton />}
      />
    </div>
  )
}
