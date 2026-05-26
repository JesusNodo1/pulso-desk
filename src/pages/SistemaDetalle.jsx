import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Server, PlusCircle } from 'lucide-react'
import { format } from 'date-fns'

const ESTADO_CFG = {
  abierto:           { bg: 'bg-red-100',    text: 'text-red-700',    label: '🔴 Abierto'    },
  en_proceso:        { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🟡 En proceso' },
  esperando_cliente: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '🔵 Esperando'  },
  cerrado:           { bg: 'bg-gray-100',   text: 'text-gray-500',   label: '⚪ Cerrado'    },
}

const PRIO_CFG = {
  alta:  { bg: 'bg-red-50',    text: 'text-red-600',    emoji: '🔴' },
  media: { bg: 'bg-yellow-50', text: 'text-yellow-600', emoji: '🟡' },
  baja:  { bg: 'bg-gray-50',   text: 'text-gray-600',   emoji: '⚪' },
}

const TIPO_LABEL = { soporte_tecnico: 'Soporte', incidente: 'Incidente', consulta: 'Consulta', peticion: 'Petición' }

const FILTROS = [
  { value: 'activos',           label: 'Activos'     },
  { value: 'abierto',           label: '🔴 Abierto'  },
  { value: 'en_proceso',        label: '🟡 Proceso'  },
  { value: 'esperando_cliente', label: '🔵 Esperando'},
  { value: 'cerrado',           label: '⚪ Cerrado'  },
  { value: 'todos',             label: 'Todos'       },
]

export default function SistemaDetalle() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [sistema, setSistema] = useState(null)
  const [tickets, setTickets] = useState([])
  const [filtro, setFiltro]   = useState('activos')
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: s }, { data: tks }] = await Promise.all([
      supabase.from('pd_sistemas').select('*').eq('id', id).single(),
      supabase
        .from('pd_tickets')
        .select('id, numero, titulo, descripcion, tipo, estado, prioridad, frecuencia, created_at')
        .eq('sistema_id', id)
        .order('created_at', { ascending: false }),
    ])
    setSistema(s)
    setTickets(tks ?? [])
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!sistema) return <div className="min-h-screen flex items-center justify-center text-gray-500">Sistema no encontrado</div>

  const filtrados = tickets.filter(t => {
    if (filtro === 'todos')   return true
    if (filtro === 'activos') return t.estado !== 'cerrado'
    return t.estado === filtro
  })

  const activos  = tickets.filter(t => t.estado !== 'cerrado').length
  const cerrados = tickets.filter(t => t.estado === 'cerrado').length

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
          <Stat label="Total"    value={tickets.length} color="text-gray-900" />
          <Stat label="Activos"  value={activos}        color="text-emerald-600" />
          <Stat label="Cerrados" value={cerrados}       color="text-blue-600" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tickets del sistema</p>
            <button onClick={() => navigate('/tickets/nuevo')} className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <PlusCircle size={14} />Nuevo
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

          {filtrados.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 text-center text-sm text-gray-500">
              <Server size={24} className="mx-auto mb-2 opacity-40" />
              Sin tickets en este filtro.
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(t => {
                const e = ESTADO_CFG[t.estado] ?? ESTADO_CFG.abierto
                const p = PRIO_CFG[t.prioridad] ?? PRIO_CFG.media
                return (
                  <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 cursor-pointer active:bg-gray-50">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-gray-400">#{t.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md ${e.bg} ${e.text}`}>{e.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-md ${p.bg} ${p.text}`}>{p.emoji} {t.prioridad}</span>
                      {t.tipo && (
                        <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          {TIPO_LABEL[t.tipo] ?? t.tipo}
                        </span>
                      )}
                      {t.frecuencia > 1 && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">× {t.frecuencia}</span>}
                      <span className="text-xs text-gray-500 ml-auto">{format(new Date(t.created_at), 'dd/MM/yy')}</span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{t.titulo}</p>
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
