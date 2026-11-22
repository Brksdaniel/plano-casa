export type RentPoint = { recorded_at: string; rent: number | null }

export type PriceStats = {
  initial: number
  current: number
  min: number
  max: number
  /** Variação do aluguel atual em relação ao primeiro registrado (%, 2 casas). */
  pctSinceStart: number
  readings: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

function chronological(points: RentPoint[]) {
  return points
    .filter((p): p is { recorded_at: string; rent: number } => p.rent !== null && Number.isFinite(Number(p.rent)))
    .map((p) => ({ at: new Date(p.recorded_at).getTime(), rent: Number(p.rent) }))
    .sort((a, b) => a.at - b.at)
}

/** Estatísticas do aluguel a partir do histórico. Sem leituras → null (nada é inventado). */
export function priceStats(points: RentPoint[]): PriceStats | null {
  const list = chronological(points)
  if (list.length === 0) return null
  const rents = list.map((p) => p.rent)
  const initial = rents[0]
  const current = rents[rents.length - 1]
  return {
    initial,
    current,
    min: Math.min(...rents),
    max: Math.max(...rents),
    pctSinceStart: initial > 0 ? round2(((current - initial) / initial) * 100) : 0,
    readings: list.length,
  }
}

/** Queda (%) do aluguel atual em relação ao maior valor dos últimos 14 dias. Aumento → 0. */
export function recentDropPct(points: RentPoint[], now: Date, days = 14): number {
  const list = chronological(points)
  if (list.length === 0) return 0
  const since = now.getTime() - days * 86_400_000
  const recent = list.filter((p) => p.at >= since)
  if (recent.length === 0) return 0
  const peak = Math.max(...recent.map((p) => p.rent))
  const current = list[list.length - 1].rent
  return peak > current ? round2(((peak - current) / peak) * 100) : 0
}
