import { LogOut } from 'lucide-react'
import { Botao } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { MeuPerfil } from '../painel/Ajustes'

export default function ContaCliente() {
  const { sair } = useAuth()
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="mb-2">
        <p className="rotulo">Seus dados</p>
        <h1 className="titulo mt-2 text-[32px] leading-none lg:text-[40px]">Conta</h1>
      </header>
      <MeuPerfil />
      <Botao variante="secundario" onClick={() => void sair()} className="self-start">
        <LogOut className="size-4" /> Sair
      </Botao>
    </div>
  )
}
