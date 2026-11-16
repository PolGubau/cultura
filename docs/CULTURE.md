# Mataró Cultura

## Alcance

Agenda web responsive y PWA en Next.js. Mataró es la única ciudad visible. Las fiestas son capas opcionales sobre la agenda anual; no son ciudades ni aplicaciones separadas.

- Agenda por períodos de 90 días, búsqueda, categorías, día, «Ara», mapa y detalle con enlace estable `/actes/{uuid}`.
- Favoritos, idioma del contenido y modo ciudad/fiesta guardados en este navegador. Interfaz en catalán; contenido ca/es/en con fallback a catalán.
- Fiesta publicada con logo, color, prioridad y activación automática por fechas inclusivas en la zona horaria de la ciudad. También puede elegirse manualmente.
- Admin: lugares reutilizables, categorías, fiestas, actos manuales, traducciones, borrador/publicación, cancelación con motivo, duplicación como borrador y avisos con caducidad.
- Exportación ICS y compartir mediante las funciones disponibles del navegador.
- La antigua landing queda en `/santes-2026`. Expo es ahora otro cliente nativo del mismo catálogo, con dominio y SDK en `../shared/culture`. Configuración y API municipal: [CULTURE-INTEGRATIONS.md](./CULTURE-INTEGRATIONS.md).

## Arquitectura

`src/features/culture/domain` contiene tipos y reglas puras; `server` contiene autorización, repositorios y escrituras; `ui` contiene componentes públicos y admin. `app` adapta rutas y acciones de Next.js.

`CULTURE_CITY_ID` se resuelve exclusivamente en `server/config.ts`, nunca desde un formulario del cliente. Inicialmente un despliegue equivale a una ciudad. No hay selector, alta de ayuntamientos ni resolución real por dominio todavía. Para N ciudades, añadir un mapeo de dominios verificados en ese punto; las URLs de los actos no cambian.

El repositorio público usa un cliente anónimo sin cookies incluso si el visitante es administrador. Las escrituras usan la sesión del editor y RLS; no usan una service key. Las claves externas compuestas impiden asociar actos y avisos a recursos de otra ciudad.

## Instalación local

Requiere Node.js 24 para ejecutar los tests TypeScript con el runner nativo, y pnpm. No se añade un framework de tests.

1. En `landing`, ejecutar `pnpm install --frozen-lockfile`.
2. Crear `.env.local` desde `.env.culture.example` y completar los valores en el editor, sin pegarlos en comandos ni commits.
3. Ejecutar las migraciones descritas debajo en un proyecto Supabase de desarrollo.
4. Ejecutar `pnpm dev`. Sin Supabase se muestra un estado explícito de configuración pendiente, no contenido inventado.

Si la política local de pnpm bloquea scripts de dependencias, revisar los paquetes con el responsable del entorno. No se ha modificado ni desactivado esa política. Los binarios ya instalados se pueden invocar con `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build` y `node node_modules/eslint/bin/eslint.js`.

## Base de datos y primer administrador

Se recomienda un proyecto Supabase nuevo. No aplicar estas migraciones a producción sin revisar el destino, copia de seguridad y permisos. No se han aplicado desde el agente a ningún proyecto remoto.

Aplicar en este orden usando el SQL Editor autenticado de Supabase, o el procedimiento de migraciones de tu infraestructura:

1. `supabase/migrations/202611150001_culture.sql`: tablas nuevas `cities`, `city_memberships`, `city_categories`, `city_places`, `city_festivals`, `city_events`, `city_announcements`.
2. `supabase/migrations/202611150002_permissions.sql`: permisos y Row Level Security (RLS, filtrado de filas en la base de datos).
3. `supabase/migrations/202611150003_mataro.sql`: Mataró y categorías iniciales. Sin actos de prueba ni fechas inventadas de Santes 2027.
4. `supabase/migrations/202611150004_performance.sql`: índices para la consulta pública de actos no caducados, orden estable y pertenencias por usuario.

Crear/invitar el primer usuario en Authentication del dashboard y establecer su contraseña mediante el flujo de Supabase. Copiar su UUID (no un token) y ejecutar en el SQL Editor: `insert into public.city_memberships (city_id, user_id, role) values ('mataro', '<UUID_DEL_USUARIO>', 'owner');`.

Desactivar el registro público si no se necesita. Un usuario autenticado sin pertenencia no puede editar. `owner` y `editor` pueden gestionar contenido; `viewer` solo tiene lectura pública por ahora. Nadie puede asignarse membresías desde la web. Invitar a otros editores requiere de momento repetir el alta de pertenencia mediante el dashboard/SQL autorizado.

