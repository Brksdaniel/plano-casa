import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseListingUrl } from './url'

/** Só para testes: lê uma fixture de packages/core/test/fixtures. */
export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)), 'utf8')
}

export function parsed(url: string) {
  const r = parseListingUrl(url)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

export const CNM_APTO =
  'https://www.chavesnamao.com.br/imovel/apartamento-para-alugar-2-quartos-com-garagem-pr-sao-jose-dos-pinhais-afonso-pena-RS1700/id-48986848/'
export const CNM_CASA =
  'https://www.chavesnamao.com.br/imovel/casa-para-alugar-2-quartos-com-garagem-pr-sao-jose-dos-pinhais-campo-largo-da-roseira-126m2-RS1800/id-48948953/'
