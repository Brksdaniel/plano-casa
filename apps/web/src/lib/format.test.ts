import { describe, expect, it } from 'vitest'
import { formatBRL, formatRelative } from './format'

const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('formatBRL', () => {
  it.each([
    [1700, 'R$ 1.700'],
    [1700.5, 'R$ 1.700,50'],
    [0, 'R$ 0'],
    [null, '—'],
    [undefined, '—'],
  ])('%s → %s', (v, expected) => {
    expect(nbsp(formatBRL(v))).toBe(expected)
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-11-20T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  it.each([
    [ago(20_000), 'agora há pouco'],
    [ago(30 * 60_000), 'há 30 min'],
    [ago(3 * 3_600_000), 'há 3 h'],
    [ago(49 * 3_600_000), 'há 2 dias'],
    [ago(24 * 3_600_000), 'há 1 dia'],
    [null, 'nunca verificado'],
  ])('%s → %s', (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected)
  })
})
