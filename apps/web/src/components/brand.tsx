import { House } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <House className="size-[18px]" strokeWidth={2.25} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">DENIELS</span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-muted-foreground">HOME TRACKER</span>
        </span>
      )}
    </div>
  )
}
