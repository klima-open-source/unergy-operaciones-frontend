# Especificación de producto — Plataforma de Operaciones Unergy

> Documento 2 de 3. Es el **inventario funcional completo** de lo que la plataforma hace hoy:
> lo que la migración debe preservar. No describe cómo está implementado (eso es
> [`01-contexto.md`](./01-contexto.md)) ni en qué orden se migra (eso es
> [`03-roadmap.md`](./03-roadmap.md)).
>
> **Fuente de verdad:** el código de `legacy/src/`. Donde la documentación del legacy
> contradice al código, manda el código.
>
> Cada módulo lleva: **propósito · rutas · capacidades · datos · reglas · notas de migración**.
> Las capacidades marcadas `[R]` son de solo lectura; `[W]` escriben en el backend.

---

## 0. Requerimientos transversales

Aplican a todos los módulos y son criterio de aceptación de cada uno.

### RT-1 · Sesión y autenticación

- Login con email + contraseña contra el backend (`POST /auth/token`, form-urlencoded).
- Recuperación de contraseña: `/forgot-password` → `POST /auth/forgot-password`;
  `/reset-password/:token` → `POST /auth/reset-password`.
- Login de larga duración (30 días) para la app móvil: `POST /auth/token/mobile`.
- La sesión sobrevive recargas y se comparte entre pestañas.
- Un 401 cierra la sesión y devuelve al login correspondiente (web o móvil).
- Un 403 muestra un aviso con el detalle que devuelve el backend, sin cerrar sesión.
- **Migración:** el destino sustituye JWT en `localStorage` por cookies `httpOnly` gestionadas
  por rutas Nitro propias. Requiere alinear el contrato con el backend en
  `server/utils/auth-api.ts`. Es la única pieza del roadmap que puede necesitar cambios en el
  backend; ver _Decisiones abiertas_.

### RT-2 · Autorización

- Roles: `admin`, `operaciones`, `monitoreo`, `liquidaciones`, `comercial`, `coordinador`,
  `tecnico`.
- Hoy: cada ruta declara `meta.roles`; `admin` pasa siempre; el sidebar oculta lo que el rol no
  puede ver; dos rutas admin están restringidas además por email exacto.
- **Migración:** se traduce a permisos por capacidad (`recurso:acción`) con matriz
  rol → permisos y matriz ruta → permiso, deny-by-default y **sin bypass de `admin`** (a `admin`
  se le conceden explícitamente todos los permisos). La restricción por email se sustituye por
  un permiso propio (`diagnostico:read`) concedido a un rol, no a una persona.
- Ocultar un enlace no es control de acceso: el guard de ruta es quien decide.

### RT-3 · Feedback, errores y estados de carga

- Toda operación de escritura confirma con un aviso de éxito o de error.
- Toda vista con datos remotos tiene los cuatro estados: cargando, error, vacío, dato.
- Las acciones destructivas piden confirmación.
- **Migración:** `useToast` de PrimeVue → `vue-sonner`; `useConfirm` → `AlertDialog`;
  spinners ad-hoc → `AsyncView` + `useQuery`; errores → `normalizeError`/`AppError` + `logger`.

### RT-4 · Notificaciones in-app

- Campana en el pie del sidebar con contador de no leídas, refrescado por _polling_ cada 60 s.
- Lista de las últimas 20, marcado individual y masivo como leídas, y enlace al Centro de
  Alertas.
- Severidades: `critica`, `alta`, `media`, `baja`, cada una con su color e icono.
- Endpoints: `GET /notificaciones`, `GET /notificaciones/count`,
  `PATCH /notificaciones/:id/leer`, `POST /notificaciones/leer-todas`.
- La app móvil tiene su propia hoja de notificaciones sobre los mismos endpoints.

### RT-5 · Exportación de documentos

Es una capacidad central del producto, no un extra. Están en uso:

| Formato                            | Dónde                                                                                      | Biblioteca                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| Excel con estilos y fórmulas vivas | Cumplimiento matriz anual, GESCON, Panel Contable, Liquidaciones, Costos, Garantías, Retos | `xlsx-js-style`, `exceljs`              |
| Excel de lectura (importar)        | Validador de mandatos, Descarga XM, Proyecto detalle, Wizard PPA, Generación, Garantías    | `xlsx`                                  |
| PDF generado                       | Informe de puesta en marcha, Cumplimiento                                                  | `jspdf` + `jspdf-autotable`             |
| PDF impreso desde HTML             | Liquidación PDF                                                                            | CSS de impresión (`utils/rptStyles.js`) |
| PDF leído (parseo)                 | Arriendos ZIP, facturas de Garantías                                                       | `pdfjs-dist`                            |
| ZIP                                | Carga masiva de arriendos, estados de resultados                                           | `jszip`                                 |

