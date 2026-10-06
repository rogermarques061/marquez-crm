import { ArrowLeft, AtSign, ListChecks, Mail, MessageCircle, Plus, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ListaTarefas, Mural, Prazo } from '../../components/Execucao'
import { Bloco, Botao, Cabecalho, Carregando, Chips, Janela, MarcaEtapa, RotuloCampo, Selo, Trilha, classeCampo } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { SERVICOS, STATUS_CLIENTE, STATUS_SERVICO, TAREFAS_PADRAO, rotulo, type StatusCliente, type StatusServico, type TipoServico } from '../../lib/constantes'
import { formatarData, formatarMoeda, linkWhatsapp } from '../../lib/formatos'
import { resumoCliente } from '../../lib/metricas'
import type { Atualizacao, ClienteCompleto, Perfil, Servico, Tarefa } from '../../lib/tipos'

export default function ClienteDetalhe() {
  const { id = '' } = useParams()
  const { perfil } = useAuth()
  const [cliente, setCliente] = useState<ClienteCompleto | null | undefined>(undefined)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [mural, setMural] = useState<Atualizacao[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [novoServico, setNovoServico] = useState(false)
  const [convidar, setConvidar] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const c = await api.obterCliente(id)
      setCliente(c)
      if (!c) return
      const ids = c.servicos.map((s) => s.id)
      const [t, m] = await Promise.all([api.listarTarefas(ids), api.listarAtualizacoes(ids)])
      setTarefas(t)
      setMural(m)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [id])

  useEffect(() => {
    void carregar()
    api.listarPerfis().then(setPerfis).catch(() => {})
    const a = api.ouvirTarefas(() => void carregar())
    const b = api.ouvirAtualizacoes(() => void carregar())
    return () => {
      a()
      b()
    }
  }, [carregar])

  async function executar(f: () => Promise<unknown>) {
    setErro(null)
    try {
      await f()
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  if (cliente === undefined) return erro ? <p className="text-perigo">{erro}</p> : <Carregando />
  if (cliente === null) return <p className="text-apagado">Cliente não encontrado.</p>

  const equipe = perfis.filter((p) => p.papel !== 'cliente')
  const acessos = perfis.filter((p) => p.papel === 'cliente' && p.cliente_id === cliente.id)
  const r = resumoCliente(cliente)
  const admin = perfil?.papel === 'admin'

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <Link to="/painel/clientes" className="flex items-center gap-1.5 self-start text-sm text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo">
            Cliente desde {formatarData(cliente.inicio)}
            {r.mrr > 0 && ` · ${formatarMoeda(r.mrr)}/mês`}
          </p>
          <h1 className="titulo mt-2 text-[32px] leading-none break-words lg:text-[40px]">{cliente.nome}</h1>
        </div>
        <div className="flex gap-2">
          {cliente.contato?.whatsapp && (
            <a
              href={linkWhatsapp(cliente.contato.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="grid size-10 place-items-center rounded-md border border-ok/30 text-ok hover:bg-ok/[0.06]"
              title="WhatsApp"
            >
              <MessageCircle className="size-4" />
            </a>
          )}
          {cliente.contato?.instagram && (
            <a
              href={`https://instagram.com/${cliente.contato.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="grid size-10 place-items-center rounded-md border border-borda bg-cartao hover:border-borda-2"
              title="Instagram"
            >
              <AtSign className="size-4" />
            </a>
          )}
          {cliente.contato?.email && (
            <a href={`mailto:${cliente.contato.email}`} className="grid size-10 place-items-center rounded-md border border-borda bg-cartao hover:border-borda-2" title="E-mail">
              <Mail className="size-4" />
            </a>
          )}
        </div>
      </header>

      {erro && <p className="text-sm text-perigo">{erro}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          {cliente.servicos.map((s) => (
            <CartaoServico
              key={s.id}
              servico={s}
              tarefas={tarefas.filter((t) => t.servico_id === s.id)}
              equipe={equipe}
              admin={admin}
              executar={executar}
              aoMudar={() => void carregar()}
            />
          ))}
          <Botao variante="secundario" onClick={() => setNovoServico(true)} className="self-start">
            <Plus className="size-4" /> Novo serviço
          </Botao>

          <Bloco>
            <Cabecalho titulo="Mural do cliente" sub="Atualizações, entregas e recados — o cliente vê o que estiver marcado" />
            <div className="mt-5">
              <Mural
                atualizacoes={mural}
                servicos={cliente.servicos}
                perfis={perfis}
                euId={perfil?.id}
                equipeVendo
                podeApagarTudo={admin}
                aoMudar={() => void carregar()}
              />
            </div>
          </Bloco>
        </div>

        <aside className="flex flex-col gap-4 lg:gap-5">
          <Bloco>
            <Cabecalho titulo="Situação" />
            <div className="mt-4 flex flex-col gap-3">
              <Chips
                opcoes={STATUS_CLIENTE}
                valor={cliente.status}
                onChange={(v: StatusCliente) => void executar(() => api.atualizarCliente(cliente.id, { status: v }))}
                colunas={3}
              />
              <label className="block">
                <RotuloCampo>Responsável</RotuloCampo>
                <select
                  className={`${classeCampo} text-sm`}
                  value={cliente.responsavel_id ?? ''}
                  onChange={(e) => void executar(() => api.atualizarCliente(cliente.id, { responsavel_id: e.target.value || null }))}
                >
                  <option value="">Ninguém</option>
                  {equipe.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <RotuloCampo>Início (conta as semanas das aulas)</RotuloCampo>
                <input
                  type="date"
                  className={`${classeCampo} text-sm`}
                  value={cliente.inicio}
                  onChange={(e) => e.target.value && void executar(() => api.atualizarCliente(cliente.id, { inicio: e.target.value }))}
                />
              </label>
            </div>
          </Bloco>

          <Bloco>
            <Cabecalho titulo="Acesso do cliente" sub="Área com o andamento e as aulas" />
            <ul className="mt-4 flex flex-col gap-2">
              {acessos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-md border border-borda bg-cartao-2/40 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.nome}</p>
                    <p className="truncate text-xs text-apagado">{p.email}</p>
                  </div>
                  <Selo cor="ok">Ativo</Selo>
                </li>
              ))}
              {acessos.length === 0 && <li className="text-sm text-apagado">O cliente ainda não tem login.</li>}
            </ul>
            {admin && (
              <Botao variante="secundario" className="mt-3 w-full" onClick={() => setConvidar(true)}>
                <UserPlus className="size-4" /> Convidar o cliente
              </Botao>
            )}
          </Bloco>
        </aside>
      </div>

      {novoServico && (
        <Janela titulo="Novo serviço" fechar={() => setNovoServico(false)}>
          <FormServico
            clienteId={cliente.id}
            aoCriar={() => {
              setNovoServico(false)
              void carregar()
            }}
          />
        </Janela>
      )}

      {convidar && (
        <Janela titulo={`Acesso para ${cliente.nome}`} fechar={() => setConvidar(false)}>
          <ConvidarCliente
            clienteId={cliente.id}
            nomeSugerido={cliente.contato?.nome ?? ''}
            emailSugerido={cliente.contato?.email ?? ''}
            aoConvidar={() => {
              setConvidar(false)
              api.listarPerfis().then(setPerfis).catch(() => {})
            }}
          />
        </Janela>
      )}
    </div>
  )
}

function CartaoServico({
  servico: s,
  tarefas,
  equipe,
  admin,
  executar,
  aoMudar,
}: {
  servico: Servico
  tarefas: Tarefa[]
  equipe: Perfil[]
  admin: boolean
  executar: (f: () => Promise<unknown>) => Promise<void>
  aoMudar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const st = STATUS_SERVICO.find((x) => x.valor === s.status)!
  const feitas = tarefas.filter((t) => t.status === 'feito').length

  return (
    <Bloco>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold">
            <MarcaEtapa cor={st.cor} /> {s.nome}
          </h2>
          <p className="rotulo mt-1.5 text-[10px]">
            {rotulo(SERVICOS, s.tipo)} · {formatarMoeda(s.valor_projeto)}
            {s.valor_mensal > 0 && ` + ${formatarMoeda(s.valor_mensal)}/mês`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.prazo && <Prazo dia={s.prazo} feito={s.status === 'entregue'} />}
          <select
            aria-label="Status do serviço"
            className="h-9 rounded-md border border-borda bg-cartao-2 px-2.5 text-sm outline-none focus:border-prata-2"
            value={s.status}
            onChange={(e) => void executar(() => api.atualizarServico(s.id, { status: e.target.value as StatusServico }))}
          >
            {STATUS_SERVICO.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {s.descricao && !editando && <p className="mt-3 text-sm whitespace-pre-wrap text-suave">{s.descricao}</p>}

      <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-apagado tabular-nums">
        <span>
          {feitas}/{tarefas.length} tarefas concluídas
        </span>
        <button type="button" onClick={() => setEditando((x) => !x)} className="font-sans text-xs text-suave underline underline-offset-4 hover:text-texto">
          {editando ? 'Fechar edição' : 'Editar serviço'}
        </button>
      </div>
      <Trilha pct={tarefas.length ? (feitas / tarefas.length) * 100 : 0} />

      {editando && (
        <EditarServico
          servico={s}
          equipe={equipe}
          admin={admin}
          executar={executar}
          fechar={() => setEditando(false)}
        />
      )}

      <div className="mt-4">
        {tarefas.length === 0 && (
          <button
            type="button"
            onClick={() => void executar(() => api.criarTarefas(s.id, TAREFAS_PADRAO[s.tipo]))}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-borda-2 py-3 text-sm text-suave hover:border-prata-2 hover:text-texto"
          >
            <ListChecks className="size-4" /> Usar o checklist padrão de {rotulo(SERVICOS, s.tipo).toLowerCase()}
          </button>
        )}
        <ListaTarefas tarefas={tarefas} servicoId={s.id} equipe={equipe} editavel aoMudar={aoMudar} />
      </div>
    </Bloco>
  )
}

function EditarServico({
  servico: s,
  equipe,
  admin,
  executar,
  fechar,
}: {
  servico: Servico
  equipe: Perfil[]
  admin: boolean
  executar: (f: () => Promise<unknown>) => Promise<void>
  fechar: () => void
}) {
  const [f, setF] = useState({
    nome: s.nome,
    descricao: s.descricao ?? '',
    projeto: String(s.valor_projeto || ''),
    mensal: String(s.valor_mensal || ''),
    prazo: s.prazo ?? '',
    responsavel: s.responsavel_id ?? '',
  })
  const [excluir, setExcluir] = useState(false)
  const numero = (v: string) => Math.max(0, Number(v.replace(/\./g, '').replace(',', '.')) || 0)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    await executar(() =>
      api.atualizarServico(s.id, {
        nome: f.nome.trim() || s.nome,
        descricao: f.descricao.trim() || null,
        valor_projeto: numero(f.projeto),
        valor_mensal: numero(f.mensal),
        prazo: f.prazo || null,
        responsavel_id: f.responsavel || null,
      }),
    )
    fechar()
  }

  return (
    <form onSubmit={salvar} className="mt-4 grid gap-3 rounded-md border border-borda bg-cartao-2/40 p-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <RotuloCampo>Nome</RotuloCampo>
        <input className={`${classeCampo} text-sm`} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
      </label>
      <label className="block sm:col-span-2">
        <RotuloCampo>Escopo (o cliente vê)</RotuloCampo>
        <textarea className={`${classeCampo} min-h-20 text-sm`} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      </label>
      <label className="block">
        <RotuloCampo>Projeto R$</RotuloCampo>
        <input inputMode="decimal" className={`${classeCampo} text-sm`} value={f.projeto} onChange={(e) => setF({ ...f, projeto: e.target.value.replace(/[^\d.,]/g, '') })} />
      </label>
      <label className="block">
        <RotuloCampo>Mensalidade R$</RotuloCampo>
        <input inputMode="decimal" className={`${classeCampo} text-sm`} value={f.mensal} onChange={(e) => setF({ ...f, mensal: e.target.value.replace(/[^\d.,]/g, '') })} />
      </label>
      <label className="block">
        <RotuloCampo>Prazo de entrega</RotuloCampo>
        <input type="date" className={`${classeCampo} text-sm`} value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
      </label>
      <label className="block">
        <RotuloCampo>Responsável</RotuloCampo>
        <select className={`${classeCampo} text-sm`} value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })}>
          <option value="">Ninguém</option>
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Botao type="submit">Salvar serviço</Botao>
        {admin &&
          (excluir ? (
            <>
              <span className="ml-auto text-sm text-suave">Excluir com as tarefas?</span>
              <Botao variante="perigo" onClick={() => void executar(() => api.excluirServico(s.id))}>
                Excluir
              </Botao>
            </>
          ) : (
            <Botao variante="fantasma" className="ml-auto text-perigo/80 hover:text-perigo" onClick={() => setExcluir(true)}>
              <Trash2 className="size-4" /> Excluir serviço
            </Botao>
          ))}
      </div>
    </form>
  )
}

function FormServico({ clienteId, aoCriar }: { clienteId: string; aoCriar: () => void }) {
  const [tipo, setTipo] = useState<TipoServico>('site')
  const [nome, setNome] = useState('')
  const [projeto, setProjeto] = useState('')
  const [mensal, setMensal] = useState('')
  const [prazo, setPrazo] = useState('')
  const [checklist, setChecklist] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const numero = (v: string) => Math.max(0, Number(v.replace(/\./g, '').replace(',', '.')) || 0)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const s = await api.criarServico({
        cliente_id: clienteId,
        tipo,
        nome: nome.trim() || rotulo(SERVICOS, tipo),
        valor_projeto: numero(projeto),
        valor_mensal: numero(mensal),
        prazo: prazo || null,
        status: 'onboarding',
      })
      if (checklist) await api.criarTarefas(s.id, TAREFAS_PADRAO[tipo])
      aoCriar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-4">
      <div>
        <RotuloCampo>Tipo</RotuloCampo>
        <Chips opcoes={SERVICOS} valor={tipo} onChange={setTipo} colunas={2} />
      </div>
      <label className="block">
        <RotuloCampo>Nome (opcional)</RotuloCampo>
        <input className={classeCampo} placeholder={rotulo(SERVICOS, tipo)} value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <RotuloCampo>Projeto R$</RotuloCampo>
          <input inputMode="decimal" className={classeCampo} placeholder="0" value={projeto} onChange={(e) => setProjeto(e.target.value.replace(/[^\d.,]/g, ''))} />
        </label>
        <label className="block">
          <RotuloCampo>Mensalidade R$</RotuloCampo>
          <input inputMode="decimal" className={classeCampo} placeholder="0" value={mensal} onChange={(e) => setMensal(e.target.value.replace(/[^\d.,]/g, ''))} />
        </label>
      </div>
      <label className="block">
        <RotuloCampo>Prazo de entrega</RotuloCampo>
        <input type="date" className={classeCampo} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm text-suave">
        <input type="checkbox" className="size-4 accent-[#bdbac9]" checked={checklist} onChange={(e) => setChecklist(e.target.checked)} />
        Já criar o checklist padrão ({TAREFAS_PADRAO[tipo].length} tarefas)
      </label>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <Botao type="submit" disabled={salvando}>
        {salvando ? 'Criando…' : 'Criar serviço'}
      </Botao>
    </form>
  )
}

function ConvidarCliente({
  clienteId,
  nomeSugerido,
  emailSugerido,
  aoConvidar,
}: {
  clienteId: string
  nomeSugerido: string
  emailSugerido: string
  aoConvidar: () => void
}) {
  const [nome, setNome] = useState(nomeSugerido)
  const [email, setEmail] = useState(emailSugerido)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      await api.convidarUsuario({ email: email.trim(), nome: nome.trim(), papel: 'cliente', cliente_id: clienteId })
      aoConvidar()
    } catch (e) {
      setErro((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <p className="text-sm text-suave">
        O cliente recebe um e-mail para criar a senha. Na área dele, vê o andamento do serviço, o mural e as aulas liberadas semana a semana.
      </p>
      <input className={classeCampo} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <input className={classeCampo} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <Botao type="submit" disabled={enviando || !email.includes('@')}>
        <UserPlus className="size-4" /> {enviando ? 'Enviando…' : 'Enviar convite'}
      </Botao>
    </form>
  )
}
