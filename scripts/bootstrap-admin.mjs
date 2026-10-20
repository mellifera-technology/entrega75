import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL || 'admin@mellifera.local';
const password = process.env.ADMIN_PASSWORD || 'admin';
const orderCode = (process.env.ADMIN_ORDER_CODE || 'MELLIFERA-ADMIN-001').toUpperCase();

if (!url || !serviceRole) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === targetEmail.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

let user = await findUserByEmail(email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Administrador MELLIFERA' }
  });
  if (error || !data.user) throw error || new Error('No se pudo crear el usuario admin');
  user = data.user;
} else {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
}

const { data: existingProfile } = await supabase.from('profiles').select('public_id').eq('id', user.id).maybeSingle();
const publicId = existingProfile?.public_id || `MEL-ADMIN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
const { error: profileError } = await supabase.from('profiles').upsert({
  id: user.id,
  public_id: publicId,
  full_name: 'Administrador MELLIFERA',
  email,
  role: 'admin',
  active: true
}, { onConflict: 'id' });
if (profileError) throw profileError;

const { data: order, error: orderError } = await supabase.from('orders').upsert({
  code: orderCode,
  status: 'claimed',
  claimed_by: user.id,
  claimed_at: new Date().toISOString(),
  customer_note: 'Pedido reservado para administración'
}, { onConflict: 'code' }).select().single();
if (orderError) throw orderError;

const { data: apiary } = await supabase.from('apiaries').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
if (!apiary) {
  const { error } = await supabase.from('apiaries').insert({ owner_id: user.id, name: 'Apiario Admin' });
  if (error) throw error;
}

console.log('Admin inicializado correctamente');
console.log('Usuario: admin');
console.log('Contraseña: admin');
console.log(`Email interno: ${email}`);
console.log(`Número de pedido admin: ${order.code}`);
console.log('IMPORTANTE: cambiar ADMIN_PASSWORD antes de publicar el sitio.');