**Migración:** se conservan las bibliotecas. Todas deben quedar **`client-only`** y en imports
dinámicos, para no entrar al bundle de servidor ni al bundle inicial.

### RT-6 · Persistencia de preferencias de UI

Varias vistas recuerdan filtros, columnas y estado de paneles en `localStorage` (14 archivos).
Se conserva la funcionalidad, pero bajo SSR debe leerse solo en cliente y sin `ref` a nivel de
módulo.

### RT-7 · Deep-linking

El estado relevante de la UI vive en la query string y debe sobrevivir un F5 y ser compartible:
`?tab=` (Liquidaciones, Cumplimiento, Panel Contable, Garantías), `?tipo=` (Liquidaciones),
`?oferta=` (Comercial), `?preview=` (solo dev).

### RT-8 · Responsive

La plataforma web se usa mayoritariamente en escritorio; el sidebar ya colapsa y tiene overlay
móvil. La app móvil PWA es una experiencia aparte y es la que cubre el caso de campo.

### RT-9 · Idioma

Todo el producto está en español de Colombia. No hay i18n y no se pide.

---

## 1. General

### 1.1 Dashboard — `/dashboard`

Resumen operativo de entrada. KPIs de plataforma desde `GET /dashboard/kpis`. `[R]`

### 1.2 Proyectos (vista unificada) — `/servicios-unificado`

**El corazón del producto.** Reemplazó en el menú a las tres entradas separadas de Clientes,
Proyectos y Servicios: la base es el portafolio de plantas, y clientes y contratos son formas
de reagrupar ese mismo portafolio.

- Agrupación conmutable: Proyectos · Clientes · Servicios · PPA · Representación · Operación ·
  REC · Sin agrupar. `[R]`
- Filtros por cliente/inversionista, contrato PPA, servicio, tipo de proyecto y estado. `[R]`
- Preferencias de agrupación y filtros persistidas. `[R]`
- Navegación al detalle de cada entidad.

### 1.3 Próximos a energizar — `/general/proximos-energizar`

Pipeline de plantas por energizarse, sincronizado desde Sun Factory. Solo lectura: los campos
vienen de la fuente sin edición manual.
`GET /proximos-energizar` `[R]`, `POST /proximos-energizar/sync` `[W]`.

### 1.4 Retos Q — `/general/retos`, `/general/retos/:id`

Sistema interno de OKR trimestrales.

- Listado de retos por año/trimestre con tarjeta de avance. `[R]`
- Detalle con métricas, KPIs, y visualizaciones propias (anillo de avance, bullet de meta,
  sparkline). `[R]`
- **Matriz semanal**: registro de valores por semana y métrica. `[W]`
- Crear/editar métricas, editar trimestre, copiar métricas desde otro reto. `[W]`
- Export a Excel. `[R]`
- Endpoints: `GET/PATCH /retos[/:id]`, `POST /retos/:id/metricas`,
  `PATCH|DELETE /retos/metricas/:id`, `PUT /retos/metricas/:id/valores/:id`,
  `POST /retos/:id/metricas/copiar-desde/:id`.
- Especificación de UX detallada existente: `legacy/docs/SPEC_UX_RETOS_Q.md` (1.197 líneas).

---

## 2. Clientes

**Rutas:** `/clientes`, `/clientes/:id`

- Listado con búsqueda y vista comercial (`GET /clientes/vista-comercial`). `[R]`
- Alta y edición de cliente (formulario reutilizable en modo crear y edición en línea). `[W]`
- Detalle por pestañas: información, servicios contratados, documentos, contactos, panel,
  proyectos, contratos PPA, fronteras.
- **Contactos**: alta, edición y baja (`/clientes/:id/contactos`). `[W]`
- **Documentos**: alta de registro, carga de archivo (multipart), edición y baja. `[W]`
- **Servicios**: vincular y desvincular servicios del cliente. `[W]`
- Prueba de envío de correo al cliente (`POST /clientes/:id/test-correo`). `[W]`
- Sparkline de participación y resumen del cliente. `[R]`

---

## 3. Proyectos

**Rutas:** `/proyectos`, `/proyectos/:id`, y las vistas de servicio por proyecto
`/proyectos/:id/{ppa,operacion,representacion}`

- Listado con filtros y borrado con confirmación. `[R]` `[W]`
- Detalle por pestañas: General, Técnico, Inversionistas, Servicios.
- **Información técnica** editable (`PUT /proyectos/:id/info-tecnica`), con simulación P50/P90. `[W]`
- **Inversionistas** del proyecto: alta, edición de participación, baja. `[W]`
- **Inversores** (equipos): alta, edición, baja, y _backfill_ de minigranja. `[W]`
- **Contactos de área**: alta, edición, baja. `[W]`
- Vinculación con Sun Factory (`POST /proyectos/:id/vincular-sunfactory/:id`). `[W]`
- **Proyectos pendientes**: bandeja de proyectos detectados por sincronización, con
  confirmar/ignorar. `[W]`
