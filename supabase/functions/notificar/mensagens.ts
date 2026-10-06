// Textos das notificações de contrato fechado. Cada fechamento gera um aviso;
// quando o mês bate a meta (definida em Ajustes), o aviso vira comemoração.
// Para mudar os textos, é só editar as listas abaixo.

export interface DadosFechamento {
  lead_id: string
  cliente: string
  servico: string
  valor_projeto: number
  valor_mensal: number
  responsavel: string | null
  /** Fechado no mês (projeto + mensalidade) já contando este contrato. */
  total_mes: number
  /** Quantos contratos no mês, contando este. */
  contratos_mes: number
  /** Meta de receita do mês, se definida. */
  meta_mes: number | null
}

export interface Aviso {
  title: string
  body: string
  url: string
  tag: string
}

const TITULOS = [
  'Contrato fechado! Bora entregar.',
  'Mais um cliente na casa!',
  'Fechou! A agência não para.',
  'Plim! Novo contrato assinado.',
  'Mais um negócio que vai crescer com a gente.',
  'É contrato atrás de contrato!',
]

const TITULO_PRIMEIRO = 'Primeiro contrato do mês! Começou bem.'
const TITULO_META = 'META DO MÊS BATIDA! 🏆'
const TITULO_METADE = 'Metade da meta do mês! 🔥'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function valorContrato(d: Pick<DadosFechamento, 'valor_projeto' | 'valor_mensal'>) {
  if (d.valor_projeto && d.valor_mensal) return `${moeda.format(d.valor_projeto)} + ${moeda.format(d.valor_mensal)}/mês`
  if (d.valor_mensal) return `${moeda.format(d.valor_mensal)}/mês`
  return moeda.format(d.valor_projeto)
}

/** Marco que este contrato fez o mês cruzar: 'meta', 'metade' ou null. */
export function marco(d: Pick<DadosFechamento, 'total_mes' | 'valor_projeto' | 'valor_mensal' | 'meta_mes'>): 'meta' | 'metade' | null {
  if (!d.meta_mes) return null
  const antes = d.total_mes - d.valor_projeto - d.valor_mensal
  if (antes < d.meta_mes && d.total_mes >= d.meta_mes) return 'meta'
  if (antes < d.meta_mes / 2 && d.total_mes >= d.meta_mes / 2) return 'metade'
  return null
}

export function montarAviso(d: DadosFechamento): Aviso {
  const m = marco(d)
  const titulo =
    m === 'meta'
      ? TITULO_META
      : m === 'metade'
        ? TITULO_METADE
        : d.contratos_mes === 1
          ? TITULO_PRIMEIRO
          : TITULOS[(d.contratos_mes - 2) % TITULOS.length]

  const partes = [`${d.cliente} · ${d.servico}`, valorContrato(d)]
  if (d.meta_mes) partes.push(`mês em ${moeda.format(d.total_mes)} de ${moeda.format(d.meta_mes)}`)
  else partes.push(`${d.contratos_mes}º contrato do mês`)
  if (d.responsavel) partes.push(d.responsavel)
  return {
    title: titulo,
    body: partes.join(' · '),
    url: '/painel/leads',
    tag: `contrato-${d.lead_id}`,
  }
}
