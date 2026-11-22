import { describe, expect, it } from 'vitest'
import { accessErrorNotification, notificationForChange } from './plan'

const prefs = { min_change_abs: 50, min_change_pct: 2 }
const change = (kind: string, extra: Record<string, unknown> = {}) =>
  ({
    id: 7,
    user_id: 'u1',
    apartment_id: 'a1',
    kind,
    old_value: '1500',
    new_value: '1400',
    diff_abs: -100,
    diff_pct: -6.67,
    detected_at: '2026-11-20T12:00:00Z',
    dedupe_key: 'x',
    ...extra,
  }) as Parameters<typeof notificationForChange>[0]

describe('notificationForChange', () => {
  it('queda de aluguel acima do limiar → notificação com dedupe por mudança', () => {
    const n = notificationForChange(change('price_down'), 'Ape Centro', prefs)
    expect(n).toMatchObject({
      user_id: 'u1',
      apartment_id: 'a1',
      change_id: 7,
      kind: 'price_down',
      dedupe_key: 'change:7',
      title: 'Aluguel caiu: Ape Centro',
    })
    expect(n?.body?.replace(/\s/g, ' ')).toContain('R$ 1.500')
    expect(n?.body?.replace(/\s/g, ' ')).toContain('R$ 1.400')
  })

  it('variação abaixo dos dois limiares → sem notificação', () => {
    expect(notificationForChange(change('price_up', { diff_abs: 20, diff_pct: 1, old_value: '2000', new_value: '2020' }), 'X', prefs)).toBeNull()
  })

  it('basta um dos limiares (R$ ou %)', () => {
    expect(notificationForChange(change('price_up', { diff_abs: 30, diff_pct: 3 }), 'X', prefs)).not.toBeNull()
    expect(notificationForChange(change('condo_change', { diff_abs: 60, diff_pct: 1 }), 'X', prefs)?.title).toBe('Condomínio mudou: X')
  })

  it('situação: indisponível/alugado/removido e "voltou" notificam; primeira leitura não', () => {
    const s = (o: string, n: string) => notificationForChange(change('status_change', { old_value: o, new_value: n, diff_abs: null, diff_pct: null }), 'X', prefs)
    expect(s('ativo', 'possivelmente_alugado')?.title).toBe('Pode ter sido alugado: X')
    expect(s('ativo', 'removido')?.title).toBe('Anúncio removido: X')
    expect(s('indisponivel', 'ativo')?.title).toBe('Voltou a ficar disponível: X')
    expect(s('nao_verificado', 'ativo')).toBeNull()
    expect(s('ativo', 'erro_acesso')).toBeNull()
  })

  it('descrição e fotos não notificam (evita ruído); características sim', () => {
    expect(notificationForChange(change('description_change'), 'X', prefs)).toBeNull()
    expect(notificationForChange(change('images_change'), 'X', prefs)).toBeNull()
    expect(notificationForChange(change('features_change', { old_value: '2 quartos', new_value: '3 quartos' }), 'X', prefs)).not.toBeNull()
  })
})

describe('accessErrorNotification', () => {
  const apt = { id: 'a1', user_id: 'u1', status: 'erro_acesso', consecutive_failures: 3, last_success_at: '2026-11-18T00:00:00Z' }
  it('só a partir de 3 falhas seguidas, uma vez por sequência', () => {
    expect(accessErrorNotification({ ...apt, consecutive_failures: 2 }, 'X')).toBeNull()
    const n = accessErrorNotification(apt, 'X')
    expect(n?.dedupe_key).toBe('apt:a1:access:2026-11-18T00:00:00Z')
    expect(n?.body).toContain('não significa que foi alugado')
  })
  it('outro status → nada', () => {
    expect(accessErrorNotification({ ...apt, status: 'ativo' }, 'X')).toBeNull()
  })
})
