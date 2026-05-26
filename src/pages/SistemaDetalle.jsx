import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Server, PlusCircle } from 'lucide-react'
import { ESTADO_CFG, PRIO_CFG, diasDesde, diasTexto, colorDias } from '../lib/ordenes'

const FILTROS = [
  { value: 'activas',     label: 'Activas'     },
  { value: 'pendiente',   label: '⏳ Pendiente' },
  { value: 'en_progreso', label: '🛠 Progreso' },
  { value: 'terminado',   label: '✅ Terminadas'},
  { value: 'todas',       label: 'Todas'       },
]

export default function SistemaDetalle() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [sistema, setSistema] = useState(null)
  const [ordenes, setOrdenes] = useState([])
  const [filtro, setFiltro]   = useState('activas')
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: s }, { data: ords }] = await Promise.all([
      supabase.from('pd_sistemas').select('*').eq('id', id).single(),
      supabase.from('pd_ordenes').select('id, numero, titulo, funcionalidad, estado, prioridad, created_at, fecha_objetivo').eq('sistema_id', id).order('created_at', { ascending: false }),
    ])
    setSistema(s)
    setOrdenes(ords ?? [])
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!sistema) return <div className="min-h-screen flex items-center justify-center text-gray-500">Sistema no encontrado</div>

  const filtradas = ordenes.filter(o => {
    if (filtro === 'todas')    return true
    if (filtro === 'activas')  return o.estado !== 'terminado'
    return o.estado === filtro
  }).sort((a, b) => {
    const aT = a.estado === 'terminado' ? 1 : 0
    const bT = b.estado === 'terminado' ? 1 : 0
    if (aT !== bT) return aT - bT
    const pa = PRIO_CFG[a.prioridad]?.orden ?? 9
    const pb = PRIO_CFG[b.prioridad]?.orden ?? 9
    if (pa !== pb) return pa - pb
    return new Date(a.created_at) - new Date(b.created_at)
  })

  const activas   = ordenes.filter(o => o.estado !== 'terminado').length
  const terminadas = ordenes.filter(o => o.estado === 'terminado').length

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <div className="w-3 h-8 rounded-sm flex-shrink-0" style={{ backgroundColor: sistema.color }} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{sistema.nombre}</h1>
          {sistema.descripcion && <p className="text-xs text-gray-500 truncate">{sistema.descripcion}</p>}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total"    value={ordenes.length} color="text-gray-900" />
          <Stat label="Activas"  value={activas}        color="text-emerald-600" />
          <Stat label="Listas"   value={terminadas}     color="text-gray-500" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Historial de órdenes</p>
            <button onClick={() => navigate(`/ordenes/nueva?sistema=${id}`)} className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <PlusCircle size={14} />Nueva orden
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-2">
            {FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                  filtro === f.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtradas.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 text-center text-sm text-gray-500">
              <Server size={24} className="mx-auto mb-2 opacity-40" />
              Sin órdenes en este filtro.
            </div>
          ) : (
            <div className="space-y-2">
              {filtradas.map(o => {
                const e = ESTADO_CFG[o.estado] ?? ESTADO_CFG.pendiente
                const p = PRIO_CFG[o.prioridad] ?? PRIO_CFG.media
                const d = diasDesde(o.created_at)
                const colorD = colorDias(d, o.estado)
                return (
                  <div key={o.id} onClick={() => navigate(`/ordenes/${o.id}`)} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 cursor-pointer active:bg-gray-50">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-gray-400">#{o.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md ${e.bg} ${e.text}`}>{e.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md ${p.bg} ${p.text}`}>{p.emoji} {o.prioridad}</span>
                      <span className={`text-xs ml-auto ${colorD}`}>{diasTexto(d)}</span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{o.titulo}</p>
                    {o.funcionalidad && <p className="text-xs text-gray-500 mt-0.5">{o.funcionalidad}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
