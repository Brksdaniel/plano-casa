'use client'

import { Loader2, Send } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { savePreferencesAction, sendTestEmailAction } from './actions'

export type PrefsValues = {
  notifyEmail: string
  emailEnabled: boolean
  dailyDigestEnabled: boolean
  dailyDigestHour: number
  minChangeAbs: number
  minChangePct: number
}

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

export function PreferencesForm({ values, emailReady }: { values: PrefsValues; emailReady: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [testing, startTest] = useTransition()

  return (
    <form
      className="space-y-5 p-5"
      action={(fd) => {
        setError(null)
        startSave(async () => {
          const r = await savePreferencesAction(fd)
          if (!r.ok) setError(r.error)
          else toast.success(r.message)
        })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="p-email">E-mail para avisos</Label>
        <Input id="p-email" name="notifyEmail" type="email" defaultValue={values.notifyEmail} placeholder="voce@exemplo.com" maxLength={200} />
        {!emailReady && (
          <p className="text-xs text-muted-foreground">
            O envio de e-mails ainda não está ativo no servidor. Os avisos continuam aparecendo aqui no site.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle name="emailEnabled" label="Avisos por e-mail" hint="Queda/aumento de preço, indisponível, voltou a ficar disponível." defaultChecked={values.emailEnabled} />
        <Toggle name="dailyDigestEnabled" label="Resumo diário" hint="Números do dia, melhores oportunidades e anúncios para abrir." defaultChecked={values.dailyDigestEnabled} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-hour">Horário do resumo</Label>
          <select
            id="p-hour"
            name="dailyDigestHour"
            defaultValue={values.dailyDigestHour}
            className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-abs">Avisar a partir de (R$)</Label>
          <Input id="p-abs" name="minChangeAbs" inputMode="decimal" defaultValue={String(values.minChangeAbs).replace('.', ',')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-pct">ou a partir de (%)</Label>
          <Input id="p-pct" name="minChangePct" inputMode="decimal" defaultValue={String(values.minChangePct).replace('.', ',')} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Mudanças de preço menores que os dois limites ficam só na linha do tempo do imóvel, sem aviso. Falhas de acesso só avisam depois
        de 3 tentativas seguidas.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Salvar preferências
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={testing || !emailReady}
          onClick={() =>
            startTest(async () => {
              const r = await sendTestEmailAction()
              if (r.ok) toast.success(r.message)
              else toast.error(r.error)
            })
          }
        >
          {testing ? <Loader2 className="animate-spin" /> : <Send />} Enviar e-mail de teste
        </Button>
      </div>
    </form>
  )
}
