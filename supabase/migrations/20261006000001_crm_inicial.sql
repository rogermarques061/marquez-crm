-- =====================================================================
-- Marquez CRM — schema inicial
--
-- Quem usa:
--   admin  → dono da agência: tudo, inclusive equipe, metas e cursos
--   equipe → funcionários: contatos, leads, prospecção, clientes e cursos da equipe
--   cliente→ cliente da agência: só a área dele (serviço, tarefas, atualizações e aulas)
--
-- Fluxo: contato → lead (funil) → ganho → vira cliente com um serviço em execução.
-- Todas as tabelas com Row Level Security.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.papel_usuario    as enum ('admin', 'equipe', 'cliente');
create type public.etapa_lead       as enum (
  'novo', 'contato_feito', 'reuniao_agendada', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'
);
create type public.temperatura_lead as enum ('quente', 'morno', 'frio');

-- Serviços que a agência vende (lead, serviço do cliente)
create or replace function public.tipo_servico_valido(p text)
returns boolean
language sql immutable set search_path = public
as $$
  select p in ('site', 'trafego', 'social_media', 'identidade_visual', 'google_meu_negocio', 'consultoria', 'mentoria', 'outro');
$$;

-- ---------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  nome                text not null default '',
  email               text,
  papel               public.papel_usuario not null default 'cliente',
  notificacoes_ativas boolean not null default false,
  created_at          timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and papel = 'admin');
$$;

-- "Membro" = gente da agência (admin ou equipe). Cliente não é membro.
create or replace function public.is_membro()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and papel in ('admin', 'equipe'));
$$;

-- O primeiro usuário vira admin. Os demais nascem como "cliente" sem cliente
-- vinculado (não veem nada) até o convite definir o papel.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.profiles) then 'cliente'::public.papel_usuario
         else 'admin'::public.papel_usuario end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- contatos: a agenda da agência (todo mundo com quem a agência fala)
-- ---------------------------------------------------------------------
create table public.contatos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (char_length(trim(nome)) between 1 and 120),
  empresa         text check (empresa is null or char_length(empresa) <= 120),
  whatsapp        text check (whatsapp is null or whatsapp ~ '^[0-9]{10,11}$'),  -- só dígitos, com DDD
  email           text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  instagram       text check (instagram is null or char_length(instagram) <= 60),
  segmento        text check (segmento is null or char_length(segmento) <= 60),
  cidade          text check (cidade is null or char_length(cidade) <= 80),
  origem          text not null default 'outro'
                  check (origem in ('indicacao', 'instagram', 'google', 'site', 'prospeccao_rua', 'prospeccao_x1', 'evento', 'outro')),
  tags            text[] not null default '{}',
  anotacoes       text,
  responsavel_id  uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index contatos_nome_idx on public.contatos (lower(nome));
create unique index contatos_whatsapp_unico on public.contatos (whatsapp) where whatsapp is not null;

-- ---------------------------------------------------------------------
-- clientes (contatos que fecharam) — vem antes de profiles.cliente_id
-- ---------------------------------------------------------------------
create table public.clientes (
  id              uuid primary key default gen_random_uuid(),
  contato_id      uuid not null unique references public.contatos (id) on delete restrict,
  nome            text not null check (char_length(trim(nome)) between 1 and 120),
  status          text not null default 'ativo' check (status in ('ativo', 'pausado', 'encerrado')),
  inicio          date not null default (now() at time zone 'America/Sao_Paulo')::date,
  responsavel_id  uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- (anotações internas ficam no contato, que o cliente não enxerga)

-- Usuário com papel "cliente" enxerga só o cliente vinculado aqui.
alter table public.profiles add column cliente_id uuid references public.clientes (id) on delete set null;

create or replace function public.meu_cliente_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select cliente_id from public.profiles where id = auth.uid() and papel = 'cliente';
$$;

-- Só admin muda papel ou vínculo de cliente (inclusive o próprio).
create or replace function public.proteger_papel()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.papel is distinct from old.papel or new.cliente_id is distinct from old.cliente_id)
     and auth.uid() is not null          -- service role / SQL direto passam
     and not public.is_admin() then
    raise exception 'Apenas administradores podem alterar papéis';
  end if;
  return new;
end;
$$;

create trigger profiles_proteger_papel
  before update on public.profiles
  for each row execute function public.proteger_papel();

alter table public.profiles enable row level security;

-- Cliente vê o próprio perfil e os nomes da equipe (responsáveis).
create policy "perfis visiveis"
  on public.profiles for select to authenticated
  using (public.is_membro() or id = auth.uid() or papel in ('admin', 'equipe'));

create policy "usuario edita o proprio perfil"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "admin edita qualquer perfil"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin remove perfis"
  on public.profiles for delete to authenticated
  using (public.is_admin());

