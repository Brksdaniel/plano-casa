import { LogOut } from 'lucide-react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { createServerSupabase } from '@/lib/supabase/server'

/** Rodapé do menu com o e-mail do usuário e o botão Sair. Lê a sessão: use dentro de <Suspense>. */
export async function UserFooter() {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email
  if (!data?.claims?.sub) redirect(LOGIN_PATH)

  const initial = (typeof email === 'string' && email[0]?.toUpperCase()) || '?'

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Conectado como</p>
        <p className="truncate text-sm font-medium" title={typeof email === 'string' ? email : undefined}>
          {typeof email === 'string' ? email : 'Usuário'}
        </p>
      </div>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="ghost" size="icon" aria-label="Sair" title="Sair">
          <LogOut />
        </Button>
      </form>
    </div>
  )
}
