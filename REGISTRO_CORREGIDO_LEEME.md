# MELLIFERA — Corrección del registro (GitHub Pages)

## Qué fallaba
El HTML anterior dependía de una Edge Function `mellifera-auth`. Si no estaba desplegada o configurada, impedía validar el pedido y crear la cuenta. Además, el error no quedaba claro. **Esta versión no necesita esa Edge Function para registrar usuarios.** Usa llamadas a PostgreSQL RPC con privilegios delimitados y session JWT de Supabase.

## Cómo instalar sin alterar tu base

1. Abrir **Supabase → SQL Editor → New query**.
2. Pegar y ejecutar íntegro `supabase/02_REPARAR_REGISTRO.sql`. No borra los datos existentes. Al finalizar muestra si el pedido `123` está disponible.
3. Reemplazar el `index.html` de la raíz de tu GitHub Pages por el de este paquete.
4. Subir también `assets/mellifera-logo.png` manteniendo la ruta exacta. El logo fue extraído del PDF oficial, versión de fondo negro con el fondo convertido a transparente.
5. Esperar a que termine GitHub Pages. Si ves la versión anterior, recargar con Ctrl+F5.
6. En la web, **Crear cuenta → pedido 123 → nombre → correo nuevo → contraseña mínimo 8 caracteres**.
7. Si Supabase requiere confirmación por correo, verificar el enlace **desde el mismo navegador**. Luego volver al sitio; la web conserva provisionalmente el pedido en almacenamiento local hasta que esté activado.
8. Tras activar la cuenta, iniciar sesión con el correo y contraseña habituales. No se vuelve a pedir el pedido.

### Si `123` figura como reclamado
El SQL **no vuelve disponible un pedido ya utilizado**, para evitar asignarlo a otra persona. Consultar el usuario que lo reclamó o crear otro pedido desde el administrador. Si una cuenta de Supabase Auth existe pero aún no tiene perfil MELLIFERA, se puede iniciar sesión con ella y activar un pedido disponible.

### Qué permanece
- Web oscura, calculadora, panel de colmenas, Andon, historial y CSV, administración y contabilidad.
- La tabla `profiles` genera el ID secreto, pero no se devuelve al cliente. La función de reclamo retorna únicamente `true`.
- El Nodo Madre sigue enviando datos mediante `mellifera-ingest`. **No se modificaron firmwares, pines, SIM ni credenciales.**
- Supabase Authentication gestiona las contraseñas, no el HTML.

### Si vuelve a fallar
Copiar el **mensaje exacto** que ahora muestra el formulario (por ejemplo: `Invalid API key`, `Confirmá el correo`, `Pedido ya utilizado`, `Falta ejecutar SQL`), sin compartir contraseñas ni claves. Si se recibe correo de confirmación, configurar **Authentication → URL Configuration** con la dirección exacta de GitHub Pages.

### Seguridad
Una `service_role` anterior fue expuesta en la conversación. Hay que revocarla y actualizar la clave privada solo en la Edge Function de telemetría. Nunca agregarla al `index.html`.

### Verificaciones
Se revisaron las llamadas Supabase y se comprobó la sintaxis JavaScript del HTML modificado. **No se ejecutó contra tu instancia privada de Supabase**, por lo que el éxito final deberá comprobarse cuando corras SQL y publiques el HTML.
