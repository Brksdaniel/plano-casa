import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissingEnvError, getPublicEnv } from './env'

const URL_ = 'https://exemplo.supabase.co'
const KEY = 'sb_publishable_teste'

afterEach(() => vi.unstubAllEnvs())

describe('getPublicEnv', () => {
  it('lança MissingEnvError indicando a variável quando a URL falta', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', KEY)
    try {
      getPublicEnv()
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(MissingEnvError)
      expect((e as MissingEnvError).variable).toBe('NEXT_PUBLIC_SUPABASE_URL')
    }
  })

  it('lança MissingEnvError quando a chave publicável falta', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')
    expect(() => getPublicEnv()).toThrowError(MissingEnvError)
  })

  it('retorna os valores quando tudo está presente', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', KEY)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://tracker.exemplo.com')
    expect(getPublicEnv()).toEqual({
      supabaseUrl: URL_,
      supabasePublishableKey: KEY,
      siteUrl: 'https://tracker.exemplo.com',
    })
  })

  it('usa http://localhost:3000 quando NEXT_PUBLIC_SITE_URL não existe', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', KEY)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(getPublicEnv().siteUrl).toBe('http://localhost:3000')
  })
})

describe('checkPublicEnv', () => {
  it('devolve ok:false com o nome da variável ausente, sem lançar', async () => {
    const { checkPublicEnv } = await import('./env')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')
    expect(checkPublicEnv()).toEqual({ ok: false, variable: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' })
  })

  it('devolve ok:true quando tudo está presente', async () => {
    const { checkPublicEnv } = await import('./env')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', KEY)
    expect(checkPublicEnv().ok).toBe(true)
  })
})
