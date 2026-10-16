# Inventario congelado de rutas

> Generado desde `legacy/src/router/index.js` en la Fase 0. **No se edita a mano.**
> Es la lista de verificación de las fases 1 y 2: al terminar cada una, las 67
> rutas con componente deben cargar y renderizar lo mismo que el legacy.

| Total de entradas | Con componente | Redirecciones |
| ----------------- | -------------- | ------------- |
| 75                | 67             | 8             |

## Cómo se usa

- **Fase 1** — cada ruta con componente se convierte en una página delgada en `app/pages/`
  (columna _Página Nuxt_). Cada redirección se convierte en un `routeRule`.
- **Fase 2** — el componente se mueve al slice que le corresponde; la ruta no cambia.
- **Fase 3** — la página delgada se sustituye por una página real y se declara su permiso en
  `AUTH_ROUTE_PERMISSIONS`. La columna _Roles_ es el punto de partida para deducirlo.

Leyenda: **P** = público (sin sesión) · **M** = ruta de la app móvil · _(vacío en Roles)_ =
cualquier sesión autenticada.

## Públicas

| Ruta                     | Nombre         | Componente legacy              | Roles | Flags | Página Nuxt                        | ✅ F1 | ✅ F2 | ✅ F3 |
| ------------------------ | -------------- | ------------------------------ | ----- | ----- | ---------------------------------- | :---: | :---: | :---: |
| `/login`                 | Login          | `views/LoginView.vue`          | —     | P     | `login/index.vue`                  |   ☐   |   ☐   |   ☐   |
| `/forgot-password`       | ForgotPassword | `views/ForgotPasswordView.vue` | —     | P     | `forgot-password/index.vue`        |   ☐   |   ☐   |   ☐   |
| `/reset-password/:token` | ResetPassword  | `views/ResetPasswordView.vue`  | —     | P     | `reset-password/[token]/index.vue` |   ☐   |   ☐   |   ☐   |

## App móvil (PWA) — aparte de la plataforma

| Ruta             | Nombre            | Componente legacy                        | Roles              | Flags | Página Nuxt               | ✅ F1 | ✅ F2 | ✅ F3 |
| ---------------- | ----------------- | ---------------------------------------- | ------------------ | ----- | ------------------------- | :---: | :---: | :---: |
| `/m`             | —                 | → `/m/solar`                             | —                  | —     | _routeRule_               |   ☐   |   ☐   |   ☐   |
| `/m/login`       | MobileLogin       | `mobile/MobileLoginView.vue`             | —                  | P M   | `m/login/index.vue`       |   ☐   |   ☐   |   ☐   |
| `/m/solar`       | MobileSolar       | `mobile/MobileSolarView.vue`             | —                  | M     | `m/solar/index.vue`       |   ☐   |   ☐   |   ☐   |
| `/m/fallas`      | MobileFallas      | `mobile/MobileFallasView.vue`            | —                  | M     | `m/fallas/index.vue`      |   ☐   |   ☐   |   ☐   |
| `/m/coordinador` | MobileCoordinador | `mobile/MobileCoordinadorFallasView.vue` | coordinador, admin | M     | `m/coordinador/index.vue` |   ☐   |   ☐   |   ☐   |
| `/m/tecnico`     | MobileTecnico     | `mobile/MobileTecnicoFallasView.vue`     | tecnico            | M     | `m/tecnico/index.vue`     |   ☐   |   ☐   |   ☐   |
| `/m/resumen`     | MobileResumen     | `mobile/MobileResumenView.vue`           | —                  | M     | `m/resumen/index.vue`     |   ☐   |   ☐   |   ☐   |
| `/m/reporte-cgm` | MobileReporteCGM  | `mobile/MobileReporteCGMView.vue`        | —                  | M     | `m/reporte-cgm/index.vue` |   ☐   |   ☐   |   ☐   |

## General

