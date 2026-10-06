import { BookOpen, Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Botao, Carregando, Chips, Janela, RotuloCampo, Selo, TituloPagina, Trilha, Vazio, classeCampo } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { PUBLICOS_CURSO, type PublicoCurso } from '../../lib/constantes'
import type { Curso } from '../../lib/tipos'

type CursoComAulas = Curso & { aulas: { id: string }[] }

/** Base das rotas: a equipe usa /painel/academia, o cliente /cliente/aulas. */
export function useBaseAcademia() {
  return useLocation().pathname.startsWith('/cliente') ? '/cliente/aulas' : '/painel/academia'
}

export default function Academia() {
  const { perfil } = useAuth()
  const base = useBaseAcademia()
  const navigate = useNavigate()
  const [cursos, setCursos] = useState<CursoComAulas[] | null>(null)
  const [vistas, setVistas] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [publico, setPublico] = useState<PublicoCurso>('equipe')
  const [novo, setNovo] = useState(false)

  const cliente = perfil?.papel === 'cliente'
  const admin = perfil?.papel === 'admin'

  useEffect(() => {
    Promise.all([api.listarCursos(), api.minhasAulasVistas()])
      .then(([c, v]) => {
        setCursos(c)
        setVistas(v)
      })
      .catch((e: Error) => setErro(e.message))
  }, [])

  const lista = (cursos ?? []).filter((c) => cliente || c.publico === publico)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TituloPagina
        sobre={cliente ? 'Conteúdo novo toda semana' : 'Treinamento da equipe e conteúdo dos clientes'}
        titulo={cliente ? 'Aulas' : 'Academia'}
      >
        {admin && (
          <Botao onClick={() => setNovo(true)} className="py-2.5">
            <Plus className="size-4" /> Novo curso
          </Botao>
        )}
      </TituloPagina>

      {!cliente && (
        <div className="w-full sm:w-72">
          <Chips
            opcoes={PUBLICOS_CURSO.map((p) => ({ valor: p.valor, rotulo: p.valor === 'equipe' ? 'Da equipe' : 'Dos clientes' }))}
            valor={publico}
            onChange={setPublico}
          />
        </div>
      )}

      {erro && <p className="text-sm text-perigo">Erro: {erro}</p>}
      {!cursos && !erro && <Carregando />}
      {cursos && lista.length === 0 && (
        <Vazio>
          {cliente
            ? 'As aulas aparecem aqui assim que forem liberadas.'
            : admin
              ? 'Nenhum curso aqui ainda. Crie o primeiro em “Novo curso”.'
              : 'Nenhum curso publicado ainda.'}
        </Vazio>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((c) => {
          const total = c.aulas.length
          const feitas = c.aulas.filter((a) => vistas.has(a.id)).length
          return (
            <li key={c.id}>
              <Link to={`${base}/${c.id}`} className="flex h-full flex-col rounded-md border border-borda bg-cartao p-5 transition hover:border-borda-2">
                <div className="flex items-start gap-3">
                  <span className="chanfro chanfro-sm grid size-10 shrink-0 place-items-center bg-cartao-2 text-prata">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] leading-snug font-semibold">{c.titulo}</h2>
                    <p className="rotulo mt-1 text-[10px]">
                      {total} aula{total === 1 ? '' : 's'}
                      {cliente ? ' liberadas' : ''}
                    </p>
                  </div>
                  {!c.publicado && <Selo cor="alerta">Rascunho</Selo>}
                </div>
                {c.descricao && <p className="mt-3 line-clamp-3 flex-1 text-sm text-suave">{c.descricao}</p>}
                <div className="mt-4">
                  <p className="font-mono text-[11px] text-apagado tabular-nums">
                    {feitas}/{total} concluídas
                  </p>
                  <Trilha pct={total ? (feitas / total) * 100 : 0} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {novo && (
        <Janela titulo="Novo curso" fechar={() => setNovo(false)}>
          <FormCurso publicoInicial={publico} aoCriar={(id) => navigate(`${base}/${id}`)} />
        </Janela>
      )}
    </div>
  )
}

function FormCurso({ publicoInicial, aoCriar }: { publicoInicial: PublicoCurso; aoCriar: (id: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [publico, setPublico] = useState<PublicoCurso>(publicoInicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      aoCriar(await api.criarCurso({ titulo: titulo.trim(), descricao: descricao.trim() || null, publico }))
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-4">
      <div>
        <RotuloCampo>Para quem</RotuloCampo>
        <Chips opcoes={PUBLICOS_CURSO} valor={publico} onChange={setPublico} />
        <p className="mt-1.5 text-xs text-apagado">
          {publico === 'clientes'
            ? 'Cada cliente vê as aulas conforme a semana dele (semana 1, 2, 3… contadas do início do cliente).'
            : 'Toda a equipe vê todas as aulas.'}
        </p>
      </div>
      <label className="block">
        <RotuloCampo>Título</RotuloCampo>
        <input autoFocus className={classeCampo} placeholder="Ex.: Onboarding da equipe" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </label>
      <label className="block">
        <RotuloCampo>Descrição</RotuloCampo>
        <textarea className={`${classeCampo} min-h-20`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <Botao type="submit" disabled={salvando || !titulo.trim()}>
        {salvando ? 'Criando…' : 'Criar e adicionar aulas'}
      </Botao>
    </form>
  )
}
