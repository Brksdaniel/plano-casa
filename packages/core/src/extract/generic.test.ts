import { describe, expect, it } from 'vitest'
import { fixture, parsed } from '../test-helpers'
import { extractGeneric } from './generic'

const URL_ = 'https://exemplo.com/anuncio/123'

describe('extractGeneric', () => {
  it('só Open Graph: título e imagem por meta, sem preço', () => {
    const e = extractGeneric(fixture('generic-og-only.html'), parsed(URL_), 200)
    expect(e.pageKind).toBe('listing')
    expect(e.fields.title).toBe('Apartamento aconchegante no Batel')
    expect(e.methods.title).toBe('meta')
    expect(e.fields.mainImageUrl).toBe('https://exemplo.com/fotos/capa.jpg')
    expect(e.fields.rent).toBeUndefined()
    expect(e.availability).toBe('unknown')
  })

  it('Offer em JSON-LD: preço por jsonld e InStock → active', () => {
    const html = '<script type="application/ld+json">{"@type":"Offer","price":"2100","availability":"https://schema.org/InStock"}</script>'
    const e = extractGeneric(html, parsed(URL_), 200)
    expect(e.fields.rent).toBe(2100)
    expect(e.methods.rent).toBe('jsonld')
    expect(e.availability).toBe('active')
  })

  it('genérico nunca afirma indisponível', () => {
    const html = '<script type="application/ld+json">{"@type":"Offer","price":"2100","availability":"https://schema.org/OutOfStock"}</script>'
    expect(extractGeneric(html, parsed(URL_), 200).availability).toBe('unknown')
  })

  it('desafio → nenhum campo', () => {
    const e = extractGeneric('<title>Just a moment...</title>', parsed(URL_), 403)
    expect(e.pageKind).toBe('challenge')
    expect(e.fields).toEqual({})
  })
})
