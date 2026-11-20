import type { FieldMethod } from './extract/types'

export type Confidence = 'alta' | 'media' | 'baixa'

/**
 * Confiabilidade dos dados (spec §7):
 * alta  = preço de dado estruturado, com até 36 h, cadastro completo
 * média = estruturado até 7 dias, ou metadado/texto até 7 dias
 * baixa = digitado/lido do link, mais de 7 dias ou cadastro incompleto
 * null  = sem preço conhecido
 */
export function computeConfidence(input: {
  rentMethod?: FieldMethod | 'user'
  ageHours: number
  complete: boolean
}): Confidence | null {
  const { rentMethod, ageHours, complete } = input
  if (!rentMethod) return null
  if (!complete || ageHours > 24 * 7 || rentMethod === 'user' || rentMethod === 'slug') return 'baixa'
  if (rentMethod === 'jsonld' && ageHours <= 36) return 'alta'
  return 'media'
}
