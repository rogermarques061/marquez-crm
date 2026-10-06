import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, Crown, Plus, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Prazo } from '../../components/Execucao'
import { Bloco, Cabecalho, Carregando, Chips, MarcaEtapa, Trilha } from '../../components/ui'
import { api, hojeISO, inicioDoMes } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ETAPAS, rotulo } from '../../lib/constantes'
import { formatarMoeda, nomeContato, tempoAtras } from '../../lib/formatos'
import { calcularMetricas, type Metricas, type PeriodoRanking } from '../../lib/metricas'
import type { Tarefa } from '../../lib/tipos'

// Cores dos gráficos (validadas para o fundo escuro)
const EIXO = '#6c697a'
const GRADE = '#23222b'

const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
const dataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
const quando = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })

type TarefaAberta = Tarefa & { servico: { nome: string; cliente: { id: string; nome: string } } }

export default function Dashboard() {
  const { perfil } = useAuth()
  const [m, setM] = useState<Metricas | null>(null)
  const [tarefas, setTarefas] = useState<TarefaAberta[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const carregar = () =>
      Promise.all([api.listarLeads(), api.listarClientes(), api.listarEquipe(), api.obterMeta(inicioDoMes()), api.tarefasAbertas()])
        .then(([l, c, e, meta, t]) => {
          setM(calcularMetricas(l, c, e, meta))
          setTarefas(t)
        })
        .catch((e: Error) => setErro(e.message))
    void carregar()
    const a = api.ouvirLeads(() => void carregar())
    const b = api.ouvirTarefas(() => void carregar())
    return () => {
      a()
      b()
    }
  }, [])

  if (erro) return <p className="text-perigo">Não foi possível carregar a visão geral: {erro}</p>
  if (!m) return <Carregando />

  const variacao = m.fechadoMesAnteriorAteHoje ? ((m.fechadoMes - m.fechadoMesAnteriorAteHoje) / m.fechadoMesAnteriorAteHoje) * 100 : null
  const agora = new Date()
  const mes = nomeMes.format(agora)
  const hoje = hojeISO()
  const urgentes = tarefas.filter((t) => t.prazo && t.prazo <= hoje).slice(0, 6)
  const metaReceita = m.meta?.receita ?? 0
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  const esperadoAteHoje = metaReceita * (agora.getDate() / diasNoMes)

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rotulo">{dataLonga.format(agora)}</p>
          <h1 className="titulo mt-2 text-[32px] leading-none lg:text-[40px]">Olá, {perfil?.nome.split(' ')[0]}.</h1>
        </div>
        <Link to="/painel/leads?novo=1" className="prata chanfro flex items-center gap-2 px-4 py-2.5 text-sm font-semibold lg:hidden">
          <Plus className="size-4" /> Novo lead
        </Link>
      </header>

      {/* Fechado no mês + meta */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Bloco className="lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="rotulo">Fechado em {mes}</p>
              <p className="titulo texto-prata mt-3 text-[44px] leading-none tabular-nums lg:text-[56px]">{formatarMoeda(m.fechadoMes)}</p>
            </div>
            <div className="text-right text-sm">
              {variacao !== null && <Variacao pct={variacao} />}
              <p className="mt-1 text-xs text-apagado">vs. {formatarMoeda(m.fechadoMesAnteriorAteHoje)} no mesmo período do mês passado</p>
            </div>
          </div>
          {metaReceita > 0 && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] text-apagado tabular-nums">
                <span>
                  Meta {formatarMoeda(metaReceita)} · {Math.round((m.fechadoMes / metaReceita) * 100)}%
                </span>
                <span className={m.fechadoMes >= esperadoAteHoje ? 'text-ok' : 'text-alerta'}>
                  {m.fechadoMes >= metaReceita
                    ? 'Meta batida!'
                    : m.fechadoMes >= esperadoAteHoje
                      ? 'No ritmo'
                      : `${formatarMoeda(esperadoAteHoje - m.fechadoMes)} abaixo do ritmo`}
                </span>
              </div>
              <Trilha pct={(m.fechadoMes / metaReceita) * 100} className="mt-2 h-1.5" />
            </div>
          )}
          <GraficoDiario dados={m.porDia} />
          <p className="mt-2 text-[11px] text-apagado">Fechado = valor do projeto + primeira mensalidade de cada contrato ganho.</p>
        </Bloco>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-5">
          <Bloco>
            <p className="rotulo">Recorrente (MRR)</p>
            <p className="titulo mt-3 text-[34px] leading-none tabular-nums">
              {formatarMoeda(m.mrr)}
              <span className="ml-1 text-base font-semibold text-suave">/mês</span>
            </p>
            <p className="mt-2 text-sm text-suave">
              {m.clientesAtivos} cliente{m.clientesAtivos === 1 ? '' : 's'} ativo{m.clientesAtivos === 1 ? '' : 's'}
            </p>
          </Bloco>
          <Link
            to="/painel/clientes"
            className={`group rounded-md border p-5 transition lg:p-6 ${
              urgentes.length ? 'border-alerta/30 bg-alerta/[0.04] hover:border-alerta/50' : 'border-borda bg-cartao hover:border-borda-2'
            }`}
          >
            <p className="rotulo">Tarefas para hoje ou atrasadas</p>
            <div className="mt-3 flex items-end justify-between">
              <span className={`titulo text-[34px] leading-none tabular-nums ${urgentes.length ? 'text-alerta' : ''}`}>
                {tarefas.filter((t) => t.prazo && t.prazo <= hoje).length}
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-suave group-hover:text-texto">
                {urgentes.length ? 'Ver clientes' : 'Tudo em dia'} <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-borda bg-borda lg:grid-cols-4">
        <Indicador rotulo="Contratos no mês" valor={String(m.contratosMes)} detalhe={m.meta?.contratos ? `meta ${m.meta.contratos}` : undefined} />
        <Indicador rotulo="Reuniões no mês" valor={String(m.reunioesMes)} detalhe={m.meta?.reunioes ? `meta ${m.meta.reunioes}` : undefined} />
        <Indicador rotulo="Ticket médio" valor={formatarMoeda(m.ticketMedio)} detalhe={`contratos de ${mes}`} />
        <Indicador rotulo="Conversão" valor={m.conversao === null ? '—' : `${m.conversao.toFixed(0)}%`} detalhe="ganhos ÷ decididos, 90 dias" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Bloco>
          <div className="flex items-end justify-between gap-3">
            <Cabecalho titulo="Funil em aberto" sub={`${formatarMoeda(m.funil.reduce((s, f) => s + f.valor, 0))} em negociação`} />
            <Link to="/painel/leads" className="flex items-center gap-1 text-sm text-suave hover:text-texto">
              Leads <ArrowRight className="size-4" />
            </Link>
          </div>
          <ul className="mt-5 flex flex-col gap-4">
            {m.funil.map((f) => {
              const maior = Math.max(...m.funil.map((x) => x.leads), 1)
              return (
                <li key={f.etapa}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-suave">
                      <MarcaEtapa cor={f.cor} /> {f.rotulo}
                    </span>
                    <span className="font-mono text-xs text-apagado tabular-nums">
                      {f.leads} · {moedaCurta.format(f.valor)}
                    </span>
                  </div>
                  <Trilha pct={(f.leads / maior) * 100} />
                </li>
              )
            })}
          </ul>
        </Bloco>

        <Bloco>
          <Cabecalho titulo="Agenda e atenção" sub="Reuniões dos próximos 7 dias e leads parados" />
          <ul className="mt-5 flex flex-col gap-2">
            {m.proximasReunioes.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-md border border-borda bg-cartao-2/40 px-3.5 py-2.5">
                <CalendarClock className="size-4 shrink-0 text-prata-2" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nomeContato(l.contato)}</span>
                <span className="font-mono text-[11px] text-suave">{quando.format(new Date(l.data_reuniao!))}</span>
              </li>
            ))}
            {m.parados.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-md border border-borda bg-cartao-2/40 px-3.5 py-2.5">
                <AlertTriangle className="size-4 shrink-0 text-alerta" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-semibold">{nomeContato(l.contato)}</span>
                  <span className="text-apagado"> · {rotulo(ETAPAS, l.etapa)}</span>
                </span>
                <span className="font-mono text-[11px] text-apagado">parado {tempoAtras(l.updated_at)}</span>
              </li>
            ))}
            {urgentes.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/painel/clientes/${t.servico.cliente.id}`}
                  className="flex items-center gap-3 rounded-md border border-borda bg-cartao-2/40 px-3.5 py-2.5 hover:border-borda-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-semibold">{t.titulo}</span>
                    <span className="text-apagado"> · {t.servico.cliente.nome}</span>
                  </span>
                  <Prazo dia={t.prazo!} />
                </Link>
              </li>
            ))}
            {m.proximasReunioes.length + m.parados.length + urgentes.length === 0 && (
              <li className="py-4 text-sm text-apagado">Nada pendente. Bora prospectar!</li>
            )}
          </ul>
        </Bloco>
      </div>

      <Ranking ranking={m.ranking} eu={perfil?.id} mes={mes} />
    </div>
  )
}

/* ---------------------------------------------------------------- ranking */

const PERIODOS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'geral', rotulo: 'Geral' },
] as const

function Ranking({ ranking, eu, mes }: { ranking: Metricas['ranking']; eu?: string; mes: string }) {
  const [periodo, setPeriodo] = useState<PeriodoRanking>('mes')
  const lista = ranking[periodo]
  const lider = lista[0]
  const alguemFechou = (lider?.valor ?? 0) > 0 || (lider?.contratos ?? 0) > 0
  const texto = { hoje: 'hoje', mes: `em ${mes}`, geral: 'desde o início' }[periodo]

  return (
    <Bloco>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Cabecalho titulo="Ranking da equipe" sub={`Contratos fechados ${texto}`} />
        <div className="w-full sm:w-64">
          <Chips opcoes={PERIODOS} valor={periodo} onChange={setPeriodo} colunas={3} />
        </div>
      </div>

      {!alguemFechou && (
        <p className="mt-5 flex items-center gap-2 text-sm text-apagado">
          <Trophy className="size-4" /> Ninguém fechou {texto} ainda. O primeiro contrato assume a liderança.
        </p>
      )}

      <ol className="mt-5 flex flex-col gap-2">
        {lista.map((r, i) => {
          const primeiro = alguemFechou && i === 0
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3.5 rounded-md border px-3.5 py-3 lg:px-4 ${primeiro ? 'border-borda-2 bg-prata/[0.05]' : 'border-borda bg-cartao-2/40'}`}
            >
              <span className={`titulo w-8 text-center text-[24px] leading-none tabular-nums ${primeiro ? 'texto-prata' : 'text-apagado'}`}>
                {r.contratos > 0 ? `${i + 1}º` : '–'}
              </span>
              <div
                className={`chanfro chanfro-sm grid size-10 shrink-0 place-items-center font-display text-base font-bold ${primeiro ? 'prata' : 'bg-cartao-2 text-prata'}`}
              >
                {r.nome.trim()[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                    {r.nome}
                    {r.id === eu && <span className="font-normal text-apagado">(você)</span>}
                    {primeiro && <Crown className="size-4 shrink-0 text-prata" aria-label="Na liderança" />}
                  </span>
                  <span className="titulo text-lg leading-none tabular-nums lg:text-xl">{formatarMoeda(r.valor)}</span>
                </div>
                <Trilha pct={alguemFechou && lider.valor ? (r.valor / lider.valor) * 100 : 0} />
                <p className="mt-1.5 font-mono text-[11px] text-apagado tabular-nums">
                  {r.contratos} contrato{r.contratos === 1 ? '' : 's'}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </Bloco>
  )
}

