import { describe, expect, it } from 'vitest'
import { parseListingUrl } from './url'

const ZAP =
  'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438/?source=ranking%2Crp'
const ZAP_NORMALIZED =
  'zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438'

function ok(input: string) {
  const r = parseListingUrl(input)
  if (!r.ok) throw new Error(`esperava ok: ${r.error}`)
  return r.value
}

describe('parseListingUrl', () => {
  it('ZAP: plataforma, id e forma normalizada sem query', () => {
    const v = ok(ZAP)
    expect(v.platform).toBe('zap')
    expect(v.externalId).toBe('2923224438')
    expect(v.normalized).toBe(ZAP_NORMALIZED)
  })

  it('ZAP sem www, sem query e sem barra final → mesma forma normalizada', () => {
    const v = ok('https://zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438')
    expect(v.normalized).toBe(ZAP_NORMALIZED)
  })

  it('Chaves na Mão: plataforma e id', () => {
    const v = ok(
      'https://www.chavesnamao.com.br/imovel/apartamento-para-alugar-2-quartos-com-garagem-pr-sao-jose-dos-pinhais-afonso-pena-RS1700/id-48986848/',
    )
    expect(v.platform).toBe('chavesnamao')
    expect(v.externalId).toBe('48986848')
  })

  it('genérico: mantém query útil e remove rastreadores', () => {
    const v = ok('https://exemplo.com/anuncio?utm_source=x&id=5&fbclid=abc')
    expect(v.platform).toBe('generic')
    expect(v.externalId).toBeUndefined()
    expect(v.normalized).toBe('exemplo.com/anuncio?id=5')
  })

  it('OLX regional com espaços em volta', () => {
    const v = ok('  https://pr.olx.com.br/regiao-de-curitiba/imoveis/apto-2-quartos-1234567890  ')
    expect(v.platform).toBe('olx')
    expect(v.externalId).toBe('1234567890')
  })

  it('Viva Real, QuintoAndar e Imovelweb', () => {
    expect(ok('https://www.vivareal.com.br/imovel/apartamento-2-quartos-centro-curitiba-50m2-aluguel-RS1500-id-2700000001/').externalId).toBe('2700000001')
    expect(ok('https://www.quintoandar.com.br/imovel/893456123/alugar/apartamento-2-quartos').externalId).toBe('893456123')
    expect(ok('https://www.imovelweb.com.br/propriedades/apartamento-2-quartos-centro-2987654321.html').externalId).toBe('2987654321')
  })

  it.each(['ftp://x.com', 'javascript:alert(1)', 'não é link', ''])('recusa %j com mensagem em PT-BR', (input) => {
    const r = parseListingUrl(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/link/i)
  })
})