En `/admin`: crear lugar → revisar categorías → crear fiesta opcional → crear acto → guardar como borrador → revisar → publicar. Para retirar contenido, volver a borrador; para cancelaciones reales, mantener publicado y marcar cancelado con motivo. No hay borrado destructivo en la interfaz.

## Variables

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto nuevo.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave pública del mismo proyecto. Nunca una service-role/secret key.
- `CULTURE_CITY_ID`: `mataro` por defecto. Solo servidor.
- `NEXT_PUBLIC_SITE_URL`: origen HTTPS definitivo para metadatos, canonical y sitemap. El fallback conserva el dominio histórico hasta decidir la marca.

El nuevo panel no necesita `SUPABASE_SERVICE_ROLE_KEY` ni `FESTIVAL_ID`. Las mutaciones antiguas están deshabilitadas y las rutas de analítica/feedback ya no consultan datos privados históricos. Esto no repara las políticas del proyecto Supabase antiguo: sus permisos excesivos deben corregirse de forma independiente si sigue activo.

## Offline e instalación

El service worker solo se registra en producción, bajo HTTPS o localhost. Comprobar con `pnpm build` y `pnpm start`, no con el servidor de desarrollo.

- Guarda el lector estático y hasta doce respuestas públicas de `/api/culture`, con un máximo de 1.000 actos por consulta de 90 días. Si hay más, se avisa y se puede cambiar el período.
- En la primera visita se prepara una copia pública con los datos ya recibidos, sin repetir la petición. Para forzar la actualización: Ajustos → Actualitzar l’agenda offline.
- Sin red, las navegaciones públicas abren un lector sencillo con horarios, descripción, cancelación conocida y filtro de favoritos. Siempre identifica la copia y su fecha.
- No se cachean páginas admin, acciones, cookies, respuestas RSC, mapas ni imágenes. Los datos antiguos pueden conservar contenido posteriormente retirado: offline no garantiza revocación instantánea ni avisos actualizados.
- MapLibre y OpenFreeMap requieren red. La ubicación solo se solicita al pulsar el botón y no se guarda en el servidor.
- iOS: Compartir → Añadir a pantalla de inicio. Android: menú del navegador → Instalar. No hay sincronización de favoritos entre dispositivos.
- `node scripts/generate-culture-icons.mjs` regenera los PNG desde el SVG usando sharp, ya incluido por Next.js.

## Validación

- `node --test tests/*.test.*`: reglas de fechas/DST, modo fiesta, búsqueda, cancelaciones, validación, ICS, concurrencia, refresco e aislamiento de caché del service worker.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Después del build, `node scripts/check-culture-http.mjs --start` inicia un servidor local en el puerto 3107, ejecuta 28 comprobaciones HTTP y lo cierra. Verifica rutas, cabeceras de caché, manifiesto, iconos y entradas inválidas; no sustituye una prueba interactiva en navegador.
- `supabase/tests/culture-rls.sql`: comprobación transaccional de permisos con dos ciudades; ejecutar solo en una base de desarrollo migrada. Termina en rollback. No se ha podido ejecutar aquí al no haber PostgreSQL/Docker ni un proyecto Supabase autorizado.
- `node scripts/check-culture-load.mjs`: build aislado en `.next-culture-load` y carga local acotada con 1.000 actos sintéticos. Comprueba consultas reales del repositorio contra un servidor HTTP simulado, no PostgreSQL/RLS. No modifica `.next` ni conecta Supabase. Detalles y límites en [CULTURE-PERFORMANCE.md](./CULTURE-PERFORMANCE.md).

Antes de publicar, probar en dispositivos reales: Safari iOS instalado, Android instalado, primera visita, avión tras carga, favorito tras recarga, acto nocturno, denegación de ubicación, cancelación actualizada y acceso de un usuario sin pertenencia. Los tests de worker se ejecutan en un entorno simulado, no sustituyen esta prueba de navegador.

## Pendiente antes de un lanzamiento oficial

- Elegir marca/dominio y completar información legal de alojamiento, región y retención reales.
- Conectar y validar Supabase, permisos entre ciudades y el flujo crear/editar/publicar con usuarios reales.
- Cargar programación confirmada y revisar traducciones y accesibilidad del contenido.
- Decidir el archivo de 2026; no se ha importado automáticamente.
- Web Push, recordatorios en segundo plano, analítica consentida, administración de miembros, subida de imágenes y autoservicio de entidades no están implementados. Los logos e imágenes se introducen por URL HTTPS.
- Validar capacidad en el alojamiento definitivo y cuotas del proveedor de mapas antes de campaña. La prueba local no certifica capacidad de producción ni sustituye una auditoría legal/de accesibilidad.
