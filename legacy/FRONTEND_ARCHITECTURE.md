# Unergy Operaciones Frontend -- Architecture

## Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Framework | Vue 3.4 (Composition API, `<script setup>`)         |
| Router    | vue-router 4.3 (history mode, lazy loading)         |
| State     | Pinia 2.1 (single `auth` store)                     |
| HTTP      | Axios 1.7 with interceptors                         |
| UI Kit    | PrimeVue 4.0 (Aura theme preset)                    |
| Icons     | PrimeIcons 7.0                                      |
| CSS       | Tailwind 3.4 + inline styles for brand colors       |
| Build     | Vite 5.3                                            |
| Deploy    | Docker (node:20-alpine build -> nginx:alpine serve) |

## Design System

### Brand Colors (tailwind.config.js)

| Token                 | Hex       | Usage                                                 |
| --------------------- | --------- | ----------------------------------------------------- |
| `unergy-purple`       | `#915BD8` | Primary actions, active nav, icons, links             |
| `unergy-deep`         | `#2C2039` | Sidebar bg, headings, dark text                       |
| `unergy-avena`        | `#FDFAF7` | Page background, body bg                              |
| `unergy-yellow`       | `#F6FF72` | Solar/highlight accents (peak hour bars, CTA buttons) |
| `unergy-purple-light` | `#B08AE2` | Hover states                                          |
| `unergy-purple-dark`  | `#6E3FB8` | Button hover                                          |
| `unergy-deep-light`   | `#3D2F52` | Sidebar hover                                         |

### Semantic Colors (inline, not tokenized)

| Color          | Hex                             | Meaning                          |
| -------------- | ------------------------------- | -------------------------------- |
| Success/OK     | `#2e7d32`                       | Compliance met, vigente          |
| Deficit/Danger | `#D64455`                       | Under-generation, falla, deficit |
| Warning/Excess | `#F0C040`                       | Over-generation, excedente       |
| Muted text     | `#7a6e8a`, `#9b89b5`, `#6b5a8a` | Labels, secondary text           |
| Border         | `#e8e0f0`                       | Cards, dividers                  |

### Fonts

- **Body**: Lato (Google Fonts), fallback system-ui
- **Display**: Forma DJR Display (declared in config, not loaded -- unused)

### PrimeVue Components Used

DataTable, Column, Button, Dialog, Tag, Select, InputText, InputNumber, DatePicker, Textarea, TabView, TabPanel, SelectButton, IconField, InputIcon, MultiSelect, ProgressSpinner, Message, Divider, Toast, ConfirmDialog, Tooltip (directive)

### Global Components

- `InfoField` -- registered globally via `app.component()`. Displays label/value pairs.

## Route Map

