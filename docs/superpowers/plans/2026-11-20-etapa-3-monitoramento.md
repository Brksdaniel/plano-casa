# Etapa 3 — Monitoramento automático · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O servidor verifica sozinho (de hora em hora, ~4×/dia por imóvel) os anúncios em modo `auto`, registra snapshots, histórico de preço/status e mudanças com as regras do spec §6; o usuário pode "Atualizar anúncio agora" ou atualizar manualmente; cards mostram a variação de preço.

**Architecture:** Regras puras no core (`detectChanges`, `nextStatus`). No web, `planCheck` (puro, testado) transforma leitura + estado anterior em linhas a gravar; um executor fino grava com o cliente admin. `/api/cron/monitor` (protegido por segredo) é chamado pelo `pg_cron` (URL/segredo no Vault). Publicação na Vercel a partir do GitHub.

**Tech Stack:** igual às etapas anteriores + `pg_cron`, `pg_net`, Supabase Vault, Vercel Cron (reserva).

**Spec:** `docs/superpowers/specs/2026-11-20-deniels-home-tracker-design.md` (§4, §5, §6, §7, §12.2)

## Global Constraints

- Erro HTTP, bloqueio, desafio ou timeout **nunca** viram `possivelmente_alugado`/`indisponivel`/`removido` (spec §6).
- `removido` só com 404/410 em **2 verificações seguidas com ≥ 12 h** entre elas.
- Nunca buscar plataformas com `SERVER_FETCH_ALLOWED = false`.
- `SUPABASE_SECRET_KEY` e `CRON_SECRET` só no servidor; o assistente não lê nem digita a chave secreta do Supabase (o usuário cola no `.env.local` e na Vercel).
- Mudanças em `tracker` só por migração versionada em `supabase/migrations/`; nada no schema `public`.
- Textos em PT-BR.

## Review Focus

1. Mesmo cron disparado duas vezes ao mesmo tempo → nenhuma mudança/registro duplicado (`dedupe_key` por snapshot + `unique`). (Task 3)
2. Página que volta a responder após `erro_acesso` → status volta ao que a página mostra, contadores zeram, sem notificar "voltou a ficar disponível" se antes era só erro de acesso. (Task 1)
3. Usuário digitou condomínio que a página não informa → verificação automática **não apaga** o valor dele. (Task 3)
4. `/api/cron/monitor` sem segredo, com segredo errado ou com segredo de tamanho diferente → 401 sem processar nada. (Task 4)
5. "Atualizar agora" clicado duas vezes em menos de 10 min → segunda recusa com mensagem, sem nova busca. (Task 5)

---

### Task 1: Regras puras de status e mudanças (core)

**Files:** Create `packages/core/src/status.ts`, `packages/core/src/changes.ts`; Modify `packages/core/src/index.ts`; Test `status.test.ts`, `changes.test.ts`

**Interfaces — Produces:**
- `type ApartmentStatus` (mesmos 7 valores do banco) em `types.ts`
- `type StatusState = { status: ApartmentStatus; consecutiveFailures: number; consecutiveNotFound: number; lastNotFoundAt: string | null; mode: 'auto' | 'extension' | 'manual' }`
- `type Observation = { kind: 'listing'; availability: Extraction['availability']; evidence: string[] } | { kind: 'not_found' } | { kind: 'blocked' } | { kind: 'failed' } | { kind: 'other' }`
- `nextStatus(prev: StatusState, obs: Observation, now: Date): StatusState & { evidence: string | null; demoted: boolean }`
- `type ObservedValues = { rent?: number; condoFee?: number; iptu?: number; bedrooms?: number; bathrooms?: number; parking?: number; areaM2?: number; descriptionHash?: string; imagesHash?: string }`
- `type ChangeDraft = { kind: 'price_down' | 'price_up' | 'condo_change' | 'iptu_change' | 'status_change' | 'description_change' | 'features_change' | 'images_change'; oldValue: string | null; newValue: string | null; diffAbs: number | null; diffPct: number | null }`
- `detectChanges(prev: ObservedValues, next: ObservedValues, prevStatus: ApartmentStatus, nextStatus: ApartmentStatus): ChangeDraft[]`
- `hashText(text: string): string` (FNV-1a 32 bits em hex; normaliza espaços/caixa) e `hashList(items: string[]): string`

