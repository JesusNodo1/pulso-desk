-- =============================================
-- Pulso Desk — Migration Fase 2.7: email_resumen por usuario
-- =============================================
-- Cada usuario tiene un email_resumen (distinto del email de login) al cual
-- llega el reporte semanal de tickets y solicitudes.
--
-- Permisos:
--   - SELECT de pd_usuarios_perfil: cualquier usuario activo ve la lista
--     completa (antes solo veía su propio perfil).
--   - UPDATE directo: sigue restringido a admin (política pd_perfil_admin_all).
--   - Setear email_resumen: cualquier usuario activo, vía función
--     pd_set_email_resumen SECURITY DEFINER (no se puede tocar otra columna).
-- =============================================

-- 1. Columna nueva
ALTER TABLE pd_usuarios_perfil
  ADD COLUMN IF NOT EXISTS email_resumen TEXT;

-- 2. Relajar SELECT — todos los activos ven la lista
DROP POLICY IF EXISTS pd_perfil_self_read ON pd_usuarios_perfil;
CREATE POLICY pd_perfil_read_all ON pd_usuarios_perfil FOR SELECT
  USING (pd_rol_actual() IS NOT NULL);

-- 3. Función para que cualquier usuario activo edite email_resumen de cualquier perfil
CREATE OR REPLACE FUNCTION pd_set_email_resumen(p_id UUID, p_email TEXT)
RETURNS VOID AS $$
DECLARE
  v_email TEXT := NULLIF(TRIM(p_email), '');
BEGIN
  IF pd_rol_actual() IS NULL THEN
    RAISE EXCEPTION 'usuario_no_autorizado';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;
  UPDATE pd_usuarios_perfil
     SET email_resumen = v_email
   WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'perfil_no_encontrado';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION pd_set_email_resumen(UUID, TEXT) TO authenticated;

-- =============================================
-- Rollback:
--   DROP FUNCTION IF EXISTS pd_set_email_resumen(UUID, TEXT);
--   DROP POLICY  IF EXISTS pd_perfil_read_all ON pd_usuarios_perfil;
--   CREATE POLICY pd_perfil_self_read ON pd_usuarios_perfil FOR SELECT
--     USING (auth.uid() = id OR pd_rol_actual() = 'admin');
--   ALTER TABLE  pd_usuarios_perfil DROP COLUMN IF EXISTS email_resumen;
-- =============================================
