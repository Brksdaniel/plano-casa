'use client'

import { Loader2, Settings2, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { updateDetailsAction } from './actions'

export function EditDetailsDialog({
  id,
  customName,
  priority,
  notes,
}: {
  id: string
  customName: string | null
  priority: number
  notes: string | null
}) {
  const [open, setOpen] = useState(false)
  const [prio, setPrio] = useState(priority)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2 /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar imóvel</DialogTitle>
          <DialogDescription>Nome, prioridade e suas observações. Os valores do anúncio não mudam aqui.</DialogDescription>
        </DialogHeader>
        <form
          id="edit-details"
          className="space-y-4"
          action={(fd) => {
            setError(null)
            fd.set('priority', String(prio))
            startTransition(async () => {
              const r = await updateDetailsAction(id, fd)
              if (!r.ok) {
                setError(r.error)
                return
              }
              toast.success(r.message)
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nome personalizado</Label>
            <Input id="e-name" name="customName" defaultValue={customName ?? ''} maxLength={120} placeholder="Ex.: Ape perto do trabalho" />
          </div>
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <div className="flex gap-1" role="radiogroup" aria-label="Prioridade de 1 a 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={prio === n}
                  aria-label={`Prioridade ${n}`}
                  onClick={() => setPrio(n)}
                  className="rounded-md p-1 transition-transform hover:scale-110"
                >
                  <Star className={cn('size-6', n <= prio ? 'fill-warning text-warning' : 'text-muted-foreground')} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-notes">Observações</Label>
            <Textarea id="e-notes" name="notes" defaultValue={notes ?? ''} maxLength={5000} rows={5} placeholder="Visitei dia 10, vizinhança tranquila…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="edit-details" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
