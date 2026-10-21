# Auditoría contra la tesis (versión 21/10/2026)

Bases: PDF tesis MELLIFERA, especialmente secciones **4.2 (interpretación y umbrales), 4.4 (comunicación), 4.5 (consumo), 4.6 (hardware), 4.7 (software)**, y notebooks adjuntos `NodoHijo (1)` y `NodoMadre (1)`.

| Requisito de tesis | Código del usuario | Archivo entregado | Evaluación |
|---|---|---|---|
| Pines Hijo | 4,26,27,34,15,13,0,21/22 | idénticos | Conservado |
| Pines Madre | versión 1: RX16/TX17; **versión 2 RX26/TX27**; EN4, TOUCH15, BUZZER13 | toma versión 2 sin cambios | Conservado, requiere cotejar PCB real |
| Despertar 20 minutos | Sí | Sí | Programado |
| TCRT5000 60 segundos/20 min | Sí | Sí + saturación detectada | Programado |
| 10 ventanas inactivas antes de advertencia | No, solo booleano por hora | `TCRT5000_NO_ACT_STREAK`; Cloud requiere >=10 y franja activa | Programado, requiere calibración |
| MAX4466 10 s/hora, FFT 1024 pts / 2048 Hz y banda 500–600 Hz | **NO: acoustic_energy=0 y FFT no implementada** | FFT 1024 puntos, 20 ventanas, RMS y bandera espectral | Programado; sensibilidad pendiente de campo |
| MPU6050 3 lecturas, calibración persistente, 15° | 3 solo en calibración, lectura única para alerta | 3 también para detección de inclinación | Corregido |
| Buffer RTC 72 horas | Sí, posible JSON enorme y BLE sin ACK | 72 registros horarios, transmisión de un registro por vez y ACK de aplicación | Corregido |
| Vinculación por TTP223 10s, pitidos | Solo detectaba anuncio BLE: podía aceptar Madre sin ventana activa | Asociación se acepta cuando Madre recibe `pair` en ventana activa | Corregido |
| Nodo Madre BLE disponible continuo | Sí | Sí (no Deep Sleep) | Conservado |
| Guardar en LittleFS | Sí | Sí, sin borrar al fallar | Conservado y mejorado |
| Publicar cada 3 h | Sí, URL ficticia, respuesta siempre exitosa | Sí, URL real de Supabase y HTTP 2xx+JSON confirmados | Corregido; depende del despliegue Edge |
| Vincular cuenta al pedido y ocultar ID | Hardcode `USER_ID` ficticio | Se autentica Mother UID+DEVICE KEY y Edge resuelve usuario | Corregido en arquitectura |
| Compatible con cualquier SIM | No había lógica de registro/APN | Autooperador y APN configurable | Compatibilidad condicionada a operadora, bandas, plan y hardware |
| Reconstruir antigüedad de la medición | `millis()` sin manejo de reinicio | `segundos_atras` Hijo + demora Madre si no reinició | Parcial: tras corte sin RTC real, tiempo aproximado |
| Dedupe en cloud | No | `EVENT_ID` único en BD | Programado |
| BLE Mesh multi-hop | **No** | **No** | **Pendiente para cumplir tesis estrictamente** |
| TLS verificación CA | HTTP no cifrado | HTTPS + SNI; CA opcional | Requiere cargar CA para producción |
| LEDs Madre (sección 4.7.2) | No había pines definidos en el notebook | No se inventaron pines | Pendiente, sin alterar PCB |
| Prueba física con hardware y red | No proporcionada | No ejecutada | Pendiente |

**Nota:** la tesis indica que la plataforma **no diagnostica enfermedades**; el Andon solo emite advertencias indirectas. Los umbrales son de diseño inicial y necesitan contraste estadístico con mediciones reales del apiario. La energía MAX4466 está en unidades ADC-RMS, no en dB calibrados.
