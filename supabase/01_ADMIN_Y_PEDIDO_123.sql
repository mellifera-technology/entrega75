-- MELLIFERA | EJECUTAR EN SQL EDITOR DESPUÉS DE ACTUALIZACION_SQL.sql
-- ADMIN: requiere primero crear el usuario admin@mellifera.local en
-- Authentication > Users > Add user, con contraseña admin y Auto Confirm ON.
-- NOTA: no se puede insertar un usuario Auth válido mediante un simple INSERT a profiles.
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email)='admin@mellifera.local' LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'ADMIN AÚN NO CREADO: primero crear admin@mellifera.local desde Authentication > Users > Add user';
  ELSE
    INSERT INTO public.profiles(id,full_name,email,role,active)
    VALUES(v_uid,'Administrador MELLIFERA','admin@mellifera.local','admin',true)
    ON CONFLICT (id) DO UPDATE SET role='admin',active=true,full_name='Administrador MELLIFERA';
    INSERT INTO public.orders(code,status,claimed_by,claimed_at,customer_note)
    VALUES('MELLIFERA-ADMIN-001','claimed',v_uid,now(),'Cuenta de administración')
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO public.apiaries(owner_id,name)
    SELECT v_uid,'Apiario de administración'
    WHERE NOT EXISTS (SELECT 1 FROM public.apiaries WHERE owner_id=v_uid);
    INSERT INTO public.subscriptions(owner_id,status,plan_name)
    VALUES(v_uid,'active','Administración') ON CONFLICT(owner_id) DO NOTHING;
    RAISE NOTICE 'ADMIN CONFIGURADO. Entrar desde la web con admin / admin';
  END IF;
END $$;

-- PEDIDO DE PRUEBA '123' Y DISPOSITIVO MADRE:
-- El código 123 se reclama UNA VEZ al registrar el usuario X.
-- Ejecutar una sola vez; la segunda ejecución devuelve 0 filas (no genera otra clave).
WITH pedido AS (
  INSERT INTO public.orders(code,status,customer_note)
  VALUES('123','available','Pedido de prueba: usuario X')
  ON CONFLICT (code) DO NOTHING
  RETURNING id
), credencial AS (
  SELECT id AS order_id, 'MOTHER-TEST-123'::text AS mother_uid,
         encode(gen_random_bytes(32),'hex') AS device_key FROM pedido
), madre AS (
  INSERT INTO public.mother_nodes(order_id,mother_uid,api_key_hash,active)
  SELECT order_id,mother_uid,encode(digest(device_key,'sha256'),'hex'),true FROM credencial
  ON CONFLICT DO NOTHING
  RETURNING order_id,mother_uid
)
SELECT '123' AS numero_pedido, madre.mother_uid AS mother_uid,
       credencial.device_key AS device_key_guarda_ahora
FROM madre JOIN credencial USING (order_id);
-- ¡GUARDAR DEVICE_KEY! Solamente aparece la primera vez; se guarda el HASH.
-- Si el pedido 123 ya existía, consultar estado con:
-- SELECT code,status,claimed_at FROM public.orders WHERE code='123';
