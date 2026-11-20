import { NextResponse, type NextRequest } from 'next/server'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL(LOGIN_PATH, request.url), { status: 303 })
}
