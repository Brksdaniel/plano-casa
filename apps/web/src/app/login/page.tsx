import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Brand } from '@/components/brand'
import { Skeleton } from '@/components/ui/skeleton'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar' }

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/40 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <Brand className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-7 shadow-xl shadow-black/5">
          <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Acompanhe os apartamentos que você monitora.</p>
          <Suspense fallback={<Skeleton className="h-60 w-full" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Acesso privado · uso pessoal</p>
      </div>
    </main>
  )
}
