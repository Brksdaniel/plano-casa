import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { NewApartmentFlow } from './new-apartment-flow'

export const metadata: Metadata = { title: 'Adicionar apartamento' }

async function Flow({ searchParams }: { searchParams: Promise<{ url?: string | string[] }> }) {
  const { url } = await searchParams
  const initialUrl = typeof url === 'string' && /^https?:\/\//i.test(url) && url.length <= 2048 ? url : ''
  return <NewApartmentFlow initialUrl={initialUrl} />
}

export default function NewApartmentPage({ searchParams }: PageProps<'/apartamentos/novo'>) {
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
      <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
        <Flow searchParams={searchParams as Promise<{ url?: string | string[] }>} />
      </Suspense>
    </div>
  )
}
