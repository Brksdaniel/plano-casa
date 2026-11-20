import { Database, Mail, Puzzle, Timer } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { type IntegrationStatus, supabaseStatus } from '@/lib/integrations/status'
import { createServerSupabase } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Configurações' }

function StatusBadge({ status }: { status: IntegrationStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 gap-1.5 rounded-full',
        status.state === 'ok' && 'border-success/30 bg-success/10 text-success',
        status.state === 'pending' && 'border-border bg-muted text-muted-foreground',
        status.state === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status.state === 'ok' && 'bg-success',
          status.state === 'pending' && 'bg-muted-foreground/60',
          status.state === 'error' && 'bg-destructive',
        )}
      />
      {status.label}
    </Badge>
  )
}

function IntegrationRow({
  icon: Icon,
  name,
  description,
  status,
}: {
  icon: typeof Database
  name: string
  description: string
  status: IntegrationStatus
}) {
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{name}</p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{status.detail ?? description}</p>
      </div>
    </li>
  )
}

async function SupabaseRow() {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
  return (
    <IntegrationRow
      icon={Database}
      name="Banco de dados (Supabase)"
      description="Schema tracker acessível com o seu login."
      status={supabaseStatus(error)}
    />
  )
}

export default function SettingsPage() {
  const resendConfigured = Boolean(process.env.RESEND_API_KEY)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="mt-1 text-sm text-muted-foreground">Situação real das integrações do sistema.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="border-b px-5 py-4">
          <h3 className="font-semibold">Integrações</h3>
        </div>
        <ul className="divide-y">
          <Suspense fallback={<li className="px-5 py-4"><Skeleton className="h-12 w-full" /></li>}>
            <SupabaseRow />
          </Suspense>
          <IntegrationRow
            icon={Timer}
            name="Monitoramento automático"
            description="Agendamento das verificações a cada 6 horas. Será configurado na Etapa 3."
            status={{ state: 'pending', label: 'Não configurado' }}
          />
          <IntegrationRow
            icon={Mail}
            name="E-mail (Resend)"
            description="Envio de notificações e do resumo diário. Será configurado na Etapa 7."
            status={resendConfigured ? { state: 'ok', label: 'Configurado' } : { state: 'pending', label: 'Não configurado' }}
          />
          <IntegrationRow
            icon={Puzzle}
            name="Extensão do Chrome"
            description="Captura de anúncios de sites que bloqueiam acesso automático. Disponível na Etapa 4."
            status={{ state: 'pending', label: 'Não conectada' }}
          />
        </ul>
      </section>
    </div>
  )
}
