import { Building2 } from 'lucide-react'
import type { Metadata } from 'next'
import { AddApartmentButton } from '@/components/add-apartment-button'
import { EmptyState } from '@/components/empty-state'

export const metadata: Metadata = { title: 'Meus Apartamentos' }

export default function ApartmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Meus Apartamentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Os anúncios que você cadastrou para acompanhar.</p>
        </div>
        <AddApartmentButton />
      </div>

      <EmptyState
        icon={Building2}
        title="Você ainda não cadastrou nenhum apartamento"
        description="Copie o link de um anúncio, cole aqui e o DENIELS HOME TRACKER passa a acompanhar preço e disponibilidade."
      />
    </div>
  )
}
