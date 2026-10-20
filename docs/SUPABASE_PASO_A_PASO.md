# Supabase — puesta en marcha paso a paso

Esta guía parte de un proyecto Supabase vacío. No ejecutar el SQL MySQL del notebook original.

## 1. Crear el proyecto

1. Entrar a Supabase y crear un proyecto nuevo.
2. Elegir una contraseña fuerte para PostgreSQL y guardarla fuera del repositorio.
3. Esperar a que el proyecto termine de provisionarse.

## 2. Crear el esquema MELLIFERA

1. Abrir **SQL Editor**.
2. Crear una consulta nueva.
3. Copiar **completo** `supabase/schema.sql`.
4. Ejecutarlo una sola vez sobre el proyecto vacío.
5. En **Table Editor** verificar que existan, entre otras: `profiles`, `orders`, `apiaries`, `mother_nodes`, `child_nodes`, `telemetry`, `alerts`, `subscriptions`, `accounting_partners`, `accounting_entries` e `income_allocations`.

El esquema activa RLS. No desactivar Row Level Security para “hacerlo funcionar”: las rutas de servidor que necesitan privilegios usan `SUPABASE_SERVICE_ROLE_KEY` y los usuarios normales quedan limitados por propietario.

## 3. Copiar las claves al proyecto web

En Supabase, abrir **Project Settings > API** y obtener:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY`

Crear `.env.local` a partir de `.env.example`.

La `service_role` es secreta. Nunca debe estar en código del navegador, firmware, GitHub ni una variable que empiece con `NEXT_PUBLIC_`.

## 4. Configurar correo + contraseña

Supabase Auth ya soporta email/password. Este proyecto crea la cuenta desde el backend después de validar el número de pedido y la deja confirmada; el pedido se reclama dentro de una transacción PostgreSQL con bloqueo de fila.

## 5. Configurar Google

1. En Google Cloud crear/configurar credenciales OAuth Web.
2. En **Authorized redirect URIs** de Google usar exactamente la URL de callback de Supabase:
   `https://TU-PROYECTO.supabase.co/auth/v1/callback`
3. En Supabase abrir **Authentication > Providers > Google** y pegar Client ID + Client Secret.
4. En **Authentication > URL Configuration** definir el Site URL de la web.
5. Agregar a Redirect URLs:
   - desarrollo: `http://localhost:3000/auth/callback`
   - producción: `https://TU-DOMINIO/auth/callback`

El alta con Google también exige primero un pedido válido. Una vez creada la cuenta, el login normal con Google no vuelve a pedir el número de pedido.

## 6. Inicializar el administrador

Con Node instalado:

```bash
npm install
npm run bootstrap:admin
```

Credenciales iniciales de desarrollo:

```text
Usuario: admin
Contraseña: admin
Pedido reservado: MELLIFERA-ADMIN-001
```

Antes de publicar, modificar `ADMIN_PASSWORD` en el entorno y volver a ejecutar `npm run bootstrap:admin`.

## 7. Crear el primer pedido real

1. Ejecutar `npm run dev`.
2. Abrir `/auth`, pestaña **Admin**.
3. Entrar con el administrador.
4. En `/admin`, usar **Crear pedido + Nodo Madre**.
5. Guardar los tres datos que se muestran:
   - número de pedido,
   - `MOTHER_UID`,
   - `API_KEY`.

La `API_KEY` se muestra una sola vez; la base conserva únicamente su hash SHA-256.

## 8. Activar un cliente

El cliente abre `/auth` > **Crear cuenta** y usa el número de pedido. Puede continuar con Google o crear correo/contraseña.

Al reclamar el pedido, el backend:

1. crea el perfil,
2. genera el ID interno largo `MEL-...`,
3. marca el pedido como usado,
4. crea el apiario,
5. activa el registro de suscripción,
6. asocia el Nodo Madre reservado al usuario.

El cliente no necesita ver ni copiar el ID `MEL-...`.

## 9. Preparar el Nodo Madre

Dentro de `firmware/nodo_madre/`:

1. copiar `secrets.example.h` como `secrets.h`;
2. cargar dominio/API, APN, `MOTHER_UID` y `API_KEY`;
3. verificar el pinout contra la PCB final;
4. compilar y flashear.

El Nodo Madre obtiene automáticamente el ID interno del cliente mediante `/api/device/provision` y lo guarda en NVS.

## 10. Despliegue

El proyecto puede desplegarse en Vercel u otro hosting compatible con Next.js. En producción se deben copiar las mismas variables de entorno y actualizar `NEXT_PUBLIC_SITE_URL`, el Site URL/Redirect URLs de Supabase y Google OAuth al dominio real.

Para el endpoint del Nodo Madre usar HTTPS. No grabar la `service_role` en el ESP32: el equipo solo lleva `MOTHER_UID` + su `API_KEY` individual.
