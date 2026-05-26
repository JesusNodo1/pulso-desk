import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AlertCircle, Clock, CheckCircle2, Ticket as TicketIcon, TrendingUp, Building2, Tag, BarChart3 } from 'lucide-react'

const TIPO_LABEL = { soporte_tecnico: 'Soporte', incidente: 'Incidente', consulta: 'Consulta', peticion: 'Petición' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const desde30d = new Date(Date.now() - 30 * 86400000).toISOString()

    const [
      { data: tickets },
      { data: etq },
      { data: relEtq },
    ] = await Promise.all([
      supabase.from('pd_tickets').select('id, titulo, tipo, estado, prioridad, cliente_id, frecuencia, created_at, cerrado_at, pd_clientes(razon_social)'),
      supabase.from('pd_etiquetas').select('id, nombre, color'),
      supabase.from('pd_ticket_etiquetas').select('etiqueta_id, ticket_id'),
    ])

    const tks = tickets ?? []

    // Tiempo promedio de cierre (en horas)
    const cerrados = tks.filter(t => t.cerrado_at && t.created_at)
    const promedioHoras = cerrados.length
      ? cerrados.reduce((s, t) => s + (new Date(t.cerrado_at) - new Date(t.created_at)) / 3600000, 0) / cerrados.length
      : 0

    // Últimos 30 días
    const ult30 = tks.filter(t => t.created_at >= desde30d)

    // Clientes más demandantes (por tickets)
    const porCliente = {}
    tks.forEach(t => {
      if (!t.cliente_id) return
      const nombre = t.pd_clientes?.razon_social ?? 'Cliente'
      porCliente[t.cliente_id] = porCliente[t.cliente_id] || { nombre, total: 0, id: t.cliente_id }
      porCliente[t.cliente_id].total += 1
    })
    const topClientes = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 5)

    // Etiquetas más usadas
    const contEtq = {}
    ;(relEtq ?? []).forEach(r => { contEtq[r.etiqueta_id] = (contEtq[r.etiqueta_id] ?? 0) + 1 })
    const topEtiquetas = (etq ?? [])
      .map(e => ({ ...e, total: contEtq[e.id] ?? 0 }))
      .filter(e => e.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    // Top consultas pendientes con más demanda (frecuencia)
    const topConsultas = tks
      .filter(t => t.tipo === 'consulta' && t.estado !== 'cerrado')
      .sort((a, b) => (b.frecuencia ?? 1) - (a.frecuencia ?? 1))
      .slice(0, 5)

    setData({
      tickets: {
        total:           tks.length,
        abiertos:        tks.filter(t => t.estado === 'abierto').length,
        en_proceso:      tks.filter(t => t.estado === 'en_proceso').length,
        esperando:       tks.filter(t => t.estado === 'esperando_cliente').length,
        cerrados:        tks.filter(t => t.estado === 'cerrado').length,
        ult30:           ult30.length,
        promedioHoras,
      },
      porTipo: {
        soporte:   tks.filter(t => t.tipo === 'soporte_tecnico').length,
        incidente: tks.filter(t => t.tipo === 'incidente').length,
        consulta:  tks.filter(t => t.tipo === 'consulta').length,
        peticion:  tks.filter(t => t.tipo === 'peticion').length,
      },
      topClientes,
      topEtiquetas,
      topConsultas,
    })
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando dashboard...</div>

  const h = data.tickets.promedioHoras
  const promedio = h < 1      ? `${Math.round(h * 60)} min`
                 : h < 48     ? `${h.toFixed(1)} h`
                 :              `${(h / 24).toFixed(1)} días`

  return (
    <div className="min-h-screen">
      <div className="bg-cyan-600 px-4 pt-12 lg:pt-6 pb-5 relative overflow-hidden">
        <div className="absolute -right-4 -top-2 opacity-15 pointer-events-none">
          <BarChart3 size={110} color="white" strokeWidth={1.5} />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-xs text-white/80">Vista global de soporte y desarrollo</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tickets */}
        <section>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tickets</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={AlertCircle}  color="text-red-500"     label="Abiertos"     value={data.tickets.abiertos} />
            <Stat icon={Clock}        color="text-yellow-500"  label="En proceso"   value={data.tickets.en_proceso} />
            <Stat icon={TicketIcon}   color="text-blue-500"    label="Esperando"    value={data.tickets.esperando} />
            <Stat icon={CheckCircle2} color="text-emerald-500" label="Cerrados"     value={data.tickets.cerrados} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Stat icon={TrendingUp}   color="text-emerald-500" label="Últimos 30d"        value={data.tickets.ult30} />
            <Stat icon={Clock}        color="text-gray-500"    label="Tiempo prom. cierre" value={promedio} />
          </div>
        </section>

        {/* Distribución por tipo */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Por tipo</p>
          <div className="space-y-2 text-sm">
            <Row label="Soporte"   value={data.porTipo.soporte}   color="text-emerald-600" />
            <Row label="Incidente" value={data.porTipo.incidente} color="text-red-600" />
            <Row label="Consulta"  value={data.porTipo.consulta}  color="text-amber-600" />
            <Row label="Petición"  value={data.porTipo.peticion}  color="text-violet-600" />
          </div>
        </section>

        {/* Clientes más demandantes */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building2 size={14} />Clientes más demandantes</p>
          {data.topClientes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">Sin datos aún.</p>
          ) : (
            <div className="space-y-2">
              {data.topClientes.map(c => (
                <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="w-full flex items-center justify-between text-left border border-gray-100 rounded-md p-2.5 active:bg-gray-50">
                  <span className="text-sm text-gray-900 dark:text-white truncate">{c.nombre}</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">{c.total} tickets</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Problemas frecuentes */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag size={14} />Problemas más frecuentes</p>
          {data.topEtiquetas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">Asigná etiquetas a los tickets para verlo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.topEtiquetas.map(e => (
                <span key={e.id} className="px-3 py-1.5 rounded-md text-xs font-medium text-white" style={{ backgroundColor: e.color }}>
                  {e.nombre} · {e.total}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Top consultas con más demanda */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Top consultas pendientes</p>
          {data.topConsultas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">Sin consultas activas.</p>
          ) : (
            <div className="space-y-2">
              {data.topConsultas.map(s => (
                <button key={s.id} onClick={() => navigate(`/tickets/${s.id}`)} className="w-full flex items-center justify-between text-left border border-gray-100 rounded-md p-2.5 active:bg-gray-50">
                  <span className="text-sm text-gray-900 dark:text-white truncate">{s.titulo}</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium flex-shrink-0 ml-2">× {s.frecuencia ?? 1}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, color, label, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}
