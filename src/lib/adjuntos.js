import { supabase } from './supabase'

// Detecta el tipo de adjunto por su URL y devuelve metadata para el preview
// Tipos soportados: drive, youtube, loom, whatsapp, imgur, foto, link

const COLUMNA_POR_TIPO = {
  ticket:    'ticket_id',
  solicitud: 'solicitud_id',
  orden:     'orden_id',
}

// Inserta múltiples adjuntos vinculados a un registro recién creado.
// items: [{ url, descripcion }]
export async function insertarAdjuntos(tipo, id, items, perfilId) {
  if (!items?.length) return { error: null }
  const columna = COLUMNA_POR_TIPO[tipo]
  if (!columna) return { error: new Error(`Tipo desconocido: ${tipo}`) }
  const payload = items.map(it => ({
    [columna]:   id,
    url:         it.url.trim(),
    descripcion: it.descripcion?.trim() || null,
    creado_por:  perfilId,
  }))
  return supabase.from('pd_adjuntos').insert(payload)
}

export function detectarAdjunto(url) {
  if (!url) return { tipo: 'link', label: 'Link' }
  const u = url.toLowerCase()

  // Google Drive / Google Fotos
  if (u.includes('drive.google.com') || u.includes('photos.google.com') || u.includes('photos.app.goo.gl')) {
    return { tipo: 'drive', label: 'Google Drive', color: 'bg-yellow-100 text-yellow-700', icono: '📁' }
  }
  // YouTube
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return { tipo: 'youtube', label: 'YouTube', color: 'bg-red-100 text-red-700', icono: '▶️', thumbnail: thumbnailYouTube(url) }
  }
  // Loom (grabaciones de pantalla)
  if (u.includes('loom.com')) {
    return { tipo: 'loom', label: 'Loom', color: 'bg-purple-100 text-purple-700', icono: '🎥' }
  }
  // WhatsApp
  if (u.includes('wa.me') || u.includes('whatsapp.com') || u.includes('chat.whatsapp.com')) {
    return { tipo: 'whatsapp', label: 'WhatsApp', color: 'bg-green-100 text-green-700', icono: '💬' }
  }
  // Imgur
  if (u.includes('imgur.com')) {
    return { tipo: 'imgur', label: 'Imgur', color: 'bg-emerald-100 text-emerald-700', icono: '🖼' }
  }
  // Imagen directa
  if (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/.test(u)) {
    return { tipo: 'foto', label: 'Imagen', color: 'bg-blue-100 text-blue-700', icono: '🖼', thumbnail: url }
  }
  // Video directo
  if (/\.(mp4|mov|webm|avi)(\?|$)/.test(u)) {
    return { tipo: 'video', label: 'Video', color: 'bg-indigo-100 text-indigo-700', icono: '🎬' }
  }
  // Dropbox, OneDrive, etc.
  if (u.includes('dropbox.com')) {
    return { tipo: 'dropbox', label: 'Dropbox', color: 'bg-sky-100 text-sky-700', icono: '📦' }
  }
  if (u.includes('onedrive.live') || u.includes('1drv.ms')) {
    return { tipo: 'onedrive', label: 'OneDrive', color: 'bg-blue-100 text-blue-700', icono: '☁️' }
  }
  return { tipo: 'link', label: 'Link', color: 'bg-gray-100 text-gray-700', icono: '🔗' }
}

function thumbnailYouTube(url) {
  // Extraer ID de YouTube para mostrar thumbnail
  const m1 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)
  const m2 = url.match(/v=([a-zA-Z0-9_-]{6,})/)
  const id = m1?.[1] ?? m2?.[1]
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null
}

export function validarUrl(valor) {
  try {
    const u = new URL(valor)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
