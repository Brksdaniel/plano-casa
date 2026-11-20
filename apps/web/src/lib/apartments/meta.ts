import { PLATFORM_LABEL, type Platform } from '@deniels/core'
import type { ApartmentStatus, ConfidenceLevel, DataSource, MonitorMode } from '@/lib/database.types'

export type Tone = 'green' | 'red' | 'yellow' | 'gray' | 'blue'

/** Cores do spec: verde/vermelho = variação de preço (Etapa 3), amarelo = verificar, cinza = indisponível. */
export const STATUS_META: Record<ApartmentStatus, { label: string; tone: Tone; hint: string }> = {
  ativo: { label: 'Ativo', tone: 'blue', hint: 'Anúncio aparentemente ativo na última verificação.' },
  possivelmente_alugado: { label: 'Possivelmente alugado', tone: 'gray', hint: 'O anúncio indicou que não está mais disponível.' },
  indisponivel: { label: 'Indisponível', tone: 'gray', hint: 'O anúncio informou indisponibilidade.' },
  removido: { label: 'Anúncio removido', tone: 'gray', hint: 'A página não existe mais em verificações seguidas.' },
  erro_acesso: { label: 'Erro de acesso', tone: 'yellow', hint: 'O site bloqueou ou não respondeu. Isso não significa que foi alugado.' },
  verificacao_necessaria: { label: 'Verificação necessária', tone: 'yellow', hint: 'Não há evidência suficiente. Confira o anúncio.' },
  nao_verificado: { label: 'Não verificado', tone: 'yellow', hint: 'Ainda não houve leitura automática deste anúncio.' },
}

export const MODE_META: Record<MonitorMode, { label: string; hint: string }> = {
  auto: { label: 'Servidor', hint: 'Verificado automaticamente pelo servidor.' },
  extension: { label: 'Extensão', hint: 'Atualizado pela extensão do Chrome quando você abre o anúncio.' },
  manual: { label: 'Manual', hint: 'Atualizado por você.' },
}

export const SOURCE_LABEL: Record<DataSource, string> = { server: 'servidor', extension: 'extensão', manual: 'manual' }

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

/** Nome exibido: o seu > título do anúncio > montado a partir dos dados reais (nunca inventado). */
export function displayName(a: {
  custom_name: string | null
  source_title: string | null
  platform?: string | null
  bedrooms?: number | null
  city?: string | null
}): string {
  if (a.custom_name) return a.custom_name
  if (a.source_title) return a.source_title
  const parts = [
    a.platform ? (PLATFORM_LABEL[a.platform as Platform] ?? null) : null,
    a.bedrooms != null ? `${a.bedrooms} ${a.bedrooms === 1 ? 'quarto' : 'quartos'}` : null,
    a.city ?? null,
  ].filter(Boolean)
  return parts.length >= 2 ? parts.join(' · ') : 'Imóvel sem nome'
}

export const TONE_CLASS: Record<Tone, string> = {
  green: 'border-success/30 bg-success/10 text-success',
  red: 'border-destructive/30 bg-destructive/10 text-destructive',
  yellow: 'border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning',
  gray: 'border-border bg-muted text-muted-foreground',
  blue: 'border-primary/25 bg-accent text-accent-foreground',
}
