// Peças da execução do serviço, usadas pela equipe (editando) e pelo cliente (acompanhando).
import { CalendarDays, Check, EyeOff, Link2, Plus, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { STATUS_TAREFA, type StatusTarefa } from '../lib/constantes'
import { diasAte, formatarData, tempoAtras } from '../lib/formatos'
import type { Atualizacao, Perfil, Servico, Tarefa } from '../lib/tipos'
import { Botao, classeCampo } from './ui'

const PROXIMO: Record<StatusTarefa, StatusTarefa> = { a_fazer: 'fazendo', fazendo: 'feito', feito: 'a_fazer' }

export function Prazo({ dia, feito }: { dia: string; feito?: boolean }) {
  const d = diasAte(dia)
  const cor = feito ? 'text-apagado' : d < 0 ? 'text-perigo' : d <= 2 ? 'text-alerta' : 'text-apagado'
  const texto = feito ? formatarData(dia) : d < 0 ? `atrasada ${-d}d` : d === 0 ? 'hoje' : d === 1 ? 'amanhã' : formatarData(dia)
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] tabular-nums ${cor}`}>
      <CalendarDays className="size-3" /> {texto}
    </span>
  )
}

/** Checklist do serviço. Tocar no quadrado avança: a fazer → fazendo → feito. */
export function ListaTarefas({
  tarefas,
  servicoId,
  equipe,
  editavel,
  aoMudar,
}: {
  tarefas: Tarefa[]
  servicoId: string
  equipe: Perfil[]
  editavel: boolean
  aoMudar: () => void
}) {
  const [nova, setNova] = useState('')
  const [abertaId, setAbertaId] = useState<string | null>(null)
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

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    const titulo = nova.trim()
    if (!titulo) return
    setNova('')
    await executar(() => api.criarTarefas(servicoId, [titulo]))
  }

  const nome = (id: string | null) => equipe.find((p) => p.id === id)?.nome.split(' ')[0]

  return (
    <div>
      <ul className="flex flex-col">
        {tarefas.map((t) => {
          const st = STATUS_TAREFA.find((x) => x.valor === t.status)!
          const aberta = abertaId === t.id
          return (
            <li key={t.id} className="border-b border-borda/60 last:border-b-0">
              <div className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  disabled={!editavel}
                  onClick={() => void executar(() => api.atualizarTarefa(t.id, { status: PROXIMO[t.status] }))}
                  title={editavel ? `${st.rotulo} — tocar para avançar` : st.rotulo}
                  className={`grid size-5 shrink-0 place-items-center rounded-[4px] border transition ${
                    t.status === 'feito' ? 'border-ok bg-ok text-fundo' : t.status === 'fazendo' ? 'border-alerta bg-alerta/15' : 'border-borda-2'
                  } ${editavel ? 'hover:border-prata-2' : 'cursor-default'}`}
                >
                  {t.status === 'feito' && <Check className="size-3.5" strokeWidth={3} />}
                  {t.status === 'fazendo' && <span className="size-1.5 rounded-full bg-alerta" />}
                </button>
                <button
                  type="button"
                  disabled={!editavel}
                  onClick={() => setAbertaId(aberta ? null : t.id)}
                  className={`min-w-0 flex-1 text-left text-sm ${t.status === 'feito' ? 'text-apagado line-through decoration-apagado/50' : 'text-texto'}`}
                >
                  {t.titulo}
                  {t.status === 'fazendo' && <span className="ml-2 font-mono text-[10.5px] text-alerta no-underline">fazendo</span>}
                </button>
                {!t.visivel_cliente && editavel && <EyeOff className="size-3.5 shrink-0 text-apagado" aria-label="Só a equipe vê" />}
                {editavel && nome(t.responsavel_id) && <span className="hidden font-mono text-[11px] text-apagado sm:inline">{nome(t.responsavel_id)}</span>}
                {t.prazo && <Prazo dia={t.prazo} feito={t.status === 'feito'} />}
              </div>
              {aberta && editavel && (
                <div className="mb-3 grid gap-2 rounded-md border border-borda bg-cartao-2/50 p-3 sm:grid-cols-2">
                  <label className="text-xs text-apagado">
                    Responsável
                    <select
                      className={`${classeCampo} mt-1 py-2 text-sm`}
                      value={t.responsavel_id ?? ''}
                      onChange={(e) => void executar(() => api.atualizarTarefa(t.id, { responsavel_id: e.target.value || null }))}
                    >
                      <option value="">Ninguém</option>
                      {equipe.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-apagado">
                    Prazo
                    <input
                      type="date"
                      className={`${classeCampo} mt-1 py-2 text-sm`}
                      value={t.prazo ?? ''}
                      onChange={(e) => void executar(() => api.atualizarTarefa(t.id, { prazo: e.target.value || null }))}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-suave sm:col-span-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#bdbac9]"
                      checked={t.visivel_cliente}
                      onChange={(e) => void executar(() => api.atualizarTarefa(t.id, { visivel_cliente: e.target.checked }))}
                    />
                    Cliente vê esta tarefa na área dele
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    {STATUS_TAREFA.map((s) => (
                      <button
                        key={s.valor}
                        type="button"
                        onClick={() => void executar(() => api.atualizarTarefa(t.id, { status: s.valor }))}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${t.status === s.valor ? 'border-prata-2 text-white' : 'border-borda text-apagado'}`}
                      >
                        {s.rotulo}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void executar(() => api.excluirTarefa(t.id))}
                      className="grid w-9 place-items-center rounded-md text-apagado hover:bg-perigo/10 hover:text-perigo"
                      title="Excluir tarefa"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
        {tarefas.length === 0 && <li className="py-2 text-sm text-apagado">{editavel ? 'Nenhuma tarefa ainda.' : 'O time ainda está montando o plano.'}</li>}
      </ul>
      {editavel && (
        <form onSubmit={adicionar} className="mt-2 flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-borda bg-cartao px-3 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
            placeholder="Nova tarefa"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          />
          <Botao type="submit" variante="secundario" className="px-3 py-2" disabled={!nova.trim()}>
            <Plus className="size-4" />
          </Botao>
        </form>
      )}
      {erro && <p className="mt-2 text-sm text-perigo">{erro}</p>}
    </div>
  )
}

