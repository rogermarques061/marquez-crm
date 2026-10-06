import { supabase } from './supabase'
import type {
  Atualizacao,
  Aula,
  AulaEditavel,
  Cliente,
  ClienteCompleto,
  Contato,
  ContatoEditavel,
  Curso,
  CursoEditavel,
  HistoricoLead,
  LeadCompleto,
  LeadEditavel,
  Meta,
  Papel,
  Perfil,
  Servico,
  ServicoEditavel,
  Tarefa,
  TarefaEditavel,
} from './tipos'

async function meuId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sessão expirada. Entre novamente.')
  return id
}

/** Mensagens do banco que valem traduzir para quem usa o app. */
function traduzir(msg: string) {
  if (/contatos_whatsapp_unico/.test(msg)) return 'Já existe um contato com esse WhatsApp.'
  if (/clientes_contato_id_fkey/.test(msg)) return 'Esse contato já é cliente e não pode ser excluído.'
  if (/clientes_contato_id_key/.test(msg)) return 'Esse contato já é cliente.'
  if (/whatsapp_check/.test(msg)) return 'WhatsApp inválido: use DDD + número.'
  if (/email_check/.test(msg)) return 'E-mail inválido.'
  if (/_url_check|link_check/.test(msg)) return 'O link precisa começar com https://'
  return msg
}

function falhou(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(traduzir(error.message))
}

/** Erro amigável vindo de uma Edge Function. */
async function erroDaFuncao(error: unknown): Promise<never> {
  const ctx = (error as { context?: Response }).context
  const corpo = ctx ? await ctx.json().catch(() => null) : null
  throw new Error(corpo?.erro ?? (error as Error).message)
}

// numeric chega como string; o app trabalha com number.
const num = (v: unknown) => Number(v ?? 0)
const normalizarServico = <T extends Servico>(s: T): T => ({ ...s, valor_projeto: num(s.valor_projeto), valor_mensal: num(s.valor_mensal) })

