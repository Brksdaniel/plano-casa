import { ShieldCheck } from 'lucide-react'
import { CONFIDENCE_LABEL, SOURCE_LABEL } from '@/lib/apartments/meta'
import type { ConfidenceLevel, DataSource } from '@/lib/database.types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const CONF_CLASS: Record<ConfidenceLevel, string> = {
  alta: 'text-success',
  media: 'text-warning-foreground dark:text-warning',
  baixa: 'text-muted-foreground',
}

/** "Atualizado há 3 h · via servidor · Confiabilidade Alta" */
export function Freshness({
  lastSuccessAt,
  lastSource,
  confidence,
  now,
  className,
}: {
  lastSuccessAt: string | null
  lastSource: DataSource | null
  confidence: ConfidenceLevel | null
  now: Date
  className?: string
}) {
  if (!lastSuccessAt) {
    return <p className={cn('text-xs text-muted-foreground', className)}>Ainda sem dados verificados</p>
  }
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground', className)} title={formatDateTime(lastSuccessAt)}>
      <span>Atualizado {formatRelative(lastSuccessAt, now)}</span>
      {lastSource && <span>· via {SOURCE_LABEL[lastSource]}</span>}
      {confidence && (
        <span className={cn('inline-flex items-center gap-0.5 font-medium', CONF_CLASS[confidence])}>
          · <ShieldCheck className="size-3.5" /> {CONFIDENCE_LABEL[confidence]}
        </span>
      )}
    </p>
  )
}
