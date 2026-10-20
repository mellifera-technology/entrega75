// Supabase Edge Function: mellifera-ingest
// Deploy con Verify JWT = OFF. Se autentica SIEMPRE por headers de dispositivo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-mellifera-mother, x-mellifera-key','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,'Content-Type':'application/json'}});
const url=Deno.env.get('SUPABASE_URL') || '';
const key=Deno.env.get('MELLIFERA_SERVER_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const num=(v:unknown):number|null=> v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const bool=(v:unknown):boolean|null=> v==null||v===''?null:(v===true||v===1||v==='1'||v==='true'?true:v===false||v===0||v==='0'||v==='false'?false:null);
const timePart=(d:Date,tz:string)=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'2-digit',hourCycle:'h23',month:'2-digit'}).formatToParts(d);return Object.fromEntries(p.map(x=>[x.type,x.value]));};
const dew=(t:number|null,h:number|null):number|null=>{if(t===null||h===null||h<=0) return null;const g=Math.log(h/100)+17.625*t/(243.04+t);return 243.04*g/(17.625-g);};
function evaluate(t:number|null,h:number|null,activity:boolean|null,swarm:boolean|null,tilt:boolean|null,season:string,band:string,valid:boolean,history:any[]){
  const dp=dew(t,h);const margin=(dp!==null&&t!==null)?t-dp:null;
  const state=(s:string,title:string|null,msg:string|null)=>({state:s,title,message:msg,dew_point_c:dp,dew_point_margin_c:margin});
  if(!valid||t===null||h===null)return state('white','Datos insuficientes','Medición incompleta o fuera del rango del sensor.');
  if(tilt)return state('red','Inclinación crítica','Revisar físicamente la estabilidad de la colmena.');
  const summer=season==='spring_summer';const low=summer?33:8;const high=summer?36:14;
  if(summer&&t<33&&h>75)return state('red','Temperatura baja y humedad alta','Patrón de riesgo; no constituye diagnóstico sanitario.');
  if(t<low||t>high)return state('red','Temperatura fuera de rango',`Referencia preliminar ${low}–${high} °C; requiere inspección.`);
  if(summer&&(h<55||h>75))return state('red','Humedad fuera de rango','Referencia preliminar 55–75% HR en primavera/verano.');
  const zUnusual=(field:string,val:number|null)=>{
    if(val===null)return false;
    const values=history.map(x=>x[field]).filter((x:unknown)=>typeof x==='number'&&Number.isFinite(x));
    if(values.length<8)return false;
    const mean=values.reduce((a:number,b:number)=>a+b,0)/values.length;
    const variance=values.reduce((a:number,b:number)=>a+(b-mean)**2,0)/(values.length-1);
    return variance>0.00001&&Math.abs((val-mean)/Math.sqrt(variance))>2.5;
  };
  if(zUnusual('temperature_c',t)||zUnusual('humidity_rh',h))return state('yellow','Variación estadística','Cambio inusual frente al historial comparable.');
  if(summer&&(band==='manana'||band==='tarde')&&activity===false)return state('yellow','Poca actividad de piquera','Revisar evolución de actividad y condiciones climáticas.');
  if(summer&&swarm)return state('yellow','Componente acústica contextual','Se reporta energía en la banda asociada a enjambrazón; no es diagnóstico.');
  return state('green',null,null);
}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return response({error:'Método no permitido'},405);
  try{
    if(!url||!key)return response({error:'Clave de servicio no configurada'},503);
    const body=await req.json();
    const uid=String(req.headers.get('x-mellifera-mother')||body.MOTHER_UID||'').trim();
    const api=String(req.headers.get('x-mellifera-key')||'').trim();
    if(!uid||!api)return response({error:'Credenciales de Nodo Madre requeridas'},401);
    const {data:ident,error:authErr}=await db.rpc('mellifera_resolve_mother',{p_uid:uid,p_key:api});
    if(authErr)throw authErr;
    const mother=ident?.[0];if(!mother)return response({error:'Nodo no autorizado o pedido aún sin activar'},401);
    if(body.USER_ID&&body.USER_ID!==mother.client_internal_id)return response({error:'Identidad no autorizada'},403);
    if(body.action==='provision'){
      // Este valor SOLO viaja a la Madre autenticada. El navegador nunca lo recibe.
      return response({ok:true,USER_ID:mother.client_internal_id,apiary_id:mother.apiary_id});
    }
    const readings=Array.isArray(body.measurements)?body.measurements:[body];
    if(!readings.length||readings.length>100)return response({error:'Cantidad de registros inválida (máximo 100)'},400);
    const accepted:any[]=[];const now=Date.now();
    for(const input of readings){
      const mac=String(input.MAC_HIJO||'').trim().toUpperCase().replace(/-/g,':').slice(0,40);
      if(mac.length<5) return response({error:'MAC_HIJO inválida'},400);
      if(input.USER_ID&&input.USER_ID!==mother.client_internal_id)return response({error:'USER_ID no autorizado'},403);
      const event=String(input.EVENT_ID||'').trim().slice(0,120)||null;
      if(event){
        const {data:found,error:fe}=await db.from('telemetry').select('id,andon_state,measured_at').eq('event_uid',event).eq('mother_node_id',mother.mother_id).maybeSingle();
        if(fe)throw fe;
        if(found){accepted.push({id:found.id,MAC_HIJO:mac,state:found.andon_state,duplicate:true});continue;}
      }
      let {data:child,error:ce}=await db.from('child_nodes').select('*').eq('owner_id',mother.owner_id).eq('mac_address',mac).maybeSingle();
      if(ce)throw ce;
      if(!child){
        const {data:newChild,error:ne}=await db.from('child_nodes').insert({owner_id:mother.owner_id,apiary_id:mother.apiary_id,mac_address:mac,display_name:`Colmena ${mac.slice(-5)}`,standard_boxes:1}).select('*').single();
        if(ne){if(ne.code==='23505'){const r=await db.from('child_nodes').select('*').eq('owner_id',mother.owner_id).eq('mac_address',mac).single();child=r.data;if(r.error)throw r.error;}else throw ne;}else child=newChild;
      }
      if(!child.active)continue;
      const seconds=num(input.segundos_atras)??0;
      if(!Number.isInteger(seconds)||seconds<0||seconds>31536000)return response({error:'segundos_atras inválido'},400);
      const measured=new Date(now-seconds*1000);const timezone=mother.timezone||'America/Argentina/Buenos_Aires';
      const parts=timePart(measured,timezone);const month=Number(parts.month),hour=Number(parts.hour);
      const season=(month>=9||month<=2)?'spring_summer':'autumn_winter';
      const band=hour<6?'madrugada':hour<12?'manana':hour<18?'tarde':'noche';
      const t=num(input.DHT11_T),h=num(input.DHT11_H),ac=num(input.MAX4466_E),act=bool(input.TCRT5000_ACT),swarm=bool(input.MAX4466_SWARM_BAND),angle=num(input.MPU6050_DELTA_DEG);
      const tilt=angle!==null&&num(child.critical_tilt_deg)!==null?angle>=Number(child.critical_tilt_deg):bool(input.MPU6050_TILT);
      const valid=input.is_valid!==false&&(t===null||(t>=0&&t<=50))&&(h===null||(h>=20&&h<=90))&&(ac===null||ac>=0);
      const {data:history,error:he}=await db.from('telemetry').select('temperature_c,humidity_rh').eq('child_node_id',child.id).eq('season',season).eq('time_band',band).eq('is_valid',true).lt('measured_at',measured.toISOString()).order('measured_at',{ascending:false}).limit(60);
      if(he)throw he;
      const a=evaluate(t,h,act,swarm,tilt,season,band,valid,history||[]);
      // raw_payload conserva la información recibida EXCEPTO identificadores internos de usuario.
      const redact=(v:unknown,depth=0):unknown=>{
        if(depth>10)return '[profundidad omitida]';
        if(Array.isArray(v))return v.map(x=>redact(x,depth+1));
        if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v as Record<string,unknown>)
          .filter(([k])=>!/^(user_id|public_id|client_internal_id|api_key|secret|service_role)$/i.test(k))
          .map(([k,x])=>[k,redact(x,depth+1)]));
        return v;
      };
      const raw=redact(input);
      const {data:record,error:ie}=await db.from('telemetry').insert({owner_id:mother.owner_id,apiary_id:child.apiary_id,child_node_id:child.id,mother_node_id:mother.mother_id,event_uid:event,
        temperature_c:t,humidity_rh:h,activity_detected:act,acoustic_energy:ac,swarm_band_detected:swarm,tilt_delta_deg:angle,
        tilt_critical_deg:num(child.critical_tilt_deg),tilt_alert:tilt,seconds_ago:seconds,measured_at:measured.toISOString(),
        season,time_band:band,dew_point_c:a.dew_point_c,dew_point_margin_c:a.dew_point_margin_c,is_valid:valid,
        andon_state:a.state,alert_title:a.title,alert_message:a.message,raw_payload:raw}).select('id,andon_state,measured_at').single();
      if(ie){if(ie.code==='23505'&&event){accepted.push({MAC_HIJO:mac,duplicate:true});continue;}throw ie;}
      await db.from('child_nodes').update({last_seen_at:new Date().toISOString()}).eq('id',child.id);
      if(a.state==='red'||a.state==='yellow'){
        const {error:alertErr}=await db.from('alerts').insert({owner_id:mother.owner_id,apiary_id:child.apiary_id,child_node_id:child.id,telemetry_id:record.id,level:a.state==='red'?'critical':'warning',title:a.title||'Advertencia',message:a.message||''});
        if(alertErr)console.error('Could not create alert',alertErr.message);
      }
      accepted.push({id:record.id,MAC_HIJO:mac,state:a.state,measured_at:record.measured_at});
    }
    await db.from('mother_nodes').update({last_seen_at:new Date().toISOString()}).eq('id',mother.mother_id);
    return response({ok:true,accepted,count:accepted.length});
  }catch(e){console.error('Ingest error',e);return response({error:'Error al procesar el registro. Revisá los logs de Edge Functions.'},500);}
});
