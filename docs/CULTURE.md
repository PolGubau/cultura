# Agenda cultural

## Alcance

Agenda web responsive y PWA en Next.js para los municipios disponibles en la base de datos. Inicialmente solo se han preparado datos de Mataró; no se incorporan automáticamente municipios ni programación. Las fiestas son capas opcionales sobre la agenda anual.

- Agenda por períodos de 90 días, búsqueda, categorías, día, «Ara», mapa y detalle con enlace estable `/actes/{uuid}`.
- Favoritos, idioma del contenido y modo ciudad/fiesta guardados en este navegador. Interfaz en catalán; contenido ca/es/en con fallback a catalán.
- Fiesta publicada con logo, color, prioridad y activación automática por fechas inclusivas en la zona horaria de la ciudad. También puede elegirse manualmente.
- Admin: lugares reutilizables, categorías, fiestas, actos manuales, traducciones, borrador/publicación, cancelación con motivo, duplicación como borrador y avisos con caducidad.
- Exportación ICS y compartir mediante las funciones disponibles del navegador.
- Propuestas anónimas para Mataró: se revisan en `/admin/proposals`; aceptar crea el acto publicado en la misma transacción. Android abre el formulario web.
- La antigua landing queda en `/santes-2026`. Expo es ahora otro cliente nativo del mismo catálogo, con dominio y SDK en `../shared/culture`. Configuración y API municipal: [CULTURE-INTEGRATIONS.md](./CULTURE-INTEGRATIONS.md).

## Arquitectura

`src/features/culture/domain` contiene tipos y reglas puras; `server` contiene autorización, repositorios y escrituras; `ui` contiene componentes públicos y admin. `app` adapta rutas y acciones de Next.js.

La agenda consulta todos los municipios disponibles por defecto y permite filtrar por municipio. Carga páginas de 1.000 actos durante un período de 90 días; la búsqueda, favoritos y filtros se aplican a los actos ya cargados, y se avisa cuando quedan páginas pendientes. El mapa consulta actos publicados del área visible y permite filtrar por municipio, fiesta y día. Agrupa los puntos y carga 200 por petición, con un aviso y opción de cargar más. La zona visible se envía al servidor. Los detalles usan la ciudad real del acto y las consultas públicas se hacen como anónimo, respetando RLS. Las propuestas y el panel siguen ligados a `CULTURE_CITY_ID`; todavía no hay alta de municipios ni selección de ciudad administrativa.

Al cargar páginas adicionales, la actualización automática de la agenda se pausa para no descartarlas. La interfaz permite actualizar manualmente volviendo a la primera página. Los avisos públicos se muestran también en la vista de todos los municipios, hasta un máximo de 100.

El repositorio público usa un cliente anónimo sin cookies incluso si el visitante es administrador. Las escrituras del editor usan su sesión y RLS. Las propuestas públicas pasan exclusivamente por una función del servidor con service key y límites en la base de datos; no se concede acceso anónimo directo a la tabla. Las claves externas compuestas impiden asociar actos y avisos a recursos de otra ciudad.

## Instalación local

Requiere Node.js 24 para ejecutar los tests TypeScript con el runner nativo, y pnpm. No se añade un framework de tests.

1. En `landing`, ejecutar `pnpm install --frozen-lockfile`.
2. Crear `.env.local` desde `.env.example` y completar los valores en el editor, sin pegarlos en comandos ni commits.
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
5. `supabase/migrations/202611150005_integrations.sql`: permisos y límites de la API municipal.
6. `supabase/migrations/202611150006_proposals.sql`: cola privada, límites y revisión transaccional.
7. `supabase/migrations/202611150007_multicity_map.sql`: índices de consulta geográfica y eventos públicos.

Crear/invitar el primer usuario en Authentication del dashboard y establecer su contraseña mediante el flujo de Supabase. Copiar su UUID (no un token) y ejecutar en el SQL Editor: `insert into public.city_memberships (city_id, user_id, role) values ('mataro', '<UUID_DEL_USUARIO>', 'owner');`.

Desactivar el registro público si no se necesita. Un usuario autenticado sin pertenencia no puede editar. `owner` y `editor` pueden gestionar contenido; `viewer` solo tiene lectura pública por ahora. Nadie puede asignarse membresías desde la web. Invitar a otros editores requiere de momento repetir el alta de pertenencia mediante el dashboard/SQL autorizado.

En `/admin`: crear lugar → revisar categorías → crear fiesta opcional → crear acto → guardar como borrador → revisar → publicar. Para retirar contenido, volver a borrador; para cancelaciones reales, mantener publicado y marcar cancelado con motivo. No hay borrado destructivo en la interfaz.

## Variables

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto nuevo.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave pública del mismo proyecto. Nunca una service-role/secret key.
- `CULTURE_CITY_ID`: `mataro` por defecto. Solo servidor.
- `NEXT_PUBLIC_SITE_URL`: origen HTTPS definitivo para metadatos, canonical y sitemap. El fallback conserva el dominio histórico hasta decidir la marca.
- `SUPABASE_SERVICE_KEY`: clave secreta de servicio, solo servidor, necesaria para recibir propuestas; nunca `NEXT_PUBLIC`.
- `PROPOSAL_HASH_SECRET`: secreto aleatorio de al menos 32 caracteres, solo servidor, para seudonimizar IP en el límite de envío.
- `PROPOSALS_TRUST_VERCEL_IP=1`: activar únicamente en Vercel tras verificar que su proxy sobrescribe `x-vercel-forwarded-for`; sin esta configuración las propuestas se deshabilitan en producción. En desarrollo el límite se comparte localmente.

