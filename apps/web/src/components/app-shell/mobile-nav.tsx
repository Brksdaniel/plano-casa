'use client'

import { Menu } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { NavLinks } from './nav-links'

/** Gaveta de navegação para telas < 1024 px. */
export function MobileNav({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 p-4">
        <SheetHeader className="p-2">
          <SheetTitle asChild>
            <div>
              <Brand />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Navegação principal</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-auto">{footer}</div>
      </SheetContent>
    </Sheet>
  )
}
