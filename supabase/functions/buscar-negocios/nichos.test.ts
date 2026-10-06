import { assertEquals } from 'jsr:@std/assert@1'
import { classificar, consultaOverpass, distancia, telefoneBR } from './nichos.ts'

Deno.test('classifica pelos tipos e pelo nome', () => {
  assertEquals(classificar({ amenity: 'restaurant', name: 'Cantina' }), 'restaurante')
  assertEquals(classificar({ shop: 'hairdresser', hairdresser: 'barber', name: 'X' }), 'barbearia')
  assertEquals(classificar({ shop: 'hairdresser', name: 'Barbearia do Zé' }), 'barbearia')
  assertEquals(classificar({ shop: 'hairdresser', name: 'Studio Hair' }), 'salao')
  assertEquals(classificar({ shop: 'beauty', beauty: 'nails', name: 'X' }), 'nail')
  assertEquals(classificar({ shop: 'beauty', name: 'Esmalteria Bella' }), 'nail')
  assertEquals(classificar({ shop: 'beauty', name: 'Design de Sobrancelhas Ana' }), 'sobrancelha')
  assertEquals(classificar({ shop: 'beauty', name: 'Clínica Pele' }), 'estetica')
  assertEquals(classificar({ shop: 'tattoo', name: 'Ink' }), 'tatuador')
  assertEquals(classificar({ shop: 'optician', name: 'Ótica' }), 'otica')
  assertEquals(classificar({ shop: 'bakery', name: 'Padaria' }), null)
})

Deno.test('telefone brasileiro', () => {
  assertEquals(telefoneBR('+55 11 98765-4321'), '11987654321')
  assertEquals(telefoneBR('(21) 3333-4444'), '2133334444')
  assertEquals(telefoneBR('0xx11 98765-4321'.replace('xx', '')), '11987654321')
  assertEquals(telefoneBR(undefined, '+55 21 99999-8888;+55 21 3333-2222'), '21999998888')
  assertEquals(telefoneBR('123'), null)
})

Deno.test('consulta leve: retângulo e no máximo duas buscas', () => {
  const q = consultaOverpass(-22.745, -43.46, 2000, ['restaurante', 'nail', 'salao', 'barbearia', 'otica'])
  assertEquals(q.includes('[bbox:'), true)
  assertEquals((q.match(/nwr\[/g) ?? []).length, 2)
  assertEquals(q.includes('"shop"~"^(beauty|hairdresser|optician)$"'), true)
  assertEquals(consultaOverpass(-22.745, -43.46, 2000, ['restaurante']).includes('shop'), false)
})

Deno.test('distância em metros', () => {
  const d = distancia({ lat: -22.745, lng: -43.46 }, { lat: -22.745 + 2000 / 111320, lng: -43.46 })
  assertEquals(Math.round(d / 10) * 10, 2000)
})

import { retangulo, TERMOS } from './google.ts'
Deno.test('google: retângulo cobre o raio e todo nicho tem termo', () => {
  const r = retangulo(-22.74, -43.45, 2000)
  assertEquals(r.high.latitude > -22.74 && r.low.latitude < -22.74, true)
  assertEquals(Object.keys(TERMOS).length, 8)
})

import { buscarNoGoogle } from './google.ts'
Deno.test('google: junta nichos, tira repetidos, fechados e fora do raio', async () => {
  const centro = { lat: -22.74, lng: -43.45 }
  const lugar = (id: string, dLat: number, extra: Record<string, unknown> = {}) => ({
    id, displayName: { text: `Loja ${id}` }, location: { latitude: centro.lat + dLat, longitude: centro.lng },
    shortFormattedAddress: 'Rua A, 10', nationalPhoneNumber: '(21) 99876-5432', businessStatus: 'OPERATIONAL', ...extra,
  })
  const original = globalThis.fetch
  const pedidos: string[] = []
  globalThis.fetch = ((_url: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body))
    pedidos.push(corpo.textQuery)
    const places = corpo.textQuery === 'barbearia'
      ? [lugar('a', 0.001), lugar('b', 0.05), lugar('c', 0.002, { businessStatus: 'CLOSED_PERMANENTLY' })]
      : [lugar('a', 0.001), lugar('d', 0.003, { websiteUri: 'https://instagram.com/lojad' })]
    return Promise.resolve(new Response(JSON.stringify({ places })))
  }) as typeof fetch
  try {
    const r = await buscarNoGoogle('chave', centro.lat, centro.lng, 1000, ['barbearia', 'nail'])
    assertEquals(pedidos.sort(), ['barbearia', 'nail designer manicure'])
    assertEquals(r.map((n) => n.fonte_id).sort(), ['google/a', 'google/d'])
    assertEquals(r.find((n) => n.fonte_id === 'google/a')?.nicho, 'barbearia')
    assertEquals(r[0].telefone, '21998765432')
    assertEquals(r.find((n) => n.fonte_id === 'google/d')?.instagram, 'lojad')
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('google: chave recusada vira mensagem clara', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { status: 403 }))) as typeof fetch
  try {
    await buscarNoGoogle('ruim', -22.74, -43.45, 1000, ['otica'])
    throw new Error('devia falhar')
  } catch (e) {
    assertEquals((e as Error).message.includes('recusou a chave'), true)
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('tomtom: todo nicho tem pesquisa e o filtro separa os nichos', async () => {
  const { BUSCAS } = await import('./tomtom.ts')
  const { NICHOS } = await import('./nichos.ts')
  for (const n of NICHOS) assertEquals(BUSCAS[n].termos.length > 0, true)
  assertEquals(BUSCAS.barbearia.confere.test('Barbearia do Zé barber shop'), true)
  assertEquals(BUSCAS.otica.confere.test('Ótica Diniz'), true)
  assertEquals(BUSCAS.nail.confere.test('Esmalteria Bella'), true)
  assertEquals(BUSCAS.nail.confere.test('Posto Shell'), false)
  assertEquals(BUSCAS.tatuador.confere.test('Tattoo Studio'), true)
})

Deno.test('aosPoucos respeita o limite e a ordem', async () => {
  const { aosPoucos } = await import('./tomtom.ts')
  let rodando = 0
  let pico = 0
  const tarefas = Array.from({ length: 10 }, (_, i) => async () => {
    pico = Math.max(pico, ++rodando)
    await new Promise((ok) => setTimeout(ok, 5))
    rodando--
    return i
  })
  assertEquals(await aosPoucos(tarefas, 3), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assertEquals(pico, 3)
})
