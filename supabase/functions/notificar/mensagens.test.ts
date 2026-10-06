import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { marco, montarAviso, valorContrato, type DadosFechamento } from './mensagens.ts'

const base: DadosFechamento = {
  lead_id: 'l1', cliente: 'Clínica Bella', servico: 'Site', valor_projeto: 2500, valor_mensal: 0,
  responsavel: 'Roger', total_mes: 2500, contratos_mes: 1, meta_mes: null,
}

Deno.test('primeiro contrato do mês', () => {
  const a = montarAviso(base)
  assertEquals(a.title, 'Primeiro contrato do mês! Começou bem.')
  assertStringIncludes(a.body, 'Clínica Bella · Site')
  assertStringIncludes(a.body, '1º contrato do mês')
})

Deno.test('valor com projeto e mensalidade', () => {
  assertStringIncludes(valorContrato({ valor_projeto: 2500, valor_mensal: 600 }), '/mês')
  assertEquals(valorContrato({ valor_projeto: 0, valor_mensal: 600 }).endsWith('/mês'), true)
})

Deno.test('marcos da meta', () => {
  assertEquals(marco({ ...base, meta_mes: null }), null)
  assertEquals(marco({ ...base, meta_mes: 10000, total_mes: 5200, valor_projeto: 1000 }), 'metade')
  assertEquals(marco({ ...base, meta_mes: 10000, total_mes: 10500, valor_projeto: 1000 }), 'meta')
  assertEquals(marco({ ...base, meta_mes: 10000, total_mes: 12000, valor_projeto: 1000 }), null)
  assertEquals(montarAviso({ ...base, meta_mes: 10000, total_mes: 10500, valor_projeto: 1000, contratos_mes: 4 }).title, 'META DO MÊS BATIDA! 🏆')
})
