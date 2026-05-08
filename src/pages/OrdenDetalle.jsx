import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Trash2, Ticket, Lightbulb, Plus, X, Send, MessageSquare, Calendar, AlertTriangle } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { diasDesde, diasTexto, colorDias } from '../lib/ordenes'
import Adjuntos from '../components/Adjuntos'

const ESTADOS = [
  { value: 'pendiente',   label: '⏳ Pendiente'   },
  { value: 'en_progreso', label: '🛠 En progreso' },
  { value: 'terminado',   label: '✅ Terminado'   },
]

const PRIO = [
  { value: 'baja',  label: '⚪ Baja'  },
  { value: 'media', label: '🟡 Media' },
  { value: 'alta',  label: '🔴 Alta'  },
]

const COMP = [
  { value: 'baja',  label: 'Baja'  },
  { value: 'media', label: 'Media' },
  { value: 'alta',  label: 'Alta'  },
]

export default function OrdenDetalle() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { perfil } = useAuth()
  const [orden, setOrden]         = useState(null)
  const [tickets, setTickets]     = useState([])
  const [solicitudes, setSolic]   = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [sistemas, setSistemas]   = useState([])
  const [notas, setNotas]         = useState([])
  const [notasAutor, setNotasAutor] = useState({})
  const [nuevaNota, setNuevaNota] = useState('')
  const [enviandoNota, setEnviandoNota] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [vincSheet, setVincSheet] = useState(null)
  const [disponibles, setDisp]    = useState([])
  const [filtroDisp, setFiltroDisp] = useState('')

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: o }, { data: tks }, { data: sls }, { data: us }, { data: ns }, { data: sis }] = await Promise.all([
      supabase.from('pd_ordenes').select('*, pd_sistemas(id, nombre, color)').eq('id', id).single(),
      supabase.from('pd_orden_ticket').select('pd_tickets(id, numero, titulo, estado)').eq('orden_id', id),
      supabase.from('pd_orden_solicitud').select('pd_solicitudes(id, numero, titulo, estado)').eq('orden_id', id),
      supabase.from('pd_usuarios_perfil').select('id, nombre, rol').eq('activo', true),
      supabase.from('pd_orden_notas').select('*').eq('orden_id', id).order('created_at', { ascending: false }),
      supabase.from('pd_sistemas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setOrden(o)
    setSistemas(sis ?? [])
    setTickets((tks ?? []).map(x => x.pd_tickets).filter(Boolean))
    setSolic((sls ?? []).map(x => x.pd_solicitudes).filter(Boolean))
    setUsuarios(us ?? [])
    setNotas(ns ?? [])
    setNotasAutor(Object.fromEntries((us ?? []).map(u => [u.id, u.nombre])))
    setLoading(false)
  }

  async function cambiar(campo, valor) {
    const patch = { [campo]: valor }
    if (campo === 'estado' && valor === 'terminado') patch.terminado_at = new Date().toISOString()
    if (campo === 'estado' && valor !== 'terminado') patch.terminado_at = null
    await supabase.from('pd_ordenes').update(patch).eq('id', id)
    cargar()
  }

  async function agregarNota(e) {
    e.preventDefault()
    if (!nuevaNota.trim()) return
    setEnviandoNota(true)
    await supabase.from('pd_orden_notas').insert({
      orden_id: id,
      autor_id: perfil.id,
      nota:     nuevaNota.trim(),
    })
    setNuevaNota('')
    setEnviandoNota(false)
    cargar()
  }

  async function borrarNota(notaId) {
    if (!confirm('¿Eliminar observación?')) return
    await supabase.from('pd_orden_notas').delete().eq('id', notaId)
    cargar()
  }

  async function abrirVincular(tipo) {
    setVincSheet(tipo)
    setFiltroDisp('')
    const tabla = tipo === 'ticket' ? 'pd_tickets' : 'pd_solicitudes'
    const { data } = await supabase.from(tabla).select('id, numero, titulo, estado').order('created_at', { ascending: false }).limit(50)
    const ya = tipo === 'ticket' ? tickets.map(x => x.id) : solicitudes.map(x => x.id)
    setDisp((data ?? []).filter(x => !ya.includes(x.id)))
  }

  async function vincular(item) {
    const tabla = vincSheet === 'ticket' ? 'pd_orden_ticket' : 'pd_orden_solicitud'
    const col   = vincSheet === 'ticket' ? 'ticket_id'      : 'solicitud_id'
    await supabase.from(tabla).insert({ orden_id: id, [col]: item.id })
    setVincSheet(null)
    cargar()
  }

  async function desvincular(tipo, itemId) {
    const tabla = tipo === 'ticket' ? 'pd_orden_ticket' : 'pd_orden_solicitud'
    const col   = tipo === 'ticket' ? 'ticket_id'      : 'solicitud_id'
    await supabase.from(tabla).delete().eq('orden_id', id).eq(col, itemId)
    cargar()
  }

  async function borrar() {
    if (!confirm('¿Eliminar orden?')) return
    await supabase.from('pd_ordenes').delete().eq('id', id)
    navigate('/ordenes', { replace: true })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!orden)  return <div className="min-h-screen flex items-center justify-center text-gray-500">No encontrada</div>

  const puedeEditar = perfil.rol === 'admin' || perfil.rol === 'desarrollador'
  const dias = diasDesde(orden.created_at)
  const colorD = colorDias(dias, orden.estado)
  const vencida = orden.fecha_objetivo && new Date(orden.fecha_objetivo) < new Date() && orden.estado !== 'terminado'

  const q = filtroDisp.toLowerCase()
  const dispFiltrados = disponibles.filter(x => !filtroDisp || x.titulo.toLowerCase().includes(q) || String(x.numero).includes(filtroDisp))

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Orden #{orden.numero}</p>
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{orden.titulo}</h1>
          </div>
        </div>
        {perfil.rol === 'admin' && (
          <button onClick={borrar} className="p-2 text-red-500"><Trash2 size={16} /></button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Barra de edad + vencimiento */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 ${colorD}`}>
            📅 {diasTexto(dias)}
          </span>
          {orden.fecha_objetivo && (
            <span className={`text-sm px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border flex items-center gap-1 ${vencida ? 'border-red-200 text-red-700' : 'border-gray-100 text-gray-600'}`}>
              <Calendar size={12} />
              {vencida && <AlertTriangle size={12} />}
              Objetivo: {format(new Date(orden.fecha_objetivo), 'dd/MM/yy')}
            </span>
          )}
        </div>

        {/* Datos principales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Estado">
              <select disabled={!puedeEditar} value={orden.estado} onChange={e => cambiar('estado', e.target.value)} className={inputCls}>
                {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
            <Campo label="Prioridad">
              <select disabled={!puedeEditar} value={orden.prioridad} onChange={e => cambiar('prioridad', e.target.value)} className={inputCls}>
                {PRIO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
            <Campo label="Complejidad">
              <select disabled={!puedeEditar} value={orden.complejidad} onChange={e => cambiar('complejidad', e.target.value)} className={inputCls}>
                {COMP.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sistema a cambiar">
              <select disabled={!puedeEditar} value={orden.sistema_id ?? ''} onChange={e => cambiar('sistema_id', e.target.value || null)} className={inputCls}>
                <option value="">—</option>
                {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha objetivo">
              <input type="date" disabled={!puedeEditar} value={orden.fecha_objetivo ?? ''} onChange={e => cambiar('fecha_objetivo', e.target.value || null)} className={inputCls} />
            </Campo>
          </div>

          <Campo label="Asignado a">
            <select disabled={!puedeEditar} value={orden.asignado_a ?? ''} onChange={e => cambiar('asignado_a', e.target.value || null)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </Campo>

          {orden.funcionalidad && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Funcionalidad</p>
              <p className="text-sm text-gray-900 dark:text-gray-200">{orden.funcionalidad}</p>
            </div>
          )}
          {orden.descripcion_tecnica && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Descripción técnica</p>
              <p className="text-sm text-gray-900 dark:text-gray-200 whitespace-pre-line font-mono">{orden.descripcion_tecnica}</p>
            </div>
          )}
        </div>

        {/* Bitácora */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <MessageSquare size={14} />Bitácora de observaciones
            <span className="text-xs text-gray-400 font-normal">({notas.length})</span>
          </p>

          {puedeEditar && (
            <form onSubmit={agregarNota} className="mb-4 space-y-2">
              <textarea
                rows={2}
                value={nuevaNota}
                onChange={e => setNuevaNota(e.target.value)}
                placeholder="Ej: Ya terminé el backend, falta la UI"
                className={inputCls}
              />
              <button type="submit" disabled={enviandoNota || !nuevaNota.trim()} className="w-full py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Send size={14} />{enviandoNota ? 'Guardando...' : 'Agregar observación'}
              </button>
            </form>
          )}

          {notas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">Sin observaciones. Anotá avances a medida que trabajás.</p>
          ) : (
            <div className="space-y-2">
              {notas.map(n => (
                <div key={n.id} className="border border-gray-100 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-900/30">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {notasAutor[n.autor_id] ?? 'Sistema'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}</p>
                      {perfil.rol === 'admin' && (
                        <button onClick={() => borrarNota(n.id)} className="text-red-400"><X size={12} /></button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line">{n.nota}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <Adjuntos tipo="orden" id={orden.id} />

        <Vinculados
          titulo="Tickets relacionados" icon={Ticket} items={tickets} tipo="ticket"
          puedeEditar={puedeEditar} onAgregar={() => abrirVincular('ticket')} onQuitar={itemId => desvincular('ticket', itemId)}
          linkBase="/tickets"
        />
        <Vinculados
          titulo="Solicitudes relacionadas" icon={Lightbulb} items={solicitudes} tipo="solicitud"
          puedeEditar={puedeEditar} onAgregar={() => abrirVincular('solicitud')} onQuitar={itemId => desvincular('solicitud', itemId)}
          linkBase="/solicitudes"
        />

        <p className="text-xs text-gray-400 text-center">
          Creada {format(new Date(orden.created_at), 'dd/MM/yy HH:mm')}
          {orden.terminado_at && ` · Terminada ${format(new Date(orden.terminado_at), 'dd/MM/yy HH:mm')}`}
        </p>
      </div>

      {vincSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-lg lg:max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVincSheet(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-t-lg p-5 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900 dark:text-white">Vincular {vincSheet}</p>
              <button onClick={() => setVincSheet(null)}><X size={18} /></button>
            </div>
            <input
              autoFocus
              placeholder={`Buscar ${vincSheet}...`}
              value={filtroDisp}
              onChange={e => setFiltroDisp(e.target.value)}
              className={`${inputCls} mb-3`}
            />
            <div className="space-y-2">
              {dispFiltrados.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Sin resultados.</p>}
              {dispFiltrados.map(x => (
                <button
                  key={x.id}
                  onClick={() => vincular(x)}
                  className="w-full text-left border border-gray-100 rounded-md p-3 active:bg-gray-50"
                >
                  <p className="text-xs text-gray-400">#{x.numero} · {x.estado}</p>
                  <p className="text-sm text-gray-900 dark:text-white">{x.titulo}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Vinculados({ titulo, icon: Icon, items, tipo, puedeEditar, onAgregar, onQuitar, linkBase }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2"><Icon size={14} />{titulo}</p>
        {puedeEditar && (
          <button onClick={onAgregar} className="flex items-center gap-1 text-emerald-600 text-sm"><Plus size={14} />Vincular</button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-3">Sin vínculos.</p>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="flex items-center gap-2 border border-gray-100 rounded-md p-3">
              <Link to={`${linkBase}/${it.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">#{it.numero}</span>
                  <span className="text-xs text-gray-500">{it.estado}</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white truncate">{it.titulo}</p>
              </Link>
              {puedeEditar && (
                <button onClick={() => onQuitar(it.id)} className="p-1 text-gray-400"><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}
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
