# Padrón de socios

Aplicación web para administrar el padrón de un centro de jubilados. Incluye acceso privado, consulta y edición de socios, exportación CSV e importación de CSV/XLSX con validación previa.

## Requisitos

- Node.js 20 o superior
- Una base PostgreSQL en Neon

Para desplegar en Vercel, seguí la [guía de publicación](GUIA-VERCEL.md).

## Puesta en marcha

1. Instalá las dependencias con `npm install`.
2. Copiá `.env.example` a `.env.local`.
3. En Neon, abrí el SQL Editor y ejecutá el contenido de `db/schema.sql`.
4. Completá `DATABASE_URL` con la URL de conexión de Neon, `ADMIN_PASSWORD` con una contraseña larga y exclusiva, y `AUTH_SECRET` con un valor aleatorio de al menos 32 caracteres.
5. Iniciá el servidor con `npm run dev` y abrí `http://localhost:3000`.

No publiques `.env.local` ni compartas la URL de conexión. En producción, cargá esas variables en el servicio de alojamiento; no las agregues al código del navegador.

## Importar la planilla

Se admiten `.xlsx` y `.csv` de hasta 4 MiB y 1000 filas por carga. Los CSV pueden estar separados por punto y coma o coma, en UTF-8 o Windows-1252. La primera fila debe tener encabezados; se reconocen los campos de la planilla del centro, incluyendo variantes como `N° Socio`, `N° Legajo`, `Fecha Nacimiento` y `Tipo Socio`.

La vista previa indica filas listas, duplicadas y con errores. Los duplicados por número de socio o DNI se omiten, sin sobrescribir registros existentes. Solo se guardan las filas después de confirmar.

## Seguridad y operación

Esta primera versión usa una contraseña administrativa única para todas las personas autorizadas. Antes de cargar datos reales, usá una contraseña larga, activá HTTPS en el alojamiento y prepará una copia de respaldo periódica independiente de Neon. Probá también cómo restaurarla. El plan gratuito de Neon no incluye SLA y puede suspender el cómputo al agotar sus límites.

Si varias personas van a administrar el padrón, conviene agregar cuentas individuales, permisos y registro de cambios antes de ponerlo en uso habitual. La aplicación conserva las bajas como historial y no tiene una función para borrar socios.

## Comprobaciones

- `npm run typecheck`
- `npm run lint`
- `npm run build`
