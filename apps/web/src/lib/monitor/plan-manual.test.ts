import { describe, expect, it } from 'vitest'
import type { Tables } from '@/lib/database.types'
import { planManualUpdate } from './plan-manual'

const NOW = new Date('2026-11-21T12:00:00Z')
const RUN = '22222222-2222-2222-2222-222222222222'

function apt(over: Partial<Tables<'apartments'>> = {}) {
  return {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    user_id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
    status: 'nao_verificado',
    rent: 1500,
    condo_fee: null,
    iptu: null,
    bedrooms: 2,
    city: 'Curitiba',
    ...over,
  } as Tables<'apartments'>
}

describe('planManualUpdate', () => {
  it('aluguel 1500 → 1450 → price_down, preço manual, confiança baixa', () => {
    const p = planManualUpdate({ apartment: apt(), rent: 1450, availability: 'unknown', now: NOW, runId: RUN })
    expect(p.changes.map((c) => c.kind)).toEqual(['price_down'])
    expect(p.price).toMatchObject({ rent: 1450, source: 'manual' })
    expect(p.apartmentUpdate).toMatchObject({ rent: 1450, last_source: 'manual', last_success_at: NOW.toISOString(), confidence: 'baixa' })
    expect(p.snapshot).toMatchObject({ source: 'manual', rent: 1450, run_id: RUN })
  })

  it('"parece alugado" → possivelmente_alugado com evidência do usuário', () => {
    const p = planManualUpdate({ apartment: apt({ status: 'ativo' }), rent: 1500, availability: 'rented', now: NOW, runId: RUN })
    expect(p.apartmentUpdate.status).toBe('possivelmente_alugado')
    expect(p.changes.map((c) => c.kind)).toEqual(['status_change'])
    expect(p.statusRow).toMatchObject({ from_status: 'ativo', to_status: 'possivelmente_alugado', source: 'manual' })
    expect(p.statusRow?.evidence).toMatch(/você/i)
  })

  it('"disponível" → ativo', () => {
    const p = planManualUpdate({ apartment: apt(), rent: 1500, availability: 'available', now: NOW, runId: RUN })
    expect(p.apartmentUpdate.status).toBe('ativo')
  })

  it('nada mudou → sem preço novo nem mudanças, mas registra a conferência', () => {
    const p = planManualUpdate({ apartment: apt({ status: 'ativo' }), rent: 1500, availability: 'unknown', now: NOW, runId: RUN })
    expect(p.changes).toEqual([])
    expect(p.price).toBeNull()
    expect(p.statusRow).toBeNull()
    expect(p.apartmentUpdate.last_success_at).toBe(NOW.toISOString())
  })

  it('condomínio informado pela primeira vez → preço novo (total mudou), sem "mudança" de condomínio', () => {
    const p = planManualUpdate({ apartment: apt(), rent: 1500, condoFee: 300, availability: 'unknown', now: NOW, runId: RUN })
    expect(p.price).toMatchObject({ rent: 1500, condo_fee: 300 })
    expect(p.changes).toEqual([])
  })

  it('campo deixado vazio não apaga o valor anterior', () => {
    const p = planManualUpdate({ apartment: apt({ condo_fee: 250 }), rent: 1500, availability: 'unknown', now: NOW, runId: RUN })
    expect(p.apartmentUpdate).not.toHaveProperty('condo_fee')
  })
})
