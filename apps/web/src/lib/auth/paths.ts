export const LOGIN_PATH = '/login'
export const DEFAULT_AFTER_LOGIN = '/dashboard'

// /api/cron/monitor não usa sessão: é protegido pelo CRON_SECRET dentro da própria rota.
const PUBLIC_EXACT = new Set([LOGIN_PATH, `${LOGIN_PATH}/`, '/favicon.ico', '/robots.txt', '/api/cron/monitor'])
// /api/extension/* autentica pelo token Bearer do usuário dentro da rota.
const PUBLIC_PREFIXES = ['/_next/', '/api/extension/']

/** Rotas acessíveis sem login. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

/** Destino pós-login seguro: só caminhos internos (evita redirecionamento para outro site). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return DEFAULT_AFTER_LOGIN
  }
  const pathname = next.split(/[?#]/)[0] ?? ''
  if (pathname === LOGIN_PATH || pathname === `${LOGIN_PATH}/`) return DEFAULT_AFTER_LOGIN
  return next
}
