# Agenda cultural

Monorepositorio con la agenda web, la aplicación Expo y su código compartido:

- `landing/`: Next.js, PWA, administración y API.
- `app/`: aplicación móvil Expo.
- `shared/culture/`: dominio y cliente HTTP compilados por ambas aplicaciones; no se publica como paquete.

Cada aplicación mantiene su propia instalación y lockfile para aislar sus versiones de React. Sus archivos `pnpm-workspace.yaml` solo autorizan explícitamente los scripts de dependencias necesarios; no comparten instalaciones. Usa Node.js 22 o superior y pnpm 11. Desde la raíz:

1. Ejecuta `node --test tests/monorepo.test.mjs` para verificar la estructura y las exclusiones de secretos.
2. En `landing/`, ejecuta `pnpm install --frozen-lockfile`, `pnpm test` y `pnpm build`.
3. En `app/`, ejecuta `pnpm install --frozen-lockfile`, `pnpm typecheck` y `pnpm test --ci --runInBand`. Usa `pnpm start` para iniciar Expo.

## Despliegue

El proveedor debe recibir **el repositorio completo**, incluido `shared/`:

- **Vercel:** conecta este repositorio, configura `landing` como Root Directory y activa la opción que permite incluir archivos fuera de ese directorio. Instala y construye con los comandos de `landing/`.
- **EAS:** ejecuta el build desde `app/`, con Git reconociendo esta raíz como repositorio. EAS debe incluir `shared/` en el archivo que sube. Configura `EXPO_PUBLIC_CULTURE_API_URL` con el origen HTTPS de la API desplegada.

Los despliegues remotos, la configuración de variables y las migraciones de base de datos requieren configuración y validación en los servicios correspondientes. Consulta `landing/docs/CULTURE.md` y `landing/docs/CULTURE-INTEGRATIONS.md` antes de publicar.

## Historial

El commit inicial del monorepositorio tiene como padres los últimos commits de las dos aplicaciones. Las referencias `refs/legacy/app/` y `refs/legacy/landing/` conservan sus ramas y etiquetas importadas; los metadatos originales también se guardan localmente en `.legacy-git/`, ignorados por Git y por las subidas de EAS. Estas referencias y copias locales no se publican automáticamente con un push normal.
