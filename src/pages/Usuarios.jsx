import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AdminAPI } from '../lib/adminApi'
import { ArrowLeft, UserPlus, Users as UsersIcon, Trash2, Key, X, Save, Check, Shield, Code, Headset } from 'lucide-react'

const ROLES = [
  { v: 'admin',         label: 'Administrador', icon: Shield,   bg: 'bg-violet-100',  text: 'text-violet-700'  },
  { v: 'desarrollador', label: 'Desarrollador', icon: Code,     bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
  { v: 'soporte',       label: 'Soporte',       icon: Headset,  bg: 'bg-red-100',     text: 'text-red-700'     },
]

function rolCfg(r) { return ROLES.find(x => x.v === r) ?? ROLES[2] }

export default function Usuarios() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [lista, setLista]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState(null)   // 'nuevo' | { tipo: 'password', user } | null
  const [edicionRol, setEdicionRol] = useState(null) // id del usuario cuyo rol se edita inline

  useEffect(() => {
    if (perfil.rol !== 'admin') { navigate('/mas', { replace: true }); return }
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    try {
      const data = await AdminAPI.listar()
      setLista(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function cambiarRol(id, rol) {
    setError('')
    try {
      await AdminAPI.actualizar({ id, rol })
      setEdicionRol(null)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleActivo(u) {
    setError('')
    try {
      await AdminAPI.actualizar({ id: u.id, activo: !u.activo })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function borrar(u) {
    if (!confirm(`¿Eliminar a ${u.nombre} (${u.email})? No se puede deshacer.`)) return
    setError('')
    try {
      await AdminAPI.borrar(u.id)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="bg-violet-600 px-4 pt-12 lg:pt-6 pb-4 relative overflow-hidden">
        <div className="absolute -right-4 -top-2 opacity-15 pointer-events-none">
          <UsersIcon size={110} color="white" strokeWidth={1.5} />
        </div>
        <div className="flex items-center justify-between relative gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="p-1 text-white/90"><ArrowLeft size={20} /></button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">Usuarios</h1>
              <p className="text-xs text-white/80">{lista.length} miembros del equipo</p>
            </div>
          </div>
          <button onClick={() => setModal('nuevo')} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-md border border-white/30">
            <UserPlus size={15} />Nuevo
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">{error}</div>
        )}

        {loading && <p className="text-center text-gray-500 py-6">Cargando...</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {!loading && lista.map(u => {
          const r = rolCfg(u.rol)
          const Icono = r.icon
          const esYo  = u.id === perfil.id
          return (
            <div key={u.id} className={`bg-white dark:bg-gray-800 rounded-lg border-l-4 ${r.text.replace('text-', 'border-')} border-t border-r border-b border-gray-100 dark:border-gray-700 p-4 ${!u.activo ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`${r.bg} w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0`}>
                  <Icono size={18} className={r.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{u.nombre}</p>
                    {esYo && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">Vos</span>}
                    {!u.activo && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-medium">Desactivado</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{u.email ?? '—'}</p>
                  <div className="mt-2">
                    {edicionRol === u.id ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map(r2 => (
                          <button
                            key={r2.v}
                            onClick={() => cambiarRol(u.id, r2.v)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium ${r2.bg} ${r2.text} ${u.rol === r2.v ? 'ring-2 ring-violet-500' : ''}`}
                          >
                            {r2.label}
                          </button>
                        ))}
                        <button onClick={() => setEdicionRol(null)} className="px-2.5 py-1 rounded-md text-xs text-gray-500">
                          <X size={12} className="inline" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => !esYo && setEdicionRol(u.id)}
                        disabled={esYo}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium ${r.bg} ${r.text} ${!esYo ? 'hover:ring-2 hover:ring-violet-300' : 'cursor-not-allowed'}`}
                        title={esYo ? 'No podés cambiarte el rol a vos mismo' : 'Tocá para cambiar'}
                      >
                        {r.label}
                      </button>
                    )}
                  </div>
                </div>
                {!esYo && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => setModal({ tipo: 'password', user: u })}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                      title="Resetear contraseña"
                    >
                      <Key size={14} />
                    </button>
                    <button
                      onClick={() => toggleActivo(u)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                      title={u.activo ? 'Desactivar' : 'Activar'}
                    >
                      {u.activo ? <X size={14} /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => borrar(u)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        </div>
      </div>

      {modal === 'nuevo' && (
        <ModalNuevo onClose={() => setModal(null)} onCreado={() => { setModal(null); cargar() }} setError={setError} />
      )}
      {modal?.tipo === 'password' && (
        <ModalPassword user={modal.user} onClose={() => setModal(null)} setError={setError} />
      )}
    </div>
  )
}

function ModalNuevo({ onClose, onCreado, setError }) {
  const [form, setForm] = useState({ email: '', password: '', nombre: '', rol: 'soporte' })
  const [guardando, setGuardando] = useState(false)

  async function crear(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Contraseña mínimo 6 caracteres'); return }
    setGuardando(true)
    try {
      await AdminAPI.crear(form)
      onCreado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-lg mx-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-t-lg max-h-[92vh] overflow-y-auto">
        <div className="bg-violet-600 px-5 py-4 rounded-t-lg flex items-center justify-between">
          <p className="font-bold text-white text-lg">Nuevo usuario</p>
          <button onClick={onClose} className="text-white/90 p-1"><X size={20} /></button>
        </div>
        <form onSubmit={crear} className="p-5 space-y-3">
          <Campo label="Nombre *">
            <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
          </Campo>
          <Campo label="Email *">
            <input required type="email" autoComplete="off" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
          </Campo>
          <Campo label="Contraseña * (mínimo 6 caracteres)">
            <input required type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Se la mandás al usuario" />
          </Campo>
          <Campo label="Rol *">
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.v} type="button" onClick={() => setForm(f => ({ ...f, rol: r.v }))}
                  className={`py-2 rounded-md text-xs font-semibold border-2 ${r.bg} ${r.text} ${form.rol === r.v ? 'border-violet-500' : 'border-transparent'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Campo>
          <button type="submit" disabled={guardando} className="w-full py-3 rounded-md bg-violet-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={16} />{guardando ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ModalPassword({ user, onClose, setError }) {
  const [password, setPassword] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function actualizar(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Contraseña mínimo 6 caracteres'); return }
    setGuardando(true)
    try {
      await AdminAPI.actualizar({ id: user.id, password })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-lg mx-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-t-lg">
        <div className="bg-violet-600 px-5 py-4 rounded-t-lg flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-lg">Resetear contraseña</p>
            <p className="text-xs text-white/80">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-white/90 p-1"><X size={20} /></button>
        </div>
        <form onSubmit={actualizar} className="p-5 space-y-3">
          <Campo label="Nueva contraseña *">
            <input required type="text" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
          </Campo>
          <button type="submit" disabled={guardando} className="w-full py-3 rounded-md bg-violet-600 text-white text-sm font-bold disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}
