import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { evaluateAndon } from '@/lib/andon';
import { sha256 } from '@/lib/crypto';
import { getSeason, getTimeBand, DEFAULT_TIMEZONE } from '@/lib/time';
import { calculateTiltGeometry } from '@/lib/tilt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const numeric = z.preprocess((value) => {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().nullable());

const booleanish = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return value;
}, z.boolean().nullable());

const measurementSchema = z.object({
  USER_ID: z.string().trim().min(3).optional(),
  EVENT_ID: z.string().trim().min(8).max(120).optional(),
  MAC_HIJO: z.string().trim().min(5).max(40),
  DHT11_T: numeric,
  DHT11_H: numeric,
  TCRT5000_ACT: booleanish,
  MAX4466_E: numeric,
  MAX4466_SWARM_BAND: booleanish.optional(),
  MPU6050_DELTA_DEG: numeric.optional(),
  MPU6050_TILT: booleanish,
  segundos_atras: z.coerce.number().int().min(0).max(365 * 24 * 60 * 60).default(0),
  is_valid: z.boolean().optional().default(true)
}).passthrough();

const payloadSchema = z.object({
  MOTHER_UID: z.string().trim().min(3).optional(),
  USER_ID: z.string().trim().min(3).optional(),
  measurements: z.array(measurementSchema).min(1).max(500).optional()
}).passthrough();

function isSensorDataValid(temperature: number | null, humidity: number | null, acoustic: number | null) {
  // DHT11: el proyecto valida las mediciones antes de usarlas. Estos límites protegen
  // la plataforma frente a valores instrumentalmente incompatibles con el componente.
  if (temperature !== null && (temperature < 0 || temperature > 50)) return false;
  if (humidity !== null && (humidity < 20 || humidity > 90)) return false;
  if (acoustic !== null && acoustic < 0) return false;
  return true;
}

function normalizeMac(value: string) {
  return value.trim().toUpperCase().replace(/-/g, ':');
}

async function authorizeMother(motherUid: string, apiKey: string) {
  const admin = createAdminSupabaseClient();
  const { data: mother, error } = await admin
    .from('mother_nodes')
    .select('id, owner_id, mother_uid, api_key_hash, active, order_id')
    .eq('mother_uid', motherUid)
    .maybeSingle();

  if (error) throw error;
  if (!mother || !mother.active || !mother.owner_id) return { admin, mother: null };
  if (sha256(apiKey) !== mother.api_key_hash) return { admin, mother: null };
  return { admin, mother };
}

