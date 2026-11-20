export class MissingEnvError extends Error {
  readonly variable: string

  constructor(variable: string) {
    super(`Configuração incompleta: a variável de ambiente ${variable} não foi definida.`)
    this.name = 'MissingEnvError'
    this.variable = variable
  }
}

export type PublicEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
  siteUrl: string
}

/**
 * Variáveis públicas (vão para o navegador). Precisam ser lidas de forma literal
 * (process.env.NEXT_PUBLIC_X) para o Next.js conseguir embuti-las no build.
 */
export function getPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!supabaseUrl) throw new MissingEnvError('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabasePublishableKey) throw new MissingEnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')

  return { supabaseUrl, supabasePublishableKey, siteUrl: siteUrl || 'http://localhost:3000' }
}

export type EnvCheck = { ok: true; env: PublicEnv } | { ok: false; variable: string }

/** Versão que não lança: usada pelo layout para mostrar a tela "Configuração incompleta". */
export function checkPublicEnv(): EnvCheck {
  try {
    return { ok: true, env: getPublicEnv() }
  } catch (e) {
    if (e instanceof MissingEnvError) return { ok: false, variable: e.variable }
    throw e
  }
}
