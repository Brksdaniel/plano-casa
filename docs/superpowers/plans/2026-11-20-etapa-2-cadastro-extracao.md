# Etapa 2 — Cadastro + Extração · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colar um link → o sistema identifica a plataforma, bloqueia duplicados, pré-preenche o que conseguir (página ou link) mostrando a origem de cada campo → salvar → o imóvel aparece num card com modo, status e confiabilidade.

**Architecture:** Toda leitura de link/HTML fica em `packages/core` (TS puro, sem DOM, reutilizável pela extensão na Etapa 4). O app web só busca o HTML com proteção SSRF (apenas plataformas com `serverFetchAllowed`), chama o core e grava via Server Actions com o cliente do usuário (RLS).

**Tech Stack:** igual à Etapa 1 + `zod`. Componentes shadcn novos: `textarea select dialog alert-dialog`.

**Spec:** `docs/superpowers/specs/2026-11-20-deniels-home-tracker-design.md` (seções 4, 5, 6, 7, 10, 11, 12.1)

## Global Constraints

- Nunca inventar dado: campo não lido fica vazio; nada é "deduzido" fora das regras deste plano.
- Nunca buscar páginas de plataformas com `serverFetchAllowed = false` (OLX, ZAP, Viva Real, Imovelweb). Sem contornar bloqueios.
- Erro de acesso/desafio nunca vira "alugado"/"indisponível".
- Textos em PT-BR; valores em R$ formatados `pt-BR`.
- Schema `tracker`; gravações com o cliente do usuário (RLS), sem service role nesta etapa.
- Fixtures de teste contêm só os blocos JSON-LD/meta necessários (não a página inteira).

## Review Focus

1. Mesmo anúncio colado com `?source=…`, `utm_*`, `www.` ou barra final diferente → reconhecido como duplicado. (Task 1)
2. URL hostil (`http://127.0.0.1`, `http://169.254.169.254`, `file://`, host que resolve para IP privado, redirect para IP privado) → recusada sem buscar. (Task 4)
3. Página de desafio/403/timeout numa plataforma "permitida" → salva como `nao_verificado`/`erro_acesso`, nunca como indisponível; formulário continua utilizável. (Tasks 2, 5)
4. Valores brasileiros (`R$ 1.700,50`, `1.700`, `1700`) → 1700.5 / 1700 / 1700; texto sem número → vazio. (Task 2)
5. Corrida: dois envios do mesmo link (duplo clique) → um registro só, segundo recebe mensagem amigável (violação `23505`). (Task 5)

---

### Task 1: URL — normalização, plataforma e ID externo

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/url.ts`
- Modify: `packages/core/src/index.ts` (reexporta tudo)
- Test: `packages/core/src/url.test.ts`

**Interfaces:**
- Produces:
  - `type Platform = 'quintoandar' | 'chavesnamao' | 'olx' | 'zap' | 'vivareal' | 'imovelweb' | 'generic'`
  - `type ParsedListingUrl = { url: URL; normalized: string; platform: Platform; externalId?: string }`
  - `parseListingUrl(input: string): { ok: true; value: ParsedListingUrl } | { ok: false; error: string }`
  - `SERVER_FETCH_ALLOWED: Record<Platform, boolean>` = quintoandar ✓, chavesnamao ✓, generic ✓, demais ✗
  - `PLATFORM_LABEL: Record<Platform, string>` (ex.: `zap` → "ZAP Imóveis")

Regras: aceita só `http(s)`; trim; host minúsculo sem `www.`; `normalized = host + pathname` sem barra final; para `generic` mantém a query sem parâmetros `utm_*`, `source`, `fbclid`, `gclid` (ordenada). Plataforma por domínio (`zapimoveis.com.br`, `vivareal.com.br`, `chavesnamao.com.br`, `quintoandar.com.br`, `olx.com.br` e subdomínios regionais `*.olx.com.br`, `imovelweb.com.br`). ID externo: zap/vivareal/chavesnamao `-id-(\d+)` ou `/id-(\d+)`; quintoandar `/imovel/(\d+)`; olx último `-(\d+)$` do caminho; imovelweb `-(\d+)\.html$`.

- [ ] **Step 1: testes** — `parseListingUrl`:
  - `'https://www.zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438/?source=ranking%2Crp'` → platform `zap`, externalId `'2923224438'`, normalized `'zapimoveis.com.br/imovel/aluguel-apartamento-2-quartos-mobiliado-santa-candida-curitiba-pr-47m2-id-2923224438'`
  - mesmo link sem `www`, sem query e sem barra final → mesmo `normalized`
  - `'https://www.chavesnamao.com.br/imovel/apartamento-para-alugar-2-quartos-com-garagem-pr-sao-jose-dos-pinhais-afonso-pena-RS1700/id-48986848/'` → `chavesnamao`, `'48986848'`
  - `'https://exemplo.com/anuncio?id=5&utm_source=x'` → `generic`, normalized `'exemplo.com/anuncio?id=5'`
  - `'ftp://x.com'`, `'javascript:alert(1)'`, `'não é link'`, `''` → `ok:false` com `error` em PT-BR
  - `'  https://pr.olx.com.br/regiao-de-curitiba/imoveis/apto-2-quartos-1234567890  '` → `olx`, `'1234567890'`
- [ ] **Step 2:** `npm test -w @deniels/core` → FAIL. **Step 3:** implementar. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(core): normalização de links e detecção de plataforma`.

