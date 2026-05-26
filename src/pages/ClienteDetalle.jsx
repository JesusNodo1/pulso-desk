import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, puedeEscribirClientes, puedeCrearTickets } from '../lib/auth'
import { ArrowLeft, MessageCircle, Plus, Trash2, Pencil, Save, X, Ticket as TicketIcon, Download } from 'lucide-react'
import { linkWhatsApp, formatearTelefonoPY } from '../lib/phone'
import { format } from 'date-fns'

const ESTADO_TICKET = {
  abierto:           { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Abierto' },
  en_proceso:        { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En proceso' },
  esperando_cliente: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Esperando cliente' },
  cerrado:           { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Cerrado' },
}

const ETIQUETA_TIPO = {
  soporte_tecnico: 'Soporte',
  incidente:       'Incidente',
  consulta:        'Consulta',
  peticion:        'Petición',
}

const ETIQUETA_PRIO = {
  baja:  'Baja',
  media: 'Media',
  alta:  'Alta',
}

function escaparCsv(val) {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export default function ClienteDetalle() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [cliente, setCliente]     = useState(null)
  const [contactos, setContactos] = useState([])
  const [tickets, setTickets]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [editando, setEditando]   = useState(false)
  const [form, setForm]           = useState(null)
  const [nuevoContacto, setNuevoContacto] = useState(null)
  const [exportando, setExportando] = useState(false)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const [{ data: cli }, { data: cts }, { data: tks }] = await Promise.all([
      supabase.from('pd_clientes').select('*').eq('id', id).single(),
      supabase.from('pd_contactos').select('*').eq('cliente_id', id).order('principal', { ascending: false }),
      supabase.from('pd_tickets').select('id, numero, titulo, estado, prioridad, created_at').eq('cliente_id', id).order('created_at', { ascending: false }),
    ])
    setCliente(cli)
    setContactos(cts ?? [])
    setTickets(tks ?? [])
    setForm(cli)
    setLoading(false)
  }

  async function guardar() {
    const { razon_social, rubro, estado, ruc, direccion, notas } = form
    await supabase.from('pd_clientes').update({ razon_social, rubro, estado, ruc, direccion, notas }).eq('id', id)
    setEditando(false)
    cargar()
  }

  async function exportarCSV() {
    setExportando(true)
    try {
      const { data: tks, error } = await supabase
        .from('pd_tickets')
        .select('numero, titulo, estado, prioridad, tipo, descripcion, asignado_a, created_at, cerrado_at')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })

      if (error) { alert('Error al exportar: ' + error.message); return }
      if (!tks || tks.length === 0) { alert('Este cliente no tiene tickets para exportar.'); return }

      const ids = [...new Set(tks.map(t => t.asignado_a).filter(Boolean))]
      let nombres = {}
      if (ids.length) {
        const { data: us } = await supabase.from('pd_usuarios_perfil').select('id, nombre').in('id', ids)
        nombres = Object.fromEntries((us ?? []).map(u => [u.id, u.nombre]))
      }

      const headers = ['Número', 'Título', 'Tipo', 'Estado', 'Prioridad', 'Asignado a', 'Creado', 'Cerrado', 'Descripción']
      const rows = tks.map(t => [
        t.numero,
        t.titulo,
        ETIQUETA_TIPO[t.tipo] ?? t.tipo,
        ESTADO_TICKET[t.estado]?.label ?? t.estado,
        ETIQUETA_PRIO[t.prioridad] ?? t.prioridad,
        t.asignado_a ? (nombres[t.asignado_a] ?? '') : 'Sin asignar',
        format(new Date(t.created_at), 'dd/MM/yyyy HH:mm'),
        t.cerrado_at ? format(new Date(t.cerrado_at), 'dd/MM/yyyy HH:mm') : '',
        t.descripcion ?? '',
      ])

      const csv = [headers, ...rows].map(r => r.map(escaparCsv).join(',')).join('\r\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const fecha = format(new Date(), 'yyyy-MM-dd')
      const slug = (cliente.razon_social ?? 'cliente').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `tickets-${slug}-${fecha}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } finally {
      setExportando(false)
    }
  }

  async function borrarContacto(cid) {
    if (!confirm('¿Eliminar contacto?')) return
    await supabase.from('pd_contactos').delete().eq('id', cid)
    cargar()
  }

  async function agregarContacto() {
    if (!nuevoContacto.nombre.trim() || !nuevoContacto.telefono.trim()) return
    await supabase.from('pd_contactos').insert({ ...nuevoContacto, cliente_id: id })
    setNuevoContacto(null)
    cargar()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!cliente) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cliente no encontrado</div>

  const puedeEditar = puedeEscribirClientes(perfil.rol)

  return (
    <div className="min-h-screen">
      <div className="bg-white dark:bg-gray-800 px-4 pt-14 lg:pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{cliente.razon_social}</h1>
        </div>
        {puedeEditar && !editando && (
          <button onClick={() => setEditando(true)} className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
            <Pencil size={15} />Editar
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-2">
          {editando ? (
            <div className="space-y-3">
              <Campo label="Razón social"><input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className={inputCls} /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Rubro"><input value={form.rubro ?? ''} onChange={e => setForm(f => ({ ...f, rubro: e.target.value }))} className={inputCls} /></Campo>
                <Campo label="Estado">
                  <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inputCls}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="prospecto">Prospecto</option>
                  </select>
                </Campo>
              </div>
              <Campo label="RUC"><input value={form.ruc ?? ''} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} className={inputCls} /></Campo>
              <Campo label="Dirección"><input value={form.direccion ?? ''} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className={inputCls} /></Campo>
              <Campo label="Notas"><textarea rows={2} value={form.notas ?? ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className={inputCls} /></Campo>
              <div className="flex gap-2">
                <button onClick={guardar} className="flex-1 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2"><Save size={15} />Guardar</button>
                <button onClick={() => { setForm(cliente); setEditando(false) }} className="flex-1 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium flex items-center justify-center gap-2"><X size={15} />Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <Info label="Rubro"     value={cliente.rubro} />
              <Info label="Estado"    value={cliente.estado} />
              <Info label="RUC"       value={cliente.ruc} />
              <Info label="Dirección" value={cliente.direccion} />
              {cliente.notas && <Info label="Notas" value={cliente.notas} />}
            </>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Contactos</p>
            {puedeEditar && !nuevoContacto && (
              <button onClick={() => setNuevoContacto({ nombre: '', telefono: '', rol: '', principal: false })} className="flex items-center gap-1 text-emerald-600 text-sm"><Plus size={14} />Agregar</button>
            )}
          </div>
          <div className="space-y-2">
            {contactos.map(c => (
              <div key={c.id} className="flex items-center gap-3 border border-gray-100 dark:border-gray-700 rounded-md p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{c.nombre}</p>
                    {c.principal && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Principal</span>}
                  </div>
                  {c.rol && <p className="text-xs text-gray-500">{c.rol}</p>}
                  <p className="text-xs text-gray-500">{formatearTelefonoPY(c.telefono)}</p>
                </div>
                <a href={linkWhatsApp(c.telefono)} target="_blank" rel="noreferrer" className="p-2 bg-green-500 rounded-md text-white"><MessageCircle size={15} /></a>
                {puedeEditar && (
                  <button onClick={() => borrarContacto(c.id)} className="p-2 text-red-500"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            {nuevoContacto && (
              <div className="border border-emerald-200 rounded-md p-3 space-y-2 bg-emerald-50/40">
                <input placeholder="Nombre"   value={nuevoContacto.nombre}   onChange={e => setNuevoContacto(c => ({ ...c, nombre: e.target.value }))}   className={inputCls} />
                <input placeholder="WhatsApp" value={nuevoContacto.telefono} onChange={e => setNuevoContacto(c => ({ ...c, telefono: e.target.value }))} className={inputCls} />
                <input placeholder="Rol"      value={nuevoContacto.rol}      onChange={e => setNuevoContacto(c => ({ ...c, rol: e.target.value }))}      className={inputCls} />
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={nuevoContacto.principal} onChange={e => setNuevoContacto(c => ({ ...c, principal: e.target.checked }))} />Principal
                </label>
                <div className="flex gap-2">
                  <button onClick={agregarContacto} className="flex-1 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold">Guardar</button>
                  <button onClick={() => setNuevoContacto(null)} className="flex-1 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs">Cancelar</button>
                </div>
              </div>
            )}
            {contactos.length === 0 && !nuevoContacto && (
              <p className="text-sm text-gray-500 text-center py-4">Sin contactos cargados.</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Historial de tickets</p>
            <div className="flex items-center gap-3">
              {tickets.length > 0 && (
                <button onClick={exportarCSV} disabled={exportando} className="flex items-center gap-1 text-gray-600 dark:text-gray-300 text-sm disabled:opacity-50" title="Exportar tickets a CSV">
                  <Download size={14} />{exportando ? 'Exportando...' : 'Exportar'}
                </button>
              )}
              {puedeCrearTickets(perfil.rol) && (
                <button onClick={() => navigate(`/tickets/nuevo?cliente=${id}`)} className="flex items-center gap-1 text-emerald-600 text-sm">
                  <Plus size={14} />Ticket
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {tickets.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Sin tickets aún.</p>
            )}
            {tickets.map(t => {
              const e = ESTADO_TICKET[t.estado]
              return (
                <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="border border-gray-100 dark:border-gray-700 rounded-md p-3 cursor-pointer active:bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs text-gray-400">#{t.numero}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${e.bg} ${e.text}`}>{e.label}</span>
                    <span className="text-xs text-gray-500">{format(new Date(t.created_at), 'dd/MM/yy')}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white truncate">{t.titulo}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

function Info({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}
