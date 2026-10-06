import { ArrowLeft, Search, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import FormContato from '../../components/FormContato'
import { Botao, Chips, Janela, RotuloCampo, TEMP_VISUAL, classeCampo } from '../../components/ui'
import { api } from '../../lib/api'
import { ETAPAS, SERVICOS, TEMPERATURAS, type Etapa, type Temperatura, type TipoServico } from '../../lib/constantes'
import { formatarWhatsapp, nomeContato } from '../../lib/formatos'
import type { Contato } from '../../lib/tipos'

/** Novo lead em dois passos: quem é (contato) e o que vai ser vendido. */
export default function NovoLead({ fechar, aoCriar }: { fechar: () => void; aoCriar: (leadId: string) => void }) {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [contato, setContato] = useState<Contato | null>(null)
  const [cadastrando, setCadastrando] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    api.listarContatos().then(setContatos).catch(() => {})
  }, [])

  const achados = useMemo(() => {
    const b = busca.trim().toLowerCase()
    const d = b.replace(/\D/g, '')
    return contatos
      .filter((c) => !b || c.nome.toLowerCase().includes(b) || c.empresa?.toLowerCase().includes(b) || (d.length >= 3 && c.whatsapp?.includes(d)))
      .slice(0, 8)
  }, [contatos, busca])

  return (
    <Janela titulo={contato ? `Novo lead · ${nomeContato(contato)}` : 'Novo lead'} fechar={fechar}>
      {contato ? (
        <DadosLead contato={contato} voltar={() => setContato(null)} aoCriar={aoCriar} />
      ) : cadastrando ? (
        <>
          <button type="button" onClick={() => setCadastrando(false)} className="mb-4 flex items-center gap-1.5 text-sm text-suave hover:text-texto">
            <ArrowLeft className="size-4" /> Escolher contato existente
          </button>
          <FormContato textoBotao="Continuar" aoSalvar={setContato} />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-suave">Para quem é? Escolha um contato da agenda ou cadastre um novo.</p>
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
            <input
              id="busca-contato-lead"
              autoFocus
              className={`${classeCampo} pl-9`}
              placeholder="Nome, empresa ou número"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <ul className="flex flex-col gap-1.5">
            {achados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setContato(c)}
                  className="flex w-full items-center gap-3 rounded-md border border-borda bg-cartao-2/40 px-3.5 py-2.5 text-left hover:border-borda-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{nomeContato(c)}</span>
                    <span className="block truncate font-mono text-[11px] text-apagado">
                      {c.empresa ? `${c.nome} · ` : ''}
                      {c.whatsapp ? formatarWhatsapp(c.whatsapp) : 'sem WhatsApp'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {achados.length === 0 && <li className="py-3 text-center text-sm text-apagado">Nenhum contato encontrado.</li>}
          </ul>
          <Botao variante="secundario" onClick={() => setCadastrando(true)}>
            <UserPlus className="size-4" /> Cadastrar novo contato
          </Botao>
        </div>
      )}
    </Janela>
  )
}

const ETAPAS_INICIAIS = ETAPAS.filter((e) => ['novo', 'contato_feito', 'reuniao_agendada', 'proposta_enviada'].includes(e.valor))

function DadosLead({ contato, voltar, aoCriar }: { contato: Contato; voltar: () => void; aoCriar: (id: string) => void }) {
  const [servico, setServico] = useState<TipoServico>('site')
  const [titulo, setTitulo] = useState('')
  const [etapa, setEtapa] = useState<Etapa>('novo')
  const [temperatura, setTemperatura] = useState<Temperatura>('morno')
  const [projeto, setProjeto] = useState('')
  const [mensal, setMensal] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const numero = (v: string) => Math.max(0, Number(v.replace(/\./g, '').replace(',', '.')) || 0)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      aoCriar(
        await api.criarLead({
          contato_id: contato.id,
          servico,
          titulo: titulo.trim() || null,
          etapa,
          temperatura,
          valor_projeto: numero(projeto),
          valor_mensal: numero(mensal),
        }),
      )
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-4">
      <button type="button" onClick={voltar} className="flex items-center gap-1.5 self-start text-sm text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> Trocar contato
      </button>
      <div>
        <RotuloCampo>Serviço</RotuloCampo>
        <Chips opcoes={SERVICOS} valor={servico} onChange={setServico} colunas={2} />
      </div>
      <label className="block">
        <RotuloCampo>Título da proposta (opcional)</RotuloCampo>
        <input id="novo-lead-titulo" className={classeCampo} placeholder="Ex.: Site + tráfego 3 meses" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <RotuloCampo>Projeto (único) R$</RotuloCampo>
          <input id="novo-lead-projeto" inputMode="decimal" className={classeCampo} placeholder="0" value={projeto} onChange={(e) => setProjeto(e.target.value.replace(/[^\d.,]/g, ''))} />
        </label>
        <label className="block">
          <RotuloCampo>Mensalidade R$</RotuloCampo>
          <input id="novo-lead-mensal" inputMode="decimal" className={classeCampo} placeholder="0" value={mensal} onChange={(e) => setMensal(e.target.value.replace(/[^\d.,]/g, ''))} />
        </label>
      </div>
      <div>
        <RotuloCampo>Etapa</RotuloCampo>
        <Chips opcoes={ETAPAS_INICIAIS} valor={etapa} onChange={setEtapa} colunas={2} />
      </div>
      <div>
        <RotuloCampo>Temperatura</RotuloCampo>
        <Chips
          opcoes={TEMPERATURAS.map((t) => ({ valor: t.valor, rotulo: <span style={{ color: TEMP_VISUAL[t.valor].cor }}>{t.rotulo}</span> }))}
          valor={temperatura}
          onChange={setTemperatura}
          colunas={3}
        />
      </div>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <Botao type="submit" disabled={salvando} className="w-full">
        {salvando ? 'Criando…' : 'Criar lead'}
      </Botao>
    </form>
  )
}