### Task 2: Leitura de HTML, valores em reais e adaptador Chaves na Mão + genérico

**Files:**
- Create: `packages/core/src/html.ts`, `packages/core/src/money.ts`, `packages/core/src/extract/types.ts`, `packages/core/src/extract/chavesnamao.ts`, `packages/core/src/extract/generic.ts`
- Create fixtures: `packages/core/test/fixtures/chavesnamao-apto.html`, `chavesnamao-casa.html` (gerados a partir dos 2 links reais: só `<title>`, `<meta og:*>` e os `<script type="application/ld+json">`), `challenge-403.html` (página de desafio mínima), `generic-og-only.html` (só og:title/og:image/og:description)
- Test: `packages/core/src/html.test.ts`, `money.test.ts`, `extract/chavesnamao.test.ts`, `extract/generic.test.ts`

**Interfaces:**
- Consumes: `ParsedListingUrl` (Task 1)
- Produces:
  - `readJsonLd(html: string): Record<string, unknown>[]` (achata `@graph`, ignora JSON inválido)
  - `readMeta(html: string): Record<string, string>` (chaves `og:*`, `description`, `title`)
  - `looksLikeChallenge(html: string, status?: number): boolean` (403/429/503 ou marcadores `cf-chl`, `challenge-platform`, `captcha`, `Just a moment`)
  - `parseBRL(text: string | number | undefined): number | undefined`
  - `type FieldKey = 'title'|'rent'|'condoFee'|'iptu'|'bedrooms'|'bathrooms'|'parking'|'areaM2'|'neighborhood'|'city'|'mainImageUrl'|'description'`
  - `type FieldMethod = 'jsonld' | 'meta' | 'text' | 'slug'`
  - `type Extraction = { platform: Platform; externalId?: string; fields: Partial<Record<FieldKey, string | number>>; images: string[]; methods: Partial<Record<FieldKey, FieldMethod>>; availability: 'active' | 'explicit_unavailable' | 'unknown'; pageKind: 'listing' | 'challenge' | 'not_found' | 'other'; evidence: string[] }`
  - `extractChavesNaMao(html: string, parsed: ParsedListingUrl, status: number): Extraction`
  - `extractGeneric(html: string, parsed: ParsedListingUrl, status: number): Extraction`

Regras Chaves na Mão: nó `RealEstateListing` → `offers.price` (rent, `jsonld`); `offers.availability` termina em `InStock` → `active`, em `OutOfStock|SoldOut|Discontinued` → `explicit_unavailable` + evidence; `itemOffered.numberOfBedrooms|numberOfBathroomsTotal|floorSize.value`; `addressLocality` "Bairro, Cidade" → neighborhood + city; `about.image[]` → images, primeira → mainImageUrl; `name` → title. Condomínio/IPTU por regex na descrição (`/condom[ií]nio[^R\d]{0,20}R?\$?\s*([\d.,]+)/i`, idem `iptu`) → método `text`. Vagas: `(\d+)\s*vagas?\s+de\s+garagem` ou `(\d+)\s*garage[mn]s?` no texto → `text`. Status 404/410 → `pageKind 'not_found'`; desafio → `'challenge'` e nenhum campo.
Genérico: JSON-LD `Offer.price`/`Product` + `og:title`, `og:image`, `og:description`; nunca marca `explicit_unavailable` (só `unknown`/`active` se houver Offer InStock).

