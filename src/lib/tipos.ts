import type {
  Etapa,
  Origem,
  PublicoCurso,
  StatusCliente,
  StatusServico,
  StatusTarefa,
  Temperatura,
  TipoServico,
} from './constantes'

export type Papel = 'admin' | 'equipe' | 'cliente'

export interface Perfil {
  id: string
  nome: string
  email: string | null
  papel: Papel
  cliente_id: string | null
  notificacoes_ativas: boolean
}

export interface Contato {
  id: string
  nome: string
  empresa: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  segmento: string | null
  cidade: string | null
  origem: Origem
  tags: string[]
  anotacoes: string | null
  responsavel_id: string | null
  created_at: string
  updated_at: string
}

export type ContatoEditavel = Partial<Omit<Contato, 'id' | 'created_at' | 'updated_at'>>

export interface Lead {
  id: string
  contato_id: string
  titulo: string | null
  servico: TipoServico
  etapa: Etapa
  temperatura: Temperatura
  responsavel_id: string | null
  data_reuniao: string | null
  valor_projeto: number
  valor_mensal: number
  motivo_perda: string | null
  anotacoes: string | null
  ganho_em: string | null
  perdido_em: string | null
  created_at: string
  updated_at: string
}

/** Lead com os dados do contato. */
export interface LeadCompleto extends Lead {
  contato: Pick<Contato, 'id' | 'nome' | 'empresa' | 'whatsapp' | 'instagram' | 'email' | 'segmento' | 'origem'>
}

export type LeadEditavel = Partial<
  Pick<
    Lead,
    | 'titulo'
    | 'servico'
    | 'etapa'
    | 'temperatura'
    | 'responsavel_id'
    | 'data_reuniao'
    | 'valor_projeto'
    | 'valor_mensal'
    | 'motivo_perda'
    | 'anotacoes'
  >
>

export interface HistoricoLead {
  id: string
  lead_id: string
  etapa_anterior: Etapa | null
  etapa_nova: Etapa
  usuario_id: string | null
  created_at: string
}

export interface Cliente {
  id: string
  contato_id: string
  nome: string
  status: StatusCliente
  inicio: string
  responsavel_id: string | null
  created_at: string
}

export interface Servico {
  id: string
  cliente_id: string
  lead_id: string | null
  nome: string
  tipo: TipoServico
  descricao: string | null
  status: StatusServico
  valor_projeto: number
  valor_mensal: number
  inicio: string
  prazo: string | null
  responsavel_id: string | null
  created_at: string
}

export type ServicoEditavel = Partial<Omit<Servico, 'id' | 'cliente_id' | 'lead_id' | 'created_at'>>

export interface Tarefa {
  id: string
  servico_id: string
  titulo: string
  descricao: string | null
  status: StatusTarefa
  responsavel_id: string | null
  prazo: string | null
  visivel_cliente: boolean
  posicao: number
  concluida_em: string | null
  created_at: string
}

export type TarefaEditavel = Partial<Pick<Tarefa, 'titulo' | 'descricao' | 'status' | 'responsavel_id' | 'prazo' | 'visivel_cliente' | 'posicao'>>

export interface Atualizacao {
  id: string
  servico_id: string
  autor_id: string | null
  texto: string
  link: string | null
  visivel_cliente: boolean
  created_at: string
}

/** Cliente com contato e serviços (tela de clientes). */
export interface ClienteCompleto extends Cliente {
  contato: Pick<Contato, 'nome' | 'whatsapp' | 'email' | 'instagram'> | null
  servicos: (Servico & { tarefas: Pick<Tarefa, 'status' | 'prazo'>[] })[]
}

export interface Curso {
  id: string
  titulo: string
  descricao: string | null
  publico: PublicoCurso
  publicado: boolean
  posicao: number
  created_at: string
}

export interface Aula {
  id: string
  curso_id: string
  titulo: string
  descricao: string | null
  video_url: string | null
  material_url: string | null
  semana: number | null
  duracao_min: number | null
  posicao: number
}

export type CursoEditavel = Partial<Pick<Curso, 'titulo' | 'descricao' | 'publico' | 'publicado' | 'posicao'>>
export type AulaEditavel = Partial<Omit<Aula, 'id' | 'curso_id'>>

export interface Meta {
  mes: string
  receita: number
  contratos: number
  reunioes: number
}
