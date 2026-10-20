# MELLIFERA TECHNOLOGY — plataforma web completa

Implementación final del prototipo web + Supabase para el sistema de telemetría apícola MELLIFERA.

## Incluye

- Landing page moderna, oscura, responsive y de una sola página.
- Calculadora de muestra representativa de Nodos Hijo.
- Alta de cliente protegida por **número de pedido de un solo uso**.
- Login posterior sin número de pedido: Google o correo + contraseña.
- `public_id` único y oculto generado por PostgreSQL/Supabase.
- Dashboard por apiario con tablero Andon, KPI, alertas y detalle por colmena.
- Histórico de temperatura/humedad y datos contextuales: piquera, acústica e inclinación.
- API segura para Nodo Madre, con `MOTHER_UID` + API key.
- Provisionamiento automático del `USER_ID` oculto hacia el Nodo Madre.
- Persistencia de telemetría y cálculo de `measured_at` usando `segundos_atras`, con `EVENT_ID` idempotente para evitar duplicados en reintentos.
- Panel Admin con usuarios, IDs únicos, pedidos, Nodos Madre y acceso al dashboard de cada cliente desde la sesión administrativa.
- Creación de pedidos y credenciales de hardware desde Admin.
- Contabilidad interna para **Chiara y Lucas** con reparto mixto igualitario/proporcional.
- Firmware completo de referencia del Nodo Madre ESP32 + SIM7670G.

## Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL + Row Level Security
- Recharts
- Zod

Para una puesta en marcha guiada, ver también `docs/SUPABASE_PASO_A_PASO.md`.

## 1. Crear Supabase

Crear un proyecto vacío en Supabase y abrir **SQL Editor**. Ejecutar completo:

`supabase/schema.sql`

Este SQL reemplaza al MySQL del notebook original. No se usa `CREATE DATABASE`, `USE`, `password_hash` ni un procedimiento MySQL: Supabase administra la base, las contraseñas viven en `auth.users`, y la API de telemetría valida el Nodo Madre antes de insertar.

## 2. Variables de entorno

Copiar:

```bash
cp .env.example .env.local
```

Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ORDER_COOKIE_SECRET=un-secreto-largo-y-aleatorio
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
ADMIN_EMAIL=admin@mellifera.local
ADMIN_ORDER_CODE=MELLIFERA-ADMIN-001
```

`SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse al navegador ni usar prefijo `NEXT_PUBLIC_`.

## 3. Google Login

En Supabase > Authentication > Providers > Google, habilitar Google y cargar Client ID/Secret.

En Google Cloud, la URI autorizada de callback debe apuntar a:

```text
https://TU-PROYECTO.supabase.co/auth/v1/callback
```

En Supabase > Authentication > URL Configuration, agregar como redirect permitido:

```text
http://localhost:3000/auth/callback
```

Y luego la URL equivalente de producción.

## 4. Instalar y ejecutar

```bash
npm install
npm run bootstrap:admin
npm run dev
```

Abrir `http://localhost:3000`.

### Admin inicial de desarrollo

- Usuario: `admin`
- Contraseña: `admin`
- Número de pedido reservado: `MELLIFERA-ADMIN-001`

**Cambiar `ADMIN_PASSWORD` antes de publicar.** Después volver a ejecutar `npm run bootstrap:admin` para sincronizar la contraseña de Auth.

## 5. Flujo de un cliente real

Desde `/admin`, usar **Crear pedido + Nodo Madre**. Se generan:

- número de pedido (ej. `MEL-26-AB12CD34`),
- `MOTHER_UID`,
- `API_KEY` del dispositivo.

La API key se muestra una sola vez y en la base se guarda únicamente su SHA-256.

El cliente entra a **Crear cuenta**, ingresa el número de pedido y recién entonces puede crear cuenta con correo/contraseña o Google. Al reclamar el pedido:

1. PostgreSQL crea su `public_id` oculto (`MEL-...`).
2. El pedido queda `claimed` y no puede reutilizarse.
3. Se crea el apiario inicial.
4. El Nodo Madre preasignado al pedido queda vinculado al nuevo usuario.
5. En los próximos ciclos el Nodo Madre consulta `/api/device/provision`, recibe el ID oculto y lo guarda localmente.

