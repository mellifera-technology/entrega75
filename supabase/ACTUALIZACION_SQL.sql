-- MELLIFERA TECHNOLOGY | Migracion para Github Pages
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor, DESPUES de tus 3 pasos exitosos.
-- NO elimina tablas ni mediciones anteriores. Se puede volver a ejecutar.
create extension if not exists pgcrypto;

-- Protege el identificador interno del usuario y hashes de claves de dispositivos:
-- RLS controla filas, pero NO oculta columnas. Estos datos se consultan SOLO por RPC segura.
revoke select on public.profiles from anon, authenticated;
revoke select on public.mother_nodes from anon, authenticated;

-- Perfil cliente sin IDs secretos ni hashes; ADMIN usa funciones privadas para consultar IDs.
create or replace function public.mellifera_me()
returns table(full_name text, email text, role text, active boolean, created_at timestamptz)
language sql stable security definer set search_path=public
as $$
  select p.full_name, p.email, p.role::text, p.active, p.created_at
  from public.profiles p where p.id=auth.uid();
$$;
revoke all on function public.mellifera_me() from public;
grant execute on function public.mellifera_me() to authenticated;

-- Listado administrativo: solo administradores pueden ver IDs internos.
create or replace function public.mellifera_admin_users()
returns table(id uuid, public_id text, full_name text, email text, role text, active boolean, created_at timestamptz, order_code text, mother_uid text)
language plpgsql stable security definer set search_path=public
as $$ begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  return query
  select p.id,p.public_id,p.full_name,p.email,p.role::text,p.active,p.created_at,
    (select o.code from public.orders o where o.claimed_by=p.id order by o.claimed_at desc limit 1),
    (select m.mother_uid from public.mother_nodes m where m.owner_id=p.id order by m.created_at desc limit 1)
  from public.profiles p order by p.created_at desc;
end $$;
revoke all on function public.mellifera_admin_users() from public;
grant execute on function public.mellifera_admin_users() to authenticated;

-- Pedido + Nodo Madre, con secreto de dispositivo entregado UNA SOLA VEZ al ADMIN.
create or replace function public.mellifera_create_order(p_note text default null)
returns table(order_code text, mother_uid text, device_key text)
language plpgsql security definer set search_path=public
as $$
declare v_order text; v_mother text; v_key text; v_orderid uuid;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  v_order:='MEL-ORD-'||upper(encode(gen_random_bytes(8),'hex'));
  v_mother:='MOTHER-'||upper(encode(gen_random_bytes(8),'hex'));
  v_key:=encode(gen_random_bytes(32),'hex');
  insert into public.orders(code,customer_note) values(v_order,p_note) returning id into v_orderid;
  insert into public.mother_nodes(order_id,mother_uid,api_key_hash) values(v_orderid,v_mother,encode(digest(v_key,'sha256'),'hex'));
  return query select v_order,v_mother,v_key;
end $$;
revoke all on function public.mellifera_create_order(text) from public;
grant execute on function public.mellifera_create_order(text) to authenticated;

-- Admin ve pedidos, Nodos Madre y estado, sin exponer el hash ni la clave.
create or replace function public.mellifera_admin_orders()
returns table(id uuid, code text, status text, customer_note text, claimed_at timestamptz, created_at timestamptz, mother_uid text, last_seen_at timestamptz, customer_email text)
language plpgsql stable security definer set search_path=public
as $$ begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  return query select o.id,o.code,o.status::text,o.customer_note,o.claimed_at,o.created_at,m.mother_uid,m.last_seen_at,p.email
  from public.orders o left join public.mother_nodes m on m.order_id=o.id
    left join public.profiles p on p.id=o.claimed_by order by o.created_at desc;
end $$;
revoke all on function public.mellifera_admin_orders() from public;
grant execute on function public.mellifera_admin_orders() to authenticated;

-- Actualizar nombre y localidad solo por su dueño/admin; evita modificación de owner_id.
create or replace function public.mellifera_save_apiary(p_id uuid, p_name text, p_location text, p_total integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.apiaries a where a.id=p_id and (a.owner_id=auth.uid() or public.is_admin())) then
    raise exception 'Apiario no autorizado'; end if;
  update public.apiaries set name=left(coalesce(nullif(trim(p_name),''),'Apiario'),100),
    location_text=left(coalesce(p_location,''),200),total_hives=greatest(p_total,1) where id=p_id;
end $$;
revoke all on function public.mellifera_save_apiary(uuid,text,text,integer) from public;
grant execute on function public.mellifera_save_apiary(uuid,text,text,integer) to authenticated;

-- Guardar ajustes de colmena evitando cambios en las columnas de propiedad y MAC.
create or replace function public.mellifera_save_hive(p_id uuid,p_name text,p_standard integer,p_quarter integer,p_half integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.child_nodes c where c.id=p_id and (c.owner_id=auth.uid() or public.is_admin())) then
    raise exception 'Colmena no autorizada'; end if;
  update public.child_nodes set display_name=left(coalesce(nullif(trim(p_name),''),'Colmena'),100),
    standard_boxes=greatest(p_standard,0),three_quarter_boxes=greatest(p_quarter,0),half_boxes=greatest(p_half,0)
  where id=p_id;
