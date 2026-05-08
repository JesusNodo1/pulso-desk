import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Trash2, Building2, ClipboardList, Plus } from 'lucide-react'
import { format } from 'date-fns'

const ESTADOS = [
  { value: 'pendiente',    label: '⏳ Pendiente'    },
  { value: 'en_analisis',  label: '🔵 En análisis'  },
  { value: 'aprobado',     label: '✅ Aprobado'     },
  { value: 'rechazado',    label: '❌ Rechazado'    },
]

const IMPACTOS = [
  { value: 'bajo',  label: '⚪ Bajo'  },
  { value: 'medio', label: '🟡 Medio' },
  { value: 'alto',  label: '🔴 Alto'  },
]

export default function SolicitudDetalle() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { perfil } = useAuth()
  const [sol, setSol]         = useState(null)
  const [ordenes, setOrdenes] = useState([])
  const [sistemas, setSistemas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: s }, { data: ords }, { data: sis }] = await Promise.all([
      supabase.from('pd_solicitudes').select('*, pd_clientes(id, razon_social), pd_sistemas(id, nombre, color)').eq('id', id).single(),
      supabase.from('pd_orden_solicitud').select('pd_ordenes(id, numero, titulo, estado)').eq('solicitud_id', id),
      supabase.from('pd_sistemas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setSol(s)
    setOrdenes((ords ?? []).map(x => x.pd_ordenes).filter(Boolean))
    setSistemas(sis ?? [])
    setLoading(false)
  }

  async function cambiar(campo, valor) {
    await supabase.from('pd_solicitudes').update({ [campo]: valor }).eq('id', id)
    cargar()
  }

  async function borrar() {
    if (!confirm('¿Eliminar solicitud?')) return
    await supabase.from('pd_solicitudes').delete().eq('id', id)
    navigate('/solicitudes', { replace: true })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!sol)    return <div className="min-h-screen flex items-center justify-center text-gray-500">No encontrada</div>

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Solicitud #{sol.numero}</p>
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{sol.titulo}</h1>
          </div>
        </div>
        {perfil.rol === 'admin' && (
          <button onClick={borrar} className="p-2 text-red-500"><Trash2 size={16} /></button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Estado">
              <select value={sol.estado} onChange={e => cambiar('estado', e.target.value)} className={inputCls}>
                {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
            <Campo label="Impacto">
              <select value={sol.impacto} onChange={e => cambiar('impacto', e.target.value)} className={inputCls}>
                {IMPACTOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Sistema">
            <select value={sol.sistema_id ?? ''} onChange={e => cambiar('sistema_id', e.target.value || null)} className={inputCls}>
              <option value="">— Sin definir —</option>
              {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Frecuencia (clientes que lo pidieron)">
            <input type="number" min={1} value={sol.frecuencia} onChange={e => cambiar('frecuencia', Number(e.target.value) || 1)} className={inputCls} />
          </Campo>
          {sol.descripcion && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Descripción</p>
              <p className="text-sm text-gray-900 dark:text-gray-200 whitespace-pre-line">{sol.descripcion}</p>
            </div>
          )}
          {sol.pd_clientes && (
            <Link to={`/clientes/${sol.pd_clientes.id}`} className="flex items-center gap-2 text-sm text-emerald-600 font-medium border-t border-gray-100 pt-3">
              <Building2 size={14} />{sol.pd_clientes.razon_social}
            </Link>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ClipboardList size={14} />Órdenes de trabajo</p>
          {ordenes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">Sin órdenes vinculadas.</p>
          ) : (
            <div className="space-y-2">
              {ordenes.map(o => (
                <Link key={o.id} to={`/ordenes/${o.id}`} className="block border border-gray-100 rounded-md p-3 active:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">#{o.numero}</span>
                    <span className="text-xs text-gray-500">{o.estado}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">{o.titulo}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {(perfil.rol === 'admin' || perfil.rol === 'desarrollador') && sol.estado !== 'rechazado' && (
          <button
            onClick={() => navigate(`/ordenes/nueva?solicitud=${sol.id}`)}
            className="w-full py-2.5 rounded-md border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center justify-center gap-2 active:bg-emerald-50"
          >
            <ClipboardList size={15} />Generar orden de trabajo
          </button>
        )}

        <p className="text-xs text-gray-400 text-center">Creada {format(new Date(sol.created_at), 'dd/MM/yy HH:mm')}</p>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}
