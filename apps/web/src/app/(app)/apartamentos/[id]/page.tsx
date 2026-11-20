import { PLATFORM_LABEL, type Platform } from '@deniels/core'
import { ArrowLeft, ExternalLink, House, LineChart } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Freshness } from '@/components/apartments/freshness'
import { ModeBadge, StatusBadge } from '@/components/apartments/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MODE_META, STATUS_META, displayName } from '@/lib/apartments/meta'
import { getApartment } from '@/lib/apartments/queries'
import { formatBRL, formatDateTime } from '@/lib/format'
import { createServerSupabase } from '@/lib/supabase/server'
import { DeleteApartmentButton } from './delete-button'

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
  const a = await getApartment(supabase, id)
  if (!a) notFound()

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
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <a href={a.url_original} target="_blank" rel="noreferrer noopener">
              Abrir anúncio <ExternalLink />
            </a>
          </Button>
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
              now={new Date()}
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

      {a.notes && (
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="font-semibold">Observações</h3>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{a.notes}</p>
        </section>
      )}

      <section className="flex items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">
        <LineChart className="size-5 shrink-0" />
        Gráfico e histórico de preços chegam na Etapa 5. O primeiro preço já foi guardado.
      </section>
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
