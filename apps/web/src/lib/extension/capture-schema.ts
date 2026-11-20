import type { Extraction } from '@deniels/core'
import { z } from 'zod'

const httpUrl = z
  .string()
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v), 'Link inválido')
const httpsUrl = z
  .string()
  .max(1000)
  .refine((v) => /^https:\/\//i.test(v), 'Imagem inválida')

const num = z.number().finite().min(0).max(1_000_000)
const text = z.string().max(2000)
const method = z.enum(['jsonld', 'meta', 'text', 'slug'])

const fields = z
  .object({
    title: text,
    rent: num,
    condoFee: num,
    iptu: num,
    bedrooms: num,
    bathrooms: num,
    parking: num,
    areaM2: num,
    neighborhood: text,
    city: text,
    mainImageUrl: httpsUrl,
    description: z.string().max(10_000),
  })
  .partial()
  .strict()

const extraction = z
  .object({
    platform: z.enum(['quintoandar', 'chavesnamao', 'olx', 'zap', 'vivareal', 'imovelweb', 'generic']),
    externalId: z.string().max(40).optional(),
    fields,
    images: z.array(httpsUrl).max(40),
    methods: z.record(z.string(), method),
    availability: z.enum(['active', 'explicit_unavailable', 'unknown']),
    pageKind: z.enum(['listing', 'challenge', 'not_found', 'other']),
    evidence: z.array(z.string().max(300)).max(5),
  })
  .strict()

export const captureSchema = z.object({
  url: httpUrl,
  httpStatus: z.number().int().min(100).max(599),
  extraction,
})

export type CapturePayload = { url: string; httpStatus: number; extraction: Extraction }

export const MAX_CAPTURE_BYTES = 200_000

export function parseCapture(input: unknown): { success: true; data: CapturePayload } | { success: false; error: string } {
  const r = captureSchema.safeParse(input)
  if (!r.success) return { success: false, error: r.error.issues[0]?.message ?? 'Dados inválidos' }
  return { success: true, data: r.data as CapturePayload }
}
