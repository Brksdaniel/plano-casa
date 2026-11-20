'use client'

import { Loader2, Puzzle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getPublicEnv } from '@/lib/env'
import { type BridgeReply, sendToExtension } from '@/lib/extension/bridge'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID ?? ''

type State = { kind: 'checking' } | { kind: 'not_configured' } | { kind: 'not_installed' } | { kind: 'disconnected' } | { kind: 'connected'; email?: string }

function badgeFor(state: State) {
  switch (state.kind) {
    case 'connected':
      return { label: 'Conectada', tone: 'border-success/30 bg-success/10 text-success' }
    case 'disconnected':
      return { label: 'Instalada, não conectada', tone: 'border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning' }
    case 'not_installed':
      return { label: 'Não instalada', tone: 'border-border bg-muted text-muted-foreground' }
    case 'not_configured':
      return { label: 'Não configurado', tone: 'border-border bg-muted text-muted-foreground' }
    default:
      return { label: 'Verificando…', tone: 'border-border bg-muted text-muted-foreground' }
  }
}

export function ExtensionConnect() {
  const [state, setState] = useState<State>(EXTENSION_ID ? { kind: 'checking' } : { kind: 'not_configured' })
  const [busy, setBusy] = useState(false)

  const apply = useCallback((r: BridgeReply) => {
    if (!r.ok) setState({ kind: 'not_installed' })
    else setState(r.connected ? { kind: 'connected', email: r.email } : { kind: 'disconnected' })
  }, [])

  useEffect(() => {
    if (!EXTENSION_ID) return
    let alive = true
    sendToExtension(EXTENSION_ID, { type: 'status' }).then((r) => alive && apply(r))
    return () => {
      alive = false
    }
  }, [apply])

  async function connect() {
    setBusy(true)
    try {
      const { data } = await createBrowserSupabase().auth.getSession()
      const s = data.session
      if (!s?.refresh_token || !s.expires_at) {
        toast.error('Sessão não encontrada. Saia e entre de novo no site.')
        return
      }
      const env = getPublicEnv()
      const r = await sendToExtension(EXTENSION_ID, {
        type: 'connect',
        session: { accessToken: s.access_token, refreshToken: s.refresh_token, expiresAt: s.expires_at, email: s.user.email ?? '' },
        siteUrl: window.location.origin,
        supabaseUrl: env.supabaseUrl,
        publishableKey: env.supabasePublishableKey,
      })
      apply(r)
      if (r.ok && r.connected) toast.success('Extensão conectada.')
      else toast.error('Não foi possível conectar. A extensão está instalada e ativada?')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    const r = await sendToExtension(EXTENSION_ID, { type: 'disconnect' })
    apply(r)
    setBusy(false)
    if (r.ok) toast.success('Extensão desconectada.')
  }

  const badge = badgeFor(state)

  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Puzzle className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Extensão do Chrome</p>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', badge.tone)}>
            <span className="size-1.5 rounded-full bg-current opacity-80" />
            {badge.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {state.kind === 'connected'
            ? `Atualiza os anúncios de sites que bloqueiam o servidor quando você os abre${state.email ? ` · ${state.email}` : ''}.`
            : state.kind === 'not_installed'
              ? 'Instale pelo Chrome: chrome://extensions → Modo do desenvolvedor → Carregar sem compactação → pasta apps/extension/dist.'
              : state.kind === 'not_configured'
                ? 'O ID da extensão (NEXT_PUBLIC_EXTENSION_ID) ainda não foi configurado no site.'
                : 'Captura anúncios de sites que bloqueiam acesso automático, direto da página que você abre.'}
        </p>
        {(state.kind === 'disconnected' || state.kind === 'connected') && (
          <div className="mt-3">
            {state.kind === 'disconnected' ? (
              <Button size="sm" onClick={connect} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Conectar extensão
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>
                Desconectar
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
