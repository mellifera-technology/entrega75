# MELLIFERA — Integración GitHub Pages + Supabase + Nodo Madre + Nodo Hijo

Actualización basada en `PFI - Cohen Ricci - 75% (25)(1).pdf`, `NodoHijo (1).ipynb` y `NodoMadre (1).ipynb`.

## Archivos incluidos

- `index.html`: página estática GitHub Pages con login, panel, administración, historial detallado, JSON y exportación.
- `supabase/ACTUALIZACION_SQL.sql`: actualización del esquema existente; ejecutar **solo si aún no lo hiciste**.
- `supabase/01_ADMIN_Y_PEDIDO_123.sql`: prepara admin y da de alta el pedido de prueba `123` + las credenciales de su Madre.
- `supabase/functions/mellifera-auth/index.ts`: registro por pedido.
- `supabase/functions/mellifera-ingest/index.ts`: publicación del Nodo Madre por SIM7670G, deduplicación y alertas.
- `firmware/NodoHijo/NodoHijo.ino`: versión corregida del Hijo.
- `firmware/NodoMadre/NodoMadre.ino`: versión corregida de la Madre.
- `firmware/NodoMadre/credenciales.example.h`: ejemplo de los datos que deben grabarse en la Madre.
- `AUDITORIA_TESIS_Y_FIRMWARE.md`: verificación, qué corrige y qué NO está validado.

## 1. Seguridad (antes de publicar)

Se compartieron anteriormente un `service_role` y una contraseña PostgreSQL. **Ambos deben rotarse** desde Supabase. No copiar esas claves a firmware ni a GitHub. El HTML lleva solamente una clave pública, la cual puede sustituirse por una nueva `sb_publishable_...` si se deshabilita la `anon` legacy. El backend usa una clave privada únicamente en los secretos de las Edge Functions.

## 2. Supabase: administrador `admin/admin` y pedido `123`

Tus 3 SQL de instalación base ya se ejecutaron. Si no habías ejecutado la actualización de la versión HTML, ejecutar `supabase/ACTUALIZACION_SQL.sql` en Supabase > SQL Editor.

**Crear la identidad Auth del admin (manual, una vez):**

Supabase > Authentication > Users > Add user:

- Email: `admin@mellifera.local`
- Password: `admin`
- Activar confirmación automática / Auto Confirm User.

Después ejecutar **el archivo completo** `supabase/01_ADMIN_Y_PEDIDO_123.sql` en SQL Editor. Establece `profiles.role = admin`, marca el pedido `MELLIFERA-ADMIN-001` como reservado/claim y crea el pedido `123` disponible.

El resultado del último SELECT contendrá exactamente estos campos: `numero_pedido`, `mother_uid`, `device_key_guarda_ahora`. **Guardar esa clave**; Supabase persiste solo su hash SHA-256 y no puede recuperarse más tarde. Si el archivo se reejecuta no regenerará la clave del pedido `123` ni reemplazará credenciales existentes. Si la última consulta devuelve cero filas, mirar si el pedido `123` ya existe: `SELECT code,status FROM public.orders WHERE code='123';`.

Con el SQL correctamente aplicado y el admin de Auth confirmado podrás entrar en el HTML con **usuario `admin` y contraseña `admin`**. **Cambiar la contraseña inmediatamente al publicar**, porque estas credenciales de prueba son conocidas.

## 3. Edge Functions obligatorias (en Supabase)

En Supabase > Edge Functions, crear/actualizar:

1. `mellifera-auth`: reemplazar el contenido con `supabase/functions/mellifera-auth/index.ts`.
2. `mellifera-ingest`: reemplazar el contenido con `supabase/functions/mellifera-ingest/index.ts`.

En ambas desactivar **Verify JWT**: la función Auth valida el JWT internamente en `claim`; la función de telemetría valida `MOTHER_UID` y `DEVICE_KEY` contra el hash del SQL. No son endpoints abiertos sin control.

En Supabase > Edge Functions > Secrets crear `MELLIFERA_SERVER_KEY` usando **la clave privada nueva, nunca la que se compartió en el chat**. Las funciones necesitan ese secreto para leer la base de datos con `service_role`. Guardar y desplegar las funciones.

**Google:** Supabase > Authentication > Providers > Google debe tener OAuth configurado; también la URL del GitHub Pages real en Authentication > URL Configuration. Correo/password usa Supabase Auth con registro por pedido.

## 4. Crear el usuario X con pedido `123`

El **admin** NO consume el pedido 123. El pedido 123 queda disponible para un cliente de prueba:

- GitHub Pages → Crear cuenta → Pedido `123` → correo y contraseña del cliente X.
- Confirmar el correo si el proyecto lo exige.
- Ingresar una segunda vez usando el correo/password, sin ingresar nuevamente `123`.

Cuando se reclama `123`, la función `claim_order_for_user` crea `profiles.public_id` (oculto), `apiaries`, `subscriptions`, marca `orders.status='claimed'` y enlaza `mother_nodes.owner_id` al usuario. No se debe completar manualmente el ID secreto en ningún lado: **se resuelve en el servidor usando las credenciales de la Madre**.

## 5. Configurar la Madre

Copiar `firmware/NodoMadre/credenciales.example.h` como `credenciales.h` en la misma carpeta de `NodoMadre.ino` y completar:

