export const REFRESH_COOLDOWN_MINUTES = 10

/** Minutos que faltam para poder verificar de novo (0 = pode agora). */
export function refreshWaitMinutes(lastCheckAt: string | null, now: Date): number {
  if (!lastCheckAt) return 0
  const elapsed = (now.getTime() - new Date(lastCheckAt).getTime()) / 60_000
  return elapsed >= REFRESH_COOLDOWN_MINUTES ? 0 : Math.ceil(REFRESH_COOLDOWN_MINUTES - elapsed)
}
