import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, activeNavHref } from './nav-items'

describe('NAV_ITEMS', () => {
  it('tem as 4 seções na ordem certa', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(['/dashboard', '/apartamentos', '/notificacoes', '/configuracoes'])
  })

  it('todos os itens têm rótulo e ícone', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.trim()).not.toBe('')
      expect(item.icon).toBeTruthy()
    }
  })
})

describe('activeNavHref', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/apartamentos', '/apartamentos'],
    ['/apartamentos/123', '/apartamentos'],
    ['/configuracoes', '/configuracoes'],
    ['/outra', null],
  ])('%s → %s', (path, expected) => {
    expect(activeNavHref(path)).toBe(expected)
  })
})
