export type Platform = 'quintoandar' | 'chavesnamao' | 'olx' | 'zap' | 'vivareal' | 'imovelweb' | 'generic'

export type ParsedListingUrl = {
  url: URL
  /** Forma estável para detectar duplicados: host sem www + caminho (+ query útil em sites genéricos). */
  normalized: string
  platform: Platform
  externalId?: string
}

/** Plataformas que o servidor pode buscar. As demais bloqueiam acesso automatizado (teste de 2026-11-20). */
export const SERVER_FETCH_ALLOWED: Record<Platform, boolean> = {
  quintoandar: true,
  chavesnamao: true,
  generic: true,
  olx: false,
  zap: false,
  vivareal: false,
  imovelweb: false,
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  quintoandar: 'QuintoAndar',
  chavesnamao: 'Chaves na Mão',
  olx: 'OLX',
  zap: 'ZAP Imóveis',
  vivareal: 'Viva Real',
  imovelweb: 'Imovelweb',
  generic: 'Outro site',
}
