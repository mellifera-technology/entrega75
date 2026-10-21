-- MELLIFERA / CORRECCIÓN DE ALTA EN GITHUB PAGES
-- Ejecutar COMPLETO desde Supabase > SQL Editor, proyecto original.
-- ADITIVO Y REEJECUTABLE: no elimina usuarios, pedidos, nodos ni mediciones.
-- Requiere las tablas y claim_order_for_user() del SQL original.

-- El visitante solo recibe verdadero/falso sobre un pedido disponible.
-- No puede leer directamente la tabla orders gracias a RLS.
create or replace function public.mellifera_order_available(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.code = upper(trim(p_code))
      and o.status = 'available'
  );
$$;
revoke all on function public.mellifera_order_available(text) from public, anon, authenticated;
grant execute on function public.mellifera_order_available(text) to anon, authenticated;

-- Reclamo desde usuario AUTENTICADO; jamás acepta un ID introducido por la web.
-- Solo cuenta confirmada por correo/Google y un pedido disponible de un solo uso.
create or replace function public.mellifera_claim_my_order(p_order_code text, p_full_name text default '')
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_existing boolean;
begin
  if auth.role() <> 'authenticated' or v_user is null then
    raise exception 'Iniciá sesión para activar un pedido.';
  end if;
  select u.email, u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_user;
  if not found or v_email is null or v_confirmed is null then
    raise exception 'Confirmá el correo electrónico antes de activar el pedido.';
  end if;
  select exists(select 1 from public.profiles p where p.id=v_user) into v_existing;
  if v_existing then
    raise exception 'Tu usuario ya está activado. Iniciá sesión normalmente.';
  end if;
  if p_order_code is null or trim(p_order_code)='' then
    raise exception 'Ingresá el número de pedido.';
  end if;
  -- La función original bloquea el pedido durante la transacción y devuelve un ID
  -- privado; no se reenvía en el resultado de esta función.
  perform public.claim_order_for_user(
    upper(trim(p_order_code)),
    v_user,
    left(coalesce(nullif(trim(p_full_name),''), split_part(v_email,'@',1)),100),
    v_email
  );
  return true;
exception
  when others then
    if sqlerrm='ORDER_NOT_AVAILABLE' then
      raise exception 'Ese pedido no existe o ya fue utilizado.';
    end if;
    raise;
end;
$$;
revoke all on function public.mellifera_claim_my_order(text,text) from public, anon, authenticated;
grant execute on function public.mellifera_claim_my_order(text,text) to authenticated;

-- Comprobación visible al terminar: debería devolver true si el pedido 123
-- sigue disponible. Si dice false, consultá la segunda consulta.
select public.mellifera_order_available('123') as pedido_123_disponible;
select code,status,claimed_at from public.orders where code='123';