- Import por pegado desde Excel e import de archivo `.xlsx`.
- Vista fasorial de la planta (`utils/fasorial.js`, `gaiaSnapshotToFasorial.js`). `[R]`

---

## 4. Contratos y servicios

**Rutas:** `/servicios`, `/contratos/:id`

- Selector de servicio por tarjeta (PPA · Representación · Operación · REC) sobre la tabla. `[R]`
- **Detalle de PPA** por pestañas: Datos, Cantidades, Tarifas, Contratos ASIC.
  - Tarifas y compromisos se editan en bloque (`PUT /ppa/:id/tarifas`,
    `PUT /ppa/:id/compromisos`), con **pegado desde Excel** como entrada masiva. `[W]`
  - Vincular proyectos al contrato (`POST /ppa/:id/proyectos`). `[W]`
  - IPP mensual (`GET|PUT /ppa/ipp/mensual`), responsables (`GET /ppa/responsables`). `[W]`
- **Wizard de creación de PPA** (multi-paso, con import de Excel y mapa). `[W]`
- **Wizard de contrato de servicio** (multi-paso, con mapa MapLibre para ubicación). `[W]`
- **Contratos de servicio**: alta, edición, baja, pagos asociados
  (`/contratos-servicio/:id/pagos`). `[W]`
- **Representación**: detección de duplicados
  (`GET /contratos-servicio/duplicados-representacion`) y **fusión**
  (`POST /contratos-servicio/fusionar-representacion`). `[W]`
- **Facturas de mantenimiento** y facturas de inversionistas/Solenium asociadas al contrato. `[W]`
- Vista de operación por proyecto con mapa, historial y soportes.

> ⚠️ `views/Servicios/OperacionView.vue` (2.422 líneas) define 8 componentes con `template:`
> como string. Es el archivo con mayor riesgo técnico de toda la migración.

---

## 5. Comercial (CRM)

**Rutas:** `/comercial`, `/comercial/oportunidades/:id` — rol `comercial` o `admin`

> «La oferta es la unidad del negocio, no el cliente.»

- **Pipeline de ofertas** en dos vistas conmutables: Tablero (kanban) y Tabla. `[R]`
- KPIs comerciales del período. `[R]`
- **Drawer de oferta** abierto con `?oferta=<id>` sobre la misma ruta, para que el enlace sea
  compartible y sobreviva un F5. `[R]`
- **Wizard de registro de oferta** (`POST /comercial/registrar`). `[W]`
- Cambio de estado (`POST /comercial/ofertas/:id/estado`), seguimiento
  (`.../seguimiento`), **firma** (`.../firmar`), edición y baja. `[W]`
- **Oportunidades**: detalle, gestiones (`POST /comercial/oportunidades/:id/gestiones`),
  ofertas asociadas, edición. `[W]`
- **Bitácora** de interacciones. `[W]`
- Creación de proyecto desde el CRM (`ProyectoDesdeCRMDialog`). `[W]`
- Catálogos y configuración: `GET /comercial/config`, `catalogos.js`.
- Lógica de negocio en `comercial.js`, ya con pruebas (`comercial.test.mjs`).

---

## 6. Operaciones

### 6.1 Generación Solar en vivo — `/solar-live`

- Mosaico de plantas en tiempo real con columnas configurables y **reordenamiento por
  arrastre** (`vuedraggable`), persistido. `[R]`
- Series de generación por inversor y por medidor, gráficas Chart.js. `[R]`
- Endpoints: `/generacion-solar/monitoring[/:id]`, `.../inverters-power`,
  `/generacion-solar/generacion-hoy`, `/generacion-solar/resumen-dia`,
  `/solar/{proyectos,generacion,comparacion,ranking,filtros}`,
  `POST /solar/reload-cache`.
- Vista comparativa y ranking de plantas (`SolarView.vue`, `GeneracionSolarView.vue`).

### 6.2 Informes mensuales — `/operaciones/informes-mensuales`, `/informes/:id`

Tres paneles: **Generar** · **Revisión y envío** · **Gestión de portafolios**.

- Generación del informe mensual por proyecto/portafolio (`POST /informes/`). `[W]`
- Edición por secciones (`PATCH /informes/:id/seccion`) y cambio de estado
  (`PATCH /informes/:id/estado`). `[W]`
- **Comentarios de revisión** con resolución (`/informes/:id/comentarios[...]`). `[W]`
- Vista previa en `iframe` y editor embebido.
- **Envío** (`POST /informes/:id/enviar`) e historial de envíos (`GET /informes/envios`). `[W]`
- Informe compuesto (`GET /informes/:id/compuesto`). `[R]`
- **Portafolios**: alta, edición, baja y asignación de proyectos por arrastre
  (`/portafolios`, `PATCH /portafolios/asignar`). `[W]`

