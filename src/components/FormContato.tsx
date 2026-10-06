import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { ORIGENS, type Origem } from '../lib/constantes'
import { mascaraInstagram, mascaraWhatsapp, soDigitos, whatsappValido } from '../lib/mascaras'
import type { Contato, ContatoEditavel } from '../lib/tipos'
import { Botao, RotuloCampo, classeCampo } from './ui'

/** Cadastro e edição de contato. Devolve o contato salvo. */
export default function FormContato({
  contato,
  aoSalvar,
  textoBotao = 'Salvar contato',
}: {
  contato?: Contato
  aoSalvar: (c: Contato) => void
  textoBotao?: string
}) {
  const [f, setF] = useState({
    nome: contato?.nome ?? '',
    empresa: contato?.empresa ?? '',
    whatsapp: contato?.whatsapp ? mascaraWhatsapp(contato.whatsapp) : '',
    email: contato?.email ?? '',
    instagram: contato?.instagram ? `@${contato.instagram}` : '',
    segmento: contato?.segmento ?? '',
    cidade: contato?.cidade ?? '',
    origem: (contato?.origem ?? 'indicacao') as Origem,
    tags: contato?.tags.join(', ') ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const whatsInvalido = f.whatsapp.trim() !== '' && !whatsappValido(f.whatsapp)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    const dados: ContatoEditavel & { nome: string } = {
      nome: f.nome.trim(),
      empresa: f.empresa.trim() || null,
      whatsapp: soDigitos(f.whatsapp) || null,
      email: f.email.trim().toLowerCase() || null,
      instagram: f.instagram.replace(/^@/, '').trim() || null,
      segmento: f.segmento.trim() || null,
      cidade: f.cidade.trim() || null,
      origem: f.origem,
      tags: [...new Set(f.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))],
    }
    try {
      if (contato) {
        await api.atualizarContato(contato.id, dados)
        aoSalvar({ ...contato, ...dados } as Contato)
      } else {
        aoSalvar(await api.criarContato(dados))
      }
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const campo = (k: keyof typeof f, rotulo: string, props: Record<string, unknown> = {}) => (
    <label className="block">
      <RotuloCampo>{rotulo}</RotuloCampo>
      <input
        id={`contato-${k}`}
        className={classeCampo}
        value={f[k] as string}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        {...props}
      />
    </label>
  )

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {campo('nome', 'Nome da pessoa', { required: true, autoFocus: !contato, placeholder: 'Ex.: Ana Souza' })}
        {campo('empresa', 'Empresa', { placeholder: 'Ex.: Clínica Bella' })}
        <label className="block">
          <RotuloCampo erro={whatsInvalido && 'confira o número'}>WhatsApp</RotuloCampo>
          <input
            id="contato-whatsapp"
            className={classeCampo}
            inputMode="tel"
            placeholder="(11) 98765-4321"
            value={f.whatsapp}
            onChange={(e) => setF({ ...f, whatsapp: mascaraWhatsapp(e.target.value) })}
          />
        </label>
        {campo('email', 'E-mail', { type: 'email', placeholder: 'ana@clinicabella.com.br' })}
        <label className="block">
          <RotuloCampo>Instagram</RotuloCampo>
          <input
            id="contato-instagram"
            className={classeCampo}
            placeholder="@clinicabella"
            value={f.instagram}
            onChange={(e) => setF({ ...f, instagram: mascaraInstagram(e.target.value) })}
          />
        </label>
        {campo('segmento', 'Segmento', { placeholder: 'Ex.: Estética', list: 'segmentos-sugeridos' })}
        {campo('cidade', 'Cidade')}
        <label className="block">
          <RotuloCampo>Como chegou</RotuloCampo>
          <select id="contato-origem" className={classeCampo} value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value as Origem })}>
            {ORIGENS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
      {campo('tags', 'Etiquetas (separe por vírgula)', { placeholder: 'vip, indicação do João' })}
      <datalist id="segmentos-sugeridos">
        {['Estética', 'Saúde', 'Restaurante', 'Beleza', 'Barbearia', 'Varejo', 'Serviços', 'Educação', 'Imobiliária', 'Advocacia'].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <Botao type="submit" disabled={salvando || f.nome.trim().length < 1 || whatsInvalido} className="w-full">
        {salvando ? 'Salvando…' : textoBotao}
      </Botao>
    </form>
  )
}
