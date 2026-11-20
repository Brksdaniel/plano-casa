import { describe, expect, it } from 'vitest'
import { detectChanges, hashList, hashText } from './changes'

describe('detectChanges', () => {
  it('queda de aluguel → price_down com diferença e percentual', () => {
    expect(detectChanges({ rent: 1700 }, { rent: 1650 }, 'ativo', 'ativo')).toEqual([
      { kind: 'price_down', oldValue: '1700', newValue: '1650', diffAbs: -50, diffPct: -2.94 },
    ])
  })

  it('aumento → price_up', () => {
    expect(detectChanges({ rent: 1500 }, { rent: 1600 }, 'ativo', 'ativo')[0]).toMatchObject({ kind: 'price_up', diffAbs: 100, diffPct: 6.67 })
  })

  it('sem mudança → nada', () => {
    expect(detectChanges({ rent: 1700, condoFee: 270 }, { rent: 1700, condoFee: 270 }, 'ativo', 'ativo')).toEqual([])
  })

  it('campo ausente na leitura nova nunca gera mudança', () => {
    expect(detectChanges({ rent: 1700, iptu: 80 }, {}, 'ativo', 'ativo')).toEqual([])
  })

  it('campo que aparece pela primeira vez não é "mudança"', () => {
    expect(detectChanges({}, { rent: 1700 }, 'ativo', 'ativo')).toEqual([])
  })

  it('condomínio e IPTU', () => {
    const r = detectChanges({ condoFee: 270, iptu: 50 }, { condoFee: 300, iptu: 60 }, 'ativo', 'ativo')
    expect(r.map((c) => c.kind)).toEqual(['condo_change', 'iptu_change'])
    expect(r[0]).toMatchObject({ oldValue: '270', newValue: '300', diffAbs: 30 })
  })

  it('características agrupadas num único features_change', () => {
    const r = detectChanges({ bedrooms: 2, parking: 1 }, { bedrooms: 3, parking: 0 }, 'ativo', 'ativo')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'features_change', oldValue: 'quartos 2, vagas 1', newValue: 'quartos 3, vagas 0' })
  })

  it('descrição e fotos por hash', () => {
    const r = detectChanges({ descriptionHash: 'a', imagesHash: 'x' }, { descriptionHash: 'b', imagesHash: 'y' }, 'ativo', 'ativo')
    expect(r.map((c) => c.kind)).toEqual(['description_change', 'images_change'])
  })

  it('status diferente → status_change', () => {
    expect(detectChanges({}, {}, 'ativo', 'indisponivel')).toEqual([
      { kind: 'status_change', oldValue: 'ativo', newValue: 'indisponivel', diffAbs: null, diffPct: null },
    ])
  })
})

describe('hashText / hashList', () => {
  it('ignora espaços extras e maiúsculas', () => {
    expect(hashText('  Olá   Mundo ')).toBe(hashText('olá mundo'))
    expect(hashText('a')).not.toBe(hashText('b'))
  })
  it('lista: ordem importa, mesma lista → mesmo hash', () => {
    expect(hashList(['a', 'b'])).toBe(hashList(['a', 'b']))
    expect(hashList(['a', 'b'])).not.toBe(hashList(['b', 'a']))
  })
})
