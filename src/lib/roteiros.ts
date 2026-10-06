// Roteiro de vendas do X1: primeira mensagem e respostas prontas, montadas
// sozinhas com a saudação do horário, o nome do negócio, o nicho e o público.
// A conversa puxa para uma call rápida de diagnóstico (presença no Google,
// Instagram, site e anúncios) — é na call que a proposta é feita.
import type { Nicho } from './prospeccao'

export type Publico = 'masculino' | 'feminino' | 'misto'

export const PUBLICOS: { valor: Publico; rotulo: string }[] = [
  { valor: 'masculino', rotulo: 'Masculino' },
  { valor: 'feminino', rotulo: 'Feminino' },
  { valor: 'misto', rotulo: 'Misto' },
]

/** Como cada nicho é chamado na conversa e onde o cliente está na hora de avaliar. */
const NICHO: Record<Nicho, { publico: Publico; busca: string; plural: string; onde: string }> = {
  barbearia: { publico: 'masculino', busca: 'barbearia', plural: 'barbearias', onde: 'ainda na cadeira' },
  tatuador: { publico: 'misto', busca: 'tatuador', plural: 'estúdios de tattoo', onde: 'antes de sair do estúdio' },
  nail: { publico: 'feminino', busca: 'manicure', plural: 'nail designers', onde: 'ainda na mesa' },
  sobrancelha: { publico: 'feminino', busca: 'design de sobrancelha', plural: 'studios de sobrancelha', onde: 'ainda na cadeira' },
  estetica: { publico: 'feminino', busca: 'clínica de estética', plural: 'clínicas de estética', onde: 'antes de ir embora' },
  salao: { publico: 'feminino', busca: 'salão de beleza', plural: 'salões', onde: 'ainda na cadeira' },
  restaurante: { publico: 'misto', busca: 'restaurante', plural: 'restaurantes', onde: 'ainda na mesa' },
  otica: { publico: 'misto', busca: 'ótica', plural: 'óticas', onde: 'ainda no balcão' },
  outro: { publico: 'misto', busca: 'loja', plural: 'lojas', onde: 'ainda no balcão' },
}

export const publicoDoNicho = (n: Nicho) => NICHO[n].publico

export function saudacao(agora = new Date()) {
  const h = agora.getHours()
  return h >= 5 && h < 12 ? 'bom dia' : h >= 12 && h < 18 ? 'boa tarde' : 'boa noite'
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * Nome como a pessoa fala: sem o " - Nova Iguaçu" que o mapa acrescenta, sem
 * parênteses e sem CAIXA ALTA.
 */
export function nomeFalado(nome: string) {
  let n = nome.split(/\s+[-–|]\s+/)[0].replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  if (n.length > 3 && n === n.toUpperCase()) {
    n = n.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e: string, l: string) => e + l.toUpperCase())
  }
  return n || nome
}

const MASCULINOS = /^(restaurante|studio|estúdio|estudio|salão|salao|espaço|espaco|bar|café|cafe|instituto|ateliê|atelie|atelier|centro|point|empório|emporio|recanto|cantinho|ponto|mundo|clube|club)$/i

/** "a" ou "o" antes do nome: "a Barbearia do Jorge", "o Studio Bella". */
export function artigo(nome: string, nicho: Nicho): 'a' | 'o' {
  const primeira = nome.split(/\s+/)[0]
  if (MASCULINOS.test(primeira)) return 'o'
  if (/a$/i.test(primeira)) return 'a'
  return nicho === 'salao' || nicho === 'restaurante' ? 'o' : 'a'
}

export interface Contexto {
  nome: string
  nicho: Nicho
  publico: Publico
  /** Primeiro nome de quem está mandando. */
  vendedor?: string
  agora?: Date
}

function montar(c: Contexto) {
  const info = NICHO[c.nicho]
  const nome = nomeFalado(c.nome)
  const a = artigo(nome, c.nicho)
  const fem = c.publico === 'feminino'
  const s = saudacao(c.agora)
  const eu = c.vendedor ? ` Aqui é o ${c.vendedor}` : ''
  return {
    nome: `*${nome}*`,
    nomeSimples: nome,
    a,
    da: a === 'a' ? 'da' : 'do',
    busca: info.busca,
    plural: info.plural,
    onde: info.onde,
    cliente: fem ? 'a cliente' : 'o cliente',
    clientes: fem ? 'as clientes' : 'os clientes',
    satisfeito: fem ? 'satisfeita' : 'satisfeito',
    satisfeitos: fem ? 'satisfeitas' : 'satisfeitos',
    quantos: fem ? 'quantas' : 'quantos',
    emoji: fem ? '😊' : c.publico === 'masculino' ? '👊' : '👋',
    abertura:
      c.publico === 'masculino'
        ? `Fala! ${maiuscula(s)}, tudo certo?${eu}.`
        : fem
          ? `Oii, ${s}! Tudo bem?${eu} 😊`
          : `Olá, ${s}! Tudo bem?${eu}.`,
  }
}

export interface Mensagem {
  id: string
  titulo: string
  /** Dica para quem vai mandar (não vai na mensagem). */
  dica?: string
  texto: (c: Contexto) => string
}

