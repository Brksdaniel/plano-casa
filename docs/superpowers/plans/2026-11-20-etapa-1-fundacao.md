# Etapa 1 — Fundação · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site com login funcionando localmente: monorepo, banco `tracker` com RLS no Supabase, rotas protegidas e o layout (menu lateral, topo, tema claro/escuro) com páginas vazias honestas.

**Architecture:** npm workspaces com `apps/web` (Next.js App Router) e `packages/core` (TS puro, vazio por enquanto, só com Vitest configurado). Supabase via `@supabase/ssr` com `db.schema = 'tracker'`. Proteção de rotas no middleware/proxy do Next.

**Tech Stack:** Next.js (última estável via `create-next-app@latest`), TypeScript, Tailwind CSS, shadcn/ui, next-themes, lucide-react, @supabase/ssr, @supabase/supabase-js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-deniels-home-tracker-design.md` (seções 4, 5, 10, 11)

## Global Constraints

- Todo texto de interface em português brasileiro.
- Projeto Supabase: `sistema-salas`, ref `uruiexisyqteqnegmyag`. Tudo do tracker no schema `tracker`; **nenhuma migração toca `public`**.
- Chaves privadas (`SUPABASE_SERVICE_ROLE_KEY`) nunca em código do cliente nem com prefixo `NEXT_PUBLIC_`.
- Tema claro é o padrão; escuro opcional e persistido.
- Paleta: fundo claro, grafite, branco, verde discreto (oportunidade), roxo/índigo (destaque).
- Nenhum dado fictício: telas sem dados mostram estado vazio; integrações não configuradas aparecem como "Não configurado".
- Antes de usar API de Next.js/Supabase/shadcn, consultar a documentação atual (Context7) — a versão instalada manda.

## Review Focus

1. Sessão expirada ou cookie inválido → redireciona para `/login` com aviso, sem tela de erro. (Task 4)
2. Variáveis de ambiente ausentes → página de erro clara em PT-BR dizendo qual variável falta, não tela branca. (Task 3)
3. Usuário anônimo (chave anon, sem login) não lê nem escreve nenhuma tabela do `tracker`. (Task 2)
4. Celular 375 px: sem rolagem horizontal; menu lateral vira gaveta. (Task 5)
5. Tema escuro persiste ao recarregar sem "piscar" claro. (Task 5)

---

### Task 1: Monorepo e esqueleto

**Files:**
- Create: `package.json` (raiz, `"workspaces": ["apps/*", "packages/*"]`, scripts `dev`, `build`, `lint`, `typecheck`, `test`), `.gitignore`, `.editorconfig`, `.nvmrc` (`24`)
- Create: `apps/web/` via `npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (rodado dentro de `apps/`)
- Create: `packages/core/package.json` (`name: "@deniels/core"`, `type: module`), `packages/core/src/index.ts`, `packages/core/vitest.config.ts`, `packages/core/tsconfig.json`
- Test: `packages/core/src/index.test.ts`

**Interfaces:**
- Produces: pacote `@deniels/core` importável por `apps/web` (`transpilePackages: ['@deniels/core']` em `next.config`).

- [ ] **Step 1:** Criar raiz e `create-next-app`. Remover o `.git` aninhado se o create-next-app criar um.
- [ ] **Step 2:** Teste `index.test.ts`: `expect(CORE_VERSION).toBe('0.1.0')`. Rodar `npm test -w @deniels/core` → FAIL.
- [ ] **Step 3:** `export const CORE_VERSION = '0.1.0'` em `packages/core/src/index.ts`.
- [ ] **Step 4:** `npm test -w @deniels/core` → PASS. `npm run build -w web` → build ok.
- [ ] **Step 5:** shadcn: `npx shadcn@latest init` em `apps/web` (estilo padrão, cor base neutral); adicionar `button card input label dropdown-menu sheet avatar badge separator tooltip sonner skeleton`.
- [ ] **Step 6:** Commit `chore: monorepo, Next.js e pacote core`.

