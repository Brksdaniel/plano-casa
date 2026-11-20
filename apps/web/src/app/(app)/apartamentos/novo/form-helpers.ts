import { type FieldKey, type FieldMethod, parseBRL } from '@deniels/core'
import type { FieldOrigin } from '@/lib/apartments/schema'

/** Origem de um campo depois que o usuário (talvez) o editou. */
export function originAfterEdit(prev: FieldOrigin | undefined, changed: boolean): FieldOrigin | undefined {
  return changed ? 'user' : prev
}

/** Origem inicial de cada campo pré-preenchido. */
export function initialOrigins(methods: Partial<Record<FieldKey, FieldMethod>>): Partial<Record<FieldKey, FieldOrigin>> {
  const out: Partial<Record<FieldKey, FieldOrigin>> = {}
  for (const [key, method] of Object.entries(methods) as [FieldKey, FieldMethod][]) {
    out[key] = method === 'slug' ? 'url' : 'page'
  }
  return out
}

/** Total mensal estimado (aluguel + condomínio + IPTU). Tudo vazio → null. */
export function estimateTotal(values: { rent: string; condoFee: string; iptu: string }): number | null {
  const parts = [values.rent, values.condoFee, values.iptu].map((v) => parseBRL(v))
  if (parts.every((p) => p === undefined)) return null
  return parts.reduce<number>((sum, p) => sum + (p ?? 0), 0)
}
