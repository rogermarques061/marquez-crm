import { ArrowLeft, ExternalLink, Footprints, LocateFixed, Navigation, Route, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, Carregando, Selo } from '../../../components/ui'
import {
  comprimentoRota,
  criarRota,
  excluirRota,
  formatarDistancia,
  infoNicho,
  linkComoChegar,
  listarRotas,
  melhoresRegioes,
  minhaLocalizacao,
  otimizarRota,
  paradasDaRota,
  reordenarRota,
  STATUS_RUA,
  trechosGoogleMaps,
  atualizarProspecto,
  virarLead,
  type Negocio,
  type Prospecto,
  type ResultadoBusca,
  type Rota,
  type StatusProspecto,
} from '../../../lib/prospeccao'
import Busca from './Busca'
import Mapa, { Legenda, LocalEncontrado, NoGoogleMaps } from './Mapa'

const RAIO_REGIAO = 400
const MAX_PARADAS = 25

export default function Rua() {
  const [rotaAberta, setRotaAberta] = useState<string | null>(null)
  if (rotaAberta) return <VerRota id={rotaAberta} voltar={() => setRotaAberta(null)} />
  return <Planejar abrirRota={setRotaAberta} />
}

/* ------------------------------------------------------------ planejar */

function Planejar({ abrirRota }: { abrirRota: (id: string) => void }) {
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null)
  const [rotas, setRotas] = useState<(Rota & { paradas: number; feitas: number })[] | null>(null)
  const [criando, setCriando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregarRotas = useCallback(() => {
    listarRotas()
      .then(setRotas)
      .catch((e: Error) => setErro(e.message))
  }, [])
  useEffect(carregarRotas, [carregarRotas])

  const regioes = useMemo(() => (resultado ? melhoresRegioes(resultado.negocios, RAIO_REGIAO) : []), [resultado])
  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    resultado?.negocios.forEach((n) => m.set(n.nicho, (m.get(n.nicho) ?? 0) + 1))
    return [...m.entries()].map(([nicho, n]) => ({ nicho: nicho as Negocio['nicho'], n })).sort((a, b) => b.n - a.n)
  }, [resultado])

  async function montar(i: number) {
    if (!resultado) return
    setCriando(i)
    setErro(null)
    try {
      const r = regioes[i]
      const maisPerto = [...r.negocios].sort((a, b) => dist(a, r.centro) - dist(b, r.centro)).slice(0, MAX_PARADAS)
      const ordem = otimizarRota(maisPerto)
      const nome = `${resultado.centro.nome.split(',')[0]} · região ${i + 1}`
      abrirRota(await criarRota(nome, r.centro, ordem))
    } catch (e) {
      setErro((e as Error).message)
      setCriando(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Busca aoEncontrar={setResultado} />
      {erro && <p className="text-sm text-perigo">{erro}</p>}

      {resultado && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-suave">
              <strong className="titulo text-lg text-texto">{resultado.negocios.length}</strong> negócios em até{' '}
              {formatarDistancia(resultado.raio)} de {resultado.centro.nome}
            </p>
            <Legenda nichos={contagem} />
          </div>
          <LocalEncontrado nome={resultado.centro.nome} fonte={resultado.fonte} aviso={resultado.aviso} />
          <NoGoogleMaps centro={resultado.centro} />
          <Mapa
            pontos={resultado.negocios.map((n) => ({ id: n.fonte_id, lat: n.lat, lng: n.lng, nome: n.nome, nicho: n.nicho }))}
            centro={resultado.centro}
            raio={resultado.raio}
            regioes={regioes.map((r, i) => ({ ...r.centro, raio: RAIO_REGIAO, rotulo: `${i + 1}` }))}
          />

          {resultado.negocios.length === 0 ? (
            <p className="py-6 text-center text-suave">Nenhum negócio desses nichos no mapa por aqui. Tente um raio maior ou outro bairro.</p>
          ) : (
            <section>
              <h2 className="rotulo mb-3">Melhores regiões para andar</h2>
              {regioes.length === 0 && <p className="text-sm text-suave">As lojas estão muito espalhadas. Tente um raio maior.</p>}
              <div className="grid gap-3 lg:grid-cols-3">
                {regioes.map((r, i) => {
                  const paradas = Math.min(r.negocios.length, MAX_PARADAS)
                  return (
                    <div key={i} className="flex flex-col rounded-md border border-borda bg-cartao p-4">
                      <div className="flex items-baseline gap-3">
                        <span className="titulo texto-prata text-[32px] leading-none">{i + 1}</span>
                        <div>
                          <p className="font-semibold">{r.negocios.length} lojas a pé</p>
                          <p className="text-xs text-apagado">num raio de {RAIO_REGIAO} m</p>
                        </div>
                      </div>
                      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                        {r.porNicho.slice(0, 5).map((p) => (
                          <li key={p.nicho} className="flex items-center gap-1.5 text-xs text-suave">
                            <span className="size-2 rounded-full" style={{ background: infoNicho(p.nicho).cor }} />
                            {p.n} {infoNicho(p.nicho).rotulo.toLowerCase()}
                          </li>
                        ))}
                      </ul>
                      <Botao onClick={() => void montar(i)} disabled={criando !== null} className="mt-4 w-full">
                        <Route className="size-4" />
                        {criando === i ? 'Montando…' : `Montar rota · ${paradas} paradas`}
                      </Botao>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      <section className="mt-2">
        <h2 className="rotulo mb-3">Minhas rotas</h2>
        {!rotas && <Carregando />}
        {rotas?.length === 0 && (
          <p className="rounded-md border border-dashed border-borda px-4 py-6 text-center text-sm text-apagado">
            Busque um bairro e monte sua primeira rota.
          </p>
        )}
        <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-md border border-borda bg-cartao empty:hidden">
          {rotas?.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => abrirRota(r.id)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-cartao-2">
                <Footprints className="size-5 shrink-0 text-apagado" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.nome}</p>
                  <p className="text-xs text-apagado">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="w-24">
                  <p className="text-right font-mono text-xs text-suave tabular-nums">
                    {r.feitas}/{r.paradas}
                  </p>
                  <div className="mt-1 h-1 bg-cartao-2">
                    <div className="prata h-full" style={{ width: `${r.paradas ? (r.feitas / r.paradas) * 100 : 0}%` }} />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot(a.lat - b.lat, a.lng - b.lng)

/* ----------------------------------------------------------- ver rota */

const ACOES: { status: StatusProspecto; rotulo: string; estilo: string }[] = [
  { status: 'contatado', rotulo: 'Visitei', estilo: 'border-borda-2 text-texto' },
  { status: 'interessado', rotulo: 'Interessado', estilo: 'border-alerta/40 text-alerta' },
  { status: 'vendido', rotulo: 'Virou lead', estilo: 'border-ok/40 text-ok' },
  { status: 'sem_interesse', rotulo: 'Não quis', estilo: 'border-perigo/30 text-perigo' },
]

function VerRota({ id, voltar }: { id: string; voltar: () => void }) {
  const navigate = useNavigate()
  const [paradas, setParadas] = useState<Prospecto[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [reordenando, setReordenando] = useState(false)

  const carregar = useCallback(() => {
    paradasDaRota(id)
      .then(setParadas)
      .catch((e: Error) => setErro(e.message))
  }, [id])
  useEffect(carregar, [carregar])

  if (!paradas) return <Carregando />

  const comPonto = paradas.filter((p) => p.lat != null && p.lng != null) as (Prospecto & { lat: number; lng: number })[]
  const pendentes = comPonto.filter((p) => p.status === 'novo')
  const feitas = paradas.length - paradas.filter((p) => p.status === 'novo').length
  const viraramLead = paradas.filter((p) => p.status === 'vendido').length
  const trechos = trechosGoogleMaps(pendentes)
  const proxima = pendentes[0]

  async function marcar(p: Prospecto, status: StatusProspecto) {
    setErro(null)
    setParadas((ps) => ps?.map((x) => (x.id === p.id ? { ...x, status } : x)) ?? null)
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

  async function reordenarDaqui() {
    setReordenando(true)
    setErro(null)
    try {
      const aqui = await minhaLocalizacao()
      const novaOrdem = [...paradas!.filter((p) => p.status !== 'novo'), ...otimizarRota(pendentes, aqui)]
      await reordenarRota(novaOrdem)
      carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setReordenando(false)
    }
  }

  async function excluir() {
    try {
      await excluirRota(id)
      voltar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={voltar} className="rotulo -ml-1 flex items-center gap-1.5 self-start py-1 hover:text-suave">
        <ArrowLeft className="size-3.5" /> Rotas
      </button>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-borda bg-borda">
        <Numero rotulo="Paradas" valor={`${feitas}/${paradas.length}`} />
        <Numero rotulo="Falta andar" valor={formatarDistancia(comprimentoRota(pendentes))} />
        <Numero rotulo="Leads" valor={String(viraramLead)} destaque={viraramLead > 0} />
      </div>

      <Mapa
        rota
        pontos={comPonto.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, nome: p.nome, nicho: p.nicho, ordem: p.ordem_rota ?? 0, apagado: p.status !== 'novo' }))}
        aoClicar={(pid) => {
          setAberta(pid)
          document.getElementById(`parada-${pid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
        altura="h-64 lg:h-[380px]"
      />

      {pendentes.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {trechos.map((t) => (
            <a key={t.de} href={t.url} target="_blank" rel="noreferrer" className="prata chanfro flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
              <Navigation className="size-4" />
              {trechos.length === 1 ? 'Abrir rota no Google Maps' : `Maps: paradas ${t.de}–${t.ate}`}
            </a>
          ))}
          <Botao variante="secundario" onClick={() => void reordenarDaqui()} disabled={reordenando}>
            <LocateFixed className="size-4" /> {reordenando ? 'Calculando…' : 'Refazer ordem a partir de onde estou'}
          </Botao>
        </div>
      )}
      {erro && <p className="text-sm text-perigo">{erro}</p>}

      <ol className="flex flex-col gap-2">
        {paradas.map((p) => {
          const ativa = aberta === p.id || (aberta === null && p.id === proxima?.id)
          const nicho = infoNicho(p.nicho)
          return (
            <li
              key={p.id}
              id={`parada-${p.id}`}
              className={`rounded-md border bg-cartao transition ${ativa ? 'border-borda-2' : 'border-borda'} ${p.status !== 'novo' ? 'opacity-70' : ''}`}
            >
              <button type="button" onClick={() => setAberta(ativa ? '' : p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-md font-mono text-xs font-bold text-fundo"
                  style={{ background: p.status === 'novo' ? nicho.cor : '#363441', color: p.status === 'novo' ? undefined : '#a19eb0' }}
                >
                  {p.ordem_rota}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.nome}</p>
                  <p className="truncate text-xs text-apagado">
                    {nicho.rotulo}
                    {p.endereco && ` · ${p.endereco}`}
                  </p>
                </div>
                {p.status !== 'novo' && (
                  <Selo cor={p.status === 'vendido' ? 'ok' : p.status === 'interessado' ? 'alerta' : p.status === 'sem_interesse' ? 'perigo' : 'neutro'}>
                    {STATUS_RUA[p.status]}
                  </Selo>
                )}
              </button>
              {ativa && (
                <div className="flex flex-col gap-3 border-t border-borda px-4 py-3">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {ACOES.map((a) => (
                      <button
                        key={a.status}
                        type="button"
                        onClick={() => void marcar(p, a.status)}
                        className={`rounded-md border px-2 py-2.5 text-sm font-medium transition ${a.estilo} ${
                          p.status === a.status ? 'bg-cartao-2 ring-1 ring-current' : 'hover:bg-cartao-2'
                        }`}
                      >
                        {a.rotulo}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {p.lat != null && p.lng != null && (
                      <a href={linkComoChegar({ lat: p.lat, lng: p.lng })} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-suave underline underline-offset-4 hover:text-texto">
                        <Navigation className="size-3.5" /> Como chegar
                      </a>
                    )}
                    {p.instagram && (
                      <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-suave underline underline-offset-4 hover:text-texto">
                        <ExternalLink className="size-3.5" /> @{p.instagram}
                      </a>
                    )}
                    {p.status !== 'novo' && (
                      <button type="button" onClick={() => void marcar(p, 'novo')} className="text-apagado underline underline-offset-4 hover:text-suave">
                        Desfazer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="mt-2 border-t border-borda pt-4">
        {confirmarExclusao ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-suave">Excluir a rota? As lojas que você já visitou continuam salvas.</p>
            <Botao variante="fantasma" onClick={() => setConfirmarExclusao(false)}>
              Voltar
            </Botao>
            <Botao variante="perigo" onClick={() => void excluir()}>
              Excluir rota
            </Botao>
          </div>
        ) : (
          <Botao variante="fantasma" onClick={() => setConfirmarExclusao(true)}>
            <Trash2 className="size-4" /> Excluir rota
          </Botao>
        )}
      </div>
    </div>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="bg-cartao p-4">
      <p className="rotulo text-[10px]">{rotulo}</p>
      <p className={`titulo mt-2 text-[24px] leading-none tabular-nums ${destaque ? 'text-ok' : ''}`}>{valor}</p>
    </div>
  )
}
