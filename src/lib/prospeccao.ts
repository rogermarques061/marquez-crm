// Prospecção na rua e no X1: busca de negócios, regiões com mais lojas,
// rota otimizada e acompanhamento de cada contato.
import { supabase } from './supabase'

export type Nicho = 'restaurante' | 'nail' | 'estetica' | 'salao' | 'sobrancelha' | 'barbearia' | 'tatuador' | 'otica' | 'outro'
export type Canal = 'rua' | 'x1'
export type FonteBusca = 'google' | 'tomtom' | 'osm'
export type StatusProspecto = 'novo' | 'contatado' | 'interessado' | 'vendido' | 'sem_interesse'

/** Ordem fixa: a cor segue o nicho (paleta validada para fundo escuro). */
export const NICHOS: { valor: Exclude<Nicho, 'outro'>; rotulo: string; cor: string }[] = [
  { valor: 'restaurante', rotulo: 'Restaurante', cor: '#3987e5' },
  { valor: 'nail', rotulo: 'Nail designer', cor: '#d55181' },
  { valor: 'estetica', rotulo: 'Estética', cor: '#199e70' },
  { valor: 'salao', rotulo: 'Salão de beleza', cor: '#c98500' },
  { valor: 'sobrancelha', rotulo: 'Sobrancelha', cor: '#9085e9' },
  { valor: 'barbearia', rotulo: 'Barbearia', cor: '#d95926' },
  { valor: 'tatuador', rotulo: 'Tatuador', cor: '#e66767' },
  { valor: 'otica', rotulo: 'Ótica', cor: '#008300' },
]

export const infoNicho = (n: Nicho) =>
  NICHOS.find((x) => x.valor === n) ?? { valor: 'outro' as const, rotulo: 'Outro', cor: '#6c697a' }

export const STATUS_RUA: Record<StatusProspecto, string> = {
  novo: 'A visitar',
  contatado: 'Visitei',
  interessado: 'Interessado',
  vendido: 'Virou lead',
  sem_interesse: 'Sem interesse',
}

export const STATUS_X1: Record<StatusProspecto, string> = {
  novo: 'Não chamado',
  contatado: 'Mensagem enviada',
  interessado: 'Respondeu',
  vendido: 'Virou lead',
  sem_interesse: 'Sem interesse',
}

export interface Negocio {
  fonte_id: string
  nome: string
  nicho: Nicho
  lat: number
  lng: number
  endereco: string | null
  telefone: string | null
  instagram: string | null
  site: string | null
}

export interface ResultadoBusca {
  centro: { lat: number; lng: number; nome: string }
  raio: number
  negocios: Negocio[]
  /** De onde vieram os negócios: Google Maps ou TomTom (com chave em Ajustes) ou OpenStreetMap. */
  fonte?: FonteBusca
  /** Motivo de ter caído na fonte seguinte quando a primeira falhou. */
  aviso?: string | null
}

export interface Prospecto {
  id: string
  canal: Canal
  fonte: FonteBusca | 'manual'
  fonte_id: string | null
  nome: string
  nicho: Nicho
  endereco: string | null
  lat: number | null
  lng: number | null
  telefone: string | null
  instagram: string | null
  site: string | null
  status: StatusProspecto
  rota_id: string | null
  ordem_rota: number | null
  anotacoes: string | null
  contatado_em: string | null
  created_at: string
}

export interface Rota {
  id: string
  nome: string
  centro_lat: number | null
  centro_lng: number | null
  created_at: string
}

const fonteDe = (n: Negocio): FonteBusca => {
  const prefixo = n.fonte_id.split('/')[0]
  return prefixo === 'google' || prefixo === 'tomtom' ? prefixo : 'osm'
}

function falhou(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

/* ------------------------------------------------------------------ busca */

export async function buscarNegocios(params: {
  endereco?: string
  lat?: number
  lng?: number
  raio: number
  nichos: Nicho[]
}): Promise<ResultadoBusca> {
  const { data, error } = await supabase.functions.invoke('buscar-negocios', { body: params })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const corpo = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(corpo?.erro ?? 'Não foi possível buscar agora. Confira a internet e tente de novo.')
  }
  return data as ResultadoBusca
}

