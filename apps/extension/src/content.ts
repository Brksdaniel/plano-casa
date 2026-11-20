import { extractFromPage, looksLikeChallenge, parseListingUrl } from '@deniels/core'
import type { PageMessage, PageReply } from './background'

/**
 * Roda nas páginas dos sites de imóveis. Só LÊ a página que o usuário já abriu:
 * não clica, não navega e não faz nada em páginas de desafio/CAPTCHA.
 */

let lastUrl = ''
let host: HTMLElement | null = null

function badge(html: string, tone: 'ok' | 'info' | 'warn', autoHideMs?: number) {
  host?.remove()
  host = document.createElement('div')
  host.setAttribute('data-deniels', '')
  const root = host.attachShadow({ mode: 'closed' })
  const colors = { ok: ['#0f9d58', '#e8f5ee'], info: ['#5b4ff5', '#efedff'], warn: ['#9a6700', '#fff5d6'] }[tone]
  root.innerHTML = `
    <style>
      .b{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;
         font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${colors[0]};background:${colors[1]};
         border:1px solid ${colors[0]}33;border-radius:999px;padding:8px 12px 8px 14px;box-shadow:0 6px 24px #0002;max-width:min(360px,calc(100vw - 32px))}
      a{color:inherit;font-weight:600;text-decoration:underline}
      button{all:unset;cursor:pointer;opacity:.6;padding:0 2px;font-size:15px}
      button:hover{opacity:1}
    </style>
    <div class="b" role="status"><span>${html}</span><button title="Fechar" aria-label="Fechar">×</button></div>`
  root.querySelector('button')?.addEventListener('click', () => host?.remove())
  document.documentElement.appendChild(host)
  if (autoHideMs) setTimeout(() => host?.remove(), autoHideMs)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

async function check() {
  const url = location.href
  if (url === lastUrl) return
  lastUrl = url
  host?.remove()

  const parsed = parseListingUrl(url)
  if (!parsed.ok || !parsed.value.externalId) return // não é página de anúncio

  const html = document.documentElement.outerHTML
  if (looksLikeChallenge(html, 200)) return // desafio anti-robô: não faz nada

  const extraction = extractFromPage(html, parsed.value, 200)
  if (extraction.pageKind !== 'listing') return

  const msg: PageMessage = { type: 'page', url, httpStatus: 200, extraction }
  let reply: PageReply
  try {
    reply = (await chrome.runtime.sendMessage(msg)) as PageReply
  } catch {
    return // extensão recarregada/atualizada: ignora silenciosamente
  }
  if (!reply || location.href !== url) return

  switch (reply.badge) {
    case 'synced': {
      const what =
        reply.result === 'too_soon'
          ? 'já atualizado há pouco'
          : reply.result === 'updated'
            ? `${reply.changes} ${reply.changes === 1 ? 'mudança' : 'mudanças'}`
            : 'sem mudanças'
      badge(`✓ Atualizado no Deniels · ${what} · <a href="${esc(reply.detailUrl)}" target="_blank" rel="noopener">ver</a>`, 'ok', 8000)
      break
    }
    case 'add':
      badge(`<a href="${esc(reply.addUrl)}" target="_blank" rel="noopener">+ Adicionar ao Deniels</a>`, 'info')
      break
    case 'connect':
      badge(`<a href="${esc(reply.siteUrl)}/configuracoes" target="_blank" rel="noopener">Conecte a extensão ao Deniels</a>`, 'warn')
      break
    case 'error':
      badge(`Não foi possível atualizar no Deniels: ${esc(reply.message)}`, 'warn', 12000)
      break
  }
}

// Carregamento inicial + navegação interna (sites como o ZAP trocam de página sem recarregar).
setTimeout(check, 1200)
setInterval(() => {
  if (location.href !== lastUrl) setTimeout(check, 1500)
}, 1000)
