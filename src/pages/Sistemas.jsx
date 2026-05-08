import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, Server, ChevronRight } from 'lucide-react'

const COLORES_SUGERIDOS = ['#059669', '#6366f1', '#0891b2', '#7c3aed', '#f59e0b', '#ec4899', '#dc2626', '#64748b']

export default function Sistemas() {
  const navigate   = useNavigate()
  const { perfil } = useAuth()
  const [lista, setLista]     = useState([])
  const [conteos, setConteos] = useState({})
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // id o 'nuevo'
  const [form, setForm] = useState({ nombre: '', descripcion: '', color: '#059669', activo: true })
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: sis }, { data: ords }] = await Promise.all([
      supabase.from('pd_sistemas').select('*').order('nombre'),
      supabase.from('pd_ordenes').select('sistema_id, estado'),
    ])
    setLista(sis ?? [])
    const cuentas = {}
    ;(ords ?? []).forEach(o => {
      if (!o.sistema_id) return
      cuentas[o.sistema_id] = cuentas[o.sistema_id] || { total: 0, activas: 0 }
      cuentas[o.sistema_id].total += 1
      if (o.estado !== 'terminado') cuentas[o.sistema_id].activas += 1
    })
    setConteos(cuentas)
    setLoading(false)
  }

  function abrirNuevo() {
    setForm({ nombre: '', descripcion: '', color: '#059669', activo: true })
    setError('')
    setEditando('nuevo')
  }

  function abrirEditar(s) {
    setForm({ nombre: s.nombre, descripcion: s.descripcion ?? '', color: s.color ?? '#059669', activo: s.activo })
    setError('')
    setEditando(s.id)
  }

  async function guardar() {
    setError('')
    if (!form.nombre.trim()) { setError('Nombre requerido'); return }
    if (editando === 'nuevo') {
      const { error: err } = await supabase.from('pd_sistemas').insert(form)
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await supabase.from('pd_sistemas').update(form).eq('id', editando)
      if (err) { setError(err.message); return }
    }
    setEditando(null)
    cargar()
  }

  async function borrar(s) {
    const c = conteos[s.id]
    const warn = c ? `\n\nTiene ${c.total} orden${c.total !== 1 ? 'es' : ''} asociada${c.total !== 1 ? 's' : ''} (quedarán sin sistema).` : ''
    if (!confirm(`¿Eliminar "${s.nombre}"?${warn}`)) return
    await supabase.from('pd_sistemas').delete().eq('id', s.id)
    cargar()
  }

  const esAdmin = perfil.rol === 'admin'

  return (
    <div className="min-h-screen">
      <div className="bg-violet-600 px-4 pt-12 lg:pt-6 pb-4 relative overflow-hidden">
        <div className="absolute -right-4 -top-2 opacity-15 pointer-events-none">
          <Server size={110} color="white" strokeWidth={1.5} />
        </div>
        <div className="flex items-center justify-between relative gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1 text-white/90"><ArrowLeft size={20} /></button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">Sistemas</h1>
              <p className="text-xs text-white/80">{lista.length} productos que mantenés</p>
            </div>
          </div>
          {esAdmin && !editando && (
            <button onClick={abrirNuevo} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-md border border-white/30">
              <Plus size={15} />Nuevo
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!esAdmin && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-yellow-800">
            Solo administradores pueden crear/editar sistemas. Podés ver la lista y el historial.
          </div>
        )}

        {editando && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 p-4 space-y-3">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              {editando === 'nuevo' ? 'Nuevo sistema' : 'Editar sistema'}
            </p>
            <Campo label="Nombre *">
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: POS, Panel Web, etc." />
            </Campo>
            <Campo label="Descripción">
              <textarea rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Para qué sirve este sistema" />
            </Campo>
            <Campo label="Color">
              <div className="flex gap-2 flex-wrap">
                {COLORES_SUGERIDOS.map(c => (
                  <button
                    key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-md border-2 ${form.color === c ? 'border-gray-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-8 h-8 rounded-md border border-gray-200" />
              </div>
            </Campo>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
              Activo (visible al crear órdenes)
            </label>
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-2">
              <button onClick={guardar} className="flex-1 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2"><Save size={14} />Guardar</button>
              <button onClick={() => setEditando(null)} className="flex-1 py-2 rounded-md border border-gray-200 text-gray-600 text-sm"><X size={14} className="inline mr-1" />Cancelar</button>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-gray-500 py-6">Cargando...</p>}

        {!loading && lista.length === 0 && !editando && (
          <div className="text-center py-14 text-gray-500">
            <Server size={32} className="mx-auto mb-2 opacity-40" />
            <p>Sin sistemas creados</p>
          </div>
        )}

        {lista.map(s => {
          const c = conteos[s.id] ?? { total: 0, activas: 0 }
          return (
            <div key={s.id} className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 ${!s.activo ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                <button onClick={() => navigate(`/sistemas/${s.id}`)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{s.nombre}</p>
                    {!s.activo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">Inactivo</span>}
                  </div>
                  {s.descripcion && <p className="text-xs text-gray-500 truncate">{s.descripcion}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.total} órdenes {c.activas > 0 && <span className="text-emerald-600">· {c.activas} activas</span>}
                  </p>
                </button>
                {esAdmin ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(s)} className="p-2 text-gray-500"><Pencil size={14} /></button>
                    <button onClick={() => borrar(s)} className="p-2 text-red-500"><Trash2 size={14} /></button>
                  </div>
                ) : (
                  <ChevronRight size={16} className="text-gray-300" />
                )}
              </div>
            </div>
          )
        })}
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
