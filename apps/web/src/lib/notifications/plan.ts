import { describeChange } from '@/lib/apartments/trend'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Prefs = { min_change_abs: number | string; min_change_pct: number | string }
export type NotificationInsert = TablesInsert<'notifications'>

const UNAVAILABLE_TITLE: Record<string, string> = {
  possivelmente_alugado: 'Pode ter sido alugado',
  indisponivel: 'Ficou indisponível',
  removido: 'Anúncio removido',
}

function aboveThreshold(c: Tables<'apartment_changes'>, prefs: Prefs): boolean {
  const abs = Math.abs(Number(c.diff_abs ?? 0))
  const pct = Math.abs(Number(c.diff_pct ?? 0))
  return abs >= Number(prefs.min_change_abs) || pct >= Number(prefs.min_change_pct)
}

/**
 * Transforma uma mudança detectada em notificação, respeitando os limiares do usuário.
 * `dedupe_key = change:<id>` garante uma notificação por mudança, mesmo rodando várias vezes.
 */
export function notificationForChange(c: Tables<'apartment_changes'>, name: string, prefs: Prefs): NotificationInsert | null {
  let title: string | null = null
  switch (c.kind) {
    case 'price_down':
    case 'price_up':
      if (aboveThreshold(c, prefs)) title = c.kind === 'price_down' ? 'Aluguel caiu' : 'Aluguel subiu'
      break
    case 'condo_change':
      if (aboveThreshold(c, prefs)) title = 'Condomínio mudou'
      break
    case 'iptu_change':
      if (aboveThreshold(c, prefs)) title = 'IPTU mudou'
      break
    case 'status_change': {
      const from = c.old_value ?? ''
      const to = c.new_value ?? ''
      if (to in UNAVAILABLE_TITLE) title = UNAVAILABLE_TITLE[to]
      else if (to === 'ativo' && from in UNAVAILABLE_TITLE) title = 'Voltou a ficar disponível'
      break
    }
    case 'features_change':
      title = 'Características mudaram'
      break
    default:
      title = null // descrição e fotos: ficam só na linha do tempo do imóvel
  }
  if (!title) return null
  return {
    user_id: c.user_id,
    apartment_id: c.apartment_id,
    change_id: c.id,
    kind: c.kind,
    title: `${title}: ${name}`,
    body: describeChange(c),
    dedupe_key: `change:${c.id}`,
  }
}

type AptForError = { id: string; user_id: string; status: string; consecutive_failures: number; last_success_at: string | null }

/** Aviso único após 3 falhas seguidas de acesso (uma vez por sequência de falhas). */
export function accessErrorNotification(a: AptForError, name: string): NotificationInsert | null {
  if (a.status !== 'erro_acesso' || a.consecutive_failures < 3) return null
  return {
    user_id: a.user_id,
    apartment_id: a.id,
    kind: 'access_error',
    title: `Não conseguimos verificar: ${name}`,
    body: 'O site bloqueou ou não respondeu nas últimas 3 tentativas. Isso não significa que foi alugado — abra o anúncio ou atualize manualmente.',
    dedupe_key: `apt:${a.id}:access:${a.last_success_at ?? 'never'}`,
  }
}
