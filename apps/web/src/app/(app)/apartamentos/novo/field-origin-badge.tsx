import type { FieldOrigin } from '@/lib/apartments/schema'
import { cn } from '@/lib/utils'

const META: Record<FieldOrigin, { label: string; className: string; title: string }> = {
  page: {
    label: 'do anúncio',
    className: 'bg-success/10 text-success',
    title: 'Lido da página do anúncio agora',
  },
  url: {
    label: 'do link',
    className: 'bg-accent text-accent-foreground',
    title: 'Deduzido do próprio link (o site não foi aberto)',
  },
  user: {
    label: 'você',
    className: 'bg-muted text-muted-foreground',
    title: 'Preenchido ou alterado por você',
  },
}

export function FieldOriginBadge({ origin }: { origin?: FieldOrigin }) {
  if (!origin) return null
  const meta = META[origin]
  return (
    <span title={meta.title} className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase', meta.className)}>
      {meta.label}
    </span>
  )
}
