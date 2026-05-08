import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Server, PlusCircle } from 'lucide-react'
import { format } from 'date-fns'

const ESTADO_CFG = {
  pendiente:   { bg: 'bg-gray-100',    text: 'text-gray-700',    label: '⏳ Pendiente'   },
  en_analisis: { bg: 'bg-blue-100',    text: 'text-blue-700',    label: '🔵 En análisis' },
  aprobado:    { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '✅ Aprobado'    },
  rechazado:   { bg: 'bg-red-100',     text: 'text-red-700',     label: '❌ Rechazado'   },
}

const IMPACTO_CFG = {
  alto:  { bg: 'bg-red-50',    text: 'text-red-600',    emoji: '🔴' },
  medio: { bg: 'bg-yellow-50', text: 'text-yellow-600', emoji: '🟡' },
  bajo:  { bg: 'bg-gray-50',   text: 'text-gray-600',   emoji: '⚪' },
}

const FILTROS = [
  { value: 'activas',     label: 'Activas'     },
  { value: 'pendiente',   label: '⏳ Pendiente' },
  { value: 'en_analisis', label: '🔵 Análisis' },
  { value: 'aprobado',    label: '✅ Aprobado' },
  { value: 'todas',       label: 'Todas'       },
]

export default function SistemaDetalle() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [sistema, setSistema] = useState(null)
  const [solicitudes, setSolicitudes] = useState([])
  const [filtro, setFiltro]   = useState('activas')
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: s }, { data: sols }] = await Promise.all([
      supabase.from('pd_sistemas').select('*').eq('id', id).single(),
      supabase.from('pd_solicitudes').select('id, numero, titulo, descripcion, estado, impacto, frecuencia, created_at').eq('sistema_id', id).order('created_at', { ascending: false }),
    ])
    setSistema(s)
    setSolicitudes(sols ?? [])
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!sistema) return <div className="min-h-screen flex items-center justify-center text-gray-500">Sistema no encontrado</div>

  const filtradas = solicitudes.filter(s => {
    if (filtro === 'todas')   return true
    if (filtro === 'activas') return s.estado === 'pendiente' || s.estado === 'en_analisis'
    return s.estado === filtro
  })

  const activas    = solicitudes.filter(s => s.estado === 'pendiente' || s.estado === 'en_analisis').length
  const aprobadas  = solicitudes.filter(s => s.estado === 'aprobado').length

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <div className="w-3 h-8 rounded-sm flex-shrink-0" style={{ backgroundColor: sistema.color }} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{sistema.nombre}</h1>
          {sistema.descripcion && <p className="text-xs text-gray-500 truncate">{sistema.descripcion}</p>}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total"     value={solicitudes.length} color="text-gray-900" />
          <Stat label="Activas"   value={activas}            color="text-emerald-600" />
          <Stat label="Aprobadas" value={aprobadas}          color="text-blue-600" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Solicitudes del sistema</p>
            <button onClick={() => navigate(`/tickets/nuevo?tipo=solicitud`)} className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <PlusCircle size={14} />Nueva
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
              Sin solicitudes en este filtro.
            </div>
          ) : (
            <div className="space-y-2">
              {filtradas.map(s => {
                const e = ESTADO_CFG[s.estado] ?? ESTADO_CFG.pendiente
                const i = IMPACTO_CFG[s.impacto] ?? IMPACTO_CFG.medio
                return (
                  <div key={s.id} onClick={() => navigate(`/solicitudes/${s.id}`)} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 cursor-pointer active:bg-gray-50">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-gray-400">#{s.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md ${e.bg} ${e.text}`}>{e.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md ${i.bg} ${i.text}`}>{i.emoji} {s.impacto}</span>
                      {s.frecuencia > 1 && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">× {s.frecuencia}</span>}
                      <span className="text-xs text-gray-500 ml-auto">{format(new Date(s.created_at), 'dd/MM/yy')}</span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{s.titulo}</p>
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
