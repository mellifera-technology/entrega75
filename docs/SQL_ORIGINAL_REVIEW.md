# Revisión del SQL.ipynb original

El notebook original estaba correctamente orientado conceptualmente, pero estaba escrito para MySQL y no era suficiente para una aplicación SaaS multiusuario en Supabase.

## Qué se conserva

- Separación entre usuario, Nodo Hijo y telemetría.
- MAC del Nodo Hijo como identificador físico estable.
- Campos `DHT11_T`, `DHT11_H`, `TCRT5000_ACT`, `MAX4466_E`, `MPU6050_TILT`.
- Reconstrucción de la fecha real restando `segundos_atras` al momento de recepción.
- Índices por usuario/fecha y nodo/fecha.

## Qué se cambió para Supabase

- `usuarios.password_hash` se elimina: Supabase Auth mantiene contraseñas y OAuth en `auth.users`.
- `user_id VARCHAR(64)` se separa en dos conceptos: UUID interno de Auth + `public_id` aleatorio visible solo para administración/dispositivos.
- Se agregan `orders`, `apiaries`, `mother_nodes`, alertas, estados Andon y campos de análisis.
- Se agregan Row Level Security (RLS) y políticas por propietario/admin.
- `InsertarTelemetria` se reemplaza por una API de servidor: evita que un equipo cualquiera inserte filas usando solamente un `USER_ID` conocido.
- `fecha_medicion` pasa a `timestamptz` y se calcula como `received_at - segundos_atras`.
- Se incorporan `season`, `time_band`, punto de rocío, validez instrumental y estado Andon.
- Se agrega contabilidad interna separada de los datos de clientes.

El archivo definitivo para ejecutar es `supabase/schema.sql`.