### 6.3 Informe de puesta en marcha (O&M) — `/operaciones/informe-om`

Generación del informe de puesta en marcha por proyecto, con export a PDF.
`GET /informe-om/proyectos`, `GET|PUT /informe-om/:id`. `[W]`

### 6.4 Pólizas — `/operaciones/polizas`

Listado con filtros y edición de pólizas de los proyectos. `GET /polizas`,
`PUT /polizas/:id`. `[W]`

### 6.5 Gestión de fallas (vista de operaciones) — `/operaciones/gestion-fallas`

Vista operativa de 1.941 líneas con la gestión completa del ciclo de una falla.

---

## 7. Fallas y monitoreo

**Rutas:** `/fallas` (entrada, `MonitoreoView`), `/fallas/:id`

- Dos pestañas: **Fallas** y **Calendario**.
- Cuatro _buckets_: Activas · Alerta SLA · Cerradas · Todas, con colores y prioridades. `[R]`
- **Clasificación jerárquica por activo afectado**, no plana: el usuario elige primero el
  **sistema** (Red · Frontera · Inversores · Eventos adversos) y se despliegan solo las
  opciones de ese sistema. La estructura canónica vive en el backend y se consume por
  `GET /fallas/estructura`, sin duplicarla en el cliente.
  - Subtipos que **requieren detalle** (ej. `mantenimiento_red`).
  - `desconexion_sin_identificar` es un **estado temporal**: marca `pendiente_reclasificar` y
    debe reclasificarse con la causa definitiva.
  - **Las fallas viejas no se tocan**: conservan su `tipo_id`/`tipo_libre` y se muestran igual.
    La estructura es aditiva.
  - Diseño completo: `legacy/docs/superpowers/specs/2026-06-29-reporte-fallas-estructurado-design.md`
    y `2026-07-03-detalle-falla-clasificacion-design.md`.
- Alta, edición y baja de falla; catálogos (`GET /fallas/catalogos`). `[W]`
- **Seguimientos** (bitácora) por falla. `[W]`
- **Archivos y fotos**: carga, listado y borrado. Las credenciales de Google Drive viven solo
  en el backend; el navegador nunca habla con Google. `[W]`
- **Notificación** manual de una falla (`POST /fallas/:id/notificar`). `[W]`
- **Mapa de fallas** (MapLibre + teselas OSM). `[R]`
- Actividad del día (`GET /fallas/actividad-hoy`). `[R]`
- SLA: cálculo de alerta y vencimiento por prioridad.
- Caché de estructura de fallas en cliente (`utils/fallasEstructuraCache.js`).

**Vistas muertas a no migrar:** `FallasListView.vue`, `FallaDetalle.vue`.

---

## 8. Alertas

**Rutas:** `/alertas`, `/alertas/contratos-ppa`

Centro de alertas — «estado operacional de la plataforma». Tarjetas: Fallas activas · Fallas
críticas · Alarmas MGS · Alertas PPA · Contratos PPA · Fallas operativas. `[R]`

**Alertas de contratos PPA** (`GET /alertas/contratos-ppa`): proyectos huérfanos y contratos
GESCON duplicados, con acción de corrección de enlaces
(`POST /cumplimiento/fix-enlaces`). `[W]`

**Alarmas de desconexión (MGS)** — evaluadas por el backend cada 15 min y notificadas por
campana. Reglas (`legacy/docs/superpowers/specs/2026-06-08-alarmas-desconexion-design.md`):

| Tipo                  | Severidad | Condición                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------- |
| `FUENTE_UNICA`        | alerta    | El proyecto no tiene medidor Gaia: solo inversores, no se puede cruzar |
| `SIN_DATOS`           | alerta    | De día, ambas fuentes en 0                                             |
| `POSIBLE_DESCONEXION` | alerta    | De día, una fuente genera y la otra en 0                               |
| `RECUPERACION`        | info      | Vuelve a reportar normal tras una alarma                               |

Ventana de día 07:00–17:00 Colombia. Notifica solo cuando el estado **cambia** (anti-spam).

---

## 9. Fronteras comerciales

### 9.1 General — `/mem/fronteras`

Registro de fronteras comerciales: listado con filtros, alta, edición y baja.
`GET|POST /fronteras`, `PATCH|DELETE /fronteras/:id`. `[W]`
Bandeja de pendientes de Quoia con confirmar/ignorar
(`GET /fronteras/quoia/pendientes`, `.../confirmar`, `.../ignorar`). `[W]`

### 9.2 Reporte de energía — `/mem/reporte-energia`

Flujo mensual de reporte de energía por frontera. Vista compuesta: lista, detalle,
automatización y curva.