### Task 2: Schema `tracker`, tabelas e RLS

**Files:**
- Create: `supabase/migrations/20261120000001_tracker_schema.sql`
- Create: `supabase/tests/rls_check.sql` (script de verificação, rodado via MCP `execute_sql`)
- Create: `apps/web/src/lib/database.types.ts` (gerado; se o gerador não suportar o schema `tracker`, escrever os tipos das tabelas à mão a partir da migração)

**Interfaces:**
- Produces: tabelas da seção 5 do spec no schema `tracker` (`profiles`, `user_preferences`, `apartments`, `apartment_snapshots`, `apartment_price_history`, `apartment_status_history`, `apartment_changes`, `notifications`, `monitoring_logs`), enums `tracker.apartment_status`, `tracker.monitor_mode`, `tracker.data_source`, `tracker.confidence_level`; tipo `Database` em `database.types.ts`.

Conteúdo da migração (decisões fixas):
- `create schema tracker;` + `grant usage on schema tracker to authenticated, service_role;` (**não** para `anon`). `alter default privileges in schema tracker grant select, insert, update, delete on tables to authenticated; ... grant all ... to service_role`.
- Enums: `apartment_status` = `ativo, possivelmente_alugado, indisponivel, removido, erro_acesso, verificacao_necessaria, nao_verificado`; `monitor_mode` = `auto, extension, manual`; `data_source` = `server, extension, manual`; `confidence_level` = `alta, media, baixa`.
- Valores em dinheiro: `numeric(10,2)`. `apartments.total_monthly` = `generated always as (coalesce(rent,0)+coalesce(condo_fee,0)+coalesce(iptu,0)) stored`.
- `apartments.priority smallint check (priority between 1 and 5) default 3`.
- Unicidade: `unique (user_id, url_normalized)` e `create unique index ... on apartments (user_id, platform, external_listing_id) where external_listing_id is not null`.
- `apartment_changes.dedupe_key` e `notifications.dedupe_key`: `unique`.
- Tabelas filhas (`snapshots`, `*_history`, `changes`) têm `user_id` próprio (simplifica RLS) + FK `apartment_id ... on delete cascade`.
- Índices da seção 5 do spec.
- RLS ligada em todas; uma política por tabela `for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))` (em `profiles`, `id = ...`).
- Trigger `tracker.handle_new_user()` (`security definer`, `set search_path = ''`) `after insert on auth.users` → cria `profiles` e `user_preferences` (com `notify_email = new.email`).
- Trigger `updated_at` em `apartments` e `user_preferences`.

- [ ] **Step 1:** Escrever `rls_check.sql`: em transação com `rollback`, cria 2 usuários fake em `auth.users`, insere 1 apartamento para cada (como `service_role`), depois `set local role authenticated` + `set local request.jwt.claims = '{"sub":"<A>"}'` e verifica `count(*) = 1` vendo só o de A; tenta `insert` com `user_id` de B → erro; `set local role anon` → `select` em `tracker.apartments` dá `permission denied`; insere 2 apartamentos com o mesmo `url_normalized` para A → erro de unicidade. Retorna linhas `teste | ok`.
- [ ] **Step 2:** Rodar `rls_check.sql` antes da migração → FAIL (schema não existe).
- [ ] **Step 3:** Escrever a migração. **Pedir confirmação ao usuário** e aplicar via MCP `apply_migration` (projeto `uruiexisyqteqnegmyag`).
- [ ] **Step 4:** Rodar `rls_check.sql` → todas as linhas `ok`. Rodar `get_advisors` (security) → nenhum alerta novo do schema `tracker`.
- [ ] **Step 5:** Usuário adiciona `tracker` em Settings → Data API → Exposed schemas (guiar passo a passo). Gerar `database.types.ts`.
- [ ] **Step 6:** Commit `feat(db): schema tracker com tabelas, RLS e gatilhos`.

### Task 3: Configuração de ambiente e clientes Supabase

