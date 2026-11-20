import { describe, expect, it } from 'vitest'
import { refreshWaitMinutes } from './cooldown'

const now = new Date('2026-11-21T12:00:00Z')
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString()

describe('refreshWaitMinutes', () => {
  it('nunca verificado → pode já', () => expect(refreshWaitMinutes(null, now)).toBe(0))
  it('há 3 min → esperar 7', () => expect(refreshWaitMinutes(ago(3), now)).toBe(7))
  it('há 9,5 min → esperar 1 (arredonda para cima)', () => expect(refreshWaitMinutes(ago(9.5), now)).toBe(1))
  it('há 10 min → pode', () => expect(refreshWaitMinutes(ago(10), now)).toBe(0))
  it('há 2 h → pode', () => expect(refreshWaitMinutes(ago(120), now)).toBe(0))
})
