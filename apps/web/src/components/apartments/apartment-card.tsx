import { BedDouble, Car, House, MapPin, Ruler } from 'lucide-react'
import Link from 'next/link'
import { displayName } from '@/lib/apartments/meta'
import type { ApartmentCardData } from '@/lib/apartments/queries'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Freshness } from './freshness'
import { ModeBadge, StatusBadge } from './status-badge'

export function ApartmentCard({ apartment: a, now, highlight }: { apartment: ApartmentCardData; now: Date; highlight?: boolean }) {
  const place = [a.neighborhood, a.city].filter(Boolean).join(' · ')
  const hasFees = a.condo_fee !== null || a.iptu !== null

  return (
    <Link
      href={`/apartamentos/${a.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        highlight && 'ring-2 ring-primary/60',
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {a.main_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.main_image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <House className="size-10 opacity-40" />
          </div>
        )}
        <StatusBadge status={a.status} className="absolute top-3 left-3 bg-background/90 shadow-sm backdrop-blur" />
        <ModeBadge mode={a.monitor_mode} className="absolute top-3 right-3" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-semibold tracking-tight" title={displayName(a)}>
            {displayName(a)}
          </h3>
          {place && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {a.bedrooms !== null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-4" /> {a.bedrooms} {a.bedrooms === 1 ? 'quarto' : 'quartos'}
            </span>
          )}
          {a.parking !== null && (
            <span className="inline-flex items-center gap-1">
              <Car className="size-4" /> {a.parking} {a.parking === 1 ? 'vaga' : 'vagas'}
            </span>
          )}
          {a.area_m2 !== null && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="size-4" /> {a.area_m2} m²
            </span>
          )}
        </div>

        <div className="mt-auto border-t pt-3">
          {a.rent !== null ? (
            <>
              <p className="text-xl font-semibold tracking-tight">
                {formatBRL(a.rent)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hasFees
                  ? `Cond. ${formatBRL(a.condo_fee)} · IPTU ${formatBRL(a.iptu)} · Total ${formatBRL(a.total_monthly)}`
                  : 'Condomínio e IPTU não informados'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aluguel não informado</p>
          )}
          <Freshness lastSuccessAt={a.last_success_at} lastSource={a.last_source} confidence={a.confidence} now={now} className="mt-2" />
        </div>
      </div>
    </Link>
  )
}
