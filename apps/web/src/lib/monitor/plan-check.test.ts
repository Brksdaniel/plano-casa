import { extractFromPage, hashList, hashText, parseListingUrl } from '@deniels/core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ListingRead } from '@/lib/apartments/read-listing'
import type { Tables } from '@/lib/database.types'
import { planCheck } from './plan-check'

const NOW = new Date('2026-11-21T12:00:00Z')
const RUN = '11111111-1111-1111-1111-111111111111'
const URL_ =
  'https://www.chavesnamao.com.br/imovel/apartamento-para-alugar-2-quartos-com-garagem-pr-sao-jose-dos-pinhais-afonso-pena-RS1700/id-48986848/'
const fx = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../../packages/core/test/fixtures/${name}`, import.meta.url)), 'utf8')
const parsed = (() => {
  const r = parseListingUrl(URL_)
  if (!r.ok) throw new Error(r.error)
  return r.value
})()

function read(html: string, status = 200): ListingRead {
  return { ok: true, parsed, extraction: extractFromPage(html, parsed, status), fetch: 'fetched', httpStatus: status }
}
const failedRead: ListingRead = { ok: true, parsed, extraction: extractFromPage('', parsed, 0), fetch: 'failed' }

const baseExtraction = extractFromPage(fx('chavesnamao-apto.html'), parsed, 200)

function apartment(over: Partial<Tables<'apartments'>> = {}): Tables<'apartments'> {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    user_id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
    url_original: URL_,
    url_normalized: parsed.normalized,
    platform: 'chavesnamao',
    external_listing_id: '48986848',
    custom_name: null,
    source_title: 'Apartamento',
    neighborhood: 'Afonso Pena',
    city: 'São José dos Pinhais',
    rent: 1700,
    condo_fee: 270,
    iptu: null,
    total_monthly: 1970,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    area_m2: 44,
    priority: 3,
    notes: null,
    main_image_url: null,
    monitor_mode: 'auto',
    status: 'ativo',
    confidence: 'alta',
    last_check_at: '2026-11-21T00:00:00Z',
    last_success_at: '2026-11-21T00:00:00Z',
    last_source: 'server',
    consecutive_failures: 0,
    consecutive_not_found: 0,
    last_not_found_at: null,
    archived_at: null,
    created_at: '2026-11-20T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    ...over,
  }
}

const lastSnapshot = {
  rent: 1700,
  condo_fee: 270,
  iptu: null,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  area_m2: 44,
  description_hash: hashText(String(baseExtraction.fields.description)),
  images_hash: hashList(baseExtraction.images),
}
const lastPrice = { rent: 1700, condo_fee: 270, iptu: null, recorded_at: '2026-11-21T06:00:00Z' }

const plan = (r: ListingRead, over: Partial<Tables<'apartments'>> = {}, lp: typeof lastPrice | null = lastPrice) =>
  planCheck({ apartment: apartment(over), read: r, lastPrice: lp, lastSnapshot, now: NOW, runId: RUN, trigger: 'cron' })

describe('planCheck', () => {
  it('mesma leitura → sem mudanças, sem preço novo (última linha < 20 h), sucesso registrado', () => {
    const p = plan(read(fx('chavesnamao-apto.html')))
    expect(p.changes).toEqual([])
    expect(p.price).toBeNull()
    expect(p.statusRow).toBeNull()
    expect(p.apartmentUpdate).toMatchObject({ last_check_at: NOW.toISOString(), last_success_at: NOW.toISOString(), last_source: 'server', status: 'ativo' })
    expect(p.snapshot).toMatchObject({ page_kind: 'listing', run_id: RUN, source: 'server' })
    expect(p.log).toMatchObject({ outcome: 'ok', trigger: 'cron', run_id: RUN })
  })

  it('última linha de preço > 20 h → grava preço mesmo sem mudança (gráfico diário)', () => {
    const p = plan(read(fx('chavesnamao-apto.html')), {}, { ...lastPrice, recorded_at: '2026-11-20T10:00:00Z' })
    expect(p.price).toMatchObject({ rent: 1700, source: 'server' })
  })

  it('preço caiu 1700 → 1650 → price_down, preço novo, imóvel atualizado', () => {
    const p = plan(read(fx('chavesnamao-apto.html').replace('"price": 1700', '"price": 1650')))
    expect(p.changes).toHaveLength(1)
    expect(p.changes[0]).toMatchObject({ kind: 'price_down', diff_abs: -50, dedupe_key: `snap:${RUN}:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:price_down` })
    expect(p.price).toMatchObject({ rent: 1650, condo_fee: 270, source: 'server' })
    expect(p.apartmentUpdate).toMatchObject({ rent: 1650, confidence: 'alta' })
    expect(p.log.outcome).toBe('changed')
  })

  it('desafio 403 → erro_acesso, contador +1, aluguel intocado, sem preço', () => {
    const p = plan(read(fx('challenge-403.html'), 403))
    expect(p.apartmentUpdate).toMatchObject({ status: 'erro_acesso', consecutive_failures: 1 })
    expect(p.apartmentUpdate).not.toHaveProperty('rent')
    expect(p.apartmentUpdate).not.toHaveProperty('last_success_at')
    expect(p.price).toBeNull()
    expect(p.statusRow).toMatchObject({ from_status: 'ativo', to_status: 'erro_acesso' })
    expect(p.log.outcome).toBe('blocked')
  })

  it('3º bloqueio seguido → passa para extensão com evidência', () => {
    const p = plan(read(fx('challenge-403.html'), 403), { status: 'erro_acesso', consecutive_failures: 2 })
    expect(p.apartmentUpdate).toMatchObject({ monitor_mode: 'extension', consecutive_failures: 3 })
    expect(p.statusRow?.evidence).toMatch(/3 vezes/)
  })

  it('falha de rede → erro_acesso, log failed', () => {
    const p = plan(failedRead)
    expect(p.apartmentUpdate.status).toBe('erro_acesso')
    expect(p.log.outcome).toBe('failed')
    expect(p.snapshot.error).toMatch(/acess/i)
  })

  it('IPTU digitado pelo usuário não é apagado quando a página não informa', () => {
    const p = plan(read(fx('chavesnamao-apto.html')), { iptu: 80 })
    expect(p.apartmentUpdate).not.toHaveProperty('iptu')
  })

  it('OutOfStock → indisponível + status_change', () => {
    const p = plan(read(fx('chavesnamao-apto.html').replace('https://schema.org/InStock', 'https://schema.org/OutOfStock')))
    expect(p.apartmentUpdate.status).toBe('indisponivel')
    expect(p.changes.map((c) => c.kind)).toContain('status_change')
    expect(p.statusRow).toMatchObject({ to_status: 'indisponivel' })
  })

  it('mesma entrada e mesmo runId → mesmas dedupe_keys (idempotente)', () => {
    const html = fx('chavesnamao-apto.html').replace('"price": 1700', '"price": 1650')
    expect(plan(read(html)).changes.map((c) => c.dedupe_key)).toEqual(plan(read(html)).changes.map((c) => c.dedupe_key))
  })

  it('404 → verificação necessária e guarda o início da sequência', () => {
    const p = plan(read('', 404))
    expect(p.apartmentUpdate).toMatchObject({ status: 'verificacao_necessaria', consecutive_not_found: 1, last_not_found_at: NOW.toISOString() })
    expect(p.log.outcome).toBe('not_found')
  })
})
