import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao, Carregando, Marca, RotuloCampo, classeCampo } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

/** Aberta pelo link do convite ou do "esqueci minha senha" (o link já faz o login). */
export default function DefinirSenha() {
  const { perfil, carregando, definirSenha, recarregarPerfil } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  if (carregando) return <Carregando />

  if (!perfil)
    return (
      <Moldura>
        <h1 className="titulo text-[32px] leading-tight">Link expirado.</h1>
        <p className="mt-3 text-suave">Peça um novo convite ao administrador ou use “Esqueci minha senha” na tela de entrada.</p>
        <Botao variante="secundario" className="mt-8 self-start" onClick={() => navigate('/login')}>
          Ir para a entrada
        </Botao>
      </Moldura>
    )

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.')
    if (senha !== confirmar) return setErro('As senhas não conferem.')
    setSalvando(true)
    setErro(null)
    const falha = await definirSenha(senha)
    if (falha) {
      setSalvando(false)
      return setErro(falha)
    }
    if (nome.trim() && nome.trim() !== perfil!.nome) {
      await api.atualizarMeuPerfil({ nome: nome.trim() }).catch(() => {})
      await recarregarPerfil()
    }
    navigate('/', { replace: true })
  }

  return (
    <Moldura>
      <p className="rotulo">Bem-vindo à equipe</p>
      <h1 className="titulo mt-3 text-[34px] leading-[1.05]">
        Crie sua <span className="texto-prata">senha.</span>
      </h1>
      <p className="mt-3 text-sm text-suave">{perfil.email}</p>
      <form onSubmit={salvar} className="mt-8 flex flex-col gap-4">
        <label className="block">
          <RotuloCampo>Como quer ser chamado</RotuloCampo>
          <input id="nome" className={classeCampo} placeholder={perfil.nome} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="block">
          <RotuloCampo>Nova senha</RotuloCampo>
          <input
            id="senha"
            type="password"
            autoComplete="new-password"
            className={classeCampo}
            placeholder="Mínimo 8 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <label className="block">
          <RotuloCampo>Repita a senha</RotuloCampo>
          <input
            id="confirmar"
            type="password"
            autoComplete="new-password"
            className={classeCampo}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </label>
        {erro && <p className="text-sm text-perigo">{erro}</p>}
        <Botao type="submit" disabled={salvando} className="mt-2 w-full py-3.5 text-[15px]">
          {salvando ? 'Salvando…' : 'Salvar e entrar'} <ArrowRight className="size-4" />
        </Botao>
      </form>
    </Moldura>
  )
}

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <Marca subtitulo="Marquez Digital" />
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  )
}
