# Nodo Madre MELLIFERA

El firmware implementa la lógica descripta en la tesis: recepción BLE continua, LittleFS, vinculación por TTP223, feedback por buzzer/LEDs, activación del SIM7670G cada 3 horas y publicación HTTP hacia la plataforma. Un Nodo Hijo nuevo solo queda aceptado si su primer paquete llega durante la ventana de vinculación de 10 segundos; su `MAC_HIJO` queda persistido en `/nodos_vinculados.txt`.

## Preparación

1. Instalar en Arduino IDE/PlatformIO: **ArduinoJson 6.x**, **TinyGSM** y **ArduinoHttpClient**.
2. Copiar `secrets.example.h` como `secrets.h`.
3. Completar `MELLIFERA_API_HOST`, APN, `MOTHER_UID` y `API_KEY`. Las dos últimas se obtienen al crear un pedido desde el panel Admin.
4. Verificar el pinout contra la PCB final. El código deja un pinout completo elegido para el prototipo porque el documento de tesis no fija números GPIO textuales en la sección de software.
5. Flashear ESP32.

El Nodo Madre no necesita conocer manualmente el ID oculto del cliente. Al abrir una ventana celular consulta `/api/device/provision`; cuando el pedido ya fue activado, la plataforma devuelve el `USER_ID`, el firmware lo guarda en NVS y lo inyecta de forma canónica en los paquetes publicados.

## JSON recibido por BLE

```json
{
  "USER_ID": "opcional; la Madre lo reemplaza por el canónico",
  "EVENT_ID": "opcional; si falta la Madre lo genera y lo conserva para reintentos",
  "MAC_HIJO": "AA:BB:CC:DD:EE:FF",
  "DHT11_T": 34.5,
  "DHT11_H": 62,
  "TCRT5000_ACT": 1,
  "MAX4466_E": 0.82,
  "MPU6050_TILT": 0,
  "segundos_atras": 0,
  "is_valid": true
}
```


## Reintentos e idempotencia

Al guardar un registro, la Madre genera un `EVENT_ID` estable. Ese mismo identificador viaja en todos los reintentos de la medición. El backend tiene una restricción única sobre `telemetry.event_uid`, por lo que una respuesta HTTP perdida no duplica mediciones ni alertas.

## Sincronización después de un reinicio

Mientras el ESP32 permanece encendido, `segundos_atras` se corrige con `millis()` antes de publicar. Si hubo un reinicio sin RTC, el firmware no puede reconstruir matemáticamente el tiempo previo al corte; conserva la antigüedad que venía del Nodo Hijo, suma el tiempo del arranque actual y marca `timing_recovered_after_reboot=true` en el payload para dejar trazabilidad. Si se requiere fecha absoluta exacta incluso a través de cortes prolongados, la revisión de hardware debe incorporar RTC o sincronización temporal del módem.
