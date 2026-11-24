# Padrón de socios

Aplicación web para administrar el padrón de un centro de jubilados. Incluye acceso privado, consulta y edición de socios, exportación CSV e importación de CSV/XLSX con validación previa.

## Requisitos

- Node.js 26.x
- Una base PostgreSQL en Neon

Para desplegar en Vercel, seguí la [guía de publicación](GUIA-VERCEL.md).

## Puesta en marcha

1. Instalá las dependencias con `npm install`.
2. Copiá `.env.example` a `.env.local`.
3. En Neon, abrí el SQL Editor y ejecutá el contenido de `db/schema.sql`.
4. Completá `DATABASE_URL` con la URL de conexión de Neon, `ADMIN_PASSWORD` con una contraseña larga y exclusiva, y `AUTH_SECRET` con un valor aleatorio de al menos 32 caracteres.
5. Iniciá el servidor con `npm run dev` y abrí `http://localhost:3000`.

No publiques `.env.local` ni compartas la URL de conexión. En producción, cargá esas variables en el servicio de alojamiento; no las agregues al código del navegador.

El primer inicio de sesión crea la cuenta `admin` usando `ADMIN_PASSWORD`. Después, el administrador puede crear usuarios de consulta, secretaría y administración desde **Administrar usuarios**. Si la base ya existía, volvé a ejecutar `db/schema.sql` para crear la tabla de usuarios; el esquema conserva los socios existentes.

## Importar la planilla

Se admiten `.xlsx` y `.csv` de hasta 4 MiB y 1000 filas por carga. Los CSV pueden estar separados por punto y coma o coma, en UTF-8 o Windows-1252. La primera fila debe tener encabezados; se reconocen los campos de la planilla del centro, incluyendo variantes como `N° Socio`, `N° Legajo`, `Fecha Nacimiento` y `Tipo Socio`.

La importación está disponible solo para administradores. La vista previa indica filas listas, duplicadas y con errores. Los duplicados por número de socio o DNI se omiten, sin sobrescribir registros existentes. Solo se guardan las filas después de confirmar.

## Seguridad y operación

Las cuentas tienen permisos diferenciados: consulta solo visualiza el padrón; secretaría puede crear y modificar socios y exportar datos; administración puede además importar planillas y gestionar usuarios. Las contraseñas individuales se almacenan con hash. Antes de cargar datos reales, activá HTTPS en el alojamiento y prepará una copia de respaldo periódica independiente de Neon. Probá también cómo restaurarla. El plan gratuito de Neon no incluye SLA y puede suspender el cómputo al agotar sus límites.

La aplicación conserva las bajas como historial y no tiene una función para borrar socios. No incluye limitación de intentos de inicio de sesión ni auditoría de cambios.

## Comprobaciones

- `npm run typecheck`
- `npm run lint`
- `npm run build`
