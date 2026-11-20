import { parseBRL } from '../money'
import { type Extraction, setField } from './types'

// "Condomínio R$ 270,00" / "condomínio: R$ 1.050" — o valor precisa estar logo depois do rótulo.
const CONDO_RE = /condom[ií]nio[^\d\n]{0,25}?R\$\s*(\d[\d.]*(?:,\d{1,2})?)/i
const IPTU_RE = /\biptu[^\d\n]{0,25}?R\$\s*(\d[\d.]*(?:,\d{1,2})?)/i
const PARKING_RE = /\b(\d{1,2})\s*vagas?\b(?:\s+de\s+garage[mn])?/i

/** Campos que só aparecem no texto livre do anúncio (confiabilidade menor). */
export function fillFromText(e: Extraction, text: string | undefined) {
  if (!text) return
  if (e.fields.condoFee === undefined) setField(e, 'condoFee', parseBRL(CONDO_RE.exec(text)?.[1]), 'text')
  if (e.fields.iptu === undefined) setField(e, 'iptu', parseBRL(IPTU_RE.exec(text)?.[1]), 'text')
  if (e.fields.parking === undefined) {
    const n = PARKING_RE.exec(text)?.[1]
    if (n !== undefined) setField(e, 'parking', Number.parseInt(n, 10), 'text')
  }
}
