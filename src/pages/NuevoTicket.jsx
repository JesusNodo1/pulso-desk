import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Save } from 'lucide-react'

export default function NuevoTicket() {
  const navigate    = useNavigate()
  const [sp]        = useSearchParams()
  const { perfil }  = useAuth()
  const clienteInicial = sp.get('cliente') ?? ''

  const [clientes, setClientes]     = useState([])
  const [contactos, setContactos]   = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [form, setForm] = useState({
    titulo:        '',
    descripcion:   '',
    cliente_id:    clienteInicial,
    contacto_id:   '',
    tipo:          'consulta',
    estado:        'abierto',
    prioridad:     'media',
    asignado_a:    '',
  })

  useEffect(() => {
    supabase.from('pd_clientes').select('id, razon_social').order('razon_social').then(({ data }) => setClientes(data ?? []))
    supabase.from('pd_usuarios_perfil').select('id, nombre, rol').eq('activo', true).order('nombre').then(({ data }) => setUsuarios(data ?? []))
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
      ...form,
      cliente_id:  form.cliente_id  || null,
      contacto_id: form.contacto_id || null,
      asignado_a:  form.asignado_a  || null,
      creado_por:  perfil.id,
    }
    const { data, error: err } = await supabase.from('pd_tickets').insert(payload).select().single()
    if (err) { setError(err.message); setGuardando(false); return }
    navigate(`/tickets/${data.id}`, { replace: true })
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-3xl mx-auto">
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
            <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={inputCls} />
          </Campo>
          <Campo label="Descripción">
            <textarea rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo">
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                <option value="consulta">Consulta</option>
                <option value="incidente">Incidente</option>
                <option value="soporte_tecnico">Soporte téc.</option>
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
