'use server'

import { type Extraction, PLATFORM_LABEL, type Platform } from '@deniels/core'
import { redirect } from 'next/navigation'
import { type FetchOutcome, buildApartmentInsert } from '@/lib/apartments/build-insert'
import { type DuplicateInfo, findDuplicate } from '@/lib/apartments/queries'
import { readListing } from '@/lib/apartments/read-listing'
import { parseNewApartmentForm } from '@/lib/apartments/schema'
import { LOGIN_PATH } from '@/lib/auth/paths'
import { createServerSupabase } from '@/lib/supabase/server'

export type ReadResult =
  | {
      ok: true
      url: string
      platform: Platform
      platformLabel: string
      externalId?: string
      extraction: Extraction
      fetch: FetchOutcome
      duplicate: DuplicateInfo | null
    }
  | { ok: false; error: string }

async function requireUser() {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect(LOGIN_PATH)
  return { supabase, userId }
}

/** Passo 1: lê o anúncio e devolve o que foi possível extrair (nada é gravado). */
export async function readListingAction(_prev: ReadResult | null, form: FormData): Promise<ReadResult> {
  const { supabase } = await requireUser()
  const read = await readListing(String(form.get('url') ?? ''))
  if (!read.ok) return read

  return {
    ok: true,
    url: read.parsed.url.toString(),
    platform: read.parsed.platform,
    platformLabel: PLATFORM_LABEL[read.parsed.platform],
    ...(read.parsed.externalId ? { externalId: read.parsed.externalId } : {}),
    extraction: read.extraction,
    fetch: read.fetch,
    duplicate: await findDuplicate(supabase, read.parsed),
  }
}

export type CreateState = { error?: string; fieldErrors?: Record<string, string>; duplicateId?: string }

/**
 * Passo 2: grava o imóvel. O servidor lê o anúncio de novo (não confia em dados vindos
 * do navegador para dizer o que foi "lido do anúncio").
 */
export async function createApartmentAction(_prev: CreateState, form: FormData): Promise<CreateState> {
  const parsedForm = parseNewApartmentForm(form)
  if (!parsedForm.success) return { error: 'Confira os campos destacados.', fieldErrors: parsedForm.fieldErrors }
  const input = parsedForm.data

  const { supabase, userId } = await requireUser()
  const read = await readListing(input.url)
  if (!read.ok) return { error: read.error, fieldErrors: { url: read.error } }

  const duplicate = await findDuplicate(supabase, read.parsed)
  if (duplicate) return { error: 'Você já acompanha este anúncio.', duplicateId: duplicate.id }

  const plan = buildApartmentInsert(input, {
    userId,
    parsed: read.parsed,
    extraction: read.extraction,
    fetch: read.fetch,
    httpStatus: read.httpStatus,
    now: new Date(),
  })

  const { data: created, error } = await supabase.from('apartments').insert(plan.apartment).select('id').single()
  if (error || !created) {
    if (error?.code === '23505') {
      const again = await findDuplicate(supabase, read.parsed)
      return { error: 'Você já acompanha este anúncio.', ...(again ? { duplicateId: again.id } : {}) }
    }
    console.error('[cadastro] falha ao gravar imóvel', error)
    return { error: 'Não foi possível salvar agora. Tente novamente.' }
  }

  const apartmentId = created.id
  const children = await Promise.all([
    supabase.from('apartment_status_history').insert({ ...plan.status, apartment_id: apartmentId }),
    plan.snapshot ? supabase.from('apartment_snapshots').insert({ ...plan.snapshot, apartment_id: apartmentId }) : null,
    plan.price ? supabase.from('apartment_price_history').insert({ ...plan.price, apartment_id: apartmentId }) : null,
  ])
  const childError = children.find((r) => r?.error)?.error
  if (childError) {
    // Desfaz o cadastro para não deixar um imóvel sem histórico (as filhas caem em cascata).
    await supabase.from('apartments').delete().eq('id', apartmentId)
    console.error('[cadastro] falha ao gravar histórico', childError)
    return { error: 'Não foi possível salvar o histórico do imóvel. Nada foi gravado; tente novamente.' }
  }

  redirect(`/apartamentos?novo=${apartmentId}`)
}
