import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Carregando } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'

const Login = lazy(() => import('./pages/Login'))
const DefinirSenha = lazy(() => import('./pages/DefinirSenha'))

// Painel da agência (admin e equipe)
const LayoutPainel = lazy(() => import('./pages/painel/Layout'))
const Dashboard = lazy(() => import('./pages/painel/Dashboard'))
const Contatos = lazy(() => import('./pages/painel/Contatos'))
const Leads = lazy(() => import('./pages/painel/Leads'))
const Prospeccao = lazy(() => import('./pages/painel/prospeccao/Prospeccao'))
const Clientes = lazy(() => import('./pages/painel/Clientes'))
const ClienteDetalhe = lazy(() => import('./pages/painel/ClienteDetalhe'))
const Academia = lazy(() => import('./pages/academia/Academia'))
const CursoPagina = lazy(() => import('./pages/academia/CursoPagina'))
const Ajustes = lazy(() => import('./pages/painel/Ajustes'))

// Área do cliente
const LayoutCliente = lazy(() => import('./pages/cliente/LayoutCliente'))
const MeuServico = lazy(() => import('./pages/cliente/MeuServico'))
const ContaCliente = lazy(() => import('./pages/cliente/ContaCliente'))

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/definir-senha" element={<DefinirSenha />} />
          <Route path="/painel" element={<LayoutPainel />}>
            <Route index element={<Dashboard />} />
            <Route path="contatos" element={<Contatos />} />
            <Route path="leads" element={<Leads />} />
            <Route path="prospeccao/*" element={<Prospeccao />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalhe />} />
            <Route path="academia" element={<Academia />} />
            <Route path="academia/:id" element={<CursoPagina />} />
            <Route path="ajustes" element={<Ajustes />} />
          </Route>
          <Route path="/cliente" element={<LayoutCliente />}>
            <Route index element={<MeuServico />} />
            <Route path="aulas" element={<Academia />} />
            <Route path="aulas/:id" element={<CursoPagina />} />
            <Route path="conta" element={<ContaCliente />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

/** Endereço principal: cada um cai na sua área. */
function Inicio() {
  const { perfil, carregando } = useAuth()
  if (carregando) return <Carregando />
  if (!perfil) return <Navigate to="/login" replace />
  return <Navigate to={perfil.papel === 'cliente' ? '/cliente' : '/painel'} replace />
}
