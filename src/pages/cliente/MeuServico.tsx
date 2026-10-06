import { ArrowRight, BookOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListaTarefas, Mural, Prazo } from '../../components/Execucao'
import { Bloco, Cabecalho, Carregando, MarcaEtapa, Trilha, Vazio } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { STATUS_SERVICO } from '../../lib/constantes'
import type { Atualizacao, Aula, Curso, Perfil, Servico, Tarefa } from '../../lib/tipos'

export default function MeuServico() {
  const { perfil } = useAuth()
  const [servicos, setServicos] = useState<Servico[] | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [mural, setMural] = useState<Atualizacao[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [proxima, setProxima] = useState<{ curso: Curso; aula: Aula } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const s = (await api.listarServicos()).filter((x) => x.status !== 'cancelado')
      const ids = s.map((x) => x.id)
      const [t, m] = await Promise.all([api.listarTarefas(ids), api.listarAtualizacoes(ids)])
      setServicos(s)
      setTarefas(t)
      setMural(m)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void carregar()
    api.listarPerfis().then(setPerfis).catch(() => {})
    // Próxima aula ainda não vista, para o atalho do topo
    Promise.all([api.listarCursos(), api.minhasAulasVistas()])
      .then(async ([cursos, vistas]) => {
        for (const curso of cursos) {
          const aula = (await api.listarAulas(curso.id)).find((a) => !vistas.has(a.id))
          if (aula) return setProxima({ curso, aula })
        }
      })
      .catch(() => {})
    const a = api.ouvirTarefas(() => void carregar())
    const b = api.ouvirAtualizacoes(() => void carregar())
    return () => {
      a()
      b()
    }
  }, [carregar])

  if (erro) return <p className="text-perigo">{erro}</p>
  if (!servicos) return <Carregando />

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header className="mb-1">
        <p className="rotulo">Acompanhe tudo por aqui</p>
        <h1 className="titulo mt-2 text-[32px] leading-none lg:text-[40px]">Olá, {perfil?.nome.split(' ')[0]}.</h1>
      </header>

      {proxima && (
        <Link
          to={`/cliente/aulas/${proxima.curso.id}`}
          className="group relative flex items-center gap-4 overflow-hidden rounded-md border border-borda-2 bg-cartao p-4 transition hover:border-prata-2 lg:p-5"
        >
          <span className="prata absolute top-0 left-0 h-full w-[3px]" />
          <span className="chanfro chanfro-sm grid size-11 shrink-0 place-items-center bg-cartao-2 text-prata">
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="rotulo block text-[10px]">Sua aula desta semana · {proxima.curso.titulo}</span>
            <span className="mt-1 block truncate font-semibold">{proxima.aula.titulo}</span>
          </span>
          <ArrowRight className="size-5 text-apagado transition group-hover:translate-x-0.5 group-hover:text-texto" />
        </Link>
      )}

      {servicos.length === 0 && <Vazio>Seu projeto está sendo preparado. Assim que começar, o andamento aparece aqui.</Vazio>}

      {servicos.map((s) => {
        const ts = tarefas.filter((t) => t.servico_id === s.id)
        const feitas = ts.filter((t) => t.status === 'feito').length
        const st = STATUS_SERVICO.find((x) => x.valor === s.status)!
        return (
          <Bloco key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold">
                <MarcaEtapa cor={st.cor} /> {s.nome}
              </h2>
              <div className="flex items-center gap-3">
                {s.prazo && <Prazo dia={s.prazo} feito={s.status === 'entregue'} />}
                <span className="rounded-sm border border-borda-2 px-1.5 py-0.5 font-mono text-[10.5px] tracking-wider text-suave uppercase">{st.rotulo}</span>
              </div>
            </div>
            {s.descricao && <p className="mt-3 text-sm whitespace-pre-wrap text-suave">{s.descricao}</p>}
            <div className="mt-4 flex items-baseline justify-between">
              <span className="titulo text-[28px] leading-none tabular-nums">{ts.length ? Math.round((feitas / ts.length) * 100) : 0}%</span>
              <span className="font-mono text-[11px] text-apagado tabular-nums">
                {feitas} de {ts.length} etapas concluídas
              </span>
            </div>
            <Trilha pct={ts.length ? (feitas / ts.length) * 100 : 0} className="mt-2" />
            <div className="mt-4">
              <ListaTarefas tarefas={ts} servicoId={s.id} equipe={[]} editavel={false} aoMudar={() => void carregar()} />
            </div>
          </Bloco>
        )
      })}

      {servicos.length > 0 && (
        <Bloco>
          <Cabecalho titulo="Mural" sub="Novidades do time e seus recados" />
          <div className="mt-5">
            <Mural atualizacoes={mural} servicos={servicos} perfis={perfis} euId={perfil?.id} equipeVendo={false} aoMudar={() => void carregar()} />
          </div>
        </Bloco>
      )}
    </div>
  )
}
