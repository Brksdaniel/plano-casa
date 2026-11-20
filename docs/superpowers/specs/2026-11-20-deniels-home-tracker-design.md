# DENIELS HOME TRACKER — Documento de Design

Data: 2026-11-20 · Status: aguardando aprovação

## 1. Intenção

Site privado (uso pessoal, um único usuário) para acompanhar anúncios de aluguel que o próprio usuário cadastra por link, até ~março/2027. Não é buscador. O valor está em: saber quando o preço muda, quando o anúncio some e quais imóveis são as melhores oportunidades — sem entrar em cada site todo dia.

### Objetivos
- Fluxo mínimo: entrar → colar link → salvar → acompanhar.
- Monitoramento automático pelo servidor onde o site permitir.
- Extensão do Chrome para capturar dados de sites que bloqueiam acesso automatizado, enquanto o usuário visualiza a página normalmente.
- Histórico de preço/status, notificações (site + e-mail) e resumo diário.
- Interface com aparência de SaaS premium, PT-BR, responsiva, tema claro (padrão) e escuro.

### Não-objetivos
- Buscar imóveis que o usuário não cadastrou.
- Multiusuário/comercial (a estrutura suporta, mas não é foco).
- Telegram/WhatsApp agora (só a arquitetura preparada).

### Anti-objetivos (falhas mesmo que "funcione")
- Burlar CAPTCHA, desafios anti-robô, login ou qualquer proteção.
- Mostrar dado inventado ou antigo como se fosse atual.
- Marcar como "alugado" algo que só deu erro de acesso.
- Notificações repetidas sobre a mesma mudança.
- Depender do Chrome aberto para todo o monitoramento.
- Chaves privadas no front-end ou na extensão.

## 2. Evidência que embasou a decisão

Teste de 2026-11-20, a partir de conexão residencial, páginas públicas de busca:

| Plataforma | HTTP | Observação |
|---|---|---|
| QuintoAndar | 200 | JSON-LD + `__NEXT_DATA__` |
| Chaves na Mão | 200 | 7 blocos JSON-LD |
| OLX, ZAP, Viva Real, Imovelweb | 403 | página de desafio anti-robô |

Pendente: repetir a partir do servidor (IP de datacenter) e com páginas de anúncio individuais — Etapa 2/3.

## 3. Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| **Híbrido: servidor + extensão + manual (ESCOLHIDA)** | Automático onde é possível; dados reais e legítimos nos sites bloqueados; nada é burlado | Sites bloqueados só atualizam quando o usuário abre o anúncio |
| Só servidor + manual | Mais simples | Sites bloqueados viram 100% digitação manual |
| Automação total (navegador headless, proxies) | "Tudo automático" | Exige burlar proteções — viola anti-objetivo. Descartada |

## 4. Arquitetura

```
┌──────────────── Vercel ────────────────┐        ┌──────── Supabase ────────┐
│ apps/web  (Next.js App Router)         │        │ Auth (e-mail + senha)    │
│  • Páginas (dashboard, imóveis, ...)   │◄──────►│ Postgres + RLS           │
│  • /api/cron/monitor   (segredo)       │        │ pg_cron + pg_net ────────┼──► chama /api/cron/monitor
│  • /api/apartments/:id/refresh         │        │   a cada 6 h             │    (Vercel Cron 1x/dia = reserva)
│  • /api/extension/capture  (JWT)       │        └──────────────────────────┘
│  • /api/extract (pré-visualização)     │
│        usa packages/core               │──► Resend (e-mail)
└────────────────────────────────────────┘
          ▲  POST captura (Bearer JWT do usuário)
┌─────────┴──────────────┐
│ apps/extension (MV3)   │  content scripts só nos domínios das plataformas
│  usa packages/core     │  lê DOM (JSON-LD, __NEXT_DATA__, meta, texto)
└────────────────────────┘
```