| Path                           | Name                          | Component                               | Auth                        | Description                                                            |
| ------------------------------ | ----------------------------- | --------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `/login`                       | Login                         | `LoginView.vue`                         | public                      | JWT login form                                                         |
| `/`                            | --                            | redirect `/dashboard`                   | --                          | --                                                                     |
| `/dashboard`                   | Dashboard                     | `DashboardView.vue`                     | yes                         | KPI cards (projects, clients count) + welcome                          |
| `/clientes`                    | Clientes                      | `ClientesListView.vue`                  | yes                         | Client list with search, create/edit dialog                            |
| `/clientes/:id`                | ClienteDetalle                | `ClienteDetailView.vue`                 | yes                         | 3-tab detail: Info, Servicios, Documentos                              |
| `/proyectos`                   | Proyectos                     | `ProyectosListView.vue`                 | yes                         | Project list with filters, create/delete                               |
| `/proyectos/:id`               | ProyectoDetalle               | `ProyectoDetailView.vue`                | yes                         | 4-tab detail: General, Tecnico, Inversionistas, Servicios              |
| `/proyectos/:id/ppa`           | ProyectoPPA                   | `PPAView.vue`                           | yes                         | PPA contracts for a specific project                                   |
| `/servicios`                   | Servicios                     | `ContratosListView.vue`                 | yes                         | 4-service card selector (PPA/Representacion/Operacion/REC) + DataTable |
| `/contratos/:id`               | ContratoDetalle               | `ContratoDetailView.vue`                | yes                         | 4-tab PPA detail: Datos, Cantidades, Tarifas, Contratos ASIC           |
| `/fallas`                      | Fallas                        | `MonitoreoView.vue`                     | admin/operaciones/monitoreo | Full-page iframe to backend `/monitoreo`                               |
| `/fallas/:id`                  | FallaDetalle                  | `FallaDetailView.vue`                   | admin/operaciones/monitoreo | Fault detail with edit, seguimientos timeline                          |
| `/liquidaciones`               | Liquidaciones                 | `LiquidacionesListView.vue`             | admin/liquidaciones         | 3-level tree: proyecto -> year -> month                                |
| `/liquidaciones/inversionista` | LiquidacionesPorInversionista | `LiquidacionesPorInversionistaView.vue` | admin/liquidaciones         | 3-level tree: investor -> project -> period                            |
| `/liquidaciones/:id`           | LiquidacionDetalle            | `LiquidacionDetailView.vue`             | admin/liquidaciones         | Financial detail: ingresos, costos, mandatos                           |
| `/alertas`                     | Alertas                       | `AlertasView.vue`                       | yes                         | Hub with 3 alert modules (2 active, 1 placeholder)                     |
| `/alertas/contratos-ppa`       | AlertasContratosPPA           | `AlertasContratosPPAView.vue`           | yes                         | Orphan projects + duplicate GESCON contracts                           |
| `/alertas/monitoreo`           | AlertasMonitoreo              | `AlertasMonitoreoView.vue`              | yes                         | Active faults + minigranja real-time status                            |
| `/mem/gescon`                  | MemGescon                     | `GesconView.vue`                        | yes                         | ASIC/GESCON contract registry with create form                         |
| `/mem/fronteras`               | MemFronteras                  | `FronterasView.vue`                     | yes                         | **Placeholder** -- "Modulo en desarrollo"                              |
| `/mem/precio-bolsa`            | MemPrecioBolsa                | `PrecioBolsaView.vue`                   | yes                         | XM spot prices (SVG chart) + ENSO/trading signals                      |
| `/mem/balance`                 | MemBalance                    | `BalanceView.vue`                       | yes                         | **Placeholder** -- "Modulo en desarrollo"                              |
| `/mem/cumplimiento`            | MemCumplimiento               | `CumplimientoView.vue`                  | yes                         | Energy compliance: general monitoring + per-contract                   |
| `/mem/cumplimiento-v2`         | MemCumplimientoV2             | `CumplimientoV2View.vue`                | yes                         | Annual compliance chart + drag-and-drop simulator                      |
| `/:pathMatch(.*)*`             | --                            | redirect `/dashboard`                   | --                          | Catch-all                                                              |

## Sidebar Navigation Structure

```
[No label]
  Clientes          /clientes
  Proyectos         /proyectos
  Servicios         /servicios
  Fronteras         /mem/fronteras

Operaciones
  Monitoreo         /fallas          (admin/operaciones/monitoreo)

Finanzas
  Liquidaciones     /liquidaciones   (admin/liquidaciones)
  Por Inversionista /liquidaciones/inversionista (admin/liquidaciones)

MEM
  GESCON            /mem/gescon
  Precio de bolsa   /mem/precio-bolsa
  Balance           /mem/balance
  Cumplimiento      /mem/cumplimiento
  Cumplimiento v2   /mem/cumplimiento-v2

Alertas
  Alertas           /alertas
```

## File Inventory

### Views (42 files)

```
src/views/
  LoginView.vue
  DashboardView.vue
  Clientes/
    ClientesListView.vue     -- DataTable + search + create/edit dialog
    ClienteDetailView.vue    -- Tabs: Info, Servicios, Documentos (file upload)
    ClienteForm.vue          -- Reusable form (create + inline edit)
  Proyectos/
    ProyectosListView.vue    -- DataTable + filters + delete confirm
    ProyectoDetailView.vue   -- Tabs: General, Tecnico, Inversionistas, Servicios
    ProyectoForm.vue         -- Form with P50/P90 simulation fields
  Contratos/
    ContratosListView.vue    -- 4-service card selector + PPA/service tables
    ContratoDetailView.vue   -- Tabs: Datos, Cantidades, Tarifas, ASIC
    PPAContratoWizard.vue    -- Multi-step wizard for PPA creation
    ContratoServicioWizard.vue -- Multi-step wizard for service contracts
  Fallas/
    MonitoreoView.vue        -- Full-page iframe embedding
    FallasListView.vue       -- (unused, MonitoreoView is the entry)
    FallaDetailView.vue      -- Detail with edit, seguimientos, SLA tracking
    FallaDetalle.vue         -- (legacy, unused)
    FallaForm.vue            -- Fault creation/edit form
  Liquidaciones/
    LiquidacionesListView.vue           -- 3-level tree by project
    LiquidacionesPorInversionistaView.vue -- 3-level tree by investor
    LiquidacionDetailView.vue           -- Full financial breakdown
    TablaDetalleLiquidacion.vue         -- Reusable income/cost detail table
  Alertas/
    AlertasView.vue           -- Module hub (3 cards)
    AlertasContratosPPAView.vue -- Orphan + duplicate alerts
    AlertasMonitoreoView.vue  -- Faults + minigranja status
  Servicios/
    PPAView.vue               -- Project-scoped PPA management
  MEM/
    GesconView.vue            -- ASIC contract CRUD
    PrecioBolsaView.vue       -- Spot prices + ENSO forecast
    FronterasView.vue         -- PLACEHOLDER
    BalanceView.vue           -- PLACEHOLDER
    CumplimientoView.vue      -- Monthly compliance monitoring
    CumplimientoV2View.vue    -- Annual chart + simulator
    MemPlaceholder.vue        -- Generic placeholder template
```

