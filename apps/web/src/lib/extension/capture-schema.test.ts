import { extractFromPage, parseListingUrl } from '@deniels/core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCapture } from './capture-schema'

const URL_ = 'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-afonso-pena-sao-jose-dos-pinhais-pr-39m2-id-2923596535/'
const html = readFileSync(fileURLToPath(new URL('../../../../../packages/core/test/fixtures/zap-apto.html', import.meta.url)), 'utf8')
const parsed = (() => {
  const r = parseListingUrl(URL_)
  if (!r.ok) throw new Error(r.error)
  return r.value
})()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const valid = (): any => ({ url: URL_, httpStatus: 200, extraction: JSON.parse(JSON.stringify(extractFromPage(html, parsed, 200))) })

describe('parseCapture', () => {
  it('aceita a extração real do ZAP', () => {
    expect(parseCapture(valid()).success).toBe(true)
  })
  it('recusa mais de 40 imagens', () => {
    const v = valid()
    v.extraction.images = Array.from({ length: 41 }, (_, i) => `https://img.test/${i}.jpg`)
    expect(parseCapture(v).success).toBe(false)
  })
  it('recusa aluguel negativo', () => {
    const v = valid()
    v.extraction.fields.rent = -10
    expect(parseCapture(v).success).toBe(false)
  })
  it('recusa url que não é http(s)', () => {
    expect(parseCapture({ ...valid(), url: 'javascript:alert(1)' }).success).toBe(false)
  })
  it('recusa pageKind desconhecido', () => {
    const v = valid()
    v.extraction.pageKind = 'hack'
    expect(parseCapture(v).success).toBe(false)
  })
  it('recusa imagem que não é https', () => {
    const v = valid()
    v.extraction.images = ['javascript:alert(1)']
    expect(parseCapture(v).success).toBe(false)
  })
})
