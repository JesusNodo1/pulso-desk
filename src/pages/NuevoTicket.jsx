import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Save, Paperclip, Plus, X, ExternalLink } from 'lucide-react'
import { detectarAdjunto, validarUrl, insertarAdjuntos } from '../lib/adjuntos'

export default function NuevoTicket() {
  const navigate    = useNavigate()
  const [sp]        = useSearchParams()
  const { perfil }  = useAuth()
  const clienteInicial = sp.get('cliente') ?? ''
  // Compatibilidad con links viejos `?tipo=solicitud` → arranca como consulta
  const tipoInicial = sp.get('tipo') === 'solicitud' ? 'consulta' : 'consulta'

  const [clientes, setClientes]     = useState([])
  const [contactos, setContactos]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [sistemas, setSistemas]     = useState([])
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [adjuntos, setAdjuntos]     = useState([])
  const [adjUrl, setAdjUrl]         = useState('')
  const [adjDesc, setAdjDesc]       = useState('')
  const [adjError, setAdjError]     = useState('')
  const [form, setForm] = useState({
    titulo:        '',
    descripcion:   '',
    cliente_id:    clienteInicial,
    contacto_id:   '',
    tipo:          tipoInicial,
    estado:        'abierto',
    prioridad:     'media',
    asignado_a:    '',
    sistema_id:    '',
    frecuencia:    1,
  })

  useEffect(() => {
    supabase.from('pd_clientes').select('id, razon_social').order('razon_social').then(({ data }) => setClientes(data ?? []))
    supabase.from('pd_usuarios_perfil').select('id, nombre, rol').eq('activo', true).order('nombre').then(({ data }) => setUsuarios(data ?? []))
    supabase.from('pd_sistemas').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setSistemas(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.cliente_id) { setContactos([]); return }
    supabase.from('pd_contactos').select('id, nombre, telefono').eq('cliente_id', form.cliente_id).order('principal', { ascending: false }).then(({ data }) => setContactos(data ?? []))
  }, [form.cliente_id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.titulo.trim()) { setError('Título requerido'); return }
    setGuardando(true)

    const payload = {
      titulo:      form.titulo,
      descripcion: form.descripcion,
      cliente_id:  form.cliente_id  || null,
      contacto_id: form.contacto_id || null,
      tipo:        form.tipo,
      estado:      form.estado,
      prioridad:   form.prioridad,
      asignado_a:  form.asignado_a  || null,
      sistema_id:  form.sistema_id  || null,
      frecuencia:  Number(form.frecuencia) || 1,
      creado_por:  perfil.id,
    }
    const { data, error: err } = await supabase.from('pd_tickets').insert(payload).select().single()
    if (err) { setError(err.message); setGuardando(false); return }
    const { error: errAdj } = await insertarAdjuntos('ticket', data.id, adjuntos, perfil.id)
    if (errAdj) { setError(`Ticket creado pero falló al guardar adjuntos: ${errAdj.message}`); setGuardando(false); return }
    navigate(`/tickets/${data.id}`, { replace: true })
  }

  function agregarAdjunto() {
    setAdjError('')
    if (!validarUrl(adjUrl)) { setAdjError('URL inválida (http:// o https://)'); return }
    setAdjuntos(a => [...a, { url: adjUrl.trim(), descripcion: adjDesc.trim() }])
    setAdjUrl(''); setAdjDesc('')
  }

  function quitarAdjunto(i) {
    setAdjuntos(a => a.filter((_, idx) => idx !== i))
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <Campo label="Cliente">
            <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value, contacto_id: '' }))} className={inputCls}>
              <option value="">— Sin cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </Campo>

          {form.cliente_id && (
            <Campo label="Contacto">
              <select value={form.contacto_id} onChange={e => setForm(f => ({ ...f, contacto_id: e.target.value }))} className={inputCls}>
                <option value="">— Ninguno —</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.telefono}</option>)}
              </select>
            </Campo>
          )}

          <Campo label="Título *">
            <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={inputCls}
                   placeholder="Ej: No imprime el ticket tras actualización" />
          </Campo>

          <Campo label="Descripción">
            <textarea rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls}
                      placeholder="Detalle del problema o pedido..." />
          </Campo>

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo">
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                <option value="soporte_tecnico">Soporte</option>
                <option value="incidente">Incidente</option>
                <option value="consulta">Consulta</option>
                <option value="peticion">Petición</option>
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
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En proceso</option>
                <option value="esperando_cliente">Esperando cliente</option>
              </select>
            </Campo>
          </div>

          <Campo label="Asignar a">
            <select value={form.asignado_a} onChange={e => setForm(f => ({ ...f, asignado_a: e.target.value }))} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sistema (opcional)">
              <select value={form.sistema_id} onChange={e => setForm(f => ({ ...f, sistema_id: e.target.value }))} className={inputCls}>
                <option value="">— Ninguno —</option>
                {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Frecuencia (cuántos pidieron)">
              <input type="number" min={1} value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))} className={inputCls} />
            </Campo>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Paperclip size={14} />Adjuntos
            <span className="text-xs text-gray-400 font-normal">({adjuntos.length})</span>
          </p>
          <p className="text-xs text-gray-500 mb-3">Pegá links de Drive, Fotos, Loom, YouTube, etc.</p>

          <div className="space-y-2 mb-3">
            <input
              type="url"
              value={adjUrl}
              onChange={e => setAdjUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className={inputCls}
            />
            <input
              type="text"
              value={adjDesc}
              onChange={e => setAdjDesc(e.target.value)}
              placeholder="Descripción corta (opcional)"
              className={inputCls}
            />
            {adjError && <p className="text-xs text-red-600">{adjError}</p>}
            <button
              type="button"
              onClick={agregarAdjunto}
              disabled={!adjUrl.trim()}
              className="w-full py-2 rounded-md border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Plus size={14} />Sumar a la lista
            </button>
          </div>

          {adjuntos.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {adjuntos.map((a, i) => {
                const meta = detectarAdjunto(a.url)
                return (
                  <div key={i} className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-md p-2.5">
                    <div className={`${meta.color ?? 'bg-gray-100 text-gray-700'} w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0`}>
                      {meta.icono ?? '🔗'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${meta.color ?? 'bg-gray-100 text-gray-700'}`}>{meta.label}</span>
                      {a.descripcion && <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{a.descripcion}</p>}
                      <p className="text-xs text-gray-500 break-all flex items-center gap-1"><ExternalLink size={10} />{a.url}</p>
                    </div>
                    <button type="button" onClick={() => quitarAdjunto(i)} className="p-1 text-red-500 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

        <button type="submit" disabled={guardando} className="w-full py-3 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={16} />{guardando ? 'Creando...' : 'Crear ticket'}
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
