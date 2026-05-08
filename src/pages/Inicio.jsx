import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Ticket, AlertCircle, CheckCircle2, Clock, Activity } from 'lucide-react'

const PRIO_CONFIG = {
  alta:  { bg: 'bg-red-100',    text: 'text-red-700',    label: '🔴 Alta'  },
  media: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🟡 Media' },
  baja:  { bg: 'bg-gray-100',   text: 'text-gray-700',   label: '⚪ Baja'  },
}

const ESTADO_LABEL = {
  abierto:            'Abierto',
  en_proceso:         'En proceso',
  esperando_cliente:  'Esperando cliente',
  cerrado:            'Cerrado',
}

export default function Inicio() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [stats, setStats]     = useState({ abiertos: 0, en_proceso: 0, esperando: 0, cerrados_hoy: 0 })
  const [mios, setMios]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const [{ count: abiertos }, { count: en_proceso }, { count: esperando }, { count: cerrados_hoy }] = await Promise.all([
      supabase.from('pd_tickets').select('*', { count: 'exact', head: true }).eq('estado', 'abierto'),
      supabase.from('pd_tickets').select('*', { count: 'exact', head: true }).eq('estado', 'en_proceso'),
      supabase.from('pd_tickets').select('*', { count: 'exact', head: true }).eq('estado', 'esperando_cliente'),
      supabase.from('pd_tickets').select('*', { count: 'exact', head: true })
        .eq('estado', 'cerrado')
        .gte('cerrado_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    ])
    setStats({
      abiertos:      abiertos     ?? 0,
      en_proceso:    en_proceso   ?? 0,
      esperando:     esperando    ?? 0,
      cerrados_hoy:  cerrados_hoy ?? 0,
    })
    const { data: asignados } = await supabase
      .from('pd_tickets')
      .select('id, numero, titulo, estado, prioridad, pd_clientes(razon_social)')
      .eq('asignado_a', perfil.id)
      .neq('estado', 'cerrado')
      .order('prioridad', { ascending: true })
      .limit(20)
    setMios(asignados ?? [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen">
      <div className="bg-sky-600 px-4 pt-12 lg:pt-6 pb-5 relative overflow-hidden">
        <div className="absolute -right-4 -top-2 opacity-15 pointer-events-none">
          <Activity size={110} color="white" strokeWidth={1.5} />
        </div>
        <div className="relative">
          <p className="text-xs text-white/80">Hola, {perfil.nombre}</p>
          <h1 className="text-2xl font-bold text-white">Pulso Desk</h1>
          <p className="text-xs text-white/80 capitalize mt-0.5">{perfil.rol}</p>
        </div>
      </div>

      <div className="px-4 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatColor icon={AlertCircle}   accent="bg-red-500"     bgLight="bg-red-50"     textLabel="text-red-700"     label="Abiertos"          value={stats.abiertos} />
        <StatColor icon={Clock}         accent="bg-amber-500"   bgLight="bg-amber-50"   textLabel="text-amber-700"   label="En proceso"        value={stats.en_proceso} />
        <StatColor icon={Ticket}        accent="bg-blue-500"    bgLight="bg-blue-50"    textLabel="text-blue-700"    label="Esperando cliente" value={stats.esperando} />
        <StatColor icon={CheckCircle2} accent="bg-emerald-500" bgLight="bg-emerald-50" textLabel="text-emerald-700" label="Cerrados hoy"      value={stats.cerrados_hoy} />
      </div>

      <div className="px-4 pb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mis tickets asignados</h2>
        {loading && <p className="text-sm text-gray-500 py-6 text-center">Cargando...</p>}
        {!loading && mios.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 text-center text-sm text-gray-500">
            No tenés tickets asignados.
          </div>
        )}
        <div className="space-y-2">
          {mios.map(t => {
            const prio = PRIO_CONFIG[t.prioridad] ?? PRIO_CONFIG.media
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-red-500 border-t border-r border-b border-gray-100 dark:border-gray-700 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs text-gray-400">#{t.numero}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${prio.bg} ${prio.text}`}>{prio.label}</span>
                  <span className="text-xs text-gray-500">{ESTADO_LABEL[t.estado]}</span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.titulo}</p>
                {t.pd_clientes?.razon_social && (
                  <p className="text-xs text-gray-500 truncate">{t.pd_clientes.razon_social}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatColor({ icon: Icon, accent, bgLight, textLabel, label, value }) {
  return (
    <div className={`${bgLight} rounded-lg p-3 border-l-4 ${accent.replace('bg-', 'border-')} border-t border-r border-b border-gray-100 dark:border-gray-700`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`${accent} w-6 h-6 rounded-md flex items-center justify-center`}>
          <Icon size={14} color="white" />
        </div>
        <p className={`text-xs font-semibold ${textLabel}`}>{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
