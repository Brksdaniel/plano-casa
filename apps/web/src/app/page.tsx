import { redirect } from 'next/navigation'
import { DEFAULT_AFTER_LOGIN } from '@/lib/auth/paths'

// O proxy já redireciona "/"; isto é só uma garantia.
export default function Home() {
  redirect(DEFAULT_AFTER_LOGIN)
}
