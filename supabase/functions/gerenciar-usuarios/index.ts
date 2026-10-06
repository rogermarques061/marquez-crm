// Ações de admin que precisam da service role: convidar e remover usuários.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Quem está chamando precisa ser admin
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: quem } = await admin.auth.getUser(token)
  if (!quem.user) return resposta({ erro: 'Faça login novamente.' }, 401)
  const { data: perfil } = await admin.from('profiles').select('papel').eq('id', quem.user.id).single()
  if (perfil?.papel !== 'admin') return resposta({ erro: 'Apenas administradores podem fazer isso.' }, 403)

  const corpo = await req.json()

  if (corpo.acao === 'convidar') {
    const email = String(corpo.email ?? '').trim().toLowerCase()
    const nome = String(corpo.nome ?? '').trim()
    const papel = ['admin', 'equipe', 'cliente'].includes(corpo.papel) ? corpo.papel : 'equipe'
    // acesso de cliente precisa apontar para o cliente que ele vai acompanhar
    const clienteId = papel === 'cliente' ? String(corpo.cliente_id ?? '') : null
    if (papel === 'cliente') {
      const { data: cliente } = await admin.from('clientes').select('id').eq('id', clienteId).maybeSingle()
      if (!cliente) return resposta({ erro: 'Escolha o cliente para este acesso.' }, 400)
    }
    // endereço do app que fez o convite (precisa estar em Auth → URL Configuration → Redirect URLs)
    const site = String(corpo.site ?? Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400)

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: site ? `${site}/definir-senha` : undefined,
    })
    if (error) {
      const jaExiste = /already|registered/i.test(error.message)
      return resposta({ erro: jaExiste ? 'Esse e-mail já tem acesso.' : error.message }, 400)
    }
    // o trigger handle_new_user cria o profile como cliente sem vínculo; ajusta nome, papel e cliente
    await admin.from('profiles').update({ nome: nome || email.split('@')[0], papel, cliente_id: clienteId }).eq('id', data.user.id)
    return resposta({ id: data.user.id })
  }

  if (corpo.acao === 'remover') {
    if (corpo.id === quem.user.id) return resposta({ erro: 'Você não pode remover a si mesmo.' }, 400)
    const { error } = await admin.auth.admin.deleteUser(corpo.id)
    if (error) return resposta({ erro: error.message }, 400)
    return resposta({ ok: true })
  }

  return resposta({ erro: 'Ação desconhecida.' }, 400)
})
