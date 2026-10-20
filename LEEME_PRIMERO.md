# MELLIFERA TECHNOLOGY — GitHub Pages + Supabase

Este paquete contiene una **página web real de un solo `index.html`**, sin React, npm ni Vercel. Se puede subir a GitHub Pages y **no necesita un servidor web propio**. Supabase ejecuta las funciones privadas.

**Estado verificado:** sintaxis JavaScript del HTML, sintaxis TS de ambas funciones y calculadora de muestra 10→7, 15→9, 20→10. **Pendiente de probar en tu cuenta:** despliegue real de Edge Functions, políticas SQL y flujo de correo/Google; no tengo acceso operativo a tu proyecto para probarlos.

## Archivos

| Archivo | Función |
|---|---|
| `index.html` | Página completa: portada, calculadora, registro por pedido, login Google/correo, panel apícola, gráficos, Andon, alertas, historial paginado/JSON/CSV, admin y contabilidad. |
| `supabase/ACTUALIZACION_SQL.sql` | **Único SQL adicional** a ejecutar sobre tus tres SQL ya instalados. No borra las tablas. Restringe IDs secretos, habilita pedidos, admin y contabilidad. |
| `supabase/ADMIN_CREAR_DESPUES_DE_AUTH.sql` | Activa al administrador **admin / admin** en la base, luego de crear su usuario Auth. Pedido `MELLIFERA-ADMIN-001`. |
| `supabase/functions/mellifera-auth/index.ts` | Verifica pedido y lo reclama *solo* con un usuario Supabase autenticado y email confirmado. |
| `supabase/functions/mellifera-ingest/index.ts` | Autentica Nodo Madre, recibe datos, crea Nodos Hijo, registra mediciones y alertas. |
| `docs/firmware_nodo_madre_supabase.ino` | Firmware de referencia del Nodo Madre adaptado a Edge Functions. Necesita ensayo en hardware. |
| `docs/secrets.example.h` | Plantilla de credenciales para Arduino. Nunca subir un `secrets.h` real. |

## Instalación exacta en el orden correcto

### 1 — Seguridad: ROTAR las claves filtradas

La contraseña PostgreSQL y `service_role` fueron compartidas en el chat. Ya no deben considerarse privadas. En Supabase, cambiar contraseña y **reemplazar/revocar la clave privada** siguiendo los controles de API Keys de tu proyecto. La clave `service_role` anterior **NO** está incluida en este proyecto. En `index.html` solo está una clave **anon pública** que vos aportaste; si desactivás esa clave, reemplazarla por tu nueva `sb_publishable_...` en la constante `PUBLIC_KEY` cerca del final del HTML.

### 2 — Actualizar la base de datos que YA creaste

Supabase → **SQL Editor → New query**, pegá TODO el contenido de `supabase/ACTUALIZACION_SQL.sql`, presioná **Run**.

Esto no es volver a instalar los tres SQL: es una actualización adicional. Conserva las tablas y mediciones existentes.

### 3 — Instalar dos Edge Functions (servicio privado de la web y del Nodo Madre)

En Supabase → **Edge Functions** creá una función llamada exactamente `mellifera-auth`; elegí crear/editar desde el editor, pegá el archivo `supabase/functions/mellifera-auth/index.ts` y desplegá. Repetí con `mellifera-ingest` y su respectivo archivo.

**MUY IMPORTANTE:** en las configuraciones de ambas funciones, **desactivá `Verify JWT`**. Cada una implementa su propia autorización: `mellifera-auth` verifica el token de sesión con `auth.getUser`, y `mellifera-ingest` verifica el secreto del Nodo Madre. Si `Verify JWT` sigue activado, las claves publicables modernas y el dispositivo sin JWT pueden fallar antes de llegar al código.

En Supabase → Edge Functions → **Secrets**, creá una variable llamada `MELLIFERA_SERVER_KEY` con el valor de tu **nueva `sb_secret_...`** (o una clave privada de servidor válida del proyecto). Esta variable solo queda en el servidor Supabase, **nunca dentro del HTML**. `SUPABASE_URL` viene configurada automáticamente en Edge Functions.

**Alternativa con Supabase CLI** (desde carpeta del paquete, proyecto ya vinculado):

```bash
supabase functions deploy mellifera-auth --no-verify-jwt
supabase functions deploy mellifera-ingest --no-verify-jwt
```

Para pruebas, verificá en el panel de cada función que la URL termine exactamente en:

- `https://zvtljoaecgtdnzloksjo.supabase.co/functions/v1/mellifera-auth`
- `https://zvtljoaecgtdnzloksjo.supabase.co/functions/v1/mellifera-ingest`

### 4 — Crear administrador (una sola vez)

En Supabase → **Authentication → Users → Add user**:

- Email: `admin@mellifera.local`
- Contraseña: `admin`
- Activar confirmación automática del usuario (*Auto Confirm User*), si aparece.

**Luego** ejecutá en SQL Editor el contenido de `supabase/ADMIN_CREAR_DESPUES_DE_AUTH.sql`.

En la página podés iniciar sesión escribiendo **`admin`** y contraseña **`admin`**; la web mapea el alias a `admin@mellifera.local`. El pedido reservado es **`MELLIFERA-ADMIN-001`**. Esta cuenta de administrador se crea de forma especial, no por el formulario público con pedido.

