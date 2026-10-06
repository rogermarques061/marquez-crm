import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CalendarClock, Columns3, List, MessageCircle, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Barras, Botao, Carregando, MarcaEtapa, Seletor, TEMP_VISUAL, Temperatura, TituloPagina, Vazio } from '../../components/ui'
import { api } from '../../lib/api'
import { ETAPAS, SERVICOS, TEMPERATURAS, rotulo, type Etapa, type Temperatura as Temp, type TipoServico } from '../../lib/constantes'
import { formatarMoeda, linkWhatsapp, nomeContato } from '../../lib/formatos'
import type { LeadCompleto, Perfil } from '../../lib/tipos'
import LeadDetalhe from './LeadDetalhe'
import NovoLead from './NovoLead'

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })

type Visao = 'kanban' | 'lista'

interface Filtros {
  busca: string
  temperatura: Temp | ''
  servico: TipoServico | ''
  etapa: Etapa | ''
  responsavel: string
}

const SEM_FILTRO: Filtros = { busca: '', temperatura: '', servico: '', etapa: '', responsavel: '' }

function lerVisao(): Visao {
  try {
    return localStorage.getItem('leads-visao') === 'lista' ? 'lista' : 'kanban'
  } catch {
    return 'kanban'
  }
}

/** Valor do lead para somar no funil: projeto + 1 mensalidade. */
const valorLead = (l: LeadCompleto) => l.valor_projeto + l.valor_mensal