### Monorepo (npm workspaces)
```
apps/web          Next.js + TS + Tailwind + shadcn/ui + Recharts
apps/extension    Chrome Manifest V3, TS, empacotado com Vite
packages/core     TS puro, sem dependência de runtime:
                    url.ts         normalização + identificação da plataforma
                    extractors/    um adaptador por plataforma + genérico
                    pipeline.ts    comparar captura x último snapshot → mudanças
                    status.ts      regras de status (seção 6)
                    confidence.ts  regras de confiabilidade (seção 7)
                    score.ts       indicador de oportunidade
supabase/migrations  SQL versionado (tabelas, índices, RLS, cron)
docs/
```

**Decisão-chave:** toda a lógica de extração e detecção de mudanças fica em `packages/core` e roda no Node (Vercel). O servidor e a extensão usam o **mesmo** extrator e o **mesmo** pipeline — a extensão só envia o HTML-derivado já extraído; a decisão do que mudou é sempre tomada no servidor. Assim existe uma única fonte de verdade e é testável com HTML salvo (fixtures) via Vitest.

### Adaptadores (interface comum)
```ts
interface PlatformAdapter {
  id: 'quintoandar' | 'chavesnamao' | 'olx' | 'zap' | 'vivareal' | 'imovelweb' | 'generic'
  matches(url: URL): boolean
  serverFetchAllowed: boolean          // false para plataformas que bloqueiam
  extract(doc: PageInput): Extraction  // PageInput = { html, url, httpStatus? }
}
interface Extraction {
  fields: Partial<ListingFields>       // aluguel, condomínio, IPTU, quartos, ... só o que foi lido
  fieldSources: Record<string, 'jsonld'|'nextdata'|'meta'|'text'>
  availability: 'active'|'explicit_unavailable'|'unknown'
  pageKind: 'listing'|'challenge'|'not_found'|'other'
  evidence: string[]                   // trechos que justificam status de indisponível
}
```
Campos não lidos ficam ausentes — nunca preenchidos com palpite.

### Modos de monitoramento (por imóvel, visível na interface)
- **Automático (servidor)** — plataforma com `serverFetchAllowed` e última tentativa do servidor sem bloqueio.
- **Via extensão** — plataforma que bloqueia; atualiza quando o usuário abre o anúncio com a extensão instalada.
- **Manual** — sem extensão disponível ou dados não extraíveis; o usuário atualiza num formulário rápido.

Se o servidor for bloqueado 3 vezes seguidas num imóvel "automático", ele é rebaixado para "via extensão" e o usuário é avisado.

### "Atualizar anúncio agora" (página de detalhes)
- Automático → chama `/api/apartments/:id/refresh`, verifica na hora (limite: 1 a cada 10 min por imóvel). Resultado aparece na tela.
- Via extensão → abre o anúncio numa nova aba; a extensão captura ao carregar e envia; a página de detalhes atualiza ao voltar (revalidação ao ganhar foco).
- Manual → abre o formulário rápido de atualização.

### Agendamento
`pg_cron` + `pg_net` (gratuitos no Supabase) chamam `/api/cron/monitor` a cada 6 h com cabeçalho secreto. A rota processa em lotes, com intervalo de alguns segundos entre requisições ao mesmo domínio e limite por execução. Vercel Cron (plano Hobby: 1x/dia) fica como reserva. O resumo diário é disparado por um job separado (ex.: 8h, horário de Brasília).