Regras `nextStatus`:
- listing+active → `ativo`; listing+explicit_unavailable → `indisponivel` com evidência; listing+unknown → mantém status anterior se era `ativo`, senão `verificacao_necessaria`. Zera os dois contadores.
- not_found: 1ª vez (ou anterior há < 12 h) → `verificacao_necessaria`, `consecutiveNotFound+1`, `lastNotFoundAt=now`; se `consecutiveNotFound ≥ 1` e `lastNotFoundAt` ≤ now−12 h → `removido`.
- blocked/failed/other → `erro_acesso`, `consecutiveFailures+1`; o status de disponibilidade anterior **não** vira indisponível. Se `consecutiveFailures` chega a 3 e `mode === 'auto'` → `demoted: true`, `mode: 'extension'`.
Regras `detectChanges`: preço só se ambos definidos e diferentes (`price_down`/`price_up`, `diffAbs = new−old`, `diffPct` 2 casas sobre o antigo); condomínio/IPTU idem (`condo_change`/`iptu_change`); quartos/banheiros/vagas/área → um `features_change` com lista; hashes diferentes (ambos definidos) → `description_change`/`images_change`; status diferente → `status_change`. Campo ausente em `next` nunca gera mudança.

- [ ] **Step 1: testes** — `nextStatus`: ativo + listing active → ativo, contadores 0; ativo + blocked ×3 (mode auto) → `erro_acesso`, `consecutiveFailures 3`, `demoted true`, `mode 'extension'`; erro_acesso + listing active → ativo, `consecutiveFailures 0`; ativo + not_found → `verificacao_necessaria` (1); + not_found 6 h depois → continua `verificacao_necessaria`; + not_found 13 h depois da 1ª → `removido`; ativo + listing explicit_unavailable → `indisponivel` com evidência; nenhuma sequência de blocked/failed produz `indisponivel|removido|possivelmente_alugado`. `detectChanges`: 1700→1650 → `price_down` diffAbs −50 diffPct −2.94; 1700→1700 → []; rent ausente no next → []; condomínio 270→300 → `condo_change`; quartos 2→3 → `features_change`; hash de descrição diferente → `description_change`; status ativo→indisponivel → `status_change`. `hashText('  Olá  Mundo ')` === `hashText('olá mundo')`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS (`npm test -w @deniels/core`).
- [ ] **Step 5:** Commit `feat(core): regras de status e detecção de mudanças`.

### Task 2: Migração — tendência de preço, extensões e chave de idempotência

**Files:** Create `supabase/migrations/20261120000002_monitoring.sql`; Modify `apps/web/src/lib/database.types.ts`, `supabase/tests/rls_check.sql` (adiciona checagem da view)

Conteúdo:
- `create extension if not exists pg_cron; create extension if not exists pg_net with schema extensions;`
- `alter table tracker.apartments add column last_not_found_at timestamptz;`
- `alter table tracker.apartment_snapshots add column run_id uuid;`
- view `tracker.apartment_price_trend with (security_invoker = true)`: por `apartment_id`, último e penúltimo `rent` distintos do histórico (`latest_rent`, `previous_rent`, `latest_at`, `changed_at` = quando o último valor diferente começou) — via `lag()` sobre `apartment_price_history` ordenado por `recorded_at`.
- `grant select on tracker.apartment_price_trend to authenticated, service_role;`