/** Mural de atualizações do serviço: entregas, recados e links. */
export function Mural({
  atualizacoes,
  servicos,
  perfis,
  euId,
  equipeVendo,
  podeApagarTudo,
  aoMudar,
}: {
  atualizacoes: Atualizacao[]
  servicos: Servico[]
  perfis: Perfil[]
  euId?: string
  /** Equipe vê o seletor "visível ao cliente"; o cliente só manda recado. */
  equipeVendo: boolean
  podeApagarTudo?: boolean
  aoMudar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [link, setLink] = useState('')
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? '')
  const [visivel, setVisivel] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function publicar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const url = link.trim()
      await api.publicarAtualizacao({
        servico_id: servicoId || servicos[0].id,
        texto: texto.trim(),
        link: url ? (/^https?:\/\//.test(url) ? url : `https://${url}`) : null,
        visivel_cliente: equipeVendo ? visivel : true,
      })
      setTexto('')
      setLink('')
      aoMudar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const autor = (id: string | null) => perfis.find((p) => p.id === id)
  const nomeServico = (id: string) => servicos.find((s) => s.id === id)?.nome

  return (
    <div className="flex flex-col gap-4">
      {servicos.length > 0 && (
        <form onSubmit={publicar} className="flex flex-col gap-2 rounded-md border border-borda bg-cartao-2/40 p-3">
          <textarea
            className="min-h-20 w-full resize-y rounded-md border border-borda bg-cartao px-3 py-2.5 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
            placeholder={equipeVendo ? 'O que avançou? Entregas, pedidos, próximos passos…' : 'Mande um recado para o time…'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-40 flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-apagado" />
              <input
                className="h-9 w-full rounded-md border border-borda bg-cartao pr-2 pl-8 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
                placeholder="Link (opcional)"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </label>
            {servicos.length > 1 && (
              <select
                className="h-9 rounded-md border border-borda bg-cartao px-2 text-sm outline-none focus:border-prata-2"
                value={servicoId}
                onChange={(e) => setServicoId(e.target.value)}
                aria-label="Serviço"
              >
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            )}
            {equipeVendo && (
              <label className="flex items-center gap-1.5 text-xs text-suave">
                <input type="checkbox" className="size-4 accent-[#bdbac9]" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} />
                Cliente vê
              </label>
            )}
            <Botao type="submit" className="ml-auto px-3 py-2" disabled={enviando || !texto.trim()}>
              <Send className="size-4" /> Publicar
            </Botao>
          </div>
          {erro && <p className="text-sm text-perigo">{erro}</p>}
        </form>
      )}

      <ol className="flex flex-col gap-3">
        {atualizacoes.map((a) => {
          const quem = autor(a.autor_id)
          const doCliente = quem?.papel === 'cliente'
          return (
            <li key={a.id} className={`rounded-md border px-4 py-3 ${doCliente ? 'border-violeta/30 bg-violeta/[0.04]' : 'border-borda bg-cartao'}`}>
              <div className="flex items-center gap-2 font-mono text-[11px] text-apagado">
                <span className={`font-sans text-[13px] font-semibold ${doCliente ? 'text-violeta' : 'text-texto'}`}>{quem?.nome ?? 'Equipe'}</span>
                {servicos.length > 1 && <span className="truncate">· {nomeServico(a.servico_id)}</span>}
                <span className="ml-auto shrink-0">{tempoAtras(a.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-suave">{a.texto}</p>
              {a.link && (
                <a href={a.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm text-prata-2 underline underline-offset-4">
                  <Link2 className="size-3.5 shrink-0" /> <span className="truncate">{a.link.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              <div className="mt-1 flex items-center gap-3">
                {equipeVendo && !a.visivel_cliente && (
                  <span className="flex items-center gap-1 font-mono text-[10.5px] text-apagado">
                    <EyeOff className="size-3" /> só a equipe vê
                  </span>
                )}
                {(a.autor_id === euId || podeApagarTudo) && (
                  <button
                    type="button"
                    onClick={() => void api.excluirAtualizacao(a.id).then(aoMudar).catch((e: Error) => setErro(e.message))}
                    className="ml-auto text-[11px] text-apagado hover:text-perigo"
                  >
                    Apagar
                  </button>
                )}
              </div>
            </li>
          )
        })}
        {atualizacoes.length === 0 && <li className="text-sm text-apagado">Nenhuma atualização ainda.</li>}
      </ol>
    </div>
  )
}