```
#define MELLIFERA_MOTHER_UID "MOTHER-TEST-123"
#define MELLIFERA_DEVICE_KEY "LA_CLAVE_QUE_TE_MOSTRO_EL_SQL"
#define MELLIFERA_APN ""
#define MELLIFERA_SIM_PIN ""
#define MELLIFERA_CA_FILE ""
```

**No publicar `credenciales.h` en GitHub**. El repositorio incluye `.gitignore`.

La Madre manda los registros mediante HTTPS a:

`https://zvtljoaecgtdnzloksjo.supabase.co/functions/v1/mellifera-ingest`

El payload lleva `MOTHER_UID`, `DEVICE_KEY` y las mediciones de la colmena. **No lleva ni necesita el ID secreto del usuario**. La Edge Function verifica la Madre y asigna cada `MAC_HIJO` al propietario correspondiente. La clave se transmite exclusivamente bajo HTTPS; **para producción hay que instalar el CA raíz** del destino en el módem (ej. mediante `AT+CCERTDOWN`) y configurar `MELLIFERA_CA_FILE`, para que se verifique la identidad TLS del servidor. Con valor vacío, el firmware no garantiza verificación del certificado y es apropiado solo para pruebas controladas.

### SIM de distintas operadoras

La Madre deja la selección de operador en automático (`AT+COPS=0`) y **no fija un APN si se deja `MELLIFERA_APN` vacío**, aprovechando la configuración preprovisionada en la SIM/módem. Si una operadora exige APN propio, hay que completarlo. Una SIM cualquiera **no puede garantizarse universalmente**: requiere datos activos, PIN correcto, cobertura LTE en bandas soportadas por SIM7670G, permisos de roaming y APN válido. Tampoco se puede asegurar que cualquier variante del módulo se encienda únicamente con GPIO4: comprobar EN/PWRKEY en la placa física.

### Pines NO modificados

**Madre:** TTP223=GPIO15, buzzer=GPIO13, RX al TX del SIM=GPIO26, TX al RX del SIM=GPIO27, EN=GPIO4. La **primera** celda del notebook tiene 16/17; la **segunda/última** versión, elegida aquí, tiene 26/27. Si físicamente tenés 16/17 soldados, avisanos antes de grabar: no es una modificación arbitraria, es una diferencia en tus propios archivos.

**Hijo:** DHT11=GPIO4, TCRT5000=GPIO26/27, MAX4466=GPIO34, TTP223=GPIO15, buzzer=GPIO13, botón BOOT=GPIO0, MPU6050 SDA=GPIO21/SCL=GPIO22.

### Instalación Arduino

Para evitar incompatibilidades de firmas de la biblioteca BLE, compilar con **ESP32 Arduino Core 2.0.17** y **ArduinoJson 6.x**, más `DHT sensor library` y `Adafruit Unified Sensor`. No se requiere biblioteca arduinoFFT externa porque el Hijo implementa su propia FFT radix-2.

LittleFS se monta SIN auto-formatear para no borrar mediciones si hay una falla. En una placa nueva sin sistema de archivos, el primer montaje puede requerir **cambiar temporalmente** `#define FORMAT_FRESH_FLASH 0` a `1`, grabar una vez, y volverlo a `0` para las próximas versiones. Ese cambio podría borrar datos si la memoria tiene registros: usar solamente en placa nueva, vacía.

## 6. Vincular BLE y comprobar extremo a extremo

1. Grabá la Madre con `credenciales.h`; probá alimentación del SIM y que responda a `AT`.
2. Grabá el Hijo con el firmware de la carpeta; los pines permanecen intactos.
3. Activá el TTP223 en la **Madre**, abrís 10s de emparejamiento.
4. Activá TTP223 en el **Hijo** durante esa ventana; 2 pitidos indican ACK de vinculación real.
5. El Hijo mide cada 20 minutos, forma promedios horarios y remite registros al BLE. La Madre guarda los registros en LittleFS y solo confirma recepción **después** del guardado.
6. La Madre enciende el módem cada tres horas y publica pendientes. Los borra cuando Supabase confirma HTTP 2xx y `{\"ok\":true}`. Ante fallo conserva el lote, para reintentar; `EVENT_ID` impide duplicación en la BD.
7. El usuario X ingresa en GitHub Pages → Panel → colmenas → **Historial**, donde encontrará todas las mediciones, JSON y exportación CSV.

**Pruebas más rápidas:** en la Madre, para un ensayo de banco y sin modificar pines, cambiar temporalmente `TRANSMIT_INTERVAL_MS` a `60000UL` (cada minuto). En el Hijo el primer registro válido llega aproximadamente tras tres activaciones de 20 minutos; podés comprobar el primer envío con Serial, o usar un registro simulado autenticado desde un cliente HTTP privado.

## 7. IMPORTANTE: límites de lo comprobado

Se revisaron los dos notebooks y los capítulos correspondientes de la tesis. Se verificó sintaxis JS/TS y estructura de archivos; **NO** se compiló firmware contra placas/librerías concretas, ni se probó SIM7670G físico, ni se ejecutó código dentro de tu Supabase real. **NO es correcto describirlo como validado en campo**.

No está implementado el **BLE Mesh multi-salto** mencionado en la tesis: funciona en topología central de Hijo→Madre con BLE GATT. Incorporar un mesh auténtico requeriría modificar la pila de comunicaciones de ambos equipos, no solo enviar JSON. Tampoco se puede garantizar seguridad TLS de producción con `MELLIFERA_CA_FILE` vacío, ni recuperación de hora exacta después de un corte eléctrico sin reloj persistente (se marca como aproximada).
