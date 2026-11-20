import { describe, expect, it } from 'vitest'
import { parsed } from '../test-helpers'
import { extractFromSlug } from './slug'

describe('extractFromSlug', () => {
  it('ZAP Curitiba: quartos, área e cidade; bairro nunca', () => {
    const e = extractFromSlug(
      parsed('https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438/?source=ranking%2Crp'),
    )
    expect(e.fields).toEqual({ bedrooms: 2, areaM2: 47, city: 'Curitiba' })
    expect(e.methods).toEqual({ bedrooms: 'slug', areaM2: 'slug', city: 'slug' })
    expect(e.pageKind).toBe('other')
    expect(e.availability).toBe('unknown')
    expect(e.externalId).toBe('2923224438')
  })

  it('ZAP São José dos Pinhais (bairro antes da cidade não confunde)', () => {
    const e = extractFromSlug(
      parsed('https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-com-salao-de-festas-ina-sao-jose-dos-pinhais-pr-46m2-id-2923256795/'),
    )
    expect(e.fields.city).toBe('São José dos Pinhais')
    expect(e.fields.areaM2).toBe(46)
    expect(e.fields.neighborhood).toBeUndefined()
  })

  it('cidade desconhecida fica vazia', () => {
    const e = extractFromSlug(parsed('https://www.zapimoveis.com.br/imovel/aluguel-apartamento-3-quartos-centro-ponta-grossa-pr-50m2-id-1/'))
    expect(e.fields.city).toBeUndefined()
    expect(e.fields.bedrooms).toBe(3)
  })

  it('"1 quarto" no singular', () => {
    const e = extractFromSlug(parsed('https://www.zapimoveis.com.br/imovel/aluguel-apartamento-1-quarto-centro-curitiba-pr-30m2-id-9/'))
    expect(e.fields.bedrooms).toBe(1)
  })
})
