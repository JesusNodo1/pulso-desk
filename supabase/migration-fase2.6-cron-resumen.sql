-- =============================================
-- Pulso Desk — Migration Fase 2.6: cron de resumen por email
-- =============================================
-- Programa una llamada a la Edge Function "notificar-resumen" todos los
-- lunes y viernes a las 9 AM hora Paraguay.
--
-- IMPORTANTE — Antes de correr esto:
--   1. Deployar la Edge Function:        supabase functions deploy notificar-resumen
--   2. Configurar secrets de la function: RESEND_API_KEY, RESEND_FROM, CRON_SECRET
--   3. Reemplazar PEGAR-CRON-SECRET-ACA abajo por el mismo valor que pusiste
--      en el secret CRON_SECRET de la function.
--   4. Si la Edge Function tiene "Verify JWT" activado, desactivarlo en
--      Dashboard > Edge Functions > notificar-resumen > Details. La auth
--      se hace con CRON_SECRET en lugar del JWT.
-- =============================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Limpiar job anterior si existe (idempotente)
SELECT cron.unschedule('notificar-resumen') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notificar-resumen'
);

-- 3. Schedule
-- pg_cron interpreta el cron string en UTC. Paraguay tiene DST:
--   - Verano (Oct–Mar): UTC-3 → 9 AM PY = 12:00 UTC
--   - Invierno (Mar–Oct): UTC-4 → 9 AM PY = 13:00 UTC
--
-- Usamos la opción más limpia: definir DOS schedules — uno para cada estación
-- — y filtrar por mes para que solo dispare uno por vez. Así nos olvidamos
-- de actualizar la migration cuando cambia el horario.
--
-- Alternativa más simple (sin DST): usar Supabase Dashboard > Database > Cron
-- que tiene selector de timezone. Crear el job ahí con TZ "America/Asuncion"
-- y borrar este SQL.

-- Invierno PY (Abril a Septiembre): 9 AM = 13:00 UTC
SELECT cron.schedule(
  'notificar-resumen-invierno',
  '0 13 * * 1,5',
  $$
  SELECT net.http_post(
    url     := 'https://bziztkhunfvwetnlczbj.supabase.co/functions/v1/notificar-resumen',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer PEGAR-CRON-SECRET-ACA"}'::jsonb,
    body    := '{}'::jsonb
  )
  WHERE EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'America/Asuncion')) BETWEEN 4 AND 9;
  $$
);

-- Verano PY (Octubre a Marzo): 9 AM = 12:00 UTC
SELECT cron.schedule(
  'notificar-resumen-verano',
  '0 12 * * 1,5',
  $$
  SELECT net.http_post(
    url     := 'https://bziztkhunfvwetnlczbj.supabase.co/functions/v1/notificar-resumen',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer PEGAR-CRON-SECRET-ACA"}'::jsonb,
    body    := '{}'::jsonb
  )
  WHERE EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'America/Asuncion')) IN (1,2,3,10,11,12);
  $$
);

-- 4. Verificar que se programó
-- SELECT * FROM cron.job;

-- =============================================
-- Para borrar los jobs (rollback):
--   SELECT cron.unschedule('notificar-resumen-invierno');
--   SELECT cron.unschedule('notificar-resumen-verano');
-- =============================================
