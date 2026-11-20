import { describe, expect, it } from 'vitest'
import { looksLikeChallenge, readJsonLd, readMeta } from './html'
import { fixture } from './test-helpers'

describe('readJsonLd', () => {
  it('achata @graph e encontra o RealEstateListing', () => {
    const nodes = readJsonLd(fixture('chavesnamao-apto.html'))
    expect(nodes.some((n) => n['@type'] === 'RealEstateListing')).toBe(true)
  })

  it('ignora JSON quebrado sem lançar', () => {
    const html = '<script type="application/ld+json">{ quebrado </script><script type="application/ld+json">{"@type":"Offer","price":10}</script>'
    expect(readJsonLd(html)).toEqual([{ '@type': 'Offer', price: 10 }])
  })
})

describe('readMeta', () => {
  it('lê og:* e title', () => {
    const meta = readMeta(fixture('generic-og-only.html'))
    expect(meta['og:title']).toBe('Apartamento aconchegante no Batel')
    expect(meta['og:image']).toBe('https://exemplo.com/fotos/capa.jpg')
    expect(meta.title).toBe('Apartamento aconchegante no Batel')
  })

  it('decodifica entidades HTML comuns', () => {
    const meta = readMeta('<meta property="og:title" content="Sala &amp; quarto &quot;novo&quot;">')
    expect(meta['og:title']).toBe('Sala & quarto "novo"')
  })
})

describe('looksLikeChallenge', () => {
  it('detecta a página de desafio real (403)', () => {
    expect(looksLikeChallenge(fixture('challenge-403.html'), 403)).toBe(true)
  })
  it('detecta desafio mesmo com status 200', () => {
    expect(looksLikeChallenge('<title>Just a moment...</title>', 200)).toBe(true)
  })
  it('página de anúncio normal não é desafio', () => {
    expect(looksLikeChallenge(fixture('chavesnamao-apto.html'), 200)).toBe(false)
  })
  it('script de beacon do Cloudflare em página normal NÃO é desafio', () => {
    const html = '<title>Apartamento 2 quartos</title><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script><div class="g-recaptcha"></div>'
    expect(looksLikeChallenge(html, 200)).toBe(false)
  })
  it('429 é tratado como bloqueio', () => {
    expect(looksLikeChallenge('', 429)).toBe(true)
  })
})