-- updated_at genérico
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger contatos_updated_at before update on public.contatos
  for each row execute function public.tocar_updated_at();
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tocar_updated_at();

alter table public.contatos enable row level security;
alter table public.clientes enable row level security;

create policy "membros usam contatos" on public.contatos for all to authenticated
  using (public.is_membro()) with check (public.is_membro());

create policy "membros veem clientes" on public.clientes for select to authenticated
  using (public.is_membro() or id = public.meu_cliente_id());
create policy "membros criam clientes" on public.clientes for insert to authenticated
  with check (public.is_membro());
create policy "membros editam clientes" on public.clientes for update to authenticated
  using (public.is_membro()) with check (public.is_membro());
create policy "admin exclui clientes" on public.clientes for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- leads (funil comercial)
-- ---------------------------------------------------------------------
create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  contato_id       uuid not null references public.contatos (id) on delete cascade,
  titulo           text check (titulo is null or char_length(titulo) <= 120),  -- ex.: "Site + tráfego"
  servico          text not null default 'site' check (public.tipo_servico_valido(servico)),
  etapa            public.etapa_lead not null default 'novo',
  temperatura      public.temperatura_lead not null default 'morno',
  responsavel_id   uuid references public.profiles (id) on delete set null,
  data_reuniao     timestamptz,
  valor_projeto    numeric(10,2) not null default 0 check (valor_projeto >= 0),  -- pagamento único
  valor_mensal     numeric(10,2) not null default 0 check (valor_mensal >= 0),   -- recorrente
  motivo_perda     text,
  anotacoes        text,
  posicao          double precision not null default 0,
  ganho_em         timestamptz,
  perdido_em       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index leads_etapa_idx on public.leads (etapa, posicao);
create index leads_contato_idx on public.leads (contato_id);
create index leads_ganho_idx on public.leads (ganho_em) where etapa = 'ganho';

