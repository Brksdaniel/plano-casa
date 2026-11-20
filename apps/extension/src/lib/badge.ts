export type BadgeKind = 'none' | 'add' | 'syncing' | 'connect'

/** O que mostrar na página do anúncio. Página de desafio ou que não é anúncio → nada. */
export function decideBadge(input: { isListing: boolean; challenge: boolean; tracked: boolean; connected: boolean }): BadgeKind {
  if (!input.isListing || input.challenge) return 'none'
  if (!input.connected) return 'connect'
  return input.tracked ? 'syncing' : 'add'
}
