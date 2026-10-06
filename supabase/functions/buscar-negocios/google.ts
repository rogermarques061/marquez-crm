// Busca no Google Maps (Places API "New" — Text Search), um termo por nicho,
// como alguém digitaria no Maps. Pega as lojas de bairro que não estão no
// OpenStreetMap, quase sempre com telefone.
import { distancia, telefoneBR, type Nicho } from './nichos.ts'

/** O que se digita no Maps para cada nicho. */
export const TERMOS: Record<Nicho, string> = {
  restaurante: 'restaurante lanchonete',
  nail: 'nail designer manicure',
  estetica: 'clínica de estética',
  salao: 'salão de beleza',
  sobrancelha: 'design de sobrancelhas',
  barbearia: 'barbearia',
  tatuador: 'estúdio de tatuagem',
  otica: 'ótica',
}

const CAMPOS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
].join(',')

export interface NegocioGoogle {
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

interface Lugar {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude: number; longitude: number }
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  businessStatus?: string
}

/** Retângulo que contém o círculo da busca (a Text Search só restringe por retângulo). */
export function retangulo(lat: number, lng: number, raio: number) {
  const dLat = raio / 111320
  const dLng = raio / (111320 * Math.cos((lat * Math.PI) / 180))
  return { low: { latitude: lat - dLat, longitude: lng - dLng }, high: { latitude: lat + dLat, longitude: lng + dLng } }
}

export class ErroGoogle extends Error {}

async function pesquisar(chave: string, termo: string, lat: number, lng: number, raio: number): Promise<Lugar[]> {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': CAMPOS },
    body: JSON.stringify({
      textQuery: termo,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: 20,
      locationRestriction: { rectangle: retangulo(lat, lng, raio) },
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}))
    const motivo = corpo?.error?.status ?? r.status
    console.error('google', termo, r.status, JSON.stringify(corpo?.error ?? {}).slice(0, 300))
    if (r.status === 400 || r.status === 403) {
      throw new ErroGoogle(`O Google recusou a chave (${motivo}). Confira em Ajustes se a chave está certa e se a "Places API (New)" está ativada.`)
    }
    throw new ErroGoogle(`O Google Maps não respondeu (${motivo}).`)
  }
  const dados = await r.json()
  return dados.places ?? []
}

/** Endereço/bairro → ponto no mapa, pelo próprio Google (acha bairros que o OpenStreetMap não tem). */
export async function localizarNoGoogle(chave: string, endereco: string) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': 'places.location,places.formattedAddress,places.displayName' },
    body: JSON.stringify({ textQuery: endereco, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 1 }),
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) {
    console.error('google localizar', r.status)
    return null
  }
  const [l] = ((await r.json()).places ?? []) as Lugar[]
  if (!l?.location) return null
  const nome = (l.formattedAddress ?? l.displayName?.text ?? endereco).split(',').slice(0, 3).join(',').replace(/ - [A-Z]{2}$/, '')
  return { lat: l.location.latitude, lng: l.location.longitude, nome }
}

/** Uma pesquisa por nicho, em paralelo; tira repetidos, fechados e o que ficou fora do raio. */
export async function buscarNoGoogle(chave: string, lat: number, lng: number, raio: number, nichos: Nicho[]): Promise<NegocioGoogle[]> {
  const resultados = await Promise.all(nichos.map((n) => pesquisar(chave, TERMOS[n], lat, lng, raio).then((ls) => ({ n, ls }))))
  const vistos = new Set<string>()
  const negocios: NegocioGoogle[] = []
  for (const { n, ls } of resultados) {
    for (const l of ls) {
      if (vistos.has(l.id) || !l.location || !l.displayName?.text) continue
      if (l.businessStatus && l.businessStatus !== 'OPERATIONAL') continue
      const ponto = { lat: l.location.latitude, lng: l.location.longitude }
      if (distancia({ lat, lng }, ponto) > raio) continue
      vistos.add(l.id)
      negocios.push({
        fonte_id: `google/${l.id}`,
        nome: l.displayName.text,
        nicho: n,
        ...ponto,
        endereco: l.shortFormattedAddress ?? l.formattedAddress ?? null,
        telefone: telefoneBR(l.nationalPhoneNumber, l.internationalPhoneNumber),
        instagram: l.websiteUri?.match(/instagram\.com\/([A-Za-z0-9._]+)/)?.[1] ?? null,
        site: l.websiteUri && !l.websiteUri.includes('instagram.com') ? l.websiteUri : null,
      })
    }
  }
  return negocios
}
