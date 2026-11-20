import { describe, expect, it } from 'vitest'
import { type Observation, type StatusState, nextStatus } from './status'

const T0 = new Date('2026-11-20T00:00:00Z')
const h = (hours: number) => new Date(T0.getTime() + hours * 3_600_000)
const base: StatusState = { status: 'ativo', consecutiveFailures: 0, consecutiveNotFound: 0, lastNotFoundAt: null, mode: 'auto' }
const active: Observation = { kind: 'listing', availability: 'active', evidence: [] }

function run(start: StatusState, steps: [Observation, Date][]) {
  let s: StatusState = start
  let last = nextStatus(s, steps[0]![0], steps[0]![1])
  for (const [obs, at] of steps) {
    last = nextStatus(s, obs, at)
    s = last
  }
  return last
}

describe('nextStatus', () => {
  it('listing ativo mantém ativo e zera contadores', () => {
    const r = nextStatus({ ...base, consecutiveFailures: 2 }, active, T0)
    expect(r).toMatchObject({ status: 'ativo', consecutiveFailures: 0, consecutiveNotFound: 0, demoted: false })
  })

  it('3 bloqueios seguidos em modo auto → erro_acesso e passa para extensão', () => {
    const r = run(base, [
      [{ kind: 'blocked' }, h(0)],
      [{ kind: 'blocked' }, h(6)],
      [{ kind: 'blocked' }, h(12)],
    ])
    expect(r).toMatchObject({ status: 'erro_acesso', consecutiveFailures: 3, demoted: true, mode: 'extension' })
    expect(r.evidence).toMatch(/3 vezes/)
  })

  it('2 bloqueios não rebaixam', () => {
    const r = run(base, [
      [{ kind: 'failed' }, h(0)],
      [{ kind: 'blocked' }, h(6)],
    ])
    expect(r).toMatchObject({ status: 'erro_acesso', demoted: false, mode: 'auto' })
  })

  it('erro_acesso + página volta → ativo e contador zera', () => {
    const r = nextStatus({ ...base, status: 'erro_acesso', consecutiveFailures: 2 }, active, T0)
    expect(r).toMatchObject({ status: 'ativo', consecutiveFailures: 0 })
  })

  it('404 uma vez → verificação necessária; 6 h depois continua; 13 h depois da 1ª → removido', () => {
    const first = nextStatus(base, { kind: 'not_found' }, h(0))
    expect(first).toMatchObject({ status: 'verificacao_necessaria', consecutiveNotFound: 1, lastNotFoundAt: h(0).toISOString() })
    const second = nextStatus(first, { kind: 'not_found' }, h(6))
    expect(second.status).toBe('verificacao_necessaria')
    const third = nextStatus(second, { kind: 'not_found' }, h(13))
    expect(third.status).toBe('removido')
  })

  it('oferta explicitamente indisponível → indisponível com evidência', () => {
    const r = nextStatus(base, { kind: 'listing', availability: 'explicit_unavailable', evidence: ['OutOfStock'] }, T0)
    expect(r.status).toBe('indisponivel')
    expect(r.evidence).toMatch(/OutOfStock/)
  })

  it('listing sem disponibilidade explícita mantém ativo, senão pede verificação', () => {
    expect(nextStatus(base, { kind: 'listing', availability: 'unknown', evidence: [] }, T0).status).toBe('ativo')
    expect(nextStatus({ ...base, status: 'nao_verificado' }, { kind: 'listing', availability: 'unknown', evidence: [] }, T0).status).toBe(
      'verificacao_necessaria',
    )
  })

  it('nenhuma sequência de bloqueios/falhas produz indisponível, removido ou alugado', () => {
    const bad = new Set(['indisponivel', 'removido', 'possivelmente_alugado'])
    let s: StatusState = base
    const kinds: Observation[] = [{ kind: 'blocked' }, { kind: 'failed' }, { kind: 'other' }]
    for (let i = 0; i < 12; i++) {
      s = nextStatus(s, kinds[i % 3]!, h(i * 7))
      expect(bad.has(s.status)).toBe(false)
    }
  })

  it('bloqueio em modo extensão não "rebaixa" de novo', () => {
    const r = run({ ...base, mode: 'extension' }, [
      [{ kind: 'blocked' }, h(0)],
      [{ kind: 'blocked' }, h(6)],
      [{ kind: 'blocked' }, h(12)],
    ])
    expect(r.demoted).toBe(false)
  })
})
