import { describe, expect, it } from 'vitest'
import { monitoringHealth } from './health'

const now = new Date('2026-11-20T12:00:00Z')
const a = (id: string, status: string, mode: string, last: string | null) => ({ id, status, monitor_mode: mode, last_success_at: last })

describe('monitoringHealth', () => {
  it('agrupa por situação e lista anúncios "via extensão" sem atualização há mais de 3 dias', () => {
    const h = monitoringHealth(
      [
        a('1', 'ativo', 'auto', '2026-11-20T00:00:00Z'),
        a('2', 'erro_acesso', 'extension', '2026-11-10T00:00:00Z'),
        a('3', 'ativo', 'extension', '2026-11-19T00:00:00Z'),
        a('4', 'nao_verificado', 'extension', null),
        a('5', 'removido', 'extension', '2026-11-01T00:00:00Z'),
      ],
      now,
    )
    expect(h.counts).toEqual({ disponiveis: 2, atencao: 2, indisponiveis: 1 })
    // removido não precisa ser aberto; nunca verificado precisa
    expect(h.staleExtension.map((x) => x.id)).toEqual(['4', '2'])
  })
})
