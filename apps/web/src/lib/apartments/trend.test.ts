import { describe, expect, it } from 'vitest'
import type { Tables } from '@/lib/database.types'
import { describeChange, priceTrend } from './trend'

const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('priceTrend', () => {
  it('queda', () => expect(priceTrend(1650, 1700)).toEqual({ direction: 'down', diffAbs: -50, diffPct: -2.94 }))
  it('alta', () => expect(priceTrend(1700, 1650)).toMatchObject({ direction: 'up', diffAbs: 50 }))
  it('igual', () => expect(priceTrend(1700, 1700).direction).toBe('flat'))
  it('sem anterior', () => expect(priceTrend(1700, null).direction).toBe('none'))
  it('sem atual', () => expect(priceTrend(null, 1700).direction).toBe('none'))
})

function change(over: Partial<Tables<'apartment_changes'>>): Tables<'apartment_changes'> {
  return {
    id: 1,
    user_id: 'u',
    apartment_id: 'a',
    detected_at: '2026-11-21T12:00:00Z',
    kind: 'price_down',
    old_value: null,
    new_value: null,
    diff_abs: null,
    diff_pct: null,
    dedupe_key: 'k',
    ...over,
  }
}

describe('describeChange', () => {
  it('queda de aluguel', () => {
    expect(nbsp(describeChange(change({ kind: 'price_down', old_value: '1700', new_value: '1650', diff_abs: -50, diff_pct: -2.94 })))).toBe(
      'Aluguel caiu R$ 50 (−2,9%): de R$ 1.700 para R$ 1.650',
    )
  })
  it('aumento de aluguel', () => {
    expect(nbsp(describeChange(change({ kind: 'price_up', old_value: '1500', new_value: '1600', diff_abs: 100, diff_pct: 6.67 })))).toBe(
      'Aluguel subiu R$ 100 (+6,7%): de R$ 1.500 para R$ 1.600',
    )
  })
  it('condomínio', () => {
    expect(nbsp(describeChange(change({ kind: 'condo_change', old_value: '270', new_value: '300' })))).toBe(
      'Condomínio mudou de R$ 270 para R$ 300',
    )
  })
  it('status', () => {
    expect(describeChange(change({ kind: 'status_change', old_value: 'ativo', new_value: 'indisponivel' }))).toBe(
      'Situação: Ativo → Indisponível',
    )
  })
  it('características', () => {
    expect(describeChange(change({ kind: 'features_change', old_value: 'quartos 2', new_value: 'quartos 3' }))).toBe(
      'Características: quartos 2 → quartos 3',
    )
  })
  it('descrição e fotos', () => {
    expect(describeChange(change({ kind: 'description_change' }))).toBe('A descrição do anúncio mudou')
    expect(describeChange(change({ kind: 'images_change' }))).toBe('As fotos do anúncio mudaram')
  })
})
