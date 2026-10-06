import { AlertTriangle, ArrowRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, Chips, MarcaEtapa, Selo, TituloPagina, Trilha, Vazio } from '../../components/ui'
import { api } from '../../lib/api'
import { STATUS_CLIENTE, STATUS_SERVICO, rotulo, type StatusCliente } from '../../lib/constantes'
import { formatarMoeda } from '../../lib/formatos'
import { resumoCliente } from '../../lib/metricas'
import type { ClienteCompleto, Perfil } from '../../lib/tipos'

const FILTROS = [{ valor: 'todos', rotulo: 'Todos' }, ...STATUS_CLIENTE] as const

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteCompleto[] | null>(null)
  const [equipe, setEquipe] = useState<Perfil[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<StatusCliente | 'todos'>('ativo')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const carregar = () =>
      api
        .listarClientes()
        .then(setClientes)
        .catch((e: Error) => setErro(e.message))
    carregar()
    api.listarEquipe().then(setEquipe).catch(() => {})
    return api.ouvirTarefas(carregar)
  }, [])

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return (clientes ?? []).filter((c) => (filtro === 'todos' || c.status === filtro) && (!b || c.nome.toLowerCase().includes(b)))
  }, [clientes, filtro, busca])

  const mrrTotal = (clientes ?? []).reduce((s, c) => s + resumoCliente(c).mrr, 0)
  const nome = (id: string | null) => equipe.find((p) => p.id === id)?.nome

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TituloPagina
        sobre={`${(clientes ?? []).filter((c) => c.status === 'ativo').length} ativos · ${formatarMoeda(mrrTotal)}/mês recorrente`}
        titulo="Clientes"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-96">
          <Chips opcoes={FILTROS} valor={filtro} onChange={setFiltro} colunas={4} />
        </div>
        <label className="relative w-full sm:ml-auto sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <input
            id="busca-cliente"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente"
            className="h-10 w-full rounded-md border border-borda bg-cartao pr-3 pl-9 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
          />
        </label>
      </div>

      {erro && <p className="text-sm text-perigo">Erro: {erro}</p>}
      {!clientes && !erro && <Carregando />}
      {clientes && clientes.length === 0 && (
        <Vazio>Nenhum cliente ainda. Quando um lead vai para “Ganho”, ele vira cliente aqui com o serviço pronto para executar.</Vazio>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((c) => {
          const r = resumoCliente(c)
          return (
            <li key={c.id}>
              <Link
                to={`/painel/clientes/${c.id}`}
                className="group flex h-full flex-col rounded-md border border-borda bg-cartao p-4 transition hover:border-borda-2 lg:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold">{c.nome}</h2>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-apagado">
                      {nome(c.responsavel_id) ?? 'Sem responsável'}
                      {r.mrr > 0 && ` · ${formatarMoeda(r.mrr)}/mês`}
                    </p>
                  </div>
                  <Selo cor={c.status === 'ativo' ? 'ok' : c.status === 'pausado' ? 'alerta' : 'neutro'}>{rotulo(STATUS_CLIENTE, c.status)}</Selo>
                </div>
                <ul className="mt-4 flex flex-1 flex-col gap-1.5">
                  {c.servicos.map((s) => {
                    const st = STATUS_SERVICO.find((x) => x.valor === s.status)!
                    return (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        <MarcaEtapa cor={st.cor} />
                        <span className="min-w-0 flex-1 truncate text-suave">{s.nome}</span>
                        <span className="font-mono text-[10.5px] text-apagado">{st.rotulo}</span>
                      </li>
                    )
                  })}
                  {c.servicos.length === 0 && <li className="text-sm text-apagado">Nenhum serviço cadastrado.</li>}
                </ul>
                <div className="mt-4">
                  <div className="flex items-center justify-between font-mono text-[11px] text-apagado tabular-nums">
                    <span>
                      {r.feitas}/{r.tarefas} tarefas
                    </span>
                    {r.atrasadas > 0 ? (
                      <span className="flex items-center gap-1 text-perigo">
                        <AlertTriangle className="size-3.5" /> {r.atrasadas} atrasada{r.atrasadas === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <ArrowRight className="size-4 text-apagado transition group-hover:translate-x-0.5 group-hover:text-texto" />
                    )}
                  </div>
                  <Trilha pct={r.pct} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {clientes && clientes.length > 0 && lista.length === 0 && <p className="py-10 text-center text-sm text-apagado">Nenhum cliente nesse filtro.</p>}
    </div>
  )
}