create table public.lead_historico (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.leads (id) on delete cascade,
  etapa_anterior public.etapa_lead,
  etapa_nova     public.etapa_lead not null,
  usuario_id     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index lead_historico_lead_idx on public.lead_historico (lead_id, created_at);

-- ---------------------------------------------------------------------
-- serviços do cliente (o que a agência entrega) e a execução
-- ---------------------------------------------------------------------
create table public.servicos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes (id) on delete cascade,
  lead_id         uuid unique references public.leads (id) on delete set null,
  nome            text not null check (char_length(trim(nome)) between 1 and 120),
  tipo            text not null default 'site' check (public.tipo_servico_valido(tipo)),
  descricao       text,
  status          text not null default 'onboarding'
                  check (status in ('onboarding', 'em_execucao', 'em_revisao', 'entregue', 'pausado', 'cancelado')),
  valor_projeto   numeric(10,2) not null default 0 check (valor_projeto >= 0),
  valor_mensal    numeric(10,2) not null default 0 check (valor_mensal >= 0),
  inicio          date not null default (now() at time zone 'America/Sao_Paulo')::date,
  prazo           date,
  responsavel_id  uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index servicos_cliente_idx on public.servicos (cliente_id);

create table public.tarefas (
  id               uuid primary key default gen_random_uuid(),
  servico_id       uuid not null references public.servicos (id) on delete cascade,
  titulo           text not null check (char_length(trim(titulo)) between 1 and 160),
  descricao        text,
  status           text not null default 'a_fazer' check (status in ('a_fazer', 'fazendo', 'feito')),
  responsavel_id   uuid references public.profiles (id) on delete set null,
  prazo            date,
  visivel_cliente  boolean not null default true,
  posicao          double precision not null default 0,
  concluida_em     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index tarefas_servico_idx on public.tarefas (servico_id, posicao);
create index tarefas_abertas_idx on public.tarefas (prazo) where status <> 'feito';

-- Diário do serviço: o que foi feito, entregas, recados (cliente também escreve)
create table public.atualizacoes (
  id               uuid primary key default gen_random_uuid(),
  servico_id       uuid not null references public.servicos (id) on delete cascade,
  autor_id         uuid references public.profiles (id) on delete set null default auth.uid(),
  texto            text not null check (char_length(trim(texto)) between 1 and 4000),
  link             text check (link is null or link ~ '^https?://'),
  visivel_cliente  boolean not null default true,
  created_at       timestamptz not null default now()
);

create index atualizacoes_servico_idx on public.atualizacoes (servico_id, created_at desc);

create trigger servicos_updated_at before update on public.servicos
  for each row execute function public.tocar_updated_at();

create or replace function public.tarefas_before_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'feito' and (tg_op = 'INSERT' or old.status <> 'feito') then
    new.concluida_em := now();
  elsif new.status <> 'feito' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

create trigger tarefas_before_write before insert or update on public.tarefas
  for each row execute function public.tarefas_before_write();

-- Lead criado => histórico. Mudou de etapa => histórico + datas.
-- Ganhou => contato vira cliente (se ainda não for) e o serviço já nasce em onboarding.
create or replace function public.leads_registrar()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_contato public.contatos;
  v_cliente uuid;
begin
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    insert into public.lead_historico (lead_id, etapa_anterior, etapa_nova, usuario_id)
    values (new.id, case when tg_op = 'UPDATE' then old.etapa end, new.etapa, auth.uid());
  end if;

  if new.etapa = 'ganho' and (tg_op = 'INSERT' or old.etapa is distinct from 'ganho') then
    select * into v_contato from public.contatos where id = new.contato_id;

    insert into public.clientes (contato_id, nome, responsavel_id)
    values (v_contato.id, coalesce(nullif(trim(v_contato.empresa), ''), v_contato.nome), new.responsavel_id)
    on conflict (contato_id) do update set status = 'ativo'
    returning id into v_cliente;

    insert into public.servicos (cliente_id, lead_id, nome, tipo, valor_projeto, valor_mensal, responsavel_id)
    values (
      v_cliente, new.id,
      coalesce(nullif(trim(new.titulo), ''), public.rotulo_servico(new.servico)),
      new.servico, new.valor_projeto, new.valor_mensal, new.responsavel_id
    )
    on conflict (lead_id) do update set status = case when servicos.status = 'cancelado' then 'onboarding' else servicos.status end;
  end if;
  return new;
end;
$$;

create or replace function public.rotulo_servico(p text)
returns text
language sql immutable set search_path = public
as $$
  select case p
    when 'site' then 'Site'
    when 'trafego' then 'Tráfego pago'
    when 'social_media' then 'Social media'
    when 'identidade_visual' then 'Identidade visual'
    when 'google_meu_negocio' then 'Google Meu Negócio'
    when 'consultoria' then 'Consultoria'
    when 'mentoria' then 'Mentoria'
    else 'Serviço' end;
$$;

create or replace function public.leads_before_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    new.ganho_em   := case when new.etapa = 'ganho'   then coalesce(new.ganho_em, now()) end;
    new.perdido_em := case when new.etapa = 'perdido' then coalesce(new.perdido_em, now()) end;
  end if;
  return new;
end;
$$;

create trigger leads_before_write
  before insert or update on public.leads
  for each row execute function public.leads_before_write();

create trigger leads_registrar
  after insert or update of etapa on public.leads
  for each row execute function public.leads_registrar();

alter table public.leads enable row level security;
alter table public.lead_historico enable row level security;
alter table public.servicos enable row level security;
alter table public.tarefas enable row level security;
alter table public.atualizacoes enable row level security;

create policy "membros veem leads" on public.leads for select to authenticated using (public.is_membro());
create policy "membros criam leads" on public.leads for insert to authenticated with check (public.is_membro());
create policy "membros editam leads" on public.leads for update to authenticated
  using (public.is_membro()) with check (public.is_membro());
create policy "admin exclui leads" on public.leads for delete to authenticated using (public.is_admin());

-- Histórico é só leitura; quem escreve são os triggers.
create policy "membros veem historico" on public.lead_historico for select to authenticated using (public.is_membro());

create policy "servicos visiveis" on public.servicos for select to authenticated
  using (public.is_membro() or cliente_id = public.meu_cliente_id());
create policy "membros criam servicos" on public.servicos for insert to authenticated with check (public.is_membro());
create policy "membros editam servicos" on public.servicos for update to authenticated
  using (public.is_membro()) with check (public.is_membro());
create policy "admin exclui servicos" on public.servicos for delete to authenticated using (public.is_admin());

create policy "tarefas visiveis" on public.tarefas for select to authenticated
  using (
    public.is_membro()
    or (visivel_cliente and exists (select 1 from public.servicos s where s.id = servico_id and s.cliente_id = public.meu_cliente_id()))
  );
create policy "membros gerenciam tarefas" on public.tarefas for all to authenticated
  using (public.is_membro()) with check (public.is_membro());

create policy "atualizacoes visiveis" on public.atualizacoes for select to authenticated
  using (
    public.is_membro()
    or (visivel_cliente and exists (select 1 from public.servicos s where s.id = servico_id and s.cliente_id = public.meu_cliente_id()))
  );
create policy "membros escrevem atualizacoes" on public.atualizacoes for insert to authenticated
  with check (public.is_membro() and autor_id = auth.uid());
-- Cliente manda recado no próprio serviço (sempre visível para os dois lados)
create policy "cliente escreve no proprio servico" on public.atualizacoes for insert to authenticated
  with check (
    autor_id = auth.uid() and visivel_cliente
    and exists (select 1 from public.servicos s where s.id = servico_id and s.cliente_id = public.meu_cliente_id())
  );
create policy "autor ou admin apaga atualizacao" on public.atualizacoes for delete to authenticated
  using (autor_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Academia: cursos para a equipe e para os clientes
-- ---------------------------------------------------------------------
create table public.cursos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(trim(titulo)) between 1 and 120),
  descricao   text,
  publico     text not null check (publico in ('equipe', 'clientes')),
  publicado   boolean not null default false,
  posicao     double precision not null default 0,
  created_at  timestamptz not null default now()
);

create table public.aulas (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos (id) on delete cascade,
  titulo        text not null check (char_length(trim(titulo)) between 1 and 160),
  descricao     text,
  video_url     text check (video_url is null or video_url ~ '^https?://'),
  material_url  text check (material_url is null or material_url ~ '^https?://'),
  -- Curso de clientes: a aula libera na semana N contada do início do cliente
  -- (semana 1 = já no primeiro dia). Vazio = liberada para todos desde já.
  semana        integer check (semana is null or semana between 1 and 520),
  duracao_min   integer check (duracao_min is null or duracao_min between 1 and 600),
  posicao       double precision not null default 0,
  created_at    timestamptz not null default now()
);

create index aulas_curso_idx on public.aulas (curso_id, posicao);

create table public.aulas_concluidas (
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  aula_id     uuid not null references public.aulas (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, aula_id)
);

-- Para o cliente logado: a aula já foi liberada?
create or replace function public.aula_liberada(p_semana integer)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_semana is null
      or public.is_membro()
      or exists (
        select 1 from public.clientes c
        where c.id = public.meu_cliente_id()
          and c.inicio + (p_semana - 1) * 7 <= (now() at time zone 'America/Sao_Paulo')::date
      );
$$;

alter table public.cursos enable row level security;
alter table public.aulas enable row level security;
alter table public.aulas_concluidas enable row level security;

create policy "cursos visiveis" on public.cursos for select to authenticated
  using (
    public.is_admin()
    or (publicado and public.is_membro())
    or (publicado and publico = 'clientes' and public.meu_cliente_id() is not null)
  );
create policy "admin gerencia cursos" on public.cursos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A aula segue a visibilidade do curso (a subconsulta respeita o RLS de cursos).
create policy "aulas visiveis" on public.aulas for select to authenticated
  using (exists (select 1 from public.cursos c where c.id = curso_id) and public.aula_liberada(semana));
create policy "admin gerencia aulas" on public.aulas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "progresso visivel" on public.aulas_concluidas for select to authenticated
  using (user_id = auth.uid() or public.is_membro());
create policy "usuario marca aula vista" on public.aulas_concluidas for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.aulas a where a.id = aula_id));
create policy "usuario desmarca aula" on public.aulas_concluidas for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Metas do mês
-- ---------------------------------------------------------------------
create table public.metas (
  mes          date primary key check (extract(day from mes) = 1),
  receita      numeric(10,2) not null default 0 check (receita >= 0),   -- fechado no mês (projeto + 1ª mensalidade)
  contratos    integer not null default 0 check (contratos >= 0),
  reunioes     integer not null default 0 check (reunioes >= 0),
  updated_at   timestamptz not null default now()
);

