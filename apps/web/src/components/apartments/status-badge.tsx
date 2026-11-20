import type { ApartmentStatus, MonitorMode } from '@/lib/database.types'
import { MODE_META, STATUS_META, TONE_CLASS } from '@/lib/apartments/meta'
import { Bot, Pencil, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: ApartmentStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span
      title={meta.hint}
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE_CLASS[meta.tone], className)}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {meta.label}
    </span>
  )
}

const MODE_ICON = { auto: Bot, extension: Puzzle, manual: Pencil } as const

export function ModeBadge({ mode, className }: { mode: MonitorMode; className?: string }) {
  const Icon = MODE_ICON[mode]
  return (
    <span
      title={MODE_META[mode].hint}
      className={cn('inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur', className)}
    >
      <Icon className="size-3.5" />
      {MODE_META[mode].label}
    </span>
  )
}