| Ruta                            | Nombre                 | Componente legacy                            | Roles | Flags | Página Nuxt                               | ✅ F1 | ✅ F2 | ✅ F3 |
| ------------------------------- | ---------------------- | -------------------------------------------- | ----- | ----- | ----------------------------------------- | :---: | :---: | :---: |
| `/`                             | —                      | → `/dashboard`                               | —     | —     | _routeRule_                               |   ☐   |   ☐   |   ☐   |
| `/dashboard`                    | Dashboard              | `views/DashboardView.vue`                    | —     | —     | `dashboard/index.vue`                     |   ☐   |   ☐   |   ☐   |
| `/clientes`                     | Clientes               | `views/Clientes/ClientesListView.vue`        | —     | —     | `clientes/index.vue`                      |   ☐   |   ☐   |   ☐   |
| `/clientes/:id`                 | ClienteDetalle         | `views/Clientes/ClienteDetailView.vue`       | —     | —     | `clientes/[id]/index.vue`                 |   ☐   |   ☐   |   ☐   |
| `/proyectos`                    | Proyectos              | `views/Proyectos/ProyectosListView.vue`      | —     | —     | `proyectos/index.vue`                     |   ☐   |   ☐   |   ☐   |
| `/proyectos/:id`                | ProyectoDetalle        | `views/Proyectos/ProyectoDetailView.vue`     | —     | —     | `proyectos/[id]/index.vue`                |   ☐   |   ☐   |   ☐   |
| `/proyectos/:id/ppa`            | ProyectoPPA            | `views/Servicios/PPAView.vue`                | —     | —     | `proyectos/[id]/ppa/index.vue`            |   ☐   |   ☐   |   ☐   |
| `/proyectos/:id/operacion`      | ProyectoOperacion      | `views/Servicios/OperacionView.vue`          | —     | —     | `proyectos/[id]/operacion/index.vue`      |   ☐   |   ☐   |   ☐   |
| `/proyectos/:id/representacion` | ProyectoRepresentacion | `views/Servicios/RepresentacionView.vue`     | —     | —     | `proyectos/[id]/representacion/index.vue` |   ☐   |   ☐   |   ☐   |
| `/servicios`                    | Servicios              | `views/Contratos/ContratosListView.vue`      | —     | —     | `servicios/index.vue`                     |   ☐   |   ☐   |   ☐   |
| `/servicios-unificado`          | ServiciosUnificado     | `views/Servicios/ServiciosUnificadoView.vue` | —     | —     | `servicios-unificado/index.vue`           |   ☐   |   ☐   |   ☐   |
| `/contratos/:id`                | ContratoDetalle        | `views/Contratos/ContratoDetailView.vue`     | —     | —     | `contratos/[id]/index.vue`                |   ☐   |   ☐   |   ☐   |
| `/general/proximos-energizar`   | ProximosEnergizar      | `views/General/ProximosEnergizarView.vue`    | —     | —     | `general/proximos-energizar/index.vue`    |   ☐   |   ☐   |   ☐   |
| `/general/retos`                | Retos                  | `views/Retos/RetosListView.vue`              | —     | —     | `general/retos/index.vue`                 |   ☐   |   ☐   |   ☐   |
| `/general/retos/:id`            | RetoDetalle            | `views/Retos/RetoDetailView.vue`             | —     | —     | `general/retos/[id]/index.vue`            |   ☐   |   ☐   |   ☐   |

## Comercial

| Ruta                           | Nombre             | Componente legacy                           | Roles            | Flags | Página Nuxt                              | ✅ F1 | ✅ F2 | ✅ F3 |
| ------------------------------ | ------------------ | ------------------------------------------- | ---------------- | ----- | ---------------------------------------- | :---: | :---: | :---: |
| `/comercial`                   | Comercial          | `views/Comercial/ComercialView.vue`         | admin, comercial | —     | `comercial/index.vue`                    |   ☐   |   ☐   |   ☐   |
| `/comercial/oportunidades/:id` | OportunidadDetalle | `views/Comercial/OportunidadDetailView.vue` | admin, comercial | —     | `comercial/oportunidades/[id]/index.vue` |   ☐   |   ☐   |   ☐   |

## Operaciones

