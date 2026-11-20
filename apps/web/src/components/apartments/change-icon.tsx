import { FileText, Images, Info, ListChecks, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import type { ChangeKind } from '@/lib/database.types'
import { cn } from '@/lib/utils'

const META: Record<ChangeKind, { icon: typeof Info; className: string }> = {
  price_down: { icon: TrendingDown, className: 'bg-success/10 text-success' },
  price_up: { icon: TrendingUp, className: 'bg-destructive/10 text-destructive' },
  condo_change: { icon: Receipt, className: 'bg-accent text-accent-foreground' },
  iptu_change: { icon: Receipt, className: 'bg-accent text-accent-foreground' },
  status_change: { icon: Info, className: 'bg-warning/15 text-warning-foreground dark:text-warning' },
  description_change: { icon: FileText, className: 'bg-muted text-muted-foreground' },
  features_change: { icon: ListChecks, className: 'bg-muted text-muted-foreground' },
  images_change: { icon: Images, className: 'bg-muted text-muted-foreground' },
}

export function ChangeIcon({ kind }: { kind: ChangeKind }) {
  const { icon: Icon, className } = META[kind]
  return (
    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
      <Icon className="size-4" />
    </span>
  )
}
