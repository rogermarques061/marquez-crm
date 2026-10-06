import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Botao, Marca, classeCampo } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { perfil, entrar, carregando, pedirNovaSenha } = useAuth()
  const [esqueci, setEsqueci] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  if (perfil) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setAviso(null)
    if (esqueci) {
      const falha = await pedirNovaSenha(email.trim())
      setErro(falha)
      if (!falha) setAviso(`Se ${email.trim()} tiver acesso, chega um e-mail com o link para criar uma nova senha.`)
      return
    }
    setErro(await entrar(email.trim(), senha))
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <Marca subtitulo="Marquez Digital" />
      <div className="flex flex-1 flex-col justify-center">
        <p className="rotulo">Equipe e clientes</p>
        <h1 className="titulo mt-3 text-[36px] leading-[1.04]">
          {esqueci ? (
            <>
              Criar uma <span className="texto-prata">nova senha.</span>
            </>
          ) : (
            <>
              Entre na <span className="texto-prata">sua área.</span>
            </>
          )}
        </h1>
        <form onSubmit={submit} className="mt-9 flex flex-col gap-3">
          <input
            id="email"
            className={classeCampo}
            type="email"
            autoComplete="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {!esqueci && (
            <input
              id="senha"
              className={classeCampo}
              type="password"
              autoComplete="current-password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          )}
          {erro && <p className="text-sm text-perigo">{erro}</p>}
          {aviso && <p className="text-sm text-ok">{aviso}</p>}
          <Botao type="submit" disabled={carregando} className="mt-2 w-full py-3.5 text-[15px]">
            {esqueci ? 'Enviar link' : carregando ? 'Entrando…' : 'Entrar'} <ArrowRight className="size-4" />
          </Botao>
          <button
            type="button"
            onClick={() => {
              setEsqueci((x) => !x)
              setErro(null)
              setAviso(null)
            }}
            className="self-center py-2 text-sm text-suave underline underline-offset-4 hover:text-texto"
          >
            {esqueci ? 'Voltar para a entrada' : 'Esqueci minha senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
