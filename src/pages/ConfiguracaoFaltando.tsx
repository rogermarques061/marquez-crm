import { Marca } from '../components/ui'

const VARIAVEIS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_VAPID_PUBLIC_KEY']

/** Aparece quando o site foi publicado sem as variáveis do Supabase. */
export default function ConfiguracaoFaltando() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <Marca subtitulo="Marquez Digital" />
      <div className="flex flex-1 flex-col justify-center">
        <p className="rotulo text-alerta">Configuração pendente</p>
        <h1 className="titulo mt-3 text-[32px] leading-[1.05]">O app ainda não está ligado ao banco de dados.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-suave">
          Na Vercel, abra o projeto → <strong className="text-texto">Settings → Environment Variables</strong>, cadastre as
          variáveis abaixo e faça um novo deploy (<strong className="text-texto">Deployments → ⋯ → Redeploy</strong>).
        </p>
        <ul className="mt-6 flex flex-col divide-y divide-borda rounded-md border border-borda bg-cartao">
          {VARIAVEIS.map((v) => (
            <li key={v} className="px-4 py-3 font-mono text-sm">
              {v}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