### Extensão do Chrome
- **Permissões mínimas:** `storage` + host permissions apenas para os domínios das 6 plataformas e do próprio site. Sem `tabs` amplo, sem `<all_urls>`.
- **Login integrado:** no site, página "Conectar extensão" envia a sessão do Supabase para a extensão via `externally_connectable` (só o domínio do site pode falar com ela). A extensão guarda o refresh token em `chrome.storage.local` e renova o token sozinha. Botão "Desconectar" nos dois lados. Nenhuma chave privada na extensão (só URL e chave pública/anon do Supabase).
- **Comportamento:** ao abrir uma página de anúncio, o content script verifica (lista local de URLs normalizadas monitoradas, sincronizada periodicamente) se o imóvel é acompanhado.
  - Se sim → extrai e envia automaticamente; mostra um pequeno selo "Atualizado no Deniels ✓".
  - Se não → mostra botão discreto "Adicionar ao Deniels".
  - Se a página for desafio/CAPTCHA/login → **não faz nada** (não clica, não insiste) e não envia.
- **Não** abre abas sozinha em segundo plano.
- Envio: `POST /api/extension/capture` com `Authorization: Bearer <JWT>`; o servidor valida o usuário, valida o payload (zod), confere que o imóvel pertence a ele e roda o pipeline.

## 5. Banco de dados (Postgres / Supabase)

**Hospedagem (decidido pelo usuário em 2026-11-20):** projeto Supabase existente `sistema-salas` (ref `uruiexisyqteqnegmyag`, região sa-east-1), num **schema próprio `tracker`**, isolado das tabelas `public.rooms` / `public.reservations`. O schema `tracker` precisa ser adicionado aos "Exposed schemas" da Data API (o usuário faz no painel). Os clientes Supabase do app usam `db: { schema: 'tracker' }`. As migrações do tracker nunca tocam o schema `public`. Consequência aceita: pausar/apagar o sistema-salas derruba o tracker.

Todas as tabelas com `user_id uuid references auth.users` e RLS `user_id = auth.uid()`. Escritas de monitoramento usam a service role apenas no servidor.

- **profiles** — id (=auth.users.id), nome, criado_em.
- **user_preferences** — e-mail de notificação, notificar_email (bool), resumo_diario (bool), horário do resumo, limiar mínimo de variação para notificar (R$ e %), tema.
- **apartments**
  - id, user_id, `url_original`, `url_normalized`, `platform`, `listing_id_externo` (quando houver)
  - `custom_name`, `title_source`, `neighborhood`, `city`
  - `rent`, `condo_fee`, `iptu` (numeric, centavos ou numeric(10,2)), `total_monthly` (gerada: soma dos não nulos), `bedrooms`, `bathrooms`, `parking`, `area_m2`
  - `priority` (1–5), `notes`, `main_image_url`
  - `monitor_mode` ('auto'|'extension'|'manual'), `status` (enum seção 6)
  - `last_check_at`, `last_success_at`, `last_source` ('server'|'extension'|'manual'), `confidence` ('alta'|'media'|'baixa')
  - `consecutive_failures`, `consecutive_not_found`, `archived_at`
  - **unique (user_id, url_normalized)** e unique parcial (user_id, platform, listing_id_externo) quando não nulo → prevenção de duplicidade
- **apartment_snapshots** — cada verificação bem-sucedida ou não: apartment_id, checked_at, source, http_status, page_kind, campos lidos, `description_hash`, `images_hash`, `raw` (jsonb com o extraído), erro.
- **apartment_price_history** — apartment_id, recorded_at, rent, condo_fee, iptu, total_monthly, source. Uma linha por leitura de preço confiável (alimenta o gráfico).
- **apartment_status_history** — apartment_id, changed_at, from_status, to_status, evidence (texto), source.
- **apartment_changes** — apartment_id, detected_at, kind ('price_down'|'price_up'|'condo_change'|'iptu_change'|'status_change'|'description_change'|'features_change'|'images_change'), old_value, new_value, diff_abs, diff_pct, `dedupe_key` **unique**.
- **notifications** — user_id, change_id (nullable), kind, title, body, read_at, emailed_at, `dedupe_key` **unique**, channel_deliveries (jsonb, preparado p/ Telegram/WhatsApp).
- **monitoring_logs** — run_id, started_at, finished_at, trigger ('cron'|'manual'|'extension'), apartment_id, platform, http_status, duration_ms, outcome, error_message.

