'use client'

import type { FieldKey } from '@deniels/core'
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FieldOrigin } from '@/lib/apartments/schema'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type CreateState, type ReadResult, createApartmentAction, readListingAction } from './actions'
import { FieldOriginBadge } from './field-origin-badge'
import { estimateTotal, initialOrigins, originAfterEdit } from './form-helpers'

type FormKey = Exclude<FieldKey, 'title' | 'mainImageUrl' | 'description'>
const MONEY: FormKey[] = ['rent', 'condoFee', 'iptu']

function initialValue(key: FormKey, value: string | number | undefined): string {
  if (value === undefined) return ''
  if (typeof value === 'number' && MONEY.includes(key)) return value.toLocaleString('pt-BR')
  return String(value)
}

export function NewApartmentFlow() {
  const [read, readAction, reading] = useActionState<ReadResult | null, FormData>(readListingAction, null)
  const [readKey, setReadKey] = useState(0)

  return (
    <div className="space-y-6">
      <form
        action={(fd) => {
          setReadKey((k) => k + 1)
          readAction(fd)
        }}
        className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6"
      >
        <Label htmlFor="url" className="text-base font-semibold">
          Link do anúncio
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Copie o endereço da página do anúncio e cole aqui. O sistema tenta ler as informações sozinho.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="url"
              name="url"
              type="url"
              inputMode="url"
              required
              autoFocus
              placeholder="https://www.exemplo.com.br/imovel/..."
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" className="h-11 sm:w-40" disabled={reading}>
            {reading ? <Loader2 className="animate-spin" /> : <Search />}
            {reading ? 'Lendo…' : 'Ler anúncio'}
          </Button>
        </div>
        {read && !read.ok && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {read.error}
          </p>
        )}
      </form>

      {read?.ok && <ApartmentForm key={`${readKey}-${read.url}`} read={read} />}
    </div>
  )
}

function ReadBanner({ read }: { read: Extract<ReadResult, { ok: true }> }) {
  const { extraction, fetch, platformLabel, duplicate } = read

  if (duplicate) {
    return (
      <Banner tone="warning" title="Você já acompanha este anúncio">
        <Link href={`/apartamentos/${duplicate.id}`} className="font-medium underline underline-offset-2">
          Ver “{duplicate.name}”
        </Link>
      </Banner>
    )
  }
  if (fetch === 'fetched' && extraction.pageKind === 'listing') {
    return (
      <Banner tone="success" title={`Dados lidos do anúncio agora · ${platformLabel}`}>
        Confira os campos marcados <b>do anúncio</b> e complete o que faltar.
      </Banner>
    )
  }
  if (fetch === 'fetched' && extraction.pageKind === 'not_found') {
    return (
      <Banner tone="warning" title="Anúncio não encontrado">
        O site respondeu que esta página não existe (pode ter sido removida). Confira o link. Se salvar, o imóvel fica como “Verificação necessária”.
      </Banner>
    )
  }
  if (fetch === 'not_allowed') {
    return (
      <Banner tone="warning" title={`${platformLabel} bloqueia leitura automática`}>
        Preenchemos o que o próprio link informa (marcado <b>do link</b>). Complete o resto, principalmente o aluguel. A extensão do
        Chrome (Etapa 4) vai atualizar este anúncio quando você abri-lo.
      </Banner>
    )
  }
  return (
    <Banner tone="warning" title="Não foi possível ler o anúncio agora">
      {fetch === 'fetched' && extraction.pageKind === 'challenge'
        ? 'O site bloqueou a leitura automática neste momento.'
        : 'O site não respondeu.'}{' '}
      Nada foi inventado: preencha manualmente. O sistema tentará de novo depois.
    </Banner>
  )
}

