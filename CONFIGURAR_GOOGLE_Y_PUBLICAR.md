# MELLIFERA · Versión 4 (21/10/2026)

## Qué estaba roto
El listener global `document.addEventListener('submit', ...)` llamaba `handleRegister(e)` y `handleLogin(e)`; ambas usaban `e.currentTarget`, que en ese contexto es **document**, no el formulario. `busy(document,true)` arrojaba un error antes de contactar Supabase y por eso el botón parecía no hacer nada. Se corrigió a `const f=e.target` en ambos casos.

## Mejoras visuales y de registro
- Ventana de acceso más ancha (hasta 620 px) y controles/tipografía más grandes.
- Dos campos de contraseña; antes de consultar Supabase se exige que coincidan.
- Mensajes visibles cuando falta completar un campo o las contraseñas no coinciden.
- Eliminado el párrafo debajo de «Vincular pedido con Google».
- Conservado logo, páginas internas, historial, firmware, pines y todas las funciones originales.

## Publicación en GitHub Pages
Reemplazá el `index.html` de tu repositorio por este archivo y conservá/subí la carpeta `assets` con `mellifera-logo.png`. Esperá a que GitHub Pages termine de publicar y presioná `Ctrl+F5` para evitar la versión cacheada.

**No es necesario volver a ejecutar el SQL solo por este arreglo.** Si «Comprobar pedido» dice que 123 está disponible, la conexión pública y el RPC de consulta de pedido ya están funcionando.

## Activar el inicio de sesión de Google
1. Entrá en [Google Cloud Console](https://console.cloud.google.com/) y seleccioná o creá un proyecto.
2. En **Google Auth Platform → Branding/Audience** configurá el nombre de la aplicación y el consentimiento. Si el proyecto queda en modo **Testing**, agregá las cuentas que pueden usarlo en **Test users**.
3. En **Google Auth Platform → Clients → Create client**, elegí **Web application**.
4. En **Authorized JavaScript origins** agregá el origen de tu GitHub Pages, por ejemplo `https://TU-USUARIO.github.io` (sin el nombre del repositorio).
5. En **Authorized redirect URIs**, agregá **exactamente**:

   `https://zvtljoaecgtdnzloksjo.supabase.co/auth/v1/callback`

6. Creá el cliente y copiá **Client ID** y **Client Secret**.
7. En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **Authentication → Sign In / Providers → Google**, activá Google e introducí Client ID y Client Secret. Guardá.
8. En **Supabase → Authentication → URL Configuration**, establecé como **Site URL** la URL final exacta de tu página, por ejemplo `https://TU-USUARIO.github.io/mellifera/`. Agregá la misma URL a **Redirect URLs**.
9. Volvé a la web publicada y probá el botón «Vincular pedido con Google» con el pedido 123. Ese pedido se consume al asociarlo a una cuenta; después «Continuar con Google» funciona sin introducir el código.

**Importante:** el Client Secret de Google permanece únicamente en Supabase. No se agrega al HTML. Tampoco se agrega `service_role` ni ninguna clave `sb_secret_...` a GitHub Pages.

## Si el correo ya existe
En Supabase → **Authentication → Users**, buscá el correo que intentaste registrar. Si ya está, no crees otra cuenta: confirmá el correo si aparece pendiente, volvé a la web, iniciá sesión con el mismo correo/contraseña y vinculá el pedido 123. Si el pedido ya se reclamó, entrá normalmente.

Si al crear cuenta se muestra `Email address not authorized` o un error de límite de envío, revisá la configuración de correo de Supabase y SMTP personalizado. En producción se recomienda SMTP propio.

## Comprobaciones efectuadas
- Análisis sintáctico de todo el JavaScript de la página: correcto.
- Prueba de navegador con API de Supabase simulada: el botón ahora ejecuta el manejador y muestra los errores de contraseña, y el recorrido de alta llega a `signUp`/RPC cuando el pedido es válido.
- No se probó contra tu proyecto Supabase real; no se pudo crear una cuenta real desde este entorno.

## Seguridad pendiente
Como compartiste anteriormente la clave privada `service_role` y la contraseña de la base, debés rotarlas en Supabase. La clave `anon`/publishable es pública; la privada jamás debe figurar en HTML ni en GitHub.
