import { Sparkles } from 'lucide-react'
import { TONE_CLASS } from '@/lib/apartments/meta'
import { type Opportunity, opportunityBand } from '@/lib/apartments/opportunity'
import { cn } from '@/lib/utils'

/** Selo compacto "Oportunidade 82 · Excelente" (some quando não há dados para comparar). */
export function OpportunityBadge({ opportunity, className }: { opportunity?: Opportunity; className?: string }) {
  if (!opportunity?.ok) return null
  const band = opportunityBand(opportunity.score)
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', TONE_CLASS[band.tone], className)}
      title={`Indicador de oportunidade: ${opportunity.score} de 100 (${band.label})`}
    >
      <Sparkles className="size-3" />
      {opportunity.score} · {band.label}
    </span>
  )
}
