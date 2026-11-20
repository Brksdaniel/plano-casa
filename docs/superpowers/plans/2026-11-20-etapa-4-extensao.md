# Etapa 4 — Extensão do Chrome · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao abrir um anúncio acompanhado (ZAP, Viva Real, OLX, Imovelweb, Chaves na Mão, QuintoAndar) no Chrome, a extensão lê a página com o mesmo leitor do servidor e atualiza o imóvel no DENIELS HOME TRACKER (preço, status, fotos, histórico), marcando a origem "extensão"; anúncios não acompanhados ganham um atalho "Adicionar ao Deniels".

**Architecture:** `packages/core` ganha o leitor do ZAP/Viva Real. `apps/extension` (Manifest V3, TypeScript, empacotado com esbuild) tem content script (lê a página), service worker (sessão, lista de imóveis acompanhados, envio) e popup. O site expõe `/api/extension/tracked` e `/api/extension/capture` (autenticados com o token do usuário; RLS) e uma tela "Conectar extensão" que entrega a sessão via `externally_connectable`. O servidor aplica `planCheck` com `source: 'extension'`.

**Tech Stack:** Chrome MV3, TypeScript, esbuild, Vitest; demais como nas etapas anteriores.

**Spec:** `docs/superpowers/specs/2026-11-20-deniels-home-tracker-design.md` (§4 Extensão, §6, §7, §12.3)

## Global Constraints

- A extensão **não** abre abas, não navega, não clica e não interage com páginas de desafio/CAPTCHA. Página de desafio → nada é enviado.
- Permissões mínimas: `storage` + host permissions só dos 6 domínios de anúncios e do site (`https://web-two-pi-26.vercel.app/*`, `http://localhost:3000/*`). Sem `tabs`, sem `<all_urls>`, sem `scripting`.
- Nenhuma chave secreta na extensão (só URL do Supabase e chave publicável).
- O servidor aceita da extensão apenas a **extração** validada por zod (tamanhos limitados), nunca HTML bruto.
- Gravações da captura com o cliente do usuário (RLS); apenas o log usa o cliente admin.
- Textos em PT-BR.

## Review Focus

1. Token expirado na extensão → renova uma vez e reenvia; se a renovação falhar, mostra "Reconecte a extensão" no popup e não perde a captura silenciosamente. (Task 4)
2. Captura de um anúncio que não pertence ao usuário (ou URL forjada) → `/api/extension/capture` responde `untracked` sem gravar nada. (Task 2)
3. Payload enorme ou com campos de tipo errado → 400 sem gravar. (Task 2)
4. Página de desafio no ZAP com status 200 → content script não envia nada. (Task 4)
5. Mesmo anúncio aberto em duas abas ao mesmo tempo → no máximo uma captura a cada 10 min por imóvel. (Task 2)

---

### Task 1: Leitor do ZAP / Viva Real (core)

**Files:** Create `packages/core/src/extract/zap.ts`; Modify `packages/core/src/extract/index.ts`, `packages/core/src/index.ts`; Test `packages/core/src/extract/zap.test.ts`

**Interfaces — Produces:** `extractZap(html: string, parsed: ParsedListingUrl, status: number): Extraction` (registrado em `extractFromPage` para `zap` e `vivareal`).

Regras: `pageGuard` primeiro; nó JSON-LD `Product` → `offers.price` (rent, `jsonld`), `offers.availability` (`InStock` → active; `OutOfStock|SoldOut|Discontinued` → `explicit_unavailable` + evidência), `image[]`, `sku` → `externalId` se o link não trouxer; `name` "Imóvel em <Bairro>, <Cidade> - <UF>" → bairro/cidade (`jsonld`); `data-testid="condoFee"` → condomínio (`meta`); `data-testid="iptu"` → IPTU (`meta`, "Isento" = 0); `li[itemprop=floorSize|numberOfRooms|numberOfBathroomsTotal|numberOfParkingSpaces]` → área/quartos/banheiros/vagas (`meta`); descrição do `Product.description`. Sem `Product` → cai no genérico mantendo `platform`.

- [ ] **Step 1: testes** com `zap-apto.html`: `rent 1200` (`jsonld`), `condoFee 350` (`meta`), `iptu 0` (`meta`), `areaM2 39`, `bedrooms 2`, `bathrooms 1`, `parking 1`, `neighborhood 'Afonso Pena'`, `city 'São José dos Pinhais'`, `availability 'active'`, `pageKind 'listing'`, `images.length 3`, `externalId '2923596535'`; troca para `OutOfStock` → `explicit_unavailable`; `challenge-403.html` com status 200 → `challenge`, sem campos; `extractFromPage` com URL do ZAP usa este leitor; `computeConfidence` com `rentMethod 'jsonld'` e dados completos → `'alta'`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. Commit `feat(core): leitor do ZAP e Viva Real`.

