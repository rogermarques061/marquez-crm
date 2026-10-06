import { Footprints, MessageCircle } from 'lucide-react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Rua from './Rua'
import X1 from './X1'

const ABAS = [
  { para: '/painel/prospeccao/rua', rotulo: 'Na rua', icone: Footprints, sub: 'Rota de visitas porta a porta' },
  { para: '/painel/prospeccao/x1', rotulo: 'No X1', icone: MessageCircle, sub: 'Mensagem direta no WhatsApp' },
]

/** Prospecção de novos clientes: dois setores com a mesma busca de negócios. */
export default function Prospeccao() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="rotulo">Negócios locais para virar cliente da agência</p>
        <h1 className="titulo mt-2 text-[32px] leading-none lg:text-[40px]">Prospecção</h1>
      </header>

      <nav className="grid grid-cols-2 gap-2">
        {ABAS.map((a) => (
          <NavLink
            key={a.para}
            to={a.para}
            className={({ isActive }) =>
              `relative flex items-center gap-3 overflow-hidden rounded-md border px-4 py-3 transition ${
                isActive ? 'border-borda-2 bg-cartao-2' : 'border-borda bg-cartao hover:border-borda-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="prata absolute top-0 left-0 h-full w-[3px]" />}
                <a.icone className={`size-5 shrink-0 ${isActive ? 'text-prata' : 'text-apagado'}`} />
                <span className="min-w-0">
                  <span className={`block text-[15px] ${isActive ? 'font-semibold text-white' : 'text-suave'}`}>{a.rotulo}</span>
                  <span className="hidden truncate text-xs text-apagado sm:block">{a.sub}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<Navigate to="rua" replace />} />
        <Route path="rua" element={<Rua />} />
        <Route path="x1" element={<X1 />} />
      </Routes>
    </div>
  )
}
