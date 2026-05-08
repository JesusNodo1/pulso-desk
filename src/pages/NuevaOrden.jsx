import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Save, Lightbulb, Ticket } from 'lucide-react'

const IMPACTO_A_PRIORIDAD = { alto: 'alta', medio: 'media', bajo: 'baja' }

function fechaEnUnaSemana() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export default function NuevaOrden() {
  const navigate    = useNavigate()
  const [sp]        = useSearchParams()
  const { perfil }  = useAuth()
  const ticketId    = sp.get('ticket')
  const solicitudId = sp.get('solicitud')
  const sistemaPre  = sp.get('sistema')

  const [usuarios, setUsuarios] = useState([])
  const [sistemas, setSistemas] = useState([])
  const [origen, setOrigen]     = useState(null) // { tipo, numero, titulo }
  const [cargandoOrigen, setCargandoOrigen] = useState(!!(ticketId || solicitudId))
  const [form, setForm] = useState({
    titulo:              '',
    funcionalidad:       '',
    sistema_id:          sistemaPre ?? '',
    descripcion_tecnica: '',
    complejidad:         'media',
    prioridad:           'media',
    estado:              'pendiente',
    asignado_a:          '',
    fecha_objetivo:      fechaEnUnaSemana(),
  })
  const [error, setError]         = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('pd_usuarios_perfil').select('id, nombre, rol').eq('activo', true).order('nombre').then(({ data }) => setUsuarios(data ?? []))
    supabase.from('pd_sistemas').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setSistemas(data ?? []))
  }, [])

  // Hereda datos del origen (ticket o solicitud) si viene del query param
  useEffect(() => {
    async function heredar() {
      if (solicitudId) {
        const { data } = await supabase
          .from('pd_solicitudes')
          .select('numero, titulo, descripcion, sistema_id, impacto')
          .eq('id', solicitudId)
          .maybeSingle()
        if (data) {
          setOrigen({ tipo: 'solicitud', numero: data.numero, titulo: data.titulo })
          setForm(f => ({
            ...f,
            titulo:              data.titulo ?? f.titulo,
            funcionalidad:       data.titulo ?? f.funcionalidad,
            descripcion_tecnica: data.descripcion ?? f.descripcion_tecnica,
            sistema_id:          data.sistema_id ?? f.sistema_id,
            prioridad:           IMPACTO_A_PRIORIDAD[data.impacto] ?? f.prioridad,
          }))
        }
      } else if (ticketId) {
        const { data } = await supabase
          .from('pd_tickets')
          .select('numero, titulo, descripcion, prioridad')
          .eq('id', ticketId)
          .maybeSingle()
        if (data) {
          setOrigen({ tipo: 'ticket', numero: data.numero, titulo: data.titulo })
          setForm(f => ({
            ...f,
            titulo:              data.titulo ?? f.titulo,
            funcionalidad:       data.titulo ?? f.funcionalidad,
            descripcion_tecnica: data.descripcion ?? f.descripcion_tecnica,
            prioridad:           data.prioridad ?? f.prioridad,
          }))
        }
      }
      setCargandoOrigen(false)
    }
    heredar()
  }, [ticketId, solicitudId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.titulo.trim()) { setError('Título requerido'); return }
    setGuardando(true)
    const payload = {
      ...form,
      sistema_id:     form.sistema_id     || null,
      asignado_a:     form.asignado_a     || null,
      fecha_objetivo: form.fecha_objetivo || null,
      creado_por:     perfil.id,
    }
    const { data: orden, error: err } = await supabase.from('pd_ordenes').insert(payload).select().single()
    if (err) { setError(err.message); setGuardando(false); return }

    if (ticketId) {
      await supabase.from('pd_orden_ticket').insert({ orden_id: orden.id, ticket_id: ticketId })
    }
    if (solicitudId) {
      await supabase.from('pd_orden_solicitud').insert({ orden_id: orden.id, solicitud_id: solicitudId })
    }
    navigate(`/ordenes/${orden.id}`, { replace: true })
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva orden</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {cargandoOrigen && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-600">
            Cargando datos del origen...
          </div>
        )}

        {origen && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-800 flex items-start gap-2">
            {origen.tipo === 'solicitud' ? <Lightbulb size={14} className="mt-0.5 flex-shrink-0" /> : <Ticket size={14} className="mt-0.5 flex-shrink-0" />}
            <div>
              <p className="font-semibold">Heredado de {origen.tipo} #{origen.numero}</p>
              <p>{origen.titulo}</p>
              <p className="mt-1 text-emerald-700">Podés ajustar los campos antes de crear la orden. Los datos fueron pre-cargados desde la {origen.tipo}.</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <Campo label="Título *">
            <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={inputCls} placeholder="Ej: Reporte ventas por vendedor" />
          </Campo>

          <Campo label="Funcionalidad (qué cambia / qué se agrega)">
            <input value={form.funcionalidad} onChange={e => setForm(f => ({ ...f, funcionalidad: e.target.value }))} className={inputCls} placeholder="Ej: Filtro por fecha + totales por vendedor" />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sistema a cambiar">
              <select value={form.sistema_id} onChange={e => setForm(f => ({ ...f, sistema_id: e.target.value }))} className={inputCls}>
                <option value="">— Elegir —</option>
                {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha objetivo (opcional · default 1 semana)">
              <div className="flex gap-2">
                <input type="date" value={form.fecha_objetivo} onChange={e => setForm(f => ({ ...f, fecha_objetivo: e.target.value }))} className={inputCls + ' flex-1'} />
                {form.fecha_objetivo && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, fecha_objetivo: '' }))} className="px-2 py-2 text-xs text-gray-500 border border-gray-200 rounded-md">
                    Sin fecha
                  </button>
                )}
              </div>
            </Campo>
          </div>

          {sistemas.length === 0 && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
              Todavía no hay sistemas creados. Pedile al admin que los cargue en <strong>Sistemas</strong>.
            </p>
          )}

          <Campo label="Descripción técnica">
            <textarea rows={4} value={form.descripcion_tecnica} onChange={e => setForm(f => ({ ...f, descripcion_tecnica: e.target.value }))} className={inputCls} placeholder="Notas técnicas: endpoints, tablas, consideraciones..." />
          </Campo>

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Complejidad">
              <select value={form.complejidad} onChange={e => setForm(f => ({ ...f, complejidad: e.target.value }))} className={inputCls}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </Campo>
            <Campo label="Prioridad">
              <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))} className={inputCls}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </Campo>
            <Campo label="Estado">
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inputCls}>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
              </select>
            </Campo>
          </div>

          <Campo label="Asignar a">
            <select value={form.asignado_a} onChange={e => setForm(f => ({ ...f, asignado_a: e.target.value }))} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </Campo>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

        <button type="submit" disabled={guardando || cargandoOrigen} className="w-full py-3 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={16} />{guardando ? 'Creando...' : 'Crear orden'}
        </button>
      </form>
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
