import { type Extraction, extractFromPage, extractFromUrlOnly, parseListingUrl } from '@deniels/core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildApartmentInsert } from './build-insert'
import type { NewApartmentInput } from './schema'

const NOW = new Date('2026-11-20T12:00:00Z')
const USER = '00000000-0000-0000-0000-000000000001'
const CNM =
  'https://www.chavesnamao.com.br/imovel/apartamento-para-alugar-2-quartos-com-garagem-pr-sao-jose-dos-pinhais-afonso-pena-RS1700/id-48986848/'
const ZAP = 'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438/'

const fx = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../../packages/core/test/fixtures/${name}`, import.meta.url)), 'utf8')
const parsed = (u: string) => {
  const r = parseListingUrl(u)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

/** Simula o formulário enviado sem mudanças nos campos lidos. */
function inputFrom(e: Extraction, url: string, overrides: Partial<NewApartmentInput> = {}): NewApartmentInput {
  const origins: NewApartmentInput['fieldOrigins'] = {}
  for (const [k, m] of Object.entries(e.methods)) origins[k as keyof typeof origins] = m === 'slug' ? 'url' : 'page'
  return {
    url,
    priority: 3,
    rent: e.fields.rent as number | undefined,
    condoFee: e.fields.condoFee as number | undefined,
    bedrooms: e.fields.bedrooms as number | undefined,
    bathrooms: e.fields.bathrooms as number | undefined,
    parking: e.fields.parking as number | undefined,
    areaM2: e.fields.areaM2 as number | undefined,
    neighborhood: e.fields.neighborhood as string | undefined,
    city: e.fields.city as string | undefined,
    fieldOrigins: origins,
    ...overrides,
  }
}

describe('buildApartmentInsert', () => {
  it('Chaves na Mão lido → auto, ativo, alta, preço do servidor, snapshot listing', () => {
    const p = parsed(CNM)
    const e = extractFromPage(fx('chavesnamao-apto.html'), p, 200)
    const r = buildApartmentInsert(inputFrom(e, CNM), { userId: USER, parsed: p, extraction: e, fetch: 'fetched', httpStatus: 200, now: NOW })
    expect(r.apartment).toMatchObject({
      monitor_mode: 'auto',
      status: 'ativo',
      confidence: 'alta',
      last_source: 'server',
      last_success_at: NOW.toISOString(),
      last_check_at: NOW.toISOString(),
      rent: 1700,
      condo_fee: 270,
      platform: 'chavesnamao',
      external_listing_id: '48986848',
      url_normalized: p.normalized,
    })
    expect(r.apartment.main_image_url).toMatch(/^https:/)
    expect(r.price).toMatchObject({ rent: 1700, condo_fee: 270, source: 'server' })
    expect(r.snapshot).toMatchObject({ page_kind: 'listing', http_status: 200, availability: 'active', source: 'server' })
    expect(r.status).toMatchObject({ from_status: null, to_status: 'ativo', source: 'server' })
  })

  it('ZAP com preço digitado → extensão, não verificado, baixa, preço manual, sem snapshot', () => {
    const p = parsed(ZAP)
    const e = extractFromUrlOnly(p)
    const input = inputFrom(e, ZAP, { rent: 1500, fieldOrigins: { ...inputFrom(e, ZAP).fieldOrigins, rent: 'user' } })
    const r = buildApartmentInsert(input, { userId: USER, parsed: p, extraction: e, fetch: 'not_allowed', now: NOW })
    expect(r.apartment).toMatchObject({ monitor_mode: 'extension', status: 'nao_verificado', confidence: 'baixa', last_source: 'manual', last_check_at: null })
    expect(r.price).toMatchObject({ rent: 1500, source: 'manual' })
    expect(r.snapshot).toBeNull()
    expect(r.status).toMatchObject({ to_status: 'nao_verificado', source: 'manual' })
  })

  it('Chaves na Mão com desafio → erro_acesso, nunca indisponível, sem preço se ninguém digitou', () => {
    const p = parsed(CNM)
    const e = extractFromPage(fx('challenge-403.html'), p, 403)
    const r = buildApartmentInsert(inputFrom(e, CNM), { userId: USER, parsed: p, extraction: e, fetch: 'fetched', httpStatus: 403, now: NOW })
    expect(r.apartment.status).toBe('erro_acesso')
    expect(r.apartment.last_success_at).toBeNull()
    expect(r.apartment.confidence).toBeNull()
    expect(r.price).toBeNull()
    expect(r.snapshot).toMatchObject({ page_kind: 'challenge', http_status: 403 })
  })

  it('falha de rede → erro_acesso com snapshot de erro', () => {
    const p = parsed(CNM)
    const r = buildApartmentInsert(inputFrom(extractFromUrlOnly(p), CNM), { userId: USER, parsed: p, extraction: null, fetch: 'failed', now: NOW })
    expect(r.apartment.status).toBe('erro_acesso')
    expect(r.snapshot).toMatchObject({ page_kind: null, error: expect.stringMatching(/acess/i) })
  })

  it('404 → verificação necessária (nunca removido no primeiro erro)', () => {
    const p = parsed(CNM)
    const e = extractFromPage('', p, 404)
    const r = buildApartmentInsert(inputFrom(e, CNM), { userId: USER, parsed: p, extraction: e, fetch: 'fetched', httpStatus: 404, now: NOW })
    expect(r.apartment.status).toBe('verificacao_necessaria')
    expect(r.apartment.consecutive_not_found).toBe(1)
  })

  it('oferta OutOfStock → indisponível com evidência', () => {
    const p = parsed(CNM)
    const e = extractFromPage(fx('chavesnamao-apto.html').replace('https://schema.org/InStock', 'https://schema.org/OutOfStock'), p, 200)
    const r = buildApartmentInsert(inputFrom(e, CNM), { userId: USER, parsed: p, extraction: e, fetch: 'fetched', httpStatus: 200, now: NOW })
    expect(r.apartment.status).toBe('indisponivel')
    expect(r.status.evidence).toMatch(/OutOfStock/)
  })

  it('usuário altera o aluguel lido → preço manual e confiabilidade baixa', () => {
    const p = parsed(CNM)
    const e = extractFromPage(fx('chavesnamao-apto.html'), p, 200)
    const base = inputFrom(e, CNM)
    const r = buildApartmentInsert(
      { ...base, rent: 1650, fieldOrigins: { ...base.fieldOrigins, rent: 'user' } },
      { userId: USER, parsed: p, extraction: e, fetch: 'fetched', httpStatus: 200, now: NOW },
    )
    expect(r.price).toMatchObject({ rent: 1650, source: 'manual' })
    expect(r.apartment.confidence).toBe('baixa')
    expect(r.apartment.status).toBe('ativo')
  })
})
