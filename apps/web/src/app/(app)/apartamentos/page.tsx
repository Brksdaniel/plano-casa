import { Building2, CheckCircle2, SearchX } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AddApartmentButton } from '@/components/add-apartment-button'
import { ApartmentCard } from '@/components/apartments/apartment-card'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { applyListFilters, parseListFilters } from '@/lib/apartments/filters'
import { loadOpportunities } from '@/lib/apartments/opportunity-data'
import { listApartments, listPriceTrends } from '@/lib/apartments/queries'
import { priceTrend } from '@/lib/apartments/trend'
import { createServerSupabase } from '@/lib/supabase/server'
import { ListFilters } from './list-filters'

export const metadata: Metadata = { title: 'Meus Apartamentos' }

type Params = Record<string, string | string[] | undefined>

async function ApartmentList({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createServerSupabase()
  const now = new Date()
  const [apartments, trends, opportunities, params] = await Promise.all([
    listApartments(supabase),
    listPriceTrends(supabase),
    loadOpportunities(supabase, now),
    searchParams,
  ])
  const novo = typeof params.novo === 'string' ? params.novo : undefined

  if (apartments.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Você ainda não cadastrou nenhum apartamento"
        description="Copie o link de um anúncio, cole aqui e o DENIELS HOME TRACKER passa a acompanhar preço e disponibilidade."
        action={<AddApartmentButton />}
      />
    )
  }

  const scores = new Map<string, number>()
  for (const [id, o] of opportunities) if (o.ok) scores.set(id, o.score)
  const visible = applyListFilters(apartments, parseListFilters(params), scores)

  return (
    <div className="space-y-4">
      {novo && apartments.some((a) => a.id === novo) && (
        <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" /> Imóvel adicionado. Ele aparece destacado abaixo.
        </p>
      )}
      <ListFilters />
      <p className="text-sm text-muted-foreground">
        {visible.length === apartments.length
          ? `${apartments.length} ${apartments.length === 1 ? 'imóvel acompanhado' : 'imóveis acompanhados'}`
          : `${visible.length} de ${apartments.length} imóveis`}
      </p>
      {visible.length === 0 ? (
        <EmptyState icon={SearchX} title="Nenhum imóvel com esses filtros" description="Ajuste a busca ou clique em “Limpar”." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((a) => (
            <ApartmentCard
              key={a.id}
              apartment={a}
              now={now}
              highlight={a.id === novo}
              opportunity={opportunities.get(a.id)}
              trend={priceTrend(trends.get(a.id)?.latest_rent ?? null, trends.get(a.id)?.previous_rent ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-80 rounded-2xl" />
      ))}
    </div>
  )
}

export default function ApartmentsPage({ searchParams }: PageProps<'/apartamentos'>) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Meus Apartamentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Os anúncios que você cadastrou para acompanhar.</p>
        </div>
        <AddApartmentButton />
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <ApartmentList searchParams={searchParams as Promise<Params>} />
      </Suspense>
    </div>
  )
}
