import 'leaflet/dist/leaflet.css'
import { ExternalLink, MapPin, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { infoNicho, linkPesquisaMaps, NICHOS, TERMOS_MAPS, type FonteBusca, type Nicho } from '../../../lib/prospeccao'

export interface PontoMapa {
  id: string
  lat: number
  lng: number
  nome: string
  nicho: Nicho
  /** Número da parada na rota (mostra um marcador numerado). */
  ordem?: number
  apagado?: boolean
}

function Enquadrar({ pontos, centro }: { pontos: { lat: number; lng: number }[]; centro?: { lat: number; lng: number } }) {
  const mapa = useMap()
  useEffect(() => {
    if (pontos.length >= 2) mapa.fitBounds(L.latLngBounds(pontos.map((p) => [p.lat, p.lng])), { padding: [28, 28], maxZoom: 17 })
    else if (centro) mapa.setView([centro.lat, centro.lng], 16)
  }, [mapa, pontos, centro])
  return null
}

function iconeNumero(n: number, cor: string, apagado?: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;display:grid;place-items:center;border-radius:6px;background:${apagado ? '#26252f' : cor};color:${apagado ? '#6c697a' : '#0c0b10'};font:700 12px/1 'Geist Mono',monospace;border:2px solid #0c0b10;box-shadow:0 2px 6px rgba(0,0,0,.5)">${n}</div>`,
  })
}

/** Mapa escuro com os negócios coloridos por nicho e, se houver, a rota numerada. */
export default function Mapa({
  pontos,
  centro,
  raio,
  regioes,
  rota,
  aoClicar,
  altura = 'h-72 lg:h-[420px]',
}: {
  pontos: PontoMapa[]
  centro?: { lat: number; lng: number }
  raio?: number
  regioes?: { lat: number; lng: number; raio: number; rotulo: string }[]
  rota?: boolean
  aoClicar?: (id: string) => void
  altura?: string
}) {
  const inicio = centro ?? pontos[0] ?? { lat: -23.55, lng: -46.63 }
  return (
    <div className={`relative overflow-hidden rounded-md border border-borda ${altura}`}>
      <MapContainer center={[inicio.lat, inicio.lng]} zoom={15} className="h-full w-full bg-fundo" zoomControl={false} attributionControl>
        {/* Mapa padrão do OpenStreetMap (grátis, sem chave), escurecido por CSS para o tema do app */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          className="mapa-escuro"
          maxZoom={19}
        />
        <Enquadrar pontos={rota || !raio ? pontos : []} centro={centro} />
        {raio && centro && <Circle center={[centro.lat, centro.lng]} radius={raio} pathOptions={{ color: '#bdbac9', weight: 1, fillOpacity: 0.03, dashArray: '4 6' }} />}
        {regioes?.map((r) => (
          <Circle key={r.rotulo} center={[r.lat, r.lng]} radius={r.raio} pathOptions={{ color: '#e9e7f0', weight: 1.5, fillColor: '#e9e7f0', fillOpacity: 0.08 }}>
            <Tooltip permanent direction="center" className="!border-0 !bg-transparent !shadow-none">
              <span style={{ font: "800 13px 'Archivo',sans-serif", color: '#fff', textShadow: '0 1px 3px #000' }}>{r.rotulo}</span>
            </Tooltip>
          </Circle>
        ))}
        {rota && pontos.length > 1 && (
          <Polyline positions={pontos.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#bdbac9', weight: 2, dashArray: '2 6' }} />
        )}
        {pontos.map((p) =>
          p.ordem != null ? (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={iconeNumero(p.ordem, infoNicho(p.nicho).cor, p.apagado)} eventHandlers={{ click: () => aoClicar?.(p.id) }}>
              <Tooltip direction="top" offset={[0, -12]}>{p.nome}</Tooltip>
            </Marker>
          ) : (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{ color: '#0c0b10', weight: 2, fillColor: infoNicho(p.nicho).cor, fillOpacity: p.apagado ? 0.3 : 1 }}
              eventHandlers={{ click: () => aoClicar?.(p.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {p.nome} · {infoNicho(p.nicho).rotulo}
              </Tooltip>
            </CircleMarker>
          ),
        )}
        {centro && !rota && (
          <CircleMarker center={[centro.lat, centro.lng]} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: '#fff', fillOpacity: 1 }} />
        )}
      </MapContainer>
    </div>
  )
}

/** Mostra onde a busca caiu, de onde vieram os negócios e, se o Google falhou, o porquê. */
const NOME_FONTE: Record<FonteBusca, string> = { google: 'Google Maps', tomtom: 'TomTom', osm: 'OpenStreetMap' }

export function LocalEncontrado({ nome, fonte = 'osm', aviso }: { nome: string; fonte?: FonteBusca; aviso?: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      {aviso && (
        <p className="flex items-start gap-2 rounded-md border border-alerta/30 bg-alerta/[0.05] px-3 py-2 text-xs leading-relaxed text-alerta">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          <span>
            {aviso} Esta busca veio do {NOME_FONTE[fonte]}.
          </span>
        </p>
      )}
      <p className="flex items-start gap-2 text-xs text-apagado">
        <MapPin className="mt-px size-3.5 shrink-0" />
        <span>
          {nome !== 'Sua localização' && (
            <>
              Buscou perto de <strong className="font-medium text-suave">{nome}</strong>
              {` · via ${NOME_FONTE[fonte]}. `}
              Não é aí? Na rua, use <strong className="font-medium text-suave">Perto de mim</strong>; ou digite rua + bairro + cidade.
            </>
          )}
          {nome === 'Sua localização' && `Perto de você · via ${NOME_FONTE[fonte]}.`}
        </span>
      </p>
    </div>
  )
}

/** Atalhos para ver a mesma região no Google Maps: acha as lojas que a busca não trouxe. */
export function NoGoogleMaps({ centro }: { centro: { lat: number; lng: number } }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-apagado">Faltou alguém? Veja a mesma região no Google Maps:</p>
      <div className="flex flex-wrap gap-1.5">
        {NICHOS.map((n) => (
          <a
            key={n.valor}
            href={linkPesquisaMaps(TERMOS_MAPS[n.valor], centro)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-borda px-2.5 py-1 text-xs text-suave hover:border-borda-2 hover:text-texto"
          >
            <span className="size-2 rounded-full" style={{ background: n.cor }} />
            {n.rotulo}
            <ExternalLink className="size-3 text-apagado" />
          </a>
        ))}
      </div>
    </div>
  )
}

export function Legenda({ nichos }: { nichos: { nicho: Nicho; n: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {nichos.map(({ nicho, n }) => (
        <li key={nicho} className="flex items-center gap-1.5 text-xs text-suave">
          <span className="size-2.5 rounded-full" style={{ background: infoNicho(nicho).cor }} />
          {infoNicho(nicho).rotulo}
          <span className="font-mono text-apagado tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  )
}
