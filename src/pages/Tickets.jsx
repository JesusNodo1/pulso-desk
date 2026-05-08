import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, puedeCrearTickets } from '../lib/auth'
import { Search, PlusCircle, Ticket as TicketIcon, Ticket } from 'lucide-react'
import { format } from 'date-fns'

const ESTADO_FILTROS = [
  { value: 'abiertos',          label: 'Abiertos'           },
  { value: 'abierto',           label: '🔴 Abierto'         },
  { value: 'en_proceso',        label: '🟡 En proceso'      },
  { value: 'esperando_cliente', label: '🔵 Esperando'       },
  { value: 'cerrado',           label: '⚪ Cerrado'         },
  { value: 'todos',             label: 'Todos'              },
]

const ESTADO_CFG = {
  abierto:           { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Abierto' },
  en_proceso:        { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En proceso' },
  esperando_cliente: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Esperando' },
  cerrado:           { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Cerrado' },
}

const PRIO_CFG = {
  alta:  { bg: 'bg-red-50',    text: 'text-red-600',    emoji: '🔴' },
  media: { bg: 'bg-yellow-50', text: 'text-yellow-600', emoji: '🟡' },
  baja:  { bg: 'bg-gray-50',   text: 'text-gray-600',   emoji: '⚪' },
}

export default function Tickets() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [tickets, setTickets]   = useState([])
  const [filtro, setFiltro]     = useState('abiertos')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase
      .from('pd_tickets')
      .select('id, numero, titulo, tipo, estado, prioridad, created_at, pd_clientes(razon_social)')
      .order('created_at', { ascending: false })
    setTickets(data ?? [])
    setLoading(false)
  }

  const q = busqueda.toLowerCase()
  const filtrados = tickets
    .filter(t => {
      if (filtro === 'todos')    return true
      if (filtro === 'abiertos') return t.estado !== 'cerrado'
      return t.estado === filtro
    })
    .filter(t => {
      if (!busqueda) return true
      if (t.titulo.toLowerCase().includes(q)) return true
      if (String(t.numero).includes(busqueda)) return true
      if (t.pd_clientes?.razon_social?.toLowerCase().includes(q)) return true
      return false
    })

  return (
    <div className="min-h-screen">
      <div className="bg-red-600 px-4 pt-12 lg:pt-6 pb-4 relative overflow-hidden">
        <div className="absolute -right-4 -top-2 opacity-15 pointer-events-none">
          <Ticket size={110} color="white" strokeWidth={1.5} />
        </div>
        <div className="flex items-center justify-between relative">
          <div>
            <h1 className="text-2xl font-bold text-white">Tickets</h1>
            <p className="text-xs text-white/80">{tickets.length} total · soporte al cliente</p>
          </div>
          {puedeCrearTickets(perfil.rol) && (
            <button onClick={() => navigate('/tickets/nuevo')} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-md border border-white/30">
              <PlusCircle size={15} />Nuevo
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 px-4 pt-3 pb-3 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="relative mb-3">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            placeholder="Buscar por título, #, cliente..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ESTADO_FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                filtro === f.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
        {loading && <div className="col-span-full text-center py-10 text-gray-500">Cargando...</div>}
        {!loading && filtrados.length === 0 && (
          <div className="col-span-full text-center py-14 text-gray-500">
            <TicketIcon size={32} className="mx-auto mb-2 opacity-40" />
            <p>Sin tickets</p>
          </div>
        )}
        {filtrados.map(t => {
          const e = ESTADO_CFG[t.estado]
          const p = PRIO_CFG[t.prioridad]
          return (
            <div
              key={t.id}
              onClick={() => navigate(`/tickets/${t.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 cursor-pointer active:bg-gray-50"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs text-gray-400">#{t.numero}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${e.bg} ${e.text}`}>{e.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${p.bg} ${p.text}`}>{p.emoji} {t.prioridad}</span>
                <span className="text-xs text-gray-500 ml-auto">{format(new Date(t.created_at), 'dd/MM/yy')}</span>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.titulo}</p>
              {t.pd_clientes?.razon_social && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{t.pd_clientes.razon_social}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
