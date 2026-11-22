# DENIELS HOME TRACKER — Guia de uso e configuração

Site: **https://web-two-pi-26.vercel.app**

Este guia explica como usar o sistema no dia a dia, o que fazer quando algo aparece estranho e como configurar o que ainda depende de você (e-mail e segurança da conta).

---

## 1. Como o sistema funciona

Você cadastra o **link** de um anúncio, e o Deniels passa a acompanhar preço e disponibilidade. Cada imóvel tem um **modo de monitoramento**:

| Modo | Como atualiza | Plataformas |
|---|---|---|
| **Servidor** | Sozinho: o servidor lê o anúncio a cada ~6 h (rodada de hora em hora) | Chaves na Mão, QuintoAndar, sites que permitem leitura |
| **Extensão** | Quando você abre o anúncio no Chrome com a extensão conectada | ZAP, Viva Real, OLX, Imovelweb (bloqueiam servidores) |
| **Manual** | Você informa os valores pelo botão "Atualizar manualmente" | Qualquer site |

Se um site do modo Servidor bloquear 3 vezes seguidas, o imóvel passa sozinho para o modo Extensão.

**O sistema nunca inventa dados.** Bloqueio, CAPTCHA ou erro de rede viram "Erro de acesso", **nunca** "alugado". Um anúncio só é marcado como **removido** depois de 2 leituras "página não encontrada" com pelo menos 12 h de intervalo.

Cada card mostra:
- **Atualizado há X · via servidor/extensão/manual**: quando foi o último dado válido e de onde veio.
- **Confiabilidade**:
  - **Alta**: dado estruturado do anúncio, com até 36 h.
  - **Média**: lido do texto da página, ou com 36 h a 7 dias.
  - **Baixa**: valor manual antigo ou dado incompleto.

## 2. Uso diário

1. **Adicionar:** "+ Adicionar apartamento" → cole o link → confira os campos lidos → Salvar. Links repetidos são bloqueados.
2. **Pela extensão:** num anúncio que você ainda não acompanha, aparece "+ Adicionar ao Deniels" no canto da tela.
3. **Atualizar:**
   - Modo Servidor: botão **"Atualizar anúncio agora"** no detalhe (uma vez a cada 10 min).
   - Modo Extensão: basta abrir o anúncio. O selo verde "✓ Atualizado no Deniels" confirma a leitura.
   - Qualquer modo: **"Atualizar manualmente"**.
4. **Painel (Dashboard):** indicadores, novidades, melhores oportunidades e a **saúde do monitoramento**. Lá fica a lista "Abra para atualizar", com os anúncios via extensão que estão há mais de 3 dias sem leitura.
5. **Detalhe do imóvel:**
   - Gráfico do preço com valores inicial, atual, mínimo e máximo, e a variação desde o cadastro.
   - Indicador de oportunidade.
   - Linha do tempo.
   - Botão **"Editar"**, para nome, prioridade (1 a 5 estrelas) e observações.
6. **Meus Apartamentos:** filtros por situação (Disponíveis / Precisam de atenção / Indisponíveis), por modo, por busca e por ordem (menor total, melhor oportunidade, prioridade).

### Indicador de oportunidade (0–100)

**Pesos:**
- **40%**: total mensal comparado à mediana dos seus imóveis com o mesmo nº de quartos.
- **20%**: queda de preço nos últimos 14 dias.
- **20%**: sua prioridade.
- **20%**: custo por m², quando há área informada. Sem área, esse peso é redistribuído entre os outros três.

**Regras:**
- Só é calculado com **pelo menos 3 imóveis ativos com o mesmo nº de quartos**. Com menos, aparece "Dados insuficientes".
- Quando condomínio ou IPTU não foram informados, o total fica menor do que é. O site avisa que a nota pode estar otimista.

**Faixas:** ≥ 75 Excelente · 55–74 Boa · 35–54 Dentro do esperado · < 35 Pouco interessante.

> Estimativa baseada nos critérios cadastrados, não é avaliação imobiliária profissional.

## 3. Notificações

Aparecem no **sino** (com o número de não lidas) e na página **Notificações**. São geradas de hora em hora a partir das mudanças detectadas.

**Geram aviso:**
- Queda ou aumento de aluguel, mudança de condomínio ou IPTU, se a variação passar do limite configurado (padrão: R$ 50 **ou** 2%).
- Anúncio com status "pode ter sido alugado", indisponível ou removido.
- Anúncio que voltou a ficar disponível.
- Mudança nas características (quartos, área…).
- Falha de acesso, só depois de 3 tentativas seguidas e uma vez por sequência.

**Não geram aviso:** mudança só de descrição ou de fotos. Elas ficam apenas na linha do tempo do imóvel.

**Resumo diário:**
- Sai no horário escolhido em Configurações (padrão 08:00, horário de Brasília).
- Traz os números do dia, as 3 melhores oportunidades e os anúncios via extensão que precisam ser abertos.

Ajuste tudo em **Configurações → Notificações**.

