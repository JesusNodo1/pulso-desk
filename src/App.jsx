import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import FabCaptura from './components/FabCaptura'
import Login from './pages/Login'
import SinPerfil from './pages/SinPerfil'

// Lazy-load de todas las páginas — cada una queda en su propio chunk y solo
// se descarga cuando el usuario navega a esa ruta. Reduce el first-load ~80%.
const Inicio            = lazy(() => import('./pages/Inicio'))
const Clientes          = lazy(() => import('./pages/Clientes'))
const NuevoCliente      = lazy(() => import('./pages/NuevoCliente'))
const ClienteDetalle    = lazy(() => import('./pages/ClienteDetalle'))
const Tickets           = lazy(() => import('./pages/Tickets'))
const NuevoTicket       = lazy(() => import('./pages/NuevoTicket'))
const TicketDetalle     = lazy(() => import('./pages/TicketDetalle'))
const Solicitudes       = lazy(() => import('./pages/Solicitudes'))
const NuevaSolicitud    = lazy(() => import('./pages/NuevaSolicitud'))
const SolicitudDetalle  = lazy(() => import('./pages/SolicitudDetalle'))
const Dashboard         = lazy(() => import('./pages/Dashboard'))
const Sistemas          = lazy(() => import('./pages/Sistemas'))
const SistemaDetalle    = lazy(() => import('./pages/SistemaDetalle'))
const Usuarios          = lazy(() => import('./pages/Usuarios'))
const Mas               = lazy(() => import('./pages/Mas'))

function CargandoPagina() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <div className="w-3 h-3 rounded-md bg-emerald-500 animate-pulse" />
        <p className="text-sm">Cargando...</p>
      </div>
    </div>
  )
}

function AppShell() {
  const { session, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  if (!session) return <Login />
  if (!perfil || !perfil.activo) return <SinPerfil />

  return (
    <BrowserRouter>
      <Sidebar />
      <div className="lg:pl-56 lg:min-h-screen lg:bg-gray-50 lg:dark:bg-gray-900">
        <div className="min-h-screen lg:min-h-0 bg-gray-50 dark:bg-gray-900 pb-16 lg:pb-0 max-w-lg lg:max-w-6xl mx-auto lg:px-6 lg:[&>div:first-child]:min-h-0 lg:[&>div:first-child>div:first-child]:pt-6">
          <Suspense fallback={<CargandoPagina />}>
            <Routes>
              <Route path="/"                    element={<Inicio />} />
              <Route path="/dashboard"           element={<Dashboard />} />
              <Route path="/clientes"            element={<Clientes />} />
              <Route path="/clientes/nuevo"      element={<NuevoCliente />} />
              <Route path="/clientes/:id"        element={<ClienteDetalle />} />
              <Route path="/tickets"             element={<Tickets />} />
              <Route path="/tickets/nuevo"       element={<NuevoTicket />} />
              <Route path="/tickets/:id"         element={<TicketDetalle />} />
              <Route path="/solicitudes"         element={<Solicitudes />} />
              <Route path="/solicitudes/nueva"   element={<NuevaSolicitud />} />
              <Route path="/solicitudes/:id"     element={<SolicitudDetalle />} />
              <Route path="/sistemas"            element={<Sistemas />} />
              <Route path="/sistemas/:id"        element={<SistemaDetalle />} />
              <Route path="/usuarios"            element={<Usuarios />} />
              <Route path="/mas"                 element={<Mas />} />
              <Route path="*"                    element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
          <BottomNav />
        </div>
      </div>
      <FabCaptura />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  )
}
