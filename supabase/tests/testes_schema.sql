\set ON_ERROR_STOP 1
-- Roda num Postgres puro: stub_supabase.sql + migrações 1, 2 e 5 (as 3 e 4 dependem
-- das extensões http/vault reais do Supabase). Ver README.

-- usuários: o primeiro vira admin, o resto nasce cliente sem vínculo
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'roger@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 'func@x.com'),
  ('00000000-0000-0000-0000-00000000000c', 'cliente@x.com'),
  ('00000000-0000-0000-0000-00000000000d', 'outro@x.com');
select email, papel from public.profiles order by email;
update public.profiles set papel = 'equipe' where email = 'func@x.com';

-- funcionário cadastra contato e lead
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.contatos (nome, empresa, whatsapp, origem) values ('Ana Souza', 'Clínica Bella', '11987654321', 'instagram');
insert into public.leads (contato_id, titulo, servico, valor_projeto, valor_mensal, responsavel_id)
  select id, 'Site + tráfego', 'site', 2500, 600, auth.uid() from public.contatos where nome = 'Ana Souza';
select etapa, ganho_em is null as sem_ganho from public.leads;
-- funcionário não se promove nem se vincula a cliente
do $$ begin update public.profiles set papel='admin' where id = auth.uid(); raise exception 'promoveu';
exception when others then if sqlerrm = 'promoveu' then raise; end if; raise notice 'ok: %', sqlerrm; end $$;
-- whatsapp duplicado é barrado
do $$ begin insert into public.contatos (nome, whatsapp) values ('Dup', '11987654321'); raise exception 'duplicou';
exception when unique_violation then raise notice 'ok, whatsapp único'; end $$;

-- funil até ganho => cliente + serviço
update public.leads set etapa = 'reuniao_agendada';
update public.leads set etapa = 'proposta_enviada';
update public.leads set etapa = 'ganho';
select etapa, ganho_em is not null as ganhou from public.leads;
select etapa_anterior, etapa_nova, usuario_id is not null as quem from public.lead_historico order by created_at, etapa_nova;
select c.nome as cliente, c.status, s.nome as servico, s.tipo, s.status as status_servico, s.valor_projeto, s.valor_mensal
from public.clientes c join public.servicos s on s.cliente_id = c.id;
-- não pode inserir histórico direto
do $$ begin insert into public.lead_historico (lead_id, etapa_nova) select id, 'perdido' from public.leads; raise exception 'inseriu';
exception when insufficient_privilege then raise notice 'ok, historico protegido'; end $$;

-- tarefas e atualizações
insert into public.tarefas (servico_id, titulo) select id, 'Briefing' from public.servicos;
insert into public.tarefas (servico_id, titulo, visivel_cliente) select id, 'Interno: custo da hospedagem', false from public.servicos;
update public.tarefas set status = 'feito' where titulo = 'Briefing';
select titulo, status, concluida_em is not null as concluida from public.tarefas order by titulo;
insert into public.atualizacoes (servico_id, texto) select id, 'Layout aprovado!' from public.servicos;
insert into public.atualizacoes (servico_id, texto, visivel_cliente) select id, 'Nota interna', false from public.servicos;

-- academia
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.cursos (titulo, publico, publicado) values ('Onboarding da equipe', 'equipe', true), ('Marketing para donos', 'clientes', true), ('Rascunho', 'clientes', false);
insert into public.aulas (curso_id, titulo, semana) select id, 'Aula 1', 1 from public.cursos where titulo = 'Marketing para donos';
insert into public.aulas (curso_id, titulo, semana) select id, 'Aula 2', 2 from public.cursos where titulo = 'Marketing para donos';
insert into public.aulas (curso_id, titulo) select id, 'Boas-vindas' from public.cursos where titulo = 'Onboarding da equipe';
-- admin vincula o usuário cliente ao cliente
update public.profiles set cliente_id = (select id from public.clientes limit 1) where email = 'cliente@x.com';
insert into public.metas (mes, receita, contratos) values (date_trunc('month', now())::date, 10000, 5);
reset role;

-- visão do cliente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as cliente_ve_contatos from public.contatos;
select count(*) as cliente_ve_leads from public.leads;
select count(*) as cliente_ve_clientes from public.clientes;
select count(*) as cliente_ve_servicos from public.servicos;
select titulo from public.tarefas order by titulo;
select texto from public.atualizacoes;
select titulo from public.cursos order by titulo;
select titulo from public.aulas order by titulo;   -- só a aula 1 (semana 2 ainda não chegou)
select count(*) as cliente_ve_metas from public.metas;
insert into public.atualizacoes (servico_id, texto) select id, 'Recado do cliente' from public.servicos;
insert into public.aulas_concluidas (aula_id) select id from public.aulas where titulo = 'Aula 1';
do $$ begin insert into public.aulas_concluidas (aula_id) select id from public.aulas where titulo = 'Aula 2'; raise notice 'nada inserido (aula invisível)';
exception when others then raise notice 'ok, bloqueou: %', sqlerrm; end $$;
select count(*) as vistas from public.aulas_concluidas;
-- cliente não se promove
do $$ begin update public.profiles set papel='admin', cliente_id = null where id = auth.uid(); raise exception 'promoveu';
exception when others then if sqlerrm = 'promoveu' then raise; end if; raise notice 'ok: %', sqlerrm; end $$;
reset role;

-- cliente sem vínculo não vê nada
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select (select count(*) from public.servicos) + (select count(*) from public.cursos) + (select count(*) from public.contatos) as sem_vinculo_ve;
reset role;

-- semana 2 libera depois de 7 dias
update public.clientes set inicio = inicio - 7;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as aulas_apos_uma_semana from public.aulas;
reset role;

-- prospecção => lead
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.prospectos (canal, fonte_id, nome, nicho, telefone) values ('x1', 'node/9', 'Barbearia do Zé', 'barbearia', '+55 (21) 99876-5432');
select public.prospecto_para_lead((select id from public.prospectos where fonte_id = 'node/9')) is not null as virou_lead;
select public.prospecto_para_lead((select id from public.prospectos where fonte_id = 'node/9')) is not null as repetiu_sem_duplicar;
select c.nome, c.whatsapp, c.origem, l.etapa, (select count(*) from public.leads x where x.contato_id = c.id) as leads
from public.contatos c join public.leads l on l.contato_id = c.id where c.nome = 'Barbearia do Zé';
select status, contato_id is not null as vinculado from public.prospectos;
reset role;

-- notificações: sem config não chama; com config chama só no ganho
select count(*) as chamadas_sem_config from net.chamadas;
insert into vault.decrypted_secrets values ('notificar_url', 'https://x.supabase.co/functions/v1/notificar'), ('notificar_segredo', 's3gr3do');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update public.leads set etapa = 'negociacao' where contato_id = (select id from public.contatos where nome = 'Barbearia do Zé');
update public.leads set etapa = 'ganho', valor_projeto = 1500 where contato_id = (select id from public.contatos where nome = 'Barbearia do Zé');
update public.leads set anotacoes = 'x', etapa = 'ganho' where contato_id = (select id from public.contatos where nome = 'Barbearia do Zé');
reset role;
select count(*) as chamadas_no_ganho from net.chamadas;
select public.dados_fechamento((select id from public.leads where valor_projeto = 1500)) - 'lead_id' as dados;

-- anon não vê nada
set request.jwt.claim.sub = ''; set role anon;
do $$ begin perform count(*) from public.contatos; raise notice 'anon leu contatos sem erro (sem linhas por RLS)'; exception when others then raise notice 'ok, anon bloqueado'; end $$;
reset role;
