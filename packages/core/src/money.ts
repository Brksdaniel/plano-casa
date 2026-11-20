/**
 * Converte valores em reais escritos no padrão brasileiro para número.
 * "R$ 1.700,50" → 1700.5 · "1.700" → 1700 · "1700.5" → 1700.5. Sem número → undefined.
 */
export function parseBRL(input: string | number | undefined | null): number | undefined {
  if (input === undefined || input === null) return undefined
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : undefined

  const cleaned = input.replace(/[^\d.,]/g, '')
  if (!/\d/.test(cleaned)) return undefined

  let normalized: string
  if (cleaned.includes(',')) {
    // vírgula = decimal; pontos = milhar
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}
