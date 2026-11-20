import { Bell, Building2, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/apartamentos', label: 'Meus Apartamentos', icon: Building2 },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

/** Qual item do menu fica destacado para o caminho atual (inclui subpáginas). */
export function activeNavHref(pathname: string): string | null {
  const item = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
  return item?.href ?? null
}
