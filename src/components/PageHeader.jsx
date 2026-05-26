import { colorModulo } from '../lib/modulos'

export default function PageHeader({ modulo, icono: Icono, titulo, subtitulo, accion, volver }) {
  const m = colorModulo(modulo)
  return (
    <div className={`${m.bg} px-4 pt-12 lg:pt-6 pb-5 relative overflow-hidden`}>
      {Icono && (
        <div className="absolute -right-4 -top-2 opacity-15 pointer-events-none">
          <Icono size={110} color="white" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          {volver && (
            <button onClick={volver} className="p-1 text-white/90 hover:text-white">
              {volver === true ? null : volver}
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{titulo}</h1>
            {subtitulo && <p className="text-xs text-white/80 mt-0.5 truncate">{subtitulo}</p>}
          </div>
        </div>
        {accion && <div className="flex-shrink-0">{accion}</div>}
      </div>
    </div>
  )
}
