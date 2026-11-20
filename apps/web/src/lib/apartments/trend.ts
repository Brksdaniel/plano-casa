import type { Tables } from '@/lib/database.types'
import { formatBRL } from '@/lib/format'
import { STATUS_META } from './meta'

export type Trend = { direction: 'down' | 'up' | 'flat' | 'none'; diffAbs: number; diffPct: number }

const round2 = (n: number) => Math.round(n * 100) / 100

export function priceTrend(latest: number | null, previous: number | null): Trend {
  if (latest === null || previous === null || previous === 0) return { direction: 'none', diffAbs: 0, diffPct: 0 }
  const diffAbs = round2(latest - previous)
  const diffPct = round2((diffAbs / previous) * 100)
  return { direction: diffAbs < 0 ? 'down' : diffAbs > 0 ? 'up' : 'flat', diffAbs, diffPct }
}

const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const signedPct = (n: number) => `${n < 0 ? '−' : '+'}${pct.format(Math.abs(n))}%`
const money = (v: string | null) => (v === null ? '—' : formatBRL(Number(v)))

/** Frase curta em PT-BR para uma mudança detectada. */
export function describeChange(c: Tables<'apartment_changes'>): string {
  switch (c.kind) {
    case 'price_down':
    case 'price_up': {
      const verb = c.kind === 'price_down' ? 'caiu' : 'subiu'
      const pctText = c.diff_pct !== null ? ` (${signedPct(Number(c.diff_pct))})` : ''
      return `Aluguel ${verb} ${formatBRL(Math.abs(Number(c.diff_abs ?? 0)))}${pctText}: de ${money(c.old_value)} para ${money(c.new_value)}`
    }
    case 'condo_change':
      return `Condomínio mudou de ${money(c.old_value)} para ${money(c.new_value)}`
    case 'iptu_change':
      return `IPTU mudou de ${money(c.old_value)} para ${money(c.new_value)}`
    case 'status_change': {
      const label = (s: string | null) => (s && s in STATUS_META ? STATUS_META[s as keyof typeof STATUS_META].label : (s ?? '—'))
      return `Situação: ${label(c.old_value)} → ${label(c.new_value)}`
    }
    case 'features_change':
      return `Características: ${c.old_value ?? '—'} → ${c.new_value ?? '—'}`
    case 'description_change':
      return 'A descrição do anúncio mudou'
    case 'images_change':
      return 'As fotos do anúncio mudaram'
  }
}
