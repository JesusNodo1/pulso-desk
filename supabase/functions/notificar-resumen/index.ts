// Edge Function: notificar-resumen
// Dos modos de invocación:
//   1. Cron (Supabase pg_cron, lunes y viernes 9 AM PY) — Authorization: Bearer <CRON_SECRET>
//      → envía a todos los ADMINS activos.
//   2. Manual desde la app — Authorization: Bearer <JWT del admin>
//      → envía a TODOS los usuarios activos.
//
// Destinatario = pd_usuarios_perfil.email_resumen (configurable por cada
// usuario desde la pantalla Más). Usuarios sin email_resumen se omiten.
//
// Secrets requeridos (Supabase > Edge Functions > notificar-resumen > Secrets):
//   - SUPABASE_URL                 (auto: ya existe en Edge Functions runtime)
//   - SUPABASE_SERVICE_ROLE_KEY    (auto: ya existe en Edge Functions runtime)
//   - RESEND_API_KEY               (de https://resend.com/api-keys)
//   - RESEND_FROM                  (ej: "Pulso Desk <onboarding@resend.dev>")
//   - CRON_SECRET                  (string random — el cron lo manda como Bearer)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM               = Deno.env.get('RESEND_FROM') ?? 'Pulso Desk <onboarding@resend.dev>'
const CRON_SECRET               = Deno.env.get('CRON_SECRET') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // --- Auth: aceptamos CRON_SECRET (cron) o JWT de un admin activo (manual)
  const auth = req.headers.get('authorization') ?? ''
  let modo: 'cron' | 'manual'

  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) {
    modo = 'cron'
  } else if (auth.toLowerCase().startsWith('bearer ')) {
    const jwt = auth.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: errUser } = await supabase.auth.getUser(jwt)
    if (errUser || !user) {
      return json({ error: 'invalid_token', detail: errUser?.message ?? 'no user' }, 401)
    }
    const { data: perfil } = await supabase
      .from('pd_usuarios_perfil')
      .select('rol, activo')
      .eq('id', user.id)
      .maybeSingle()
    if (!perfil)             return json({ error: 'perfil_no_existe' }, 403)
    if (!perfil.activo)      return json({ error: 'perfil_inactivo'  }, 403)
    if (perfil.rol !== 'admin') {
      return json({ error: 'forbidden_not_admin', detail: `Tu rol es "${perfil.rol}", solo admin puede disparar el reporte` }, 403)
    }
    modo = 'manual'
  } else {
    return json({ error: 'unauthorized' }, 401)
  }

  // 1. Destinatarios — usuarios activos con email_resumen configurado
  //    - cron   → solo admins
  //    - manual → todos los usuarios activos
  const q = supabase
    .from('pd_usuarios_perfil')
    .select('id, nombre, email_resumen')
    .eq('activo', true)
    .not('email_resumen', 'is', null)
  if (modo === 'cron') q.eq('rol', 'admin')
  const { data: destinatarios } = await q

  const emails = Array.from(new Set(
    (destinatarios ?? [])
      .map(u => (u.email_resumen ?? '').trim())
      .filter(e => e.includes('@'))
  ))

  if (emails.length === 0) {
    return json({
      skipped: `sin ${modo === 'cron' ? 'admins' : 'usuarios'} con email_resumen configurado`,
      modo,
    })
  }

  // 2. Datos del resumen
  const desde7d = new Date(Date.now() - 7 * 86400000).toISOString()

  const [tk, sl, viejos] = await Promise.all([
    supabase.from('pd_tickets').select('id, estado, cerrado_at'),
    supabase.from('pd_solicitudes').select('id, estado'),
    supabase.from('pd_tickets')
      .select('numero, titulo, prioridad, created_at, pd_clientes(razon_social)')
      .neq('estado', 'cerrado')
      .order('created_at', { ascending: true })
      .limit(5),
  ])

  const tickets     = tk.data     ?? []
  const solicitudes = sl.data     ?? []
  const masViejos   = viejos.data ?? []

  const stats = {
    abiertos:       tickets.filter(t => t.estado === 'abierto').length,
    en_proceso:     tickets.filter(t => t.estado === 'en_proceso').length,
    esperando:      tickets.filter(t => t.estado === 'esperando_cliente').length,
    cerradosSemana: tickets.filter(t => t.cerrado_at && t.cerrado_at >= desde7d).length,
    solPendientes:  solicitudes.filter(s => s.estado === 'pendiente').length,
    solEnAnalisis:  solicitudes.filter(s => s.estado === 'en_analisis').length,
    solAprobadas:   solicitudes.filter(s => s.estado === 'aprobado').length,
  }

  // 3. HTML
  const fechaPY = new Date().toLocaleDateString('es-PY', {
    timeZone: 'America/Asuncion',
    weekday: 'long',
    day:     '2-digit',
    month:   'long',
  })

  const filasViejos = masViejos.map(t => {
    const dias = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000)
    const cli = (t.pd_clientes as any)?.razon_social
    return `<li>#${t.numero} · <b>${t.prioridad}</b> · ${dias}d · ${escape(t.titulo)}${cli ? ` <span style="color:#888">(${escape(cli)})</span>` : ''}</li>`
  }).join('')

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:600px;margin:auto;padding:20px;background:#f9fafb">
  <div style="background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="color:#059669;margin:0 0 4px 0">Pulso Desk · Resumen</h2>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px 0;text-transform:capitalize">${fechaPY}</p>

    <h3 style="color:#dc2626;font-size:15px;margin-bottom:8px">🎫 Tickets</h3>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px;width:100%">
      <tr style="background:#fef2f2"><td>🔴 Abiertos</td><td align="right"><b>${stats.abiertos}</b></td></tr>
      <tr><td>🟡 En proceso</td><td align="right"><b>${stats.en_proceso}</b></td></tr>
      <tr style="background:#eff6ff"><td>🔵 Esperando cliente</td><td align="right"><b>${stats.esperando}</b></td></tr>
      <tr><td>✅ Cerrados últimos 7 días</td><td align="right"><b>${stats.cerradosSemana}</b></td></tr>
    </table>

    <h3 style="color:#f59e0b;font-size:15px;margin-top:20px;margin-bottom:8px">💡 Solicitudes</h3>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px;width:100%">
      <tr style="background:#fafafa"><td>⏳ Pendientes</td><td align="right"><b>${stats.solPendientes}</b></td></tr>
      <tr><td>🔵 En análisis</td><td align="right"><b>${stats.solEnAnalisis}</b></td></tr>
      <tr style="background:#ecfdf5"><td>✅ Aprobadas</td><td align="right"><b>${stats.solAprobadas}</b></td></tr>
    </table>

    ${masViejos.length > 0 ? `
      <h3 style="color:#7c3aed;font-size:15px;margin-top:20px;margin-bottom:8px">⏰ Tickets más viejos sin cerrar</h3>
      <ul style="font-size:14px;padding-left:20px;color:#374151">${filasViejos}</ul>
    ` : ''}

    <p style="color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px">
      Enviado automáticamente · <a href="https://pulso-desk.pages.dev" style="color:#059669">pulso-desk.pages.dev</a>
    </p>
  </div>
</body></html>`

  // 4. Enviar via Resend
  const fechaCorta = new Date().toLocaleDateString('es-PY', {
    timeZone: 'America/Asuncion',
    day:   '2-digit',
    month: 'short',
  })

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      emails,
      subject: `Pulso Desk · Resumen ${fechaCorta}`,
      html,
    }),
  })

  if (!r.ok) {
    return json({ error: await r.text() }, 500)
  }

  return json({ ok: true, modo, recipients: emails.length, stats })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escape(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}