- [ ] **Step 1: testes** —
  - `parseBRL`: `'R$ 1.700,50'`→1700.5; `'1.700'`→1700; `1700`→1700; `'R$ 270,00'`→270; `'abc'`→undefined; `''`→undefined
  - `readJsonLd(fixture apto)` contém nó com `@type 'RealEstateListing'`; JSON quebrado → ignorado sem lançar
  - `looksLikeChallenge(fixture challenge, 403)` → true; `(fixture apto, 200)` → false
  - `extractChavesNaMao(apto, parsed, 200)`: `rent 1700` (jsonld), `bedrooms 2`, `bathrooms 1`, `areaM2 44`, `neighborhood 'Afonso Pena'`, `city 'São José dos Pinhais'`, `condoFee 270` (text), `availability 'active'`, `pageKind 'listing'`, `images.length ≥ 5`, `externalId '48986848'`
  - `extractChavesNaMao(casa, …)`: `rent 1800`, `areaM2 48`, `neighborhood 'Campo Largo da Roseira'`
  - `extractChavesNaMao(challenge, …, 403)` → `pageKind 'challenge'`, `fields` vazio, `availability 'unknown'`
  - `extractChavesNaMao('', …, 404)` → `pageKind 'not_found'`, `availability 'unknown'` (nunca `explicit_unavailable`)
  - `extractGeneric(og-only)` → `title` e `mainImageUrl` por `meta`; `rent` ausente
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(core): leitura de HTML e adaptadores Chaves na Mão e genérico`.

### Task 3: Leitura pelo link (ZAP/Viva Real), registro de adaptadores e confiabilidade

**Files:**
- Create: `packages/core/src/extract/slug.ts`, `packages/core/src/extract/index.ts`, `packages/core/src/confidence.ts`
- Test: `extract/slug.test.ts`, `extract/index.test.ts`, `confidence.test.ts`

**Interfaces:**
- Produces:
  - `KNOWN_CITIES: { slug: string; name: string; uf: string }[]` = `curitiba`→"Curitiba", `sao-jose-dos-pinhais`→"São José dos Pinhais" (PR)
  - `extractFromSlug(parsed: ParsedListingUrl): Extraction` — `(\d+)-quartos?` → bedrooms, `(\d+)m2` → areaM2, cidade conhecida imediatamente antes de `-pr` → city; bairro nunca; método `slug`; `pageKind 'other'`, `availability 'unknown'`
  - `extractFromUrlOnly(parsed): Extraction` (slug para zap/vivareal/olx/imovelweb; vazio para os demais)
  - `extractFromPage(html: string, parsed, status: number): Extraction` (escolhe chavesnamao ou genérico; quintoandar usa genérico nesta etapa) e mescla com `extractFromUrlOnly` só nos campos que a página não trouxe
  - `computeConfidence(input: { rentMethod?: FieldMethod | 'user'; ageHours: number; complete: boolean }): 'alta' | 'media' | 'baixa' | null` — sem rent → null; `jsonld` e ≤36h e complete → alta; `jsonld` ≤ 7d ou `meta|text` ≤ 7d → media; `user`/`slug` ou > 7d ou incompleto → baixa

- [ ] **Step 1: testes** —
  - slug do 1º link ZAP → `bedrooms 2`, `areaM2 47`, `city 'Curitiba'`, sem `neighborhood`
  - slug `…-ina-sao-jose-dos-pinhais-pr-46m2-id-2923256795` → `city 'São José dos Pinhais'`, `areaM2 46`
  - slug sem cidade conhecida (`…-ponta-grossa-pr-50m2-id-1`) → sem `city`
  - `extractFromPage(chavesnamao apto)` com página trazendo `bedrooms` não sobrescreve por slug
  - `computeConfidence`: `{rentMethod:'jsonld', ageHours:2, complete:true}`→`'alta'`; `{'jsonld', 48, true}`→`'media'`; `{'text', 2, true}`→`'media'`; `{'user', 1, true}`→`'baixa'`; `{'jsonld', 200, true}`→`'baixa'`; `{'jsonld', 2, false}`→`'baixa'`; sem rentMethod→`null`
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS (core inteiro).
- [ ] **Step 5:** Commit `feat(core): leitura pelo link, registro de adaptadores e confiabilidade`.

### Task 4: Busca segura de páginas (SSRF)

**Files:**
- Create: `apps/web/src/lib/net/safe-fetch.ts`
- Test: `apps/web/src/lib/net/safe-fetch.test.ts`

**Interfaces:**
- Produces:
  - `isPrivateAddress(ip: string): boolean` (IPv4: 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/4+; IPv6: ::1, fc00::/7, fe80::/10, ::ffff:mapeado-privado)
  - `safeFetchHtml(url: string, opts?: { timeoutMs?: number; maxBytes?: number; lookup?: (host: string) => Promise<string[]>; fetchImpl?: typeof fetch }): Promise<{ ok: true; status: number; html: string; finalUrl: string } | { ok: false; reason: 'invalid_url' | 'blocked_address' | 'timeout' | 'too_large' | 'network' }>`
  - Padrões: timeout 15 s, máx. 3 MB, `redirect: 'manual'` seguindo até 3 redirects (cada destino revalidado), só `http(s)`, cabeçalhos `Accept-Language: pt-BR`, User-Agent de navegador comum.

- [ ] **Step 1: testes** (com `lookup` e `fetchImpl` falsos):
  - `isPrivateAddress`: `127.0.0.1`, `10.1.2.3`, `192.168.0.1`, `169.254.169.254`, `::1`, `::ffff:127.0.0.1` → true; `8.8.8.8`, `2606:4700::1` → false
  - host que resolve para `10.0.0.5` → `blocked_address` e `fetchImpl` não chamado
  - redirect 302 para `http://127.0.0.1/` → `blocked_address`
  - `fetchImpl` que nunca responde + `timeoutMs: 50` → `timeout`
  - corpo maior que `maxBytes` → `too_large`
  - `'file:///etc/passwd'` → `invalid_url`
  - resposta 200 normal → `ok:true` com `status 200` e o HTML
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(web): busca de páginas com proteção SSRF`.

### Task 5: Ler anúncio e salvar (Server Actions)

**Files:**
- Create: `apps/web/src/lib/apartments/schema.ts`, `apps/web/src/lib/apartments/build-insert.ts`, `apps/web/src/lib/apartments/queries.ts`, `apps/web/src/app/(app)/apartamentos/novo/actions.ts`
- Test: `apps/web/src/lib/apartments/build-insert.test.ts`, `schema.test.ts`

**Interfaces:**
- Consumes: core (`parseListingUrl`, `SERVER_FETCH_ALLOWED`, `extractFromPage`, `extractFromUrlOnly`, `computeConfidence`), `safeFetchHtml`, `createServerSupabase`
- Produces:
  - `newApartmentSchema` (zod): `url` obrigatório; `customName`, `neighborhood`, `city`, `notes` opcionais (trim, máx. 200/2000); `rent`, `condoFee`, `iptu` via `parseBRL` (≥0); `bedrooms`, `bathrooms`, `parking` inteiros 0–20; `areaM2` > 0; `priority` 1–5 (padrão 3); `fieldOrigins: Record<FieldKey, 'page'|'url'|'user'>` (JSON em campo oculto)
  - `findDuplicate(supabase, parsed: ParsedListingUrl): Promise<{ id: string; name: string } | null>` (por `url_normalized` ou `platform + external_id`)
  - `type ReadResult = { ok: true; parsed: { normalized: string; platform: Platform; externalId?: string }; extraction: Extraction; fetch: 'fetched' | 'not_allowed' | 'blocked' | 'failed'; duplicate: { id: string; name: string } | null } | { ok: false; error: string }`
  - `readListingAction(_prev: ReadResult | null, form: FormData): Promise<ReadResult>`
  - `buildApartmentInsert(input: NewApartmentInput, ctx: { userId: string; parsed: ParsedListingUrl; extraction: Extraction | null; fetched: boolean; now: Date }): { apartment: TablesInsert<'apartments'>; snapshot: TablesInsert<'apartment_snapshots'> | null; price: TablesInsert<'apartment_price_history'> | null; status: TablesInsert<'apartment_status_history'> }`
  - `createApartmentAction(_prev: CreateState, form: FormData): Promise<CreateState>` com `CreateState = { error?: string; fieldErrors?: Record<string, string>; duplicateId?: string }`; sucesso → `redirect('/apartamentos?novo=<id>')`

Regras de `buildApartmentInsert`:
- `monitor_mode`: plataforma com `SERVER_FETCH_ALLOWED` e `fetched` → `auto`; zap/vivareal/olx/imovelweb → `extension`; resto → `manual`.
- `status`: `fetched` + `pageKind 'listing'` + `availability 'active'` → `ativo`; `explicit_unavailable` → `indisponivel` (evidence no status_history); `pageKind 'challenge'` ou fetch falhou → `erro_acesso`; senão `nao_verificado`.
- `last_check_at` = now se houve tentativa de fetch; `last_success_at`/`last_source 'server'` só se `pageKind 'listing'`; sem fetch → `last_source 'manual'` se o usuário digitou preço.
- `confidence` via `computeConfidence` (rentMethod = `user` se o usuário alterou/digitou o aluguel).
- `snapshot` só quando houve fetch (com `http_status`, `page_kind`, valores, `raw` = extraction sem HTML).
- `price` quando há aluguel (source `server` se lido da página e não alterado; senão `manual`).
- `source_title` = título lido; `main_image_url` = primeira imagem.

- [ ] **Step 1: testes** de `newApartmentSchema` (`'R$ 1.700,00'`→1700; quartos `'-1'` → erro PT-BR; url vazia → "Cole o link do anúncio") e de `buildApartmentInsert`:
  - Chaves na Mão lido (`fetched:true`, listing, active, rent jsonld não alterado) → `monitor_mode 'auto'`, `status 'ativo'`, `confidence 'alta'`, `price.source 'server'`, `snapshot.page_kind 'listing'`
  - (`complete` = aluguel presente **e** quartos presente **e** cidade presente)
  - ZAP (`fetched:false`, usuário digitou 1500) → `monitor_mode 'extension'`, `status 'nao_verificado'`, `confidence 'baixa'`, `price.source 'manual'`, `snapshot null`
  - Chaves na Mão com desafio → `status 'erro_acesso'`, sem `price` se usuário não digitou, nunca `indisponivel`
  - Offer OutOfStock → `status 'indisponivel'`, `status.evidence` preenchida
  - Usuário altera aluguel lido (1700→1650) → `price.source 'manual'`, `confidence 'baixa'`
- [ ] **Step 2:** FAIL → **Step 3:** implementar (inserções em sequência: apartment → snapshot/price/status com `apartment_id`; erro `23505` → `{ error: 'Você já acompanha este anúncio.', duplicateId }`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(web): leitura de anúncio e cadastro com bloqueio de duplicados`.