export default function Leads() {
  const [params, setParams] = useSearchParams()
  const [leads, setLeads] = useState<LeadCompleto[] | null>(null)
  const [equipe, setEquipe] = useState<Perfil[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [visao, setVisaoState] = useState<Visao>(lerVisao)
  const [f, setF] = useState<Filtros>(SEM_FILTRO)
  const [aberto, setAberto] = useState<string | null>(null)
  const novo = params.get('novo') === '1'

  const setVisao = (v: Visao) => {
    setVisaoState(v)
    try {
      localStorage.setItem('leads-visao', v)
    } catch {
      /* navegador sem storage: só não lembra a escolha */
    }
  }

  const carregar = useCallback(() => {
    api
      .listarLeads()
      .then(setLeads)
      .catch((e: Error) => setErro(e.message))
  }, [])

  useEffect(() => {
    carregar()
    api.listarEquipe().then(setEquipe).catch(() => {})
    return api.ouvirLeads(carregar)
  }, [carregar])

  const filtrados = useMemo(() => {
    const busca = f.busca.trim().toLowerCase()
    return (leads ?? []).filter(
      (l) =>
        (!busca ||
          l.contato.nome.toLowerCase().includes(busca) ||
          l.contato.empresa?.toLowerCase().includes(busca) ||
          l.titulo?.toLowerCase().includes(busca) ||
          l.contato.instagram?.includes(busca.replace('@', ''))) &&
        (!f.temperatura || l.temperatura === f.temperatura) &&
        (!f.servico || l.servico === f.servico) &&
        (!f.etapa || l.etapa === f.etapa) &&
        (!f.responsavel || l.responsavel_id === f.responsavel),
    )
  }, [leads, f])

  async function mover(id: string, etapa: Etapa) {
    const antes = leads
    setLeads((ls) => ls?.map((l) => (l.id === id ? { ...l, etapa } : l)) ?? null) // otimista
    try {
      await api.atualizarLead(id, { etapa })
      if (etapa === 'ganho') {
        setAviso('Contrato fechado! O contato virou cliente e o serviço já está em Clientes.')
        setTimeout(() => setAviso(null), 5000)
      }
    } catch (e) {
      setLeads(antes)
      setErro((e as Error).message)
    }
  }

  const nomeResponsavel = (id: string | null) => equipe.find((p) => p.id === id)?.nome ?? '—'
  const leadAberto = leads?.find((l) => l.id === aberto) ?? null
  const temFiltro = Object.values(f).some(Boolean)
  const emAberto = filtrados.filter((l) => l.etapa !== 'ganho' && l.etapa !== 'perdido')

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TituloPagina sobre={`${emAberto.length} em aberto · ${formatarMoeda(emAberto.reduce((s, l) => s + valorLead(l), 0))} no funil`} titulo="Leads">
        <div className="flex gap-2">
          <div className="flex rounded-md border border-borda bg-cartao p-0.5">
            {(
              [
                ['kanban', 'Kanban', Columns3],
                ['lista', 'Lista', List],
              ] as const
            ).map(([v, r, Icone]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisao(v)}
                className={`flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-sm transition ${
                  visao === v ? 'bg-cartao-2 font-semibold text-white' : 'text-apagado hover:text-suave'
                }`}
              >
                <Icone className="size-4" />
                <span className="hidden sm:inline">{r}</span>
              </button>
            ))}
          </div>
          <Botao onClick={() => setParams({ novo: '1' })} className="py-2">
            <Plus className="size-4" /> Novo lead
          </Botao>
        </div>
      </TituloPagina>

      {/* Filtros */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <label className="relative shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
          <input
            id="busca-lead"
            value={f.busca}
            onChange={(e) => setF({ ...f, busca: e.target.value })}
            placeholder="Buscar nome, empresa ou @"
            className="h-10 w-52 rounded-md border border-borda bg-cartao pr-3 pl-9 text-sm outline-none placeholder:text-apagado focus:border-prata-2"
          />
        </label>
        <div className="flex shrink-0 gap-0.5 rounded-md border border-borda bg-cartao p-0.5">
          {TEMPERATURAS.map((t) => {
            const ativo = f.temperatura === t.valor
            const v = TEMP_VISUAL[t.valor]
            return (
              <button
                key={t.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => setF({ ...f, temperatura: ativo ? '' : t.valor })}
                className={`flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-sm whitespace-nowrap text-apagado transition ${
                  ativo ? 'bg-cartao-2 font-semibold' : 'hover:text-suave'
                }`}
              >
                <Barras nivel={v.nivel} cor={v.cor} className="h-3" />
                <span className={ativo ? 'text-white' : ''}>{t.rotulo}</span>
              </button>
            )
          })}
        </div>
        <Seletor id="filtro-servico" valor={f.servico} onChange={(v) => setF({ ...f, servico: v as TipoServico | '' })} vazio="Serviço">
          {SERVICOS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </Seletor>
        <Seletor id="filtro-etapa" valor={f.etapa} onChange={(v) => setF({ ...f, etapa: v as Etapa | '' })} vazio="Etapa">
          {ETAPAS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.rotulo}
            </option>
          ))}
        </Seletor>
        <Seletor id="filtro-responsavel" valor={f.responsavel} onChange={(v) => setF({ ...f, responsavel: v })} vazio="Responsável">
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Seletor>
        {temFiltro && (
          <button type="button" onClick={() => setF(SEM_FILTRO)} className="shrink-0 px-2 text-sm text-suave underline underline-offset-4 hover:text-texto">
            Limpar
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-perigo">Erro: {erro}</p>}
      {aviso && <p className="rounded-md border border-ok/30 bg-ok/[0.06] px-4 py-3 text-sm text-ok">{aviso}</p>}
      {!leads && !erro && <Carregando />}

      {leads && leads.length === 0 && (
        <Vazio>Nenhum lead ainda. Crie um em “Novo lead” ou mande da prospecção (botão “Virou lead”).</Vazio>
      )}

      {leads && leads.length > 0 && visao === 'kanban' && (
        <Kanban leads={filtrados} mover={(id, e) => void mover(id, e)} abrir={setAberto} nomeResponsavel={nomeResponsavel} />
      )}
      {leads && leads.length > 0 && visao === 'lista' && <Lista leads={filtrados} abrir={setAberto} nomeResponsavel={nomeResponsavel} />}

      {leadAberto && <LeadDetalhe key={leadAberto.id} lead={leadAberto} equipe={equipe} fechar={() => setAberto(null)} aoSalvar={carregar} />}

      {novo && (
        <NovoLead
          fechar={() => setParams({})}
          aoCriar={(id) => {
            setParams({})
            carregar()
            setAberto(id)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Kanban */

interface PropsCards {
  abrir: (id: string) => void
  nomeResponsavel: (id: string | null) => string
}

function Kanban({ leads, mover, ...props }: PropsCards & { leads: LeadCompleto[]; mover: (id: string, etapa: Etapa) => void }) {
  const [arrastando, setArrastando] = useState<LeadCompleto | null>(null)
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // no celular: segurar ~0,2s para arrastar (assim o dedo ainda rola a tela)
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function soltar(e: DragEndEvent) {
    setArrastando(null)
    const etapa = e.over?.id as Etapa | undefined
    const lead = leads.find((l) => l.id === e.active.id)
    if (lead && etapa && lead.etapa !== etapa) mover(lead.id, etapa)
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={(e) => setArrastando(leads.find((l) => l.id === e.active.id) ?? null)}
      onDragEnd={soltar}
      onDragCancel={() => setArrastando(null)}
    >
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:snap-none lg:px-0">
        {ETAPAS.map((etapa) => (
          <Coluna key={etapa.valor} etapa={etapa} leads={leads.filter((l) => l.etapa === etapa.valor)} {...props} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{arrastando && <Card lead={arrastando} {...props} flutuando />}</DragOverlay>
    </DndContext>
  )
}

function Coluna({ etapa, leads, ...props }: PropsCards & { etapa: (typeof ETAPAS)[number]; leads: LeadCompleto[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.valor })
  const total = leads.reduce((s, l) => s + valorLead(l), 0)
  return (
    <section
      ref={setNodeRef}
      className={`flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-md border p-2.5 transition-colors sm:w-72 ${
        isOver ? 'border-prata-2/60 bg-prata/[0.03]' : 'border-borda bg-lateral'
      }`}
    >
      <header className="flex items-center gap-2 px-1.5 pt-1 pb-3">
        <MarcaEtapa cor={etapa.cor} />
        <h2 className="flex-1 truncate text-[13px] font-semibold">{etapa.rotulo}</h2>
        {total > 0 && <span className="font-mono text-[11px] text-suave tabular-nums">{moedaCurta.format(total)}</span>}
        <span className="font-mono text-[11px] text-apagado tabular-nums">{String(leads.length).padStart(2, '0')}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {leads.map((l) => (
          <CardArrastavel key={l.id} lead={l} {...props} />
        ))}
        {leads.length === 0 && (
          <p className="rotulo rounded-md border border-dashed border-borda px-3 py-6 text-center text-[9.5px]">Arraste um lead para cá</p>
        )}
      </div>
    </section>
  )
}

function CardArrastavel({ lead, ...props }: PropsCards & { lead: LeadCompleto }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={() => props.abrir(lead.id)} className={`touch-manipulation ${isDragging ? 'opacity-30' : ''}`}>
      <Card lead={lead} {...props} />
    </div>
  )
}

function Card({ lead, nomeResponsavel, flutuando }: PropsCards & { lead: LeadCompleto; flutuando?: boolean }) {
  return (
    <article
      className={`cursor-grab rounded-md border border-borda bg-cartao p-3.5 select-none active:cursor-grabbing ${
        flutuando ? 'rotate-[1.5deg] border-prata-2/60 shadow-2xl shadow-black/70' : 'hover:border-borda-2'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14px] leading-snug font-semibold">{nomeContato(lead.contato)}</h3>
        <span className="pt-1">
          <Temperatura valor={lead.temperatura} compacto />
        </span>
      </div>
      <p className="mt-1 font-mono text-[10.5px] text-apagado">
        {[
          lead.titulo || rotulo(SERVICOS, lead.servico),
          lead.valor_projeto > 0 && formatarMoeda(lead.valor_projeto),
          lead.valor_mensal > 0 && `${formatarMoeda(lead.valor_mensal)}/mês`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {lead.data_reuniao && (
        <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-prata-2">
          <CalendarClock className="size-3.5" />
          {dataCurta.format(new Date(lead.data_reuniao))}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-borda pt-2.5">
        <span className="text-xs text-apagado">{nomeResponsavel(lead.responsavel_id)}</span>
        {lead.contato.whatsapp && (
          <a
            href={linkWhatsapp(lead.contato.whatsapp)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="grid size-7 place-items-center rounded-md text-apagado transition hover:bg-ok/10 hover:text-ok"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="size-4" />
          </a>
        )}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------- Lista */

function Lista({ leads, abrir, nomeResponsavel }: PropsCards & { leads: LeadCompleto[] }) {
  if (leads.length === 0) return <p className="py-12 text-center text-apagado">Nenhum lead com esses filtros.</p>
  return (
    <div className="overflow-hidden rounded-md border border-borda bg-cartao">
      <div className="rotulo hidden grid-cols-[2fr_1fr_1.3fr_1.1fr_1fr_1fr] gap-3 border-b border-borda px-5 py-3 text-[10px] lg:grid">
        <span>Contato</span>
        <span>Temperatura</span>
        <span>Etapa</span>
        <span>Valor</span>
        <span>Reunião</span>
        <span>Responsável</span>
      </div>
      <ul className="divide-y divide-borda">
        {leads.map((l) => {
          const e = ETAPAS.find((x) => x.valor === l.etapa)!
          return (
            <li key={l.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => abrir(l.id)}
                onKeyDown={(ev) => ev.key === 'Enter' && abrir(l.id)}
                className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 hover:bg-cartao-2 lg:grid-cols-[2fr_1fr_1.3fr_1.1fr_1fr_1fr] lg:px-5"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{nomeContato(l.contato)}</div>
                  <div className="truncate font-mono text-[10.5px] text-apagado">{l.titulo || rotulo(SERVICOS, l.servico)}</div>
                </div>
                <Temperatura valor={l.temperatura} />
                <span className="flex items-center gap-2 text-sm text-suave">
                  <MarcaEtapa cor={e.cor} />
                  {e.rotulo}
                </span>
                <span className="text-sm text-suave tabular-nums">
                  {formatarMoeda(l.valor_projeto)}
                  {l.valor_mensal > 0 && <span className="text-apagado"> + {formatarMoeda(l.valor_mensal)}/mês</span>}
                </span>
                <span className="hidden text-sm text-suave tabular-nums lg:inline">{l.data_reuniao ? dataCurta.format(new Date(l.data_reuniao)) : '—'}</span>
                <span className="hidden text-sm text-suave lg:inline">{nomeResponsavel(l.responsavel_id)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
