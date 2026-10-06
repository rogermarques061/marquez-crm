import { LocateFixed, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Botao, classeCampo } from '../../../components/ui'
import { buscarNegocios, minhaLocalizacao, NICHOS, type Nicho, type ResultadoBusca } from '../../../lib/prospeccao'

const RAIOS = [
  { valor: 1000, rotulo: '1 km' },
  { valor: 2000, rotulo: '2 km' },
  { valor: 3000, rotulo: '3 km' },
]

/** Onde procurar + quais nichos. Usada pela rua e pelo X1. */
export default function Busca({ aoEncontrar }: { aoEncontrar: (r: ResultadoBusca) => void }) {
  const [endereco, setEndereco] = useState('')
  const [raio, setRaio] = useState(2000)
  const [nichos, setNichos] = useState<Nicho[]>(NICHOS.map((n) => n.valor))
  const [buscando, setBuscando] = useState<'endereco' | 'gps' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function buscar(modo: 'endereco' | 'gps') {
    setErro(null)
    setBuscando(modo)
    try {
      const onde = modo === 'gps' ? await minhaLocalizacao() : { endereco: endereco.trim() }
      aoEncontrar(await buscarNegocios({ ...onde, raio, nichos }))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setBuscando(null)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (endereco.trim()) void buscar('endereco')
  }

  const alternar = (n: Nicho) => setNichos((atual) => (atual.includes(n) ? atual.filter((x) => x !== n) : [...atual, n]))

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-md border border-borda bg-cartao p-4 lg:p-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-apagado" />
          <input
            id="onde"
            className={`${classeCampo} pl-10`}
            placeholder="Bairro, rua ou cidade — ex.: Centro, Niterói"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Botao type="submit" disabled={!endereco.trim() || !!buscando || !nichos.length} className="flex-1 sm:flex-none">
            {buscando === 'endereco' ? 'Buscando…' : 'Buscar'}
          </Botao>
          <Botao variante="secundario" onClick={() => void buscar('gps')} disabled={!!buscando || !nichos.length} className="flex-1 sm:flex-none">
            <LocateFixed className="size-4" />
            {buscando === 'gps' ? 'Localizando…' : 'Perto de mim'}
          </Botao>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="rotulo text-[10px]">Raio</span>
          <div className="flex rounded-md border border-borda p-0.5">
            {RAIOS.map((r) => (
              <button
                key={r.valor}
                type="button"
                onClick={() => setRaio(r.valor)}
                className={`rounded-[5px] px-2.5 py-1 text-xs ${raio === r.valor ? 'bg-cartao-2 font-semibold text-white' : 'text-apagado'}`}
              >
                {r.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {NICHOS.map((n) => {
          const ativo = nichos.includes(n.valor)
          return (
            <button
              key={n.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => alternar(n.valor)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
                ativo ? 'border-borda-2 bg-cartao-2 text-texto' : 'border-borda text-apagado line-through decoration-apagado/60'
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: ativo ? n.cor : '#363441' }} />
              {n.rotulo}
            </button>
          )
        })}
      </div>

      {erro && <p className="text-sm text-perigo">{erro}</p>}
    </form>
  )
}