- [ ] **Step 1:** Estender `rls_check.sql`: usuário A só vê a tendência dos próprios imóveis; anon `permission denied`. Rodar → FAIL (view não existe).
- [ ] **Step 2:** Aplicar a migração via MCP (`apply_migration`) — operação aditiva, sem tocar `public`.
- [ ] **Step 3:** `rls_check.sql` → todas `ok`; `get_advisors` security sem alerta novo em `tracker`.
- [ ] **Step 4:** Atualizar `database.types.ts` (coluna nova, view em `Views`). Commit `feat(db): tendência de preço e base do monitoramento`.

### Task 3: Plano de verificação e executor (web)

**Files:** Create `apps/web/src/lib/supabase/admin.ts`, `apps/web/src/lib/monitor/plan-check.ts`, `apps/web/src/lib/monitor/run-check.ts`; Modify `apps/web/src/lib/env.ts` (`getServiceEnv`); Test `plan-check.test.ts`, `env.test.ts`

**Interfaces — Produces:**
- `getServiceEnv(): { supabaseSecretKey: string; cronSecret: string }` (lança `MissingEnvError`)
- `createAdminSupabase(): SupabaseClient<Database,'tracker'>` (`server-only`, `auth.persistSession=false`)
- `planCheck(input: { apartment: Tables<'apartments'>; read: ListingRead; lastPrice: Tables<'apartment_price_history'> | null; lastSnapshot: Tables<'apartment_snapshots'> | null; now: Date; runId: string; trigger: 'cron'|'manual' }): { apartmentUpdate: TablesUpdate<'apartments'>; snapshot: Child<'apartment_snapshots'>; price: Child<'apartment_price_history'> | null; statusRow: Child<'apartment_status_history'> | null; changes: Child<'apartment_changes'>[]; log: TablesInsert<'monitoring_logs'> }`
- `runCheck(admin, apartmentId: string, opts: { trigger: 'cron'|'manual'; runId: string; now?: Date }): Promise<{ outcome: string; status: ApartmentStatus; changes: number }>`

Regras de `planCheck`: observação a partir da leitura (`fetched`+pageKind → Observation; `failed` → failed; `not_allowed` → não deveria acontecer em `auto`: outcome `skipped`); `nextStatus` + `detectChanges` (prev = último snapshot de página lida; next = extração); valores do imóvel atualizados só para campos presentes na extração com método `jsonld|text|meta` (nunca apaga o que o usuário digitou); `price` quando aluguel/condomínio/IPTU mudam ou última linha > 20 h; `dedupe_key = snap:<runId>:<apartmentId>:<kind>`; `confidence` recalculada; `last_check_at` sempre, `last_success_at`/`last_source 'server'` só com listing; demote → `monitor_mode 'extension'` + evidência "Bloqueado 3 vezes seguidas; passou para a extensão".
`runCheck`: carrega imóvel/último preço/último snapshot com o admin, `readListing`, `planCheck`, grava (snapshot → changes/price/status → update apartment → log). Erros de gravação viram log `outcome 'error'`.

- [ ] **Step 1: testes** de `planCheck` com as fixtures reais: (a) leitura igual à anterior → nenhuma mudança, sem preço novo se última linha < 20 h, `last_success_at` atualizado; (b) fixture com preço trocado 1700→1650 → 1 `price_down`, `price` novo, `apartmentUpdate.rent 1650`, `confidence 'alta'`; (c) desafio 403 → status `erro_acesso`, `consecutive_failures +1`, **rent inalterado**, sem `price`; (d) 3º bloqueio seguido → `monitor_mode 'extension'`, `statusRow.evidence` com "3 vezes"; (e) usuário tinha `iptu 80` e a página não traz IPTU → `apartmentUpdate` não contém `iptu`; (f) OutOfStock → `indisponivel` + `status_change`; (g) mesma entrada duas vezes com o mesmo runId → mesmas `dedupe_key`. `getServiceEnv` sem `SUPABASE_SECRET_KEY` → `MissingEnvError`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. Commit `feat(web): plano e executor de verificação`.

### Task 4: Rota do cron