/* ---------------------------------------------------------------- peças */

function Variacao({ pct }: { pct: number }) {
  const sobe = pct >= 0
  const Icone = sobe ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-sm font-semibold tabular-nums ${sobe ? 'text-ok' : 'text-perigo'}`}>
      <Icone className="size-4" />
      {sobe ? '+' : '−'}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="bg-cartao p-5 lg:p-6">
      <p className="rotulo text-[10px]">{rotulo}</p>
      <p className="titulo mt-3 text-[26px] leading-none tabular-nums lg:text-[30px]">{valor}</p>
      <p className="mt-2 min-h-4 text-[11px] text-apagado">{detalhe}</p>
    </div>
  )
}

function GraficoDiario({ dados }: { dados: Metricas['porDia'] }) {
  return (
    <div className="-mx-2 mt-8 h-56 lg:h-64" role="img" aria-label="Valor fechado por dia no mês atual">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%">
          <defs>
            <linearGradient id="barraPrata" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#c9c7d3" />
              <stop offset="100%" stopColor="#7a7590" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis
            dataKey="dia"
            tickLine={false}
            axisLine={{ stroke: GRADE }}
            tick={{ fill: EIXO, fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            tick={{ fill: EIXO, fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
            tickFormatter={(v: number) => moedaCurta.format(v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(233,231,240,0.05)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as Metricas['porDia'][number]
              if (d.futuro) return null
              return (
                <div className="rounded-md border border-borda-2 bg-cartao-2 px-3 py-2 shadow-xl">
                  <div className="rotulo text-[10px]">{d.rotulo}</div>
                  <div className="titulo mt-1 text-base text-white tabular-nums">{formatarMoeda(d.valor)}</div>
                  <div className="text-xs text-suave">
                    {d.contratos} contrato{d.contratos === 1 ? '' : 's'}
                  </div>
                </div>
              )
            }}
          />
          <Bar dataKey="valor" fill="url(#barraPrata)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