### Components (4 files)

```
src/components/
  AppSidebar.vue          -- Fixed 256px sidebar, role-filtered nav
  AppTopbar.vue           -- 56px header, page title, logout
  InfoField.vue           -- Label/value display (global component)
  NuevoClienteDialog.vue  -- Client creation dialog (with doc links)
```

### Other Source Files

```
src/main.js              -- App bootstrap, PrimeVue/Pinia/Router setup
src/api/client.js        -- Axios instance, auth interceptor, 401 redirect
src/stores/auth.js       -- Pinia store: JWT login/logout, role check
src/router/index.js      -- Route definitions, beforeEach guard
src/assets/main.css      -- Tailwind directives + base styles
```

## API Integration

### Client Configuration

- Base URL: `/api/v1` (proxied by Vite in dev, nginx in prod)
- Auth: Bearer token from `localStorage.token`
- 401 handling: auto-clear token + redirect to `/login`
- Backend: `https://operaciones.uner.gy` (Railway)

### Secondary API

- EVO API: `/api/v1/evo/*` proxied to `EVO_API_URL` (default `localhost:18800`)
- Used by: PrecioBolsaView (spot prices, clima forecast)

### API Endpoints Consumed

| Endpoint                                  | Method                | Used By                               |
| ----------------------------------------- | --------------------- | ------------------------------------- |
| `/auth/token`                             | POST                  | auth store (form-urlencoded login)    |
| `/clientes`                               | GET/POST              | ClientesListView                      |
| `/clientes/:id`                           | GET/PATCH             | ClienteDetailView                     |
| `/clientes/:id/servicios`                 | POST/DELETE           | ClienteDetailView                     |
| `/clientes/:id/documentos`                | POST/PATCH/DELETE     | ClienteDetailView                     |
| `/clientes/:id/documentos/:id/archivo`    | POST                  | ClienteDetailView (multipart upload)  |
| `/proyectos`                              | GET/POST/DELETE       | ProyectosListView, ProyectoDetailView |
| `/proyectos/:id`                          | GET/PATCH             | ProyectoDetailView                    |
| `/ppa`                                    | GET                   | ContratosListView                     |
| `/ppa/:id`                                | GET/PATCH             | ContratoDetailView                    |
| `/ppa/:id/tarifas`                        | PUT                   | ContratoDetailView                    |
| `/ppa/:id/compromisos`                    | PUT                   | ContratoDetailView                    |
| `/contratos-servicio`                     | GET                   | ContratosListView                     |
| `/asic`                                   | GET/POST              | GesconView, ContratoDetailView        |
| `/fallas`                                 | GET/POST/PATCH/DELETE | FallaDetailView                       |
| `/liquidaciones`                          | GET/POST              | LiquidacionesListView                 |
| `/liquidaciones/vistas/por-proyecto`      | GET                   | LiquidacionesListView                 |
| `/liquidaciones/vistas/por-inversionista` | GET                   | LiquidacionesPorInversionistaView     |
| `/liquidaciones/:id`                      | GET/PATCH             | LiquidacionDetailView                 |
| `/cumplimiento/ppa`                       | GET                   | CumplimientoView, CumplimientoV2View  |
| `/cumplimiento/ppa/:id/anual`             | GET                   | CumplimientoV2View                    |
| `/cumplimiento/ppa/resumen-anual`         | GET                   | CumplimientoV2View                    |
| `/cumplimiento/simulador`                 | GET                   | CumplimientoV2View                    |
| `/alertas/ppa/health`                     | GET                   | AlertasContratosPPAView               |
| `/alertas/monitoreo/*`                    | GET                   | AlertasMonitoreoView                  |
| `/evo/dailyspot/latest`                   | GET                   | PrecioBolsaView                       |
| `/evo/clima/forecast`                     | GET                   | PrecioBolsaView                       |

## State Management

- **Single Pinia store** (`auth`): token, user object, role, `can(...roles)` helper
- **No other stores**: all view state is local (`ref`/`reactive` in each view)
- **Auth flow**: JWT stored in `localStorage`, payload decoded client-side for user info
- **Role system**: `admin`, `operaciones`, `monitoreo`, `liquidaciones` -- admin bypasses all checks

