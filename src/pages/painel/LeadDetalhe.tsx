import { AtSign, Briefcase, MessageCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Barras, Botao, Campo, Gaveta, MarcaEtapa, TEMP_VISUAL, classeCampo } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ETAPAS, ORIGENS, SERVICOS, TEMPERATURAS, corEtapa, rotulo, type Etapa, type TipoServico } from '../../lib/constantes'
import { formatarDataHora, formatarWhatsapp, linkWhatsapp, nomeContato } from '../../lib/formatos'
import type { HistoricoLead, LeadCompleto, LeadEditavel, Perfil } from '../../lib/tipos'

/** ISO → valor de <input type="datetime-local"> no fuso do aparelho */
function paraInputData(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function LeadDetalhe({
  lead,
  equipe,
  fechar,
  aoSalvar,
}: {
  lead: LeadCompleto
  equipe: Perfil[]
  fechar: () => void
  aoSalvar: () => void
}) {
  const { perfil } = useAuth()
  const [historico, setHistorico] = useState<HistoricoLead[]>([])
  const [texto, setTexto] = useState({
    titulo: lead.titulo ?? '',
    anotacoes: lead.anotacoes ?? '',
    motivo: lead.motivo_perda ?? '',
    projeto: String(lead.valor_projeto || ''),
    mensal: String(lead.valor_mensal || ''),
  })
  const [status, setStatus] = useState<'salvando' | 'salvo' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [excluir, setExcluir] = useState(false)

  useEffect(() => {
    api.listarHistorico(lead.id).then(setHistorico).catch(() => {})
  }, [lead.id, lead.etapa])

  async function salvar(dados: LeadEditavel) {
    setStatus('salvando')
    setErro(null)
    try {
      await api.atualizarLead(lead.id, dados)
      aoSalvar()
      setStatus('salvo')
      setTimeout(() => setStatus((s) => (s === 'salvo' ? null : s)), 1500)
    } catch (e) {
      setErro((e as Error).message)
      setStatus(null)
    }
  }

  const valorNumero = (v: string) => Math.max(0, Number(v.replace(/\./g, '').replace(',', '.')) || 0)
  const nomePerfil = (id: string | null) => equipe.find((p) => p.id === id)?.nome ?? 'Sistema'
  const rotuloEtapa = (e: Etapa | null) => ETAPAS.find((x) => x.valor === e)?.rotulo ?? '—'
  const primeiroNome = lead.contato.nome.split(' ')[0]

  return (
    <Gaveta
      sobre="Lead"
      titulo={nomeContato(lead.contato)}
      sub={
        <>
          {lead.contato.empresa ? `${lead.contato.nome} · ` : ''}
          {rotulo(ORIGENS, lead.contato.origem)}
          {lead.contato.whatsapp && ` · ${formatarWhatsapp(lead.contato.whatsapp)}`}
        </>
      }
      status={status === 'salvando' ? 'Salvando…' : status === 'salvo' ? 'Salvo' : ''}
      fechar={fechar}
    >
      {erro && <p className="text-sm text-perigo">{erro}</p>}

      <div className="grid grid-cols-2 gap-2">
        {lead.contato.whatsapp ? (
          <a
            href={linkWhatsapp(lead.contato.whatsapp, `Oi, ${primeiroNome}! Aqui é da Marquez.`)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-ok/30 py-3 text-sm font-semibold text-ok transition hover:bg-ok/[0.06]"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-md border border-dashed border-borda py-3 text-xs text-apagado">Sem WhatsApp</span>
        )}
        {lead.contato.instagram ? (
          <a
            href={`https://instagram.com/${lead.contato.instagram}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-borda bg-cartao px-2 py-3 text-sm font-semibold text-texto"
          >
            <AtSign className="size-4 shrink-0" /> <span className="truncate">{lead.contato.instagram}</span>
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-md border border-dashed border-borda text-xs text-apagado">Sem Instagram</span>
        )}
      </div>

      {lead.etapa === 'ganho' && (
        <Link
          to="/painel/clientes"
          className="flex items-center gap-3 rounded-md border border-ok/30 bg-ok/[0.05] px-4 py-3 text-sm text-ok hover:bg-ok/[0.08]"
        >
          <Briefcase className="size-4" /> Contrato fechado: o serviço está em Clientes.
        </Link>
      )}

      <Campo titulo="Etapa do funil">
        <div className="grid grid-cols-2 gap-2">
          {ETAPAS.map((e) => (
            <button
              key={e.valor}
              type="button"
              aria-pressed={lead.etapa === e.valor}
              onClick={() => lead.etapa !== e.valor && void salvar({ etapa: e.valor })}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition ${
                lead.etapa === e.valor ? 'border-prata-2 bg-prata/[0.07] font-semibold text-white' : 'border-borda bg-cartao text-suave hover:border-borda-2'
              } ${e.valor === 'perdido' ? 'col-span-2' : ''}`}
            >
              <MarcaEtapa cor={e.cor} />
              {e.rotulo}
            </button>
          ))}
        </div>
        {lead.etapa === 'perdido' && (
          <input
            id="motivo-perda"
            className={`${classeCampo} mt-2 text-sm`}
            placeholder="Por que perdemos? (preço, prazo, sumiu…)"
            value={texto.motivo}
            onChange={(e) => setTexto({ ...texto, motivo: e.target.value })}
            onBlur={() => texto.motivo !== (lead.motivo_perda ?? '') && void salvar({ motivo_perda: texto.motivo.trim() || null })}
          />
        )}
      </Campo>

      <Campo titulo="Proposta">
        <div className="flex flex-col gap-3">
          <input
            id="titulo-lead"
            className={`${classeCampo} text-sm`}
            placeholder="Título (ex.: Site + tráfego)"
            value={texto.titulo}
            onChange={(e) => setTexto({ ...texto, titulo: e.target.value })}
            onBlur={() => texto.titulo !== (lead.titulo ?? '') && void salvar({ titulo: texto.titulo.trim() || null })}
          />
          <select
            id="servico-lead"
            className={`${classeCampo} text-sm`}
            value={lead.servico}
            onChange={(e) => void salvar({ servico: e.target.value as TipoServico })}
          >
            {SERVICOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs text-apagado">Projeto (único) R$</span>
              <input
                id="valor-projeto"
                inputMode="decimal"
                className={`${classeCampo} text-sm tabular-nums`}
                placeholder="0"
                value={texto.projeto}
                onChange={(e) => setTexto({ ...texto, projeto: e.target.value.replace(/[^\d.,]/g, '') })}
                onBlur={() => valorNumero(texto.projeto) !== lead.valor_projeto && void salvar({ valor_projeto: valorNumero(texto.projeto) })}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs text-apagado">Mensalidade R$</span>
              <input
                id="valor-mensal"
                inputMode="decimal"
                className={`${classeCampo} text-sm tabular-nums`}
                placeholder="0"
                value={texto.mensal}
                onChange={(e) => setTexto({ ...texto, mensal: e.target.value.replace(/[^\d.,]/g, '') })}
                onBlur={() => valorNumero(texto.mensal) !== lead.valor_mensal && void salvar({ valor_mensal: valorNumero(texto.mensal) })}
              />
            </label>
          </div>
        </div>
      </Campo>

      <Campo titulo="Temperatura">
        <div className="grid grid-cols-3 gap-2">
          {TEMPERATURAS.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={lead.temperatura === t.valor}
              onClick={() => void salvar({ temperatura: t.valor })}
              className={`flex items-center justify-center gap-2 rounded-md border py-2.5 text-sm text-apagado transition ${
                lead.temperatura === t.valor ? 'border-prata-2 bg-prata/[0.07] font-semibold' : 'border-borda bg-cartao hover:border-borda-2'
              }`}
            >
              <Barras nivel={TEMP_VISUAL[t.valor].nivel} cor={TEMP_VISUAL[t.valor].cor} className="h-3" />
              <span className={lead.temperatura === t.valor ? 'text-white' : 'text-suave'}>{t.rotulo}</span>
            </button>
          ))}
        </div>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo titulo="Reunião">
          <input
            id="data-reuniao"
            type="datetime-local"
            className={`${classeCampo} px-3 text-sm`}
            defaultValue={paraInputData(lead.data_reuniao)}
            onChange={(e) => void salvar({ data_reuniao: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </Campo>
        <Campo titulo="Responsável">
          <select
            id="responsavel"
            className={`${classeCampo} px-3 text-sm`}
            value={lead.responsavel_id ?? ''}
            onChange={(e) => void salvar({ responsavel_id: e.target.value || null })}
          >
            <option value="">Ninguém</option>
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo titulo="Anotações">
        <textarea
          id="anotacoes"
          className={`${classeCampo} min-h-28 text-sm`}
          placeholder="O que foi conversado, objeções, próximos passos…"
          value={texto.anotacoes}
          onChange={(e) => setTexto({ ...texto, anotacoes: e.target.value })}
        />
        {texto.anotacoes !== (lead.anotacoes ?? '') && (
          <Botao className="mt-2 w-full py-2.5 text-sm" onClick={() => void salvar({ anotacoes: texto.anotacoes.trim() || null })}>
            Salvar anotações
          </Botao>
        )}
      </Campo>

      <Campo titulo="Histórico">
        <ol className="relative ml-1 border-l border-borda">
          {historico.map((h) => (
            <li key={h.id} className="relative pb-4 pl-5 last:pb-0">
              <span
                className="absolute top-1 -left-[4px] h-3 w-[7px] -skew-x-[20deg] rounded-[1px] ring-4 ring-fundo"
                style={{ background: corEtapa(h.etapa_nova) }}
              />
              <p className="text-sm text-texto">
                {h.etapa_anterior ? (
                  <>
                    {rotuloEtapa(h.etapa_anterior)} → <strong>{rotuloEtapa(h.etapa_nova)}</strong>
                  </>
                ) : (
                  <strong>Entrou no funil</strong>
                )}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-apagado">
                {formatarDataHora(h.created_at)} · {nomePerfil(h.usuario_id)}
              </p>
            </li>
          ))}
          {historico.length === 0 && <li className="pl-5 text-sm text-apagado">Sem movimentações.</li>}
        </ol>
      </Campo>

      {perfil?.papel === 'admin' && (
        <div className="border-t border-borda pt-5">
          {excluir ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-suave">Excluir este lead? O contato continua na agenda.</p>
              <Botao variante="fantasma" onClick={() => setExcluir(false)}>
                Voltar
              </Botao>
              <Botao
                variante="perigo"
                onClick={() =>
                  void api
                    .excluirLead(lead.id)
                    .then(() => {
                      aoSalvar()
                      fechar()
                    })
                    .catch((e: Error) => setErro(e.message))
                }
              >
                Excluir
              </Botao>
            </div>
          ) : (
            <Botao variante="fantasma" className="px-0 text-perigo/80 hover:text-perigo" onClick={() => setExcluir(true)}>
              <Trash2 className="size-4" /> Excluir lead
            </Botao>
          )}
        </div>
      )}
    </Gaveta>
  )
}
