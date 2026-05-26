import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ArrowLeft, Save } from 'lucide-react'

export default function NuevaSolicitud() {
  const navigate   = useNavigate()
  const { perfil } = useAuth()
  const [clientes, setClientes] = useState([])
  const [sistemas, setSistemas] = useState([])
  const [form, setForm] = useState({
    titulo:      '',
    descripcion: '',
    cliente_id:  '',
    sistema_id:  '',
    impacto:     'medio',
    frecuencia:  1,
  })
  const [error, setError]         = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('pd_clientes').select('id, razon_social').order('razon_social').then(({ data }) => setClientes(data ?? []))
    supabase.from('pd_sistemas').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setSistemas(data ?? []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.titulo.trim()) { setError('Título requerido'); return }
    setGuardando(true)
    const payload = {
      ...form,
      cliente_id: form.cliente_id || null,
      sistema_id: form.sistema_id || null,
      frecuencia: Number(form.frecuencia) || 1,
      creado_por: perfil.id,
    }
    const { data, error: err } = await supabase.from('pd_solicitudes').insert(payload).select().single()
    if (err) { setError(err.message); setGuardando(false); return }
    navigate(`/solicitudes/${data.id}`, { replace: true })
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva solicitud</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <Campo label="Título *">
            <input required value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={inputCls} placeholder="Ej: Agregar reporte de ventas por vendedor" />
          </Campo>
          <Campo label="Descripción">
            <textarea rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Qué pide, para qué lo quiere..." />
          </Campo>
          <Campo label="Sistema que cambiaría">
            <select value={form.sistema_id} onChange={e => setForm(f => ({ ...f, sistema_id: e.target.value }))} className={inputCls}>
              <option value="">— Sin definir —</option>
              {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Cliente que lo pidió">
            <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} className={inputCls}>
              <option value="">— Varios / sin cliente específico —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Impacto estimado">
              <select value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: e.target.value }))} className={inputCls}>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </Campo>
            <Campo label="Frecuencia (cuántos pidieron)">
              <input type="number" min={1} value={form.frecuencia} onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))} className={inputCls} />
            </Campo>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

        <button type="submit" disabled={guardando} className="w-full py-3 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={16} />{guardando ? 'Creando...' : 'Crear solicitud'}
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