| Ruta                              | Nombre            | Componente legacy                             | Roles                         | Flags | Página Nuxt                                | ✅ F1 | ✅ F2 | ✅ F3 |
| --------------------------------- | ----------------- | --------------------------------------------- | ----------------------------- | ----- | ------------------------------------------ | :---: | :---: | :---: |
| `/operaciones/informes-mensuales` | InformesMensuales | `views/Operaciones/InformesMensualesView.vue` | admin, operaciones, monitoreo | —     | `operaciones/informes-mensuales/index.vue` |   ☐   |   ☐   |   ☐   |
| `/informes/:id`                   | InformeDetalle    | `views/Operaciones/InformeDetailView.vue`     | admin, operaciones, monitoreo | —     | `informes/[id]/index.vue`                  |   ☐   |   ☐   |   ☐   |
| `/operaciones/gestion-fallas`     | GestionFallas     | `views/Operaciones/GestionFallasView.vue`     | admin, operaciones, monitoreo | —     | `operaciones/gestion-fallas/index.vue`     |   ☐   |   ☐   |   ☐   |
| `/operaciones/informe-om`         | InformeOM         | `views/Operaciones/InformeOMView.vue`         | admin, operaciones            | —     | `operaciones/informe-om/index.vue`         |   ☐   |   ☐   |   ☐   |
| `/operaciones/polizas`            | Polizas           | `views/Operaciones/PolizasView.vue`           | admin, operaciones            | —     | `operaciones/polizas/index.vue`            |   ☐   |   ☐   |   ☐   |
| `/fallas`                         | Fallas            | `views/Fallas/MonitoreoView.vue`              | admin, operaciones, monitoreo | —     | `fallas/index.vue`                         |   ☐   |   ☐   |   ☐   |
| `/fallas/lista`                   | —                 | → `/fallas`                                   | —                             | —     | _routeRule_                                |   ☐   |   ☐   |   ☐   |
| `/fallas/:id`                     | FallaDetalle      | `views/Fallas/FallaDetailView.vue`            | admin, operaciones, monitoreo | —     | `fallas/[id]/index.vue`                    |   ☐   |   ☐   |   ☐   |
| `/solar-live`                     | SolarLive         | `views/Solar/SolarLiveView.vue`               | admin, operaciones, monitoreo | —     | `solar-live/index.vue`                     |   ☐   |   ☐   |   ☐   |

## Alertas

| Ruta                     | Nombre              | Componente legacy                           | Roles                         | Flags | Página Nuxt                       | ✅ F1 | ✅ F2 | ✅ F3 |
| ------------------------ | ------------------- | ------------------------------------------- | ----------------------------- | ----- | --------------------------------- | :---: | :---: | :---: |
| `/alertas`               | Alertas             | `views/Alertas/AlertasView.vue`             | admin, operaciones, monitoreo | —     | `alertas/index.vue`               |   ☐   |   ☐   |   ☐   |
| `/alertas/contratos-ppa` | AlertasContratosPPA | `views/Alertas/AlertasContratosPPAView.vue` | admin, operaciones            | —     | `alertas/contratos-ppa/index.vue` |   ☐   |   ☐   |   ☐   |

## Finanzas

