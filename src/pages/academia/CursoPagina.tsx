import { ArrowLeft, CheckCircle2, Circle, Clock, ExternalLink, FileText, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bloco, Botao, Cabecalho, Carregando, Chips, Janela, RotuloCampo, Selo, Trilha, classeCampo } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { PUBLICOS_CURSO, rotulo } from '../../lib/constantes'
import type { Aula, AulaEditavel, Curso, Perfil } from '../../lib/tipos'
import { linkIncorporado } from '../../lib/video'
import { useBaseAcademia } from './Academia'

export default function CursoPagina() {
  const { id = '' } = useParams()
  const { perfil } = useAuth()
  const base = useBaseAcademia()
  const navigate = useNavigate()
  const [curso, setCurso] = useState<Curso | null | undefined>(undefined)
  const [aulas, setAulas] = useState<Aula[]>([])
  const [vistas, setVistas] = useState<Set<string>>(new Set())
  const [atual, setAtual] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editandoCurso, setEditandoCurso] = useState(false)
  const [editandoAula, setEditandoAula] = useState<Aula | 'nova' | null>(null)
  const [progresso, setProgresso] = useState(false)

  const admin = perfil?.papel === 'admin'

  const carregar = useCallback(async () => {
    try {
      const [c, a, v] = await Promise.all([api.obterCurso(id), api.listarAulas(id), api.minhasAulasVistas()])
      setCurso(c)
      setAulas(a)
      setVistas(v)
      // Abre na primeira aula ainda não vista
      setAtual((x) => x ?? a.find((au) => !v.has(au.id))?.id ?? a[0]?.id ?? null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function marcar(aula: Aula, vista: boolean) {
    const novo = new Set(vistas)
    if (vista) novo.add(aula.id)
    else novo.delete(aula.id)
    setVistas(novo)
    try {
      await api.marcarAula(aula.id, vista)
      // Concluiu: já vai para a próxima
      if (vista) {
        const proxima = aulas.find((a) => !novo.has(a.id))
        if (proxima) setAtual(proxima.id)
      }
    } catch (e) {
      setErro((e as Error).message)
      void carregar()
    }
  }

  if (curso === undefined) return erro ? <p className="text-perigo">{erro}</p> : <Carregando />
  if (curso === null) return <p className="text-apagado">Curso não encontrado.</p>

  const aula = aulas.find((a) => a.id === atual) ?? null
  const feitas = aulas.filter((a) => vistas.has(a.id)).length

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <Link to={base} className="flex items-center gap-1.5 self-start text-sm text-suave hover:text-texto">
        <ArrowLeft className="size-4" /> {base.startsWith('/cliente') ? 'Aulas' : 'Academia'}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo">
            {admin && `Curso ${rotulo(PUBLICOS_CURSO, curso.publico).toLowerCase()} · `}
            {feitas}/{aulas.length} concluídas
          </p>
          <h1 className="titulo mt-2 text-[30px] leading-none break-words lg:text-[38px]">{curso.titulo}</h1>
        </div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            {!curso.publicado && <Selo cor="alerta">Rascunho · ninguém vê</Selo>}
            <Botao variante="secundario" className="py-2" onClick={() => setProgresso(true)}>
              <Users className="size-4" /> Quem assistiu
            </Botao>
            <Botao variante="secundario" className="py-2" onClick={() => setEditandoCurso(true)}>
              <Pencil className="size-4" /> Editar curso
            </Botao>
          </div>
        )}
      </header>
      {curso.descricao && <p className="-mt-2 max-w-3xl text-sm text-suave">{curso.descricao}</p>}
      <Trilha pct={aulas.length ? (feitas / aulas.length) * 100 : 0} className="max-w-md" />
      {erro && <p className="text-sm text-perigo">{erro}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5">
        <div className="min-w-0">
          {aula ? (
            <Player aula={aula} vista={vistas.has(aula.id)} marcar={(v) => void marcar(aula, v)} admin={admin} editar={() => setEditandoAula(aula)} publico={curso.publico} />
          ) : (
            <Bloco>
              <p className="text-sm text-apagado">
                {admin ? 'Nenhuma aula ainda. Adicione a primeira ao lado.' : 'As aulas deste curso aparecem aqui conforme forem liberadas.'}
              </p>
            </Bloco>
          )}
        </div>

        <Bloco className="p-3 lg:p-3">
          <div className="px-2 pt-2 pb-3">
            <Cabecalho titulo="Aulas" sub={curso.publico === 'clientes' && !admin ? 'Novas aulas toda semana' : undefined} />
          </div>
          <ol className="flex flex-col gap-1">
            {aulas.map((a, i) => {
              const ativa = a.id === atual
              const vista = vistas.has(a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setAtual(a.id)}
                    className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition ${ativa ? 'bg-cartao-2' : 'hover:bg-cartao-2/60'}`}
                  >
                    {vista ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <Circle className="mt-0.5 size-4 shrink-0 text-apagado" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${ativa ? 'font-semibold text-white' : 'text-suave'}`}>
                        {i + 1}. {a.titulo}
                      </span>
                      <span className="mt-0.5 flex gap-2 font-mono text-[10.5px] text-apagado">
                        {a.semana && curso.publico === 'clientes' && <span>semana {a.semana}</span>}
                        {a.duracao_min && <span>{a.duracao_min} min</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          {admin && (
            <Botao variante="secundario" className="mt-2 w-full" onClick={() => setEditandoAula('nova')}>
              <Plus className="size-4" /> Adicionar aula
            </Botao>
          )}
        </Bloco>
      </div>

      {editandoCurso && (
        <Janela titulo="Editar curso" fechar={() => setEditandoCurso(false)}>
          <EditarCurso
            curso={curso}
            aoSalvar={() => {
              setEditandoCurso(false)
              void carregar()
            }}
            aoExcluir={() => navigate(base)}
          />
        </Janela>
      )}

      {editandoAula && (
        <Janela titulo={editandoAula === 'nova' ? 'Nova aula' : 'Editar aula'} fechar={() => setEditandoAula(null)}>
          <FormAula
            cursoId={curso.id}
            aula={editandoAula === 'nova' ? null : editandoAula}
            semanaSugerida={curso.publico === 'clientes' ? (aulas.at(-1)?.semana ?? 0) + 1 : null}
            aoSalvar={() => {
              setEditandoAula(null)
              void carregar()
            }}
          />
        </Janela>
      )}

      {progresso && (
        <Janela titulo="Quem assistiu" fechar={() => setProgresso(false)}>
          <Progresso aulas={aulas} publico={curso.publico} />
        </Janela>
      )}
    </div>
  )
}

function Player({
  aula,
  vista,
  marcar,
  admin,
  editar,
  publico,
}: {
  aula: Aula
  vista: boolean
  marcar: (v: boolean) => void
  admin: boolean
  editar: () => void
  publico: Curso['publico']
}) {
  const embed = aula.video_url ? linkIncorporado(aula.video_url) : null
  return (
    <div className="flex flex-col gap-4">
      {embed ? (
        <div className="aspect-video overflow-hidden rounded-md border border-borda bg-black">
          <iframe
            key={embed}
            src={embed}
            title={aula.titulo}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : aula.video_url ? (
        <a
          href={aula.video_url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-video items-center justify-center gap-2 rounded-md border border-borda bg-cartao text-sm text-suave hover:text-texto"
        >
          <ExternalLink className="size-4" /> Abrir o vídeo da aula
        </a>
      ) : null}

      <Bloco>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold">{aula.titulo}</h2>
            <p className="mt-1 flex gap-3 font-mono text-[11px] text-apagado">
              {aula.duracao_min && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {aula.duracao_min} min
                </span>
              )}
              {admin && publico === 'clientes' && <span>{aula.semana ? `libera na semana ${aula.semana}` : 'liberada para todos'}</span>}
            </p>
          </div>
          {admin && (
            <Botao variante="fantasma" className="px-2 py-1.5" onClick={editar}>
              <Pencil className="size-4" /> Editar
            </Botao>
          )}
        </div>
        {aula.descricao && <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-suave">{aula.descricao}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Botao variante={vista ? 'secundario' : 'primario'} onClick={() => marcar(!vista)}>
            <CheckCircle2 className="size-4" /> {vista ? 'Concluída' : 'Marcar como concluída'}
          </Botao>
          {aula.material_url && (
            <a
              href={aula.material_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-borda-2 bg-cartao px-4 py-3 text-sm font-medium hover:border-grafite"
            >
              <FileText className="size-4" /> Material de apoio
            </a>
          )}
        </div>
      </Bloco>
    </div>
  )
}

function EditarCurso({ curso, aoSalvar, aoExcluir }: { curso: Curso; aoSalvar: () => void; aoExcluir: () => void }) {
  const [f, setF] = useState({ titulo: curso.titulo, descricao: curso.descricao ?? '', publico: curso.publico, publicado: curso.publicado })
  const [excluir, setExcluir] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await api.atualizarCurso(curso.id, { ...f, titulo: f.titulo.trim() || curso.titulo, descricao: f.descricao.trim() || null })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 rounded-md border border-borda bg-cartao-2 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold">Publicado</span>
          <span className="text-xs text-apagado">Rascunho só você (admin) vê.</span>
        </span>
        <input type="checkbox" className="size-5 accent-[#bdbac9]" checked={f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} />
      </label>
      <div>
        <RotuloCampo>Para quem</RotuloCampo>
        <Chips opcoes={PUBLICOS_CURSO} valor={f.publico} onChange={(v) => setF({ ...f, publico: v })} />
      </div>
      <label className="block">
        <RotuloCampo>Título</RotuloCampo>
        <input className={classeCampo} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      </label>
      <label className="block">
        <RotuloCampo>Descrição</RotuloCampo>
        <textarea className={`${classeCampo} min-h-20`} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      </label>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Botao type="submit">Salvar</Botao>
        {excluir ? (
          <>
            <span className="ml-auto text-sm text-suave">Excluir com todas as aulas?</span>
            <Botao variante="perigo" onClick={() => void api.excluirCurso(curso.id).then(aoExcluir).catch((e: Error) => setErro(e.message))}>
              Excluir
            </Botao>
          </>
        ) : (
          <Botao variante="fantasma" className="ml-auto text-perigo/80 hover:text-perigo" onClick={() => setExcluir(true)}>
            <Trash2 className="size-4" /> Excluir curso
          </Botao>
        )}
      </div>
    </form>
  )
}

function FormAula({
  cursoId,
  aula,
  semanaSugerida,
  aoSalvar,
}: {
  cursoId: string
  aula: Aula | null
  semanaSugerida: number | null
  aoSalvar: () => void
}) {
  const [f, setF] = useState({
    titulo: aula?.titulo ?? '',
    descricao: aula?.descricao ?? '',
    video: aula?.video_url ?? '',
    material: aula?.material_url ?? '',
    semana: aula ? (aula.semana ? String(aula.semana) : '') : semanaSugerida ? String(semanaSugerida) : '',
    duracao: aula?.duracao_min ? String(aula.duracao_min) : '',
  })
  const [salvando, setSalvando] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const url = (v: string) => (v.trim() ? (/^https?:\/\//.test(v.trim()) ? v.trim() : `https://${v.trim()}`) : null)
  const inteiro = (v: string) => (Number(v) > 0 ? Math.round(Number(v)) : null)
  const previa = f.video ? linkIncorporado(url(f.video) ?? '') : null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    const dados: AulaEditavel = {
      titulo: f.titulo.trim(),
      descricao: f.descricao.trim() || null,
      video_url: url(f.video),
      material_url: url(f.material),
      semana: inteiro(f.semana),
      duracao_min: inteiro(f.duracao),
    }
    try {
      if (aula) await api.atualizarAula(aula.id, dados)
      else await api.criarAula({ ...dados, curso_id: cursoId, titulo: dados.titulo! })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <label className="block">
        <RotuloCampo>Título</RotuloCampo>
        <input autoFocus={!aula} className={classeCampo} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required />
      </label>
      <label className="block">
        <RotuloCampo erro={f.video.trim() !== '' && !previa && 'vai abrir como link'}>Vídeo (YouTube, Vimeo, Loom ou Google Drive)</RotuloCampo>
        <input className={classeCampo} placeholder="https://youtu.be/…" value={f.video} onChange={(e) => setF({ ...f, video: e.target.value })} />
      </label>
      <label className="block">
        <RotuloCampo>Texto da aula</RotuloCampo>
        <textarea className={`${classeCampo} min-h-24`} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      </label>
      <label className="block">
        <RotuloCampo>Material de apoio (link)</RotuloCampo>
        <input className={classeCampo} placeholder="PDF, planilha, Notion…" value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {semanaSugerida !== null || aula?.semana ? (
          <label className="block">
            <RotuloCampo>Libera na semana</RotuloCampo>
            <input inputMode="numeric" className={classeCampo} placeholder="vazio = já" value={f.semana} onChange={(e) => setF({ ...f, semana: e.target.value.replace(/\D/g, '') })} />
          </label>
        ) : (
          <span />
        )}
        <label className="block">
          <RotuloCampo>Duração (min)</RotuloCampo>
          <input inputMode="numeric" className={classeCampo} value={f.duracao} onChange={(e) => setF({ ...f, duracao: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Botao type="submit" disabled={salvando || !f.titulo.trim()}>
          {salvando ? 'Salvando…' : 'Salvar aula'}
        </Botao>
        {aula &&
          (excluir ? (
            <Botao variante="perigo" className="ml-auto" onClick={() => void api.excluirAula(aula.id).then(aoSalvar).catch((e: Error) => setErro(e.message))}>
              Confirmar exclusão
            </Botao>
          ) : (
            <Botao variante="fantasma" className="ml-auto text-perigo/80 hover:text-perigo" onClick={() => setExcluir(true)}>
              <Trash2 className="size-4" /> Excluir
            </Botao>
          ))}
      </div>
    </form>
  )
}

/** Admin: quanto cada pessoa já concluiu deste curso. */
function Progresso({ aulas, publico }: { aulas: Aula[]; publico: Curso['publico'] }) {
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [marcas, setMarcas] = useState<{ user_id: string; aula_id: string }[] | null>(null)

  useEffect(() => {
    Promise.all([api.listarPerfis(), api.progressoDoCurso(aulas.map((a) => a.id))])
      .then(([p, m]) => {
        setPerfis(p)
        setMarcas(m)
      })
      .catch(() => setMarcas([]))
  }, [aulas])

  const pessoas = useMemo(
    () =>
      perfis
        .filter((p) => (publico === 'clientes' ? p.papel === 'cliente' : p.papel !== 'cliente'))
        .map((p) => ({ ...p, feitas: (marcas ?? []).filter((m) => m.user_id === p.id).length }))
        .sort((a, b) => b.feitas - a.feitas),
    [perfis, marcas, publico],
  )

  if (!marcas) return <Carregando />
  return (
    <ul className="flex flex-col gap-3">
      {pessoas.map((p) => (
        <li key={p.id}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{p.nome}</span>
            <span className="font-mono text-xs text-apagado tabular-nums">
              {p.feitas}/{aulas.length}
            </span>
          </div>
          <Trilha pct={aulas.length ? (p.feitas / aulas.length) * 100 : 0} />
        </li>
      ))}
      {pessoas.length === 0 && <li className="text-sm text-apagado">Ninguém com acesso a este curso ainda.</li>}
    </ul>
  )
}
