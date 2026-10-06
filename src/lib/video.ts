/** Converte o link do vídeo (YouTube, Vimeo, Loom, Google Drive) no endereço do player. */
export function linkIncorporado(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\.|^m\./, '')

  if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host === 'vimeo.com') {
    const [id, hash] = u.pathname.split('/').filter(Boolean)
    return /^\d+$/.test(id ?? '') ? `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}` : null
  }
  if (host === 'player.vimeo.com') return url
  if (host === 'loom.com') {
    const id = u.pathname.match(/^\/(?:share|embed)\/(\w+)/)?.[1]
    return id ? `https://www.loom.com/embed/${id}` : null
  }
  if (host === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1]
    return id ? `https://drive.google.com/file/d/${id}/preview` : null
  }
  return null
}