| Ruta                                | Nombre                 | Componente legacy                               | Roles                | Flags | Página Nuxt                                  | ✅ F1 | ✅ F2 | ✅ F3 |
| ----------------------------------- | ---------------------- | ----------------------------------------------- | -------------------- | ----- | -------------------------------------------- | :---: | :---: | :---: |
| `/liquidaciones`                    | Liquidaciones          | `views/Liquidaciones/LiquidacionesView.vue`     | admin, liquidaciones | —     | `liquidaciones/index.vue`                    |   ☐   |   ☐   |   ☐   |
| `/liquidaciones/inversionista`      | —                      | → `/liquidaciones?tab=inversionistas`           | —                    | —     | _routeRule_                                  |   ☐   |   ☐   |   ☐   |
| `/liquidaciones/cargar-excel`       | —                      | → `/liquidaciones`                              | —                    | —     | _routeRule_                                  |   ☐   |   ☐   |   ☐   |
| `/finanzas/costos`                  | Costos                 | `views/Finanzas/CostosView.vue`                 | admin, liquidaciones | —     | `finanzas/costos/index.vue`                  |   ☐   |   ☐   |   ☐   |
| `/validador-mandatos`               | ValidadorMandatos      | `views/Finanzas/ValidadorMandatosView.vue`      | admin, liquidaciones | —     | `validador-mandatos/index.vue`               |   ☐   |   ☐   |   ☐   |
| `/finanzas/descarga-xm`             | DescargaXM             | `views/Finanzas/DescargaXMView.vue`             | admin, liquidaciones | —     | `finanzas/descarga-xm/index.vue`             |   ☐   |   ☐   |   ☐   |
| `/finanzas/ids-proyectos`           | IdsProyectos           | `views/Finanzas/IdsProyectosView.vue`           | admin, liquidaciones | —     | `finanzas/ids-proyectos/index.vue`           |   ☐   |   ☐   |   ☐   |
| `/finanzas/contratos-energia`       | ContratosEnergia       | `views/Finanzas/ContratosEnergiaView.vue`       | admin, liquidaciones | —     | `finanzas/contratos-energia/index.vue`       |   ☐   |   ☐   |   ☐   |
| `/finanzas/despachos-liquidados`    | DespachosLiquidados    | `views/Finanzas/DespachosLiquidadosView.vue`    | admin, liquidaciones | —     | `finanzas/despachos-liquidados/index.vue`    |   ☐   |   ☐   |   ☐   |
| `/finanzas/consumo`                 | Consumo                | `views/Finanzas/ConsumoView.vue`                | admin, liquidaciones | —     | `finanzas/consumo/index.vue`                 |   ☐   |   ☐   |   ☐   |
| `/finanzas/costos-comercializacion` | CostosComercializacion | `views/Finanzas/CostosComercializacionView.vue` | admin, liquidaciones | —     | `finanzas/costos-comercializacion/index.vue` |   ☐   |   ☐   |   ☐   |
| `/finanzas/facturas-xm`             | FacturasXm             | `views/Finanzas/FacturasXmView.vue`             | admin, liquidaciones | —     | `finanzas/facturas-xm/index.vue`             |   ☐   |   ☐   |   ☐   |
| `/finanzas/verificacion-costos`     | VerificacionCostos     | `views/Finanzas/VerificacionCostosView.vue`     | admin, liquidaciones | —     | `finanzas/verificacion-costos/index.vue`     |   ☐   |   ☐   |   ☐   |
| `/finanzas/estados-resultados`      | EstadosResultados      | `views/Finanzas/EstadosResultadosView.vue`      | admin, liquidaciones | —     | `finanzas/estados-resultados/index.vue`      |   ☐   |   ☐   |   ☐   |
| `/finanzas/mandatos`                | MandatosFinanzas       | `views/Finanzas/MandatosFinanzas.vue`           | admin, liquidaciones | —     | `finanzas/mandatos/index.vue`                |   ☐   |   ☐   |   ☐   |
| `/panel-contable`                   | PanelContable          | `views/PanelContable/PanelContableView.vue`     | admin, liquidaciones | —     | `panel-contable/index.vue`                   |   ☐   |   ☐   |   ☐   |
| `/liquidaciones/minigranjas`        | —                      | → `/liquidaciones`                              | —                    | —     | _routeRule_                                  |   ☐   |   ☐   |   ☐   |
| `/liquidaciones/:id`                | LiquidacionDetalle     | `views/Liquidaciones/LiquidacionDetailView.vue` | admin, liquidaciones | —     | `liquidaciones/[id]/index.vue`               |   ☐   |   ☐   |   ☐   |
| `/liquidaciones/:id/pdf`            | LiquidacionPdf         | `views/Liquidaciones/LiquidacionPdfView.vue`    | admin, liquidaciones | —     | `liquidaciones/[id]/pdf/index.vue`           |   ☐   |   ☐   |   ☐   |
| `/garantias`                        | Garantias              | `views/Garantias/GarantiasView.vue`             | admin, liquidaciones | —     | `garantias/index.vue`                        |   ☐   |   ☐   |   ☐   |

## MEM

