import { Check, Copy, Lightbulb, MessageCircle, X } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { Chips } from '../../../components/ui'
import { useAuth } from '../../../lib/auth'
import { infoNicho, type Nicho } from '../../../lib/prospeccao'
import { ABERTURAS, nomeFalado, proximaAbertura, PUBLICOS, publicoDoNicho, RESPOSTAS, type Publico } from '../../../lib/roteiros'

export type ModoRoteiro = 'abertura' | 'respostas'

/** Mostra a mensagem montada (como vai aparecer no WhatsApp) e abre a conversa com ela. */
export default function Roteiro({
  nome,
  nicho,
  modo,
  aoEnviar,
  aoFechar,
}: {
  nome: string
  nicho: Nicho
  modo: ModoRoteiro
  aoEnviar: (texto: string) => void
  aoFechar: () => void
}) {
  const { perfil } = useAuth()
  const lista = modo === 'abertura' ? ABERTURAS : RESPOSTAS
  const [id, setId] = useState(() => (modo === 'abertura' ? proximaAbertura().id : RESPOSTAS[0].id))
  const [publico, setPublico] = useState<Publico>(publicoDoNicho(nicho))
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [aoFechar])

  const mensagem = lista.find((m) => m.id === id) ?? lista[0]
  const texto = mensagem.texto({ nome, nicho, publico, vendedor: perfil?.nome.trim().split(/\s+/)[0] })

  function copiar() {
    void navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modo === 'abertura' ? 'Primeira mensagem' : 'Respostas prontas'}
        onClick={(e) => e.stopPropagation()}
        className="animar-entrada flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-borda-2 bg-cartao sm:max-w-lg sm:rounded-xl"
      >
        <header className="flex items-start gap-3 border-b border-borda px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="rotulo text-[10px]">{modo === 'abertura' ? 'Primeira mensagem' : 'Respostas prontas'}</p>
            <p className="mt-1 flex items-center gap-2 truncate font-semibold">
              <span className="size-2 shrink-0 rounded-full" style={{ background: infoNicho(nicho).cor }} />
              {nomeFalado(nome)}
            </p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid size-9 place-items-center rounded-md text-apagado hover:bg-cartao-2 hover:text-texto">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
          <div>
            <p className="rotulo mb-2 text-[10px]">{modo === 'abertura' ? 'Abordagem' : 'O que responder'}</p>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {lista.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setId(m.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                    m.id === mensagem.id ? 'border-prata-2 bg-prata/[0.08] font-semibold text-white' : 'border-borda text-suave hover:border-borda-2'
                  }`}
                >
                  {m.titulo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="rotulo mb-2 text-[10px]">Público</p>
            <Chips opcoes={PUBLICOS} valor={publico} onChange={setPublico} colunas={3} />
          </div>

          <div className="rounded-lg bg-[#0b141a] p-3">
            <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[14px] leading-snug whitespace-pre-wrap text-[#e9edef] shadow">
              <TextoWhatsapp texto={texto} />
            </div>
          </div>

          {mensagem.dica && (
            <p className="flex items-start gap-2 rounded-md border border-alerta/30 bg-alerta/[0.05] px-3 py-2 text-xs text-alerta">
              <Lightbulb className="mt-px size-3.5 shrink-0" /> {mensagem.dica}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-borda px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={copiar}
            className="flex items-center justify-center gap-1.5 rounded-md border border-borda-2 px-4 py-3 text-sm text-suave hover:text-texto"
          >
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={() => aoEnviar(texto)}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#25d366] px-4 py-3 text-sm font-semibold text-[#0b141a] hover:brightness-105"
          >
            <MessageCircle className="size-4" /> Enviar no WhatsApp
          </button>
        </footer>
      </div>
    </div>
  )
}

/** *negrito* do WhatsApp. */
function TextoWhatsapp({ texto }: { texto: string }) {
  return texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
    parte.startsWith('*') && parte.endsWith('*') && parte.length > 2 ? <strong key={i}>{parte.slice(1, -1)}</strong> : <Fragment key={i}>{parte}</Fragment>,
  )
}
