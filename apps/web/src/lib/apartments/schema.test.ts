import { describe, expect, it } from 'vitest'
import { parseNewApartmentForm } from './schema'

function form(values: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

const URL_ = 'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-centro-curitiba-pr-47m2-id-1/'

describe('parseNewApartmentForm', () => {
  it('converte valores brasileiros e inteiros', () => {
    const r = parseNewApartmentForm(form({ url: URL_, rent: 'R$ 1.700,00', condoFee: '270', bedrooms: '2', priority: '4', areaM2: '47' }))
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.rent).toBe(1700)
      expect(r.data.condoFee).toBe(270)
      expect(r.data.iptu).toBeUndefined()
      expect(r.data.bedrooms).toBe(2)
      expect(r.data.priority).toBe(4)
      expect(r.data.areaM2).toBe(47)
    }
  })

  it('prioridade padrão 3 e origens vazias', () => {
    const r = parseNewApartmentForm(form({ url: URL_ }))
    expect(r.success && r.data.priority).toBe(3)
    expect(r.success && r.data.fieldOrigins).toEqual({})
  })

  it('link vazio → mensagem em PT-BR', () => {
    const r = parseNewApartmentForm(form({ url: '' }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.fieldErrors.url).toBe('Cole o link do anúncio.')
  })

  it('quartos negativo → erro', () => {
    const r = parseNewApartmentForm(form({ url: URL_, bedrooms: '-1' }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.fieldErrors.bedrooms).toMatch(/inválid|entre/i)
  })

  it('aluguel com texto sem número → erro (não vira vazio silenciosamente)', () => {
    const r = parseNewApartmentForm(form({ url: URL_, rent: 'combinar' }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.fieldErrors.rent).toBeDefined()
  })

  it('lê fieldOrigins do JSON e ignora chaves desconhecidas', () => {
    const r = parseNewApartmentForm(form({ url: URL_, fieldOrigins: JSON.stringify({ rent: 'user', bedrooms: 'url', hacker: 'x' }) }))
    expect(r.success && r.data.fieldOrigins).toEqual({ rent: 'user', bedrooms: 'url' })
  })
})