### Task 2: API da extensão (site)

**Files:** Create `apps/web/src/lib/extension/auth.ts`, `apps/web/src/lib/extension/capture-schema.ts`, `apps/web/src/app/api/extension/tracked/route.ts`, `apps/web/src/app/api/extension/capture/route.ts`; Modify `apps/web/src/lib/monitor/plan-check.ts` (parâmetro `source`), `apps/web/src/lib/auth/paths.ts` (`/api/extension/` público — autenticado por Bearer na rota); Test `capture-schema.test.ts`, `plan-check.test.ts` (casos extensão), `paths.test.ts`

**Interfaces — Produces:**
- `planCheck({ ..., source: 'server' | 'extension' })` — `extension`: snapshot/preço/status com `source 'extension'`, `last_source 'extension'`, log `trigger 'extension'`, nunca altera `monitor_mode`.
- `userClientFromBearer(authorization: string | null): Promise<{ supabase: SupabaseClient<Database,'tracker'>; userId: string } | null>` — valida o JWT com `auth.getClaims(token)`.
- `captureSchema` (zod): `{ url: string (≤ 2048), httpStatus: number, extraction: { platform, externalId?, fields (números ≥ 0, textos ≤ 2000), images (≤ 40 URLs https ≤ 1000 chars), methods, availability, pageKind, evidence (≤ 5 × 300) } }`, total ≤ 200 KB.
- `GET /api/extension/tracked` → `{ items: { id, normalized, platform, externalId, name }[] }`.
- `POST /api/extension/capture` → `{ result: 'updated' | 'unchanged' | 'untracked' | 'too_soon' | 'blocked', changes: number, apartmentId?: string }`; 401 sem token válido; 400 payload inválido. Imóvel localizado por `url_normalized` ou `platform+external_listing_id` **do usuário**; espera mínima de 10 min entre capturas do mesmo imóvel (`refreshWaitMinutes`); gravações com o cliente do usuário; log via admin.

- [ ] **Step 1: testes** — `captureSchema`: extração válida (fixture ZAP) passa; `images` com 41 itens → falha; `fields.rent` negativo → falha; `url` `javascript:` → falha. `planCheck` com `source 'extension'` + leitura ZAP → `snapshot.source 'extension'`, `apartmentUpdate.last_source 'extension'`, `log.trigger 'extension'`, 3 bloqueios seguidos em modo extension → `monitor_mode` ausente do update. `isPublicPath('/api/extension/capture')` → true; `'/api/extensionx'` → false.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. Commit `feat(web): API da extensão`.

### Task 3: Conectar extensão (site) e pré-preenchimento por link

**Files:** Create `apps/web/src/app/(app)/configuracoes/extension-connect.tsx`, `apps/web/src/lib/extension/bridge.ts`; Modify `configuracoes/page.tsx`, `apartamentos/novo/new-apartment-flow.tsx` + `novo/page.tsx` (aceita `?url=` e já dispara a leitura), `.env.example` (`NEXT_PUBLIC_EXTENSION_ID`); Test `bridge.test.ts`

**Interfaces — Produces:** `type BridgeMessage = { type: 'connect'; session: { accessToken: string; refreshToken: string; expiresAt: number; email: string }; siteUrl: string; supabaseUrl: string; publishableKey: string } | { type: 'disconnect' } | { type: 'status' }`; `sendToExtension(extensionId: string, msg: BridgeMessage): Promise<{ ok: boolean; connected?: boolean; email?: string; error?: string }>` (timeout 3 s; sem `chrome.runtime` → `{ ok: false, error: 'not_installed' }`).

UI em Configurações → cartão "Extensão do Chrome": detecta instalação (`status`), mostra "Não instalada" com passo a passo de instalação, "Instalada, não conectada" + botão **Conectar extensão**, ou "Conectada como <email>" + **Desconectar**. Sem `NEXT_PUBLIC_EXTENSION_ID` → "Não configurado".

- [ ] **Step 1: testes** `sendToExtension` com `chrome` ausente → `not_installed`; com `chrome.runtime.sendMessage` falso que responde → repassa; que nunca responde → `timeout`.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit `feat(web): conectar extensão e adicionar por link`.

### Task 4: Extensão MV3

