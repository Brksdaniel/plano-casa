import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Botão principal. Desabilitado até a Etapa 2 (cadastro) ficar pronta. */
export function AddApartmentButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Button disabled className="shadow-sm shadow-primary/25">
            <Plus />
            Adicionar apartamento
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Disponível na Etapa 2 (cadastro de links)</TooltipContent>
    </Tooltip>
  )
}
