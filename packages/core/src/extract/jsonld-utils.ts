import type { JsonLdNode } from '../html'

export function typeIs(node: unknown, ...types: string[]): boolean {
  if (!node || typeof node !== 'object') return false
  const t = (node as JsonLdNode)['@type']
  const list = Array.isArray(t) ? t : [t]
  return list.some((x) => typeof x === 'string' && types.includes(x))
}

export function obj(value: unknown): JsonLdNode | undefined {
  if (Array.isArray(value)) return obj(value[0])
  return value && typeof value === 'object' ? (value as JsonLdNode) : undefined
}

export function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number') return String(value)
  return undefined
}

export function int(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN
  return Number.isInteger(n) && n >= 0 ? n : undefined
}

export function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Limites alinhados com o que a API do site aceita da extensão. */
export const MAX_IMAGES = 40
export const MAX_IMAGE_URL = 1000

export function images(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const item of list) {
    if (out.length >= MAX_IMAGES) break
    const url = typeof item === 'string' ? item : str(obj(item)?.url)
    if (url && url.length <= MAX_IMAGE_URL && /^https:\/\//i.test(url) && !out.includes(url)) out.push(url)
  }
  return out
}

/** "https://schema.org/InStock" → "InStock" */
export function availabilityName(value: unknown): string | undefined {
  const s = str(value)
  return s?.split('/').pop()
}

export const UNAVAILABLE = new Set(['OutOfStock', 'SoldOut', 'Discontinued'])
