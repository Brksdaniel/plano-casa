import { describe, expect, it } from 'vitest'
import { computeConfidence } from '../confidence'
import { fixture, parsed } from '../test-helpers'
import { extractFromPage } from './index'
import { extractZap } from './zap'

const ZAP = 'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-afonso-pena-sao-jose-dos-pinhais-pr-39m2-id-2923596535/'

describe('extractZap', () => {
  it('anúncio real: preço estruturado, condomínio/IPTU/características pela marcação da página', () => {
    const e = extractZap(fixture('zap-apto.html'), parsed(ZAP), 200)
    expect(e.pageKind).toBe('listing')
    expect(e.availability).toBe('active')
    expect(e.externalId).toBe('2923596535')
    expect(e.fields).toMatchObject({
      rent: 1200,
      condoFee: 350,
      iptu: 0,
      areaM2: 39,
      bedrooms: 2,
      bathrooms: 1,
      parking: 1,
      neighborhood: 'Afonso Pena',
      city: 'São José dos Pinhais',
    })
    expect(e.methods).toMatchObject({ rent: 'jsonld', condoFee: 'meta', iptu: 'meta', bedrooms: 'meta', neighborhood: 'jsonld' })
    expect(e.images).toHaveLength(3)
    expect(e.fields.mainImageUrl).toBe(e.images[0])
    expect(String(e.fields.description)).toContain('Villagio di Parma')
  })

  it('OutOfStock → explicit_unavailable com evidência', () => {
    const html = fixture('zap-apto.html').replace('https://schema.org/InStock', 'https://schema.org/OutOfStock')
    const e = extractZap(html, parsed(ZAP), 200)
    expect(e.availability).toBe('explicit_unavailable')
    expect(e.evidence.join(' ')).toMatch(/OutOfStock/)
  })

  it('página de desafio, mesmo com status 200 → nada', () => {
    const e = extractZap(fixture('challenge-403.html'), parsed(ZAP), 200)
    expect(e.pageKind).toBe('challenge')
    expect(e.fields).toEqual({})
  })

  it('sem Product → leitor genérico mantendo a plataforma', () => {
    const e = extractZap('<title>ZAP</title><meta property="og:title" content="Apto">', parsed(ZAP), 200)
    expect(e.platform).toBe('zap')
    expect(e.fields.title).toBe('Apto')
  })

  it('extractFromPage usa o leitor do ZAP e a confiança fica alta', () => {
    const e = extractFromPage(fixture('zap-apto.html'), parsed(ZAP), 200)
    expect(e.fields.condoFee).toBe(350)
    expect(computeConfidence({ rentMethod: e.methods.rent, ageHours: 0, complete: true })).toBe('alta')
  })
})
