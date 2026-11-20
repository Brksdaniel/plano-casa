// Empacota a extensão em apps/extension/dist (carregar em chrome://extensions → "Carregar sem compactação").
import { build } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = `${root}dist`
const keyFile = `${root}extension-key.pub.txt`
if (!existsSync(keyFile)) throw new Error('Rode antes: npm run make-key -w extension')

rmSync(dist, { recursive: true, force: true })
mkdirSync(`${dist}/icons`, { recursive: true })

await build({
  entryPoints: { background: `${root}src/background.ts`, content: `${root}src/content.ts`, popup: `${root}src/popup.ts` },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
})
copyFileSync(`${root}src/popup.html`, `${dist}/popup.html`)

// Ícones PNG simples (quadrado roxo com cantos arredondados), gerados sem dependências.
function png(size) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const r = size * 0.22
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = [0]
    for (let x = 0; x < size; x++) {
      const dx = Math.max(r - x - 0.5, 0, x + 0.5 - (size - r))
      const dy = Math.max(r - y - 0.5, 0, y + 0.5 - (size - r))
      const inside = dx * dx + dy * dy <= r * r
      // casinha branca simples no centro
      const cx = x / size
      const cy = y / size
      const roof = cy > 0.25 && cy < 0.5 && Math.abs(cx - 0.5) < (cy - 0.25) * 1.1
      const body = cy >= 0.48 && cy < 0.78 && cx > 0.3 && cx < 0.7
      const white = inside && (roof || body)
      row.push(...(white ? [255, 255, 255, 255] : inside ? [91, 79, 245, 255] : [0, 0, 0, 0]))
    }
    rows.push(Buffer.from(row))
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
for (const s of [16, 32, 48, 128]) writeFileSync(`${dist}/icons/icon-${s}.png`, png(s))

const SITE = ['https://web-two-pi-26.vercel.app/*', 'http://localhost:3000/*']
const LISTING_SITES = [
  'https://www.zapimoveis.com.br/*',
  'https://www.vivareal.com.br/*',
  'https://www.chavesnamao.com.br/*',
  'https://www.quintoandar.com.br/*',
  'https://*.olx.com.br/*',
  'https://www.imovelweb.com.br/*',
]
const icons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' }

const manifest = {
  manifest_version: 3,
  name: 'DENIELS HOME TRACKER',
  short_name: 'Deniels',
  version: JSON.parse(readFileSync(`${root}package.json`, 'utf8')).version,
  description: 'Atualiza no DENIELS HOME TRACKER os anúncios que você abre (somente leitura da página aberta).',
  key: readFileSync(keyFile, 'utf8').trim(),
  // Só armazenamento local. Rede apenas para o seu site e o Supabase (renovação do login).
  permissions: ['storage'],
  host_permissions: [...SITE, 'https://uruiexisyqteqnegmyag.supabase.co/*'],
  background: { service_worker: 'background.js' },
  content_scripts: [{ matches: LISTING_SITES, js: ['content.js'], run_at: 'document_idle' }],
  externally_connectable: { matches: SITE },
  action: { default_title: 'DENIELS HOME TRACKER', default_popup: 'popup.html', default_icon: icons },
  icons,
}
writeFileSync(`${dist}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log('Extensão gerada em', dist)