**Files:**
- Create: `apps/web/.env.example` (todas as variáveis da seção 11 do spec, com comentário em PT-BR de onde obter cada uma), `apps/web/.env.local` (só URL + anon key nesta etapa; não versionado)
- Create: `apps/web/src/lib/env.ts`, `apps/web/src/lib/supabase/server.ts`, `apps/web/src/lib/supabase/client.ts`
- Test: `apps/web/src/lib/env.test.ts` (Vitest configurado em `apps/web`)

**Interfaces:**
- Produces: `getPublicEnv(): { supabaseUrl: string; supabaseAnonKey: string; siteUrl: string }` — lança `MissingEnvError` (com `.variable: string`) se faltar; `createServerSupabase(): Promise<SupabaseClient<Database, 'tracker'>>`; `createBrowserSupabase(): SupabaseClient<Database, 'tracker'>`. `getServiceEnv()` **não** é criado nesta etapa.

- [ ] **Step 1:** Testes: com `NEXT_PUBLIC_SUPABASE_URL` vazio → lança `MissingEnvError` com `variable === 'NEXT_PUBLIC_SUPABASE_URL'`; com tudo presente → retorna objeto; `NEXT_PUBLIC_SITE_URL` ausente → default `http://localhost:3000`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** `src/app/error.tsx` (global) mostra "Configuração incompleta: falta a variável X" quando o erro é `MissingEnvError`; caso contrário "Algo deu errado" + botão "Tentar novamente".
- [ ] **Step 6:** Obter URL e chave publicável via MCP (`get_project_url`, `get_publishable_keys`) e preencher `.env.local`. Commit `feat(web): ambiente e clientes Supabase`.

### Task 4: Login, logout e proteção de rotas

**Files:**
- Create: `apps/web/src/lib/auth/paths.ts`, `apps/web/src/middleware.ts` (ou `proxy.ts`, conforme a versão do Next instalada), `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/actions.ts`, `apps/web/src/app/auth/signout/route.ts`
- Test: `apps/web/src/lib/auth/paths.test.ts`

**Interfaces:**
- Produces: `isPublicPath(pathname: string): boolean`; `loginAction(prev: LoginState, form: FormData): Promise<LoginState>` com `LoginState = { error?: string }`; rota `POST /auth/signout`.

- [ ] **Step 1:** Testes de `isPublicPath`: `/login` → true; `/login?x=1` path `/login` → true; `/_next/static/a.js` → true; `/favicon.ico` → true; `/` → false; `/apartamentos` → false; `/dashboard` → false; `/loginx` → false.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Middleware: atualiza sessão (padrão `@supabase/ssr` de refresh de cookies), usa `getUser()`; sem usuário e rota não pública → redirect `/login?next=<path>`; usuário logado em `/login` → redirect `/dashboard`. `/` → redirect `/dashboard`.
- [ ] **Step 4:** Página de login (logo "DENIELS HOME TRACKER", e-mail, senha, botão "Entrar", estado de carregando). Mensagens: credencial inválida → "E-mail ou senha incorretos."; outros → "Não foi possível entrar. Tente novamente." Depois do login, redireciona para `next` só se começar com `/` e não com `//`.
- [ ] **Step 5:** Teste de `safeNext(next?: string): string` (em `paths.ts`): `'/apartamentos'` → igual; `'//evil.com'` → `'/dashboard'`; `'https://evil.com'` → `'/dashboard'`; `undefined` → `'/dashboard'`. FAIL → implementar → PASS.
- [ ] **Step 6:** Usuário cria a própria conta no painel do Supabase (Authentication → Users → Add user, com "Auto confirm"). Assistente não digita senha.
- [ ] **Step 7:** Verificar no navegador embutido: `/apartamentos` sem login → vai para `/login?next=/apartamentos`; senha errada → mensagem PT-BR. O login real é feito pelo usuário. Depois do login → cai em `/apartamentos`; "Sair" → volta ao login; cookie de sessão apagado manualmente → redireciona sem erro.
- [ ] **Step 8:** Commit `feat(web): login, logout e rotas protegidas`.

