import type { ApartmentStatus } from './status'

export type ObservedValues = {
  rent?: number
  condoFee?: number
  iptu?: number
  bedrooms?: number
  bathrooms?: number
  parking?: number
  areaM2?: number
  descriptionHash?: string
  imagesHash?: string
}

export type ChangeKind =
  | 'price_down'
  | 'price_up'
  | 'condo_change'
  | 'iptu_change'
  | 'status_change'
  | 'description_change'
  | 'features_change'
  | 'images_change'

export type ChangeDraft = {
  kind: ChangeKind
  oldValue: string | null
  newValue: string | null
  diffAbs: number | null
  diffPct: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const both = (a: number | undefined, b: number | undefined): a is number => a !== undefined && b !== undefined

function money(kind: ChangeKind, old: number, now: number): ChangeDraft {
  return {
    kind,
    oldValue: String(old),
    newValue: String(now),
    diffAbs: round2(now - old),
    diffPct: old === 0 ? null : round2(((now - old) / old) * 100),
  }
}

const FEATURES: [keyof ObservedValues, string][] = [
  ['bedrooms', 'quartos'],
  ['bathrooms', 'banheiros'],
  ['parking', 'vagas'],
  ['areaM2', 'área'],
]

/** Compara a leitura anterior com a nova. Campo ausente (de qualquer lado) nunca gera mudança. */
export function detectChanges(
  prev: ObservedValues,
  next: ObservedValues,
  prevStatus: ApartmentStatus,
  nextStatus: ApartmentStatus,
): ChangeDraft[] {
  const out: ChangeDraft[] = []

  if (both(prev.rent, next.rent) && prev.rent !== next.rent) {
    out.push(money(next.rent! < prev.rent ? 'price_down' : 'price_up', prev.rent, next.rent!))
  }
  if (both(prev.condoFee, next.condoFee) && prev.condoFee !== next.condoFee) out.push(money('condo_change', prev.condoFee, next.condoFee!))
  if (both(prev.iptu, next.iptu) && prev.iptu !== next.iptu) out.push(money('iptu_change', prev.iptu, next.iptu!))

  const changed = FEATURES.filter(([k]) => prev[k] !== undefined && next[k] !== undefined && prev[k] !== next[k])
  if (changed.length) {
    out.push({
      kind: 'features_change',
      oldValue: changed.map(([k, label]) => `${label} ${prev[k]}`).join(', '),
      newValue: changed.map(([k, label]) => `${label} ${next[k]}`).join(', '),
      diffAbs: null,
      diffPct: null,
    })
  }

  for (const [key, kind] of [
    ['descriptionHash', 'description_change'],
    ['imagesHash', 'images_change'],
  ] as const) {
    if (prev[key] && next[key] && prev[key] !== next[key]) {
      out.push({ kind, oldValue: null, newValue: null, diffAbs: null, diffPct: null })
    }
  }

  if (prevStatus !== nextStatus) {
    out.push({ kind: 'status_change', oldValue: prevStatus, newValue: nextStatus, diffAbs: null, diffPct: null })
  }
  return out
}

/** FNV-1a 32 bits (hex) de um texto normalizado (espaços e maiúsculas não importam). */
export function hashText(text: string): string {
  const normalized = text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
  let h = 0x811c9dc5
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function hashList(items: string[]): string {
  return hashText(items.join('\n'))
}