Índices: (user_id, status), (apartment_id, recorded_at desc) nos históricos, (user_id, read_at) em notifications, (started_at) em logs. Retenção: `raw` dos snapshots mantido por 90 dias (limpeza por cron) para caber no plano gratuito.

## 6. Regras de status

Enum: `ativo`, `possivelmente_alugado`, `indisponivel`, `removido`, `erro_acesso`, `verificacao_necessaria`, `nao_verificado`.

| Situação observada | Status resultante |
|---|---|
| 403, 429, página de desafio/CAPTCHA, timeout, erro de rede, 5xx | `erro_acesso` (status anterior de disponibilidade é **preservado** como "último conhecido") |
| 404/410 na 1ª vez | `verificacao_necessaria` |
| 404/410 em 2 verificações seguidas (≥ 12 h de intervalo) | `removido` |
| Página do anúncio com texto/flag explícito ("alugado", "anúncio encerrado", "não está mais disponível") | `possivelmente_alugado` ou `indisponivel`, com o trecho guardado em `evidence` |
| Página válida do anúncio com preço lido | `ativo` |
| Redireciona para busca/home sem o anúncio | `verificacao_necessaria` |
| Nunca verificado com sucesso | `nao_verificado` |

Volta de indisponível/removido → ativo gera notificação "voltou a ficar disponível".

## 7. Atualização e confiabilidade (exibidas em todo card e na página de detalhes)

Duas informações separadas:
1. **Última atualização**: "há 3 h · via servidor" / "há 2 dias · via extensão" / "há 9 dias · manual".
2. **Confiabilidade**:
   - **Alta** — preço lido de dado estruturado (JSON-LD / `__NEXT_DATA__`) e captura com até 36 h.
   - **Média** — lido de metadados/texto da página, ou dado estruturado com 36 h–7 dias.
   - **Baixa** — informado manualmente há mais de 7 dias, ou capturado há mais de 7 dias, ou só parte dos campos lida.
   - Sem dado → "Sem dados verificados" (nunca exibe valor como atual).

Valores com mais de 7 dias aparecem com o rótulo "último valor conhecido em DD/MM".

## 8. Notificações

- Geradas a partir de `apartment_changes`; `dedupe_key` (ex.: `apt:<id>:price:<old>-><new>`) impede repetição.
- Limiar configurável (ex.: só notificar variação ≥ R$ 50 ou ≥ 2%).
- Erros de acesso só notificam após 3 falhas seguidas (evita spam), uma vez.
- Canais: central no site (sino + página) e e-mail (Resend, plano gratuito, remetente de teste para o próprio e-mail; domínio próprio opcional depois). Camada `NotificationChannel` com implementação `email` e `in_app`; Telegram/WhatsApp entram como novas implementações.
- Resumo diário por e-mail: total monitorado, quantos mudaram de preço, quantos ficaram indisponíveis, top 3 oportunidades e **lista de anúncios "via extensão" que precisam ser abertos** (sem atualização há > 3 dias).

## 9. Indicador de oportunidade

Pontuação 0–100, fórmula explícita e exibida ao usuário ("como calculamos"):
- 40% — total mensal comparado à mediana dos imóveis monitorados com o mesmo nº de quartos;
- 20% — redução de preço nos últimos 14 dias;
- 20% — prioridade definida pelo usuário;
- 20% — custo por m² (se área informada; senão o peso é redistribuído).
Faixas: ≥ 75 Excelente · 55–74 Boa · 35–54 Dentro do esperado · < 35 Pouco interessante. Sempre com o aviso: "Estimativa baseada nos critérios cadastrados, não é avaliação imobiliária profissional." Exige pelo menos 3 imóveis comparáveis; abaixo disso, mostra "Dados insuficientes para comparar".

## 10. Interface

