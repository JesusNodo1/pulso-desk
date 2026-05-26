import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { LogOut, Moon, Sun, BarChart3, PlusCircle, ChevronRight, Server, Users, Mail, Check, Loader2 } from 'lucide-react'

const ROL_LABEL = {
  admin:         'Administrador',
  desarrollador: 'Desarrollador',
  soporte:       'Soporte',
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function Mas() {
  const { perfil, signOut } = useAuth()
  const { dark, toggle }    = useTheme()

  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso]       = useState(null) // { tipo: 'ok'|'err', msg }

  const [usuarios, setUsuarios]       = useState(null) // null = cargando
  const [loadError, setLoadError]     = useState(null)
  const [drafts, setDrafts]           = useState({})   // { id: 'email...' }
  const [savingId, setSavingId]       = useState(null)
  const [savedId,  setSavedId]        = useState(null)
  const [rowError, setRowError]       = useState({})   // { id: 'msg' }

  useEffect(() => { cargarUsuarios() }, [])

  async function cargarUsuarios() {
    setLoadError(null)
    // Intentamos primero con email_resumen. Si la columna no existe (migración 2.7
    // no aplicada todavía), reintentamos sin ella para que la lista igual se vea.
    let { data, error } = await supabase
      .from('pd_usuarios_perfil')
      .select('id, nombre, rol, activo, email_resumen')
      .eq('activo', true)
      .order('nombre')

    if (error && /email_resumen/i.test(error.message)) {
      setLoadError('Falta correr la migración 2.7 (email_resumen). La lista se muestra sin la columna; los emails no se pueden guardar todavía.')
      const r = await supabase
        .from('pd_usuarios_perfil')
        .select('id, nombre, rol, activo')
        .eq('activo', true)
        .order('nombre')
      data  = r.data
      error = r.error
    }

    if (error) {
      setLoadError(error.message)
      setUsuarios([])
      return
    }
    setUsuarios(data ?? [])
    const initialDrafts = {}
    ;(data ?? []).forEach(u => { initialDrafts[u.id] = u.email_resumen ?? '' })
    setDrafts(initialDrafts)
  }

  function dirty(u) {
    return (drafts[u.id] ?? '') !== (u.email_resumen ?? '')
  }

  async function guardarEmail(u) {
    const valor = (drafts[u.id] ?? '').trim()
    if (valor !== '' && !EMAIL_RE.test(valor)) {
      setRowError(prev => ({ ...prev, [u.id]: 'Email inválido' }))
      return
    }
    setRowError(prev => ({ ...prev, [u.id]: null }))
    setSavingId(u.id)
    const { error } = await supabase.rpc('pd_set_email_resumen', {
      p_id:    u.id,
      p_email: valor === '' ? null : valor,
    })
    setSavingId(null)
    if (error) {
      const msg = {
        usuario_no_autorizado: 'No autorizado',
        email_invalido:        'Email inválido',
        perfil_no_encontrado:  'Perfil no encontrado',
      }[error.message] ?? error.message
      setRowError(prev => ({ ...prev, [u.id]: msg }))
      return
    }
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, email_resumen: valor === '' ? null : valor } : x))
    setSavedId(u.id)
    setTimeout(() => setSavedId(curr => curr === u.id ? null : curr), 1500)
  }

  async function enviarReporte() {
    if (enviando) return
    if (!window.confirm('¿Enviar el reporte semanal por correo a todos los usuarios activos?')) return
    setEnviando(true)
    setAviso(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sin sesión activa')
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notificar-resumen`
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: '{}',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = data?.error ?? `error_${res.status}`
        const map = {
          forbidden_not_admin: 'Solo un admin puede disparar el reporte',
          invalid_token:       'Sesión expirada, refrescá (F5) y volvé a probar',
          perfil_no_existe:    'Tu cuenta no tiene perfil',
          perfil_inactivo:     'Tu perfil está desactivado',
          unauthorized:        'No autorizado',
        }
        throw new Error(map[code] ?? code)
      }
      if (data.skipped) {
        setAviso({ tipo: 'err', msg: `No hay destinatarios: ${data.skipped}` })
      } else {
        setAviso({ tipo: 'ok', msg: `Reporte enviado a ${data.recipients} usuario${data.recipients === 1 ? '' : 's'}` })
      }
    } catch (e) {
      setAviso({ tipo: 'err', msg: e.message ?? 'Error inesperado' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-4 border-b border-gray-100 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Más</h1>
      </div>
      <div className="p-4 space-y-3 max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-400">Sesión activa</p>
          <p className="font-semibold text-gray-900 dark:text-white">{perfil.nombre}</p>
          <p className="text-sm text-gray-500">{ROL_LABEL[perfil.rol]}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <LinkRow to="/dashboard"       icon={BarChart3}  label="Dashboard" />
          <LinkRow to="/sistemas"        icon={Server}     label="Sistemas" />
          {perfil.rol === 'admin' && (
            <LinkRow to="/usuarios"      icon={Users}      label="Usuarios del equipo" />
          )}
          <LinkRow to="/tickets/nuevo"   icon={PlusCircle} label="Generar ticket" last />
        </div>

        {/* Reporte semanal por correo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail size={16} className="text-emerald-600" />
              Reporte semanal por correo
            </p>
            <p className="text-xs text-gray-500 mt-1">
              El cron envía el resumen los lunes y viernes 9:00 AM a los admins.
              Cada usuario configura abajo el correo que recibirá el reporte.
            </p>
          </div>

          <div className="border-b border-gray-100 dark:border-gray-700">
            <button
              onClick={enviarReporte}
              disabled={enviando}
              className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-50 disabled:opacity-60"
            >
              {enviando
                ? <Loader2 size={18} className="text-emerald-600 animate-spin" />
                : <Mail size={18} className="text-emerald-600" />}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {enviando ? 'Enviando…' : 'Enviar ahora a todos los usuarios'}
                </p>
                <p className="text-xs text-gray-500">Manda el resumen actual a todos los emails configurados</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
            {aviso && (
              <div className={`px-4 pb-3 text-xs ${aviso.tipo === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                {aviso.msg}
              </div>
            )}
          </div>

          <div className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Correos para resumen</p>
            {loadError && (
              <p className="text-xs text-red-600 mb-2">{loadError}</p>
            )}
            {usuarios === null && (
              <p className="text-sm text-gray-500">Cargando usuarios…</p>
            )}
            {usuarios && usuarios.length === 0 && !loadError && (
              <p className="text-sm text-gray-500">No hay usuarios activos.</p>
            )}
            <div className="space-y-3">
              {(usuarios ?? []).map(u => (
                <div key={u.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.nombre}</p>
                      <p className="text-xs text-gray-500">{ROL_LABEL[u.rol] ?? u.rol}</p>
                    </div>
                    {savedId === u.id && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 flex-shrink-0 ml-2">
                        <Check size={14} /> Guardado
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder="email@ejemplo.com"
                      value={drafts[u.id] ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [u.id]: e.target.value }))}
                      className="flex-1 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => guardarEmail(u)}
                      disabled={!dirty(u) || savingId === u.id}
                      className="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
                    >
                      {savingId === u.id ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
                    </button>
                  </div>
                  {rowError[u.id] && (
                    <p className="text-xs text-red-600 mt-1">{rowError[u.id]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 text-left"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Modo {dark ? 'claro' : 'oscuro'}
          </span>
        </button>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 text-left text-red-600"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>
  )
}

function LinkRow({ to, icon: Icon, label, last }) {
  return (
    <Link to={to} className={`flex items-center gap-3 p-4 ${!last ? 'border-b border-gray-100 dark:border-gray-700' : ''} active:bg-gray-50`}>
      <Icon size={18} className="text-gray-500" />
      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <ChevronRight size={16} className="text-gray-300" />
    </Link>
  )
}
