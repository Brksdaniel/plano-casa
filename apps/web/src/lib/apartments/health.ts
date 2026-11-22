export const STALE_EXTENSION_DAYS = 3

const GROUP: Record<string, 'disponiveis' | 'atencao' | 'indisponiveis'> = {
  ativo: 'disponiveis',
  erro_acesso: 'atencao',
  verificacao_necessaria: 'atencao',
  nao_verificado: 'atencao',
  possivelmente_alugado: 'indisponiveis',
  indisponivel: 'indisponiveis',
  removido: 'indisponiveis',
}

type Item = { id: string; status: string; monitor_mode: string; last_success_at: string | null }

/**
 * Saúde do monitoramento: quantos estão disponíveis / precisam de atenção / indisponíveis,
 * e quais anúncios "via extensão" precisam ser abertos (sem dado há mais de 3 dias; nunca lidos primeiro).
 */
export function monitoringHealth<T extends Item>(list: T[], now: Date) {
  const counts = { disponiveis: 0, atencao: 0, indisponiveis: 0 }
  for (const a of list) counts[GROUP[a.status] ?? 'atencao']++
  const limit = now.getTime() - STALE_EXTENSION_DAYS * 86_400_000
  const age = (a: T) => (a.last_success_at ? new Date(a.last_success_at).getTime() : 0)
  const staleExtension = list
    .filter((a) => a.monitor_mode === 'extension' && GROUP[a.status] !== 'indisponiveis' && age(a) < limit)
    .sort((x, y) => age(x) - age(y))
  return { counts, staleExtension }
}
