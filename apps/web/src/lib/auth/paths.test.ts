import { describe, expect, it } from 'vitest'
import { isPublicPath, safeNext } from './paths'

describe('isPublicPath', () => {
  it.each([
    ['/login', true],
    ['/login/', true],
    ['/_next/static/a.js', true],
    ['/favicon.ico', true],
    ['/', false],
    ['/apartamentos', false],
    ['/dashboard', false],
    ['/loginx', false],
    ['/login-falso', false],
  ])('%s → %s', (path, expected) => {
    expect(isPublicPath(path)).toBe(expected)
  })
})

describe('safeNext', () => {
  it.each([
    ['/apartamentos', '/apartamentos'],
    ['/apartamentos?x=1', '/apartamentos?x=1'],
    ['//evil.com', '/dashboard'],
    ['/\\evil.com', '/dashboard'],
    ['https://evil.com', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/login', '/dashboard'],
    ['', '/dashboard'],
    [undefined, '/dashboard'],
    [null, '/dashboard'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected)
  })
})
