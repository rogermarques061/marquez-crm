import { AtSign, Briefcase, Mail, MessageCircle, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormContato from '../../components/FormContato'
import { Botao, Campo, Carregando, Gaveta, Janela, MarcaEtapa, Selo, Seletor, TituloPagina, Vazio } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ETAPAS, ORIGENS, SERVICOS, corEtapa, rotulo, type Origem } from '../../lib/constantes'
import { formatarMoeda, formatarWhatsapp, linkWhatsapp, nomeContato, tempoAtras } from '../../lib/formatos'
import type { ClienteCompleto, Contato, LeadCompleto, Perfil } from '../../lib/tipos'

export default function Contatos() {
  const navigate = useNavigate()
  const [contatos, setContatos] = useState<Contato[] | null>(null)
  const [leads, setLeads] = useState<LeadCompleto[]>([])
  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [equipe, setEquipe] = useState<Perfil[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState<Origem | ''>('')
  const [tag, setTag] = useState('')
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  const carregar = useCallback(() => {
    Promise.all([api.listarContatos(), api.listarLeads(), api.listarClientes()])
      .then(([c, l, cl]) => {
        setContatos(c)
        setLeads(l)
        setClientes(cl)
      })
      .catch((e: Error) => setErro(e.message))
  }, [])

  useEffect(() => {
    carregar()
    api.listarEquipe().then(setEquipe).catch(() => {})
  }, [carregar])

  const tags = useMemo(() => [...new Set((contatos ?? []).flatMap((c) => c.tags))].sort(), [contatos])
  const clientePorContato = useMemo(() => new Map(clientes.map((c) => [c.contato_id, c])), [clientes])

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const digitos = b.replace(/\D/g, '')
    return (contatos ?? []).filter(
      (c) =>
        (!b ||
          c.nome.toLowerCase().includes(b) ||
          c.empresa?.toLowerCase().includes(b) ||
          c.instagram?.includes(b.replace('@', '')) ||
          c.email?.includes(b) ||
          (digitos.length >= 3 && c.whatsapp?.includes(digitos))) &&
        (!origem || c.origem === origem) &&
        (!tag || c.tags.includes(tag)),
    )
  }, [contatos, busca, origem, tag])

  const contatoAberto = contatos?.find((c) => c.id === aberto) ?? null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TituloPagina sobre={`${contatos?.length ?? 0} contatos na agenda`} titulo="Contatos">
        <Botao onClick={() => setNovo(true)} className="py-2.5">
          <UserPlus className="size-4" /> Novo contato
        </Botao>
      </TituloPagina>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <label className="relative shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <input
            id="busca-contato"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, empresa, @ ou número"
            className="h-10 w-60 rounded-md border border-borda bg-cartao pr-3 pl-9 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
          />
        </label>
        <Seletor id="filtro-origem" valor={origem} onChange={(v) => setOrigem(v as Origem | '')} vazio="Origem">
          {ORIGENS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </Seletor>
        {tags.length > 0 && (
          <Seletor id="filtro-tag" valor={tag} onChange={setTag} vazio="Etiqueta">
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Seletor>
        )}
      </div>

      {erro && <p className="text-sm text-perigo">Erro: {erro}</p>}
      {!contatos && !erro && <Carregando />}
      {contatos && contatos.length === 0 && (
        <Vazio>Nenhum contato ainda. Cadastre aqui, crie um lead ou traga da prospecção.</Vazio>
      )}

      {contatos && contatos.length > 0 && (
        <div className="overflow-hidden rounded-md border border-borda bg-cartao">
          <div className="rotulo hidden grid-cols-[2fr_1.3fr_1fr_1.2fr_40px] gap-3 border-b border-borda px-5 py-3 text-[10px] lg:grid">
            <span>Contato</span>
            <span>WhatsApp</span>
            <span>Origem</span>
            <span>Situação</span>
            <span />
          </div>
          {filtrados.length === 0 && <p className="px-5 py-10 text-center text-sm text-apagado">Nenhum contato com esses filtros.</p>}
          <ul className="divide-y divide-borda">
            {filtrados.map((c) => {
              const cliente = clientePorContato.get(c.id)
              const leadAberto = leads.find((l) => l.contato_id === c.id && l.etapa !== 'ganho' && l.etapa !== 'perdido')
              return (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setAberto(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setAberto(c.id)}
                    className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 hover:bg-cartao-2 lg:grid-cols-[2fr_1.3fr_1fr_1.2fr_40px] lg:px-5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{nomeContato(c)}</div>
                      <div className="truncate font-mono text-[10.5px] text-apagado">
                        {c.empresa ? c.nome : c.segmento ?? '—'}
                        {c.tags.length > 0 && ` · ${c.tags.join(', ')}`}
                      </div>
                    </div>
                    <span className="hidden font-mono text-sm text-suave tabular-nums lg:inline">
                      {c.whatsapp ? formatarWhatsapp(c.whatsapp) : '—'}
                    </span>
                    <span className="hidden text-sm text-suave lg:inline">{rotulo(ORIGENS, c.origem)}</span>
                    <span>
                      {cliente ? (
                        <Selo cor="ok">Cliente</Selo>
                      ) : leadAberto ? (
                        <span className="flex items-center gap-2 text-sm text-suave">
                          <MarcaEtapa cor={corEtapa(leadAberto.etapa)} />
                          <span className="hidden sm:inline">{rotulo(ETAPAS, leadAberto.etapa)}</span>
                        </span>
                      ) : (
                        <Selo cor="neutro">Contato</Selo>
                      )}
                    </span>
                    {c.whatsapp ? (
                      <a
                        href={linkWhatsapp(c.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hidden size-8 place-items-center rounded-md text-apagado hover:bg-ok/10 hover:text-ok lg:grid"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    ) : (
                      <span className="hidden lg:block" />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {novo && (
        <Janela titulo="Novo contato" fechar={() => setNovo(false)}>
          <FormContato
            aoSalvar={(c) => {
              setNovo(false)
              carregar()
              setAberto(c.id)
            }}
          />
        </Janela>
      )}

      {contatoAberto && (
        <FichaContato
          contato={contatoAberto}
          leads={leads.filter((l) => l.contato_id === contatoAberto.id)}
          cliente={clientePorContato.get(contatoAberto.id) ?? null}
          equipe={equipe}
          fechar={() => setAberto(null)}
          aoMudar={carregar}
          irPara={navigate}
        />
      )}
    </div>
  )
}

function FichaContato({
  contato,
  leads,
  cliente,
  equipe,
  fechar,
  aoMudar,
  irPara,
}: {
  contato: Contato
  leads: LeadCompleto[]
  cliente: ClienteCompleto | null
  equipe: Perfil[]
  fechar: () => void
  aoMudar: () => void
  irPara: (para: string) => void
}) {
  const { perfil } = useAuth()
  const [editando, setEditando] = useState(false)
  const [anotacoes, setAnotacoes] = useState(contato.anotacoes ?? '')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function executar(f: () => Promise<unknown>) {
    setErro(null)
    try {
      await f()
      aoMudar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novoLead() {
    await executar(async () => {
      await api.criarLead({ contato_id: contato.id, etapa: 'novo' })
    })
    irPara('/painel/leads')
  }

  async function tornarCliente() {
    try {
      const id = await api.criarCliente(contato)
      irPara(`/painel/clientes/${id}`)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const responsavel = equipe.find((p) => p.id === contato.responsavel_id)?.nome

  return (
    <Gaveta
      sobre="Contato"
      titulo={nomeContato(contato)}
      sub={
        <>
          {contato.empresa ? `${contato.nome} · ` : ''}
          {rotulo(ORIGENS, contato.origem)} · {tempoAtras(contato.created_at)}
          {responsavel && ` · ${responsavel}`}
        </>
      }
      fechar={fechar}
    >
      {erro && <p className="text-sm text-perigo">{erro}</p>}

      {editando ? (
        <FormContato
          contato={contato}
          aoSalvar={() => {
            setEditando(false)
            aoMudar()
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {contato.whatsapp ? (
              <a
                href={linkWhatsapp(contato.whatsapp, `Oi, ${contato.nome.split(' ')[0]}! Aqui é da Marquez.`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-md border border-ok/30 py-3 text-sm font-semibold text-ok transition hover:bg-ok/[0.06]"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            ) : (
              <span className="flex items-center justify-center rounded-md border border-dashed border-borda py-3 text-xs text-apagado">Sem WhatsApp</span>
            )}
            {contato.instagram ? (
              <a
                href={`https://instagram.com/${contato.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-borda bg-cartao px-2 py-3 text-sm font-semibold text-texto"
              >
                <AtSign className="size-4 shrink-0" /> <span className="truncate">{contato.instagram}</span>
              </a>
            ) : contato.email ? (
              <a
                href={`mailto:${contato.email}`}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-borda bg-cartao px-2 py-3 text-sm font-semibold text-texto"
              >
                <Mail className="size-4 shrink-0" /> E-mail
              </a>
            ) : (
              <span className="flex items-center justify-center rounded-md border border-dashed border-borda py-3 text-xs text-apagado">Sem Instagram</span>
            )}
          </div>
          <dl className="-mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Dado rotulo="WhatsApp" valor={contato.whatsapp ? formatarWhatsapp(contato.whatsapp) : null} />
            <Dado rotulo="E-mail" valor={contato.email} />
            <Dado rotulo="Segmento" valor={contato.segmento} />
            <Dado rotulo="Cidade" valor={contato.cidade} />
            {contato.tags.length > 0 && <Dado rotulo="Etiquetas" valor={contato.tags.join(', ')} />}
          </dl>
          <Botao variante="secundario" onClick={() => setEditando(true)}>
            <Pencil className="size-4" /> Editar dados
          </Botao>
        </>
      )}

      <Campo titulo="Funil">
        <ul className="flex flex-col gap-2">
          {leads.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-md border border-borda bg-cartao px-3.5 py-3">
              <MarcaEtapa cor={corEtapa(l.etapa)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.titulo || rotulo(SERVICOS, l.servico)}</p>
                <p className="font-mono text-[11px] text-apagado">
                  {rotulo(ETAPAS, l.etapa)} · {formatarMoeda(l.valor_projeto)}
                  {l.valor_mensal > 0 && ` + ${formatarMoeda(l.valor_mensal)}/mês`}
                </p>
              </div>
            </li>
          ))}
          {leads.length === 0 && <li className="text-sm text-apagado">Nenhum lead para este contato.</li>}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Botao variante="secundario" onClick={() => void novoLead()}>
            <Plus className="size-4" /> Criar lead
          </Botao>
          {cliente ? (
            <Botao variante="secundario" onClick={() => irPara(`/painel/clientes/${cliente.id}`)}>
              <Briefcase className="size-4" /> Ver cliente
            </Botao>
          ) : (
            <Botao variante="secundario" onClick={() => void tornarCliente()}>
              <Briefcase className="size-4" /> Tornar cliente
            </Botao>
          )}
        </div>
      </Campo>

      <Campo titulo="Anotações">
        <textarea
          id="anotacoes-contato"
          className="min-h-28 w-full rounded-md border border-borda bg-cartao px-3.5 py-3 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
          placeholder="Preferências, quem decide, melhor horário para falar…"
          value={anotacoes}
          onChange={(e) => setAnotacoes(e.target.value)}
        />
        {anotacoes !== (contato.anotacoes ?? '') && (
          <Botao className="mt-2 w-full py-2.5" onClick={() => void executar(() => api.atualizarContato(contato.id, { anotacoes: anotacoes.trim() || null }))}>
            Salvar anotações
          </Botao>
        )}
      </Campo>

      {perfil?.papel === 'admin' && !cliente && (
        <div className="border-t border-borda pt-5">
          {confirmarExclusao ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-suave">Excluir o contato e os leads dele?</p>
              <Botao variante="fantasma" onClick={() => setConfirmarExclusao(false)}>
                Voltar
              </Botao>
              <Botao
                variante="perigo"
                onClick={() =>
                  void executar(async () => {
                    await api.excluirContato(contato.id)
                    fechar()
                  })
                }
              >
                Excluir
              </Botao>
            </div>
          ) : (
            <Botao variante="fantasma" className="px-0 text-perigo/80 hover:text-perigo" onClick={() => setConfirmarExclusao(true)}>
              <Trash2 className="size-4" /> Excluir contato
            </Botao>
          )}
        </div>
      )}
    </Gaveta>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="rotulo text-[9.5px]">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-suave">{valor || '—'}</dd>
    </div>
  )
}
