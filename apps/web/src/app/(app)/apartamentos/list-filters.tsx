'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const SITUACAO = [
  ['todos', 'Todos'],
  ['disponiveis', 'Disponíveis'],
  ['atencao', 'Precisam de atenção'],
  ['indisponiveis', 'Indisponíveis'],
] as const

const selectClass =
  'h-9 rounded-lg border bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Filtros da lista guardados na URL (dá para favoritar/compartilhar o filtro). */
export function ListFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString())
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    next.delete('novo')
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }

  // Busca com pequena espera para não recarregar a cada tecla.
  useEffect(() => {
    if (q === (params.get('q') ?? '')) return
    const t = setTimeout(() => set('q', q.trim(), ''), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const situacao = params.get('situacao') ?? 'todos'
  const active = params.size > 0 && !(params.size === 1 && params.has('novo'))

  return (
    <div className={cn('space-y-3 transition-opacity', pending && 'opacity-60')}>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Situação">
        {SITUACAO.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={situacao === value}
            onClick={() => set('situacao', value, 'todos')}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              situacao === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, bairro ou cidade" className="pl-8" aria-label="Buscar" />
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <select
            aria-label="Modo de monitoramento"
            className={cn(selectClass, 'flex-1 sm:flex-none')}
            value={params.get('modo') ?? 'todos'}
            onChange={(e) => set('modo', e.target.value, 'todos')}
          >
            <option value="todos">Todos os modos</option>
            <option value="auto">Servidor</option>
            <option value="extension">Extensão</option>
            <option value="manual">Manual</option>
          </select>
          <select
            aria-label="Ordenar"
            className={cn(selectClass, 'flex-1 sm:flex-none')}
            value={params.get('ordem') ?? 'recentes'}
            onChange={(e) => set('ordem', e.target.value, 'recentes')}
          >
            <option value="recentes">Mais recentes</option>
            <option value="menor_total">Menor total</option>
            <option value="maior_total">Maior total</option>
            <option value="oportunidade">Melhor oportunidade</option>
            <option value="prioridade">Maior prioridade</option>
          </select>
          {active && (
            <button
              onClick={() => {
                setQ('')
                startTransition(() => router.replace(pathname, { scroll: false }))
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" /> Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