**Files:** Create `apps/web/src/app/api/cron/monitor/route.ts`, `apps/web/src/lib/monitor/cron-auth.ts`, `apps/web/src/lib/monitor/select-due.ts`, `apps/web/vercel.json`; Test `cron-auth.test.ts`, `select-due.test.ts`

**Interfaces — Produces:**
- `isAuthorizedCron(authorization: string | null, secret: string): boolean` (`Bearer <secret>`, comparação `timingSafeEqual`, tamanhos diferentes → false)
- `dueCutoff(now: Date): string` (now − 6 h) e `MAX_PER_RUN = 8`, `SAME_DOMAIN_DELAY_MS = 2500`
- `GET|POST /api/cron/monitor` → 401 sem segredo; senão seleciona imóveis `monitor_mode='auto'`, `archived_at is null`, `last_check_at is null or < cutoff`, ordem `last_check_at nulls first`, limite 8; processa em sequência com espera entre imóveis da mesma plataforma; resposta `{ runId, checked, results: [...] }`. `export const maxDuration = 60`.
- `vercel.json`: `{"crons":[{"path":"/api/cron/monitor","schedule":"0 9 * * *"}]}` (reserva diária; Vercel envia `Authorization: Bearer $CRON_SECRET`).

- [ ] **Step 1: testes** `isAuthorizedCron`: correto → true; null/`'Bearer '`/errado/tamanho diferente/sem "Bearer" → false. `dueCutoff(2026-11-20T12:00Z)` → `2026-11-20T06:00:00.000Z`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5:** Local (com `.env.local` contendo `SUPABASE_SECRET_KEY` e `CRON_SECRET` colocados pelo usuário): `curl` sem header → 401; com header → 200 e o imóvel do Chaves na Mão verificado (log em `monitoring_logs`). Commit `feat(web): rota do monitoramento agendado`.

### Task 5: "Atualizar anúncio agora" e atualização manual

**Files:** Create `apps/web/src/app/(app)/apartamentos/[id]/refresh-button.tsx`, `manual-update-dialog.tsx`, `apps/web/src/lib/monitor/plan-manual.ts`; Modify `[id]/actions.ts`, `[id]/page.tsx`; Test `plan-manual.test.ts`; shadcn `dialog`

**Interfaces — Produces:**
- `refreshApartmentAction(id: string): Promise<{ ok: true; message: string } | { ok: false; error: string }>` — confirma dono com o cliente do usuário; recusa se `last_check_at` < 10 min ("Verificado há X min. Tente de novo em Y min."); só modo `auto`; usa `runCheck` (trigger `manual`).
- `planManualUpdate(input: { apartment: Tables<'apartments'>; rent?: number; condoFee?: number; iptu?: number; availability: 'available' | 'rented' | 'unknown'; now: Date; runId: string }): { apartmentUpdate; snapshot (source 'manual'); price | null; statusRow | null; changes }` — `rented` → `possivelmente_alugado` com evidência "Informado por você"; `available` → `ativo`; `unknown` → mantém; `last_source 'manual'`, confiança via `computeConfidence(rentMethod 'user')`.
- `manualUpdateAction(id: string, form: FormData)` (zod; grava com o cliente do usuário — RLS).

UI: no detalhe, botão principal conforme modo — `auto`: "Atualizar anúncio agora" (spinner, toast com resultado: "Sem mudanças" / "Preço caiu R$ 50" / "Site bloqueou a leitura — tente mais tarde"); `extension`: "Abrir anúncio para atualizar" (nova aba) + "Atualizar manualmente"; `manual`: "Atualizar manualmente". Dialog com aluguel, condomínio, IPTU (pré-preenchidos) e "Situação do anúncio" (Disponível / Parece alugado / Não sei).

- [ ] **Step 1: testes** `planManualUpdate`: 1500→1450 → `price_down` + preço `manual`; `rented` → `possivelmente_alugado` + `status_change` + evidência; nada mudou → sem price/changes, `last_success_at` atualizado. FAIL → implementar → PASS.
- [ ] **Step 2:** UI + actions; typecheck/lint. Commit `feat(web): atualizar agora e atualização manual`.