**Files:** Create `apps/extension/package.json`, `tsconfig.json`, `build.mjs`, `scripts/make-key.mjs`, `public/manifest.json` (gerado no build com a `key`), `public/icons/*`, `src/background.ts`, `src/content.ts`, `src/popup.html`, `src/popup.ts`, `src/lib/session.ts`, `src/lib/api.ts`, `src/lib/tracked.ts`, `src/lib/badge.ts`, `src/lib/messages.ts`; Tests `src/lib/*.test.ts`

**Interfaces — Produces:**
- `session.ts`: `type StoredSession = { accessToken; refreshToken; expiresAt; email; siteUrl; supabaseUrl; publishableKey }`; `needsRefresh(s: StoredSession, now: number): boolean` (expira em < 60 s); `refreshSession(s, fetchImpl): Promise<StoredSession>` (POST `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, header `apikey`).
- `api.ts`: `withAuth(fn)` — renova se preciso; em 401 renova uma vez e repete; falha de renovação → limpa sessão e marca `needsReconnect`.
- `tracked.ts`: cache da lista (`GET /api/extension/tracked`) por 30 min; `matchTracked(parsed: ParsedListingUrl, items): TrackedItem | null` (por `normalized` ou `platform+externalId`).
- `badge.ts`: `decideBadge(input: { isListing: boolean; challenge: boolean; tracked: boolean; connected: boolean }): 'none' | 'add' | 'syncing' | 'connect'`.
- `messages.ts`: validação das mensagens externas — só aceita `connect/disconnect/status` vindas de `sender.origin` igual ao site configurado ou `http://localhost:3000`.
- `content.ts`: roda em `document_idle` nas páginas `*/imovel/*` (zap/vivareal/chavesnamao/quintoandar), `*.olx.com.br/*`, `imovelweb.com.br/propriedades/*`; observa mudança de URL (SPA); `parseListingUrl` → `looksLikeChallenge(document.documentElement.outerHTML, 200)` → `extractFromPage(...)`; pede ao background para enviar; mostra selo flutuante discreto (Shadow DOM) "Atualizado no Deniels ✓ · há instantes" / "Adicionar ao Deniels" / "Conecte a extensão".
- Manifesto: MV3, `name "DENIELS HOME TRACKER"`, `permissions ["storage"]`, `host_permissions` (6 domínios + site + localhost), `externally_connectable.matches` (site + localhost), `background.service_worker`, `content_scripts`, `action.default_popup`, `key`.
- `scripts/make-key.mjs`: gera par RSA 2048 uma vez, grava **só a chave pública** em `apps/extension/extension-key.pub.txt` e imprime o ID da extensão (base16 a–p do SHA-256 da chave pública DER).

- [ ] **Step 1: testes** `needsRefresh` (expira em 30 s → true; em 10 min → false); `refreshSession` com fetch falso (sucesso → tokens novos; 400 → erro); `withAuth` (401 → renova e repete uma vez; renovação falha → `needsReconnect`); `matchTracked` (ZAP com `?source=` diferente casa por normalized; por externalId); `decideBadge` (desafio → none; não conectado → connect; não acompanhado → add; acompanhado → syncing); `validateExternalMessage` (origem estranha → rejeita).
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. `npm run build -w extension` gera `apps/extension/dist` com manifest válido. Commit `feat(extension): extensão do Chrome`.

### Task 5: Publicação e teste real (com o usuário)

- [ ] **Step 1:** `NEXT_PUBLIC_EXTENSION_ID` no `.env.local` e na Vercel (pública); merge na `main` com autorização; redeploy.
- [ ] **Step 2 (usuário):** `chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação → `apps/extension/dist`; conferir que o ID mostrado = `NEXT_PUBLIC_EXTENSION_ID`.
- [ ] **Step 3 (usuário):** site → Configurações → **Conectar extensão** → "Conectada como …".
- [ ] **Step 4 (usuário):** abrir os anúncios do ZAP acompanhados → selo "Atualizado no Deniels ✓"; no site, card com origem "extensão", preço/condomínio/IPTU reais, confiabilidade Alta, e o aluguel de teste do Santa Cândida corrigido automaticamente (mudança registrada).
- [ ] **Step 5:** abrir um anúncio do ZAP não acompanhado → "Adicionar ao Deniels" abre o formulário já lido.
- [ ] **Step 6:** banco: snapshots `source='extension'`, `monitoring_logs.trigger='extension'`, sem dedupe repetida; `rls_check` 12/12; lint/typecheck/testes/build verdes.
