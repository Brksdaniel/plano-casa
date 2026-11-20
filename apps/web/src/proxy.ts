import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_AFTER_LOGIN, LOGIN_PATH, isPublicPath } from '@/lib/auth/paths'

/**
 * Renova a sessão do Supabase a cada requisição e protege as páginas internas.
 * Sem login → /login?next=<caminho>. Logado em /login → /dashboard.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  // Sem configuração, deixa passar: o layout mostra "Configuração incompleta".
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [h, v] of Object.entries(headers ?? {})) response.headers.set(h, v)
      },
    },
  })

  // Valida o JWT (não confia apenas no cookie). Token expirado/inválido → sem claims.
  const { data } = await supabase.auth.getClaims()
  const isLoggedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  if (pathname === '/') {
    return redirectTo(new URL(isLoggedIn ? DEFAULT_AFTER_LOGIN : LOGIN_PATH, request.url))
  }

  if (!isLoggedIn && !isPublicPath(pathname)) {
    const target = new URL(LOGIN_PATH, request.url)
    target.searchParams.set('next', pathname + search)
    return redirectTo(target)
  }

  if (isLoggedIn && (pathname === LOGIN_PATH || pathname === `${LOGIN_PATH}/`)) {
    return redirectTo(new URL(DEFAULT_AFTER_LOGIN, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
