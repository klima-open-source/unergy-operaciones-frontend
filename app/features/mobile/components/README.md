# `features/mobile/` — App móvil "Unergy Solar"

App **independiente** del resto de la plataforma. Vive en el mismo repo y el mismo deploy,
pero está **aislada por ruta y por carpeta**: todo su código propio está aquí dentro.

> **Regla para el equipo:** si NO estás trabajando en la app móvil, no necesitas tocar
> nada de esta carpeta. Y para cambiar la app móvil, en el 95% de los casos solo se
> edita aquí dentro. Los "ganchos" en archivos compartidos (abajo) son mínimos y estables.

## Qué es

PWA instalable para ver generación solar en tiempo real, reconectar plantas y llevar la
bitácora de fallas desde el celular. No pasa por la UI de la plataforma: tiene su propio
login, su propio layout y su propia navegación inferior.

## Rutas

Las páginas viven en `app/pages/m/**` y son puentes de una línea: importan la vista de
aquí y declaran `definePageMeta({ layout: 'legacy-blank', mobile: true })`.

| Ruta             | Vista                             | Rol                    |
| ---------------- | --------------------------------- | ---------------------- |
| `/m`             | → `/m/solar`                      | —                      |
| `/m/login`       | `MobileLoginView.vue`             | público                |
| `/m/solar`       | `MobileSolarView.vue`             | todos menos los de abajo |
| `/m/fallas`      | `MobileFallasView.vue`            | todos                  |
| `/m/coordinador` | `MobileCoordinadorFallasView.vue` | `coordinador`, `admin` |
| `/m/tecnico`     | `MobileCoordinadorFallasView.vue` | `tecnico`              |
| `/m/resumen`     | `MobileResumenView.vue`           | todos                  |
| `/m/reporte-cgm` | `MobileReporteCGMView.vue`        | todos                  |

`/m/tecnico` reusa la vista del coordinador: `MobileTecnicoFallasView.vue` dependía
entera de `asignado_a_id`, que se eliminó en la auditoría de 2026-09-02.

## Contenido

```
app/features/mobile/
├── access.ts                  # a dónde aterriza y a dónde se redirige cada rol (puro)
├── access.test.ts
├── types.ts                   # tipos de `/reconectadores` (el resto vive en su slice)
├── services/
│   └── reconectadores.ts      # GET /reconectadores/estados, POST /{id}/comando
└── components/
    ├── Mobile*View.vue        # una vista por ruta
    ├── solarSeries.js         # extractores de series (inversores/medidor)
    ├── usePwa.js              # registra el service worker (solo en PROD, scope /m/)
    └── components/
        ├── ProjectLiveChart.vue     # inversores + medidor, con la línea "ahora"
        ├── ReconnectSheet.vue       # hoja inferior de reconexión
        ├── ReconnectorPanel.vue     # estado del reconectador
        ├── InvertersSheet.vue       # detalle por inversor
        ├── NotificationsSheet.vue   # campana: notificaciones del día
        ├── FallaDetailSheet.vue     # detalle de falla + seguimientos
        ├── FallaCreateSheet.vue     # registrar falla
        └── MobileTabBar.vue         # navegación inferior
```

Las fallas reusan los endpoints `/fallas`, `/fallas/catalogos`, `/fallas/{id}` y
`/fallas/{id}/seguimientos` — los mismos que la vista web de gestión de fallas.

## Los tres archivos que hacen que la PWA sea una PWA

Se listan juntos porque se rompen juntos y en silencio: la app sigue cargando en el
navegador, solo deja de ser instalable.

| Archivo                     | Qué aporta                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| `public/manifest.webmanifest` | nombre, iconos, `start_url: /m/solar`, `scope: /m/`, `standalone`   |
| `public/sw-mobile.js`         | service worker network-first; se registra con scope `/m/`           |
| `nuxt.config.ts` → `app.head` | `<link rel="manifest">`, metas `apple-*`, `viewport-fit=cover`      |

El tercero es el que se perdió al migrar de Vite a Nuxt: en el legacy vivía en
`index.html`, un archivo que Nuxt no usa. Con `ssr: false` **no sirve** ponerlo en un
`useHead` de componente — iOS lee el manifiesto y los metas `apple-*` al momento de
"Añadir a pantalla de inicio", y `viewport-fit=cover` gobierna el primer pintado, del
que dependen los `env(safe-area-inset-*)` de cada cabecera y de la barra inferior.

Al tocar `sw-mobile.js` hay que **subir el número de `CACHE`**: `activate` borra toda
caché con otro nombre, y es lo único que saca del dispositivo un shell viejo.

## "Ganchos" en archivos compartidos

Unas pocas líneas en archivos de la plataforma. Cambiarlos puede afectar a la web, así
que tratar con cuidado.

| Archivo                                          | Qué agrega para la app móvil                                       |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `app/middleware/mobile.global.ts`                | aplica `access.ts` a todo `meta.mobile`                            |
| `app/middleware/auth.global.ts`                  | deja pasar de largo `/m/*`: lo gobierna el de arriba               |
| `app/types/route-meta.d.ts`                      | declara `meta.mobile`                                              |
| `app/layouts/legacy-blank.vue`                   | pantalla completa, sin sidebar ni topbar                           |
| `app/core/client.ts`                             | en 401, si estás en `/m/…` redirige a `/m/login` (no a `/login`)   |
| `app/composables/useAuth.ts`                     | `signInMobile()` → token de larga duración                         |
| `app/features/auth/services/operaciones-auth.ts` | `POST /api/v1/auth/token/mobile`                                   |
| `nuxt.config.ts`                                 | el `app.head` de la tabla anterior                                 |

`AUTH_ROUTE_PERMISSIONS` **no declara ninguna página móvil** a propósito: el
deny-by-default de la web decide "permitido/denegado", y aquí la decisión es "a cuál de
las pantallas propias", que es otra cosa. Ver el comentario de cabecera de `access.ts`.

## Backend asociado (repo `Backend Operaciones`)

- `POST /api/v1/auth/token/mobile` — login con token largo (`MOBILE_JWT_EXPIRE_MINUTES`, 30d).
- Reusa endpoints existentes: `/generacion-solar/monitoring[/{id}]`, `/reconectadores/estados`,
  `/reconectadores/{id}/comando`. **No** se modificó la lógica de monitoreo ni de reconexión.

Diseños en `legacy/docs/superpowers/specs/`: `2026-06-08-app-movil-solar-design.md`,
`2026-06-08-fallas-movil-design.md`, `2026-06-09-resumen-dia-movil-design.md`.