### Task 5: Layout, tema e páginas vazias

**Files:**
- Modify: `apps/web/src/app/globals.css` (tokens de cor claro/escuro), `apps/web/src/app/layout.tsx` (fonte, `ThemeProvider`, `lang="pt-BR"`, metadata `DENIELS HOME TRACKER`)
- Create: `apps/web/src/components/theme-provider.tsx`, `components/theme-toggle.tsx`, `components/app-shell/sidebar.tsx`, `components/app-shell/topbar.tsx`, `components/app-shell/mobile-nav.tsx`, `components/app-shell/nav-items.ts`, `components/empty-state.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`, `(app)/dashboard/page.tsx`, `(app)/apartamentos/page.tsx`, `(app)/notificacoes/page.tsx`, `(app)/configuracoes/page.tsx`
- Test: `apps/web/src/components/app-shell/nav-items.test.ts`

**Interfaces:**
- Produces: `NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[]` = Dashboard `/dashboard`, Meus Apartamentos `/apartamentos`, Notificações `/notificacoes`, Configurações `/configuracoes`; `<EmptyState icon title description action? />`.

- [ ] **Step 1:** Teste: `NAV_ITEMS.map(i => i.href)` igual à lista acima, na ordem; todos os `label` não vazios.
- [ ] **Step 2:** FAIL → implementar `nav-items.ts` → PASS.
- [ ] **Step 3:** Tokens: primária índigo/roxo (ex.: `oklch` próximo de `#6D5DFC`), sucesso verde discreto, aviso âmbar, perigo vermelho, neutros grafite; fundo claro `#F7F8FA`-ish; cards brancos com raio `0.875rem`. Tema escuro equivalente. `next-themes` com `attribute="class"`, `defaultTheme="light"`, `enableSystem={false}`, `suppressHydrationWarning` no `<html>`.
- [ ] **Step 4:** Shell: menu lateral fixo ≥ 1024 px (logo, itens, item ativo destacado, rodapé com e-mail do usuário + "Sair"); topo com título da página, sino (link para notificações), alternador de tema; < 1024 px: botão de menu abre `Sheet` com os mesmos itens.
- [ ] **Step 5:** Páginas:
  - Dashboard: saudação + 5 cartões de indicador com "—" e legenda "Sem dados ainda"; `EmptyState` "Nenhum apartamento monitorado" + botão "+ Adicionar apartamento" (desabilitado com tooltip "Disponível na Etapa 2").
  - Meus Apartamentos: cabeçalho + botão "+ Adicionar apartamento" (mesmo estado) + `EmptyState`.
  - Notificações: `EmptyState` "Nenhuma notificação".
  - Configurações: cartão "Integrações" com linhas reais: Supabase "Conectado" (consulta `select count` em `tracker.profiles` com sucesso) ou "Erro"; Monitoramento automático "Não configurado"; E-mail (Resend) "Não configurado" se `RESEND_API_KEY` ausente; Extensão do Chrome "Não conectada".
- [ ] **Step 6:** Verificar no navegador embutido: desktop claro/escuro, recarregar mantém tema sem piscar; 375 px sem rolagem horizontal e gaveta funcionando; contraste legível nos dois temas.
- [ ] **Step 7:** Commit `feat(web): layout, tema e páginas iniciais`.

### Task 6: Verificação final da etapa

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run build` na raiz → tudo verde.
- [ ] **Step 2:** Rodar de novo `supabase/tests/rls_check.sql` → todas `ok`.
- [ ] **Step 3:** `git status` limpo; `.env.local` não versionado (`git check-ignore apps/web/.env.local`).
- [ ] **Step 4:** Roteiro de teste para o usuário (no chat): entrar, navegar nas 4 páginas, trocar tema, testar no celular (via `npm run dev -- -H 0.0.0.0` na mesma rede), sair.
- [ ] **Step 5:** Commit final se houver ajustes: `chore: fechamento da Etapa 1`.
