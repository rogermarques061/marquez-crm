-- =====================================================================
-- Notificações push: a cada contrato fechado (lead → ganho), o banco chama
-- a Edge Function "notificar", que manda o Web Push para a equipe com
-- notificações ativas. Tudo se configura pelo Vault (SQL Editor):
--
--   select vault.create_secret('<chave pública VAPID>',  'vapid_publica');
--   select vault.create_secret('<chave privada VAPID>',  'vapid_privada');
--   select vault.create_secret('mailto:voce@dominio',    'vapid_contato');
--   select vault.create_secret('<segredo aleatório>',    'notificar_segredo');
--   select vault.create_secret('https://SEU-PROJETO.supabase.co/functions/v1/notificar', 'notificar_url');
-- =====================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.config_push()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('vapid_publica', 'vapid_privada', 'vapid_contato', 'notificar_segredo');
$$;

create or replace function public.notificar_fechamento()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notificar_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'notificar_segredo';
  if v_url is null or v_segredo is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', v_segredo),
    body := jsonb_build_object('lead_id', new.id)
  );
  return new;
exception when others then
  -- Notificação nunca pode impedir o fechamento.
  raise warning 'notificar_fechamento: %', sqlerrm;
  return new;
end;
$$;

create trigger leads_notificar_ganho_insert
  after insert on public.leads
  for each row
  when (new.etapa = 'ganho')
  execute function public.notificar_fechamento();

create trigger leads_notificar_ganho_update
  after update of etapa on public.leads
  for each row
  when (old.etapa is distinct from 'ganho' and new.etapa = 'ganho')
  execute function public.notificar_fechamento();

-- Tudo que a mensagem precisa, com "mês" no fuso de São Paulo.
create or replace function public.dados_fechamento(p_lead_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with lead as (
    select l.*, c.nome as contato, c.empresa, p.nome as responsavel,
           date_trunc('month', l.ganho_em at time zone 'America/Sao_Paulo') as mes
    from public.leads l
    join public.contatos c on c.id = l.contato_id
    left join public.profiles p on p.id = l.responsavel_id
    where l.id = p_lead_id and l.etapa = 'ganho'
  ),
  mes as (
    select coalesce(sum(x.valor_projeto + x.valor_mensal), 0) as total_mes,
           count(*) as contratos_mes
    from public.leads x, lead
    where x.etapa = 'ganho'
      and date_trunc('month', x.ganho_em at time zone 'America/Sao_Paulo') = lead.mes
      and x.ganho_em <= lead.ganho_em
  )
  select jsonb_build_object(
    'lead_id', lead.id,
    'cliente', coalesce(nullif(lead.empresa, ''), lead.contato),
    'servico', public.rotulo_servico(lead.servico),
    'valor_projeto', lead.valor_projeto,
    'valor_mensal', lead.valor_mensal,
    'responsavel', lead.responsavel,
    'total_mes', mes.total_mes,
    'contratos_mes', mes.contratos_mes,
    'meta_mes', (select receita from public.metas where metas.mes = lead.mes::date)
  )
  from lead, mes;
$$;

revoke execute on function public.notificar_fechamento() from public, anon, authenticated;
revoke execute on function public.config_push() from public, anon, authenticated;
revoke execute on function public.dados_fechamento(uuid) from public, anon, authenticated;
grant execute on function public.config_push() to service_role;
grant execute on function public.dados_fechamento(uuid) to service_role;
