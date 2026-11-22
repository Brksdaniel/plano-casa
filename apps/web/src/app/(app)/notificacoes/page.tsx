import { AlertTriangle, ArrowDownRight, ArrowUpRight, BellOff, CalendarDays, CheckCheck, Home, Info, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative } from '@/lib/format'
import { createServerSupabase } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { markReadAction } from './actions'

export const metadata: Metadata = { title: 'Notificações' }

function KindIcon({ kind, title }: { kind: string; title: string }) {
  const base = 'size-9 shrink-0 rounded-full p-2'
  if (kind === 'price_down') return <ArrowDownRight className={cn(base, 'bg-success/10 text-success')} />
  if (kind === 'price_up') return <ArrowUpRight className={cn(base, 'bg-destructive/10 text-destructive')} />
  if (kind === 'access_error') return <AlertTriangle className={cn(base, 'bg-warning/15 text-warning-foreground dark:text-warning')} />
  if (kind === 'digest') return <CalendarDays className={cn(base, 'bg-accent text-accent-foreground')} />
  if (kind === 'status_change')
    return title.startsWith('Voltou') ? (
      <Home className={cn(base, 'bg-success/10 text-success')} />
    ) : (
      <XCircle className={cn(base, 'bg-muted text-muted-foreground')} />
    )
  return <Info className={cn(base, 'bg-muted text-muted-foreground')} />
}

async function NotificationList() {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, apartment_id, read_at, emailed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Falha ao carregar notificações: ${error.message}`)
  const now = new Date()
  const unread = data.filter((n) => !n.read_at).length

  if (data.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="Nenhuma notificação"
        description="Você será avisado aqui quando um apartamento mudar de preço, ficar indisponível ou não puder ser verificado. O resumo diário também aparece aqui."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Tudo lido'}</p>
        {unread > 0 && (
          <form action={markReadAction.bind(null, undefined)}>
            <Button variant="outline" size="sm">
              <CheckCheck /> Marcar todas como lidas
            </Button>
          </form>
        )}
      </div>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
        {data.map((n) => (
          <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3.5', !n.read_at && 'bg-accent/40')}>
            <KindIcon kind={n.kind} title={n.title} />
            <div className="min-w-0 flex-1">
              {n.apartment_id ? (
                <Link href={`/apartamentos/${n.apartment_id}`} className="font-medium hover:underline">
                  {n.title}
                </Link>
              ) : (
                <Link href="/dashboard" className="font-medium hover:underline">
                  {n.title}
                </Link>
              )}
              {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(n.created_at)}>
                {formatRelative(n.created_at, now)}
                {n.emailed_at && ' · enviada por e-mail'}
              </p>
            </div>
            {!n.read_at && (
              <form action={markReadAction.bind(null, n.id)}>
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Marcar como lida" aria-label="Marcar como lida">
                  <span className="block size-2.5 rounded-full bg-primary" />
                </button>
              </form>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Notificações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mudanças de preço, disponibilidade, avisos do monitoramento e o resumo diário. Atualizadas de hora em hora.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <NotificationList />
      </Suspense>
    </div>
  )
}