### Task 6: Tela "Adicionar apartamento"

**Files:**
- Create: `apps/web/src/app/(app)/apartamentos/novo/page.tsx`, `novo/new-apartment-flow.tsx` (client), `novo/field-origin-badge.tsx`
- Modify: `apps/web/src/components/add-apartment-button.tsx` (vira link para `/apartamentos/novo`, sem tooltip), `apps/web/src/components/app-shell/nav-items.ts` (sem mudança de itens; `/apartamentos/novo` ativa "Meus Apartamentos" — já coberto por `activeNavHref`)

Fluxo (uma página, dois passos):
1. Campo grande "Cole o link do anúncio" + botão "Ler anúncio" (Enter envia). Estados: lendo… / erro PT-BR.
2. Resultado: faixa com plataforma + situação da leitura:
   - `fetched` → "Dados lidos do anúncio agora" (verde)
   - `not_allowed` → "O ZAP Imóveis bloqueia leitura automática. Preenchemos o que dá pelo link; complete o resto. A extensão do Chrome (Etapa 4) vai atualizar este anúncio." (âmbar)
   - `blocked`/`failed` → "Não foi possível acessar o anúncio agora. Nada foi inventado: preencha manualmente." (âmbar)
   - `duplicate` → "Você já acompanha este anúncio" + link "Ver imóvel" e botão salvar desabilitado
