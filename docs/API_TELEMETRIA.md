# API de telemetría

## Autenticación de dispositivo

Cada Nodo Madre tiene dos valores:

- `MOTHER_UID`: identificador público del equipo.
- `API_KEY`: secreto aleatorio; se entrega una sola vez y la base guarda solo SHA-256.

No se acepta `USER_ID` como mecanismo de autenticación.

## Provisionamiento

`POST /api/device/provision`

Headers:

- `x-mellifera-mother`
- `x-mellifera-key`

Si el pedido ya fue reclamado, devuelve el `USER_ID` oculto y el apiario. Si todavía no fue activado devuelve HTTP 409 y el equipo debe reintentar en otra ventana celular.

## Ingesta

`POST /api/telemetry/ingest`

La ingesta crea automáticamente el Nodo Hijo si la combinación `owner_id + MAC_HIJO` aún no existe. El usuario puede renombrarlo luego desde el dashboard sin modificar la MAC física.

El servidor:

1. valida credenciales del Nodo Madre;
2. obtiene el propietario real;
3. valida/canoniza USER_ID;
4. reconstruye `measured_at` con `segundos_atras`;
5. clasifica estación y franja horaria en Buenos Aires;
6. busca histórico comparable;
7. calcula punto de rocío y estado Andon;
8. almacena telemetría;
9. crea alerta si corresponde;
10. actualiza `last_seen_at` del Hijo y la Madre.


### Idempotencia

`EVENT_ID` es opcional para compatibilidad, pero el firmware entregado lo genera siempre. Si se reenvía el mismo `EVENT_ID`, la API considera el registro ya recibido y responde éxito sin crear una segunda telemetría o alerta.
