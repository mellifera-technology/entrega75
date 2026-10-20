// Supabase Edge Function: mellifera-auth
// Deploy con Verify JWT = OFF. Autorización de claim verificada con auth.getUser(token).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers:{...cors,'Content-Type':'application/json'}});
const url = Deno.env.get('SUPABASE_URL') || '';
const key = Deno.env.get('MELLIFERA_SERVER_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supa = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, {headers:cors});
  if (req.method !== 'POST') return reply({error:'Método no permitido'},405);
  try {
    if (!url || !key) return reply({error:'Falta configurar la clave privada de la función.'},503);
    const body = await req.json();
    const action = String(body.action || '');
    const order = String(body.order || '').trim().toUpperCase().slice(0,100);
    if (!['check','claim'].includes(action) || !order) return reply({error:'Código de pedido requerido.'},400);
    if (action === 'check') {
      const {data,error} = await supa.from('orders').select('id').eq('code',order).eq('status','available').maybeSingle();
      if(error) throw error;
      return reply({available:!!data});
    }
    // Nunca se acepta un UID de usuario del cliente: se extrae del JWT comprobado.
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'');
    if (!token) return reply({error:'Iniciá sesión y verificá el correo antes de activar tu pedido.'},401);
    const {data:verified,error:authErr} = await supa.auth.getUser(token);
    if(authErr || !verified.user) return reply({error:'Sesión inválida.'},401);
    const user = verified.user;
    if(!user.email_confirmed_at) return reply({error:'Confirmá tu correo antes de activar el pedido.'},403);
    const {data:existing,error:existsErr}=await supa.from('profiles').select('id').eq('id',user.id).maybeSingle();
    if(existsErr) throw existsErr;
    if(existing) return reply({ok:true,already:true});
    const safeName=String(body.name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Apicultor').trim().slice(0,100);
    const {error:claimErr}=await supa.rpc('claim_order_for_user',{p_order_code:order,p_user_id:user.id,p_full_name:safeName,p_email:user.email||''});
    if(claimErr) {
      if(/ORDER_NOT_AVAILABLE/i.test(claimErr.message)) return reply({error:'Este pedido no existe o ya fue utilizado.'},409);
      throw claimErr;
    }
    // Nunca devolver public_id ni ninguna credencial de dispositivo al navegador.
    return reply({ok:true});
  }catch(err){
    console.error('mellifera-auth error',err);
    return reply({error:'No se pudo completar la operación. Revisá la configuración o intentá nuevamente.'},500);
  }
});