function ouvir(tabela: string, aoMudar: () => void) {
  const canal = supabase
    .channel(`${tabela}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tabela }, aoMudar)
    .subscribe()
  return () => void supabase.removeChannel(canal)
}

const CAMPOS_CONTATO_LEAD = 'id, nome, empresa, whatsapp, instagram, email, segmento, origem'
const CLIENTE_COMPLETO = '*, contato:contatos(nome, whatsapp, email, instagram), servicos(*, tarefas(status, prazo))'

type TarefaComServico = Tarefa & { servico: { nome: string; cliente: { id: string; nome: string } } }

export const api = {
  /* ---------------------------------------------------------- equipe */
  async listarPerfis(): Promise<Perfil[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('nome')
    falhou(error)
    return data as Perfil[]
  },

  /** Só admin e equipe (para escolher responsáveis). */
  async listarEquipe(): Promise<Perfil[]> {
    const { data, error } = await supabase.from('profiles').select('*').in('papel', ['admin', 'equipe']).order('nome')
    falhou(error)
    return data as Perfil[]
  },

  async atualizarMeuPerfil(dados: { nome?: string; notificacoes_ativas?: boolean }) {
    const { error } = await supabase.from('profiles').update(dados).eq('id', await meuId())
    falhou(error)
  },

  async alterarPapel(id: string, papel: Papel, clienteId: string | null = null) {
    const { error } = await supabase
      .from('profiles')
      .update({ papel, cliente_id: papel === 'cliente' ? clienteId : null })
      .eq('id', id)
    falhou(error)
  },

  async convidarUsuario(dados: { email: string; nome: string; papel: Papel; cliente_id?: string | null }) {
    const { error } = await supabase.functions.invoke('gerenciar-usuarios', { body: { acao: 'convidar', site: location.origin, ...dados } })
    if (error) await erroDaFuncao(error)
  },

  async removerUsuario(id: string) {
    const { error } = await supabase.functions.invoke('gerenciar-usuarios', { body: { acao: 'remover', id } })
    if (error) await erroDaFuncao(error)
  },

  /* -------------------------------------------------------- contatos */
  async listarContatos(): Promise<Contato[]> {
    const { data, error } = await supabase.from('contatos').select('*').order('updated_at', { ascending: false }).limit(5000)
    falhou(error)
    return data as Contato[]
  },

  async criarContato(dados: ContatoEditavel & { nome: string }): Promise<Contato> {
    const { data, error } = await supabase
      .from('contatos')
      .insert({ responsavel_id: await meuId(), ...dados })
      .select()
      .single()
    falhou(error)
    return data as Contato
  },

  async atualizarContato(id: string, dados: ContatoEditavel) {
    const { error } = await supabase.from('contatos').update(dados).eq('id', id)
    falhou(error)
  },

  async excluirContato(id: string) {
    const { error } = await supabase.from('contatos').delete().eq('id', id)
    falhou(error)
  },

  /* ----------------------------------------------------------- leads */
  async listarLeads(): Promise<LeadCompleto[]> {
    const { data, error } = await supabase
      .from('leads')
      .select(`*, contato:contatos(${CAMPOS_CONTATO_LEAD})`)
      .order('updated_at', { ascending: false })
      .limit(5000)
    falhou(error)
    return (data as LeadCompleto[]).map((l) => ({ ...l, valor_projeto: num(l.valor_projeto), valor_mensal: num(l.valor_mensal) }))
  },

  async criarLead(dados: LeadEditavel & { contato_id: string }): Promise<string> {
    const { data, error } = await supabase
      .from('leads')
      .insert({ responsavel_id: await meuId(), ...dados })
      .select('id')
      .single()
    falhou(error)
    return data.id as string
  },

  async atualizarLead(id: string, dados: LeadEditavel) {
    const { error } = await supabase.from('leads').update(dados).eq('id', id)
    falhou(error)
  },

  async excluirLead(id: string) {
    const { error } = await supabase.from('leads').delete().eq('id', id)
    falhou(error)
  },

  async listarHistorico(leadId: string): Promise<HistoricoLead[]> {
    const { data, error } = await supabase.from('lead_historico').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
    falhou(error)
    return data as HistoricoLead[]
  },

  ouvirLeads: (aoMudar: () => void) => ouvir('leads', aoMudar),

  /* -------------------------------------------- clientes e serviços */
  async listarClientes(): Promise<ClienteCompleto[]> {
    const { data, error } = await supabase.from('clientes').select(CLIENTE_COMPLETO).order('nome')
    falhou(error)
    return (data as ClienteCompleto[]).map((c) => ({ ...c, servicos: c.servicos.map(normalizarServico) }))
  },

  async obterCliente(id: string): Promise<ClienteCompleto | null> {
    const { data, error } = await supabase.from('clientes').select(CLIENTE_COMPLETO).eq('id', id).maybeSingle()
    falhou(error)
    if (!data) return null
    const c = data as ClienteCompleto
    return { ...c, servicos: c.servicos.map(normalizarServico) }
  },

  async atualizarCliente(id: string, dados: Partial<Pick<Cliente, 'nome' | 'status' | 'inicio' | 'responsavel_id'>>) {
    const { error } = await supabase.from('clientes').update(dados).eq('id', id)
    falhou(error)
  },

  /** Torna um contato cliente direto (sem passar pelo funil). */
  async criarCliente(contato: Pick<Contato, 'id' | 'nome' | 'empresa'>): Promise<string> {
    const { data, error } = await supabase
      .from('clientes')
      .insert({ contato_id: contato.id, nome: contato.empresa?.trim() || contato.nome, responsavel_id: await meuId() })
      .select('id')
      .single()
    falhou(error)
    return data.id as string
  },

  async criarServico(dados: ServicoEditavel & { cliente_id: string; nome: string }): Promise<Servico> {
    const { data, error } = await supabase.from('servicos').insert(dados).select().single()
    falhou(error)
    return normalizarServico(data as Servico)
  },

  async atualizarServico(id: string, dados: ServicoEditavel) {
    const { error } = await supabase.from('servicos').update(dados).eq('id', id)
    falhou(error)
  },

  async excluirServico(id: string) {
    const { error } = await supabase.from('servicos').delete().eq('id', id)
    falhou(error)
  },

  /** Serviços visíveis para quem está logado (o cliente vê só os dele). */
  async listarServicos(): Promise<Servico[]> {
    const { data, error } = await supabase.from('servicos').select('*').order('created_at')
    falhou(error)
    return (data as Servico[]).map(normalizarServico)
  },

  async listarTarefas(servicoIds: string[]): Promise<Tarefa[]> {
    if (!servicoIds.length) return []
    const { data, error } = await supabase.from('tarefas').select('*').in('servico_id', servicoIds).order('posicao').order('created_at')
    falhou(error)
    return data as Tarefa[]
  },

  /** Tarefas em aberto de todos os serviços (painel da equipe). */
  async tarefasAbertas(): Promise<TarefaComServico[]> {
    const { data, error } = await supabase
      .from('tarefas')
      .select('*, servico:servicos(nome, cliente:clientes(id, nome))')
      .neq('status', 'feito')
      .order('prazo', { ascending: true, nullsFirst: false })
      .limit(500)
    falhou(error)
    return data as TarefaComServico[]
  },

  async criarTarefas(servicoId: string, titulos: string[]) {
    if (!titulos.length) return
    const base = Date.now()
    const { error } = await supabase.from('tarefas').insert(titulos.map((titulo, i) => ({ servico_id: servicoId, titulo, posicao: base + i })))
    falhou(error)
  },

  async atualizarTarefa(id: string, dados: TarefaEditavel) {
    const { error } = await supabase.from('tarefas').update(dados).eq('id', id)
    falhou(error)
  },

  async excluirTarefa(id: string) {
    const { error } = await supabase.from('tarefas').delete().eq('id', id)
    falhou(error)
  },

  ouvirTarefas: (aoMudar: () => void) => ouvir('tarefas', aoMudar),

  async listarAtualizacoes(servicoIds: string[]): Promise<Atualizacao[]> {
    if (!servicoIds.length) return []
    const { data, error } = await supabase
      .from('atualizacoes')
      .select('*')
      .in('servico_id', servicoIds)
      .order('created_at', { ascending: false })
      .limit(200)
    falhou(error)
    return data as Atualizacao[]
  },

  async publicarAtualizacao(dados: { servico_id: string; texto: string; link?: string | null; visivel_cliente?: boolean }) {
    const { error } = await supabase.from('atualizacoes').insert({ ...dados, autor_id: await meuId() })
    falhou(error)
  },

  async excluirAtualizacao(id: string) {
    const { error } = await supabase.from('atualizacoes').delete().eq('id', id)
    falhou(error)
  },

  ouvirAtualizacoes: (aoMudar: () => void) => ouvir('atualizacoes', aoMudar),

  /* --------------------------------------------------------- academia */
  async listarCursos(): Promise<(Curso & { aulas: { id: string }[] })[]> {
    const { data, error } = await supabase.from('cursos').select('*, aulas(id)').order('posicao').order('created_at')
    falhou(error)
    return data as (Curso & { aulas: { id: string }[] })[]
  },

  async obterCurso(id: string): Promise<Curso | null> {
    const { data, error } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
    falhou(error)
    return data as Curso | null
  },

  async criarCurso(dados: CursoEditavel & { titulo: string; publico: Curso['publico'] }): Promise<string> {
    const { data, error } = await supabase
      .from('cursos')
      .insert({ posicao: Date.now(), ...dados })
      .select('id')
      .single()
    falhou(error)
    return data.id as string
  },

  async atualizarCurso(id: string, dados: CursoEditavel) {
    const { error } = await supabase.from('cursos').update(dados).eq('id', id)
    falhou(error)
  },

  async excluirCurso(id: string) {
    const { error } = await supabase.from('cursos').delete().eq('id', id)
    falhou(error)
  },

  async listarAulas(cursoId: string): Promise<Aula[]> {
    const { data, error } = await supabase.from('aulas').select('*').eq('curso_id', cursoId).order('posicao').order('created_at')
    falhou(error)
    return data as Aula[]
  },

  async criarAula(dados: AulaEditavel & { curso_id: string; titulo: string }) {
    const { error } = await supabase.from('aulas').insert({ posicao: Date.now(), ...dados })
    falhou(error)
  },

  async atualizarAula(id: string, dados: AulaEditavel) {
    const { error } = await supabase.from('aulas').update(dados).eq('id', id)
    falhou(error)
  },

  async excluirAula(id: string) {
    const { error } = await supabase.from('aulas').delete().eq('id', id)
    falhou(error)
  },

  /** Aulas que eu já concluí. */
  async minhasAulasVistas(): Promise<Set<string>> {
    const { data, error } = await supabase.from('aulas_concluidas').select('aula_id').eq('user_id', await meuId())
    falhou(error)
    return new Set((data as { aula_id: string }[]).map((x) => x.aula_id))
  },

  /** Progresso de todo mundo num curso (admin acompanha a equipe e os clientes). */
  async progressoDoCurso(aulaIds: string[]): Promise<{ user_id: string; aula_id: string }[]> {
    if (!aulaIds.length) return []
    const { data, error } = await supabase.from('aulas_concluidas').select('user_id, aula_id').in('aula_id', aulaIds)
    falhou(error)
    return data as { user_id: string; aula_id: string }[]
  },

  async marcarAula(aulaId: string, vista: boolean) {
    const eu = await meuId()
    const { error } = vista
      ? await supabase.from('aulas_concluidas').upsert({ aula_id: aulaId, user_id: eu })
      : await supabase.from('aulas_concluidas').delete().eq('aula_id', aulaId).eq('user_id', eu)
    falhou(error)
  },

  /* ------------------------------------------------------------ metas */
  async obterMeta(mes: string): Promise<Meta | null> {
    const { data, error } = await supabase.from('metas').select('*').eq('mes', mes).maybeSingle()
    falhou(error)
    return data ? { ...(data as Meta), receita: num(data.receita) } : null
  },

  async salvarMeta(meta: Meta) {
    const { error } = await supabase.from('metas').upsert({ ...meta, updated_at: new Date().toISOString() })
    falhou(error)
  },

  /* ------------------------------------------------------------- push */
  async salvarInscricaoPush(inscricao: PushSubscriptionJSON) {
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: await meuId(), endpoint: inscricao.endpoint, subscription_json: inscricao, user_agent: navigator.userAgent },
      { onConflict: 'endpoint' },
    )
    falhou(error)
  },

  /** Remove a inscrição deste aparelho e diz quantos aparelhos do usuário continuam inscritos. */
  async removerInscricaoPush(endpoint: string): Promise<number> {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    falhou(error)
    const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', await meuId())
    return count ?? 0
  },
}

/** Primeiro dia do mês (YYYY-MM-01) no fuso do aparelho. */
export function inicioDoMes(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Data de hoje (YYYY-MM-DD) no fuso do aparelho. */
export function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
