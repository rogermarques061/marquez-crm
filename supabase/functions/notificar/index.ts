// Chamada pelos triggers leads_notificar_ganho_* (pg_net) a cada contrato fechado.
// Manda Web Push para os aparelhos da equipe com notificações ativas.
// Chaves VAPID e segredo ficam no Vault do banco (função config_push).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { montarAviso, type DadosFechamento } from './mensagens.ts'

interface Config {
  vapid_publica?: string
  vapid_privada?: string
  vapid_contato?: string
  notificar_segredo?: string
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

let config: Config | null = null
async function carregarConfig(): Promise<Config> {
  if (config) return config
  const { data, error } = await supabase.rpc('config_push')
  if (error) throw error
  config = data as Config
  webpush.setVapidDetails(config.vapid_contato ?? 'mailto:contato@marquez.digital', config.vapid_publica!, config.vapid_privada!)
  return config
}

const numero = (v: unknown) => (v == null ? null : Number(v))

Deno.serve(async (req) => {
  const cfg = await carregarConfig()
  if (!cfg.notificar_segredo || req.headers.get('x-segredo') !== cfg.notificar_segredo) {
    return new Response('não autorizado', { status: 401 })
  }

  const { lead_id } = await req.json()

  const { data: dados, error: erroDados } = await supabase.rpc('dados_fechamento', { p_lead_id: lead_id })
  if (erroDados) return new Response(erroDados.message, { status: 500 })
  if (!dados) return new Response('lead não encontrado', { status: 404 })
  const d = dados as DadosFechamento
  const payload = JSON.stringify(
    montarAviso({
      ...d,
      valor_projeto: Number(d.valor_projeto),
      valor_mensal: Number(d.valor_mensal),
      total_mes: Number(d.total_mes),
      meta_mes: numero(d.meta_mes),
    }),
  )

  // Só a equipe (admin/equipe) recebe aviso de contrato
  const { data: inscricoes, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, subscription_json, profiles!inner(notificacoes_ativas, papel)')
    .eq('profiles.notificacoes_ativas', true)
    .in('profiles.papel', ['admin', 'equipe'])
  if (error) return new Response(error.message, { status: 500 })

  const expiradas: string[] = []
  const resultados = await Promise.allSettled(
    (inscricoes ?? []).map((i) =>
      webpush.sendNotification(i.subscription_json, payload, { TTL: 60 * 60 * 24, urgency: 'high' }).catch((e: { statusCode?: number }) => {
        // 404/410: aparelho desinstalou ou revogou a permissão
        if (e.statusCode === 404 || e.statusCode === 410) expiradas.push(i.id)
        else console.error('falha ao enviar push', i.endpoint, e)
        throw e
      }),
    ),
  )

  if (expiradas.length) await supabase.from('push_subscriptions').delete().in('id', expiradas)

  const enviadas = resultados.filter((r) => r.status === 'fulfilled').length
  return Response.json({ enviadas, falhas: resultados.length - enviadas, removidas: expiradas.length })
})
