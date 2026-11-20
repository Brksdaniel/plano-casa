export function ConfigError({ variable }: { variable: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Configuração incompleta</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">O site ainda não está configurado</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Falta a variável de ambiente{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{variable}</code>.
          Preencha-a no arquivo <code className="font-mono">.env.local</code> (local) ou nas
          configurações do projeto na Vercel e reinicie o site.
        </p>
      </div>
    </main>
  )
}