export async function POST(request: Request) {
  try {
    const bodyRaw = await request.json();
    const envelope = payloadSchema.parse(bodyRaw);
    const motherUid = envelope.MOTHER_UID || request.headers.get('x-mellifera-mother') || '';
    const apiKey = request.headers.get('x-mellifera-key') || '';

    if (!motherUid || !apiKey) {
      return NextResponse.json({ error: 'Faltan credenciales del Nodo Madre.' }, { status: 401 });
    }

    const { admin, mother } = await authorizeMother(motherUid, apiKey);
    if (!mother) {
      return NextResponse.json({ error: 'Nodo Madre no autorizado o pedido aún no activado.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, public_id, active')
      .eq('id', mother.owner_id)
      .single();
    if (profileError || !profile?.active) {
      return NextResponse.json({ error: 'La cuenta asociada al Nodo Madre no está activa.' }, { status: 403 });
    }

    const canonicalUserId = profile.public_id as string;
    const outerUserId = envelope.USER_ID;
    if (outerUserId && outerUserId !== canonicalUserId) {
      return NextResponse.json({ error: 'USER_ID no coincide con el usuario asignado al Nodo Madre.' }, { status: 403 });
    }

    let readings: z.infer<typeof measurementSchema>[];
    if (envelope.measurements) {
      readings = envelope.measurements;
    } else {
      readings = [measurementSchema.parse(bodyRaw)];
    }

    const { data: apiary, error: apiaryError } = await admin
      .from('apiaries')
      .select('id, timezone')
      .eq('owner_id', mother.owner_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (apiaryError) throw apiaryError;
    if (!apiary) {
      return NextResponse.json({ error: 'El usuario no tiene un apiario configurado.' }, { status: 409 });
    }

    const timeZone = apiary.timezone || DEFAULT_TIMEZONE;
    const now = new Date();
    const accepted: Array<{ id: number; MAC_HIJO: string; state: string; measured_at: string }> = [];

    for (const reading of readings) {
      const readingUserId = reading.USER_ID || outerUserId;
      if (readingUserId && readingUserId !== canonicalUserId) {
        return NextResponse.json({ error: `USER_ID inválido para ${reading.MAC_HIJO}.` }, { status: 403 });
      }

      const mac = normalizeMac(reading.MAC_HIJO);
      const eventUid = reading.EVENT_ID?.trim() || null;

      // La Madre conserva EVENT_ID dentro de LittleFS. Si una respuesta HTTP se pierde y
      // vuelve a enviar el mismo registro, devolvemos éxito sin duplicar mediciones/alertas.
      if (eventUid) {
        const { data: existingEvent, error: existingEventError } = await admin
          .from('telemetry')
          .select('id,andon_state,measured_at')
          .eq('mother_node_id', mother.id)
          .eq('event_uid', eventUid)
          .maybeSingle();
        if (existingEventError) throw existingEventError;
        if (existingEvent) {
          accepted.push({
            id: existingEvent.id,
            MAC_HIJO: mac,
            state: existingEvent.andon_state,
            measured_at: existingEvent.measured_at
          });
          continue;
        }
      }

      let { data: child, error: childError } = await admin
        .from('child_nodes')
        .select('id, display_name, active, standard_boxes, three_quarter_boxes, half_boxes, critical_tilt_deg')
        .eq('owner_id', mother.owner_id)
        .eq('mac_address', mac)
        .maybeSingle();
      if (childError) throw childError;

      if (!child) {
        const { data: created, error: createError } = await admin
          .from('child_nodes')
          .insert({
            owner_id: mother.owner_id,
            apiary_id: apiary.id,
            mac_address: mac,
            display_name: `Colmena ${mac.slice(-5).replace(':', '')}`,
            estimated_height_cm: calculateTiltGeometry({ standardBoxes: 1, threeQuarterBoxes: 0, halfBoxes: 0 }).heightCm,
            critical_tilt_deg: calculateTiltGeometry({ standardBoxes: 1, threeQuarterBoxes: 0, halfBoxes: 0 }).criticalDeg
          })
          .select('id, display_name, active, standard_boxes, three_quarter_boxes, half_boxes, critical_tilt_deg')
          .single();
        if (createError) throw createError;
        child = created;
      }

      if (!child.active) continue;

      const measuredAt = new Date(now.getTime() - reading.segundos_atras * 1000);
      const season = getSeason(measuredAt, timeZone);
      const timeBand = getTimeBand(measuredAt, timeZone);
      const valid = reading.is_valid && isSensorDataValid(reading.DHT11_T, reading.DHT11_H, reading.MAX4466_E);

      const { data: history, error: historyError } = await admin
        .from('telemetry')
        .select('temperature_c,humidity_rh,acoustic_energy,dew_point_margin_c')
        .eq('child_node_id', child.id)
        .eq('season', season)
        .eq('time_band', timeBand)
        .eq('is_valid', true)
        .lt('measured_at', measuredAt.toISOString())
        .order('measured_at', { ascending: false })
        .limit(60);
      if (historyError) throw historyError;

      const geometry = calculateTiltGeometry({
        standardBoxes: child.standard_boxes ?? 1,
        threeQuarterBoxes: child.three_quarter_boxes ?? 0,
        halfBoxes: child.half_boxes ?? 0
      });
      const criticalTilt = Number(child.critical_tilt_deg ?? geometry.criticalDeg) || null;
      const tiltFromAngle = reading.MPU6050_DELTA_DEG !== null && reading.MPU6050_DELTA_DEG !== undefined && criticalTilt !== null
        ? reading.MPU6050_DELTA_DEG >= criticalTilt
        : null;
      const effectiveTilt = tiltFromAngle ?? reading.MPU6050_TILT;

      const result = evaluateAndon({
        temperature: reading.DHT11_T,
        humidity: reading.DHT11_H,
        activity: reading.TCRT5000_ACT,
        acousticEnergy: reading.MAX4466_E,
        swarmBandDetected: reading.MAX4466_SWARM_BAND ?? null,
        tilt: effectiveTilt,
        season,
        timeBand,
        valid
      }, history || []);

      const canonicalRawPayload = {
        ...reading,
        USER_ID: canonicalUserId,
        MOTHER_UID: mother.mother_uid
      };

      const { data: inserted, error: insertError } = await admin
        .from('telemetry')
        .insert({
          owner_id: mother.owner_id,
          apiary_id: apiary.id,
          child_node_id: child.id,
          mother_node_id: mother.id,
          event_uid: eventUid,
          temperature_c: reading.DHT11_T,
          humidity_rh: reading.DHT11_H,
          activity_detected: reading.TCRT5000_ACT,
          acoustic_energy: reading.MAX4466_E,
          swarm_band_detected: reading.MAX4466_SWARM_BAND ?? null,
          tilt_delta_deg: reading.MPU6050_DELTA_DEG ?? null,
          tilt_critical_deg: criticalTilt,
          tilt_alert: effectiveTilt,
          seconds_ago: reading.segundos_atras,
          measured_at: measuredAt.toISOString(),
          received_at: now.toISOString(),
          season,
          time_band: timeBand,
          dew_point_c: result.dewPointC,
          dew_point_margin_c: result.dewPointMarginC,
          is_valid: valid,
          andon_state: result.state,
          alert_title: result.title,
          alert_message: result.message,
          raw_payload: canonicalRawPayload
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      if (result.state === 'yellow' || result.state === 'red') {
        const { error: alertError } = await admin.from('alerts').insert({
          owner_id: mother.owner_id,
          apiary_id: apiary.id,
          child_node_id: child.id,
          telemetry_id: inserted.id,
          level: result.state === 'red' ? 'critical' : 'warning',
          title: result.title || (result.state === 'red' ? 'Requiere inspección' : 'Requiere seguimiento'),
          message: result.message || 'Se detectó una condición que requiere revisión.'
        });
        if (alertError) throw alertError;
      }

      await admin.from('child_nodes').update({ last_seen_at: now.toISOString() }).eq('id', child.id);
      accepted.push({ id: inserted.id, MAC_HIJO: mac, state: result.state, measured_at: measuredAt.toISOString() });
    }

    await admin.from('mother_nodes').update({ last_seen_at: now.toISOString() }).eq('id', mother.id);

    return NextResponse.json({
      ok: true,
      USER_ID: canonicalUserId,
      received: accepted.length,
      measurements: accepted
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Paquete inválido.', detail: error.flatten() }, { status: 400 });
    }
    console.error('telemetry ingest error', error);
    return NextResponse.json({ error: 'No se pudo procesar la telemetría.' }, { status: 500 });
  }
}
