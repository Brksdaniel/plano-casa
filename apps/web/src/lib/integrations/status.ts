export type IntegrationState = 'ok' | 'pending' | 'error'
export type IntegrationStatus = { state: IntegrationState; label: string; detail?: string }

/** Traduz o resultado de uma consulta de teste ao schema `tracker`. */
export function supabaseStatus(error: { code?: string; message?: string } | null): IntegrationStatus {
  if (!error) return { state: 'ok', label: 'Conectado' }
  if (error.code === 'PGRST106') {
    return {
      state: 'error',
      label: 'Ação necessária',
      detail: 'Adicione "tracker" em Supabase → Settings → Data API → Exposed schemas.',
    }
  }
  return { state: 'error', label: 'Erro', detail: error.message ?? 'Falha desconhecida ao acessar o banco.' }
}
