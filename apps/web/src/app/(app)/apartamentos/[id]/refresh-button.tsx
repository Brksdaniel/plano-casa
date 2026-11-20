'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { refreshApartmentAction } from './actions'

export function RefreshButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshApartmentAction(id)
          if (result.ok) toast.success(result.message)
          else toast.error(result.error)
          router.refresh()
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? 'Verificando…' : 'Atualizar anúncio agora'}
    </Button>
  )
}