| Ruta                      | Nombre                | Componente legacy                     | Roles              | Flags | Página Nuxt                         | ✅ F1 | ✅ F2 | ✅ F3 |
| ------------------------- | --------------------- | ------------------------------------- | ------------------ | ----- | ----------------------------------- | :---: | :---: | :---: |
| `/mem/gescon`             | MemGescon             | `views/MEM/GesconView.vue`            | admin, operaciones | —     | `mem/gescon/index.vue`              |   ☐   |   ☐   |   ☐   |
| `/mem/fronteras`          | MemFronteras          | `views/MEM/FronterasView.vue`         | admin, operaciones | —     | `mem/fronteras/index.vue`           |   ☐   |   ☐   |   ☐   |
| `/mem/reporte-energia`    | MemReporteEnergia     | `views/MEM/ReporteEnergiaView.vue`    | admin, operaciones | —     | `mem/reporte-energia/index.vue`     |   ☐   |   ☐   |   ☐   |
| `/mem/operadores-red`     | MemOperadoresRed      | `views/MEM/OperadoresRedView.vue`     | admin, operaciones | —     | `mem/operadores-red/index.vue`      |   ☐   |   ☐   |   ☐   |
| `/mem/operadores-red/:id` | MemOperadorRedDetalle | `views/MEM/OperadorRedDetailView.vue` | admin, operaciones | —     | `mem/operadores-red/[id]/index.vue` |   ☐   |   ☐   |   ☐   |
| `/mem/precio-bolsa`       | MemPrecioBolsa        | `views/MEM/PrecioBolsaView.vue`       | —                  | —     | `mem/precio-bolsa/index.vue`        |   ☐   |   ☐   |   ☐   |
| `/mem/cumplimiento`       | MemCumplimiento       | `views/MEM/CumplimientoV2View.vue`    | —                  | —     | `mem/cumplimiento/index.vue`        |   ☐   |   ☐   |   ☐   |
| `/mem/descubrimientos`    | MemDescubrimientos    | `views/MEM/DescubrimientosView.vue`   | —                  | —     | `mem/descubrimientos/index.vue`     |   ☐   |   ☐   |   ☐   |
| `/mem/cumplimiento-v2`    | —                     | → `/mem/cumplimiento`                 | —                  | —     | _routeRule_                         |   ☐   |   ☐   |   ☐   |

## Registros CND/ASIC

| Ruta                              | Nombre                 | Componente legacy                                      | Roles              | Flags | Página Nuxt                                 | ✅ F1 | ✅ F2 | ✅ F3 |
| --------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------ | ----- | ------------------------------------------- | :---: | :---: | :---: |
| `/registros-cnd-asic`             | RegistrosCndAsic       | `views/RegistrosCndAsic/RegistrosCndAsicListView.vue`  | admin, operaciones | —     | `registros-cnd-asic/index.vue`              |   ☐   |   ☐   |   ☐   |
| `/registros-cnd-asic/:proyectoId` | RegistroCndAsicDetalle | `views/RegistrosCndAsic/RegistroCndAsicDetailView.vue` | admin, operaciones | —     | `registros-cnd-asic/[proyectoId]/index.vue` |   ☐   |   ☐   |   ☐   |

## Admin

| Ruta                 | Nombre           | Componente legacy                        | Roles              | Flags                    | Página Nuxt                   | ✅ F1 | ✅ F2 | ✅ F3 |
| -------------------- | ---------------- | ---------------------------------------- | ------------------ | ------------------------ | ----------------------------- | :---: | :---: | :---: |
| `/admin/usuarios`    | AdminUsuarios    | `views/Admin/AdminUsuariosView.vue`      | admin, operaciones | —                        | `admin/usuarios/index.vue`    |   ☐   |   ☐   |   ☐   |
| `/admin/diagnostico` | AdminDiagnostico | `views/Admin/DiagnosticoEnlacesView.vue` | admin              | email:juanjose@unergy.io | `admin/diagnostico/index.vue` |   ☐   |   ☐   |   ☐   |

## Fallback

| Ruta               | Nombre | Componente legacy | Roles | Flags | Página Nuxt | ✅ F1 | ✅ F2 | ✅ F3 |
| ------------------ | ------ | ----------------- | ----- | ----- | ----------- | :---: | :---: | :---: |
| `/:pathMatch(.*)*` | —      | → `/dashboard`    | —     | —     | _routeRule_ |   ☐   |   ☐   |   ☐   |

## Roles observados en el router

- `admin`
- `comercial`
- `coordinador`
- `liquidaciones`
- `monitoreo`
- `operaciones`
- `tecnico`

23 rutas no declaran roles: hoy basta con estar autenticado. En la fase 3 cada una necesita un permiso explícito — deny-by-default no admite "sin restricción".
