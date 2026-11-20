import { describe, expect, it } from 'vitest'
import { parseBRL } from './money'

describe('parseBRL', () => {
  it.each([
    ['R$ 1.700,50', 1700.5],
    ['1.700', 1700],
    [1700, 1700],
    ['R$ 270,00', 270],
    ['R$270', 270],
    ['1700.5', 1700.5],
    ['12.345.678,9', 12345678.9],
  ])('%j → %s', (input, expected) => {
    expect(parseBRL(input)).toBe(expected)
  })

  it.each(['abc', '', undefined, '   ', 'R$'])('%j → undefined', (input) => {
    expect(parseBRL(input)).toBeUndefined()
  })

  it('recusa negativos e não finitos', () => {
    expect(parseBRL(-5)).toBeUndefined()
    expect(parseBRL(Number.NaN)).toBeUndefined()
  })
})
