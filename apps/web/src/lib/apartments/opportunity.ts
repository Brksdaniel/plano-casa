/**
 * Indicador de oportunidade (0–100). Fórmula explícita, exibida ao usuário:
 *   40% total mensal vs. mediana dos imóveis com o mesmo nº de quartos
 *   20% redução de preço nos últimos 14 dias
 *   20% prioridade definida pelo usuário
 *   20% custo por m² vs. mediana (só quando há área; senão o peso é redistribuído)
 * Exige pelo menos 3 imóveis comparáveis (incluindo o próprio).
 */

export type OpportunityInput = {
  id: string
  bedrooms: number | null
  total_monthly: number | null
  area_m2: number | null
  priority: number
  status: string
  /** Queda do aluguel nos últimos 14 dias (%), ver recentDropPct. */
  dropPct: number
}

export type OpportunityPart = { key: 'price' | 'drop' | 'priority' | 'm2'; label: string; weight: number; value: number }

export type Opportunity =
  | { ok: true; score: number; median: number; comparables: number; parts: OpportunityPart[] }
  | { ok: false; reason: 'insufficient' | 'no_price'; comparables: number }

export const MIN_COMPARABLES = 3
const INACTIVE = new Set(['possivelmente_alugado', 'indisponivel', 'removido'])

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** Razão 0,7 (30% abaixo da mediana) → 1; 1,0 → 0,5; 1,3 ou mais → 0. */
const ratioScore = (ratio: number) => clamp01((1.3 - ratio) / 0.6)

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function computeOpportunity(target: OpportunityInput, all: OpportunityInput[]): Opportunity {
  if (target.total_monthly === null || !(Number(target.total_monthly) > 0)) return { ok: false, reason: 'no_price', comparables: 0 }

  const peers = all.filter(
    (a) =>
      (a.id === target.id || !INACTIVE.has(a.status)) &&
      a.bedrooms === target.bedrooms &&
      a.total_monthly !== null &&
      Number(a.total_monthly) > 0,
  )
  if (!peers.some((p) => p.id === target.id)) peers.push(target)
  if (peers.length < MIN_COMPARABLES) return { ok: false, reason: 'insufficient', comparables: peers.length }

  const total = Number(target.total_monthly)
  const med = median(peers.map((p) => Number(p.total_monthly)))

  const parts: OpportunityPart[] = [
    { key: 'price', label: 'Total mensal vs. mediana', weight: 40, value: ratioScore(total / med) },
    { key: 'drop', label: 'Redução nos últimos 14 dias', weight: 20, value: clamp01(target.dropPct / 10) },
    { key: 'priority', label: 'Sua prioridade', weight: 20, value: clamp01((target.priority - 1) / 4) },
  ]

  const withArea = peers.filter((p) => p.area_m2 !== null && Number(p.area_m2) > 0)
  if (target.area_m2 !== null && Number(target.area_m2) > 0 && withArea.length >= MIN_COMPARABLES) {
    const medM2 = median(withArea.map((p) => Number(p.total_monthly) / Number(p.area_m2)))
    parts.push({ key: 'm2', label: 'Custo por m² vs. mediana', weight: 20, value: ratioScore(total / Number(target.area_m2) / medM2) })
  }

  const weightSum = parts.reduce((s, p) => s + p.weight, 0)
  const score = Math.round((parts.reduce((s, p) => s + p.weight * p.value, 0) / weightSum) * 100)
  return { ok: true, score, median: med, comparables: peers.length, parts }
}

export type Band = { label: string; tone: 'green' | 'blue' | 'gray' | 'yellow' }

export function opportunityBand(score: number): Band {
  if (score >= 75) return { label: 'Excelente', tone: 'green' }
  if (score >= 55) return { label: 'Boa', tone: 'blue' }
  if (score >= 35) return { label: 'Dentro do esperado', tone: 'gray' }
  return { label: 'Pouco interessante', tone: 'yellow' }
}

export const OPPORTUNITY_DISCLAIMER = 'Estimativa baseada nos critérios cadastrados, não é avaliação imobiliária profissional.'
