import { DEFAULT_SITE } from './config'
import { chromeStore } from './lib/session'

async function render() {
  const store = chromeStore()
  const [session, reconnect] = await Promise.all([store.get(), store.needsReconnect()])
  const site = session?.siteUrl ?? DEFAULT_SITE
  const $ = (id: string) => document.getElementById(id) as HTMLElement

  ;($('primary') as HTMLAnchorElement).href = `${site}/dashboard`
  ;($('secondary') as HTMLAnchorElement).href = `${site}/configuracoes`

  if (session) {
    $('status').className = 'status ok'
    $('label').textContent = 'Conectada'
    $('detail').textContent = `Como ${session.email}. Abra um anúncio acompanhado (ZAP, Viva Real, OLX…) e ele é atualizado sozinho.`
  } else {
    $('status').className = 'status warn'
    $('label').textContent = reconnect ? 'Reconecte a extensão' : 'Não conectada'
    $('detail').textContent = reconnect
      ? 'A sessão expirou. No site, abra Configurações e clique em "Conectar extensão".'
      : 'No site, abra Configurações e clique em "Conectar extensão".'
    $('secondary').textContent = 'Conectar extensão'
  }
}

void render()