## Common Patterns

1. **List views**: `onMounted(load)` -> paginated `api.get()` -> `DataTable` with lazy pagination
2. **Detail views**: `onMounted` fetches single record, displays in tabs (TabView or custom tabs)
3. **Inline edit**: toggle `editing` flag, swap between `InfoField` read mode and form inputs
4. **Excel paste import**: `Textarea` + `@paste` handler + tab/comma split parser (tarifas, cantidades)
5. **Custom SVG charts**: no charting library -- hand-built SVG with computed bar positions (CumplimientoV2, PrecioBolsa)
6. **Debounced search**: `setTimeout` 350ms on input for server-side filtering
7. **Toast notifications**: `useToast()` from PrimeVue for success/error feedback
8. **Multi-step wizards**: step counter + conditional template blocks (PPAContratoWizard, ContratoServicioWizard)

## Mobile Responsiveness

| Area                 | Status                                                                |
| -------------------- | --------------------------------------------------------------------- |
| Login                | Responsive (max-w-sm, mx-4 mobile margin)                             |
| Sidebar              | **Fixed 256px** -- no collapse/hamburger on mobile. Breaks on <768px. |
| Topbar               | Email hidden on sm, logout text hidden on sm                          |
| Dashboard KPIs       | Responsive grid (1/2/4 cols)                                          |
| DataTables           | Horizontal scroll on narrow screens                                   |
| Dialogs              | Breakpoints set (95vw on mobile)                                      |
| CumplimientoV2 chart | SVG viewBox scales, but tooltips may overflow                         |
| Simulator            | Horizontal scroll for contract columns                                |
| Overall              | **Not mobile-ready** -- sidebar has no responsive behavior            |

## Placeholder / Incomplete Views

| View                         | Status                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| Fronteras (`/mem/fronteras`) | Placeholder "Modulo en desarrollo"                               |
| Balance (`/mem/balance`)     | Placeholder "Modulo en desarrollo"                               |
| Alertas Fronteras            | Card exists but `enabled: false` with "Proximamente"             |
| Dashboard                    | KPIs for fallas and liquidaciones always show null (not fetched) |
| FallasListView               | File exists but unused (MonitoreoView is the route entry)        |
| FallaDetalle.vue             | Legacy file, unused (FallaDetailView.vue is the active one)      |

## Missing Features for a Full Operations Platform

### High Priority

- **Collapsible sidebar / mobile hamburger menu**: sidebar is fixed 264px, no responsive breakpoint
- **Dashboard KPIs**: fallas and liquidaciones counts are hardcoded `null` -- need API calls
- **Dashboard charts**: no generation overview, no revenue trend, no upcoming deadlines
- **Fronteras module**: placeholder only -- needs frontier management (assignment, expiry tracking)
- **Balance module**: placeholder only -- needs energy balance visualization
- **User management**: no users/roles admin view (roles exist in auth but no management UI)
- **Notifications/real-time**: no WebSocket or SSE -- all data is fetch-on-mount only
- **Bulk operations**: no multi-select actions on any DataTable

### Medium Priority

- **Reporting / PDF export**: no export functionality anywhere (liquidaciones, cumplimiento)
- **Audit trail**: no activity log or change history visible in UI
- **Search global**: no cross-module search
- **Dark mode**: `darkModeSelector: '.dark'` configured but no toggle implemented
- **Date range generation charts**: CumplimientoV2 has annual view but no multi-year comparison
- **Email integration**: liquidaciones have no "send to client" workflow from UI
- **Contract renewal alerts**: expiring contracts have visual warning but no notification system
- **Inversionista CRUD**: investors appear in liquidaciones but have no dedicated management view

### Low Priority / Polish

- **Loading skeletons**: most views use ProgressSpinner, no skeleton placeholders
- **Empty state illustrations**: most empty states are text-only
- **Keyboard shortcuts**: none implemented
- **Breadcrumbs**: inconsistent (some views have them, some use back button only)
- **Error boundaries**: no global error handler component
- **i18n**: hardcoded Spanish, no internationalization framework
- **Test suite**: no tests (no test runner in devDependencies)
- **PWA**: no service worker or manifest
- **Accessibility**: no ARIA labels beyond PrimeVue defaults

## Deployment

- **Build**: `npm run build` -> `dist/` (Vite)
- **Docker**: 2-stage Dockerfile (node:20-alpine build, nginx:alpine serve)
- **Proxy**: nginx forwards `/api/` and `/monitoreo/` to `http://backend:8000`
- **SPA routing**: nginx `try_files $uri $uri/ /index.html`
- **Vercel**: `vercel.json` present (alternative deployment target)
- **Backend**: Railway (`backend-production-63d8.up.railway.app`)
