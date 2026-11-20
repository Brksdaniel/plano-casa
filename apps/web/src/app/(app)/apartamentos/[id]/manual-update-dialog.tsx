'use client'

import { Loader2, PencilLine } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { manualUpdateAction } from './actions'

const fmt = (v: number | null) => (v === null ? '' : v.toLocaleString('pt-BR'))

const OPTIONS = [
  { value: 'available', label: 'Disponível' },
  { value: 'rented', label: 'Parece alugado' },
  { value: 'unknown', label: 'Não sei' },
] as const

export function ManualUpdateDialog({
  id,
  rent,
  condoFee,
  iptu,
  variant = 'outline',
}: {
  id: string
  rent: number | null
  condoFee: number | null
  iptu: number | null
  variant?: 'outline' | 'default'
}) {
  const [open, setOpen] = useState(false)
  const [availability, setAvailability] = useState<(typeof OPTIONS)[number]['value']>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <PencilLine /> Atualizar manualmente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar manualmente</DialogTitle>
          <DialogDescription>
            Use o que você viu no anúncio agora. Campos vazios mantêm o valor atual.
          </DialogDescription>
        </DialogHeader>
        <form
          id="manual-update"
          className="space-y-4"
          action={(fd) => {
            setError(null)
            fd.set('availability', availability)
            startTransition(async () => {
              const result = await manualUpdateAction(id, fd)
              if (!result.ok) {
                setError(result.error)
                return
              }
              toast.success(result.message)
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['rent', 'Aluguel', rent],
                ['condoFee', 'Condomínio', condoFee],
                ['iptu', 'IPTU', iptu],
              ] as const
            ).map(([name, label, value]) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`m-${name}`}>{label}</Label>
                <Input id={`m-${name}`} name={name} defaultValue={fmt(value)} inputMode="decimal" placeholder="0,00" />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Situação do anúncio</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Situação do anúncio">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={availability === o.value}
                  onClick={() => setAvailability(o.value)}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-sm font-medium transition-colors',
                    availability === o.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="manual-update" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Salvar atualização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
