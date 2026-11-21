import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { userClientFromBearer } from './auth'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemplo.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_teste')
})
afterEach(() => vi.unstubAllEnvs())

describe('userClientFromBearer', () => {
  it.each([null, '', 'Bearer ', 'Basic abc', `Bearer ${'x'.repeat(5000)}`])('sem token utilizável (%j) → null', async (h) => {
    expect(await userClientFromBearer(h)).toBeNull()
  })
  it('token malformado → null (nunca lança)', async () => {
    await expect(userClientFromBearer('Bearer abc.def.ghi')).resolves.toBeNull()
  })
})
