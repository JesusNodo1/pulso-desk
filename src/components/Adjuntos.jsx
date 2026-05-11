import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { detectarAdjunto, validarUrl } from '../lib/adjuntos'
import { Paperclip, Plus, ExternalLink, Trash2, X } from 'lucide-react'

// Componente reutilizable para tickets, solicitudes y órdenes
// Props: tipo ('ticket' | 'solicitud' | 'orden'), id (uuid del registro)
const COLUMNA_POR_TIPO = {
  ticket:    'ticket_id',
  solicitud: 'solicitud_id',
  orden:     'orden_id',
}

export default function Adjuntos({ tipo, id }) {
  const { perfil } = useAuth()
  const [lista, setLista]     = useState([])
  const [loading, setLoading] = useState(true)
  const [agregando, setAgregando] = useState(false)
  const [url, setUrl]             = useState('')
  const [descripcion, setDesc]    = useState('')
  const [error, setError]         = useState('')

  const columna = COLUMNA_POR_TIPO[tipo]

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('pd_adjuntos')
      .select('*')
      .eq(columna, id)
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }

  async function agregar(e) {
    e.preventDefault()
    setError('')
    if (!validarUrl(url)) { setError('URL inválida (debe empezar con http:// o https://)'); return }
    const payload = {
      [columna]:   id,
      url:         url.trim(),
      descripcion: descripcion.trim() || null,
      creado_por:  perfil.id,
    }
    const { error: err } = await supabase.from('pd_adjuntos').insert(payload)
    if (err) { setError(err.message); return }
    setUrl(''); setDesc(''); setAgregando(false)
    cargar()
  }

  async function borrar(adj) {
    if (!confirm('¿Eliminar este adjunto?')) return
    await supabase.from('pd_adjuntos').delete().eq('id', adj.id)
    cargar()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
          <Paperclip size={14} />Adjuntos
          <span className="text-xs text-gray-400 font-normal">({lista.length})</span>
        </p>
        {!agregando && (
          <button onClick={() => setAgregando(true)} className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
            <Plus size={14} />Agregar link
          </button>
        )}
      </div>

      {agregando && (
        <form onSubmit={agregar} className="mb-4 space-y-2 bg-emerald-50 border border-emerald-200 rounded-md p-3">
          <p className="text-xs text-emerald-800 font-semibold">Pegar link de Drive, Fotos, Loom, YouTube, etc.</p>
          <input
            autoFocus type="url" required
            value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="text"
            value={descripcion} onChange={e => setDesc(e.target.value)}
            placeholder="Descripción corta (opcional). Ej: Video del bug en la impresora"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold">Agregar</button>
            <button type="button" onClick={() => { setAgregando(false); setUrl(''); setDesc(''); setError('') }} className="flex-1 py-2 rounded-md border border-gray-200 text-gray-600 text-xs">Cancelar</button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-500 text-center py-3">Cargando...</p>}

      {!loading && lista.length === 0 && !agregando && (
        <p className="text-sm text-gray-500 text-center py-4">
          Sin adjuntos. Pegá un link de Drive/Fotos/Loom para documentar el problema.
        </p>
      )}

      <div className="space-y-2">
        {lista.map(a => {
          const meta = detectarAdjunto(a.url)
          const puedeBorrar = a.creado_por === perfil.id || perfil.rol === 'admin'
          return (
            <div key={a.id} className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-md p-3">
              {meta.thumbnail ? (
                <a href={a.url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  <img src={meta.thumbnail} alt="" className="w-16 h-12 object-cover rounded-md" loading="lazy" />
                </a>
              ) : (
                <div className={`${meta.color} w-10 h-10 rounded-md flex items-center justify-center text-xl flex-shrink-0`}>
                  {meta.icono}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${meta.color}`}>{meta.label}</span>
                </div>
                {a.descripcion && <p className="text-sm text-gray-900 dark:text-gray-100">{a.descripcion}</p>}
                <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline break-all flex items-center gap-1">
                  <ExternalLink size={10} />{a.url}
                </a>
              </div>
              {puedeBorrar && (
                <button onClick={() => borrar(a)} className="p-1 text-red-500 flex-shrink-0"><Trash2 size={13} /></button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
