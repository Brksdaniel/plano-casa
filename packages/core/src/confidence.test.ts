import { describe, expect, it } from 'vitest'
import { computeConfidence } from './confidence'

describe('computeConfidence', () => {
  it.each([
    [{ rentMethod: 'jsonld', ageHours: 2, complete: true }, 'alta'],
    [{ rentMethod: 'jsonld', ageHours: 36, complete: true }, 'alta'],
    [{ rentMethod: 'jsonld', ageHours: 48, complete: true }, 'media'],
    [{ rentMethod: 'text', ageHours: 2, complete: true }, 'media'],
    [{ rentMethod: 'meta', ageHours: 2, complete: true }, 'media'],
    [{ rentMethod: 'user', ageHours: 1, complete: true }, 'baixa'],
    [{ rentMethod: 'slug', ageHours: 1, complete: true }, 'baixa'],
    [{ rentMethod: 'jsonld', ageHours: 200, complete: true }, 'baixa'],
    [{ rentMethod: 'jsonld', ageHours: 2, complete: false }, 'baixa'],
    [{ ageHours: 2, complete: true }, null],
  ] as const)('%j → %s', (input, expected) => {
    expect(computeConfidence(input)).toBe(expected)
  })
})
