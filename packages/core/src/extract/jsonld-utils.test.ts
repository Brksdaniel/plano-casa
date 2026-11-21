import { describe, expect, it } from 'vitest'
import { MAX_IMAGES, images } from './jsonld-utils'

describe('images', () => {
  it('limita a quantidade de fotos (anúncios reais do ZAP chegam a 41+)', () => {
    const list = Array.from({ length: 45 }, (_, i) => `https://img.example.com/${i}.webp`)
    const out = images(list)
    expect(MAX_IMAGES).toBe(40)
    expect(out).toHaveLength(MAX_IMAGES)
    expect(out[0]).toBe(list[0])
  })

  it('aceita só fotos https (a API do site recusa http)', () => {
    expect(images(['http://img.example.com/a.jpg', 'https://img.example.com/b.jpg'])).toEqual(['https://img.example.com/b.jpg'])
  })

  it('ignora links de imagem longos demais', () => {
    const long = `https://img.example.com/${'a'.repeat(1000)}.webp`
    expect(images([long, 'https://img.example.com/ok.webp'])).toEqual(['https://img.example.com/ok.webp'])
  })
})
