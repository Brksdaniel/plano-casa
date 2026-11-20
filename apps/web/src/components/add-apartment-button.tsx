import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function AddApartmentButton() {
  return (
    <Button asChild className="shadow-sm shadow-primary/25">
      <Link href="/apartamentos/novo">
        <Plus />
        Adicionar apartamento
      </Link>
    </Button>
  )
}
