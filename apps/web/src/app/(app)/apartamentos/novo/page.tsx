import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NewApartmentFlow } from './new-apartment-flow'

export const metadata: Metadata = { title: 'Adicionar apartamento' }

export default function NewApartmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/apartamentos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Meus Apartamentos
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Adicionar apartamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cole o link, confira os dados e salve. Simples assim.</p>
      </div>
      <NewApartmentFlow />
    </div>
  )
}
