// Valores do banco + rótulos exibidos na interface.

export interface Opcao<T extends string> {
  valor: T
  rotulo: string
}

export function rotulo<T extends string>(opcoes: readonly Opcao<T>[], valor: T | null | undefined) {
  return opcoes.find((o) => o.valor === valor)?.rotulo ?? '—'
}

export type TipoServico = 'site' | 'trafego' | 'social_media' | 'identidade_visual' | 'google_meu_negocio' | 'consultoria' | 'mentoria' | 'outro'

export const SERVICOS: Opcao<TipoServico>[] = [
  { valor: 'site', rotulo: 'Site' },
  { valor: 'trafego', rotulo: 'Tráfego pago' },
  { valor: 'social_media', rotulo: 'Social media' },
  { valor: 'identidade_visual', rotulo: 'Identidade visual' },
  { valor: 'google_meu_negocio', rotulo: 'Google Meu Negócio' },
  { valor: 'consultoria', rotulo: 'Consultoria' },
  { valor: 'mentoria', rotulo: 'Mentoria' },
  { valor: 'outro', rotulo: 'Outro' },
]

export type Origem = 'indicacao' | 'instagram' | 'google' | 'site' | 'prospeccao_rua' | 'prospeccao_x1' | 'evento' | 'outro'

export const ORIGENS: Opcao<Origem>[] = [
  { valor: 'indicacao', rotulo: 'Indicação' },
  { valor: 'instagram', rotulo: 'Instagram' },
  { valor: 'google', rotulo: 'Google' },
  { valor: 'site', rotulo: 'Site' },
  { valor: 'prospeccao_rua', rotulo: 'Prospecção na rua' },
  { valor: 'prospeccao_x1', rotulo: 'Prospecção no X1' },
  { valor: 'evento', rotulo: 'Evento' },
  { valor: 'outro', rotulo: 'Outro' },
]

export type Etapa = 'novo' | 'contato_feito' | 'reuniao_agendada' | 'proposta_enviada' | 'negociacao' | 'ganho' | 'perdido'

/** Etapas do funil, na ordem das colunas do Kanban. `cor` = marcador da coluna. */
export const ETAPAS: { valor: Etapa; rotulo: string; cor: string }[] = [
  { valor: 'novo', rotulo: 'Novo', cor: '#6c697a' },
  { valor: 'contato_feito', rotulo: 'Contato feito', cor: '#8f8aa6' },
  { valor: 'reuniao_agendada', rotulo: 'Reunião agendada', cor: '#b3aed0' },
  { valor: 'proposta_enviada', rotulo: 'Proposta enviada', cor: '#9085e9' },
  { valor: 'negociacao', rotulo: 'Negociação', cor: '#e0b25c' },
  { valor: 'ganho', rotulo: 'Ganho', cor: '#5fbf8f' },
  { valor: 'perdido', rotulo: 'Perdido', cor: '#e66767' },
]

export const corEtapa = (e: Etapa) => ETAPAS.find((x) => x.valor === e)?.cor ?? '#6c697a'

export type Temperatura = 'quente' | 'morno' | 'frio'

export const TEMPERATURAS: { valor: Temperatura; rotulo: string }[] = [
  { valor: 'quente', rotulo: 'Quente' },
  { valor: 'morno', rotulo: 'Morno' },
  { valor: 'frio', rotulo: 'Frio' },
]

export type StatusCliente = 'ativo' | 'pausado' | 'encerrado'

export const STATUS_CLIENTE: Opcao<StatusCliente>[] = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'pausado', rotulo: 'Pausado' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
]

export type StatusServico = 'onboarding' | 'em_execucao' | 'em_revisao' | 'entregue' | 'pausado' | 'cancelado'

export const STATUS_SERVICO: (Opcao<StatusServico> & { cor: string })[] = [
  { valor: 'onboarding', rotulo: 'Onboarding', cor: '#8f8aa6' },
  { valor: 'em_execucao', rotulo: 'Em execução', cor: '#9085e9' },
  { valor: 'em_revisao', rotulo: 'Em revisão', cor: '#e0b25c' },
  { valor: 'entregue', rotulo: 'Entregue', cor: '#5fbf8f' },
  { valor: 'pausado', rotulo: 'Pausado', cor: '#6c697a' },
  { valor: 'cancelado', rotulo: 'Cancelado', cor: '#e66767' },
]

/** Serviços que contam no recorrente (MRR). */
export const SERVICO_ATIVO: StatusServico[] = ['onboarding', 'em_execucao', 'em_revisao', 'entregue']

export type StatusTarefa = 'a_fazer' | 'fazendo' | 'feito'

export const STATUS_TAREFA: (Opcao<StatusTarefa> & { cor: string })[] = [
  { valor: 'a_fazer', rotulo: 'A fazer', cor: '#6c697a' },
  { valor: 'fazendo', rotulo: 'Fazendo', cor: '#e0b25c' },
  { valor: 'feito', rotulo: 'Feito', cor: '#5fbf8f' },
]

export type PublicoCurso = 'equipe' | 'clientes'

export const PUBLICOS_CURSO: Opcao<PublicoCurso>[] = [
  { valor: 'equipe', rotulo: 'Equipe' },
  { valor: 'clientes', rotulo: 'Clientes' },
]

/** Checklist sugerido quando o serviço nasce (o time ajusta depois). */
export const TAREFAS_PADRAO: Record<TipoServico, string[]> = {
  site: ['Reunião de briefing', 'Receber logo, fotos e textos', 'Layout para aprovação', 'Desenvolvimento', 'Revisão com o cliente', 'Publicar no domínio'],
  trafego: ['Reunião de briefing', 'Acesso ao Gerenciador de Anúncios', 'Instalar pixel e conversões', 'Criativos para aprovação', 'Subir campanhas', 'Primeiro relatório'],
  social_media: ['Reunião de briefing', 'Acesso às redes', 'Linha editorial', 'Calendário do mês', 'Posts para aprovação', 'Relatório do mês'],
  identidade_visual: ['Reunião de briefing', 'Pesquisa de referências', 'Proposta de logo', 'Ajustes', 'Manual da marca', 'Entrega dos arquivos'],
  google_meu_negocio: ['Acesso ao perfil', 'Fotos e informações', 'Categorias e serviços', 'Estratégia de avaliações', 'Primeiras postagens'],
  consultoria: ['Diagnóstico', 'Plano de ação', 'Encontro de acompanhamento', 'Relatório final'],
  mentoria: ['Encontro inicial', 'Plano da mentoria', 'Liberar acesso às aulas', 'Encontro de acompanhamento'],
  outro: ['Reunião de briefing', 'Execução', 'Entrega'],
}