- Resumen y resumen histórico. `[R]`
- Detalle por frontera con **curva típica** y comparación. `[R]`
- **Exclusiones**: alta, edición y resolución de excepciones de medida. `[W]`
- Carga de Excel de terceros por frontera, y su borrado. `[W]`
- **Validación** por frontera (`POST /reporte-energia/fronteras/:id/validar`). `[W]`
- **Ejecución automatizada** con estado y cancelación
  (`POST /reporte-energia/ejecutar`, `GET .../estado`, `POST .../cancelar`). `[W]`
- Estado de Quoia (`GET /reporte-energia/estado-quoia`). `[R]`
- Export a Excel y **envío** (`POST /reporte-energia/enviar`). `[W]`

### 9.3 Reporte CGM — `/mem/…` + móvil

Envío del reporte CGM a operadores de red (`POST /reporte-cgm/enviar`) e historial de envíos.
Tiene versión móvil dedicada. `[W]`

---

## 10. Operadores de red

**Rutas:** `/mem/operadores-red`, `/mem/operadores-red/:id`

Catálogo de operadores de red y sus correos de contacto para el reporte CGM.
Alta, edición y contactos (alta, edición, baja). `[W]`
Mapa de operadores (`GET /mapa/operadores`). `[R]`

---

## 11. Registros CND/ASIC

**Rutas:** `/registros-cnd-asic`, `/registros-cnd-asic/:proyectoId`

Seguimiento del trámite de conexión de un proyecto ante CND/ASIC.

- Listado de proyectos en conexión con su estado. `[R]`
- Detalle con **máquina de estados** (`POST /registros-cnd/:id/transicion`). `[W]`
- **Documentos** del trámite: alta y baja. `[W]`
- **Equipos** registrados: alta y baja. `[W]`
- **Parámetros 93** y su validación (`GET|PUT /registros-cnd/:id/parametros-93`,
  `GET .../validacion-93`). `[W]`
- **Correos** del trámite (`POST /registros-cnd/:id/correos/:id`). `[W]`
- Recomputar alertas (`POST /registros-cnd/:id/alertas/recomputar`). `[W]`
- Creación por proyecto (`POST /registros-cnd/por-proyecto/:id`). `[W]`

---

## 12. Comercialización / MEM

### 12.1 Cumplimiento PPA — `/mem/cumplimiento`

La vista más grande de la aplicación (`CumplimientoV2View.vue`, **5.425 líneas**). Siete
pestañas: **Estrategia · Cumplimiento · Proyectos · Energía transada · Matriz anual · Balance
de energía · Revisión del mes**.

- Gráficas SVG construidas a mano (sin biblioteca): barras mensuales de generación vs.
  compromiso, con tooltips.
- **Simulador** de cumplimiento con arrastre.
- **Matriz anual** — matriz jerárquica _Contrato → Proyectos × 12 meses_ con indicadores y
  export a Excel con **fórmulas vivas, outline colapsable y estilo de marca**.
  - Regla de estado: por mes, **regla del mínimo**. Cada mes se evalúa contra su mínimo (real
    en meses cerrados, proyección de cierre en el mes actual, proyección a 30 días en futuros).
    El contrato **No cumple** si algún mes proyecta déficit; **Cumple** en caso contrario.
  - Alcance: solo contratos PPA de **venta** (los que tienen compromisos min/max).
  - Diseño: `legacy/docs/superpowers/specs/2026-06-25-cumplimiento-matriz-anual-design.md`.
- **Revisión del mes** (`cumplimientoRevision.js`) y export anual (`cumplimientoAnualExport.js`).
- Endpoints: `/cumplimiento/ppa/resumen`, `.../plantas-inscritas-por-mes`,
  `/cumplimiento/diagnostico`, `/cumplimiento/fix-enlaces`.

> Esta vista, por sí sola, debe tratarse como un sub-proyecto de la migración.

### 12.2 Descubrimientos en bolsa — `/mem/descubrimientos`

Exposición financiera por compras y excedentes de energía valorados a precio de bolsa. `[R]`

### 12.3 GESCON / ASIC — `/mem/gescon`

Registro de contratos ASIC/GESCON.

- Listado paginado con filtros y export a Excel con estilo de marca. `[R]`
- Alta de contrato (`POST /asic`), edición y baja. `[W]`
- **Modificación** y **terminación** de contrato como formularios propios
  (`POST /asic/modificacion`, `POST /asic/terminacion`). `[W]`
- Operaciones de mantenimiento de datos: `POST /asic/backfill-nombre-interno`,
  `POST /asic/backfill-terminaciones`. `[W]`
- Vigencia de contrato: `utils/ppaVigencia.js`, `MEM/gesconVigencia.js`.

### 12.4 Precio de bolsa — `/mem/precio-bolsa`

Precio de bolsa nacional por hora del SIMEM (dataset 709b84): tarjetas del mes, gráfica
diaria y tabla día × hora. `GET /facturacion/bolsa-simem?periodo=YYYY-MM`. `[R]`

