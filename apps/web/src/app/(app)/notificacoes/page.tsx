import { BellOff } from 'lucide-react'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/empty-state'

export const metadata: Metadata = { title: 'Notificações' }

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Notificações</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mudanças de preço, disponibilidade e avisos do monitoramento.</p>
      </div>
      <EmptyState
        icon={BellOff}
        title="Nenhuma notificação"
        description="Você será avisado aqui quando um apartamento mudar de preço, ficar indisponível ou não puder ser verificado."
      />
    </div>
  )
}
