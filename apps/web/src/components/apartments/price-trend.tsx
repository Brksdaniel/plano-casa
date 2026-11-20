import { TrendingDown, TrendingUp } from 'lucide-react'
import type { Trend } from '@/lib/apartments/trend'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Verde = redução de preço; vermelho = aumento (cores do spec). */
export function PriceTrendBadge({ trend, className }: { trend: Trend | undefined; className?: string }) {
  if (!trend || (trend.direction !== 'down' && trend.direction !== 'up')) return null
  const down = trend.direction === 'down'
  const Icon = down ? TrendingDown : TrendingUp
  return (
    <span
      title={down ? 'O aluguel caiu desde a leitura anterior' : 'O aluguel subiu desde a leitura anterior'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        down ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive',
        className,
      )}
    >
      <Icon className="size-3.5" />
      {down ? '−' : '+'}
      {formatBRL(Math.abs(trend.diffAbs))} ({pct.format(Math.abs(trend.diffPct))}%)
    </span>
  )
}