end $$;
revoke all on function public.mellifera_save_hive(uuid,text,integer,integer,integer) from public;
grant execute on function public.mellifera_save_hive(uuid,text,integer,integer,integer) to authenticated;

-- Contabilidad atómica: 50% igualitaria + 50% según fondos adelantados;
-- cada ingreso queda documentado con la distribución calculada.
create or replace function public.mellifera_record_entry(p_type text,p_amount numeric,p_description text,p_partner_code text default null,p_date date default current_date)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_entry uuid; v_partner uuid; v_chiara uuid; v_lucas uuid; v_bchi numeric:=0; v_blu numeric:=0;
  v_w numeric:=0.5; v_pct numeric; v_chiara_amount numeric;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if p_type not in ('contribution','expense','reimbursement','income') or p_amount is null or p_amount<=0 then
    raise exception 'Tipo o monto inválido'; end if;
  if p_type<>'income' then
    select id into v_partner from public.accounting_partners where code=upper(p_partner_code) and active;
    if v_partner is null then raise exception 'Elegí a Chiara o Lucas'; end if;
  end if;
  insert into public.accounting_entries(entry_type,payer_partner_id,amount,description,entry_date,created_by)
  values(p_type::public.accounting_entry_type,v_partner,p_amount,left(trim(p_description),500),coalesce(p_date,current_date),auth.uid()) returning id into v_entry;
  if p_type='income' then
    select id into v_chiara from public.accounting_partners where code='CHIARA';
    select id into v_lucas from public.accounting_partners where code='LUCAS';
    select coalesce(sum(case when p.code='CHIARA' then case when e.entry_type='reimbursement' then -e.amount else e.amount end end),0),
           coalesce(sum(case when p.code='LUCAS' then case when e.entry_type='reimbursement' then -e.amount else e.amount end end),0)
      into v_bchi,v_blu
    from public.accounting_entries e join public.accounting_partners p on p.id=e.payer_partner_id
    where e.entry_type in ('contribution','expense','reimbursement') and e.entry_date<=coalesce(p_date,current_date);
    v_bchi:=greatest(v_bchi,0); v_blu:=greatest(v_blu,0);
    select greatest(0,least(1,(value::text)::numeric)) into v_w from public.app_settings where key='accounting_income_weight';
    v_w:=coalesce(v_w,0.5);
    v_pct:=case when v_bchi+v_blu>0 then (1-v_w)/2+v_w*v_bchi/(v_bchi+v_blu) else 0.5 end;
    v_chiara_amount:=round(p_amount*v_pct,2);
    insert into public.income_allocations(income_entry_id,partner_id,share_percent,allocated_amount)
    values(v_entry,v_chiara,round(v_pct*100,5),v_chiara_amount),
          (v_entry,v_lucas,round((1-v_pct)*100,5),p_amount-v_chiara_amount);
  end if;
  return v_entry;
end $$;
revoke all on function public.mellifera_record_entry(text,numeric,text,text,date) from public;
grant execute on function public.mellifera_record_entry(text,numeric,text,text,date) to authenticated;

-- Para Edge Functions: autenticación del Nodo Madre mediante hash, NO mediante ID de usuario.
create or replace function public.mellifera_resolve_mother(p_uid text,p_key text)
returns table(mother_id uuid,owner_id uuid,apiary_id uuid,client_internal_id text,timezone text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'No autorizado'; end if;
  return query
  select m.id,m.owner_id,a.id,p.public_id,a.timezone from public.mother_nodes m
  join public.profiles p on p.id=m.owner_id and p.active=true
  join public.apiaries a on a.owner_id=p.id
  where m.mother_uid=p_uid and m.api_key_hash=encode(digest(p_key,'sha256'),'hex') and m.active=true
  order by a.created_at asc limit 1;
end $$;
revoke all on function public.mellifera_resolve_mother(text,text) from public,anon,authenticated;
grant execute on function public.mellifera_resolve_mother(text,text) to service_role;

-- Cierra el acceso de edición directa a IDs propietarios. Se usan las RPC seguras anteriores.
revoke update on public.apiaries,public.child_nodes,public.alerts from authenticated;
grant update(acknowledged_at) on public.alerts to authenticated;
-- Recomendación: activar en Authentication > Providers > Email la confirmación por correo.

-- Elimina identificadores secretos de RAW históricos si se recibieron desde el backend anterior.
update public.telemetry
set raw_payload=raw_payload - 'USER_ID' - 'user_id' - 'public_id' - 'client_internal_id' - 'API_KEY' - 'api_key'
where raw_payload ?| array['USER_ID','user_id','public_id','client_internal_id','API_KEY','api_key'];
