import { describe, expect, it } from 'vitest'
import { applyListFilters, parseListFilters } from './filters'

type A = Parameters<typeof applyListFilters>[0][number]
const a = (id: string, extra: Partial<A> = {}): A => ({
  id,
  custom_name: null,
  source_title: `Apto ${id}`,
  neighborhood: 'Centro',
  city: 'Curitiba',
  status: 'ativo',
  monitor_mode: 'auto',
  total_monthly: 1500,
  rent: 1200,
  priority: 3,
  created_at: '2026-11-01T00:00:00Z',
  ...extra,
})

describe('parseListFilters', () => {
  it('valores desconhecidos voltam ao padrão', () => {
    expect(parseListFilters({ situacao: 'xpto', modo: 'zzz', ordem: '1', q: '  ' })).toEqual({
      situacao: 'todos',
      modo: 'todos',
      ordem: 'recentes',
      q: '',
    })
  })
  it('aceita os valores válidos', () => {
    expect(parseListFilters({ situacao: 'atencao', modo: 'extension', ordem: 'menor_total', q: 'bacacheri' })).toMatchObject({
      situacao: 'atencao',
      modo: 'extension',
      ordem: 'menor_total',
      q: 'bacacheri',
    })
  })
})

describe('applyListFilters', () => {
  const list = [
    a('1', { status: 'ativo', total_monthly: 2000, created_at: '2026-11-03T00:00:00Z' }),
    a('2', { status: 'erro_acesso', monitor_mode: 'extension', total_monthly: 1000, neighborhood: 'Bacacheri' }),
    a('3', { status: 'removido', rent: null, total_monthly: 0, priority: 5, created_at: '2026-11-02T00:00:00Z' }),
  ]

  it('situação: disponíveis / atenção / indisponíveis', () => {
    const f = (situacao: string) => applyListFilters(list, parseListFilters({ situacao })).map((x) => x.id)
    expect(f('disponiveis')).toEqual(['1'])
    expect(f('atencao')).toEqual(['2'])
    expect(f('indisponiveis')).toEqual(['3'])
  })

  it('modo e busca por texto (sem acento, sem maiúsculas)', () => {
    expect(applyListFilters(list, parseListFilters({ modo: 'extension' })).map((x) => x.id)).toEqual(['2'])
    expect(applyListFilters(list, parseListFilters({ q: 'BACACHÉRI' })).map((x) => x.id)).toEqual(['2'])
  })

  it('ordem por menor total deixa quem não tem aluguel no fim', () => {
    expect(applyListFilters(list, parseListFilters({ ordem: 'menor_total' })).map((x) => x.id)).toEqual(['2', '1', '3'])
  })

  it('ordem por oportunidade usa a nota (sem nota vai para o fim)', () => {
    const scores = new Map([
      ['1', 40],
      ['2', 80],
    ])
    expect(applyListFilters(list, parseListFilters({ ordem: 'oportunidade' }), scores).map((x) => x.id)).toEqual(['2', '1', '3'])
  })

  it('ordem por prioridade e recentes', () => {
    expect(applyListFilters(list, parseListFilters({ ordem: 'prioridade' }))[0].id).toBe('3')
    expect(applyListFilters(list, parseListFilters({})).map((x) => x.id)).toEqual(['1', '3', '2'])
  })
})
