import { displayName } from './meta'

export const SITUACOES = ['todos', 'disponiveis', 'atencao', 'indisponiveis'] as const
export const MODOS = ['todos', 'auto', 'extension', 'manual'] as const
export const ORDENS = ['recentes', 'menor_total', 'maior_total', 'oportunidade', 'prioridade'] as const

export type ListFilters = {
  situacao: (typeof SITUACOES)[number]
  modo: (typeof MODOS)[number]
  ordem: (typeof ORDENS)[number]
  q: string
}

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback

/** Lê os filtros da URL (?situacao=&modo=&ordem=&q=). Valores desconhecidos voltam ao padrão. */
export function parseListFilters(params: Record<string, string | string[] | undefined>): ListFilters {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : ''
  return {
    situacao: pick(SITUACOES, params.situacao, 'todos'),
    modo: pick(MODOS, params.modo, 'todos'),
    ordem: pick(ORDENS, params.ordem, 'recentes'),
    q,
  }
}

const SITUACAO_STATUS: Record<Exclude<ListFilters['situacao'], 'todos'>, string[]> = {
  disponiveis: ['ativo'],
  atencao: ['erro_acesso', 'verificacao_necessaria', 'nao_verificado'],
  indisponiveis: ['possivelmente_alugado', 'indisponivel', 'removido'],
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type Filterable = {
  id: string
  custom_name: string | null
  source_title: string | null
  neighborhood: string | null
  city: string | null
  status: string
  monitor_mode: string
  total_monthly: number
  rent: number | null
  priority: number
  created_at: string
}

export function applyListFilters<T extends Filterable>(list: T[], f: ListFilters, scores?: Map<string, number>): T[] {
  const needle = norm(f.q)
  const out = list.filter(
    (a) =>
      (f.situacao === 'todos' || SITUACAO_STATUS[f.situacao].includes(a.status)) &&
      (f.modo === 'todos' || a.monitor_mode === f.modo) &&
      (!needle ||
        norm([displayName(a), a.source_title, a.neighborhood, a.city].filter(Boolean).join(' ')).includes(needle)),
  )
  const total = (a: T) => (a.rent === null ? null : Number(a.total_monthly))
  const nullsLast = (x: number | null, y: number | null, dir: 1 | -1) =>
    x === null ? (y === null ? 0 : 1) : y === null ? -1 : (x - y) * dir
  const byDate = (a: T, b: T) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

  const cmp: Record<ListFilters['ordem'], (a: T, b: T) => number> = {
    recentes: byDate,
    menor_total: (a, b) => nullsLast(total(a), total(b), 1) || byDate(a, b),
    maior_total: (a, b) => nullsLast(total(a), total(b), -1) || byDate(a, b),
    oportunidade: (a, b) => nullsLast(scores?.get(a.id) ?? null, scores?.get(b.id) ?? null, -1) || byDate(a, b),
    prioridade: (a, b) => b.priority - a.priority || byDate(a, b),
  }
  return out.sort(cmp[f.ordem])
}
