import { describe, expect, it } from 'vitest'
import { CNM_APTO, CNM_CASA, fixture, parsed } from '../test-helpers'
import { extractChavesNaMao } from './chavesnamao'

describe('extractChavesNaMao', () => {
  it('apartamento real: lê valores estruturados e o condomínio do texto', () => {
    const e = extractChavesNaMao(fixture('chavesnamao-apto.html'), parsed(CNM_APTO), 200)
    expect(e.pageKind).toBe('listing')
    expect(e.availability).toBe('active')
    expect(e.externalId).toBe('48986848')
    expect(e.fields.rent).toBe(1700)
    expect(e.methods.rent).toBe('jsonld')
    expect(e.fields.bedrooms).toBe(2)
    expect(e.fields.bathrooms).toBe(1)
    expect(e.fields.areaM2).toBe(44)
    expect(e.fields.neighborhood).toBe('Afonso Pena')
    expect(e.fields.city).toBe('São José dos Pinhais')
    expect(e.fields.condoFee).toBe(270)
    expect(e.methods.condoFee).toBe('text')
    expect(e.fields.parking).toBe(1)
    expect(e.methods.parking).toBe('text')
    expect(e.images.length).toBeGreaterThanOrEqual(5)
    expect(e.fields.mainImageUrl).toBe(e.images[0])
    expect(String(e.fields.title)).toContain('Apartamento')
  })

  it('casa real: aluguel, área e bairro composto', () => {
    const e = extractChavesNaMao(fixture('chavesnamao-casa.html'), parsed(CNM_CASA), 200)
    expect(e.fields.rent).toBe(1800)
    expect(e.fields.areaM2).toBe(48)
    expect(e.fields.neighborhood).toBe('Campo Largo da Roseira')
    expect(e.fields.condoFee).toBeUndefined()
  })

  it('desafio/bloqueio: nenhum campo e disponibilidade desconhecida', () => {
    const e = extractChavesNaMao(fixture('challenge-403.html'), parsed(CNM_APTO), 403)
    expect(e.pageKind).toBe('challenge')
    expect(e.fields).toEqual({})
    expect(e.availability).toBe('unknown')
  })

  it('404 vira not_found, nunca indisponível', () => {
    const e = extractChavesNaMao('', parsed(CNM_APTO), 404)
    expect(e.pageKind).toBe('not_found')
    expect(e.availability).toBe('unknown')
  })

  it('oferta OutOfStock → explicit_unavailable com evidência', () => {
    const html = fixture('chavesnamao-apto.html').replace('https://schema.org/InStock', 'https://schema.org/OutOfStock')
    const e = extractChavesNaMao(html, parsed(CNM_APTO), 200)
    expect(e.availability).toBe('explicit_unavailable')
    expect(e.evidence.join(' ')).toMatch(/OutOfStock/)
  })
})
