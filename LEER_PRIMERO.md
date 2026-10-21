# MELLIFERA — Versión corregida para GitHub Pages

La **primera acción** para resolver el alta de usuario es instalar `supabase/02_REPARAR_REGISTRO.sql` en Supabase SQL Editor. Después sustituir el `index.html` y subir `assets/mellifera-logo.png` a GitHub Pages. No hace falta desplegar la Edge Function `mellifera-auth`: esta versión usa RPC seguras directamente desde Supabase.

## Registro con pedido 123

1. Abrí la web → Crear cuenta → pedido `123` → nombre → email → contraseña de al menos ocho caracteres.
2. Si Supabase exige confirmar correo, seguí el enlace desde ese navegador. Al volver a la página se activará automáticamente el pedido.
3. Si la cuenta Auth existe pero el pedido no se activó, **iniciá sesión** y la propia web te pedirá **solo el código de pedido** para vincularlo.
4. Desde ese momento el cliente ingresa solamente con correo+contraseña o Google. El código no vuelve a pedirse.

**No se modifica el firmware ni los pines.** La recepción de datos del Nodo Madre sigue necesitando `supabase/functions/mellifera-ingest/index.ts` ya configurada y desplegada, y los permisos del esquema de la versión anterior. El ID privado del cliente no se entrega al navegador.

Los otros archivos se conservan por compatibilidad con instalaciones anteriores, entre ellos `supabase/ACTUALIZACION_SQL.sql` y `supabase/01_ADMIN_Y_PEDIDO_123.sql`. **No vuelvas a ejecutar ni a crear el pedido 123 si ya existe.** Ver `REGISTRO_CORREGIDO_LEEME.md` para el diagnóstico y detalles.

**Sin prueba en vivo:** la sintaxis del HTML fue verificada, pero esta sesión no puede ejecutar transacciones en tu Supabase privado.