Referências: grade de cards com foto (estilo Housepin) + menu lateral (estilo RocketRent). Paleta: fundo claro, grafite, branco, verde discreto (oportunidade/redução), roxo/índigo como destaque. Tema escuro.
Páginas: Login · Dashboard · Meus Apartamentos (grade + filtros) · Detalhes do imóvel · Notificações · Configurações (preferências, conectar extensão, status das integrações).
Card: foto, nome, bairro/cidade, aluguel, condomínio, IPTU, total mensal, quartos, vagas, selo de status (cores: verde redução, vermelho aumento, amarelo verificação, cinza indisponível), selo de modo (Servidor / Extensão / Manual), última atualização + confiabilidade.
Integrações não configuradas (Resend, extensão não conectada, cron não ativo) aparecem como avisos claros em Configurações e no dashboard.

## 11. Segurança

- Supabase Auth (e-mail + senha); cadastro público desabilitado após criar a conta do usuário.
- Middleware do Next.js protege todas as rotas internas.
- RLS em todas as tabelas; service role só em rotas do servidor.
- Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `EXTENSION_ID`.
- Validação de links: apenas http/https, sem IP privado/localhost (proteção SSRF), tamanho máximo de resposta, timeout.
- Validação de payloads com zod; limite de taxa nas rotas de refresh e captura.

## 12. Etapas de implementação

Cada etapa termina com testes automatizados + teste guiado pelo usuário antes da próxima.

1. **Fundação** — git, monorepo, Next.js + Tailwind + shadcn/ui, projeto Supabase, migrações (todas as tabelas + RLS + índices), login/logout, proteção de rotas, layout (menu lateral, topo, tema claro/escuro), dashboard e lista com estados vazios. *Teste:* login, bloqueio sem login, RLS (usuário não lê dados de outro).
2. **Cadastro + extração** — `packages/core` (normalização de URL, detecção de plataforma, adaptadores QuintoAndar, Chaves na Mão e genérico), formulário "+ Adicionar apartamento" com pré-preenchimento, bloqueio de duplicados, cards com modo/status/confiabilidade. *Teste:* fixtures + links reais do usuário; teste de acesso a partir do servidor.
3. **Monitoramento no servidor** — pipeline de mudanças, regras de status, snapshots, históricos, logs, `/api/cron/monitor`, agendamento pg_cron, "Atualizar anúncio agora" (modo automático), atualização manual rápida.
4. **Extensão do Chrome** — MV3, conexão com o login do site, content scripts, adaptadores OLX/ZAP/Viva Real/Imovelweb (feitos a partir de páginas reais abertas pelo usuário), rota de captura, "Atualizar agora" (modo extensão). *Teste:* instalar sem empacotar (modo desenvolvedor) e capturar anúncios reais.
5. **Detalhes + histórico + oportunidade** — página do imóvel, gráfico de preço, inicial/atual/mín./máx., % desde o cadastro, linha do tempo, observações, indicador de oportunidade.
6. **Dashboard completo** — indicadores, timeline de novidades, oportunidades, saúde do monitoramento.
7. **Notificações** — central no site, e-mail (Resend), deduplicação, limiares, resumo diário.
8. **Polimento e produção** — animações, revisão mobile, deploy na Vercel, configuração do cron em produção, guia de configuração (Supabase, Vercel, Resend, extensão).

## 12.1 Achados com links reais (2026-11-20) — valem para a Etapa 2

Cidades de interesse: **Curitiba** e **São José dos Pinhais (PR)**. Plataformas usadas: ZAP (4 de 6 links) e Chaves na Mão (2 de 6). Usuário decidiu **manter a ordem das etapas** (extensão continua na Etapa 4).