## 4. Configurar o e-mail (Resend) — **pendente, feito por você**

Sem isso, os avisos continuam aparecendo no site. Só o envio por e-mail fica desligado.

1. Crie uma conta grátis em https://resend.com, **com o mesmo e-mail que vai receber os avisos**. O remetente de teste do Resend só entrega para o dono da conta.
2. No Resend, vá em **API Keys → Create API Key**, com permissão "Sending access", e copie a chave (`re_...`).
3. Na Vercel, abra **Project "web" → Settings → Environment Variables** e adicione:
   - `RESEND_API_KEY` = a chave, marcada como **Sensitive**, nos ambientes Production e Preview.
   - Opcional: `NOTIFY_FROM_EMAIL`, só se você verificar um domínio próprio no Resend. Sem ele, o remetente é `Deniels Home Tracker <onboarding@resend.dev>`.
4. Na Vercel, abra **Deployments** e clique em **⋯ → Redeploy** no último deploy. Variáveis novas só valem depois de um deploy.
5. No site, em **Configurações → Notificações**, confira seu e-mail, salve e clique em **"Enviar e-mail de teste"**.

## 5. Extensão do Chrome

**Instalar:**
1. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `apps/extension/dist`. Para gerá-la de novo: `npm run build -w extension`.
3. Confira se o ID é `kgkohdkeodonnmfoffdebaciojpbokcj`.

**Conectar:** no site, vá em **Configurações → Conectar extensão**. A conexão é feita uma vez só por navegador.

**O que ela faz e o que não faz:**
- Só **lê a página que você abriu**.
- Não clica, não navega e não faz nada em páginas de CAPTCHA.
- Permissões: só armazenamento local, e rede apenas para o seu site e o Supabase.

**Atualizar a extensão depois de mudanças no código:**
1. Rode `npm run build -w extension`.
2. Em `chrome://extensions`, clique em **↻** no cartão da extensão.

## 6. Segurança da conta — **recomendado, feito por você**

No painel do Supabase (projeto `sistema-salas`):

1. **Desativar novos cadastros:** **Authentication → Sign In / Providers**, desligue **"Allow new users to sign up"**. Antes, confirme que o sistema-salas não precisa de cadastro público.
2. **Proteção contra senhas vazadas:** **Authentication → Attack Protection → "Leaked password protection"**.
3. **Trocar os segredos que apareceram na conversa de desenvolvimento:**
   1. Supabase → **Project Settings → API Keys**: crie uma nova *secret key* e atualize `SUPABASE_SECRET_KEY` na Vercel e no `apps/web/.env.local`. Só apague a chave antiga depois de confirmar que o sistema-salas não a usa.
   2. Gere um novo `CRON_SECRET` com `openssl rand -hex 32` e atualize-o em dois lugares: na Vercel e no Vault do Supabase (`select vault.update_secret((select id from vault.secrets where name = 'tracker_cron_secret'), '<novo>');`).
   3. Faça o Redeploy.

## 7. Manutenção e problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Erro de acesso" num anúncio | O site bloqueou ou não respondeu. Não significa alugado. Abra o anúncio (se for modo Extensão) ou atualize manualmente. |
| "Verificação necessária" | A página não foi encontrada uma vez. O sistema confirma de novo em 12 h antes de marcar como removido. |
| Selo da extensão diz "Conecte a extensão" | Configurações → Conectar extensão (a sessão expirou ou foi desconectada). |
| Selo "Não foi possível atualizar: O site respondeu 4xx" | Me mande print. Provavelmente o site mudou o formato da página. |
| Monitoramento "Aguardando" há muito tempo | Supabase → Integrations → Cron: confira o job `tracker-monitor-hourly`. Na Vercel, confira se `CRON_SECRET` e `SUPABASE_SECRET_KEY` existem. |
| Nenhum e-mail chega | Veja o item 4. Use "Enviar e-mail de teste" e confira o spam. |

**Rotinas automáticas:**
- **Cron de hora em hora (pg_cron):** verifica até 8 imóveis por rodada, gera as notificações e o resumo, e apaga o JSON bruto das leituras com mais de 90 dias.
- **Reserva diária (Vercel Cron, 09:00 UTC):** a mesma rota.

## 8. Para desenvolvedores

```
apps/web         Next.js 16 (site + API + cron)
apps/extension   Extensão Chrome MV3 (esbuild)
packages/core    Leitura de anúncios, regras de status e mudanças (compartilhado)
supabase/        Migrações (schema tracker) e checagem de RLS
docs/            Este guia e o documento de design
```

**Comandos (na raiz):**
- `npm run dev -w web`: site local em http://localhost:3000.
- `npm test --workspaces`: testes de todos os pacotes.
- `npm run typecheck --workspaces --if-present` e `npm run lint`.
- `npm run build -w extension`: gera `apps/extension/dist`.

**Deploy:** cada push no `main` publica na Vercel automaticamente. As variáveis de ambiente estão listadas em `apps/web/.env.example`.
