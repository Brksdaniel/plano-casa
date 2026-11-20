'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, activeNavHref } from './nav-items'

type Props = { onNavigate?: () => void }

function NavList({ active, onNavigate }: Props & { active: string | null }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Navegação principal">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === active
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon
              className={cn('size-[18px] shrink-0', isActive ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-foreground')}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function ActiveNavList(props: Props) {
  return <NavList {...props} active={activeNavHref(usePathname())} />
}

/**
 * Com Cache Components, usePathname suspende em rotas dinâmicas (ex.: /apartamentos/[id]).
 * O fallback é a mesma lista sem destaque, então nada "pisca" além do item ativo.
 */
export function NavLinks(props: Props) {
  return (
    <Suspense fallback={<NavList {...props} active={null} />}>
      <ActiveNavList {...props} />
    </Suspense>
  )
}
