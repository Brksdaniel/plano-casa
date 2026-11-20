import { NextResponse, type NextRequest } from 'next/server'
import { displayName } from '@/lib/apartments/meta'
import { userClientFromBearer } from '@/lib/extension/auth'

/** Lista dos anúncios acompanhados pelo usuário (para a extensão saber o que capturar). */
export async function GET(request: NextRequest) {
  const auth = await userClientFromBearer(request.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('apartments')
    .select('id, url_normalized, platform, external_listing_id, custom_name, source_title, bedrooms, city')
    .is('archived_at', null)
  if (error) return NextResponse.json({ error: 'Falha ao carregar' }, { status: 500 })

  return NextResponse.json({
    items: data.map((a) => ({
      id: a.id,
      normalized: a.url_normalized,
      platform: a.platform,
      externalId: a.external_listing_id,
      name: displayName(a),
    })),
  })
}