El panel de administración no necesita una service key; la recepción anónima sí requiere `SUPABASE_SERVICE_KEY` en el servidor. No usa `FESTIVAL_ID`. Las mutaciones antiguas están deshabilitadas y las rutas de analítica/feedback ya no consultan datos privados históricos. Esto no repara las políticas del proyecto Supabase antiguo: sus permisos excesivos deben corregirse de forma independiente si sigue activo.

Las propuestas se limitan a cinco por IP y 100 por ciudad y hora; no es un CAPTCHA ni una protección completa frente a ataques distribuidos. El hash de IP se guarda solo para el límite y las entradas caducadas se limpian gradualmente al recibir propuestas. Configurar también protección perimetral y revisar retención, privacidad y moderación antes de abrirlo al público. No se recoge correo ni se envían notificaciones.

## Offline e instalación

El service worker solo se registra en producción, bajo HTTPS o localhost. Comprobar con `pnpm build` y `pnpm start`, no con el servidor de desarrollo.

- Guarda el lector estático y hasta doce respuestas públicas de `/api/culture`; cada página consulta hasta 1.000 actos de un período de 90 días. La copia offline puede ser parcial y se avisa si quedan páginas.
- En la primera visita se prepara una copia pública con los datos ya recibidos, sin repetir la petición. Para forzar la actualización: Ajustos → Actualitzar l’agenda offline.
- Sin red, las navegaciones públicas abren un lector sencillo con horarios, descripción, cancelación conocida y filtro de favoritos. Siempre identifica la copia y su fecha.
- No se cachean páginas admin, acciones, cookies, respuestas RSC, mapas ni imágenes. Los datos antiguos pueden conservar contenido posteriormente retirado: offline no garantiza revocación instantánea ni avisos actualizados.
- MapLibre y OpenFreeMap requieren red. La ubicación solo se solicita al pulsar el botón; la consulta envía al servidor los límites visibles del mapa, que pueden revelar una ubicación aproximada. El endpoint no almacena la ubicación ni cachea las consultas del mapa; revisar también los registros del proveedor de alojamiento antes de publicar.
- iOS: Compartir → Añadir a pantalla de inicio. Android: menú del navegador → Instalar. No hay sincronización de favoritos entre dispositivos.
- `node scripts/generate-culture-icons.mjs` regenera los PNG desde el SVG usando sharp, ya incluido por Next.js.

## Validación

- `node --test tests/*.test.*`: reglas de fechas/DST, modo fiesta, búsqueda, cancelaciones, validación, ICS, concurrencia, refresco e aislamiento de caché del service worker.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Después del build, `node scripts/check-culture-http.mjs --start` inicia un servidor local en el puerto 3107, ejecuta 28 comprobaciones HTTP y lo cierra. Verifica rutas, cabeceras de caché, manifiesto, iconos y entradas inválidas; no sustituye una prueba interactiva en navegador.
- `node scripts/check-multicity-map.mjs`: comprueba localmente el endpoint del mapa, parámetros y paginación usando un servidor Supabase simulado; no verifica PostgreSQL ni RLS.
- `supabase/tests/culture-rls.sql`: comprobación transaccional de permisos con dos ciudades; ejecutar solo en una base de desarrollo migrada. Termina en rollback. No se ha podido ejecutar aquí al no haber PostgreSQL/Docker ni un proyecto Supabase autorizado.
- `supabase/tests/culture-proposals.sql`: comprueba aislamiento de ciudades, acceso anónimo, límites y aceptación/rechazo. Ejecutar solo en una base de desarrollo migrada; termina en rollback.
- `node scripts/check-culture-load.mjs`: build aislado en `.next-culture-load` y carga local acotada con 1.000 actos sintéticos. Comprueba consultas reales del repositorio contra un servidor HTTP simulado, no PostgreSQL/RLS. No modifica `.next` ni conecta Supabase. Detalles y límites en [CULTURE-PERFORMANCE.md](./CULTURE-PERFORMANCE.md).

Antes de publicar, probar en dispositivos reales: Safari iOS instalado, Android instalado, primera visita, avión tras carga, favorito tras recarga, acto nocturno, denegación de ubicación, cancelación actualizada y acceso de un usuario sin pertenencia. Los tests de worker se ejecutan en un entorno simulado, no sustituyen esta prueba de navegador.

## Pendiente antes de un lanzamiento oficial

- Elegir marca/dominio y completar información legal de alojamiento, región y retención reales.
- Conectar y validar Supabase, permisos entre ciudades y el flujo crear/editar/publicar con usuarios reales.
- Cargar programación confirmada y revisar traducciones y accesibilidad del contenido.
- Decidir el archivo de 2026; no se ha importado automáticamente.
- Web Push, recordatorios en segundo plano, analítica consentida, administración de miembros, subida de imágenes y autoservicio de entidades no están implementados. Los logos e imágenes se introducen por URL HTTPS.
- Validar capacidad en el alojamiento definitivo y cuotas del proveedor de mapas antes de campaña. La prueba local no certifica capacidad de producción ni sustituye una auditoría legal/de accesibilidad.
