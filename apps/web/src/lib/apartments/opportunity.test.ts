import { describe, expect, it } from 'vitest'
import { type OpportunityInput, computeOpportunity, opportunityBand } from './opportunity'

const apt = (id: string, total: number, extra: Partial<OpportunityInput> = {}): OpportunityInput => ({
  id,
  bedrooms: 2,
  total_monthly: total,
  area_m2: null,
  priority: 3,
  status: 'ativo',
  dropPct: 0,
  ...extra,
})

describe('computeOpportunity', () => {
  it('menos de 3 comparáveis (mesmo nº de quartos) → dados insuficientes', () => {
    const all = [apt('a', 1500), apt('b', 1600), apt('c', 1700, { bedrooms: 1 })]
    expect(computeOpportunity(all[0], all)).toEqual({ ok: false, reason: 'insufficient', comparables: 2 })
  })

  it('sem total mensal → sem dados', () => {
    const all = [apt('a', 1500), apt('b', 1600), apt('c', 1700)]
    expect(computeOpportunity({ ...all[0], total_monthly: null }, all)).toEqual({ ok: false, reason: 'no_price', comparables: 0 })
  })

  it('ignora imóveis alugados/removidos na comparação', () => {
    const all = [apt('a', 1500), apt('b', 1600), apt('c', 1700, { status: 'removido' })]
    expect(computeOpportunity(all[0], all).ok).toBe(false)
  })

  it('preço na mediana, prioridade média, sem queda, sem área → 38', () => {
    const all = [apt('a', 1500), apt('b', 1600), apt('c', 1700)]
    const r = computeOpportunity(all[1], all)
    // preço: razão 1,0 → 0,5; queda 0; prioridade 3 → 0,5. Pesos 40/20/20 redistribuídos para 50/25/25.
    expect(r).toMatchObject({ ok: true, score: 38, median: 1600, comparables: 3 })
  })

  it('mais barato que a mediana, com queda e prioridade alta → nota alta', () => {
    const all = [apt('a', 1200, { priority: 5, dropPct: 10 }), apt('b', 1600), apt('c', 1700)]
    const r = computeOpportunity(all[0], all)
    expect(r.ok && r.score).toBeGreaterThanOrEqual(75)
    expect(r.ok && opportunityBand(r.score).label).toBe('Excelente')
  })

  it('usa custo por m² quando há área em pelo menos 3 comparáveis', () => {
    const all = [
      apt('a', 1500, { area_m2: 50 }),
      apt('b', 1500, { area_m2: 40 }),
      apt('c', 1500, { area_m2: 30 }),
    ]
    const big = computeOpportunity(all[0], all)
    const small = computeOpportunity(all[2], all)
    expect(big.ok && small.ok && big.score > small.score).toBe(true)
    expect(big.ok && big.parts.map((p) => p.key)).toEqual(['price', 'drop', 'priority', 'm2'])
  })
})

describe('opportunityBand', () => {
  it('faixas do desenho', () => {
    expect(opportunityBand(75).label).toBe('Excelente')
    expect(opportunityBand(55).label).toBe('Boa')
    expect(opportunityBand(35).label).toBe('Dentro do esperado')
    expect(opportunityBand(34).label).toBe('Pouco interessante')
  })
})