3. Formulário com todos os campos do spec §3 (nome, plataforma só leitura, bairro, cidade, aluguel, condomínio, IPTU, quartos, banheiros, vagas, área, prioridade 1–5, observações). Cada campo pré-preenchido mostra selo "do anúncio"/"do link"; ao editar vira "você". Total mensal estimado calculado ao vivo. Botão "Salvar e acompanhar". Mobile: 1 coluna; desktop: 2 colunas.

- [ ] **Step 1:** Teste de `originAfterEdit(prev: 'page'|'url'|'user', changed: boolean): 'page'|'url'|'user'` e `estimateTotal({rent, condoFee, iptu})` (vazios contam 0; tudo vazio → null) em `novo/form-helpers.ts` + `form-helpers.test.ts`. FAIL → implementar → PASS.
- [ ] **Step 2:** Implementar páginas/componentes; `npx tsc --noEmit -p apps/web` sem erros.
- [ ] **Step 3:** Commit `feat(web): tela de adicionar apartamento`.

### Task 7: Lista em cards, detalhe básico e indicadores reais

**Files:**
- Create: `apps/web/src/components/apartments/apartment-card.tsx`, `status-badge.tsx`, `mode-badge.tsx`, `freshness.tsx`, `apps/web/src/lib/format.ts`, `apps/web/src/app/(app)/apartamentos/[id]/page.tsx`, `[id]/delete-button.tsx`, `[id]/actions.ts`
- Modify: `apartamentos/page.tsx` (grade de cards), `dashboard/page.tsx` (indicadores reais: monitorados, disponíveis, média do total mensal; "Reduções recentes" e "Com alterações" seguem "—" com legenda "A partir da Etapa 3")
- Test: `apps/web/src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatBRL(n: number | null): string` ("R$ 1.700" / "—"), `formatRelative(iso: string | null, now: Date): string` ("há 3 h", "há 2 dias", "nunca verificado"), `STATUS_META: Record<ApartmentStatus, { label: string; tone: 'green'|'red'|'yellow'|'gray'|'blue' }>`, `deleteApartmentAction(id: string): Promise<void>`

