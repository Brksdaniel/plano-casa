import { describe, expect, it } from 'vitest'
import { parsed } from '../test-helpers'
import { emptyExtraction, setField } from './types'

describe('setField', () => {
  it('corta textos longos demais em vez de deixar o envio ser recusado', () => {
    const e = emptyExtraction(parsed('https://www.zapimoveis.com.br/imovel/aluguel-apartamento-id-2923224438/'), 'listing')
    setField(e, 'description', 'x'.repeat(12_000), 'jsonld')
    setField(e, 'title', 'y'.repeat(3_000), 'jsonld')
    expect(String(e.fields.description)).toHaveLength(10_000)
    expect(String(e.fields.title)).toHaveLength(2_000)
  })
})
