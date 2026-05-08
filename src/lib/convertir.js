import { supabase } from './supabase'

// Mapeos entre niveles equivalentes
const PRIO_A_IMPACTO = { alta: 'alto', media: 'medio', baja: 'bajo' }
const IMPACTO_A_PRIO = { alto: 'alta', medio: 'media', bajo: 'baja' }

export const RUTAS = {
  ticket:    '/tickets',
  solicitud: '/solicitudes',
  orden:     '/ordenes',
}

export const LABELS = {
  ticket:    'Ticket de soporte',
  solicitud: 'Solicitud de mejora',
  orden:     'Orden de trabajo',
}

// Qué se pierde al convertir de A a B
export const PERDIDAS = {
  ticket: {
    solicitud: ['Mensajes del timeline', 'Etiquetas', 'Contacto', 'Prioridad', 'Tipo (incidente/consulta)', 'Estado actual', 'Asignación'],
    orden:     ['Mensajes del timeline', 'Etiquetas', 'Contacto', 'Cliente vinculado', 'Tipo', 'Estado actual'],
  },
  solicitud: {
    ticket: ['Frecuencia', 'Sistema', 'Estado de aprobación'],
    orden:  ['Frecuencia', 'Cliente vinculado', 'Estado de aprobación'],
  },
  orden: {
    ticket:    ['Bitácora de observaciones', 'Complejidad', 'Fecha objetivo', 'Sistema', 'Funcionalidad', 'Estado actual'],
    solicitud: ['Bitácora de observaciones', 'Complejidad', 'Fecha objetivo', 'Funcionalidad', 'Asignación', 'Estado actual'],
  },
}

// Cambios de campo notables (informativos, no son pérdidas)
export const TRANSFORMACIONES = {
  ticket: {
    solicitud: ['Descripción se mantiene', 'Cliente se mantiene'],
    orden:     ['Descripción → Descripción técnica', 'Prioridad se mantiene', 'Asignación se mantiene'],
  },
  solicitud: {
    ticket: ['Descripción se mantiene', 'Cliente se mantiene', 'Impacto → Prioridad equivalente'],
    orden:  ['Descripción → Descripción técnica', 'Sistema se mantiene', 'Impacto → Prioridad equivalente'],
  },
  orden: {
    ticket:    ['Descripción técnica → Descripción', 'Prioridad se mantiene', 'Asignación se mantiene'],
    solicitud: ['Descripción técnica → Descripción', 'Sistema se mantiene', 'Prioridad → Impacto equivalente'],
  },
}

/**
 * Convierte un registro entre tablas. INSERT primero, DELETE después.
 * Si DELETE falla queda el origen — el caller debe surfaceárselo al usuario.
 * @returns {Promise<{ id: string, tipo: 'ticket'|'solicitud'|'orden' }>}
 */
export async function convertir(tipoOrigen, tipoDestino, registro, perfilId) {
  const fn = HANDLERS[`${tipoOrigen}__${tipoDestino}`]
  if (!fn) throw new Error(`Conversión no soportada: ${tipoOrigen} → ${tipoDestino}`)
  return fn(registro, perfilId)
}

const HANDLERS = {
  // ---- Ticket ----
  async ticket__solicitud(t, perfilId) {
    const { data, error } = await supabase.from('pd_solicitudes').insert({
      titulo:      t.titulo,
      descripcion: t.descripcion,
      cliente_id:  t.cliente_id,
      impacto:     'medio',
      frecuencia:  1,
      estado:      'pendiente',
      creado_por:  perfilId,
    }).select('id').single()
    if (error) throw error
    const { error: errDel } = await supabase.from('pd_tickets').delete().eq('id', t.id)
    if (errDel) throw errDel
    return { id: data.id, tipo: 'solicitud' }
  },

  async ticket__orden(t, perfilId) {
    const { data, error } = await supabase.from('pd_ordenes').insert({
      titulo:              t.titulo,
      descripcion_tecnica: t.descripcion,
      prioridad:           t.prioridad,
      asignado_a:          t.asignado_a,
      complejidad:         'media',
      estado:              'pendiente',
      creado_por:          perfilId,
    }).select('id').single()
    if (error) throw error
    const { error: errDel } = await supabase.from('pd_tickets').delete().eq('id', t.id)
    if (errDel) throw errDel
    return { id: data.id, tipo: 'orden' }
  },

  // ---- Solicitud ----
  async solicitud__ticket(s, perfilId) {
    const { data, error } = await supabase.from('pd_tickets').insert({
      titulo:      s.titulo,
      descripcion: s.descripcion,
      cliente_id:  s.cliente_id,
      prioridad:   IMPACTO_A_PRIO[s.impacto] ?? 'media',
      tipo:        'consulta',
      estado:      'abierto',
      creado_por:  perfilId,
    }).select('id').single()
    if (error) throw error
    const { error: errDel } = await supabase.from('pd_solicitudes').delete().eq('id', s.id)
    if (errDel) throw errDel
    return { id: data.id, tipo: 'ticket' }
  },

  async solicitud__orden(s, perfilId) {
    const { data, error } = await supabase.from('pd_ordenes').insert({
      titulo:              s.titulo,
      descripcion_tecnica: s.descripcion,
      sistema_id:          s.sistema_id,
      prioridad:           IMPACTO_A_PRIO[s.impacto] ?? 'media',
      complejidad:         'media',
      estado:              'pendiente',
      creado_por:          perfilId,
    }).select('id').single()
    if (error) throw error
    const { error: errDel } = await supabase.from('pd_solicitudes').delete().eq('id', s.id)
    if (errDel) throw errDel
    return { id: data.id, tipo: 'orden' }
  },

  // ---- Orden ----
  async orden__ticket(o, perfilId) {
    const { data, error } = await supabase.from('pd_tickets').insert({
      titulo:      o.titulo,
      descripcion: o.descripcion_tecnica,
      prioridad:   o.prioridad,
      asignado_a:  o.asignado_a,
      tipo:        'consulta',
      estado:      'abierto',
      creado_por:  perfilId,
    }).select('id').single()
    if (error) throw error
    const { error: errDel } = await supabase.from('pd_ordenes').delete().eq('id', o.id)
    if (errDel) throw errDel
    return { id: data.id, tipo: 'ticket' }
  },

  async orden__solicitud(o, perfilId) {
    const { data, error } = await supabase.from('pd_solicitudes').insert({
      titulo:      o.titulo,
      descripcion: o.descripcion_tecnica,
      sistema_id:  o.sistema_id,
      impacto:     PRIO_A_IMPACTO[o.prioridad] ?? 'medio',
      frecuencia:  1,
      estado:      'pendiente',
      creado_por:  perfilId,
    }).select('id').single()
    if (error) throw error
    const { error: errDel } = await supabase.from('pd_ordenes').delete().eq('id', o.id)
    if (errDel) throw errDel
    return { id: data.id, tipo: 'solicitud' }
  },
}
