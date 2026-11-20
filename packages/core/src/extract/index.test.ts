import { describe, expect, it } from 'vitest'
import { CNM_APTO, fixture, parsed } from '../test-helpers'
import { extractFromPage, extractFromUrlOnly } from './index'

const ZAP = 'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438/'

describe('extractFromUrlOnly', () => {
  it('ZAP usa o link', () => {
    expect(extractFromUrlOnly(parsed(ZAP)).fields.bedrooms).toBe(2)
  })
  it('site genérico não deduz nada do link', () => {
    expect(extractFromUrlOnly(parsed('https://exemplo.com/apto-3-quartos-80m2')).fields).toEqual({})
  })
})

describe('extractFromPage', () => {
  it('Chaves na Mão: usa o adaptador próprio; página prevalece sobre o link', () => {
    const e = extractFromPage(fixture('chavesnamao-apto.html'), parsed(CNM_APTO), 200)
    expect(e.platform).toBe('chavesnamao')
    expect(e.fields.rent).toBe(1700)
    expect(e.methods.bedrooms).toBe('jsonld')
  })

  it('site genérico usa o leitor genérico', () => {
    const e = extractFromPage(fixture('generic-og-only.html'), parsed('https://exemplo.com/a'), 200)
    expect(e.fields.title).toBe('Apartamento aconchegante no Batel')
  })

  it('desafio não ganha campos do link como se a página tivesse sido lida', () => {
    const e = extractFromPage(fixture('challenge-403.html'), parsed(CNM_APTO), 403)
    expect(e.pageKind).toBe('challenge')
    expect(e.methods.rent).toBeUndefined()
  })
})