- **Chaves na Mão** (servidor acessa, HTTP 200): JSON-LD `@graph` com `RealEstateListing` → `offers` (`Offer.price`, `priceCurrency`, `availability` schema.org/InStock) → `itemOffered` (`numberOfBedrooms`, `numberOfBathroomsTotal`, `floorSize.value`, `address.addressLocality` = "Bairro, Cidade", `addressRegion`, `geo`) e `about.image[]`. ID externo no caminho: `/id-<n>/`. Condomínio/IPTU **não** têm campo estruturado: só aparecem no texto da descrição ("Condomínio R$ 270,00") → lidos por regex com confiabilidade **média**. Vagas também não têm campo estruturado (aparecem no texto/URL "com-garagem").
- **ZAP** (servidor bloqueado, HTTP 403 desafio): nada é buscado. O próprio link traz dados: `/imovel/aluguel-apartamento-<N>-quartos-…-<cidade>-pr-<M>m2-id-<ID>/` → quartos, área, cidade (por lista de cidades conhecidas), ID externo. Bairro **não** é extraído do link (as palavras de característica variam e tornariam o palpite não confiável). Preço/condomínio/IPTU: digitados pelo usuário até a extensão existir. Campos lidos do link têm origem "link".
- Origem de cada campo exibida no formulário: **anúncio** (lido da página), **link** (lido da URL), **você** (digitado).

## 12.2 Decisões da Etapa 3 (2026-11-20)

- Código no GitHub **público** `Brksdaniel/plano-casa` (escolha explícita do usuário; nenhum segredo versionado) + projeto Vercel importado do repositório (root `apps/web`). Deploy automático a cada push na `main`.
- Agendamento: `pg_cron` **a cada hora** chama `/api/cron/monitor`; cada execução processa até 8 imóveis em modo `auto` cuja última tentativa tem mais de 6 h (cada imóvel é verificado ~4×/dia sem estourar o tempo de função da Vercel). Vercel Cron 1×/dia como reserva. URL e segredo do cron ficam no **Vault** do Supabase.
- O cron grava com a chave secreta do Supabase (`SUPABASE_SECRET_KEY`, só no servidor). O usuário copia essa chave para o `.env.local` e para a Vercel; o assistente nunca a manipula.
- Lógica pura no core (`packages/core`): `detectChanges` e `nextStatus` (regras do §6, contadores de falhas/404). Reutilizável pela extensão.
- Histórico de preço: nova linha quando aluguel/condomínio/IPTU mudam **ou** se a última linha tem mais de 20 h (gráfico diário sem inflar o banco).
- Valores lidos da página atualizam o imóvel; valores que o usuário digitou só são substituídos quando a página trouxer o campo com confiança (`jsonld`/`text`/`meta`).
- Após 3 falhas de acesso seguidas, imóvel `auto` passa para `extension` (e o motivo fica no histórico de status).
- "Atualizar anúncio agora": modo `auto` → verificação imediata (mín. 10 min entre verificações); `extension` → abre o anúncio + atualização manual; `manual` → atualização manual rápida (aluguel, condomínio, IPTU, disponibilidade) que gera snapshot `manual`, histórico e mudanças.
- Cards ganham variação de preço (verde ▼ / vermelho ▲, R$ e %) pela view `tracker.apartment_price_trend` (security_invoker).

## 13. Decisões pendentes do usuário
- ~~Projeto Supabase~~ → decidido: schema `tracker` no projeto `sistema-salas`.
- Confirmar se o sistema-salas usará login no futuro (afeta desativar cadastro público).
- Links reais de anúncios (2–3 por plataforma usada) e cidade.
- Conta Resend (Etapa 7).

## 14. Chamadas feitas pelo assistente (revisáveis)
- Monitoramento roda em rotas Node na Vercel (não em Edge Functions do Supabase) para compartilhar `packages/core` com a extensão num único runtime TypeScript.
- Agendamento por pg_cron a cada 6 h; Vercel Cron como reserva.
- npm workspaces (sem instalar pnpm).
- Campo extra `area_m2` (opcional) para custo por m².
- Retenção de 90 dias do JSON bruto dos snapshots.
- Rebaixar para "via extensão" após 3 bloqueios seguidos.
