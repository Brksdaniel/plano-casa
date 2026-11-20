import type { Extraction } from './extract/types'

export type ApartmentStatus =
  | 'ativo'
  | 'possivelmente_alugado'
  | 'indisponivel'
  | 'removido'
  | 'erro_acesso'
  | 'verificacao_necessaria'
  | 'nao_verificado'

export type MonitorModeName = 'auto' | 'extension' | 'manual'

export type StatusState = {
  status: ApartmentStatus
  consecutiveFailures: number
  consecutiveNotFound: number
  /** Quando começou a sequência atual de "não encontrado". */
  lastNotFoundAt: string | null
  mode: MonitorModeName
}

export type Observation =
  | { kind: 'listing'; availability: Extraction['availability']; evidence: string[] }
  | { kind: 'not_found' }
  | { kind: 'blocked' }
  | { kind: 'failed' }
  | { kind: 'other' }

export const FAILURES_BEFORE_DEMOTE = 3
export const NOT_FOUND_CONFIRM_HOURS = 12

export type StatusResult = StatusState & { evidence: string | null; demoted: boolean }

/**
 * Regras do spec §6. Bloqueio/erro NUNCA viram indisponível/removido/alugado.
 * "Removido" exige 404/410 em verificações separadas por pelo menos 12 h.
 */
export function nextStatus(prev: StatusState, obs: Observation, now: Date): StatusResult {
  if (obs.kind === 'listing') {
    let status: ApartmentStatus
    let evidence: string | null = null
    if (obs.availability === 'active') status = 'ativo'
    else if (obs.availability === 'explicit_unavailable') {
      status = 'indisponivel'
      evidence = obs.evidence.join(' ') || 'O anúncio informou indisponibilidade.'
    } else status = prev.status === 'ativo' ? 'ativo' : 'verificacao_necessaria'
    return { ...prev, status, consecutiveFailures: 0, consecutiveNotFound: 0, lastNotFoundAt: null, evidence, demoted: false }
  }

  if (obs.kind === 'not_found') {
    const startedAt = prev.consecutiveNotFound > 0 && prev.lastNotFoundAt ? prev.lastNotFoundAt : now.toISOString()
    const confirmed =
      prev.consecutiveNotFound > 0 && now.getTime() - new Date(startedAt).getTime() >= NOT_FOUND_CONFIRM_HOURS * 3_600_000
    return {
      ...prev,
      status: confirmed ? 'removido' : 'verificacao_necessaria',
      consecutiveNotFound: prev.consecutiveNotFound + 1,
      lastNotFoundAt: startedAt,
      consecutiveFailures: 0,
      evidence: confirmed
        ? `A página do anúncio não existe mais em verificações desde ${startedAt}.`
        : 'A página do anúncio não foi encontrada nesta verificação.',
      demoted: false,
    }
  }

  // blocked / failed / other: nunca concluir que foi alugado.
  const failures = prev.consecutiveFailures + 1
  const demoted = prev.mode === 'auto' && failures === FAILURES_BEFORE_DEMOTE
  return {
    ...prev,
    status: 'erro_acesso',
    consecutiveFailures: failures,
    mode: demoted ? 'extension' : prev.mode,
    evidence: demoted
      ? `Bloqueado ${FAILURES_BEFORE_DEMOTE} vezes seguidas; passou a ser atualizado pela extensão.`
      : obs.kind === 'blocked'
        ? 'O site bloqueou a leitura automática.'
        : 'O site não respondeu.',
    demoted,
  }
}
