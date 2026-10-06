-- Stub mínimo do ambiente Supabase para testar migrações num Postgres puro.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create publication supabase_realtime;
-- pg_net e vault (simulados)
create schema if not exists extensions;
create schema net;
create table net.chamadas (url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$ insert into net.chamadas values (url, headers, body); select 1::bigint $$;
create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text);
