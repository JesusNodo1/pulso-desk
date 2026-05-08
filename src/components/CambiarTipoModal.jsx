import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Ticket, Lightbulb, ClipboardList, AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { convertir, PERDIDAS, TRANSFORMACIONES, RUTAS, LABELS } from '../lib/convertir'

const TIPOS = {
  ticket:    { icon: Ticket,         color: 'bg-red-600',     accent: 'border-red-500'    },
  solicitud: { icon: Lightbulb,      color: 'bg-amber-500',   accent: 'border-amber-500'  },
  orden:     { icon: ClipboardList,  color: 'bg-indigo-600',  accent: 'border-indigo-500' },
}

export default function CambiarTipoModal({ tipoActual, registro, onClose }) {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [destino, setDestino] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState(null)

  const opciones = Object.keys(TIPOS).filter(t => t !== tipoActual && t !== 'orden')

  async function ejecutar() {
    if (!destino) return
    setConfirmando(true)
    setError(null)
    try {
      const { id, tipo } = await convertir(tipoActual, destino, registro, perfil.id)
      onClose()
      navigate(`${RUTAS[tipo]}/${id}`, { replace: true })
    } catch (e) {
      setError(e.message ?? 'No se pudo convertir')
      setConfirmando(false)
    }
  }

  const perdidas       = destino ? (PERDIDAS[tipoActual]?.[destino] ?? []) : []
  const transformaciones = destino ? (TRANSFORMACIONES[tipoActual]?.[destino] ?? []) : []

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end lg:items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Cambiar tipo</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Tipo actual</p>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md border-l-4 ${TIPOS[tipoActual].accent} bg-gray-50 dark:bg-gray-700/50`}>
              {(() => { const Icono = TIPOS[tipoActual].icon; return <Icono size={16} /> })()}
              <span className="text-sm font-medium text-gray-900 dark:text-white">{LABELS[tipoActual]}</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Convertir a</p>
            <div className="space-y-2">
              {opciones.map(t => {
                const Icono = TIPOS[t].icon
                const seleccionado = destino === t
                return (
                  <button
                    key={t}
                    onClick={() => setDestino(t)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md border-l-4 ${TIPOS[t].accent} border-t border-r border-b transition-colors text-left ${
                      seleccionado
                        ? 'border-gray-900 dark:border-white bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Icono size={16} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{LABELS[t]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {destino && (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Datos que se pierden</p>
                </div>
                {perdidas.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">Ninguno.</p>
                ) : (
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5 list-disc list-inside">
                    {perdidas.map(p => <li key={p}>{p}</li>)}
                  </ul>
                )}
              </div>

              {transformaciones.length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md p-3">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Datos que se preservan</p>
                  <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-0.5 list-disc list-inside">
                    {transformaciones.map(t => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={confirmando}
              className="flex-1 py-2.5 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={ejecutar}
              disabled={!destino || confirmando}
              className="flex-1 py-2.5 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {confirmando ? 'Convirtiendo...' : 'Convertir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
