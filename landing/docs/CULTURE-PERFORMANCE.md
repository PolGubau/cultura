# Rendimiento y picos de tráfico

## Protecciones implementadas

- HTML público con regeneración incremental (ISR) cada 30 segundos: las visitas no necesitan volver a renderizar toda la agenda. Detalles generados a demanda y reutilizados. Favoritos, idioma y modo fiesta se aplican en el navegador, no personalizan el HTML del servidor.
- Catálogo y actos públicos en la Data Cache de Next.js durante 30 segundos, separados por ciudad, proyecto, tipo de recurso y fecha/UUID. Nunca se introduce una sesión de administrador en esta caché.
- Peticiones simultáneas de una misma clave comparten el trabajo en curso dentro de cada proceso, tanto al cargar como al descomprimir el catálogo. No es un bloqueo distribuido entre servidores.
- Al guardar/duplicar desde el admin se invalidan la etiqueta pública y las páginas. Los errores de lectura no se almacenan como catálogo válido; una revalidación fallida no debe reemplazar la última copia buena.
- API pública con `max-age=0, s-maxage=15, stale-while-revalidate=15`: un CDN compatible puede absorber los refrescos compartidos sin ejecutar Next.js ni consultar Supabase en cada visita. No se depende de una caché privada de navegador para contenido recién cancelado.
- Errores de API: `no-store`, sin etiqueta de respuesta pública. Las respuestas 503 incluyen `Retry-After`. El admin y sus consultas con sesión no usan estas cachés públicas.
- Timeout de ocho segundos por petición pública a Supabase. Se usa su API HTTP; no hay una conexión PostgreSQL por visitante ni se necesita añadir un pool de conexiones de aplicación para este acceso.
- Catálogo por períodos de 90 días y páginas de 1.000 actos. Se evita `COUNT exact`; al llenar una página se ofrece la siguiente de forma conservadora, incluso cuando hay exactamente 1.000.
- JSON comprimido en la Data Cache para no llenar una entrada con descripciones repetidas en tres idiomas. Esto no sustituye la compresión HTTP del alojamiento; hay que vigilar el tamaño real de los catálogos y el límite por entrada del proveedor.
- No se vuelve a descargar el catálogo al hidratar una página con datos frescos ni al preparar offline. Refresco cada 60–75 segundos, repartido aleatoriamente y detenido en pestañas ocultas, sin red o al cargar páginas adicionales. En ese último caso se avisa y se puede actualizar manualmente volviendo a la primera página.
- Solo 60 tarjetas iniciales, con «Mostrar més» local. El mapa carga 200 actos por petición y ofrece cargar más; no reconstruye el mapa ni vuelve a descargar su estilo en cada refresco. Los enlaces de tarjetas no precargan cientos de detalles.
- El worker conserva hasta doce catálogos. Si falla la red o el origen devuelve un error, ofrece una copia identificada como antigua. Si el almacenamiento del dispositivo falla, no oculta una respuesta de red correcta.

## Frescura del contenido

La caché es deliberadamente corta: una cancelación guardada invalida los datos del servidor, pero una respuesta que ya está en el CDN puede seguir disponible hasta 30 segundos. Con el refresco de una pestaña abierta, el cambio puede tardar aproximadamente dos minutos en mostrarse con red sana; si se han cargado páginas adicionales, requiere actualizar manualmente. No es una garantía de tiempo real.

No hay Web Push. Una pestaña cerrada no recibe avisos; una copia offline puede conservar datos retirados. La fecha visible `fetchedAt` identifica la edad de la copia. Una incidencia prolongada puede mantener una copia antigua: disponibilidad no equivale a actualidad.

## Prueba local reproducible

Ejecutar `node scripts/check-culture-load.mjs` con Node.js 24 y dependencias instaladas. Solo escucha en loopback; crea y cierra sus propios servidores. Construye en `.next-culture-load` sin reemplazar el build desplegable `.next`. No hace escrituras ni lecturas en una base real.

