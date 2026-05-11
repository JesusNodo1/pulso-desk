-- =============================================
-- Pulso Desk — Migration Fase 2.5: adjuntos para solicitudes
-- Ejecutar en: Supabase > SQL Editor (después de migration-fase2.4-adjuntos.sql)
-- Idempotente.
-- =============================================

-- 1. Agregar columna solicitud_id (nullable, FK)
ALTER TABLE pd_adjuntos
  ADD COLUMN IF NOT EXISTS solicitud_id UUID REFERENCES pd_solicitudes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pd_adjuntos_solicitud ON pd_adjuntos(solicitud_id);

-- 2. Reemplazar el CHECK constraint para aceptar solicitud_id
ALTER TABLE pd_adjuntos DROP CONSTRAINT IF EXISTS adjunto_pertenece_a_uno;

ALTER TABLE pd_adjuntos ADD CONSTRAINT adjunto_pertenece_a_uno CHECK (
  (ticket_id IS NOT NULL AND orden_id IS NULL     AND solicitud_id IS NULL) OR
  (ticket_id IS NULL     AND orden_id IS NOT NULL AND solicitud_id IS NULL) OR
  (ticket_id IS NULL     AND orden_id IS NULL     AND solicitud_id IS NOT NULL)
);

-- RLS — las policies existentes de pd_adjuntos cubren este caso:
-- read/insert para admin/desarrollador/soporte; delete para creador o admin.
-- No hace falta tocarlas.