Card (inspirado nas referências): foto 16:10 (ou placeholder com ícone se não houver), selo de status sobre a foto, selo de modo (Servidor / Extensão / Manual), nome (custom ou título), bairro · cidade, aluguel grande + "/mês", linha condomínio · IPTU, total mensal estimado, quartos · vagas · m², rodapé "Atualizado há X · via Y · confiabilidade Z" ou "Ainda não verificado". Cores: amarelo = `verificacao_necessaria`/`erro_acesso`/`nao_verificado`; cinza = `indisponivel`/`removido`/`possivelmente_alugado`; verde/vermelho reservados para variação de preço (Etapa 3). Grade 1/2/3/4 colunas (mobile→xl). Imagens externas com `<img loading="lazy" referrerPolicy="no-referrer">`.
Detalhe básico: dados, origem, link "Abrir anúncio original" (nova aba), "Excluir" com confirmação (AlertDialog: "Isso apaga o imóvel e todo o histórico. Não dá para desfazer."). Gráfico/histórico ficam na Etapa 5.

- [ ] **Step 1: testes** `formatBRL(1700)`→`'R$ 1.700'`; `formatBRL(1700.5)`→`'R$ 1.700,50'`; `formatBRL(null)`→`'—'`; `formatRelative` com now fixo: −30 min → `'há 30 min'`, −3 h → `'há 3 h'`, −49 h → `'há 2 dias'`, null → `'nunca verificado'`; `STATUS_META` cobre os 7 status. FAIL → implementar → PASS.
- [ ] **Step 2:** Implementar componentes/páginas; typecheck ok.
- [ ] **Step 3:** Commit `feat(web): cards de apartamentos, detalhe básico e indicadores`.

### Task 8: Verificação de ponta a ponta

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run build` → tudo verde.
- [ ] **Step 2:** No navegador embutido, logado: cadastrar os 2 links do Chaves na Mão → preenchidos "do anúncio", status Ativo, modo Servidor, confiabilidade Alta; cadastrar 1 link ZAP → quartos/área/cidade "do link", aviso âmbar, digitar preço, modo Extensão, status "Não verificado", confiabilidade Baixa; colar o mesmo ZAP com `?source=…` diferente → "Você já acompanha este anúncio"; testar `http://127.0.0.1` → recusado.
- [ ] **Step 3:** Conferir no banco (MCP SQL): 3 apartamentos, 2 snapshots, 3 linhas de preço, 3 de status; rodar `supabase/tests/rls_check.sql` → 9/9.
- [ ] **Step 4:** Celular 375 px: formulário e cards sem rolagem horizontal; tema escuro legível.
- [ ] **Step 5:** Roteiro para o usuário cadastrar os 6 links dele; os cadastros de teste do Step 2 são apagados antes (com confirmação do usuário) ou mantidos se ele quiser.