### Task 6: Variação de preço nos cards, alterações recentes e indicadores

**Files:** Create `apps/web/src/components/apartments/price-trend.tsx`, `apps/web/src/lib/apartments/trend.ts`; Modify `queries.ts` (junta `apartment_price_trend`; `recentChanges(supabase, days)`), `apartment-card.tsx`, `dashboard/page.tsx`, `[id]/page.tsx` (lista "Últimas alterações" com até 10 itens); Test `trend.test.ts`

**Interfaces — Produces:** `priceTrend(latest: number | null, previous: number | null): { direction: 'down' | 'up' | 'flat' | 'none'; diffAbs: number; diffPct: number }`; `describeChange(change: Tables<'apartment_changes'>): string` ("Aluguel caiu R$ 50 (−2,9%)", "Condomínio mudou de R$ 270 para R$ 300", "Status: Ativo → Indisponível").

- [ ] **Step 1: testes** `priceTrend(1650,1700)` → down −50 −2.94; `(1700,1650)` → up; `(1700,1700)` → flat; `(1700,null)` → none. `describeChange` para price_down, condo_change, status_change, features_change.
- [ ] **Step 2:** FAIL → implementar → PASS. Card: selo verde "▼ R$ 50 (−2,9%)" / vermelho "▲ …". Dashboard: "Reduções recentes" = imóveis com `price_down` em 14 dias; "Com alterações" = imóveis com qualquer mudança em 7 dias; seção "Novidades" (timeline das 8 últimas mudanças). Commit `feat(web): variação de preço e alterações recentes`.

### Task 7: Publicação e agendamento (com o usuário)

- [ ] **Step 1 (usuário):** importar `Brksdaniel/plano-casa` na Vercel — Root Directory `apps/web`; variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (o usuário cola), `CRON_SECRET` (gerado pelo assistente com `openssl rand -hex 32` e entregue ao usuário para colar), `NEXT_PUBLIC_SITE_URL` (domínio `.vercel.app`). Deploy.
- [ ] **Step 2:** Supabase Auth → URL Configuration: Site URL = domínio da Vercel (usuário, guiado).
- [ ] **Step 3:** Verificar o site publicado (login, páginas) pelo navegador embutido.
- [ ] **Step 4:** **Teste decisivo**: chamar `/api/cron/monitor` em produção (com o segredo) e ver se o Chaves na Mão responde aos IPs da Vercel. Se bloquear: o imóvel vai a `erro_acesso` (e após 3× para `extension`) — relatar ao usuário com a evidência, sem contornar.
- [ ] **Step 5:** Migração `20261120000003_monitor_cron.sql`: segredos no Vault (`tracker_monitor_url`, `tracker_cron_secret` — inseridos via SQL com o valor do segredo, nunca versionados) e `cron.schedule('tracker-monitor-hourly', '7 * * * *', $$ select net.http_post(url := ..., headers := jsonb_build_object('Authorization', 'Bearer ' || ...), timeout_milliseconds := 60000) $$)`. Conferir `cron.job_run_details` e `net._http_response` após a primeira execução.

### Task 8: Verificação de ponta a ponta

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run build` → verde.
- [ ] **Step 2:** Produção: "Atualizar agora" no imóvel do Chaves na Mão → resultado exibido; segunda tentativa em < 10 min → recusada. Atualização manual no imóvel ZAP (corrigir o aluguel de teste) → `price` manual + mudança registrada + card com seta.
- [ ] **Step 3:** Banco: `monitoring_logs` com execuções `cron` e `manual`; nenhuma `dedupe_key` repetida; `rls_check.sql` 9/9 + view.
- [ ] **Step 4:** Celular 375 px: detalhe, dialog e cards sem rolagem horizontal.
- [ ] **Step 5:** Roteiro para o usuário + o que ficou para as Etapas 4–8.
