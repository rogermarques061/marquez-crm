const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const relativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function formatarMoeda(v: number | null | undefined) {
  return moeda.format(v ?? 0)
}

export function formatarDataHora(iso: string) {
  return dataHora.format(new Date(iso))
}

export function tempoAtras(iso: string) {
  const seg = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(seg)
  if (abs < 60) return 'agora'
  if (abs < 3600) return relativo.format(Math.round(seg / 60), 'minute')
  if (abs < 86400) return relativo.format(Math.round(seg / 3600), 'hour')
  if (abs < 86400 * 7) return relativo.format(Math.round(seg / 86400), 'day')
  return dataHora.format(new Date(iso))
}

/** 11987654321 → (11) 98765-4321 */
export function formatarWhatsapp(d: string) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

export function linkWhatsapp(d: string, texto?: string) {
  const q = texto ? `?text=${encodeURIComponent(texto)}` : ''
  return `https://wa.me/55${d}${q}`
}

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

/** "2026-10-06" (data pura, sem fuso) → 06/10/26 */
export function formatarData(dia: string) {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  return dataCurta.format(new Date(a, m - 1, d))
}

/** Dias entre hoje e a data (negativo = atrasado). */
export function diasAte(dia: string) {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(a, m - 1, d).getTime() - hoje.getTime()) / 86400000)
}

/** Nome principal de um contato: empresa quando houver. */
export function nomeContato(c: { nome: string; empresa: string | null }) {
  return c.empresa?.trim() || c.nome
}
