import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { LogOut, Moon, Sun, BarChart3, Lightbulb, PlusCircle, ChevronRight, Server, Users } from 'lucide-react'

const ROL_LABEL = {
  admin:         'Administrador',
  desarrollador: 'Desarrollador',
  soporte:       'Soporte',
}

export default function Mas() {
  const { perfil, signOut } = useAuth()
  const { dark, toggle }    = useTheme()

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
          <LinkRow to="/solicitudes"     icon={Lightbulb}  label="Solicitudes" />
          <LinkRow to="/sistemas"        icon={Server}     label="Sistemas" />
          {perfil.rol === 'admin' && (
            <LinkRow to="/usuarios"      icon={Users}      label="Usuarios del equipo" />
          )}
          <LinkRow to="/tickets/nuevo"   icon={PlusCircle} label="Nuevo ticket" />
          <LinkRow to="/solicitudes/nueva" icon={PlusCircle} label="Nueva solicitud" last />
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
