import { describe, expect, it } from 'vitest'
import { priceStats, recentDropPct } from './price-stats'

const p = (day: number, rent: number | null) => ({ recorded_at: `2026-11-${String(day).padStart(2, '0')}T12:00:00Z`, rent })

describe('priceStats', () => {
  it('sem leituras de aluguel → null (nunca inventa valor)', () => {
    expect(priceStats([])).toBeNull()
    expect(priceStats([p(1, null)])).toBeNull()
  })

  it('inicial, atual, mínimo, máximo e variação desde o cadastro (ordem cronológica)', () => {
    const s = priceStats([p(5, 1400), p(1, 1500), p(9, 1450)])
    expect(s).toEqual({ initial: 1500, current: 1450, min: 1400, max: 1500, pctSinceStart: -3.33, readings: 3 })
  })

  it('uma leitura só: variação 0', () => {
    expect(priceStats([p(1, 1500)])?.pctSinceStart).toBe(0)
  })
})

describe('recentDropPct', () => {
  const now = new Date('2026-11-20T12:00:00Z')
  it('queda em relação ao maior aluguel dos últimos 14 dias', () => {
    expect(recentDropPct([p(10, 2000), p(18, 1800)], now)).toBe(10)
  })
  it('ignora leituras antigas e aumentos', () => {
    expect(recentDropPct([p(1, 3000), p(10, 1800), p(18, 1900)], new Date('2026-11-20T12:00:00Z'))).toBe(0)
  })
  it('sem leituras → 0', () => {
    expect(recentDropPct([], now)).toBe(0)
  })
})
