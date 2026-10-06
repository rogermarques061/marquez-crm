-- Google Maps (Places API) como fonte da prospecção.
-- A chave fica no Vault: o admin cola em Ajustes, o app grava por RPC e só
-- a Edge Function (service role) consegue ler o valor.


create or replace function public.salvar_chave_google(p_chave text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem configurar a busca.';
  end if;
  select id into v_id from vault.secrets where name = 'google_places_chave';
  if coalesce(trim(p_chave), '') = '' then
    delete from vault.secrets where id = v_id;
  elsif v_id is null then
    perform vault.create_secret(trim(p_chave), 'google_places_chave');
  else
    perform vault.update_secret(v_id, trim(p_chave));
  end if;
end;
$$;

create or replace function public.google_configurado()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from vault.secrets where name = 'google_places_chave');
$$;

create or replace function public.config_google()
returns text
language sql stable security definer set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'google_places_chave';
$$;

revoke execute on function public.salvar_chave_google(text) from public, anon;
revoke execute on function public.google_configurado() from public, anon;
revoke execute on function public.config_google() from public, anon, authenticated;
grant execute on function public.salvar_chave_google(text) to authenticated;
grant execute on function public.google_configurado() to authenticated;
grant execute on function public.config_google() to service_role;

-- TomTom como fonte gratuita da prospecção (cota diária sem cartão).
-- Mesmo esquema do Google: a chave fica no Vault e só a Edge Function lê.


create or replace function public.salvar_chave_tomtom(p_chave text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem configurar a busca.';
  end if;
  select id into v_id from vault.secrets where name = 'tomtom_chave';
  if coalesce(trim(p_chave), '') = '' then
    delete from vault.secrets where id = v_id;
  elsif v_id is null then
    perform vault.create_secret(trim(p_chave), 'tomtom_chave');
  else
    perform vault.update_secret(v_id, trim(p_chave));
  end if;
end;
$$;

create or replace function public.tomtom_configurado()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from vault.secrets where name = 'tomtom_chave');
$$;

create or replace function public.config_tomtom()
returns text
language sql stable security definer set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'tomtom_chave';
$$;

revoke execute on function public.salvar_chave_tomtom(text) from public, anon;
revoke execute on function public.tomtom_configurado() from public, anon;
revoke execute on function public.config_tomtom() from public, anon, authenticated;
grant execute on function public.salvar_chave_tomtom(text) to authenticated;
grant execute on function public.tomtom_configurado() to authenticated;
grant execute on function public.config_tomtom() to service_role;
