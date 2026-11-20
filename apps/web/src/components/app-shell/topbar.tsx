'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, Suspense } from 'react'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { MobileNav } from './mobile-nav'
import { NAV_ITEMS, activeNavHref } from './nav-items'

function PageTitle() {
  const active = activeNavHref(usePathname())
  return <>{NAV_ITEMS.find((i) => i.href === active)?.label ?? ''}</>
}

export function Topbar({ mobileFooter }: { mobileFooter: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <MobileNav footer={mobileFooter} />
      <Brand compact className="lg:hidden" />
      <h1 className="ml-1 truncate text-base font-semibold tracking-tight lg:ml-0 lg:text-lg">
        {/* usePathname suspende em rotas dinâmicas com Cache Components */}
        <Suspense fallback={null}>
          <PageTitle />
        </Suspense>
      </h1>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/notificacoes" aria-label="Notificações">
            <Bell />
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