export function minhaLocalizacao(): Promise<{ lat: number; lng: number }> {
  return new Promise((ok, erro) => {
    if (!navigator.geolocation) return erro(new Error('Este aparelho não informa a localização.'))
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => erro(new Error('Libere a localização para o app nas configurações do celular.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

/* ---------------------------------------------------------------- banco */

export async function listarProspectos(canal: Canal): Promise<Prospecto[]> {
  const { data, error } = await supabase.from('prospectos').select('*').eq('canal', canal).order('updated_at', { ascending: false })
  falhou(error)
  return data as Prospecto[]
}

export async function listarRotas(): Promise<(Rota & { paradas: number; feitas: number })[]> {
  const { data, error } = await supabase.from('rotas').select('*, prospectos(status)').order('created_at', { ascending: false })
  falhou(error)
  return (data as (Rota & { prospectos: { status: StatusProspecto }[] })[]).map(({ prospectos, ...r }) => ({
    ...r,
    paradas: prospectos.length,
    feitas: prospectos.filter((p) => p.status !== 'novo').length,
  }))
}

export async function paradasDaRota(rotaId: string): Promise<Prospecto[]> {
  const { data, error } = await supabase.from('prospectos').select('*').eq('rota_id', rotaId).order('ordem_rota')
  falhou(error)
  return data as Prospecto[]
}

export async function criarRota(nome: string, centro: { lat: number; lng: number }, paradas: Negocio[]): Promise<string> {
  const { data: rota, error } = await supabase
    .from('rotas')
    .insert({ nome, centro_lat: centro.lat, centro_lng: centro.lng })
    .select('id')
    .single()
  falhou(error)
  const linhas = paradas.map((n, i) => ({
    canal: 'rua',
    fonte: fonteDe(n),
    fonte_id: n.fonte_id,
    nome: n.nome,
    nicho: n.nicho,
    endereco: n.endereco,
    lat: n.lat,
    lng: n.lng,
    telefone: n.telefone,
    instagram: n.instagram,
    site: n.site,
    rota_id: rota.id,
    ordem_rota: i + 1,
  }))
  const { error: e2 } = await supabase.from('prospectos').upsert(linhas, { onConflict: 'canal,fonte_id' })
  falhou(e2)
  return rota.id
}

export async function excluirRota(rotaId: string) {
  // As paradas ainda não trabalhadas saem junto; as que tiveram contato ficam no histórico.
  const { error } = await supabase.from('prospectos').delete().eq('rota_id', rotaId).eq('status', 'novo')
  falhou(error)
  const { error: e2 } = await supabase.from('rotas').delete().eq('id', rotaId)
  falhou(e2)
}

export async function reordenarRota(paradas: { id: string }[]) {
  await Promise.all(
    paradas.map((p, i) => supabase.from('prospectos').update({ ordem_rota: i + 1 }).eq('id', p.id).then(({ error }) => falhou(error))),
  )
}

export async function atualizarProspecto(id: string, dados: Partial<Pick<Prospecto, 'status' | 'anotacoes' | 'telefone' | 'instagram'>>) {
  const { error } = await supabase.from('prospectos').update(dados).eq('id', id)
  falhou(error)
}

/** Salva (ou atualiza) um negócio da busca na lista do X1 e devolve o registro. */
export async function salvarNoX1(n: Negocio, status: StatusProspecto = 'novo'): Promise<Prospecto> {
  const { data, error } = await supabase
    .from('prospectos')
    .upsert(
      {
        canal: 'x1',
        fonte: fonteDe(n),
        fonte_id: n.fonte_id,
        nome: n.nome,
        nicho: n.nicho,
        endereco: n.endereco,
        lat: n.lat,
        lng: n.lng,
        telefone: n.telefone,
        instagram: n.instagram,
        site: n.site,
        status,
      },
      { onConflict: 'canal,fonte_id' },
    )
    .select()
    .single()
  falhou(error)
  return data as Prospecto
}

export async function criarContatoManual(dados: { nome: string; telefone: string; nicho: Nicho; instagram: string | null }) {
  const { error } = await supabase.from('prospectos').insert({ canal: 'x1', fonte: 'manual', ...dados })
  falhou(error)
}

/** Manda o prospecto para o funil: cria (ou reaproveita) o contato e um lead "contato feito". */
export async function virarLead(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('prospecto_para_lead', { p_prospecto: id })
  falhou(error)
  return data as string
}

export async function excluirProspecto(id: string) {
  const { error } = await supabase.from('prospectos').delete().eq('id', id)
  falhou(error)
}

export async function lerConfig<T>(chave: string, padrao: T): Promise<T> {
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()
  return (data?.valor as T) ?? padrao
}

export async function salvarConfig(chave: string, valor: unknown) {
  const { error } = await supabase.from('configuracoes').upsert({ chave, valor, updated_at: new Date().toISOString() })
  falhou(error)
}

/* ----------------------------------------------------------- geografia */

type Ponto = { lat: number; lng: number }

/** Distância em metros entre dois pontos. */
export function distancia(a: Ponto, b: Ponto) {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatarDistancia(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

export interface Regiao {
  centro: Ponto
  negocios: Negocio[]
  porNicho: { nicho: Nicho; n: number }[]
}

/**
 * Regiões com mais lojas juntas: para cada negócio conta quantos estão num raio
 * a pé; pega o ponto mais cheio, tira os membros dele e repete.
 */
export function melhoresRegioes(negocios: Negocio[], raio = 400, quantas = 3): Regiao[] {
  let restantes = [...negocios]
  const regioes: Regiao[] = []
  while (regioes.length < quantas && restantes.length >= 3) {
    let melhor: { centro: Negocio; membros: Negocio[] } | null = null
    for (const n of restantes) {
      const membros = restantes.filter((o) => distancia(n, o) <= raio)
      if (!melhor || membros.length > melhor.membros.length) melhor = { centro: n, membros }
    }
    if (!melhor || melhor.membros.length < 3) break
    const lat = melhor.membros.reduce((s, m) => s + m.lat, 0) / melhor.membros.length
    const lng = melhor.membros.reduce((s, m) => s + m.lng, 0) / melhor.membros.length
    const contagem = new Map<Nicho, number>()
    melhor.membros.forEach((m) => contagem.set(m.nicho, (contagem.get(m.nicho) ?? 0) + 1))
    regioes.push({
      centro: { lat, lng },
      negocios: melhor.membros,
      porNicho: [...contagem.entries()].map(([nicho, n]) => ({ nicho, n })).sort((a, b) => b.n - a.n),
    })
    const ids = new Set(melhor.membros.map((m) => m.fonte_id))
    restantes = restantes.filter((r) => !ids.has(r.fonte_id))
  }
  return regioes
}

/** Ordem de visita mais curta a pé: vizinho mais próximo + melhoria 2-opt. */
export function otimizarRota<T extends Ponto>(paradas: T[], inicio?: Ponto): T[] {
  if (paradas.length < 3) return [...paradas]
  const pendentes = [...paradas]
  const rota: T[] = []
  let atual: Ponto = inicio ?? pendentes[0]
  while (pendentes.length) {
    let idx = 0
    for (let i = 1; i < pendentes.length; i++) if (distancia(atual, pendentes[i]) < distancia(atual, pendentes[idx])) idx = i
    atual = pendentes.splice(idx, 1)[0]
    rota.push(atual as T)
  }
  // 2-opt: desfaz cruzamentos
  const d = (a: Ponto, b: Ponto) => distancia(a, b)
  let melhorou = true
  for (let volta = 0; melhorou && volta < 50; volta++) {
    melhorou = false
    for (let i = 0; i < rota.length - 2; i++) {
      for (let j = i + 2; j < rota.length - 1; j++) {
        const antes = d(rota[i], rota[i + 1]) + d(rota[j], rota[j + 1])
        const depois = d(rota[i], rota[j]) + d(rota[i + 1], rota[j + 1])
        if (depois + 1 < antes) {
          rota.splice(i + 1, j - i, ...rota.slice(i + 1, j + 1).reverse())
          melhorou = true
        }
      }
    }
  }
  return rota
}

export function comprimentoRota(paradas: Ponto[]) {
  let total = 0
  for (let i = 1; i < paradas.length; i++) total += distancia(paradas[i - 1], paradas[i])
  return total
}

/** Google Maps a pé, em trechos de até 10 paradas (limite do link do Maps). */
export function trechosGoogleMaps(paradas: Ponto[]): { de: number; ate: number; url: string }[] {
  const trechos = []
  for (let i = 0; i < paradas.length; i += 9) {
    const parte = paradas.slice(i, i + 10)
    if (parte.length < 2 && trechos.length) break
    const p = (x: Ponto) => `${x.lat},${x.lng}`
    const url = new URL('https://www.google.com/maps/dir/')
    url.searchParams.set('api', '1')
    url.searchParams.set('travelmode', 'walking')
    url.searchParams.set('origin', p(parte[0]))
    url.searchParams.set('destination', p(parte[parte.length - 1]))
    if (parte.length > 2) url.searchParams.set('waypoints', parte.slice(1, -1).map(p).join('|'))
    trechos.push({ de: i + 1, ate: i + parte.length, url: url.toString() })
  }
  return trechos
}

export function linkComoChegar(p: Ponto) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${p.lat},${p.lng}`
}

export function linkProcurarContato(nome: string, endereco: string | null) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${nome} ${endereco ?? ''} instagram whatsapp`.trim())}`
}

/* ------------------------------------------------------- chaves de busca */

export type Provedor = 'google' | 'tomtom'

export async function chaveConfigurada(p: Provedor): Promise<boolean> {
  const { data, error } = await supabase.rpc(`${p}_configurado`)
  falhou(error)
  return data as boolean
}

/** Grava a chave no cofre do banco; vazio remove. */
export async function salvarChave(p: Provedor, chave: string) {
  const { error } = await supabase.rpc(`salvar_chave_${p}`, { p_chave: chave })
  falhou(error)
}

/** Abre a mesma pesquisa no Google Maps (app no celular), sem custo nenhum. */
export const TERMOS_MAPS: Record<Exclude<Nicho, 'outro'>, string> = {
  restaurante: 'restaurante',
  nail: 'nail designer',
  estetica: 'clínica de estética',
  salao: 'salão de beleza',
  sobrancelha: 'design de sobrancelhas',
  barbearia: 'barbearia',
  tatuador: 'estúdio de tatuagem',
  otica: 'ótica',
}

export function linkPesquisaMaps(termo: string, centro: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/${encodeURIComponent(termo)}/@${centro.lat.toFixed(5)},${centro.lng.toFixed(5)},15z`
}