El servidor de prueba devuelve 1.000 actos con tres idiomas y descripciones, y añade 30 ms de latencia por lectura. Se comprueban:

1. 24 peticiones simultáneas de un catálogo frío: cuatro lecturas al servidor de datos para este fixture pequeño, no cuatro por visitante. Los metadatos con más de 500 filas requieren páginas adicionales.
2. 120 peticiones posteriores de catálogo, concurrencia 24: cero lecturas adicionales mientras la caché sigue fresca.
3. 120 peticiones de HTML caliente, concurrencia 24: cero lecturas adicionales y solo 60 tarjetas renderizadas.
4. Contrato de consultas anónimas, filtros por ciudad/publicación, límite y ausencia de `COUNT exact`, sin cookies en las respuestas públicas.
5. Respuesta pública idéntica aunque llegue una cookie, continuidad de una copia caliente durante un fallo y recuperación tras un 503 no cacheado de una fecha nueva.

El resultado informa peticiones por segundo y p95 (tiempo por debajo del que termina el 95 % de las peticiones), incluyendo la lectura completa del cuerpo. Es una carga HTTP sintética desde el mismo ordenador, no una simulación de usuarios navegando ni una certificación de capacidad.

No mide PostgreSQL, políticas RLS reales, invalidación mediante una sesión real de editor, CDN, escalado entre instancias, dispositivos, WebGL, mapas externos ni cobertura móvil. Los tests unitarios cubren además aislamiento de claves, liberación tras errores y reparto de refrescos.

## Requisitos antes de una campaña real

1. **Alojamiento con CDN e ISR/Data Cache persistente.** En Vercel, comprobar límites de ejecución, transferencia, caché y gasto del plan contratado. En self-hosting con varias instancias, configurar un cache handler compartido y propagación de invalidaciones; la memoria local de cada proceso no basta. No cachear `/admin`, autenticación ni acciones de servidor en un proxy genérico.
2. **Región y base de datos.** Next.js cerca de Supabase, proyecto activo/no pausado, plan y cuotas revisados. Aplicar la migración `004` con autorización y copia de seguridad. Verificar `EXPLAIN (ANALYZE, BUFFERS)` en staging con el archivo histórico y los datos esperados; los índices propuestos no se han validado contra un PostgreSQL real aquí.
3. **Comprobar caché en el dominio definitivo.** API y HTML deben tener HIT tras el calentamiento. Confirmar que navegar con cookies no provoca `Set-Cookie` público ni filtra borradores. Los cambios del panel deben invalidar páginas/datos y respetar el breve margen del CDN.
4. **Prueba de carga autorizada en staging.** Acordar volumen esperado, probar visitas frías/calientes, distintas fechas, detalles, cancelación durante carga y fallo temporal de Supabase. Usar datos representativos, incluyendo tamaño de textos/rutas. Propuesta inicial de aceptación: errores < 0,1 %, p95 de contenido caliente < 500 ms desde la región objetivo y sin saturar CPU, conexiones o I/O de Supabase; no son resultados obtenidos ni un SLA.
5. **Observabilidad y límites.** Alertas sobre 5xx, p95/p99, CPU/memoria, fallos de revalidación, edad del catálogo, consultas lentas, cache HIT y transferencia. Revisar presupuesto de alojamiento/Supabase y capacidad/condiciones de OpenFreeMap o contratar un proveedor de mapas adecuado al volumen.

Como orden de magnitud, 50.000 pestañas activas refrescando cada minuto generan hasta unas 833 peticiones/s al CDN, **no necesariamente a Supabase**. Con caché compartida, el trabajo de base depende sobre todo de las claves activas y sus revalidaciones; con miles de fechas o UUID distintos, múltiples regiones o fallos de caché, el coste sube. Sin plan y métricas reales no se puede prometer una cifra máxima de usuarios.