/** Primeira mensagem: quatro jeitos de puxar a conversa. O app reveza entre eles. */
export const ABERTURAS: Mensagem[] = [
  {
    id: 'google',
    titulo: 'Aparecer no Google',
    texto: (c) => {
      const t = montar(c)
      return `${t.abertura}

Pesquisei "${t.busca} perto de mim" aqui na região e ${t.a} ${t.nome} não aparece entre os primeiros. Quem aparece no topo fica com a maioria d${t.clientes} novos 👀

Trabalho com isso: Google, Instagram, site e anúncios para negócio local.

Posso te mandar um diagnóstico rápido do que dá pra melhorar? É de graça.`
    },
  },
  {
    id: 'instagram',
    titulo: 'Instagram que vende',
    texto: (c) => {
      const t = montar(c)
      return `${t.abertura}

Dei uma olhada no Instagram ${t.da} ${t.nome}: dá pra transformar esse perfil numa máquina de chamar ${t.clientes.slice(3)} novos, com conteúdo certo e anúncio pro bairro.

Faço isso pra ${t.plural} aqui da região. Topa uma call de 15 minutos pra eu te mostrar o plano?`
    },
  },
  {
    id: 'pergunta',
    titulo: 'Pergunta que provoca',
    texto: (c) => {
      const t = montar(c)
      return `${t.abertura}

Pergunta rápida sobre ${t.a} ${t.nome}: hoje, de onde vem a maioria d${t.clientes} novos? Indicação, Instagram, Google…? 🤔

Pergunto porque ajudo ${t.plural} a ter um fluxo previsível de ${t.clientes.slice(3)} pela internet, sem depender só de indicação.`
    },
  },
  {
    id: 'direta',
    titulo: 'Curta e direta',
    texto: (c) => {
      const t = montar(c)
      return `${t.abertura}

Sou da Marquez, agência de marketing pra negócio local. Separei 3 ideias pra ${t.a} ${t.nome} atrair mais ${t.clientes.slice(3)} pelo Google e Instagram.

Posso te mandar? ${t.emoji}`
    },
  },
]

/** Depois que a pessoa responde: diagnóstico, preço e as objeções mais comuns. */
export const RESPOSTAS: Mensagem[] = [
  {
    id: 'diagnostico',
    titulo: 'Mandar o diagnóstico',
    dica: 'Mande junto prints do Google Maps e do Instagram com os pontos marcados.',
    texto: (c) => {
      const t = montar(c)
      return `Olha o que eu vi ${t.da} ${t.nome} 👇

1. No Google: faltam fotos, respostas às avaliações e posts — é isso que faz subir no mapa.
2. No Instagram: a bio não diz o que vocês fazem nem tem link pra agendar/pedir.
3. Sem site ou página de contato, quem acha vocês no Google não tem pra onde ir.

Dá pra resolver os três. Bora uma call de 15 min pra eu te mostrar como?`
    },
  },
  {
    id: 'preco',
    titulo: 'Quanto custa?',
    texto: () =>
      `Depende do que faz mais sentido pra vocês agora: pode ser só o Google e o Instagram arrumados, ou um site com anúncios rodando todo mês.

Por isso eu prefiro uma call rápida: entendo o momento de vocês e te passo uma proposta fechada, sem surpresa. Qual horário fica bom amanhã?`,
  },
  {
    id: 'caro',
    titulo: 'Tá caro',
    texto: (c) => {
      const t = montar(c)
      return `Entendo! Mas pensa assim: quant${t.clientes.startsWith('as') ? 'as clientes novas' : 'os clientes novos'} por mês pagam o investimento? Normalmente são poucos.

E dá pra começar menor e crescer junto com o resultado. Te mostro as opções?`
    },
  },
  {
    id: 'ja-tenho',
    titulo: 'Já tenho alguém',
    texto: () =>
      `Que bom! Então vocês já sabem o valor disso 🙌

Se quiser uma segunda opinião, faço um diagnóstico gratuito e você compara com o que tem hoje. Sem compromisso.`,
  },
  {
    id: 'pensar',
    titulo: 'Vou pensar',
    texto: () =>
      `Claro, sem pressa! Pra facilitar, posso passar aí rapidinho e te mostrar no celular o que eu faria, leva 10 minutinhos.

Que dia fica melhor pra você?`,
  },
  {
    id: 'agendar',
    titulo: 'Marcar a call',
    texto: (c) => {
      const t = montar(c)
      return `Fechado então! 🙌

Te mando o convite da call. Pode ser amanhã às 10h ou às 15h? Se puder, me passa também o @ do Instagram e o site ${t.da} ${t.nome} que eu já chego com tudo analisado.`
    },
  },
]

/** Abertura da vez: reveza entre os modelos para as mensagens não saírem todas iguais. */
export function proximaAbertura(): Mensagem {
  let i = 0
  try {
    i = (Number(localStorage.getItem('marquez-abertura')) + 1) % ABERTURAS.length || 0
    localStorage.setItem('marquez-abertura', String(i))
  } catch {
    i = Math.floor(Math.random() * ABERTURAS.length)
  }
  return ABERTURAS[i]
}
