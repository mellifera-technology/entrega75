# PUBLICACIÓN DE MELLIFERA — GitHub + Vercel + Supabase

## Lo que ya existe

Este ZIP contiene la aplicación web REAL (Next.js), con `app/page.tsx`, pantallas de login, dashboard, colmenas, KPI, alertas, administración, componentes, API y firmware de referencia. La base de datos se instaló por separado en Supabase mediante tres scripts SQL.

**Importante:** Este ZIP por sí solo no cambia la página alojada en `github.io`: no se subió ni publicó automáticamente en GitHub. GitHub Pages aloja sitios estáticos, mientras que la aplicación requiere rutas API y ejecución de código de servidor. Para la web completa, usar GitHub como repositorio y Vercel como hosting de Next.js.

## 1. Rotar credenciales expuestas antes de publicar

La clave privada `service_role` fue compartida en el chat. Debe reemplazarse/revocarse desde Supabase y no volver a utilizarse. Usar las claves nuevas de Supabase: Publishable para `NEXT_PUBLIC_SUPABASE_ANON_KEY` y Secret para `SUPABASE_SERVICE_ROLE_KEY` (se mantienen los nombres históricos de las variables porque así se llaman en este proyecto). También cambiar la contraseña de PostgreSQL compartida en el chat. Nunca subir claves a GitHub.

## 2. Subir el sitio al repositorio

1. Extraer `mellifera-web-lista-para-publicar.zip`.
2. Crear un repositorio PRIVADO nuevo en GitHub, p. ej. `mellifera-web` (no es obligatorio tocar el repositorio actual del sitio `github.io`).
3. Subir el contenido INTERIOR de `mellifera-web/` a la raíz del nuevo repositorio: `package.json`, `app/`, `components/`, `lib/`, etc. No subir el ZIP en lugar de los archivos.
4. No subir `.env.local`, `.env` ni `firmware/nodo_madre/secrets.h`. `.gitignore` ya los excluye al usar Git.

## 3. Publicar Vercel

1. Abrir https://vercel.com/new y entrar con GitHub.
2. Importar el repositorio `mellifera-web`.
3. Framework: Next.js (automático). Root Directory: `./` si `package.json` está en la raíz.
4. En Environment Variables cargar estas entradas para Production (también Preview si corresponde):

```
NEXT_PUBLIC_SUPABASE_URL=https://zvtljoaecgtdnzloksjo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NUEVA_CLAVE_PUBLISHABLE>
SUPABASE_SERVICE_ROLE_KEY=<NUEVA_CLAVE_SECRET>
ORDER_COOKIE_SECRET=<VALOR_ALEATORIO_SEGURO_DE_32_O_MAS_CARACTERES>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<CONTRASENA_ADMIN_LARGA_Y_SEGURA>
ADMIN_EMAIL=<TU_CORREO_REAL>
ADMIN_ORDER_CODE=MELLIFERA-ADMIN-001
NEXT_PUBLIC_SITE_URL=https://<EL_DOMINIO_QUE_ASIGNE_VERCEL>
```

La URL del sitio es el dominio HTTPS real de Vercel (NO la URL de la API de Supabase). Si aún no conocés el dominio, configurá el resto primero; cuando Vercel asigne el nombre final, agregá/corregí `NEXT_PUBLIC_SITE_URL` y redeploy.

**No pegar nunca** `SUPABASE_SERVICE_ROLE_KEY` en variables que comienzan por `NEXT_PUBLIC_`.

5. Pulsar Deploy. Al finalizar abrir la URL de Vercel. La portada puede verse aunque el Admin no esté inicializado. No confundir errores de configuración con una publicación completada.

## 4. Crear el administrador real una sola vez

La instalación del SQL NO crea usuarios Auth. Para inicializar el administrador en Supabase, en una PC con Node.js 22:

```
cd mellifera-web
cp .env.example .env.local
```

Completar `.env.local` con los MISMOS valores seguros cargados en Vercel (URL, keys, ADMIN_EMAIL, ADMIN_PASSWORD, etc.). Después:

```
npm install
npm run bootstrap:admin
```

Este comando crea o actualiza el usuario de Supabase Auth, marca `profiles.role=admin`, reserva el pedido `MELLIFERA-ADMIN-001` y crea el apiario inicial. `ADMIN_USERNAME` es el nombre de acceso al administrador; `ADMIN_PASSWORD` debe ser privada. Si falla, copiar solamente el TEXTO del error, sin claves.

## 5. Configurar autenticación Supabase

En Supabase: Authentication -> URL Configuration
- Site URL: `https://<EL_DOMINIO_QUE_ASIGNE_VERCEL>`.
- Redirect URLs: `https://<EL_DOMINIO_QUE_ASIGNE_VERCEL>/auth/callback`.

Si se requiere acceso con Google, habilitar el proveedor en Authentication -> Providers -> Google y configurar en Google Cloud las credenciales OAuth con callback `https://zvtljoaecgtdnzloksjo.supabase.co/auth/v1/callback`.

## 6. Estado y límites del prototipo

Se verificó la sintaxis TypeScript previamente. No se ha ejecutado un despliegue en el GitHub ni en Vercel de esta persona, ni una prueba de extremo a extremo de Supabase/Auth/dispositivos físicos. El firmware es de referencia y requiere adaptarse y ensayarse con el hardware real. No considerar el proyecto verificado en producción hasta terminar estas pruebas.

## Qué solicitar para que podamos acompañar exactamente la publicación

Enviá el enlace del repositorio GitHub (sin ningún secreto) y una captura de la página de configuración de Vercel sin credenciales. Eso permitirá indicar la estructura correcta y resolver errores de despliegue puntualmente.
