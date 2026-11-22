import { createServerSupabase } from '@/lib/supabase/server'

/** Bolinha com o número de notificações não lidas (some quando não há nenhuma). */
export async function UnreadCount() {
  const supabase = await createServerSupabase()
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  if (!count) return null
  return (
    <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> não lidas</span>
    </span>
  )
}
