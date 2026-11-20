export const LOGIN_PATH = '/login'
export const DEFAULT_AFTER_LOGIN = '/dashboard'

const PUBLIC_EXACT = new Set([LOGIN_PATH, `${LOGIN_PATH}/`, '/favicon.ico', '/robots.txt'])
const PUBLIC_PREFIXES = ['/_next/']

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