En accesos posteriores el número de pedido **no se vuelve a pedir**.

## 6. Telemetría del Nodo Madre

Endpoint:

```text
POST /api/telemetry/ingest
```

Headers:

```text
Content-Type: application/json
x-mellifera-mother: MOTHER-XXXXXXXXXXXX
x-mellifera-key: <API_KEY>
```

Ejemplo compatible con la estructura de la tesis:

```json
{
  "MOTHER_UID": "MOTHER-XXXXXXXXXXXX",
  "USER_ID": "MEL-...",
  "EVENT_ID": "MOTHER-...-AABBCCDDEEFF-1-12345-89ABCDEF",
  "MAC_HIJO": "AA:BB:CC:DD:EE:FF",
  "DHT11_T": 34.5,
  "DHT11_H": 62,
  "TCRT5000_ACT": 1,
  "MAX4466_E": 0.82,
  "MPU6050_TILT": 0,
  "segundos_atras": 120,
  "is_valid": true
}
```

También acepta envío en lote:

```json
{
  "MOTHER_UID": "MOTHER-XXXXXXXXXXXX",
  "measurements": [
    {"MAC_HIJO":"AA:BB:CC:DD:EE:01","DHT11_T":34.1,"DHT11_H":61,"TCRT5000_ACT":1,"MAX4466_E":0.7,"MPU6050_TILT":0,"segundos_atras":0},
    {"MAC_HIJO":"AA:BB:CC:DD:EE:02","DHT11_T":33.8,"DHT11_H":64,"TCRT5000_ACT":1,"MAX4466_E":0.8,"MPU6050_TILT":0,"segundos_atras":0}
  ]
}
```

El backend **no confía en `USER_ID` como credencial**: autentica el dispositivo por `MOTHER_UID` + API key, obtiene el propietario real desde la base y luego canoniza el `USER_ID`. El firmware agrega además un `EVENT_ID` persistente a cada medición; si el HTTP fue procesado pero la respuesta se perdió, el reintento devuelve éxito sin duplicar el registro ni la alerta.

## 7. Criterios de análisis implementados

La plataforma aplica la lógica del documento:

- Andon verde / amarillo / rojo / blanco.
- Primavera-verano: temperatura 33–36 °C y humedad 55–75 % HR.
- Otoño-invierno: temperatura 8–14 °C; humedad evaluada mediante margen al punto de rocío respecto del histórico comparable.
- Temperatura baja + humedad alta en primavera-verano produce una alerta urgente, pero la interfaz aclara que **no es un diagnóstico**.
- El histórico comparable se separa por estación y franja horaria.

## 8. Cálculo de muestra

`lib/sample-size.ts` resuelve iterativamente la ecuación de población finita usando t de Student, 95% de confianza, error máximo 1 °C y `S = 1,8 °C` inicial. Reproduce los ejemplos del documento:

- N=10 → n=7
- N=15 → n=9
- N=20 → n=10

## 9. Contabilidad Chiara / Lucas

La regla inicial usa `accounting_income_weight = 0.5`:

```text
participación = 50% × reparto igualitario + 50% × reparto proporcional al saldo aportado/pagado pendiente
```

Ejemplo: Chiara tiene $100 pendientes y Lucas $0. El próximo ingreso se distribuye 75% / 25%. Si ambos tienen el mismo saldo, 50% / 50%.

El porcentaje puede ajustarse desde `/admin/accounting` sin tocar código.

## 10. Firmware Nodo Madre

Ver `firmware/nodo_madre/`.

El pinout usado allí es una decisión completa de prototipo y está centralizado al principio del `.ino` para ajustarlo a la PCB final. Las credenciales se copian desde Admin al archivo `secrets.h` durante la preparación del equipo. La vinculación TTP223 queda implementada: un MAC de Nodo Hijo nuevo solo se incorpora durante la ventana de 10 segundos y luego queda persistido en LittleFS; fuera de esa ventana, un MAC no vinculado es rechazado.

## Seguridad antes de producción

- Cambiar admin/admin.
- Usar un `ORDER_COOKIE_SECRET` aleatorio y largo.
- No subir `.env.local` ni `secrets.h` al repositorio.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- Servir la plataforma por HTTPS.
- Configurar límites/rate limiting en el hosting para los endpoints de autenticación y telemetría.
