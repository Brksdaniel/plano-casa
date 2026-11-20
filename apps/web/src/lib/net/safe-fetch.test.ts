import { describe, expect, it, vi } from 'vitest'
import { isPrivateAddress, safeFetchHtml } from './safe-fetch'

const publicLookup = async () => ['93.184.216.34']

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } })
}

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.5.4', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1'])(
    '%s é privado',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  )
  it.each(['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700::1'])('%s é público', (ip) => expect(isPrivateAddress(ip)).toBe(false))
})

describe('safeFetchHtml', () => {
  it('recusa esquemas que não são http(s)', async () => {
    expect(await safeFetchHtml('file:///etc/passwd')).toEqual({ ok: false, reason: 'invalid_url' })
  })

  it('recusa host que resolve para IP privado sem chamar fetch', async () => {
    const fetchImpl = vi.fn()
    const r = await safeFetchHtml('https://interno.exemplo.com/', { lookup: async () => ['10.0.0.5'], fetchImpl })
    expect(r).toEqual({ ok: false, reason: 'blocked_address' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('recusa IP literal privado', async () => {
    const fetchImpl = vi.fn()
    expect(await safeFetchHtml('http://127.0.0.1:3000/', { fetchImpl })).toEqual({ ok: false, reason: 'blocked_address' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('redirect para IP privado é recusado', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }))
    expect(await safeFetchHtml('https://exemplo.com/', { lookup: publicLookup, fetchImpl })).toEqual({ ok: false, reason: 'blocked_address' })
  })

  it('segue redirect público e devolve a URL final', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/novo' } }))
      .mockResolvedValueOnce(htmlResponse('<p>ok</p>'))
    const r = await safeFetchHtml('https://exemplo.com/velho', { lookup: publicLookup, fetchImpl })
    expect(r).toEqual({ ok: true, status: 200, html: '<p>ok</p>', finalUrl: 'https://exemplo.com/novo' })
  })

  it('mais de 3 redirects → network', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: '/de-novo' } }))
    expect(await safeFetchHtml('https://exemplo.com/', { lookup: publicLookup, fetchImpl })).toEqual({ ok: false, reason: 'network' })
  })

  it('timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    )
    expect(await safeFetchHtml('https://exemplo.com/', { lookup: publicLookup, fetchImpl, timeoutMs: 30 })).toEqual({ ok: false, reason: 'timeout' })
  })

  it('corpo grande demais', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('x'.repeat(2000)))
    expect(await safeFetchHtml('https://exemplo.com/', { lookup: publicLookup, fetchImpl, maxBytes: 1000 })).toEqual({ ok: false, reason: 'too_large' })
  })

  it('erro de rede', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await safeFetchHtml('https://exemplo.com/', { lookup: publicLookup, fetchImpl })).toEqual({ ok: false, reason: 'network' })
  })

  it('403 ainda devolve o HTML (para o core reconhecer o desafio)', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('<title>Attention Required!</title>', 403))
    const r = await safeFetchHtml('https://exemplo.com/', { lookup: publicLookup, fetchImpl })
    expect(r).toMatchObject({ ok: true, status: 403 })
  })
})
