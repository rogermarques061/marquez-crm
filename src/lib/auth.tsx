import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Perfil } from './tipos'

interface Auth {
  carregando: boolean
  perfil: Perfil | null
  entrar(email: string, senha: string): Promise<string | null>
  sair(): Promise<void>
  recarregarPerfil(): Promise<void>
  /** Manda o e-mail com o link para criar uma nova senha. */
  pedirNovaSenha(email: string): Promise<string | null>
  /** Usado no link do convite / recuperação: define a senha do usuário logado pelo link. */
  definirSenha(senha: string): Promise<string | null>
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      if (!data.session) setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = sessao?.user.id
  const buscarPerfil = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setPerfil(data as Perfil | null)
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    if (userId) void buscarPerfil()
  }, [userId, buscarPerfil])

  const valor: Auth = {
    carregando,
    perfil: userId ? perfil : null,
    async entrar(email, senha) {
      setCarregando(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        setCarregando(false)
        return error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : error.message
      }
      return null
    },
    recarregarPerfil: buscarPerfil,
    async pedirNovaSenha(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/definir-senha` })
      return error?.message ?? null
    },
    async definirSenha(senha) {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (!error) return null
      return /different from the old/i.test(error.message) ? 'A nova senha precisa ser diferente da anterior.' : error.message
    },
    async sair() {
      await supabase.auth.signOut()
      setPerfil(null)
    },
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
