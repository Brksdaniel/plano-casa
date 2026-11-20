import { describe, expect, it } from 'vitest'
import { supabaseStatus } from './status'

describe('supabaseStatus', () => {
  it('sem erro → conectado', () => {
    expect(supabaseStatus(null)).toEqual({ state: 'ok', label: 'Conectado' })
  })

  it('schema não exposto (PGRST106) → instrução clara', () => {
    const s = supabaseStatus({ code: 'PGRST106', message: 'The schema must be one of the following: public' })
    expect(s.state).toBe('error')
    expect(s.label).toBe('Ação necessária')
    expect(s.detail).toContain('Exposed schemas')
  })

  it('outro erro → mostra a mensagem original', () => {
    const s = supabaseStatus({ code: '500', message: 'boom' })
    expect(s).toEqual({ state: 'error', label: 'Erro', detail: 'boom' })
  })
})
