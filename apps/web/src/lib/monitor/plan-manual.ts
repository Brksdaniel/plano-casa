import { computeConfidence, detectChanges } from '@deniels/core'
import type { ApartmentStatus, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'

export type ManualAvailability = 'available' | 'rented' | 'unknown'

export type ManualPlan = {
  apartmentUpdate: TablesUpdate<'apartments'>
  snapshot: TablesInsert<'apartment_snapshots'>
  price: TablesInsert<'apartment_price_history'> | null
  statusRow: TablesInsert<'apartment_status_history'> | null
  changes: TablesInsert<'apartment_changes'>[]
}

const orUndef = <T,>(v: T | null) => (v === null ? undefined : v)

/** Atualização feita pelo usuário (sites bloqueados ou conferência manual). Campo vazio = mantém o valor atual. */
export function planManualUpdate(input: {
  apartment: Tables<'apartments'>
  rent?: number
  condoFee?: number
  iptu?: number
  availability: ManualAvailability
  now: Date
  runId: string
}): ManualPlan {
  const { apartment: apt, availability, now, runId } = input
  const nowIso = now.toISOString()

  const rent = input.rent ?? orUndef(apt.rent)
  const condoFee = input.condoFee ?? orUndef(apt.condo_fee)
  const iptu = input.iptu ?? orUndef(apt.iptu)

  const status: ApartmentStatus =
    availability === 'rented' ? 'possivelmente_alugado' : availability === 'available' ? 'ativo' : apt.status

  const drafts = detectChanges(
    { rent: orUndef(apt.rent), condoFee: orUndef(apt.condo_fee), iptu: orUndef(apt.iptu) },
    { rent, condoFee, iptu },
    apt.status,
    status,
  )

  const update: TablesUpdate<'apartments'> = {
    status,
    last_check_at: nowIso,
    last_success_at: nowIso,
    last_source: 'manual',
    consecutive_failures: 0,
    confidence: computeConfidence({
      rentMethod: rent !== undefined ? 'user' : undefined,
      ageHours: 0,
      complete: rent !== undefined && apt.bedrooms !== null && Boolean(apt.city),
    }),
  }
  if (input.rent !== undefined) update.rent = input.rent
  if (input.condoFee !== undefined) update.condo_fee = input.condoFee
  if (input.iptu !== undefined) update.iptu = input.iptu

  const valuesChanged = rent !== orUndef(apt.rent) || condoFee !== orUndef(apt.condo_fee) || iptu !== orUndef(apt.iptu)

  return {
    apartmentUpdate: update,
    snapshot: {
      user_id: apt.user_id,
      apartment_id: apt.id,
      checked_at: nowIso,
      source: 'manual',
      run_id: runId,
      page_kind: null,
      rent: rent ?? null,
      condo_fee: condoFee ?? null,
      iptu: iptu ?? null,
      availability: availability === 'rented' ? 'explicit_unavailable' : availability === 'available' ? 'active' : 'unknown',
      confidence: update.confidence ?? null,
    },
    price:
      rent !== undefined && valuesChanged
        ? { user_id: apt.user_id, apartment_id: apt.id, recorded_at: nowIso, rent, condo_fee: condoFee ?? null, iptu: iptu ?? null, source: 'manual' }
        : null,
    statusRow:
      status !== apt.status
        ? {
            user_id: apt.user_id,
            apartment_id: apt.id,
            changed_at: nowIso,
            from_status: apt.status,
            to_status: status,
            evidence: availability === 'rented' ? 'Informado por você: o anúncio parece alugado.' : 'Informado por você: anúncio disponível.',
            source: 'manual',
          }
        : null,
    changes: drafts.map((d) => ({
      user_id: apt.user_id,
      apartment_id: apt.id,
      detected_at: nowIso,
      kind: d.kind,
      old_value: d.oldValue,
      new_value: d.newValue,
      diff_abs: d.diffAbs,
      diff_pct: d.diffPct,
      dedupe_key: `manual:${runId}:${apt.id}:${d.kind}`,
    })),
  }
}
