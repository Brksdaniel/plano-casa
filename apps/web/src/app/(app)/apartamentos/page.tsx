import { Building2, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AddApartmentButton } from '@/components/add-apartment-button'
import { ApartmentCard } from '@/components/apartments/apartment-card'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { listApartments } from '@/lib/apartments/queries'
import { createServerSupabase } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Meus Apartamentos' }

async function ApartmentList({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const supabase = await createServerSupabase()
  const [apartments, { novo }] = await Promise.all([listApartments(supabase), searchParams])
  const now = new Date()

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

  return (
    <div className="space-y-4">
      {novo && apartments.some((a) => a.id === novo) && (
        <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" /> Imóvel adicionado. Ele aparece destacado abaixo.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {apartments.length} {apartments.length === 1 ? 'imóvel acompanhado' : 'imóveis acompanhados'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {apartments.map((a) => (
          <ApartmentCard key={a.id} apartment={a} now={now} highlight={a.id === novo} />
        ))}
      </div>
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
        <ApartmentList searchParams={searchParams as Promise<{ novo?: string }>} />
      </Suspense>
    </div>
  )
}