function Banner({ tone, title, children }: { tone: 'success' | 'warning'; title: string; children: React.ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-sm',
        tone === 'success' ? 'border-success/30 bg-success/10' : 'border-warning/40 bg-warning/10',
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', tone === 'success' ? 'text-success' : 'text-warning-foreground dark:text-warning')} />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

function ApartmentForm({ read }: { read: Extract<ReadResult, { ok: true }> }) {
  const { extraction } = read
  const [state, formAction, saving] = useActionState<CreateState, FormData>(createApartmentAction, {})

  const fieldKeys: FormKey[] = ['neighborhood', 'city', 'rent', 'condoFee', 'iptu', 'bedrooms', 'bathrooms', 'parking', 'areaM2']
  const initial = useMemo(
    () => Object.fromEntries(fieldKeys.map((k) => [k, initialValue(k, extraction.fields[k])])) as Record<FormKey, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraction],
  )
  const startOrigins = useMemo(() => initialOrigins(extraction.methods), [extraction])
  const [values, setValues] = useState<Record<FormKey, string>>(initial)
  const [priority, setPriority] = useState(3)

  const origins = useMemo(() => {
    const out: Partial<Record<FieldKey, FieldOrigin>> = {}
    for (const k of fieldKeys) {
      if (!values[k].trim()) continue
      const o = originAfterEdit(startOrigins[k], values[k] !== initial[k])
      if (o) out[k] = o
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, initial, startOrigins])

  const total = estimateTotal(values)
  const blocked = Boolean(read.duplicate)
  const title = typeof extraction.fields.title === 'string' ? extraction.fields.title : undefined
  const image = typeof extraction.fields.mainImageUrl === 'string' ? extraction.fields.mainImageUrl : undefined

  const field = (key: FormKey, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={key}>{label}</Label>
        <FieldOriginBadge origin={origins[key]} />
      </div>
      <Input
        id={key}
        name={key}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        aria-invalid={Boolean(state.fieldErrors?.[key])}
        className="h-10"
        {...props}
      />
      {state.fieldErrors?.[key] && <p className="text-xs text-destructive">{state.fieldErrors[key]}</p>}
    </div>
  )

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="url" value={read.url} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="fieldOrigins" value={JSON.stringify(origins)} />

      <ReadBanner read={read} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <section className="space-y-4">
            <h2 className="font-semibold">Identificação</h2>
            <div className="space-y-1.5">
              <Label htmlFor="customName">Nome para você reconhecer</Label>
              <Input id="customName" name="customName" placeholder={title ?? 'Ex.: Apê perto do trabalho'} maxLength={120} className="h-10" />
              <p className="text-xs text-muted-foreground">Opcional. Se ficar vazio, usamos o título do anúncio.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('neighborhood', 'Bairro')}
              {field('city', 'Cidade')}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold">Valores mensais</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {field('rent', 'Aluguel (R$)', { inputMode: 'decimal', placeholder: '0,00' })}
              {field('condoFee', 'Condomínio (R$)', { inputMode: 'decimal', placeholder: '0,00' })}
              {field('iptu', 'IPTU mensal (R$)', { inputMode: 'decimal', placeholder: '0,00' })}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold">Características</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {field('bedrooms', 'Quartos', { inputMode: 'numeric' })}
              {field('bathrooms', 'Banheiros', { inputMode: 'numeric' })}
              {field('parking', 'Vagas', { inputMode: 'numeric' })}
              {field('areaM2', 'Área (m²)', { inputMode: 'decimal' })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Prioridade</h2>
            <div className="flex gap-2" role="radiogroup" aria-label="Prioridade">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={priority === n}
                  onClick={() => setPriority(n)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
                    priority === n ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">1 = pouco interesse · 5 = favorito</p>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="notes">Observações pessoais</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={2000} placeholder="Ex.: perto da academia, visitar no sábado…" />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/10] items-center justify-center bg-muted text-sm text-muted-foreground">Sem foto</div>
            )}
            <div className="space-y-3 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{read.platformLabel}</p>
              {title && <p className="line-clamp-2 text-sm font-medium">{title}</p>}
              <div>
                <p className="text-xs text-muted-foreground">Total mensal estimado</p>
                <p className="text-2xl font-semibold tracking-tight">{formatBRL(total)}</p>
                <p className="text-xs text-muted-foreground">aluguel + condomínio + IPTU</p>
              </div>
              <a
                href={read.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Abrir anúncio <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          {state.error && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}{' '}
              {state.duplicateId && (
                <Link href={`/apartamentos/${state.duplicateId}`} className="font-medium underline">
                  Ver imóvel
                </Link>
              )}
            </div>
          )}

          <Button type="submit" className="h-11 w-full" disabled={saving || blocked}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar e acompanhar'}
          </Button>
        </aside>
      </div>
    </form>
  )
}
