# Marquez CRM

CRM da agência Marquez: todos os contatos num lugar, funil de leads, prospecção na rua e no WhatsApp,
execução dos serviços de cada cliente, cursos para a equipe e área do cliente com aulas semanais.

**Stack:** React + Vite + TypeScript + Tailwind · Supabase (Postgres, Auth, Edge Functions) · PWA com Web Push.
É um sistema separado do Marquez Placas, com **banco próprio** (outro projeto no Supabase).

## Quem usa

| Papel | O que vê |
| --- | --- |
| **Admin** (dono) | Tudo. Define metas, cria cursos, convida equipe e clientes. O primeiro usuário vira admin. |
| **Equipe** | Contatos, leads, prospecção, clientes (execução) e a Academia. |
| **Cliente** | Só a área dele: andamento do serviço, mural de recados e as aulas liberadas para ele. |

## O que tem

| Área | O que faz |
| --- | --- |
| **Visão geral** | Fechado no mês × meta (com ritmo), recorrente (MRR), contratos, reuniões, ticket médio, conversão, funil aberto, agenda dos próximos 7 dias, leads parados, tarefas atrasadas e ranking da equipe. |
| **Contatos** | Agenda única: empresa, WhatsApp, e-mail, Instagram, segmento, origem, etiquetas e anotações. Daqui cria lead ou torna cliente. |
| **Leads** | Kanban (arrastar) e lista. Etapas: Novo → Contato feito → Reunião agendada → Proposta enviada → Negociação → Ganho / Perdido. Valor do projeto + mensalidade, temperatura, reunião, responsável, histórico. |
| **Ganho = cliente** | Ao mover para *Ganho*, o banco cria o cliente e o serviço (em onboarding) automaticamente, e a equipe recebe a notificação de contrato fechado. |
| **Prospecção** | *Na rua* (mapa, regiões com mais lojas, rota otimizada) e *No X1* (WhatsApp com roteiro pronto para agência). “Virou lead” manda o negócio direto para o funil. |
| **Clientes** | Cada serviço com status, prazo, valores e checklist de execução (modelo pronto por tipo de serviço). Tarefas com responsável, prazo e “cliente vê”. Mural de atualizações com links. |
| **Academia** | Cursos *da equipe* (todos veem tudo) e *dos clientes* (cada aula libera na semana N contada do início do cliente). Vídeo do YouTube, Vimeo, Loom ou Drive, material de apoio, “concluída” e quem assistiu. |
| **Área do cliente** | `/cliente`: progresso do projeto, etapas, mural (o cliente também manda recado), aula da semana. |
| **Ajustes** | Notificações, perfil, metas do mês, chaves da busca (TomTom / Google) e equipe. |

## Colocando no ar

### 1. Supabase

1. Crie um **projeto novo** em [supabase.com](https://supabase.com).
2. Rode as migrações de `supabase/migrations/` **em ordem** (SQL Editor, ou `supabase db push`).
3. **Authentication → Sign In / Providers:** desative *Allow new users to sign up* (entrada só por convite).
4. **Authentication → URL Configuration:** *Site URL* = endereço do app; em *Redirect URLs* adicione `https://SEU-APP/definir-senha`.
5. Crie o **primeiro usuário** em *Authentication → Users → Add user*. Ele vira **admin**.
   A equipe você convida em Ajustes; cada cliente, na página do cliente (“Convidar o cliente”).

> Para muitos convites, configure um SMTP próprio em *Authentication → Emails → SMTP Settings*.

### 2. Notificações (VAPID) no Vault

```bash
npx web-push generate-vapid-keys
openssl rand -hex 32
```

```sql
select vault.create_secret('<chave pública VAPID>', 'vapid_publica');
select vault.create_secret('<chave privada VAPID>', 'vapid_privada');
select vault.create_secret('mailto:contato@seudominio.com.br', 'vapid_contato');
select vault.create_secret('<segredo aleatório>', 'notificar_segredo');
select vault.create_secret('https://SEU-PROJETO.supabase.co/functions/v1/notificar', 'notificar_url');
```

### 3. Edge Functions

```bash
supabase link --project-ref SEU-PROJETO
supabase functions deploy notificar --no-verify-jwt
supabase functions deploy gerenciar-usuarios
supabase functions deploy buscar-negocios
```

### 4. App

Copie `.env.example` para `.env` e preencha a URL, a chave pública e a chave VAPID **pública**:

```bash
npm install
npm run build
```

**Na Vercel:** cadastre as três variáveis `VITE_` em *Settings → Environment Variables* e faça um novo deploy.
O `vercel.json` já manda todas as rotas para o `index.html`.

## Regras que ficam no banco

- RLS em todas as tabelas. “Membro” = admin ou equipe; cliente nunca vê contatos, leads, metas nem outros clientes.
- Cliente só vê o próprio cliente, os serviços dele, tarefas marcadas como visíveis e o mural visível; pode escrever recado.
- Aulas de cursos para clientes liberam por semana (`aula_liberada`), contando de `clientes.inicio`.
- Lead ganho cria cliente + serviço (`leads_registrar`); toda mudança de etapa vai para o histórico.
- Só admin muda papéis/vínculos, gerencia cursos e metas e exclui registros.
- Notificação nunca bloqueia o fechamento.

## Testes

- Banco: `supabase/tests/` — num Postgres local, rode `stub_supabase.sql`, as migrações 1, 2 e 5 (sem a linha
  `create extension`) e `testes_schema.sql`. As migrações 3 e 4 dependem das extensões do Supabase.
- Mensagens das notificações: `deno test supabase/functions/notificar`.
- `npm run lint` e `npm run build`.
