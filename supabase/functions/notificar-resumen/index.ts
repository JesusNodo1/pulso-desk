// Edge Function: notificar-resumen
// Dos modos de invocación (ambos envían a TODOS los usuarios activos con email):
//   1. Cron (Supabase pg_cron, lunes y jueves 8 AM PY) — Authorization: Bearer <CRON_SECRET>
//   2. Manual desde la app — Authorization: Bearer <JWT de cualquier usuario activo>
//
// Destinatario = pd_usuarios_perfil.email_resumen (configurable por cada
// usuario desde la pantalla Más). Usuarios sin email_resumen se omiten.
// El envío real es por la API HTTP de Brevo (https://api.brevo.com/v3/smtp/email)
// usando BCC para preservar la privacidad entre destinatarios.
//
// Secrets requeridos (Supabase > Edge Functions > notificar-resumen > Secrets):
//   - SUPABASE_URL                 (auto: ya existe en Edge Functions runtime)
//   - SUPABASE_SERVICE_ROLE_KEY    (auto: ya existe en Edge Functions runtime)
//   - BREVO_API_KEY                (xkeysib-... de https://app.brevo.com/settings/keys/api)
//   - MAIL_FROM                    (ej: "Pulso Desk <pulso@dominio.com>" — el email debe
//                                   estar verificado como Sender en Brevo)
//   - CRON_SECRET                  (string random — el cron lo manda como Bearer)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY             = Deno.env.get('BREVO_API_KEY')!
const MAIL_FROM                 = Deno.env.get('MAIL_FROM')!
const CRON_SECRET               = Deno.env.get('CRON_SECRET') ?? ''

function parseFrom(addr: string): { name?: string; email: string } {
  const m = addr.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (m) {
    const name = m[1].replace(/^"|"$/g, '').trim()
    return name ? { name, email: m[2].trim() } : { email: m[2].trim() }
  }
  return { email: addr.trim() }
}

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
    modo = 'manual'
  } else {
    return json({ error: 'unauthorized' }, 401)
  }

  // 1. Destinatarios — todos los usuarios activos con email_resumen configurado
  //    (mismo alcance para cron y manual)
  const { data: destinatarios } = await supabase
    .from('pd_usuarios_perfil')
    .select('id, nombre, email_resumen')
    .eq('activo', true)
    .not('email_resumen', 'is', null)

  const emails = Array.from(new Set(
    (destinatarios ?? [])
      .map(u => (u.email_resumen ?? '').trim())
      .filter(e => e.includes('@'))
  ))

  if (emails.length === 0) {
    return json({ skipped: 'sin usuarios con email_resumen configurado', modo })
  }

  // 2. Datos del resumen
  const desde7d = new Date(Date.now() - 7 * 86400000).toISOString()

  const [tk, viejos] = await Promise.all([
    supabase.from('pd_tickets').select('id, tipo, estado, cerrado_at'),
    supabase.from('pd_tickets')
      .select('numero, titulo, prioridad, created_at, pd_clientes(razon_social)')
      .neq('estado', 'cerrado')
      .order('created_at', { ascending: true })
      .limit(5),
  ])

  const tickets   = tk.data     ?? []
  const masViejos = viejos.data ?? []

  const stats = {
    abiertos:       tickets.filter(t => t.estado === 'abierto').length,
    en_proceso:     tickets.filter(t => t.estado === 'en_proceso').length,
    esperando:      tickets.filter(t => t.estado === 'esperando_cliente').length,
    cerradosSemana: tickets.filter(t => t.cerrado_at && t.cerrado_at >= desde7d).length,
    soporte:        tickets.filter(t => t.tipo === 'soporte_tecnico' && t.estado !== 'cerrado').length,
    incidente:      tickets.filter(t => t.tipo === 'incidente'        && t.estado !== 'cerrado').length,
    consulta:       tickets.filter(t => t.tipo === 'consulta'         && t.estado !== 'cerrado').length,
    peticion:       tickets.filter(t => t.tipo === 'peticion'         && t.estado !== 'cerrado').length,
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

    <h3 style="color:#dc2626;font-size:15px;margin-bottom:8px">🎫 Tickets por estado</h3>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px;width:100%">
      <tr style="background:#fef2f2"><td>🔴 Abiertos</td><td align="right"><b>${stats.abiertos}</b></td></tr>
      <tr><td>🟡 En proceso</td><td align="right"><b>${stats.en_proceso}</b></td></tr>
      <tr style="background:#eff6ff"><td>🔵 Esperando cliente</td><td align="right"><b>${stats.esperando}</b></td></tr>
      <tr><td>✅ Cerrados últimos 7 días</td><td align="right"><b>${stats.cerradosSemana}</b></td></tr>
    </table>

    <h3 style="color:#0891b2;font-size:15px;margin-top:20px;margin-bottom:8px">🗂 Tickets activos por tipo</h3>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px;width:100%">
      <tr style="background:#ecfdf5"><td>🛠 Soporte</td><td align="right"><b>${stats.soporte}</b></td></tr>
      <tr><td>⚠️ Incidente</td><td align="right"><b>${stats.incidente}</b></td></tr>
      <tr style="background:#fef3c7"><td>💡 Consulta</td><td align="right"><b>${stats.consulta}</b></td></tr>
      <tr><td>🙋 Petición</td><td align="right"><b>${stats.peticion}</b></td></tr>
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

  // 4. Enviar via Brevo HTTP API (BCC para no exponer destinatarios entre sí)
  const fechaCorta = new Date().toLocaleDateString('es-PY', {
    timeZone: 'America/Asuncion',
    day:   '2-digit',
    month: 'short',
  })

  const sender = parseFrom(MAIL_FROM)
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':       BREVO_API_KEY,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify({
      sender,
      to:          [{ email: sender.email }],
      bcc:         emails.map(e => ({ email: e })),
      subject:     `Pulso Desk · Resumen ${fechaCorta}`,
      htmlContent: html,
    }),
  })

  if (!r.ok) {
    return json({ error: 'brevo_send_failed', status: r.status, detail: await r.text() }, 500)
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
