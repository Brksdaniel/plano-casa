import { describe, expect, it } from 'vitest'
import type { ApartmentStatus } from '@/lib/database.types'
import { CONFIDENCE_LABEL, MODE_META, STATUS_META, displayName } from './meta'

const ALL: ApartmentStatus[] = ['ativo', 'possivelmente_alugado', 'indisponivel', 'removido', 'erro_acesso', 'verificacao_necessaria', 'nao_verificado']

describe('STATUS_META', () => {
  it('cobre os 7 status com rótulo', () => {
    for (const s of ALL) expect(STATUS_META[s].label.trim()).not.toBe('')
  })
  it('cores do spec: amarelo = precisa verificar, cinza = indisponível', () => {
    expect(STATUS_META.verificacao_necessaria.tone).toBe('yellow')
    expect(STATUS_META.erro_acesso.tone).toBe('yellow')
    expect(STATUS_META.nao_verificado.tone).toBe('yellow')
    expect(STATUS_META.indisponivel.tone).toBe('gray')
    expect(STATUS_META.removido.tone).toBe('gray')
    expect(STATUS_META.possivelmente_alugado.tone).toBe('gray')
  })
})

describe('MODE_META / CONFIDENCE_LABEL', () => {
  it('rótulos em PT-BR', () => {
    expect(MODE_META.auto.label).toBe('Servidor')
    expect(MODE_META.extension.label).toBe('Extensão')
    expect(MODE_META.manual.label).toBe('Manual')
    expect(CONFIDENCE_LABEL.media).toBe('Média')
  })
})

describe('displayName', () => {
  it('nome próprio > título do anúncio > fallback', () => {
    expect(displayName({ custom_name: 'Meu apê', source_title: 'Título' })).toBe('Meu apê')
    expect(displayName({ custom_name: null, source_title: 'Título' })).toBe('Título')
    expect(displayName({ custom_name: null, source_title: null })).toBe('Imóvel sem nome')
  })
  it('sem nome nem título: monta a partir dos dados reais', () => {
    expect(displayName({ custom_name: null, source_title: null, platform: 'zap', bedrooms: 2, city: 'Curitiba' })).toBe(
      'ZAP Imóveis · 2 quartos · Curitiba',
    )
    expect(displayName({ custom_name: null, source_title: null, platform: 'zap', bedrooms: 1, city: null })).toBe('ZAP Imóveis · 1 quarto')
  })
})
