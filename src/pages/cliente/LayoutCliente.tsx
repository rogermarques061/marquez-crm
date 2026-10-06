import { BookOpen, LayoutGrid, UserRound, type LucideIcon } from 'lucide-react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Carregando, Marca } from '../../components/ui'
import { useAuth } from '../../lib/auth'

const ITENS: { para: string; rotulo: string; icone: LucideIcon; fim?: boolean }[] = [
  { para: '/cliente', rotulo: 'Meu projeto', icone: LayoutGrid, fim: true },
  { para: '/cliente/aulas', rotulo: 'Aulas', icone: BookOpen },
  { para: '/cliente/conta', rotulo: 'Conta', icone: UserRound },
]

/** Área do cliente: andamento do serviço, mural e aulas da semana. */
export default function LayoutCliente() {
  const { perfil, carregando } = useAuth()

  if (carregando) return <Carregando />
  if (!perfil) return <Navigate to="/login" replace />
  if (perfil.papel !== 'cliente') return <Navigate to="/painel" replace />

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-borda bg-fundo/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4">
          <Marca subtitulo="Área do cliente" />
          <nav className="hidden gap-1 sm:flex">
            {ITENS.map((i) => (
              <NavLink
                key={i.para}
                to={i.para}
                end={i.fim}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${isActive ? 'bg-cartao font-semibold text-white' : 'text-suave hover:text-texto'}`
                }
              >
                <i.icone className="size-4" /> {i.rotulo}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6 pb-28 sm:pb-12 lg:pt-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-borda bg-lateral/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {ITENS.map((i) => (
          <NavLink
            key={i.para}
            to={i.para}
            end={i.fim}
            className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'font-semibold text-white' : 'text-apagado'}`}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="prata absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2" />}
                <i.icone className="size-5" />
                {i.rotulo}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
