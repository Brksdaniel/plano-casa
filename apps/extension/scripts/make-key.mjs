// Gera (uma única vez) a chave pública que fixa o ID da extensão.
// A chave PRIVADA não é guardada: só serviria para empacotar .crx, e não usamos isso.
import { createHash, generateKeyPairSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(new URL('../extension-key.pub.txt', import.meta.url))

if (!existsSync(file)) {
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  writeFileSync(file, Buffer.from(publicKey).toString('base64') + '\n')
  console.log('Chave pública criada em extension-key.pub.txt')
}

export function extensionIdFromKey(base64) {
  const hex = createHash('sha256').update(Buffer.from(base64.trim(), 'base64')).digest('hex').slice(0, 32)
  return [...hex].map((c) => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(c, 16))).join('')
}

console.log('ID da extensão:', extensionIdFromKey(readFileSync(file, 'utf8')))
