# Publicar en Vercel

Esta guía publica la aplicación y conecta el servidor a PostgreSQL en Neon. No hace falta exponer Neon al navegador: la URL de conexión se usa únicamente en las rutas del servidor.

## Antes de publicar

1. Instalá Node.js 26.x desde [nodejs.org](https://nodejs.org/) y abrí una terminal nueva. Comprobá `node --version` y `npm --version`.
2. Desde la carpeta del proyecto, ejecutá:

   ```powershell
   npm install
   npm run typecheck
   npm run lint
   npm run build
   ```

   `npm install` generará `package-lock.json`; incluilo en el repositorio para que las instalaciones de Vercel sean reproducibles.

3. En GitHub, asegurate de que el repositorio incluya el proyecto y que `.env.local` no esté versionado. El archivo está excluido por `.gitignore`; nunca subas claves ni padrones al repositorio.
4. Para probar cambios, prepará una base o branch de prueba en Neon. No uses la base de producción para probar altas o importaciones.

## Crear la base en Neon

1. Creá un proyecto y una base en Neon.
2. Abrí **SQL Editor** y ejecutá el contenido de `db/schema.sql`.
3. Desde **Connect**, elegí la branch, el rol y la base que usará la aplicación. Copiá la URL de conexión completa, con SSL. Para una aplicación serverless, preferí la URL con pooler si Neon la ofrece.
4. Guardá la URL en un gestor de contraseñas; contiene credenciales de la base.

Neon tiene un plan gratuito, pero sus límites pueden cambiar y no equivale a un SLA. Revisá el consumo y mantené una copia de respaldo independiente.

## Crear el proyecto en Vercel

1. Subí los cambios a un repositorio GitHub. Desde Vercel, elegí **Add New → Project** y autorizá GitHub si lo solicita.
2. Importá el repositorio de Socios.
3. Configurá **Framework Preset: Next.js** y **Root Directory** como la carpeta que contiene este `package.json`. Si el repositorio es directamente la carpeta `Socios`, dejá la raíz como `./`.
4. En **Settings → Build and Deployment → Node.js Version**, elegí **26.x**. El proyecto también declara Node 26 en `package.json`.
5. En **Settings → Environment Variables**, agregá estas variables para **Production**:

   | Variable         | Valor                                                              |
   | ---------------- | ------------------------------------------------------------------ |
   | `DATABASE_URL`   | URL completa copiada desde Neon, incluida la parte SSL             |
   | `ADMIN_PASSWORD` | Contraseña administrativa larga, exclusiva y guardada en un gestor |
   | `AUTH_SECRET`    | Secreto aleatorio de al menos 32 caracteres                        |

   Podés generar `AUTH_SECRET` en tu PC, después de instalar Node, con:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   No agregues el prefijo `NEXT_PUBLIC_` a ninguna de estas variables. No pegues secretos en el código ni en GitHub. Dejá `Preview` sin acceso a la base de producción; si necesitás probar previews, asignales una branch o base de prueba y sus propias variables. Las variables nuevas o modificadas requieren un nuevo despliegue.

6. Conservá los comandos detectados por Vercel: instalación con npm y build con `npm run build`. Elegí **Deploy**.
7. Esperá el resultado en **Deployments**. Si falla, abrí los registros del build; verificá primero que `package-lock.json` esté en GitHub, que la raíz del proyecto sea correcta y que las variables estén en el entorno que estás desplegando.

En el plan Hobby, Vercel tiene restricciones para desplegar repositorios privados que pertenezcan a una organización de GitHub. Si ese es tu caso, revisá el plan vigente o usá un repositorio personal compatible antes de continuar.

## Verificación

Antes de cargar el padrón real:

1. Abrí la URL `*.vercel.app` y comprobá que aparezca la pantalla de acceso.
2. Iniciá sesión y confirmá que carga una lista vacía. Si aparece el mensaje de configuración, revisá que las tres variables estén en **Production**, que `AUTH_SECRET` tenga al menos 32 caracteres y que se haya hecho un nuevo despliegue.
3. Hacé las pruebas de alta, edición, búsqueda, exportación e importación usando la base de prueba. Incluí filas con duplicados y datos incompletos.
4. Confirmá que un usuario sin sesión no pueda consultar `/api/members` y que la contraseña equivocada no permita ingresar.
5. Probá un archivo XLSX y un CSV de menos de 4 MiB. El límite se mantiene por debajo del máximo habitual de cuerpo de solicitud de una Vercel Function.
6. Antes de usar producción, ejecutá y verificá un respaldo, y documentá cómo restaurarlo.

## Dominio propio (opcional)

En Vercel, abrí **Settings → Domains**, agregá el dominio y seguí las instrucciones de DNS que muestra el panel. Usá siempre HTTPS y no compartas la URL de Neon.

## Pendiente de seguridad antes de datos reales

La versión actual usa una sola contraseña compartida para todos los administradores; no tiene cuentas individuales, limitación de intentos ni auditoría de cambios. El padrón contiene DNI y otros datos personales. Antes de cargar datos reales, conviene agregar inicio de sesión individual o una capa de acceso administrada, limitación de intentos y registro de cambios. No reutilices la misma contraseña en otros servicios.

## Referencias oficiales

- [Importar un repositorio Git a Vercel](https://vercel.com/docs/git)
- [Límites de Vercel Functions](https://vercel.com/docs/functions/limitations), incluido el tamaño máximo de solicitud
- [Conexión manual de Neon con Vercel](https://neon.com/docs/guides/vercel-manual)
- [Opciones de integración Neon–Vercel](https://neon.com/docs/guides/vercel)
