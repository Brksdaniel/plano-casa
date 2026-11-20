import { describe, expect, it } from 'vitest'
import { estimateTotal, initialOrigins, originAfterEdit } from './form-helpers'

describe('originAfterEdit', () => {
  it('sem mudança mantém a origem', () => {
    expect(originAfterEdit('page', false)).toBe('page')
    expect(originAfterEdit('url', false)).toBe('url')
  })
  it('editar transforma em "user"', () => {
    expect(originAfterEdit('page', true)).toBe('user')
    expect(originAfterEdit('url', true)).toBe('user')
    expect(originAfterEdit(undefined, true)).toBe('user')
  })
  it('campo vazio não editado não tem origem', () => {
    expect(originAfterEdit(undefined, false)).toBeUndefined()
  })
})

describe('estimateTotal', () => {
  it('soma os valores preenchidos', () => {
    expect(estimateTotal({ rent: '1.700', condoFee: '270', iptu: '' })).toBe(1970)
  })
  it('tudo vazio → null', () => {
    expect(estimateTotal({ rent: '', condoFee: '', iptu: '' })).toBeNull()
  })
  it('texto inválido é ignorado', () => {
    expect(estimateTotal({ rent: 'combinar', condoFee: '300', iptu: '' })).toBe(300)
  })
})

describe('initialOrigins', () => {
  it('jsonld/meta/text → page; slug → url', () => {
    expect(initialOrigins({ rent: 'jsonld', city: 'slug', condoFee: 'text' })).toEqual({ rent: 'page', city: 'url', condoFee: 'page' })
  })
})