Hasta el 2026-10-16 era una pestaña de SIMEM; ese día reemplazó a la página vieja
(precios de EVO + clima) y se retiraron Balance Energía (`/mem/balance`) y Clima & ENSO
(`/mem/clima`), con el proxy de EVO.

---

## 13. Garantías — `/garantias`

Dos pestañas: **Ajustes XM** y **Proyecciones**.

### 13.1 Ajustes XM

Procesamiento de los archivos de ajustes que publica XM.

- **Parser** de archivos XM por tipo: Semanales · Mensuales · TXF · TXR, cada uno con su
  pestaña (`useGarantiasParser.js`). `[R]`
- **DropZone** para carga de archivos y bloque de código con el detalle parseado.
- **Hoja madre**: consolidado.
- **Histórico** con gráfica (`HistoricoTab.vue`).
- Persistencia en backend (antes era `localStorage`): `GET|POST /garantias-ajustes`,
  `PATCH|DELETE /garantias-ajustes/:id`. `[W]`
- Edición completa de cada registro desde un diálogo. `[W]`
- **Descuento de facturas**: cruce de los ajustes contra facturas, con parseo de PDF
  (`useFacturasPDF.js`). `[W]`
- Export a Excel con estilo (`utils/excelExport.js`, `utils/formatters.js`).
- Diseño: `legacy/docs/superpowers/specs/2026-06-11-garantias-ajustes-backend.md` y
  `2026-06-11-garantias-parser-correcciones-y-descuento-facturas.md`.

### 13.2 Proyecciones

Proyección de garantías con parámetros simulables (`plantas_nuevas`, `kwh_planta_nueva`),
snapshot histórico y marcado de pagado.
`GET /garantias/proyecciones`, `POST .../snapshot`, `GET .../historial`,
`PUT .../pagado`. `[W]`
Plan de implementación: `legacy/docs/superpowers/plans/2026-08-12-garantias-06-frontend-proyecciones.md`.

---

## 14. Liquidaciones — `/liquidaciones`

Una sola vista con cinco pestañas, deep-link por `?tab=`
(`legacy/docs/REDISENO_LIQUIDACIONES.md`):

| Pestaña            | Contenido                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resumen**        | KPIs del período (ingresos, costos, neto, margen, liquidados, sin liquidar) con comparativo vs. mes anterior, ingresos por tipo, pipeline de los 8 estados y tendencia de 12 meses |
| **Proyectos**      | Árbol Proyecto → Año → Mes, con filtros persistidos (búsqueda, estado, tipo de venta)                                                                                              |
| **Inversionistas** | Árbol Inversionista → Proyecto → Período, con gráfica de barras                                                                                                                    |
| **Diferencia**     | Comparación entre versiones de liquidación                                                                                                                                         |
| **Facturación**    | Facturación de energía: bolsa, despacho, agrupaciones, emisión y orden                                                                                                             |

- Rutas viejas conservadas como redirecciones: `/liquidaciones/inversionista`,
  `/liquidaciones/cargar-excel`, `/liquidaciones/minigranjas`.
- Filtro por tipo desde el menú: `?tipo=minigranja`, `?tipo=autoconsumo`.

### 14.1 Detalle de liquidación — `/liquidaciones/:id`

1. Encabezado: proyecto, período, estado y un único enlace al Estado de Resultados en Drive.
2. **Ingresos vs. costos**: barras por ítem comparando el mes contra el **promedio histórico**
   del proyecto, con variación porcentual.
3. **Estado de resultados** en cascada: Ingresos → Comercialización/Bolsa → Costos OPEX → Neto
   (`utils/liquidaciones.js` → `construirEstadoResultados()`).
4. Paneles de Resumen, Facturación y Diferencia.
5. Tabla de detalle por inversionista.
6. Edición de resumen y de estado (`PATCH /liquidaciones/:id`), informe
   (`GET|PUT /liquidaciones/:id/informe`). `[W]`

### 14.2 Liquidación en PDF — `/liquidaciones/:id/pdf`

Vista imprimible por inversionista, con estilos de impresión propios. `[R]`

### 14.3 API de liquidaciones de Unergy (proxy)

`api/liquidacionesApi.js` encapsula el proxy del backend a `api.unergy.io` — el navegador nunca
habla con esa API porque las credenciales de la cuenta de servicio viven en el backend.

- **Versiones del ciclo**: `txf` (inicial) y `tx3`…`tx8` (reliquidaciones).
- Tareas asíncronas con estado normalizado (`en_curso` · `exito` · `fallo`) y _polling_.
- Límites al subir facturas: 20 por lote, 10 MB por factura.
- Errores tipados: `TareaFallida`, `TareaSinRespuesta`.
- Ejecución de ciclo, ciclo IPP y diagnóstico. `[W]`

---

## 15. Panel Contable — `/panel-contable`

