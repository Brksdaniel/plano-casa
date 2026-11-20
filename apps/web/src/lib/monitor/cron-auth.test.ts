import { describe, expect, it } from 'vitest'
import { MAX_PER_RUN, dueCutoff, isAuthorizedCron } from './cron-auth'

const SECRET = 'a'.repeat(64)

describe('isAuthorizedCron', () => {
  it('aceita o segredo correto', () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })
  it.each([null, '', 'Bearer ', `Bearer ${'b'.repeat(64)}`, `Bearer ${SECRET}x`, SECRET, `Basic ${SECRET}`])('recusa %j', (header) => {
    expect(isAuthorizedCron(header, SECRET)).toBe(false)
  })
  it('segredo do servidor vazio nunca autoriza', () => {
    expect(isAuthorizedCron('Bearer ', '')).toBe(false)
  })
})

describe('dueCutoff', () => {
  it('6 horas antes de agora', () => {
    expect(dueCutoff(new Date('2026-11-20T12:00:00Z'))).toBe('2026-11-20T06:00:00.000Z')
  })
  it('limite por execução', () => {
    expect(MAX_PER_RUN).toBe(8)
  })
})