**Cambiar esta contraseña de desarrollo antes de dar acceso externo**, desde Authentication → Users o mediante recuperación/configuración segura. No usar `admin/admin` indefinidamente.

### 5 — Habilitar correo y Google

- Supabase → **Authentication → Providers → Email**: habilitar Email; recomendar **Confirm email** activado. Para uso real, configurar SMTP con dominio propio; el servicio de email integrado de prueba tiene restricciones.
- Supabase → **Authentication → Providers → Google**: configurar Client ID y Client Secret de Google Cloud. Sin esto, **el botón de Google no funcionará**; correo/contraseña sí puede funcionar con Email habilitado.
- Supabase → **Authentication → URL Configuration**: `Site URL` debe ser la URL pública final de tu GitHub Pages; agregar entre las Redirect URLs esa misma URL con ruta permitida. Por ejemplo `https://usuario.github.io/mellifera/` y `https://usuario.github.io/mellifera/**`.
- En Google Cloud, la URL de callback OAuth va a Supabase (`https://zvtljoaecgtdnzloksjo.supabase.co/auth/v1/callback`), no directamente a GitHub.

### 6 — Publicar en GitHub Pages

1. En tu repositorio de GitHub, subí `index.html` **en la raíz** (reemplaza el antiguo `index.html` si ese repositorio ya tenía uno; conservá antes una copia).
2. GitHub → **Settings → Pages → Build and deployment → Deploy from a branch** → elegí rama `main` y carpeta `/(root)` → Save.
3. Abrí `https://TU-USUARIO.github.io/TU-REPOSITORIO/` (o la URL que GitHub indique).

**No hace falta Vercel, servidor Node ni el ZIP anterior de Next.js.** El HTML carga Supabase desde CDN y consulta Supabase directamente para la información permitida. Los procedimientos privilegiados se realizan mediante RPC/Edge Functions.

### 7 — Crear un pedido real y verificar el flujo

1. Ingresá al sitio como `admin / admin`.
2. Entrá a **Administración** → **Generar pedido + credenciales**.
3. Guardá los tres datos mostrados: `MEL-ORD-...` (cliente), `MOTHER-...` (dispositivo), y `API_KEY` (dispositivo, **se muestra una sola vez**).
4. Abrí la web como otro usuario o en ventana privada → **Crear cuenta** → escribí el pedido único → elegí correo/contraseña o Google.
5. Si el correo requiere verificación, confirmalo con el link. El pedido se asocia al usuario después de validar su email.
6. Ingresá normalmente: **nunca se vuelve a pedir el número de pedido**.
7. Configurá el Nodo Madre con `MOTHER_UID` y `API_KEY`; el equipo subirá datos desde `mellifera-ingest`. Las colmenas se crean automáticamente a partir de `MAC_HIJO`.

### 8 — Probar recepción sin disponer aún del hardware

Una vez creado el pedido/usuario y provisto el equipo, podés hacer una prueba HTTP **desde una terminal, nunca desde HTML público**. Reemplazá `MOTHER-...` y `API_KEY` por valores obtenidos en administración:

```bash
curl -X POST 'https://zvtljoaecgtdnzloksjo.supabase.co/functions/v1/mellifera-ingest' \
  -H 'Content-Type: application/json' \
  -H 'x-mellifera-mother: MOTHER-PEGAR' \
  -H 'x-mellifera-key: PEGAR_API_KEY' \
  --data '{"EVENT_ID":"TEST-COLMENA-0001","MAC_HIJO":"AA:BB:CC:DD:EE:01","DHT11_T":34.5,"DHT11_H":65,"TCRT5000_ACT":true,"MAX4466_E":0.13,"MAX4466_SWARM_BAND":false,"MPU6050_DELTA_DEG":0.4,"MPU6050_TILT":false,"segundos_atras":0}'
```

Esperado: `{"ok":true,"accepted":[...],"count":1}`. Al volver al panel y pulsar **Actualizar**, se mostrará la colmena. Al pie, **Historial completo** mostrará el registro original (sin `USER_ID`). Repetir el mismo `EVENT_ID` no debe duplicarlo.

## Privacidad y límites reales

- El ID de dispositivo por usuario (`profiles.public_id`) **no se devuelve a la web del cliente**: se revoca acceso directo a la tabla y el perfil normal proviene de una función que omite IDs. El admin sí puede verlo. El Nodo Madre autenticado sí puede recibirlo en `/mellifera-ingest` con `action:"provision"`.
- `auth.users.id` de Supabase forma parte del JWT del usuario y no se puede ocultar del propio usuario; **no es el ID secreto generado para el Nodo Madre**.
- Las credenciales privadas del servidor y de los dispositivos no figuran en el HTML.
- La evaluación Andon es preliminar según el proyecto académico; no constituye diagnóstico veterinario.
- El firmware incluido es una adaptación de referencia y **no se verificó contra hardware real/SIM7670G**. Pinout, APN, TLS, tareas BLE y tiempos deben ensayarse.
- No se puede probar un despliegue real de una cuenta Supabase desde este entorno sin autorización/autenticación a esa cuenta. Ante un error en `Run` o `Deploy`, conservar el mensaje textual del error.
