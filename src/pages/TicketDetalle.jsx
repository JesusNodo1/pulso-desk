import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, puedeBorrarTicket } from '../lib/auth'
import { ArrowLeft, Send, Tag, Trash2, MessageCircle, User, Clock, Building2, ClipboardList, CheckCircle2, RotateCcw } from 'lucide-react'
import { linkWhatsApp, formatearTelefonoPY } from '../lib/phone'
import Adjuntos from '../components/Adjuntos'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_OPCIONES = [
  { value: 'abierto',            label: '🔴 Abierto' },
  { value: 'en_proceso',         label: '🟡 En proceso' },
  { value: 'esperando_cliente',  label: '🔵 Esperando cliente' },
  { value: 'cerrado',            label: '⚪ Cerrado' },
]

const PRIO_OPCIONES = [
  { value: 'baja',  label: '⚪ Baja'  },
  { value: 'media', label: '🟡 Media' },
  { value: 'alta',  label: '🔴 Alta'  },
]

export default function TicketDetalle() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { perfil } = useAuth()
  const [ticket, setTicket]       = useState(null)
  const [mensajes, setMensajes]   = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  const [todasEtq, setTodasEtq]   = useState([])
  const [contacto, setContacto]   = useState(null)
  const [usuarios, setUsuarios]   = useState([])
  const [mensajesAutor, setMensajesAutor] = useState({})
  const [loading, setLoading]     = useState(true)
  const [mensaje, setMensaje]     = useState('')
  const [origen, setOrigen]       = useState('interno')
  const [enviando, setEnviando]   = useState(false)
  const [error, setError]         = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: tk }, { data: ms }, { data: ets }, { data: todas }, { data: us }] = await Promise.all([
      supabase.from('pd_tickets').select('*, pd_clientes(id, razon_social, rubro)').eq('id', id).single(),
      supabase.from('pd_ticket_mensajes').select('*').eq('ticket_id', id).order('created_at'),
      supabase.from('pd_ticket_etiquetas').select('etiqueta_id, pd_etiquetas(id, nombre, color)').eq('ticket_id', id),
      supabase.from('pd_etiquetas').select('*').order('nombre'),
      supabase.from('pd_usuarios_perfil').select('id, nombre, rol').eq('activo', true),
    ])
    setTicket(tk)
    setMensajes(ms ?? [])
    setEtiquetas((ets ?? []).map(e => e.pd_etiquetas))
    setTodasEtq(todas ?? [])
    setUsuarios(us ?? [])
    setMensajesAutor(Object.fromEntries((us ?? []).map(u => [u.id, u.nombre])))

    if (tk?.contacto_id) {
      const { data: ct } = await supabase.from('pd_contactos').select('*').eq('id', tk.contacto_id).single()
      setContacto(ct)
    } else {
      setContacto(null)
    }
    setLoading(false)
  }

  async function cambiar(campo, valor) {
    setError('')
    setGuardando(true)
    const patch = { [campo]: valor }
    if (campo === 'estado' && valor === 'cerrado') patch.cerrado_at = new Date().toISOString()
    if (campo === 'estado' && valor !== 'cerrado' && ticket.estado === 'cerrado') patch.cerrado_at = null
    const { error: err } = await supabase.from('pd_tickets').update(patch).eq('id', ticket.id)
    setGuardando(false)
    if (err) { setError(`No se pudo actualizar: ${err.message}`); return }
    cargar()
  }

  async function cerrarTicket() {
    await cambiar('estado', 'cerrado')
  }
  async function reabrirTicket() {
    await cambiar('estado', 'abierto')
  }

  async function enviarMensaje(e) {
    e.preventDefault()
    if (!mensaje.trim()) return
    setEnviando(true)
    await supabase.from('pd_ticket_mensajes').insert({
      ticket_id: ticket.id,
      autor_id:  perfil.id,
      origen,
      mensaje:   mensaje.trim(),
    })
    setMensaje('')
    setEnviando(false)
    cargar()
  }

  async function toggleEtiqueta(etq) {
    const existe = etiquetas.some(e => e.id === etq.id)
    if (existe) {
      await supabase.from('pd_ticket_etiquetas').delete().eq('ticket_id', ticket.id).eq('etiqueta_id', etq.id)
    } else {
      await supabase.from('pd_ticket_etiquetas').insert({ ticket_id: ticket.id, etiqueta_id: etq.id })
    }
    cargar()
  }

  async function borrar() {
    if (!confirm('¿Eliminar ticket completo? No se puede deshacer.')) return
    await supabase.from('pd_tickets').delete().eq('id', ticket.id)
    navigate('/tickets', { replace: true })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!ticket)  return <div className="min-h-screen flex items-center justify-center text-gray-500">Ticket no encontrado</div>

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">#{ticket.numero}</p>
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{ticket.titulo}</h1>
          </div>
        </div>
        {puedeBorrarTicket(perfil.rol) && (
          <button onClick={borrar} className="p-2 text-red-500"><Trash2 size={16} /></button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {ticket.estado === 'cerrado' ? (
          <button
            onClick={reabrirTicket}
            disabled={guardando}
            className="w-full py-3 rounded-md bg-gray-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw size={15} />{guardando ? 'Reabriendo...' : 'Reabrir ticket'}
          </button>
        ) : (
          <button
            onClick={cerrarTicket}
            disabled={guardando}
            className="w-full py-3 rounded-md bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 size={15} />{guardando ? 'Cerrando...' : 'Cerrar ticket'}
          </button>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Estado">
              <select value={ticket.estado} onChange={e => cambiar('estado', e.target.value)} className={inputCls} disabled={guardando}>
                {ESTADO_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
            <Campo label="Prioridad">
              <select value={ticket.prioridad} onChange={e => cambiar('prioridad', e.target.value)} className={inputCls} disabled={guardando}>
                {PRIO_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Asignado a">
            <select value={ticket.asignado_a ?? ''} onChange={e => cambiar('asignado_a', e.target.value || null)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </Campo>
          {ticket.descripcion && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Descripción</p>
              <p className="text-sm text-gray-900 dark:text-gray-200 whitespace-pre-line">{ticket.descripcion}</p>
            </div>
          )}
          {ticket.pd_clientes && (
            <Link to={`/clientes/${ticket.pd_clientes.id}`} className="flex items-center gap-2 text-sm text-emerald-600 font-medium border-t border-gray-100 pt-3">
              <Building2 size={14} />{ticket.pd_clientes.razon_social}
            </Link>
          )}
          {contacto && (
            <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
              <User size={14} className="text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">{contacto.nombre}</p>
                <p className="text-xs text-gray-500">{formatearTelefonoPY(contacto.telefono)}</p>
              </div>
              <a href={linkWhatsApp(contacto.telefono)} target="_blank" rel="noreferrer" className="p-2 bg-green-500 rounded-md text-white"><MessageCircle size={14} /></a>
            </div>
          )}
        </div>

        <Adjuntos tipo="ticket" id={ticket.id} />

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2"><Tag size={14} />Etiquetas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {todasEtq.map(e => {
              const activa = etiquetas.some(et => et.id === e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggleEtiqueta(e)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-opacity ${activa ? 'text-white' : 'bg-gray-100 text-gray-600 opacity-60'}`}
                  style={activa ? { backgroundColor: e.color } : {}}
                >
                  {e.nombre}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock size={14} />Historial</p>
          <div className="space-y-3 mb-4">
            {mensajes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Sin mensajes aún.</p>
            )}
            {mensajes.map(m => (
              <div key={m.id} className={`rounded-md p-3 border ${colorOrigen(m.origen)}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold">{etiquetaOrigen(m.origen)} · {mensajesAutor[m.autor_id] ?? 'Sistema'}</p>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}</p>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{m.mensaje}</p>
              </div>
            ))}
          </div>

          <form onSubmit={enviarMensaje} className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex gap-2">
              {['interno', 'cliente', 'nota'].map(op => (
                <button
                  key={op} type="button" onClick={() => setOrigen(op)}
                  className={`px-3 py-1 rounded-md text-xs font-medium ${origen === op ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {etiquetaOrigen(op)}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Escribir mensaje o nota..."
              className={inputCls}
            />
            <button type="submit" disabled={enviando || !mensaje.trim()} className="w-full py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={14} />{enviando ? 'Enviando...' : 'Agregar al historial'}
            </button>
          </form>
        </div>

        {(perfil.rol === 'admin' || perfil.rol === 'desarrollador') && (
          <button
            onClick={() => navigate(`/ordenes/nueva?ticket=${ticket.id}`)}
            className="w-full py-2.5 rounded-md border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center justify-center gap-2 active:bg-emerald-50"
          >
            <ClipboardList size={15} />Generar orden de trabajo
          </button>
        )}

        <p className="text-xs text-gray-400 text-center">
          Creado {format(new Date(ticket.created_at), 'dd/MM/yy HH:mm')}
          {ticket.cerrado_at && ` · Cerrado ${format(new Date(ticket.cerrado_at), 'dd/MM/yy HH:mm')}`}
        </p>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

function etiquetaOrigen(o) {
  return o === 'cliente' ? '💬 Cliente' : o === 'nota' ? '📝 Nota' : '🛠 Interno'
}
function colorOrigen(o) {
  return o === 'cliente' ? 'bg-blue-50 border-blue-100'
       : o === 'nota'    ? 'bg-yellow-50 border-yellow-100'
       :                   'bg-gray-50 border-gray-100'
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}
