// Classificação dos negócios do OpenStreetMap nos nichos da Marquez.
// As tags do OSM dizem o tipo da loja; o nome ajuda a separar, por exemplo,
// uma nail designer de uma clínica de estética (as duas são shop=beauty).

export type Nicho = 'restaurante' | 'nail' | 'estetica' | 'salao' | 'sobrancelha' | 'barbearia' | 'tatuador' | 'otica'

export const NICHOS: Nicho[] = ['restaurante', 'nail', 'estetica', 'salao', 'sobrancelha', 'barbearia', 'tatuador', 'otica']

/** Tipos de loja (tag shop) de cada nicho; vários nichos compartilham o mesmo tipo. */
const SHOPS: Record<Exclude<Nicho, 'restaurante'>, string[]> = {
  nail: ['beauty'],
  estetica: ['beauty', 'massage'],
  sobrancelha: ['beauty'],
  salao: ['hairdresser'],
  barbearia: ['hairdresser'],
  tatuador: ['tattoo'],
  otica: ['optician'],
}

/**
 * Consulta leve: um retângulo (bbox) em vez de círculo e no máximo duas
 * buscas com expressão regular. Os servidores públicos respondem em segundos;
 * o recorte do círculo é feito depois, com `distancia`.
 */
export function consultaOverpass(lat: number, lng: number, raio: number, nichos: Nicho[]): string {
  const dLat = raio / 111320
  const dLng = raio / (111320 * Math.cos((lat * Math.PI) / 180))
  const bbox = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((v) => v.toFixed(5)).join(',')
  const partes: string[] = []
  if (nichos.includes('restaurante')) partes.push('nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|food_court)$"]["name"];')
  const shops = [...new Set(nichos.flatMap((n) => (n === 'restaurante' ? [] : SHOPS[n])))].sort()
  if (shops.length) partes.push(`nwr["shop"~"^(${shops.join('|')})$"]["name"];`)
  return `[out:json][timeout:25][bbox:${bbox}];(${partes.join('')});out center tags qt;`
}

/** Distância em metros (haversine). */
export function distancia(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

const RE = {
  nail: /\b(nail|nails|unha|unhas|esmalt|manicure|pedicure)/i,
  sobrancelha: /(sobrancelh|brow|c[ií]lio|lash|micropigment|design de olhar)/i,
  barbearia: /(barbe|barber)/i,
  estetica: /(est[eé]tic|spa\b|depila|massag|pele|skin|beleza|beauty|laser)/i,
}

export function classificar(tags: Record<string, string>): Nicho | null {
  const nome = `${tags.name ?? ''} ${tags.brand ?? ''}`
  const amenity = tags.amenity
  const shop = tags.shop

  if (amenity && /^(restaurant|fast_food|cafe|ice_cream|food_court)$/.test(amenity)) return 'restaurante'
  if (shop === 'tattoo') return 'tatuador'
  if (shop === 'optician') return 'otica'
  if (shop === 'hairdresser') {
    if (tags.hairdresser === 'barber' || RE.barbearia.test(nome)) return 'barbearia'
    return 'salao'
  }
  if (shop === 'beauty' || shop === 'massage') {
    const tipo = tags.beauty ?? ''
    if (tipo.includes('nails') || RE.nail.test(nome)) return 'nail'
    if (/brow|lash/.test(tipo) || RE.sobrancelha.test(nome)) return 'sobrancelha'
    if (RE.barbearia.test(nome)) return 'barbearia'
    return 'estetica'
  }
  return null
}

export function soDigitos(v?: string) {
  return (v ?? '').replace(/\D/g, '')
}

/** Telefone brasileiro só com dígitos e DDD (tira +55). */
export function telefoneBR(...candidatos: (string | undefined)[]): string | null {
  for (const c of candidatos) {
    if (!c) continue
    for (const pedaco of c.split(/[;,/]/)) {
      let d = soDigitos(pedaco)
      if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
      if (d.startsWith('0') && d.length >= 11) d = d.slice(1)
      if (d.length === 10 || d.length === 11) return d
    }
  }
  return null
}

export function instagramDe(tags: Record<string, string>): string | null {
  const v = tags['contact:instagram'] ?? tags.instagram
  if (!v) return null
  const m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/)
  return (m ? m[1] : v.replace(/^@/, '')).trim() || null
}

export function enderecoDe(tags: Record<string, string>): string | null {
  const rua = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ')
  const bairro = tags['addr:suburb'] ?? tags['addr:neighbourhood']
  const texto = [rua, bairro].filter(Boolean).join(' · ')
  return texto || null
}
