import type { ReactNode } from 'react'
import { Brand } from '@/components/brand'
import { NavLinks } from './nav-links'

/** Menu lateral fixo em telas ≥ 1024 px. */
export function Sidebar({ footer }: { footer: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
      <Brand className="px-2" />
      <p className="mt-8 mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">Menu</p>
      <NavLinks />
      <div className="mt-auto">{footer}</div>
    </aside>
  )
}