Cinco pestañas: **Preliquidación · Oficial · Selección · Diferencia · Clasificación**, con
selector de mes, año, tipo de carga (preliquidación / liquidación oficial) y tipo de
liquidación (normal / NITRO).

- **Selección** (pestaña propia): qué proyectos liquidar — flags de liquidar ingresos,
  liquidar costos y generar mandatos, acciones masivas y **consecutivos contables**, con
  switch interno preliquidación/oficial. `[W]`
- **Preliquidación / Oficial**: abren directo en el detalle contable limpio. `[R]`
- **Diferencia** entre preliquidación y oficial. `[R]`
- **Clasificación** de líneas contables (`GET|POST /panel-contable/clasificacion`). `[W]`
- Fuentes de ingreso y sus alias (`/panel-contable/fuente-ingreso`,
  `/panel-contable/alias-fuente`, `/panel-contable/mapeo-celda`). `[W]`
- Carga de estado de resultados (`POST /panel-contable/cargar-er`). `[W]`
- Soportes por línea: carga y borrado. `[W]`
- Reasignación de consecutivos (`POST /panel-contable/reasignar-consecutivos`). `[W]`
- Export a Excel en el formato del Excel maestro (hoja «Ajustes»).
- Diseño: `legacy/docs/superpowers/specs/2026-08-06-panel-contable-intuitivo-design.md`.

---

## 16. Finanzas

Un conjunto de herramientas especializadas, cada una con su ruta.