alter table public.metas enable row level security;
create policy "membros veem metas" on public.metas for select to authenticated using (public.is_membro());
create policy "admin define metas" on public.metas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- push_subscriptions (um registro por aparelho)
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  endpoint          text not null unique,
  subscription_json jsonb not null,
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "usuario gerencia os proprios aparelhos"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Segurança das funções
-- ---------------------------------------------------------------------
-- Funções de trigger não devem ser chamáveis pela API (/rest/v1/rpc/...).
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.proteger_papel()      from public, anon, authenticated;
revoke execute on function public.tocar_updated_at()    from public, anon, authenticated;
revoke execute on function public.tarefas_before_write() from public, anon, authenticated;
revoke execute on function public.leads_registrar()     from public, anon, authenticated;
revoke execute on function public.leads_before_write()  from public, anon, authenticated;

revoke execute on function public.is_admin()            from public, anon;
revoke execute on function public.is_membro()           from public, anon;
revoke execute on function public.meu_cliente_id()      from public, anon;
revoke execute on function public.aula_liberada(integer) from public, anon;
grant execute on function public.is_admin()             to authenticated;
grant execute on function public.is_membro()            to authenticated;
grant execute on function public.meu_cliente_id()       to authenticated;
grant execute on function public.aula_liberada(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: telas atualizam sozinhas
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.leads, public.tarefas, public.atualizacoes;
