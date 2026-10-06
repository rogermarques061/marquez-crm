// Busca negócios dos nichos da Marquez perto de um endereço ou coordenada.
// Usa a primeira fonte com chave em Ajustes (Google Maps, depois TomTom); sem
// chave, ou se ela falhar, usa o OpenStreetMap (Photon/Nominatim + Overpass).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buscarNoGoogle, ErroGoogle, localizarNoGoogle, type NegocioGoogle } from './google.ts'
import { buscarNoTomTom, ErroTomTom, localizarNoTomTom } from './tomtom.ts'
import { classificar, consultaOverpass, distancia, enderecoDe, instagramDe, NICHOS, telefoneBR, type Nicho } from './nichos.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const AGENTE = 'MarquezPlacas/1.0 (prospeccao; contato@marquez.digital)'
const OVERPASS = [
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

/** fetch com limite de tempo: um serviço lento não pode travar a busca. */
function buscarCom(url: URL | string, ms: number) {
  return fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(ms) })
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

type Lugar = { lat: number; lng: number; nome: string }

/** Photon (komoot) primeiro; Nominatim de reserva. Os dois usam dados do OpenStreetMap. */
async function geocodificar(endereco: string): Promise<Lugar | null> {
  try {
    const url = new URL('https://photon.komoot.io/api/')
    // bbox do Brasil, para "Centro" não cair em outro país
    url.search = new URLSearchParams({ q: endereco, limit: '1', bbox: '-74.0,-34.0,-34.0,5.5' }).toString()
    const r = await buscarCom(url, 8000)
    if (r.ok) {
      const [f] = (await r.json()).features ?? []
      if (!f) return null
      const p = f.properties ?? {}
      const nome = [p.name, p.district ?? p.city, p.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')
      return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], nome: nome || endereco }
    }
    console.error('photon', r.status)
  } catch (e) {
    console.error('photon', e)
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({ q: endereco, format: 'json', limit: '1', countrycodes: 'br', 'accept-language': 'pt-BR' }).toString()
  const r = await buscarCom(url, 8000)
  if (!r.ok) {
    console.error('nominatim', r.status)
    throw new Error('Não foi possível localizar o endereço agora. Tente de novo em instantes.')
  }
  const [lugar] = await r.json()
  if (!lugar) return null
  return { lat: Number(lugar.lat), lng: Number(lugar.lon), nome: String(lugar.display_name).split(',').slice(0, 3).join(',') }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function sha(texto: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Resultado guardado por 7 dias: repetir a mesma área não gasta cota. */
async function comMemoria(fonte: string, parametros: unknown[], buscar: () => Promise<NegocioGoogle[]>): Promise<NegocioGoogle[]> {
  const id = `${fonte}:${await sha(JSON.stringify(parametros))}`
  const { data: guardado } = await admin
    .from('cache_overpass')
    .select('resposta, criado_em')
    .eq('chave', id)
    .gt('criado_em', new Date(Date.now() - 7 * 86400_000).toISOString())
    .maybeSingle()
  if (guardado) return guardado.resposta as NegocioGoogle[]
  const inicio = Date.now()
  const negocios = await buscar()
  console.log(fonte, negocios.length, `${Date.now() - inicio}ms`)
  await admin.from('cache_overpass').upsert({ chave: id, resposta: negocios, criado_em: new Date().toISOString() })
  return negocios
}

/**
 * Lojas pelo Overpass. Vai pelo banco (consultar_overpass), que é aceito pelos
 * servidores públicos, reveza entre eles e guarda o resultado por 7 dias.
 * Se o banco falhar, tenta direto daqui como último recurso.
 */
async function overpass(consulta: string) {
  const inicio = Date.now()
  const { data, error } = await admin.rpc('consultar_overpass', { p_consulta: consulta })
  if (!error) {
    console.log('overpass pelo banco', `${Date.now() - inicio}ms`)
    return data
  }
  console.error('overpass pelo banco', error.message)

  for (const base of OVERPASS) {
    try {
      const r = await buscarCom(`${base}?data=${encodeURIComponent(consulta)}`, 20000)
      if (r.ok) return await r.json()
      console.error('overpass', base, r.status)
    } catch (e) {
      console.error('overpass', base, (e as Error).name)
    }
  }
  throw new Error('Os servidores de mapa estão sobrecarregados agora. Tente de novo em alguns minutos.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Só quem tem acesso ao painel
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: membro } = await supabase.rpc('is_membro')
  if (!membro) return resposta({ erro: 'Faça login novamente.' }, 401)

  try {
    const corpo = await req.json()
    const raio = Math.min(Math.max(Number(corpo.raio) || 1500, 300), 5000)
    const nichos: Nicho[] = (Array.isArray(corpo.nichos) ? corpo.nichos : NICHOS).filter((n: string) => NICHOS.includes(n as Nicho))
    if (!nichos.length) return resposta({ erro: 'Escolha pelo menos um nicho.' }, 400)

    const [{ data: chaveGoogle }, { data: chaveTomTom }] = await Promise.all([admin.rpc('config_google'), admin.rpc('config_tomtom')])

    let centro: Lugar | null = null
    if (Number.isFinite(corpo.lat) && Number.isFinite(corpo.lng)) {
      centro = { lat: corpo.lat, lng: corpo.lng, nome: 'Sua localização' }
    } else if (typeof corpo.endereco === 'string' && corpo.endereco.trim()) {
      const inicio = Date.now()
      if (chaveGoogle) centro = await localizarNoGoogle(chaveGoogle, corpo.endereco.trim()).catch(() => null)
      if (!centro && chaveTomTom) centro = await localizarNoTomTom(chaveTomTom, corpo.endereco.trim()).catch(() => null)
      if (!centro) centro = await geocodificar(corpo.endereco.trim())
      console.log('endereco', `${Date.now() - inicio}ms`)
      if (!centro) return resposta({ erro: 'Endereço não encontrado. Tente bairro + cidade, ex.: "Centro, Niterói".' }, 404)
    } else {
      return resposta({ erro: 'Informe um endereço ou use sua localização.' }, 400)
    }

    const lat = Math.round(centro.lat * 1000) / 1000
    const lng = Math.round(centro.lng * 1000) / 1000
    const ordenados = [...nichos].sort()

    let aviso: string | null = null
    if (chaveGoogle) {
      try {
        const negocios = await comMemoria('google', [lat, lng, raio, ordenados], () => buscarNoGoogle(chaveGoogle, lat, lng, raio, ordenados))
        return resposta({ centro, raio, negocios, fonte: 'google' })
      } catch (e) {
        // Google fora do ar ou chave recusada: tenta a próxima fonte e avisa
        aviso = e instanceof ErroGoogle ? e.message : 'O Google Maps não respondeu agora.'
        console.error('google', (e as Error).message)
      }
    }
    if (chaveTomTom) {
      try {
        const negocios = await comMemoria('tomtom', [lat, lng, raio, ordenados], () => buscarNoTomTom(chaveTomTom, lat, lng, raio, ordenados))
        return resposta({ centro, raio, negocios, fonte: 'tomtom', aviso })
      } catch (e) {
        aviso = e instanceof ErroTomTom ? e.message : 'O TomTom não respondeu agora.'
        console.error('tomtom', (e as Error).message)
      }
    }

    const dados = await overpass(consultaOverpass(lat, lng, raio, ordenados))
    const vistos = new Set<string>()
    const negocios = []
    for (const e of dados.elements ?? []) {
      const tags = e.tags ?? {}
      const nicho = classificar(tags)
      if (!nicho || !nichos.includes(nicho) || !tags.name) continue
      const pLat = e.lat ?? e.center?.lat
      const pLng = e.lon ?? e.center?.lon
      if (pLat == null || pLng == null) continue
      if (distancia(centro, { lat: pLat, lng: pLng }) > raio) continue // a consulta pega um retângulo
      const chave = `${tags.name.toLowerCase()}|${pLat.toFixed(4)}|${pLng.toFixed(4)}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      negocios.push({
        fonte_id: `${e.type}/${e.id}`,
        nome: tags.name,
        nicho,
        lat: pLat,
        lng: pLng,
        endereco: enderecoDe(tags),
        telefone: telefoneBR(tags['contact:whatsapp'], tags.phone, tags['contact:phone'], tags['contact:mobile']),
        instagram: instagramDe(tags),
        site: tags.website ?? tags['contact:website'] ?? null,
      })
    }

    return resposta({ centro, raio, negocios, fonte: 'osm', aviso })
  } catch (e) {
    return resposta({ erro: (e as Error).message }, 502)
  }
})