| Ruta                                | Qué hace                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/finanzas/costos`                  | Costos por proyecto y período, con export a Excel                                                     |
| `/finanzas/costos-comercializacion` | Costos e ingresos fijos por proyecto                                                                  |
| `/finanzas/verificacion-costos`     | Conceptos que recibe cada proyecto y su AC Power (GD y minigranjas en operación)                      |
| `/finanzas/ids-proyectos`           | Códigos SIC de liquidaciones e IDs de Quoia                                                           |
| `/finanzas/contratos-energia`       | Contratos de energía y sus proyectos vinculados                                                       |
| `/finanzas/despachos-liquidados`    | Energía ya liquidada por proyecto y concepto                                                          |
| `/finanzas/consumo`                 | Consumo horario por proyecto y día                                                                    |
| `/finanzas/facturas-xm`             | Facturas del período y su estado de alistamiento para repartir                                        |
| `/finanzas/estados-resultados`      | Archivos generados en Drive: estados de resultados y cruce de facturas, con descarga individual y ZIP |
| `/finanzas/mandatos`                | Mandatos: períodos, resumen, PDF, carga de firmados y de ZIP                                          |
| `/validador-mandatos`               | Validador y conciliador de mandatos (`utils/conciliacionMandatos.js`, con pruebas)                    |
| `/finanzas/descarga-xm`             | Descarga de archivos de XM a través del **agente local** en `127.0.0.1:8420`                          |

Además, sin entrada propia en el menú pero presentes como paneles:

- **Arriendos** — información, operaciones, proveedor, indexación por IPC
  (`CalculoIpcPopover`), y **carga masiva por ZIP** con parseo de PDF y
  **validación de seguridad del ZIP** (`utils/zipSecurityValidator.js`, con pruebas).
- **OMA** — operaciones y proveedor, con historial de indexaciones, facturas, enlace de factura
  y asignación de facturas sin match.
- **Starlink** — procesamiento de facturas PDF, mapeo a minigranjas y export a Excel.

Reglas de negocio con pruebas ya existentes: `conciliacionMandatos`, `financialCalculations`,
`parseCOP`, `validacionContratos`, `zipSecurityValidator`.

---

## 17. Administración

**Rutas:** `/admin/usuarios`, `/admin/diagnostico`

- **Usuarios**: listado, alta, edición (`GET|POST /usuarios`, `PATCH /usuarios/:id`). `[W]`
- **API Keys** por usuario, en diálogo:
  - La generación es **backend-only**; el frontend solo llama a `/api-keys`.
  - La key en claro se muestra **una sola vez** tras crearla y no es recuperable.
  - Las existentes se listan **enmascaradas** (`key_prefix` + `…`).
  - Activar/desactivar (`PATCH /api-keys/:id/toggle`) y revocar. `[W]`
- **Diagnóstico de enlaces**: mapeo Contrato → GESCON → Planta → `sub_project` de la API
  Unergy. Hoy restringido a un email concreto. `[R]`

---

## 18. App móvil PWA (`/m/*`)

Aplicación **independiente**, con su propio login, layout y navegación. Vive en el mismo repo y
el mismo deploy, aislada por ruta y por carpeta.

| Ruta             | Vista                                                                                              | Rol                    |
| ---------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| `/m/login`       | Login con token de 30 días                                                                         | público                |
| `/m/solar`       | Generación en vivo: selector, gráfica combinada inversores + medidor con línea «ahora», reconexión | todos                  |
| `/m/fallas`      | Fallas: lista, filtros, registrar                                                                  | todos                  |
| `/m/coordinador` | Bandeja del coordinador de fallas                                                                  | `coordinador`, `admin` |
| `/m/tecnico`     | Bandeja del técnico                                                                                | `tecnico`              |
| `/m/resumen`     | Resumen del día                                                                                    | todos                  |
| `/m/reporte-cgm` | Reporte CGM desde el móvil                                                                         | todos                  |

- **Reconexión de plantas** desde el celular: hoja inferior con la lógica de reconexión
  (`GET /reconectadores/estados`, `POST /reconectadores/:id/comando`). `[W]`
- Hojas inferiores para detalle de falla, creación de falla, inversores y notificaciones.
- Reusa los mismos endpoints de fallas que la web.
- PWA instalable: `public/manifest.webmanifest` + `public/sw-mobile.js`, service worker
  registrado solo en producción con scope `/m/`.
- Redirección por rol al entrar: `coordinador` → `/m/coordinador`, `tecnico` → `/m/tecnico`,
  resto → `/m/solar`.
- Diseños: `legacy/docs/superpowers/specs/2026-06-08-app-movil-solar-design.md`,
  `2026-06-08-fallas-movil-design.md`, `2026-06-09-resumen-dia-movil-design.md`.

**Ganchos en archivos compartidos** (lo único que la app móvil toca fuera de su carpeta):
router, `App.vue` (layout a pantalla completa si `meta.mobile`), interceptor 401 del cliente
HTTP, `loginMobile()` del store, e `index.html`.

---

## 19. Candidatos a no migrar

Se listan explícitamente para que la decisión sea consciente y no un olvido. **Requieren
confirmación** antes de descartarse.

| Elemento                                                      | Motivo                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `views/Fallas/FallasListView.vue`                             | Muerto: la entrada de la ruta es `MonitoreoView`                                     |
| `views/Fallas/FallaDetalle.vue`                               | Muerto: sustituido por `FallaDetailView.vue`                                         |
| `views/MEM/MemPlaceholder.vue`                                | Plantilla de placeholder genérica                                                    |
| `views/Liquidaciones/LiquidacionesListView.vue`               | Sustituida por las pestañas de `LiquidacionesView`                                   |
| `views/Liquidaciones/LiquidacionesPorInversionistaView.vue`   | Idem, es hoy una pestaña                                                             |
| `views/Contratos/ContratosListView.vue`                       | Su ruta `/servicios` salió del menú a favor de `/servicios-unificado`                |
| `views/Clientes/*`, `views/Proyectos/*` como entradas de menú | Siguen vivas por navegación, pero salieron del menú principal                        |
| `auth.previewLogin()` y `?preview=`                           | Utilidad solo-dev; el template ofrece `NUXT_PUBLIC_AUTH_ENABLED=false` para lo mismo |
| `assets/*.js` (datasets estáticos)                            | Verificar si siguen en uso o si el backend ya los sirve                              |
| `data/pagoarriendos.json`                                     | Verificar si es dato de producción o de prueba                                       |
| `components/reports/*`                                        | Verificar consumidores: parecen de una iteración anterior                            |

---

## 20. Decisiones abiertas — a validar antes de ejecutar

1. **Auth.** ¿El backend puede emitir el refresh token en cookie `httpOnly` (lo que su propio
   `SECURITY.md` pide desde hace tiempo), o la fase 1 debe conservar el esquema de JWT en
   `localStorage` y migrarlo en una fase posterior? Esto condiciona el orden del roadmap.
2. **Alcance de la app móvil.** ¿Entra en esta migración o se queda en el legacy hasta una
   segunda etapa? Es un producto con su propio ciclo y su propio layout.
3. **Vistas placeholder.** ¿Balance de energía y las tarjetas «Próximamente» se migran vacías o
   se aprovecha para implementarlas / retirarlas?
4. **Rol `admin`.** El template no tiene bypass. ¿Se concede a `admin` la totalidad de los
   permisos explícitamente (recomendado) o se quiere un comportamiento distinto?
5. **Restricción por email** en `/admin/diagnostico` y `/admin/usuarios`: ¿se sustituye por un
   permiso, se elimina, o se conserva tal cual?
6. **`OperacionView.vue`** con componentes definidos como `template:` string: ¿se activa el
   compilador de runtime de Nuxt como puente, o se refactoriza a SFC desde la fase 1?
7. **Modo de render.** ¿La aplicación se queda como SPA (`ssr: false`) — que es lo que es hoy y
   lo que menos riesgo introduce — o se aprovecha el SSR de Nuxt? Es la decisión de mayor
   impacto sobre el esfuerzo total de la fase 3.
8. **Chart.js vs. Unovis.** Reescribir 12 gráficas tiene costo real. ¿Se migran todas al
   `chart` de shadcn o se conserva Chart.js como excepción documentada?
