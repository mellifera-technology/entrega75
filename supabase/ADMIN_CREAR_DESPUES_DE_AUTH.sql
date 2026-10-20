-- PASO ADMIN. Antes crear en Supabase > Authentication > Users > Add user:
-- Email: admin@mellifera.local
-- Password: admin
-- Activar "Auto Confirm User".
-- LUEGO ejecutar este SQL (idempotente). ¡Cambiá admin/admin antes de hacer público el sistema!
do $$
declare v_id uuid; v_order_id uuid;
begin
  select id into v_id from auth.users where lower(email)='admin@mellifera.local' order by created_at desc limit 1;
  if v_id is null then raise exception 'Primero crear admin@mellifera.local desde Authentication > Users'; end if;
  insert into public.profiles(id,full_name,email,role,active)
  values(v_id,'Administrador MELLIFERA','admin@mellifera.local','admin',true)
  on conflict(id) do update set role='admin',active=true,full_name='Administrador MELLIFERA';
  insert into public.orders(code,status,claimed_by,claimed_at,customer_note)
  values('MELLIFERA-ADMIN-001','claimed',v_id,now(),'Código reservado para el administrador')
  on conflict(code) do update set status='claimed',claimed_by=v_id,claimed_at=now();
  insert into public.apiaries(owner_id,name)
  select v_id,'Apiario de administración'
  where not exists(select 1 from public.apiaries where owner_id=v_id);
  insert into public.subscriptions(owner_id,status,plan_name)
  values(v_id,'active','Administración') on conflict(owner_id) do nothing;
end $$;
select 'Administrador registrado' as resultado;
