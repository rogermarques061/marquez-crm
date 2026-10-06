// Números da visão geral, calculados a partir dos leads e clientes.
import { hojeISO } from './api'
import { ETAPAS, SERVICO_ATIVO, type Etapa } from './constantes'
import type { ClienteCompleto, LeadCompleto, Meta, Perfil } from './tipos'

export type PeriodoRanking = 'hoje' | 'mes' | 'geral'

export interface LinhaRanking {
  id: string
  nome: string
  valor: number
  contratos: number
}

export interface Metricas {
  fechadoMes: number
  fechadoMesAnteriorAteHoje: number
  fechadoHoje: number
  contratosMes: number
  reunioesMes: number
  mrr: number
  clientesAtivos: number
  ticketMedio: number
  conversao: number | null
  meta: Meta | null
  porDia: { dia: string; rotulo: string; valor: number; contratos: number; futuro: boolean }[]
  funil: { etapa: Etapa; rotulo: string; cor: string; leads: number; valor: number }[]
  ranking: Record<PeriodoRanking, LinhaRanking[]>
  proximasReunioes: LeadCompleto[]
  parados: LeadCompleto[]
}

const valorLead = (l: LeadCompleto) => l.valor_projeto + l.valor_mensal
const rotuloDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })

export function calcularMetricas(leads: LeadCompleto[], clientes: ClienteCompleto[], equipe: Perfil[], meta: Meta | null, agora = new Date()): Metricas {
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
  const mesmoDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, agora.getDate(), agora.getHours(), agora.getMinutes())
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)

  const ganhos = leads.filter((l) => l.etapa === 'ganho' && l.ganho_em)
  const ganhoEm = (l: LeadCompleto) => new Date(l.ganho_em!)
  const doMes = ganhos.filter((l) => ganhoEm(l) >= inicioMes)
  const soma = (ls: LeadCompleto[]) => ls.reduce((s, l) => s + valorLead(l), 0)

  // Gráfico: um ponto por dia do mês
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  const porDia = Array.from({ length: diasNoMes }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth(), i + 1)
    const doDia = doMes.filter((l) => ganhoEm(l).getDate() === i + 1)
    return { dia: String(i + 1), rotulo: rotuloDia.format(d), valor: soma(doDia), contratos: doDia.length, futuro: d > agora }
  })

  // Funil aberto
  const abertos = leads.filter((l) => l.etapa !== 'ganho' && l.etapa !== 'perdido')
  const funil = ETAPAS.filter((e) => e.valor !== 'ganho' && e.valor !== 'perdido').map((e) => {
    const ls = abertos.filter((l) => l.etapa === e.valor)
    return { etapa: e.valor, rotulo: e.rotulo, cor: e.cor, leads: ls.length, valor: soma(ls) }
  })

  // Conversão dos últimos 90 dias: ganhos ÷ (ganhos + perdidos)
  const corte = new Date(agora.getTime() - 90 * 86400000)
  const g90 = ganhos.filter((l) => ganhoEm(l) >= corte).length
  const p90 = leads.filter((l) => l.etapa === 'perdido' && l.perdido_em && new Date(l.perdido_em) >= corte).length

  // Ranking: toda a equipe aparece, mesmo zerada
  const rankear = (ls: LeadCompleto[]): LinhaRanking[] =>
    equipe
      .map((p) => {
        const meus = ls.filter((l) => l.responsavel_id === p.id)
        return { id: p.id, nome: p.nome, valor: soma(meus), contratos: meus.length }
      })
      .sort((a, b) => b.valor - a.valor || b.contratos - a.contratos || a.nome.localeCompare(b.nome))

  // MRR: mensalidades de serviços ativos de clientes ativos
  const ativos = clientes.filter((c) => c.status === 'ativo')
  const mrr = ativos.reduce((s, c) => s + c.servicos.filter((x) => SERVICO_ATIVO.includes(x.status)).reduce((t, x) => t + x.valor_mensal, 0), 0)

  const daqui7 = new Date(agora.getTime() + 7 * 86400000)
  const proximasReunioes = abertos
    .filter((l) => l.data_reuniao && new Date(l.data_reuniao) >= inicioHoje && new Date(l.data_reuniao) <= daqui7)
    .sort((a, b) => a.data_reuniao!.localeCompare(b.data_reuniao!))

  const semana = new Date(agora.getTime() - 7 * 86400000)
  const parados = abertos
    .filter((l) => new Date(l.updated_at) < semana && (l.temperatura !== 'frio' || l.etapa !== 'novo'))
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .slice(0, 6)

  return {
    fechadoMes: soma(doMes),
    fechadoMesAnteriorAteHoje: soma(ganhos.filter((l) => ganhoEm(l) >= inicioMesAnterior && ganhoEm(l) <= mesmoDiaMesAnterior)),
    fechadoHoje: soma(doMes.filter((l) => ganhoEm(l) >= inicioHoje)),
    contratosMes: doMes.length,
    reunioesMes: leads.filter((l) => l.data_reuniao && new Date(l.data_reuniao) >= inicioMes && new Date(l.data_reuniao) < fimMes).length,
    mrr,
    clientesAtivos: ativos.length,
    ticketMedio: doMes.length ? soma(doMes) / doMes.length : 0,
    conversao: g90 + p90 ? (g90 / (g90 + p90)) * 100 : null,
    meta,
    porDia,
    funil,
    ranking: {
      hoje: rankear(doMes.filter((l) => ganhoEm(l) >= inicioHoje)),
      mes: rankear(doMes),
      geral: rankear(ganhos),
    },
    proximasReunioes,
    parados,
  }
}

/** Resumo de um cliente para listas e painéis. */
export function resumoCliente(c: ClienteCompleto) {
  const hoje = hojeISO()
  const ativos = c.servicos.filter((s) => SERVICO_ATIVO.includes(s.status))
  const tarefas = ativos.flatMap((s) => s.tarefas)
  const feitas = tarefas.filter((t) => t.status === 'feito').length
  return {
    mrr: c.status === 'ativo' ? ativos.reduce((s, x) => s + x.valor_mensal, 0) : 0,
    tarefas: tarefas.length,
    feitas,
    pct: tarefas.length ? (feitas / tarefas.length) * 100 : 0,
    atrasadas: tarefas.filter((t) => t.status !== 'feito' && t.prazo && t.prazo < hoje).length,
  }
}
