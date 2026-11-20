import { FIELD_KEYS, type FieldKey, parseBRL } from '@deniels/core'
import { z } from 'zod'

export type FieldOrigin = 'page' | 'url' | 'user'

const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

const text = (max: number) =>
  z.preprocess((v) => (empty(v) ? undefined : String(v).trim()), z.string().max(max, `Máximo de ${max} caracteres.`).optional())

const money = z.preprocess(
  (v) => (empty(v) ? undefined : (parseBRL(String(v)) ?? Number.NaN)),
  z.number({ error: 'Valor inválido. Use apenas números, ex.: 1.700,00' }).min(0).max(1_000_000).optional(),
)

const count = (label: string) =>
  z.preprocess(
    (v) => (empty(v) ? undefined : Number(String(v).trim())),
    z
      .number({ error: `${label} inválido.` })
      .int(`${label} inválido.`)
      .min(0, `${label} deve estar entre 0 e 20.`)
      .max(20, `${label} deve estar entre 0 e 20.`)
      .optional(),
  )

const origins = z.preprocess(
  (v) => {
    if (empty(v)) return {}
    try {
      const parsed = JSON.parse(String(v)) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([k, o]) => (FIELD_KEYS as string[]).includes(k) && (o === 'page' || o === 'url' || o === 'user'),
        ),
      )
    } catch {
      return {}
    }
  },
  z.record(z.string(), z.enum(['page', 'url', 'user'])),
)

export const newApartmentSchema = z.object({
  url: z.preprocess((v) => (empty(v) ? '' : String(v).trim()), z.string().min(1, 'Cole o link do anúncio.')),
  customName: text(120),
  neighborhood: text(120),
  city: text(120),
  notes: text(2000),
  rent: money,
  condoFee: money,
  iptu: money,
  bedrooms: count('Número de quartos'),
  bathrooms: count('Número de banheiros'),
  parking: count('Número de vagas'),
  areaM2: z.preprocess(
    (v) => (empty(v) ? undefined : Number(String(v).replace(',', '.'))),
    z.number({ error: 'Área inválida.' }).positive('Área inválida.').max(100_000).optional(),
  ),
  priority: z.preprocess((v) => (empty(v) ? 3 : Number(v)), z.number().int().min(1).max(5)),
  fieldOrigins: origins,
})

export type NewApartmentInput = Omit<z.infer<typeof newApartmentSchema>, 'fieldOrigins'> & {
  fieldOrigins: Partial<Record<FieldKey, FieldOrigin>>
}

export function parseNewApartmentForm(
  form: FormData,
): { success: true; data: NewApartmentInput } | { success: false; fieldErrors: Record<string, string> } {
  const result = newApartmentSchema.safeParse(Object.fromEntries(form.entries()))
  if (result.success) return { success: true, data: result.data as NewApartmentInput }

  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { success: false, fieldErrors }
}
