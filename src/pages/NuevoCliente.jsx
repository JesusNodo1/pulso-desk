import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'

export default function NuevoCliente() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    razon_social: '',
    rubro:        '',
    estado:       'activo',
    ruc:          '',
    direccion:    '',
    notas:        '',
  })
  const [contactos, setContactos] = useState([
    { nombre: '', telefono: '', rol: '', principal: true },
  ])
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  function actualizarContacto(idx, campo, valor) {
    setContactos(cs => cs.map((c, i) => i === idx ? { ...c, [campo]: valor } : c))
  }
  function agregarContacto() {
    setContactos(cs => [...cs, { nombre: '', telefono: '', rol: '', principal: false }])
  }
  function quitarContacto(idx) {
    setContactos(cs => cs.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.razon_social.trim()) { setError('Razón social requerida'); return }
    setGuardando(true)
    const { data: cli, error: err1 } = await supabase.from('pd_clientes').insert(form).select().single()
    if (err1) { setError(err1.message); setGuardando(false); return }

    const contactosValidos = contactos
      .filter(c => c.nombre.trim() && c.telefono.trim())
      .map(c => ({ ...c, cliente_id: cli.id }))

    if (contactosValidos.length > 0) {
      const { error: err2 } = await supabase.from('pd_contactos').insert(contactosValidos)
      if (err2) { setError(err2.message); setGuardando(false); return }
    }
    navigate(`/clientes/${cli.id}`, { replace: true })
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <Campo label="Razón social *">
            <input required value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className={inputCls} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Rubro">
              <input value={form.rubro} onChange={e => setForm(f => ({ ...f, rubro: e.target.value }))} className={inputCls} />
            </Campo>
            <Campo label="Estado">
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inputCls}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="prospecto">Prospecto</option>
              </select>
            </Campo>
          </div>
          <Campo label="RUC">
            <input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} className={inputCls} />
          </Campo>
          <Campo label="Dirección">
            <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className={inputCls} />
          </Campo>
          <Campo label="Notas">
            <textarea rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className={inputCls} />
          </Campo>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Contactos (WhatsApp)</p>
            <button type="button" onClick={agregarContacto} className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <Plus size={15} />Agregar
            </button>
          </div>
          {contactos.map((c, i) => (
            <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Contacto {i + 1}</p>
                {contactos.length > 1 && (
                  <button type="button" onClick={() => quitarContacto(i)} className="text-red-500"><Trash2 size={14} /></button>
                )}
              </div>
              <input placeholder="Nombre"  value={c.nombre}   onChange={e => actualizarContacto(i, 'nombre', e.target.value)}   className={inputCls} />
              <input placeholder="WhatsApp (ej: 0981234567)" value={c.telefono} onChange={e => actualizarContacto(i, 'telefono', e.target.value)} className={inputCls} />
              <input placeholder="Rol (dueño, cajero, etc)"  value={c.rol}      onChange={e => actualizarContacto(i, 'rol', e.target.value)}      className={inputCls} />
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={c.principal} onChange={e => actualizarContacto(i, 'principal', e.target.checked)} />
                Principal
              </label>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

        <button type="submit" disabled={guardando} className="w-full py-3 rounded-md bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={16} />{guardando ? 'Guardando...' : 'Guardar cliente'}
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
