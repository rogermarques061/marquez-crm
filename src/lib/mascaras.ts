export function soDigitos(v: string) {
  return v.replace(/\D/g, '')
}

/** (11) 98765-4321 ou (11) 3456-7890 */
export function mascaraWhatsapp(v: string) {
  const d = soDigitos(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function whatsappValido(v: string) {
  const d = soDigitos(v)
  return /^[1-9]{2}9?\d{8}$/.test(d) && (d.length === 10 || d[2] === '9')
}

/** Normaliza para "@usuario" (sem espaços, minúsculo). */
export function mascaraInstagram(v: string) {
  const limpo = v.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase().slice(0, 30)
  return limpo ? `@${limpo}` : ''
}
