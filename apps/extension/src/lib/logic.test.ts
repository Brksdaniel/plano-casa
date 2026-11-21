import { parseListingUrl } from '@deniels/core'
import { describe, expect, it } from 'vitest'
import { decideBadge } from './badge'
import { validateExternalMessage } from './messages'
import { type TrackedItem, matchTracked } from './tracked'

const p = (u: string) => {
  const r = parseListingUrl(u)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const ITEMS: TrackedItem[] = [
  {
    id: 'a1',
    normalized: 'zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438',
    platform: 'zap',
    externalId: '2923224438',
    name: 'ZAP',
  },
  { id: 'a2', normalized: 'vivareal.com.br/imovel/x-id-555', platform: 'vivareal', externalId: '777', name: 'VR' },
]

describe('matchTracked', () => {
  it('casa pelo link normalizado mesmo com ?source= diferente', () => {
    expect(
      matchTracked(p('https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438/?source=xyz'), ITEMS)?.id,
    ).toBe('a1')
  })
  it('casa pelo código do anúncio', () => {
    expect(matchTracked(p('https://www.vivareal.com.br/imovel/outro-slug-id-777/'), ITEMS)?.id).toBe('a2')
  })
  it('não casa código igual em plataforma diferente', () => {
    expect(matchTracked(p('https://www.zapimoveis.com.br/imovel/outro-id-777/'), ITEMS)).toBeNull()
  })
})

describe('decideBadge', () => {
  it.each([
    [{ isListing: true, challenge: true, tracked: true, connected: true }, 'none'],
    [{ isListing: false, challenge: false, tracked: false, connected: true }, 'none'],
    [{ isListing: true, challenge: false, tracked: false, connected: false }, 'connect'],
    [{ isListing: true, challenge: false, tracked: false, connected: true }, 'add'],
    [{ isListing: true, challenge: false, tracked: true, connected: true }, 'syncing'],
  ] as const)('%j → %s', (input, expected) => {
    expect(decideBadge(input)).toBe(expected)
  })
})

describe('validateExternalMessage', () => {
  const allowed = ['https://web-two-pi-26.vercel.app', 'http://localhost:3000']
  const connect = {
    type: 'connect',
    session: { accessToken: 'a', refreshToken: 'r', expiresAt: 123, email: 'e@x.com' },
    siteUrl: 'https://web-two-pi-26.vercel.app',
    supabaseUrl: 'https://exemplo.supabase.co',
    publishableKey: 'sb_publishable_x',
  }
  it('aceita connect vindo do site', () => {
    expect(validateExternalMessage(connect, 'https://web-two-pi-26.vercel.app', allowed)?.type).toBe('connect')
  })
  it('rejeita origem estranha', () => {
    expect(validateExternalMessage(connect, 'https://evil.example', allowed)).toBeNull()
  })
  it('rejeita siteUrl diferente da origem', () => {
    expect(validateExternalMessage({ ...connect, siteUrl: 'https://evil.example' }, 'https://web-two-pi-26.vercel.app', allowed)).toBeNull()
  })
  it('rejeita supabaseUrl sem https', () => {
    expect(validateExternalMessage({ ...connect, supabaseUrl: 'http://x' }, 'https://web-two-pi-26.vercel.app', allowed)).toBeNull()
  })
  it('aceita status e disconnect; rejeita tipo desconhecido', () => {
    expect(validateExternalMessage({ type: 'status' }, 'http://localhost:3000', allowed)?.type).toBe('status')
    expect(validateExternalMessage({ type: 'disconnect' }, 'http://localhost:3000', allowed)?.type).toBe('disconnect')
    expect(validateExternalMessage({ type: 'steal' }, 'http://localhost:3000', allowed)).toBeNull()
  })
})
