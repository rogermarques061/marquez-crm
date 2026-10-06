import { MessageCircle, MessagesSquare, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, Carregando, Selo, classeCampo } from '../../../components/ui'
import { formatarWhatsapp, linkWhatsapp } from '../../../lib/formatos'
import { mascaraInstagram, mascaraWhatsapp, soDigitos, whatsappValido } from '../../../lib/mascaras'
import {
  atualizarProspecto,
  criarContatoManual,
  excluirProspecto,
  infoNicho,
  linkProcurarContato,
  listarProspectos,
  NICHOS,
  salvarNoX1,
  STATUS_X1,
  type Negocio,
  type Nicho,
  type Prospecto,
  type ResultadoBusca,
  type StatusProspecto,
  virarLead,
} from '../../../lib/prospeccao'
import Busca from './Busca'
import { LocalEncontrado, NoGoogleMaps } from './Mapa'
import Roteiro, { type ModoRoteiro } from './Roteiro'

type Aba = 'buscar' | 'lista'
type Alvo = { negocio?: Negocio; prospecto?: Prospecto }

export default function X1() {
  const navigate = useNavigate()
  const [aba, setAba] = useState<Aba>('buscar')
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [soComTelefone, setSoComTelefone] = useState(true)
  const [salvos, setSalvos] = useState<Prospecto[] | null>(null)
  const [roteiro, setRoteiro] = useState<{ alvo: Alvo; modo: ModoRoteiro } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    listarProspectos('x1')
      .then(setSalvos)
      .catch((e: Error) => setErro(e.message))
  }, [])
  useEffect(carregar, [carregar])

  const porFonte = useMemo(() => new Map((salvos ?? []).filter((s) => s.fonte_id).map((s) => [s.fonte_id!, s])), [salvos])
  const encontrados = (resultado?.negocios ?? []).filter((n) => !soComTelefone || n.telefone)
  const comTelefone = resultado?.negocios.filter((n) => n.telefone).length ?? 0

  async function enviar(alvo: Alvo, modo: ModoRoteiro, texto: string) {
    const telefone = alvo.prospecto?.telefone ?? alvo.negocio!.telefone
    if (!telefone) return
    // Abre o WhatsApp na hora (precisa ser no clique) e registra em seguida
    window.open(linkWhatsapp(telefone, texto), '_blank', 'noopener')
    setRoteiro(null)
    try {
      const p = alvo.prospecto
      if (!p) await salvarNoX1(alvo.negocio!, 'contatado')
      else if (p.status === 'novo') await atualizarProspecto(p.id, { status: 'contatado' })
      // Mandou resposta pronta: a pessoa respondeu
      else if (modo === 'respostas' && p.status === 'contatado') await atualizarProspecto(p.id, { status: 'interessado' })
      carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const chamar = (alvo: Alvo) => setRoteiro({ alvo, modo: 'abertura' })
  const responder = (alvo: Alvo) => setRoteiro({ alvo, modo: 'respostas' })

  async function marcar(p: Prospecto, status: StatusProspecto) {
    setErro(null)
    setSalvos((ss) => ss?.map((x) => (x.id === p.id ? { ...x, status } : x)) ?? null)
    try {
      if (status === 'vendido') {
        await virarLead(p.id)
        navigate('/painel/leads')
      } else {
        await atualizarProspecto(p.id, { status })
      }
    } catch (e) {
      setErro((e as Error).message)
      carregar()
    }
  }

  const contagemLista = salvos?.length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-6 border-b border-borda">
        {(
          [
            ['buscar', 'Buscar contatos'],
            ['lista', `Minha lista`],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            onClick={() => setAba(v)}
            className={`relative -mb-px flex items-center gap-2 pb-3 text-sm ${aba === v ? 'font-semibold text-white' : 'text-apagado hover:text-suave'}`}
          >
            {r}
            {v === 'lista' && <span className="font-mono text-[11px] tabular-nums">{contagemLista}</span>}
            {aba === v && <span className="prata absolute right-0 bottom-0 left-0 h-0.5" />}
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-perigo">{erro}</p>}

      {aba === 'buscar' && (
        <>
          <Busca aoEncontrar={setResultado} />
          {resultado && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-suave">
                  <strong className="titulo text-lg text-texto">{resultado.negocios.length}</strong> negócios ·{' '}
                  <strong className="text-texto">{comTelefone}</strong> com telefone
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-suave">
                  <input type="checkbox" className="size-4 accent-[#bdbac9]" checked={soComTelefone} onChange={(e) => setSoComTelefone(e.target.checked)} />
                  Só com telefone
                </label>
              </div>
              <LocalEncontrado nome={resultado.centro.nome} fonte={resultado.fonte} aviso={resultado.aviso} />
              <NoGoogleMaps centro={resultado.centro} />
              {encontrados.length === 0 && (
                <p className="rounded-md border border-dashed border-borda px-4 py-6 text-center text-sm text-apagado">
                  Nenhum negócio com telefone no mapa aqui. Desmarque "Só com telefone" para procurar o contato de cada um.
                </p>
              )}
              <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-md border border-borda bg-cartao empty:hidden">
                {encontrados.map((n) => {
                  const salvo = porFonte.get(n.fonte_id)
                  return (
                    <LinhaContato
                      key={n.fonte_id}
                      nome={n.nome}
                      nicho={n.nicho}
                      detalhe={n.endereco}
                      telefone={salvo?.telefone ?? n.telefone}
                      status={salvo?.status}
                      aoChamar={() => chamar(salvo ? { prospecto: salvo } : { negocio: n })}
                      aoResponder={salvo ? () => responder({ prospecto: salvo }) : undefined}
                      procurar={linkProcurarContato(n.nome, n.endereco)}
                      aoMarcar={salvo ? (s) => void marcar(salvo, s) : undefined}
                    />
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}

      {aba === 'lista' && (
        <MinhaLista
          salvos={salvos}
          aoChamar={(p) => chamar({ prospecto: p })}
          aoResponder={(p) => responder({ prospecto: p })}
          aoMarcar={(p, s) => void marcar(p, s)}
          recarregar={carregar}
        />
      )}

      {roteiro && (
        <Roteiro
          nome={roteiro.alvo.prospecto?.nome ?? roteiro.alvo.negocio!.nome}
          nicho={roteiro.alvo.prospecto?.nicho ?? roteiro.alvo.negocio!.nicho}
          modo={roteiro.modo}
          aoEnviar={(texto) => void enviar(roteiro.alvo, roteiro.modo, texto)}
          aoFechar={() => setRoteiro(null)}
        />
      )}
    </div>
  )
}

function LinhaContato({
  nome,
  nicho,
  detalhe,
  telefone,
  status,
  aoChamar,
  aoResponder,
  procurar,
  aoMarcar,
  aoExcluir,
}: {
  nome: string
  nicho: Nicho
  detalhe: string | null
  telefone: string | null
  status?: StatusProspecto
  aoChamar: () => void
  aoResponder?: () => void
  procurar?: string
  aoMarcar?: (s: StatusProspecto) => void
  aoExcluir?: () => void
}) {
  const info = infoNicho(nicho)
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: info.cor }} />
          <span className="truncate font-semibold">{nome}</span>
          {status && status !== 'novo' && (
            <Selo cor={status === 'vendido' ? 'ok' : status === 'interessado' ? 'alerta' : status === 'sem_interesse' ? 'perigo' : 'neutro'}>
              {STATUS_X1[status]}
            </Selo>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-apagado">
          {info.rotulo}
          {telefone && <span className="font-mono"> · {formatarWhatsapp(telefone)}</span>}
          {detalhe && ` · ${detalhe}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {telefone ? (
          <button
            type="button"
            onClick={aoChamar}
            className="flex items-center gap-1.5 rounded-md border border-ok/35 px-3 py-2 text-sm font-semibold text-ok transition hover:bg-ok/[0.08]"
          >
            <MessageCircle className="size-4" /> {status && status !== 'novo' ? 'Chamar de novo' : 'Chamar no WhatsApp'}
          </button>
        ) : (
          procurar && (
            <a href={procurar} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-borda-2 px-3 py-2 text-sm text-suave hover:text-texto">
              <Search className="size-4" /> Procurar contato
            </a>
          )
        )}
        {telefone && aoResponder && status && status !== 'novo' && status !== 'vendido' && (
          <button
            type="button"
            onClick={aoResponder}
            className="flex items-center gap-1.5 rounded-md border border-borda-2 px-3 py-2 text-sm font-medium text-texto transition hover:bg-cartao-2"
          >
            <MessagesSquare className="size-4" /> Respostas
          </button>
        )}
        {aoMarcar && status && status !== 'novo' && (
          <>
            <MiniAcao ativo={status === 'interessado'} onClick={() => aoMarcar('interessado')} cor="text-alerta">
              Respondeu
            </MiniAcao>
            <MiniAcao ativo={status === 'vendido'} onClick={() => aoMarcar('vendido')} cor="text-ok">
              Virou lead
            </MiniAcao>
            <MiniAcao ativo={status === 'sem_interesse'} onClick={() => aoMarcar('sem_interesse')} cor="text-perigo">
              Não quis
            </MiniAcao>
          </>
        )}
        {aoExcluir && (
          <button type="button" onClick={aoExcluir} title="Tirar da lista" className="grid size-9 place-items-center rounded-md text-apagado hover:bg-perigo/10 hover:text-perigo">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  )
}

function MiniAcao({ ativo, onClick, cor, children }: { ativo: boolean; onClick: () => void; cor: string; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-2 text-xs font-medium ${cor} ${ativo ? 'border-current bg-cartao-2' : 'border-borda hover:bg-cartao-2'}`}
    >
      {children}
    </button>
  )
}

const FILTROS: { valor: StatusProspecto | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'novo', rotulo: 'Não chamados' },
  { valor: 'contatado', rotulo: 'Enviados' },
  { valor: 'interessado', rotulo: 'Responderam' },
  { valor: 'vendido', rotulo: 'Viraram lead' },
  { valor: 'sem_interesse', rotulo: 'Não quiseram' },
]

function MinhaLista({
  salvos,
  aoChamar,
  aoResponder,
  aoMarcar,
  recarregar,
}: {
  salvos: Prospecto[] | null
  aoChamar: (p: Prospecto) => void
  aoResponder: (p: Prospecto) => void
  aoMarcar: (p: Prospecto, s: StatusProspecto) => void
  recarregar: () => void
}) {
  const [filtro, setFiltro] = useState<StatusProspecto | 'todos'>('todos')
  const [novo, setNovo] = useState(false)
  if (!salvos) return <Carregando />

  const lista = salvos.filter((s) => filtro === 'todos' || s.status === filtro)
  const n = (s: StatusProspecto | 'todos') => (s === 'todos' ? salvos.length : salvos.filter((x) => x.status === s).length)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs ${filtro === f.valor ? 'border-borda-2 bg-cartao-2 font-semibold text-white' : 'border-borda text-apagado'}`}
            >
              {f.rotulo} <span className="font-mono tabular-nums">{n(f.valor)}</span>
            </button>
          ))}
        </div>
        <Botao variante="secundario" onClick={() => setNovo((x) => !x)}>
          <Plus className="size-4" /> Adicionar contato
        </Botao>
      </div>

      {novo && (
        <NovoContato
          aoSalvar={() => {
            setNovo(false)
            recarregar()
          }}
        />
      )}

      {lista.length === 0 ? (
        <p className="rounded-md border border-dashed border-borda px-4 py-6 text-center text-sm text-apagado">
          {salvos.length === 0
            ? 'Quem você chamar pela busca aparece aqui. Também dá para adicionar contatos do Instagram.'
            : 'Ninguém nesse filtro.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-md border border-borda bg-cartao">
          {lista.map((p) => (
            <LinhaContato
              key={p.id}
              nome={p.nome}
              nicho={p.nicho}
              detalhe={p.instagram ? `@${p.instagram}` : p.endereco}
              telefone={p.telefone}
              status={p.status}
              aoChamar={() => aoChamar(p)}
              aoResponder={() => aoResponder(p)}
              procurar={linkProcurarContato(p.nome, p.endereco)}
              aoMarcar={(s) => aoMarcar(p, s)}
              aoExcluir={() => void excluirProspecto(p.id).then(recarregar)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function NovoContato({ aoSalvar }: { aoSalvar: () => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [nicho, setNicho] = useState<Nicho>('nail')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (nome.trim().length < 2) return setErro('Digite o nome.')
    if (!whatsappValido(telefone)) return setErro('WhatsApp inválido: confira o DDD e o número.')
    setSalvando(true)
    try {
      await criarContatoManual({ nome: nome.trim(), telefone: soDigitos(telefone), nicho, instagram: instagram.replace(/^@/, '') || null })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3 rounded-md border border-borda-2 bg-cartao p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input id="contato-nome" className={classeCampo} placeholder="Nome do negócio" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="relative">
          <Phone className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-apagado" />
          <input
            id="contato-whatsapp"
            className={`${classeCampo} pl-10`}
            type="tel"
            inputMode="numeric"
            placeholder="(11) 98765-4321"
            value={telefone}
            onChange={(e) => setTelefone(mascaraWhatsapp(e.target.value))}
          />
        </div>
        <input id="contato-instagram" className={classeCampo} placeholder="@instagram (opcional)" value={instagram} onChange={(e) => setInstagram(mascaraInstagram(e.target.value))} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select id="contato-nicho" value={nicho} onChange={(e) => setNicho(e.target.value as Nicho)} className="h-10 rounded-md border border-borda bg-cartao-2 px-3 text-sm outline-none focus:border-prata-2">
          {NICHOS.map((n) => (
            <option key={n.valor} value={n.valor}>
              {n.rotulo}
            </option>
          ))}
        </select>
        {erro && <span className="text-sm text-perigo">{erro}</span>}
        <Botao type="submit" disabled={salvando} className="ml-auto">
          {salvando ? 'Salvando…' : 'Salvar contato'}
        </Botao>
      </div>
    </form>
  )
}
