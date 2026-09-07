<template>
  <div class="gf-page" ref="pageRef">

    <!-- ══ TAB BAR (fuera del sticky) ═══════════════════════════════════ -->
    <div class="mon-tab-bar">
      <ZapIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
      <span class="text-base font-bold text-gray-800 whitespace-nowrap mr-2">Gestión de Fallas</span>
      <div class="mon-tab-group">
        <button v-for="(tab, i) in TABS" :key="i"
          class="mon-tab"
          :class="{ 'mon-tab--active': activeTab === i }"
          @click="activeTab = i">
          <component :is="tab.icon" class="size-[1em]" style="font-size:12px" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ══ TAB 0 — FALLAS ════════════════════════════════════════════════ -->
    <template v-if="activeTab === 0">

      <!-- ══ STICKY HEADER ════════════════════════════════════════════════ -->
      <div class="gf-sticky-header" ref="stickyHeaderRef">

        <!-- ── Topbar ── -->
        <div class="gf-topbar">
          <!-- Bucket pills -->
          <div class="gf-bucket-pills">
            <button v-for="b in BUCKETS" :key="b.key"
              class="bucket-pill"
              :class="{ 'bucket-pill--active': bucket === b.key }"
              :style="bucketPillStyle(b.color, bucket === b.key)"
              @click="bucket = b.key">
              <span class="bucket-pill-dot" :style="{ background: b.color }" />
              <span class="bucket-pill-label">{{ b.label }}</span>
              <span class="bucket-pill-count" :style="{ color: b.color }">{{ counts[b.key] }}</span>
            </button>
          </div>

          <div class="gf-topbar-actions">
            <Button outlined size="small" :loading="loading" @click="cargar" v-tooltip.bottom="'Actualizar'">
              <template #icon><RefreshCwIcon class="size-[1em]" /></template>
            </Button>
            <Button label="Nueva falla" size="small" @click="abrirCrear">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>

        <!-- ── Toolbar ── -->
        <div class="gf-toolbar">
          <IconField class="flex-1 min-w-[200px] max-w-sm">
            <InputIcon><SearchIcon class="text-xs size-[1em]" /></InputIcon>
            <InputText ref="searchInputRef" v-model="search"
              placeholder="Buscar por código, descripción, proyecto, tipo..."
              class="w-full" size="small" />
          </IconField>
          <Select v-model="filtroProyecto" :options="proyectos" optionLabel="nombre_comercial"
            optionValue="id" placeholder="Proyecto" showClear filter class="w-36" size="small" />
          <Select v-model="filtroPrioridad" :options="catalogos.prioridades"
            optionLabel="etiqueta" optionValue="codigo" placeholder="Prioridad" showClear class="w-32" size="small" />
          <Select v-model="filtroEstado" :options="catalogos.estados"
            optionLabel="etiqueta" optionValue="codigo" placeholder="Estado" showClear class="w-32" size="small" />
          <DatePicker v-model="filtroFechaDesde" placeholder="Desde" dateFormat="yy-mm-dd"
            showButtonBar class="w-28" size="small" />
          <DatePicker v-model="filtroFechaHasta" placeholder="Hasta" dateFormat="yy-mm-dd"
            showButtonBar class="w-28" size="small" />
          <Button v-if="hayFiltros" text size="small" severity="secondary" @click="limpiarFiltros" v-tooltip.bottom="'Limpiar filtros'">
            <template #icon><XIcon class="size-[1em]" /></template>
          </Button>
          <span class="ml-auto text-[11px] text-gray-500 whitespace-nowrap" v-if="!loading">
            {{ filtradas.length }} / {{ porBucket.length }}
          </span>
        </div>

      </div><!-- /gf-sticky-header -->

      <div :class="['gf-layout', drawerVisible && 'gf-layout--split']">

        <div class="gf-main space-y-4 min-w-0">

          <!-- ══ COMPACT LIST (lg+ con panel abierto) ═══════════════════ -->
          <div v-if="drawerVisible" class="gf-compact hidden lg:flex">
            <div class="gf-compact-header">
              <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                {{ filtradas.length }} falla{{ filtradas.length !== 1 ? 's' : '' }}
              </span>
            </div>
            <div v-if="!filtradas.length" class="gf-compact-empty">
              <InboxIcon class="text-2xl mb-2 size-[1em]" />
              <p class="text-xs">Sin resultados</p>
            </div>
            <div v-else class="gf-compact-list">
              <button v-for="f in filtradas" :key="f.id"
                class="gf-compact-row"
                :class="{ 'gf-compact-row--active': drawerFalla?.id === f.id }"
                @click="abrirDrawer(f)">
                <span class="gf-compact-stripe" :style="{ background: prioColor(f.prioridad?.codigo) }" />
                <div class="gf-compact-content">
                  <div class="gf-compact-line1">
                    <code class="gf-compact-code">{{ f.codigo_interno }}</code>
                    <span v-if="f.estado?.codigo"
                      class="gf-compact-dot"
                      :style="{ background: colorEstado(f.estado?.codigo, 'var(--color-unergy-purple)') }"
                      v-tooltip.right="f.estado?.etiqueta" />
                  </div>
                  <div class="gf-compact-line2">{{ f.tipo?.etiqueta || f.tipo_libre || f.descripcion || 'Sin descripción' }}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- ══ TABLA (oculta cuando hay panel en lg+) ════════════════ -->
          <div :class="['gf-table-wrap', drawerVisible && 'lg:!hidden']">
            <div v-if="error" class="p-6 flex items-center gap-3 text-red-600">
              <CircleAlertIcon class="text-xl size-[1em]" />
              <div class="flex-1">
                <div class="font-semibold">Error al cargar</div>
                <div class="text-sm text-gray-500">{{ error }}</div>
              </div>
              <Button label="Reintentar" outlined size="small" @click="cargar">
                <template #icon><RefreshCwIcon class="size-[1em]" /></template>
              </Button>
            </div>
            <DataTable v-else :value="filtradas" :loading="loading" rowHover stripedRows
              size="small" class="gf-table text-xs" :rows="25" paginator
              :rowsPerPageOptions="[15, 25, 50, 100]" :alwaysShowPaginator="false"
              @row-click="(e) => abrirDrawer(e.data)" selectionMode="single"
              :rowClass="rowClass" scrollable>
              <template #empty>
                <div class="flex flex-col items-center py-14 gap-2 text-gray-400">
                  <component :is="bucketActual.icon" class="text-4xl size-[1em]" :style="{ color: bucketActual.color }" />
                  <p class="text-sm font-semibold text-gray-700">{{ emptyTitulo }}</p>
                  <p class="text-xs">{{ emptySubtitulo }}</p>
                  <Button v-if="bucket === 'activas' && !hayFiltros" label="Registrar primera falla" outlined size="small" class="mt-2" @click="abrirCrear">
                    <template #icon><PlusIcon class="size-[1em]" /></template>
                  </Button>
                  <Button v-else-if="hayFiltros" label="Limpiar filtros" text size="small" class="mt-2" @click="limpiarFiltros">
                    <template #icon><XIcon class="size-[1em]" /></template>
                  </Button>
                </div>
              </template>

              <!-- Stripe prioridad -->
              <Column header="" style="width:6px;padding:0" :pt="{ headerCell: { style: 'padding:0; border:none' } }">
                <template #body="{ data }">
                  <div class="prio-stripe" :style="{ background: prioColor(data.prioridad?.codigo) }" />
                </template>
              </Column>

              <!-- Código -->
              <Column field="codigo_interno" header="Código" style="width:100px" sortable>
                <template #body="{ data }">
                  <span class="font-mono text-[10px] text-gray-400">{{ data.codigo_interno }}</span>
                </template>
              </Column>

              <!-- Falla -->
              <Column header="Falla" style="min-width:280px">
                <template #body="{ data }">
                  <div class="flex items-start gap-2">
                    <span class="cat-dot mt-1.5 flex-shrink-0"
                      :style="{ background: categoriaFalla(data).color }"
                      v-tooltip.top="categoriaFalla(data).etiqueta" />
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-medium text-gray-700 flex items-center gap-1.5 flex-wrap">
                        <span class="truncate">{{ tituloFalla(data) }}</span>
                        <span v-if="recurrencias(data) > 1"
                          class="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style="background: rgba(234,88,12,0.12); color: #ea580c;"
                          v-tooltip.top="`${recurrencias(data)}× mismo tipo en este proyecto`">
                          <RotateCcwIcon class="size-[1em]" style="font-size:9px" />{{ recurrencias(data) }}×
                        </span>
                      </div>
                      <div class="text-xs text-gray-500 line-clamp-1">{{ data.descripcion }}</div>
                    </div>
                  </div>
                </template>
              </Column>

              <!-- Proyecto -->
              <Column header="Proyecto" style="min-width:130px">
                <template #body="{ data }">
                  <span class="text-xs text-gray-600">{{ data.proyecto?.nombre_comercial || '—' }}</span>
                </template>
              </Column>

              <!-- Estado -->
              <Column header="Estado" style="width:130px">
                <template #body="{ data }">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0"
                      :style="{ background: colorEstado(data.estado?.codigo, '#9ca3af') }"></span>
                    <span class="text-[11px] text-gray-600">{{ data.estado?.etiqueta || '—' }}</span>
                  </div>
                </template>
              </Column>

              <!-- Fecha + relativeTime -->
              <Column header="Fecha" style="width:110px" field="fecha_identificacion" sortable>
                <template #body="{ data }">
                  <div class="text-xs">
                    <div class="text-gray-700">{{ fmtFecha(data.fecha_identificacion) }}</div>
                    <div class="text-gray-400">{{ relativeTime(data.fecha_identificacion) }}</div>
                  </div>
                </template>
              </Column>

              <!-- Días abierta -->
              <Column header="Días" style="width:70px">
                <template #body="{ data }">
                  <span v-if="data.dias_abierta != null"
                    class="dias-badge"
                    :class="diasClass(data)">
                    {{ data.dias_abierta }}d
                  </span>
                  <span v-else class="text-gray-400 text-xs">—</span>
                </template>
              </Column>


              <!-- Acciones -->
              <Column header="" style="width:120px">
                <template #body="{ data }">
                  <div class="row-actions" @click.stop>
                    <Button v-if="!data.estado?.es_estado_final" text rounded size="small" severity="success" @click="quickResolve(data)" v-tooltip.left="'Marcar resuelta'">
                      <template #icon><CircleCheckIcon class="size-[1em]" /></template>
                    </Button>
                    <Button text rounded size="small" severity="info" @click="abrirEditar(data)" v-tooltip.left="'Editar'">
                      <template #icon><PencilIcon class="size-[1em]" /></template>
                    </Button>
                    <Button text rounded size="small" severity="secondary" @click="abrirDrawer(data)" v-tooltip.left="'Ver detalle'">
                      <template #icon><ArrowRightIcon class="size-[1em]" /></template>
                    </Button>
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>

        </div><!-- /gf-main -->

        <!-- ══ PANEL DETALLE ══════════════════════════════════════════════ -->
        <aside v-if="drawerVisible && drawerFalla" class="gf-aside"
          @keydown.left.stop="navegar(-1)" @keydown.right.stop="navegar(1)">
          <!-- Backdrop solo en móvil -->
          <div class="gf-aside-backdrop" @click="drawerVisible = false" />
          <div class="gf-aside-panel">

            <!-- Header panel -->
            <div class="gf-drawer-header">
              <Button text rounded size="small" @click="drawerVisible = false" v-tooltip.bottom="'Cerrar (Esc)'">
                <template #icon><XIcon class="size-[1em]" /></template>
              </Button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <code class="font-mono text-sm text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{{ drawerFalla.codigo_interno }}</code>
                  <span class="text-xs text-gray-400">·</span>
                  <span class="text-sm font-medium text-gray-700 truncate">{{ tituloFalla(drawerFalla) }}</span>
                  <span v-if="navIndex >= 0" class="text-[10px] text-gray-400 ml-auto whitespace-nowrap hidden sm:inline-block">
                    {{ navIndex + 1 }} / {{ filtradas.length }}
                  </span>
                </div>
              </div>
              <Button text rounded size="small" severity="secondary" :disabled="navIndex <= 0" @click="navegar(-1)" v-tooltip.bottom="'Anterior (←)'">
                <template #icon><ChevronLeftIcon class="size-[1em]" /></template>
              </Button>
              <Button text rounded size="small" severity="secondary" :disabled="navIndex < 0 || navIndex >= filtradas.length - 1" @click="navegar(1)" v-tooltip.bottom="'Siguiente (→)'">
                <template #icon><ChevronRightIcon class="size-[1em]" /></template>
              </Button>
              <Button text rounded size="small" severity="secondary" @click="router.push(`/fallas/${drawerFalla.id}`)" v-tooltip.bottom="'Abrir página completa'">
                <template #icon><ExternalLinkIcon class="size-[1em]" /></template>
              </Button>
              <Button text rounded size="small" severity="danger" @click="confirmDelete(drawerFalla)" v-tooltip.bottom="'Eliminar'">
                <template #icon><Trash2Icon class="size-[1em]" /></template>
              </Button>
            </div>

            <!-- Body drawer -->
            <div class="gf-drawer-body">

              <!-- ── HERO: título + estado + descripción ──────────────── -->
              <section class="gf-hero">
                <div>
                  <p class="gf-hero-title">{{ tituloFalla(drawerFalla) }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <GBadge :color="colorEstado(drawerFalla.estado?.codigo)">{{ drawerFalla.estado?.etiqueta }}</GBadge>
                    <span class="prio-pill" :style="prioPillStyle(drawerFalla.prioridad?.codigo)">
                      {{ drawerFalla.prioridad?.etiqueta }}
                    </span>
                    <GBadge v-if="categoriaFalla(drawerFalla).etiqueta"
                      :color="categoriaFalla(drawerFalla).color || '#915BD8'">{{ categoriaFalla(drawerFalla).etiqueta }}</GBadge>
                    <GBadge v-if="drawerFalla.pendiente_reclasificar" color="warning">Pendiente de reclasificar</GBadge>
                  </div>
                </div>
                <p v-if="drawerFalla.descripcion" class="gf-hero-desc">{{ drawerFalla.descripcion }}</p>
              </section>

              <!-- ── EQUIPO QUE FALLÓ / CLASIFICACIÓN ──────────────────── -->
              <section class="gf-section">
                <header class="gf-section-head">
                  <component :is="clasifDrawer ? clasifDrawer.icono : ServerIcon" class="gf-section-icon size-[1em]" :style="clasifDrawer ? { color: clasifDrawer.categoriaColor } : {}" />
                  <h3 class="gf-section-title">Equipo / clasificación</h3>
                </header>

                <template v-if="clasifDrawer">
                  <div class="flex flex-wrap items-center gap-2">
                    <GBadge :color="clasifDrawer.categoriaColor || '#915BD8'">{{ clasifDrawer.categoriaEtiqueta }}</GBadge>
                    <span v-if="clasifDrawer.subtitulo" class="gf-clasif-sub">{{ clasifDrawer.subtitulo }}</span>
                  </div>
                  <p v-if="clasifDrawer.detalle" class="gf-body-text mt-2">{{ clasifDrawer.detalle }}</p>

                  <!-- Frontera: flags de medición / comunicación -->
                  <div v-if="clasifDrawer.frontera" class="flex flex-wrap gap-2 mt-3">
                    <span class="gf-flag" :class="clasifDrawer.frontera.afectaMedicion ? 'gf-flag--bad' : 'gf-flag--ok'">
                      <CircleXIcon v-if="clasifDrawer.frontera.afectaMedicion" class="size-[1em]" />
                      <CircleCheckIcon v-else class="size-[1em]" />
                      {{ clasifDrawer.frontera.afectaMedicion ? 'Afecta la medición' : 'No afecta la medición' }}
                    </span>
                    <span class="gf-flag" :class="clasifDrawer.frontera.perdidaComunicacion ? 'gf-flag--warn' : 'gf-flag--ok'">
                      <WifiIcon v-if="clasifDrawer.frontera.perdidaComunicacion" class="size-[1em]" />
                      <CircleCheckIcon v-else class="size-[1em]" />
                      {{ clasifDrawer.frontera.perdidaComunicacion ? 'Pérdida de comunicación' : 'Comunicación OK' }}
                    </span>
                  </div>

                  <!-- Capa aparte: TIPO(S) DE FALLA del inversor -->
                  <div v-if="clasifDrawer.inversorTipos.length" class="gf-tipo-layer mt-3">
                    <p class="gf-subhead">Tipo{{ clasifDrawer.inversorTipos.length > 1 ? 's' : '' }} de falla</p>
                    <div class="gf-tipo-chips">
                      <span v-for="(t, ti) in clasifDrawer.inversorTipos" :key="ti" class="gf-tipo-chip">{{ t }}</span>
                    </div>
                  </div>

                  <!-- Capa: INVERSORES afectados -->
                  <div v-if="clasifDrawer.inversores.length" class="gf-inv-list mt-3">
                    <p class="gf-subhead">Inversores afectados ({{ clasifDrawer.inversores.length }})</p>
                    <div v-for="(inv, idx) in clasifDrawer.inversores" :key="idx" class="gf-inv">
                      <div class="gf-inv-top">
                        <ServerIcon class="size-[1em]" />
                        <span class="gf-inv-name">{{ inv.nombre }}</span>
                        <span v-if="inv.potenciaKw != null" class="gf-inv-pot">· {{ inv.potenciaKw }} kW</span>
                      </div>
                      <!-- Chips por inversor solo si los tipos difieren entre inversores -->
                      <div v-if="!clasifDrawer.tiposUniformes && inv.tipos.length" class="gf-inv-tipos">
                        <span v-for="(t, ti) in inv.tipos" :key="ti" class="gf-inv-tag">{{ t }}</span>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Falla sin clasificación estructurada (catálogo anterior) -->
                <template v-else>
                  <div class="flex flex-wrap items-center gap-2">
                    <GBadge v-if="categoriaFalla(drawerFalla).etiqueta"
                      :color="categoriaFalla(drawerFalla).color || '#915BD8'">{{ categoriaFalla(drawerFalla).etiqueta }}</GBadge>
                    <span class="gf-clasif-sub">{{ drawerFalla.tipo?.etiqueta || drawerFalla.tipo_libre || 'Sin clasificación' }}</span>
                  </div>
                  <p class="gf-legacy-note">
                    <InfoIcon class="size-[1em]" />
                    Registrada sin desglose específico por equipo/inversor. Las fallas nuevas capturan el detalle (p. ej. inversor afectado y tipo de falla).
                  </p>
                </template>
              </section>

              <!-- ── FECHAS Y TIEMPOS ──────────────────────────────────── -->
              <section class="gf-section">
                <header class="gf-section-head">
                  <CalendarIcon class="gf-section-icon size-[1em]" />
                  <h3 class="gf-section-title">Fechas y tiempos</h3>
                </header>
                <dl class="gf-facts gf-facts--flush">
                  <div class="gf-fact">
                    <dt class="gf-fact-label"><CalendarPlusIcon class="size-[1em]" /> Identificada</dt>
                    <dd class="gf-fact-value">
                      {{ fmtFecha(drawerFalla.fecha_identificacion) }}<span v-if="drawerFalla.hora_identificacion"> · {{ String(drawerFalla.hora_identificacion).slice(0,5) }}</span>
                      <span class="text-gray-500">· {{ relativeTime(drawerFalla.fecha_identificacion) }}</span>
                    </dd>
                  </div>
                  <div v-if="drawerFalla.fecha_ocurrencia" class="gf-fact">
                    <dt class="gf-fact-label"><ClockIcon class="size-[1em]" /> Ocurrencia</dt>
                    <dd class="gf-fact-value">{{ fmtFechaHora(drawerFalla.fecha_ocurrencia) }}</dd>
                  </div>
                  <div v-if="drawerFalla.fecha_programada" class="gf-fact">
                    <dt class="gf-fact-label"><CalendarIcon class="size-[1em]" /> Programada</dt>
                    <dd class="gf-fact-value">{{ fmtFecha(drawerFalla.fecha_programada) }}</dd>
                  </div>
                  <div v-if="drawerFalla.fecha_resolucion" class="gf-fact">
                    <dt class="gf-fact-label"><CircleCheckIcon class="size-[1em]" /> Resuelta</dt>
                    <dd class="gf-fact-value text-emerald-700 font-semibold">{{ fmtFechaHora(drawerFalla.fecha_resolucion) }}</dd>
                  </div>
                  <div v-if="drawerFalla.dias_abierta != null" class="gf-fact">
                    <dt class="gf-fact-label"><HourglassIcon class="size-[1em]" /> Días abierta</dt>
                    <dd class="gf-fact-value">
                      <span class="dias-badge" :class="diasClass(drawerFalla)">{{ drawerFalla.dias_abierta }}d</span>
                    </dd>
                  </div>
                  <div v-if="drawerFalla.tiempo_afectacion_horas != null" class="gf-fact">
                    <dt class="gf-fact-label"><TimerIcon class="size-[1em]" /> Tiempo de afectación</dt>
                    <dd class="gf-fact-value" style="color:#b45309;font-weight:600">{{ fmtHoras(drawerFalla.tiempo_afectacion_horas) }}</dd>
                  </div>
                  <div v-if="tiempoEnEstadoActual && !drawerFalla.estado?.es_estado_final" class="gf-fact">
                    <dt class="gf-fact-label"><TimerIcon class="size-[1em]" /> En estado actual</dt>
                    <dd class="gf-fact-value">{{ tiempoEnEstadoActual }}</dd>
                  </div>
                </dl>
              </section>

              <!-- ── GESTIÓN E IMPACTO ─────────────────────────────────── -->
              <section class="gf-section">
                <header class="gf-section-head">
                  <BriefcaseIcon class="gf-section-icon size-[1em]" />
                  <h3 class="gf-section-title">Gestión e impacto</h3>
                </header>
                <dl class="gf-facts gf-facts--flush">
                  <div class="gf-fact">
                    <dt class="gf-fact-label"><BuildingIcon class="size-[1em]" /> Proyecto</dt>
                    <dd class="gf-fact-value">{{ drawerFalla.proyecto?.nombre_comercial || '—' }}</dd>
                  </div>
                  <div class="gf-fact">
                    <dt class="gf-fact-label"><UserPenIcon class="size-[1em]" /> Registrado por</dt>
                    <dd class="gf-fact-value">{{ drawerFalla.registrado_por?.nombre || '—' }}</dd>
                  </div>
                  <div v-if="drawerFalla.resolucion" class="gf-fact">
                    <dt class="gf-fact-label"><WrenchIcon class="size-[1em]" /> Resolución</dt>
                    <dd class="gf-fact-value font-medium text-emerald-700">{{ drawerFalla.resolucion.etiqueta }}</dd>
                  </div>
                  <div v-if="drawerFalla.kwh_perdidos_estimado != null" class="gf-fact">
                    <dt class="gf-fact-label"><ZapIcon class="size-[1em]" /> Energía perdida</dt>
                    <dd class="gf-fact-value text-red-700 font-semibold">
                      {{ Number(drawerFalla.kwh_perdidos_estimado).toLocaleString('es-CO') }} kWh
                    </dd>
                  </div>
                  <div v-if="drawerFalla.impacto_economico_cop != null" class="gf-fact">
                    <dt class="gf-fact-label"><DollarSignIcon class="size-[1em]" /> Impacto económico</dt>
                    <dd class="gf-fact-value text-red-700 font-semibold">{{ fmtCOP(drawerFalla.impacto_economico_cop) }}</dd>
                  </div>
                  <div v-if="recurrencias(drawerFalla) > 1" class="gf-fact">
                    <dt class="gf-fact-label"><RotateCcwIcon class="size-[1em]" style="color:#ea580c" /> Reincidencia</dt>
                    <dd class="gf-fact-value font-semibold" style="color:#ea580c">
                      {{ recurrencias(drawerFalla) }}× mismo tipo en este proyecto
                    </dd>
                  </div>
                  <div v-if="origenFalla" class="gf-fact">
                    <dt class="gf-fact-label"><BellIcon class="size-[1em]" /> Origen</dt>
                    <dd class="gf-fact-value">{{ origenFalla }}</dd>
                  </div>
                </dl>
              </section>

              <!-- ── EDICIÓN RÁPIDA + SLA ──────────────────────────── -->
              <div class="gf-twocol">
                <!-- Quick edit con autosave -->
                <section class="gf-section gf-section--filled">
                  <header class="gf-section-head">
                    <ZapIcon class="gf-section-icon size-[1em]" />
                    <h3 class="gf-section-title">Edición rápida</h3>
                    <span v-if="savingQuick" class="gf-save-flag">
                      <LoaderCircleIcon class="size-[1em] animate-spin" /> Guardando…
                    </span>
                    <span v-else-if="savedFlash" class="gf-save-flag gf-save-flag--ok">
                      <CheckIcon class="size-[1em]" /> Guardado
                    </span>
                  </header>
                  <div class="space-y-2">
                    <div class="gf-field-row">
                      <label class="gf-field-label">Estado</label>
                      <Select v-model="quickEdit.estado_id" :options="catalogos.estados"
                        optionLabel="etiqueta" optionValue="id" class="flex-1"
                        @change="autosaveQuick()" />
                    </div>
                    <div class="gf-field-row">
                      <label class="gf-field-label">Prioridad</label>
                      <Select v-model="quickEdit.prioridad_id" :options="catalogos.prioridades"
                        optionLabel="etiqueta" optionValue="id" class="flex-1"
                        @change="autosaveQuick()" />
                    </div>
                  </div>
                </section>

                <!-- SLA -->
                <section class="gf-section gf-section--filled">
                  <header class="gf-section-head">
                    <ClockIcon class="gf-section-icon size-[1em]" />
                    <h3 class="gf-section-title">SLA</h3>
                    <GBadge class="ml-auto" :color="slaSeverity(drawerFalla)">{{ slaText(drawerFalla) }}</GBadge>
                  </header>
                  <div class="gf-sla-stat">
                    <span class="gf-sla-num" :style="{ color: slaTextColor(drawerFalla) }">{{ horasTranscurridas(drawerFalla) }}h</span>
                    <span class="gf-sla-of">de {{ drawerFalla.sla_limite_horas_efectivo }}h</span>
                  </div>
                  <div class="bg-gray-200 rounded-full h-1.5 overflow-hidden mt-2">
                    <div class="h-full rounded-full transition-all" :style="slaFillStyle(drawerFalla)" />
                  </div>

                  <div class="gf-sla-override">
                    <div class="gf-sla-override-row">
                      <span class="gf-sla-override-label">Límite personalizado</span>
                      <span v-if="!quickEdit.sla_limite_horas" class="gf-sla-override-ref">
                        Por defecto: <strong>{{ drawerFalla.sla_limite_horas_efectivo }}h</strong>
                      </span>
                    </div>
                    <div class="gf-sla-override-input">
                      <InputNumber v-model="quickEdit.sla_limite_horas" placeholder="Sin personalizar"
                        :min="1" :max="999" showButtons buttonLayout="horizontal" class="flex-1"
                        @update:modelValue="autosaveQuick()" />
                      <button v-if="quickEdit.sla_limite_horas" type="button" class="gf-sla-override-clear"
                        title="Quitar personalización" @click="quickEdit.sla_limite_horas = null; autosaveQuick()">
                        <XIcon class="size-[1em]" />
                      </button>
                    </div>
                    <p class="gf-sla-override-hint">
                      Opcional. Solo para casos puntuales que necesitan más o menos tiempo que el default de su prioridad.
                    </p>
                  </div>
                </section>
              </div>

              <!-- ── ACCIÓN SUGERIDA ────────────────────────────────── -->
              <aside v-if="drawerFalla.tipo?.accion_sugerida" class="gf-suggestion">
                <div class="gf-suggestion-icon"><LightbulbIcon class="size-[1em]" /></div>
                <div>
                  <p class="gf-suggestion-label">Acción sugerida</p>
                  <p class="gf-suggestion-text">{{ drawerFalla.tipo.accion_sugerida }}</p>
                </div>
              </aside>

              <!-- ── ANÁLISIS ───────────────────────────────────────── -->
              <section v-if="drawerFalla.causa_raiz || drawerFalla.acciones_correctivas" class="gf-section">
                <header class="gf-section-head">
                  <SearchIcon class="gf-section-icon size-[1em]" />
                  <h3 class="gf-section-title">Análisis</h3>
                </header>
                <div class="space-y-3">
                  <div v-if="drawerFalla.causa_raiz">
                    <p class="gf-subhead">Causa raíz</p>
                    <p class="gf-body-text">{{ drawerFalla.causa_raiz }}</p>
                  </div>
                  <div v-if="drawerFalla.acciones_correctivas">
                    <p class="gf-subhead">Acciones correctivas</p>
                    <p class="gf-body-text">{{ drawerFalla.acciones_correctivas }}</p>
                  </div>
                </div>
              </section>

              <!-- ── SEGUIMIENTOS ───────────────────────────────────── -->
              <section class="gf-section">
                <header class="gf-section-head">
                  <MessagesSquareIcon class="gf-section-icon size-[1em]" />
                  <h3 class="gf-section-title">Seguimientos</h3>
                  <span class="gf-section-count">{{ drawerFalla.seguimientos?.length || 0 }}</span>
                </header>

                <!-- Agregar nota -->
                <div class="gf-add-note">
                  <Textarea v-model="nuevaNota.nota" rows="2" autoResize
                    placeholder="Agregar nota o actualización…" class="w-full" />
                  <div class="flex items-center gap-2 mt-2">
                    <Select v-model="nuevaNota.estado_id" :options="catalogos.estados"
                      optionLabel="etiqueta" optionValue="id" placeholder="Cambiar estado (opcional)"
                      showClear class="flex-1" />
                    <Button label="Agregar" size="small" :disabled="!nuevaNota.nota.trim() && !nuevaNota.estado_id" :loading="addingSeg" @click="agregarSeguimiento">
                      <template #icon><SendIcon class="size-[1em]" /></template>
                    </Button>
                  </div>
                </div>

                <!-- Timeline -->
                <div v-if="sortedSeguimientos.length" class="space-y-3 mt-3">
                  <div v-for="seg in sortedSeguimientos" :key="seg.id" class="flex gap-2.5">
                    <div class="avatar-md flex-shrink-0" :style="avatarStyle(seg.usuario)">
                      {{ initials(seg.usuario?.nombre) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span class="gf-body-text font-semibold">{{ seg.usuario?.nombre || 'Sistema' }}</span>
                        <span class="text-xs text-gray-500">{{ relativeTime(seg.created_at, true) }}</span>
                      </div>
                      <p v-if="seg.nota" class="gf-body-text whitespace-pre-line">{{ seg.nota }}</p>
                      <div v-if="seg.estado_nuevo" class="mt-1.5">
                        <GBadge :color="colorEstado(seg.estado_nuevo?.codigo)">{{ seg.estado_nuevo?.etiqueta }}</GBadge>
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-500 mt-3">Aún no hay seguimientos registrados.</p>
              </section>

              <!-- ── ARCHIVOS ADJUNTOS ─────────────────────────────── -->
              <FallaArchivos v-if="drawerFalla?.id" :fallaId="drawerFalla.id" />

              <!-- ── ACCIONES PRINCIPALES ───────────────────────────── -->
              <div class="gf-actions-inline">
                <Button label="Editar completa" outlined class="flex-1" @click="editarDesdeDrawer">
                  <template #icon><PencilIcon class="size-[1em]" /></template>
                </Button>
                <Button v-if="!drawerFalla.estado?.es_estado_final" label="Marcar resuelta" severity="success" class="flex-1" :loading="resolvingFalla" @click="quickResolve(drawerFalla)">
                  <template #icon><CheckIcon class="size-[1em]" /></template>
                </Button>
                <Button v-else label="Reabrir" severity="warn" outlined class="flex-1" @click="reabrirFalla">
                  <template #icon><RotateCcwIcon class="size-[1em]" /></template>
                </Button>
              </div>

            </div><!-- /gf-drawer-body -->
          </div><!-- /gf-aside-panel -->
        </aside>

      </div><!-- /gf-layout -->

      <!-- ══ DIALOG CREAR / EDITAR ════════════════════════════════════════ -->
      <Dialog v-model:visible="formDialogVisible" modal class="w-full max-w-2xl"
        :header="editingFalla ? `Editar falla ${editingFalla.codigo_interno}` : 'Nueva falla'"
        :closable="!savingForm">
        <FallaForm :initial="editingFalla" :catalogos="catalogos"
          @save="onSaveForm" @cancel="formDialogVisible = false" />
      </Dialog>

      <!-- ══ DIALOG RESOLVER FALLA ══════════════════════════════════════════ -->
      <Dialog v-model:visible="resolveDialogVisible" modal class="w-full max-w-sm"
        header="Resolver falla" :closable="!resolvingFalla">
        <div v-if="resolveFallaTarget" class="resolve-dialog-body">
          <p class="resolve-dialog-code">{{ resolveFallaTarget.codigo_interno }} — {{ resolveFallaTarget.proyecto?.nombre_comercial }}</p>
          <div class="resolve-dialog-field">
            <label class="resolve-dialog-label">Fecha y hora de solución *</label>
            <DatePicker v-model="resolveFecha" showTime hourFormat="24"
              dateFormat="yy-mm-dd" class="w-full" showIcon />
          </div>
          <div class="resolve-dialog-field">
            <label class="resolve-dialog-label">Tipo de solución</label>
            <Select v-model="resolveResolucionId" :options="catalogos.resoluciones"
              optionLabel="etiqueta" optionValue="id"
              placeholder="Seleccionar (opcional)" showClear class="w-full" />
          </div>
        </div>
        <template #footer>
          <Button label="Cancelar" severity="secondary" outlined @click="resolveDialogVisible = false" :disabled="resolvingFalla" />
          <Button label="Marcar resuelta" severity="success" :loading="resolvingFalla" @click="confirmarResolve">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </template>
      </Dialog>

    </template><!-- /TAB 0 -->

    <!-- ══ TAB 1 — CALENDARIO ══════════════════════════════════════════════ -->
    <div v-if="activeTab === 1" class="mon-tab-calendario">
      <CalendarioFallas
        :refresh-key="calRefreshKey"
        @editar="abrirEditar"
        @ver-falla="irAFallaDesdeCalendario"
      />
    </div><!-- /TAB 1 -->

    <!-- ══ TAB 2 — MAPA ══════════════════════════════════════════════════ -->

    <!-- ══ BOTÓN FLOTANTE: Diagrama fasorial ══════════════════════════════ -->
    <FasorialButton />

  </div><!-- /gf-page -->
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import MultiSelect from 'primevue/multiselect'
import FallaForm from './FallaForm.vue'
import FallaArchivos from './FallaArchivos.vue'
import CalendarioFallas from './CalendarioFallas.vue'
import FasorialButton from '~/features/fallas/components/FasorialButton.vue'
const FallasMapView = defineAsyncComponent(() => import('./FallasMapView.vue'))
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Title, Filler
} from 'chart.js'
ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Filler)
import { FallasService } from '~/features/fallas/services/fallas'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { tituloFalla, categoriaFalla, clasificacionDetalle } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { formatCOP as fmtCOP } from '~/utils/currency'
import { ArrowRightIcon, BellIcon, BriefcaseIcon, BuildingIcon, CalendarIcon, CalendarPlusIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon, ClockIcon, DollarSignIcon, ExternalLinkIcon, HourglassIcon, InboxIcon, InfoIcon, LightbulbIcon, ListIcon, LoaderCircleIcon, MessagesSquareIcon, PencilIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, SearchIcon, SendIcon, ServerIcon, TimerIcon, Trash2Icon, UserPenIcon, WifiIcon, WrenchIcon, XIcon, ZapIcon } from '@lucide/vue'

const fallasService = new FallasService()
const proyectosService = new ProyectosService()
const generacionSolarService = new GeneracionSolarService()

const route          = useRoute()
const router         = useRouter()
const confirm = useConfirm()

// ── Calendario: refresh automático al guardar fallas ─────────────────────
const calRefreshKey = ref(0)

// ── Tabs ─────────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Fallas',     icon: ZapIcon },
  { label: 'Calendario', icon: CalendarIcon },
]
const activeTab = ref(0)

// ── Buckets ───────────────────────────────────────────────────────────────
const BUCKETS = [
  { key: 'activas',  label: 'Activas',    icon: ZapIcon,              color: '#dc2626' },
  { key: 'alerta',   label: 'Alerta SLA', icon: CircleAlertIcon, color: '#d97706' },
  { key: 'cerradas', label: 'Cerradas',   icon: CircleCheckIcon,      color: '#16a34a' },
  { key: 'todas',    label: 'Todas',      icon: ListIcon,              color: '#915BD8' },
]

const AVATAR_PALETTE = ['#915BD8', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777']

// ── Estado base ───────────────────────────────────────────────────────────
const allFallas  = ref([])
const proyectos  = ref([])
const catalogos  = ref({ estados: [], prioridades: [], tipos: [], resoluciones: [] })
const loading    = ref(false)
const error      = ref(null)

// ── Filtros ───────────────────────────────────────────────────────────────
// Sincronizados con la URL (?q=&proyecto=&prioridad=&estado=&desde=&hasta=)
// para que se sostengan al volver con "atras" o al refrescar.
const bucket           = ref('activas')
const search           = ref(route.query.q || '')
const filtroProyecto   = ref(route.query.proyecto ? Number(route.query.proyecto) : null)
const filtroPrioridad  = ref(route.query.prioridad || null)
const filtroEstado     = ref(route.query.estado || null)
const filtroFechaDesde = ref(route.query.desde ? new Date(route.query.desde) : null)
const filtroFechaHasta = ref(route.query.hasta ? new Date(route.query.hasta) : null)

watch([search, filtroProyecto, filtroPrioridad, filtroEstado, filtroFechaDesde, filtroFechaHasta],
  ([q, proyecto, prioridad, estado, desde, hasta]) => {
    const query = {}
    if (q) query.q = q
    if (proyecto) query.proyecto = proyecto
    if (prioridad) query.prioridad = prioridad
    if (estado) query.estado = estado
    if (desde) query.desde = desde.toISOString().split('T')[0]
    if (hasta) query.hasta = hasta.toISOString().split('T')[0]
    router.replace({ query })
  })

// ── Refs DOM ─────────────────────────────────────────────────────────────
const searchInputRef  = ref(null)
const pageRef         = ref(null)
const stickyHeaderRef = ref(null)

// ── Drawer / detalle ──────────────────────────────────────────────────────
const drawerVisible  = ref(false)
const drawerFalla    = ref(null)
const quickEdit      = reactive({ estado_id: null, prioridad_id: null, sla_limite_horas: null })
const savingQuick    = ref(false)
const savedFlash     = ref(false)
const resolvingFalla       = ref(false)
const resolveDialogVisible = ref(false)
const resolveFallaTarget   = ref(null)
const resolveFecha         = ref(new Date())
const resolveResolucionId  = ref(null)
const addingSeg      = ref(false)
const nuevaNota      = reactive({ nota: '', estado_id: null })

// ── Dialog formulario ─────────────────────────────────────────────────────
const formDialogVisible = ref(false)
const editingFalla      = ref(null)
const savingForm        = ref(false)

// ── Tab Gráficos: Generación ───────────────────────────────────────────────
const genHoyLoading      = ref(false)
const genHoyRows         = ref([])   // [{nombre_comercial, real, p90}]
const hoyLabel           = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long' })
const gen7Loading        = ref(false)
const gen7Days           = ref([])       // [{fecha, real, p90}] — últimos 7 días
const genProjLoading      = ref(false)
const genProjCargado      = ref(false)
const genProjSel          = ref(null)        // ID de un solo proyecto (nuestra BD)
const genProjFiltro       = ref('30d')       // ayer | semana | mes | 30d | custom
const genProjGran         = ref('day')       // day | hour
const genProjFechaInicio  = ref(new Date(Date.now() - 29 * 86400000))
const genProjFechaFin     = ref(new Date())
const genProjPuntos       = ref([])          // [{ label, kwh }] desde Solenium
const genProjTotalKwh     = ref(0)

const GENPROJ_FILTROS = [
  { key: 'ayer',   label: 'Ayer' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: '30d',    label: 'Últimos 30 días' },
  { key: 'custom', label: 'Personalizado' },
]

function aplicarFiltroGenProj(key) {
  genProjFiltro.value = key
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  if (key === 'ayer') {
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
    genProjFechaInicio.value = ayer
    genProjFechaFin.value    = ayer
  } else if (key === 'semana') {
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    genProjFechaInicio.value = lunes
    genProjFechaFin.value    = hoy
  } else if (key === 'mes') {
    genProjFechaInicio.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    genProjFechaFin.value    = hoy
  } else if (key === '30d') {
    const d = new Date(hoy); d.setDate(d.getDate() - 29)
    genProjFechaInicio.value = d
    genProjFechaFin.value    = hoy
  }
  // 'custom' no cambia las fechas — el usuario las elige con DatePicker
}

function setGranHour() {
  genProjGran.value = 'hour'
  // Si el rango es > 7 días, reducir a "Ayer" automáticamente
  if (genProjDiasRango.value > 7) {
    aplicarFiltroGenProj('ayer')
  }
  // Recargar si ya había datos
  if (genProjSel.value && genProjCargado.value) cargarGenProj()
}

const genProjDiasRango = computed(() => {
  const fi = genProjFechaInicio.value
  const ff = genProjFechaFin.value
  if (!fi || !ff) return 1
  return Math.max(1, Math.round((ff - fi) / 86400000) + 1)
})

// ── Computed: lógica de buckets ───────────────────────────────────────────
function esAlertaSLA(f) {
  return !f.estado?.es_estado_final && (f.sla_cumplido === false || (f.dias_abierta ?? 0) >= 7)
}

function bucketDeFalla(f) {
  if (f.estado?.es_estado_final) return 'cerradas'
  return 'activas'
}

const counts = computed(() => {
  const c = { activas: 0, alerta: 0, cerradas: 0, todas: allFallas.value.length }
  for (const f of allFallas.value) {
    if (f.estado?.es_estado_final) {
      c.cerradas++
    } else {
      c.activas++
      if (esAlertaSLA(f)) c.alerta++
    }
  }
  return c
})

const porBucket = computed(() => {
  if (bucket.value === 'todas')    return allFallas.value
  if (bucket.value === 'cerradas') return allFallas.value.filter(f => f.estado?.es_estado_final)
  if (bucket.value === 'alerta')   return allFallas.value.filter(f => !f.estado?.es_estado_final && esAlertaSLA(f))
  // activas
  return allFallas.value.filter(f => !f.estado?.es_estado_final)
})

const filtradas = computed(() => {
  let arr = porBucket.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    arr = arr.filter(f =>
      (f.codigo_interno || '').toLowerCase().includes(q) ||
      (f.descripcion || '').toLowerCase().includes(q) ||
      (f.proyecto?.nombre_comercial || '').toLowerCase().includes(q) ||
      tituloFalla(f).toLowerCase().includes(q) ||
      categoriaFalla(f).etiqueta.toLowerCase().includes(q)
    )
  }
  if (filtroProyecto.value)  arr = arr.filter(f => f.proyecto?.id === filtroProyecto.value)
  if (filtroPrioridad.value) arr = arr.filter(f => f.prioridad?.codigo === filtroPrioridad.value)
  if (filtroEstado.value)    arr = arr.filter(f => f.estado?.codigo === filtroEstado.value)
  if (filtroFechaDesde.value) {
    const desde = startOfDay(filtroFechaDesde.value)
    arr = arr.filter(f => f.fecha_identificacion && new Date(f.fecha_identificacion + 'T00:00:00') >= desde)
  }
  if (filtroFechaHasta.value) {
    const hasta = startOfDay(filtroFechaHasta.value); hasta.setHours(23, 59, 59, 999)
    arr = arr.filter(f => f.fecha_identificacion && new Date(f.fecha_identificacion + 'T00:00:00') <= hasta)
  }
  return arr
})

const hayFiltros = computed(() =>
  search.value || filtroProyecto.value || filtroPrioridad.value ||
  filtroEstado.value || filtroFechaDesde.value || filtroFechaHasta.value
)

const bucketActual = computed(() => BUCKETS.find(b => b.key === bucket.value) || BUCKETS[0])

const emptyTitulo = computed(() => {
  if (hayFiltros.value) return 'Sin resultados con los filtros aplicados'
  return {
    activas:  'No hay fallas activas',
    alerta:   'Sin fallas en alerta SLA',
    cerradas: 'Sin fallas cerradas',
    todas:    'No hay fallas registradas',
  }[bucket.value]
})

const emptySubtitulo = computed(() => {
  if (hayFiltros.value) return 'Prueba con otros filtros o limpia la búsqueda'
  return {
    activas:  'Todas las incidencias están bajo control',
    alerta:   'Ninguna falla supera el umbral de SLA',
    cerradas: 'Aún no se han cerrado fallas',
    todas:    'Registra la primera para empezar',
  }[bucket.value]
})

const sortedSeguimientos = computed(() =>
  [...(drawerFalla.value?.seguimientos ?? [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
)

// ── Clasificación estructurada del drawer (equipo que falló) ──────────────
const clasifDrawer = computed(() => clasificacionDetalle(drawerFalla.value))

// Origen de la falla: solo se puede afirmar con certeza el caso automático
// (alarma_monitoreo_id no se puede falsificar). centinela se eliminó
// (2026-09-02) -- era texto libre sin validación, no una señal confiable.
const origenFalla = computed(() => {
  const f = drawerFalla.value
  if (!f) return null
  if (f.alarma_monitoreo_id) return 'Alarma automática de monitoreo'
  return null
})

// ── Reincidencia: cuántas fallas del mismo tipo tiene el mismo proyecto ──
const recurrenciaMap = computed(() => {
  const m = {}
  for (const f of allFallas.value) {
    if (!f.proyecto?.id || !f.tipo?.id) continue
    const k = `${f.proyecto.id}-${f.tipo.id}`
    m[k] = (m[k] || 0) + 1
  }
  return m
})

function recurrencias(f) {
  if (!f?.proyecto?.id || !f?.tipo?.id) return 0
  return recurrenciaMap.value[`${f.proyecto.id}-${f.tipo.id}`] || 0
}

// ── Tiempo en estado actual (desde último cambio de estado en seguimientos) ─
const tiempoEnEstadoActual = computed(() => {
  if (!drawerFalla.value) return null
  const segs = [...(drawerFalla.value.seguimientos ?? [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const lastChange = segs.find(s => s.estado_nuevo)
  if (!lastChange) return null
  const diffH = (Date.now() - new Date(lastChange.created_at)) / 3_600_000
  if (diffH < 1)  return `${Math.round(diffH * 60)} min`
  if (diffH < 24) return `${Math.round(diffH)}h`
  return `${Math.round(diffH / 24)}d`
})

const navIndex = computed(() => {
  if (!drawerFalla.value) return -1
  return filtradas.value.findIndex(f => f.id === drawerFalla.value.id)
})

// ── Carga de datos ────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  error.value   = null
  try {
    const primera = await fallasService.listar({ page: 1, size: 500 })
    const total = primera.total ?? 0
    const items = [...(primera.items ?? [])]
    if (total > 500) {
      const totalPages = Math.ceil(total / 500)
      const rest = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fallasService.listar({ page: i + 2, size: 500 })
        )
      )
      for (const r of rest) {
        if (r.status === 'fulfilled') items.push(...(r.value.items ?? []))
      }
    }
    allFallas.value = items
  } catch (e) {
    error.value = e.data?.detail || e.message || 'Error de conexión'
  } finally {
    loading.value = false
  }
}

async function cargarCatalogos() {
  try {
    catalogos.value = await fallasService.obtenerCatalogos()
  } catch { /* no crítico */ }
}

async function cargarProyectos() {
  try {
    proyectos.value = await proyectosService.listar({ size: 500 })
    // Cargar gráficos de generación una vez que los proyectos estén disponibles
    cargarGenHoy()
    cargarGen7()
  } catch { /* no crítico */ }
}

// ── Helpers P90 ──────────────────────────────────────────────────────────
// P90 diario de un proyecto para una fecha: p90_mensual_kwh[mes] / días del mes
function dailyP90(proyectoId, fecha) {
  const p = proyectos.value.find(x => x.id === proyectoId)
  const arr = p?.p90_mensual_kwh
  if (!arr || !arr.length) return 0
  const dt = new Date(fecha + 'T00:00:00')
  const month = dt.getMonth()                                         // 0-indexed
  const daysInMonth = new Date(dt.getFullYear(), month + 1, 0).getDate()
  return (Number(arr[month]) || 0) / daysInMonth
}
// P90 diario sumado de proyectos genOp (o todos si genOp está vacío)
function dailyP90Total(fecha) {
  const projs = proyectosGenOp.value.length ? proyectosGenOp.value : proyectos.value
  return projs.reduce((sum, p) => sum + dailyP90(p.id, fecha), 0)
}

// ── Carga: Generación de hoy ─────────────────────────────────────────────
// P90: desde p90_mensual_kwh del proyecto (ya funciona).
// Real: desde Solenium vía /generacion-solar/generacion-hoy (proyecto_id + kwh_real).
async function cargarGenHoy() {
  const projs = proyectosGenOp.value
  if (!projs.length) return
  genHoyLoading.value = true
  genHoyRows.value = []
  try {
    const hoy = new Date().toISOString().split('T')[0]

    // 1. byProyecto con P90 por proyecto (ya funciona)
    const byProyecto = {}
    for (const p of projs) {
      const p90 = dailyP90(p.id, hoy)
      if (p90 > 0) byProyecto[p.id] = { nombre: p.nombre_comercial, real: 0, p90 }
    }

    // 2. Real desde Solenium — el backend empareja por project_id_solenium o por nombre
    try {
      const filas = await generacionSolarService.obtenerGeneracionHoy()
      for (const row of filas) {
        if (byProyecto[row.proyecto_id] !== undefined) {
          byProyecto[row.proyecto_id].real   = Number(row.kwh_real || 0)
          byProyecto[row.proyecto_id].fuente = row.fuente || 'sin_dato'
        }
      }
    } catch { /* Solenium no disponible — solo P90 */ }

    genHoyRows.value = Object.values(byProyecto)
      .map(r => ({ ...r, real: +r.real.toFixed(1), p90: +r.p90.toFixed(1), fuente: r.fuente || 'sin_dato' }))
      .sort((a, b) => b.p90 - a.p90)
  } catch {
    genHoyRows.value = []
  } finally {
    genHoyLoading.value = false
  }
}

// ── Carga: Generación últimos 7 días ─────────────────────────────────────
// Histórico: Unergy API. Hoy: Solenium (mismo origen que "Generación de hoy").
async function cargarGen7() {
  gen7Loading.value = true
  gen7Days.value = []
  try {
    const hoy    = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    const hace7  = new Date(hoy); hace7.setDate(hace7.getDate() - 6)
    const fi     = hace7.toISOString().split('T')[0]
    const ff     = hoyStr

    // Fetch Unergy (histórico) y Solenium (hoy) en paralelo
    const [unergRes, solRes] = await Promise.allSettled([
      fallasService.obtenerResumenGeneracion({ date_from: fi, date_to: ff }),
      generacionSolarService.obtenerGeneracionHoyCompleta(),
    ])

    // Indexar real por fecha (Unergy histórico)
    const realByDate = {}
    if (unergRes.status === 'fulfilled') {
      for (const entry of unergRes.value.dates ?? []) {
        realByDate[entry.fecha] = entry.kwh_real
      }
    }

    // Reemplazar hoy con el total de Solenium (más real-time, mismo origen que "Generación de hoy")
    if (solRes.status === 'fulfilled') {
      const solTotal = Number(solRes.value.total ?? 0)
      if (solTotal > 0) realByDate[hoyStr] = +solTotal.toFixed(1)
    }

    // Rellenar los 7 días; P90 calculado desde proyectos
    const result = []
    const cursor = new Date(hace7)
    while (cursor <= hoy) {
      const key = cursor.toISOString().split('T')[0]
      const p90 = dailyP90Total(key)
      result.push({
        fecha: key,
        real: realByDate[key] != null ? realByDate[key] : null,
        p90:  p90 > 0 ? +p90.toFixed(1) : null,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    gen7Days.value = result
  } catch {
    gen7Days.value = []
  } finally {
    gen7Loading.value = false
  }
}

// ── Carga: Generación por proyecto (desde Solenium vía backend) ──────────
async function cargarGenProj() {
  if (!genProjSel.value) return
  // Si granularidad=hour y rango > 7 días, forzar día
  if (genProjGran.value === 'hour' && genProjDiasRango.value > 7) {
    genProjGran.value = 'day'
  }
  genProjLoading.value = true
  genProjCargado.value = false
  genProjPuntos.value  = []
  genProjTotalKwh.value = 0
  try {
    const fi = genProjFechaInicio.value.toISOString().split('T')[0]
    const ff = genProjFechaFin.value.toISOString().split('T')[0]
    const data = await generacionSolarService.obtenerHistorialProyecto(genProjSel.value, {
      fecha_inicio: fi,
      fecha_fin: ff,
      granularidad: genProjGran.value,
    })
    genProjPuntos.value   = data.puntos ?? []
    genProjTotalKwh.value = data.total_kwh ?? 0
  } catch {
    genProjPuntos.value   = []
    genProjTotalKwh.value = 0
  } finally {
    genProjLoading.value = false
    genProjCargado.value = true
  }
}

// ── Acciones ──────────────────────────────────────────────────────────────
function limpiarFiltros() {
  search.value           = ''
  filtroProyecto.value   = null
  filtroPrioridad.value  = null
  filtroEstado.value     = null
  filtroFechaDesde.value = null
  filtroFechaHasta.value = null
}

function navegar(delta) {
  if (!filtradas.value.length) return
  const cur = navIndex.value
  if (cur < 0) return
  const next = Math.max(0, Math.min(filtradas.value.length - 1, cur + delta))
  if (next === cur) return
  abrirDrawer(filtradas.value[next])
}

function abrirDrawer(falla) {
  drawerFalla.value       = falla
  quickEdit.estado_id     = falla.estado?.id ?? null
  quickEdit.prioridad_id  = falla.prioridad?.id ?? null
  quickEdit.sla_limite_horas = falla.sla_limite_horas ?? null
  nuevaNota.nota          = ''
  nuevaNota.estado_id     = null
  drawerVisible.value     = true
}

function abrirCrear() {
  editingFalla.value    = null
  formDialogVisible.value = true
}

function abrirEditar(falla) {
  editingFalla.value    = falla
  formDialogVisible.value = true
}

async function _mostrarResultadoNotificacion(fallaIds) {
  // Envía notificación para cada falla y muestra un toast con el resultado.
  // Si alguna falla, muestra advertencia pero NO bloquea el flujo.
  const resultados = await Promise.all(
    fallaIds.map(id =>
      fallasService.notificar(id)
        .catch(err => ({ ok: false, enviados: [], errores: [err.data?.detail || err.message || 'Error desconocido'], sin_correos: false }))
    )
  )

  const todosOk     = resultados.every(r => r.ok)
  const sinCorreos  = resultados.some(r => r.sin_correos)
  const enviados    = [...new Set(resultados.flatMap(r => r.enviados || []))]
  const errores     = resultados.flatMap(r => r.errores || []).filter(Boolean)

  if (todosOk) {
    toast.success('✉️ Notificación enviada', {
      description: `Correo enviado a: ${enviados.join(', ')}`,
      duration: 5000,
    })
  } else if (sinCorreos) {
    toast.warning('⚠️ Sin correos configurados', {
      description: 'La falla fue guardada pero el cliente no tiene correos operacionales configurados. Agrégalos en Clientes → Correos Operacionales.',
      duration: 8000,
    })
  } else {
    // Obtener el error SMTP más descriptivo
    const errorSmtp = errores.find(e => e.includes('534') || e.includes('Application-specific') || e.includes('password'))
    toast.error('✉️ Error al enviar notificación', {
      description: errorSmtp
        ? 'Error de autenticación SMTP: Gmail requiere una App Password (contraseña de aplicación). Configúrala en las variables de Railway.'
        : `Error: ${errores[0] || 'Error desconocido'}`,
      duration: 10000,
    })
  }
}

function irAFallaDesdeCalendario(falla) {
  // Cambia al tab Fallas y abre el drawer con la falla seleccionada
  activeTab.value = 0
  nextTick(() => abrirDrawer(falla))
}

function editarDesdeDrawer() {
  if (!drawerFalla.value) return
  editingFalla.value    = drawerFalla.value
  formDialogVisible.value = true
}

async function onSaveForm(payload) {
  savingForm.value = true
  try {
    const notificar = !!payload.notificacion

    if (editingFalla.value) {
      // ── Edición (un solo proyecto) ──────────────────────────────────────
      const notaInicial = payload.nota_inicial
      const archivosEdit = payload._archivos ?? []
      delete payload.nota_inicial
      delete payload._archivos
      await fallasService.actualizar(editingFalla.value.id, payload)
      if (notaInicial) await fallasService.crearSeguimiento(editingFalla.value.id, { nota: notaInicial })
      if (archivosEdit.length) {
        await Promise.all(archivosEdit.map(file =>
          fallasService.subirArchivo(editingFalla.value.id, file)
        ))
      }
      toast.success('Falla actualizada', { duration: 2500 })

      // Notificación tras edición
      if (notificar) {
        await _mostrarResultadoNotificacion(
          [editingFalla.value.id]
        )
      }
    } else {
      // ── Creación (uno o más proyectos) ──────────────────────────────────
      const { proyecto_ids, nota_inicial, _archivos, ...base } = payload
      const ids      = proyecto_ids ?? []
      const archivos = _archivos ?? []

      // Una falla por proyecto, en paralelo
      const nuevas = await Promise.all(
        ids.map(pid => fallasService.crear({ ...base, proyecto_id: pid }))
      )
      // Nota inicial para cada falla creada (si la hay)
      if (nota_inicial) {
        await Promise.all(
          nuevas.map(f => fallasService.crearSeguimiento(f.id, { nota: nota_inicial }))
        )
      }
      // Subir archivos adjuntos a cada falla (si los hay)
      if (archivos.length) {
        await Promise.all(
          nuevas.flatMap(f =>
            archivos.map(file => fallasService.subirArchivo(f.id, file))
          )
        )
      }
      const n = nuevas.length
      toast.success(n === 1 ? 'Falla registrada' : `${n} fallas registradas`, {
        description: n > 1 ? `Se creó una falla independiente por cada proyecto seleccionado` : undefined,
        duration: 3000,
      })

      // Notificación tras creación
      if (notificar && nuevas.length) {
        await _mostrarResultadoNotificacion(nuevas.map(f => f.id))
      }
    }
    formDialogVisible.value = false
    calRefreshKey.value++     // ← dispara recarga del calendario
    await cargar()
    if (drawerFalla.value && editingFalla.value) {
      const refreshed = allFallas.value.find(f => f.id === editingFalla.value.id)
      if (refreshed) abrirDrawer(refreshed)
    }
  } catch (err) {
    const msg = err?.data?.detail ?? 'Error al guardar'
    toast.error('Error', { description: msg, duration: 4000 })
  } finally {
    savingForm.value = false
  }
}

// Autosave con debounce
let _autosaveTimer = null
function autosaveQuick() {
  if (_autosaveTimer) clearTimeout(_autosaveTimer)
  _autosaveTimer = setTimeout(() => guardarQuickEdit(), 350)
}

async function guardarQuickEdit() {
  if (!drawerFalla.value) return
  const payload = {}
  if (quickEdit.estado_id !== drawerFalla.value.estado?.id) payload.estado_id = quickEdit.estado_id
  if (quickEdit.prioridad_id !== drawerFalla.value.prioridad?.id) payload.prioridad_id = quickEdit.prioridad_id
  if ((quickEdit.sla_limite_horas || null) !== (drawerFalla.value.sla_limite_horas || null))
    payload.sla_limite_horas = quickEdit.sla_limite_horas || null
  if (!Object.keys(payload).length) return

  savingQuick.value = true
  try {
    const data = await fallasService.actualizar(drawerFalla.value.id, payload)
    drawerFalla.value = data
    const idx = allFallas.value.findIndex(f => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    savedFlash.value = true
    setTimeout(() => { savedFlash.value = false }, 1500)
  } catch (err) {
    toast.error('No se pudo guardar', { description: err?.data?.detail, duration: 3000 })
    quickEdit.estado_id     = drawerFalla.value.estado?.id ?? null
    quickEdit.prioridad_id  = drawerFalla.value.prioridad?.id ?? null
    quickEdit.sla_limite_horas = drawerFalla.value.sla_limite_horas ?? null
  } finally {
    savingQuick.value = false
  }
}

function quickResolve(falla) {
  const estadoFinal = catalogos.value.estados.find(e => e.es_estado_final)
  if (!estadoFinal) {
    toast.warning('Sin estado final configurado', { duration: 3000 })
    return
  }
  resolveFallaTarget.value  = falla
  resolveFecha.value        = new Date()
  resolveResolucionId.value = null
  resolveDialogVisible.value = true
}

async function confirmarResolve() {
  const falla = resolveFallaTarget.value
  if (!falla) return
  const estadoFinal = catalogos.value.estados.find(e => e.es_estado_final)
  resolvingFalla.value = true
  try {
    const payload = {
      estado_id:        estadoFinal.id,
      fecha_resolucion: resolveFecha.value?.toISOString() ?? new Date().toISOString(),
      sla_cumplido:     !slaVencido(falla),
    }
    if (resolveResolucionId.value) payload.resolucion_id = resolveResolucionId.value
    const data = await fallasService.actualizar(falla.id, payload)
    const idx = allFallas.value.findIndex(f => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    if (drawerFalla.value?.id === data.id) drawerFalla.value = data
    resolveDialogVisible.value = false
    calRefreshKey.value++
    toast.success('Falla resuelta', { duration: 2500 })
  } catch (err) {
    toast.error('Error', { description: err?.data?.detail, duration: 3000 })
  } finally {
    resolvingFalla.value = false
  }
}

async function reabrirFalla() {
  const abierta = catalogos.value.estados.find(e => e.codigo === 'abierta')
    || catalogos.value.estados.find(e => !e.es_estado_final)
  if (!abierta) {
    toast.warning('Sin estado abierto configurado', { duration: 3000 })
    return
  }
  try {
    const data = await fallasService.actualizar(drawerFalla.value.id, {
      estado_id:        abierta.id,
      fecha_resolucion: null,
    })
    drawerFalla.value = data
    const idx = allFallas.value.findIndex(f => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    quickEdit.estado_id = data.estado?.id ?? null
    toast.success('Falla reabierta', { duration: 2500 })
  } catch (err) {
    toast.error('Error', { description: err?.data?.detail, duration: 3000 })
  }
}

async function agregarSeguimiento() {
  if (!nuevaNota.nota.trim() && !nuevaNota.estado_id) return
  addingSeg.value = true
  try {
    const payload = {}
    if (nuevaNota.nota.trim()) payload.nota = nuevaNota.nota.trim()
    if (nuevaNota.estado_id) payload.estado_nuevo_id = nuevaNota.estado_id
    await fallasService.crearSeguimiento(drawerFalla.value.id, payload)
    nuevaNota.nota      = ''
    nuevaNota.estado_id = null
    const data = await fallasService.obtener(drawerFalla.value.id)
    drawerFalla.value = data
    const idx = allFallas.value.findIndex(f => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    quickEdit.estado_id = data.estado?.id ?? null
    if (payload.estado_nuevo_id) calRefreshKey.value++
    toast.success('Seguimiento agregado', { duration: 2000 })
  } catch (err) {
    toast.error('Error', { description: err?.data?.detail, duration: 3000 })
  } finally {
    addingSeg.value = false
  }
}

function confirmDelete(falla) {
  confirm({
    title: 'Eliminar falla',
    description: `¿Eliminar la falla ${falla.codigo_interno}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await fallasService.eliminar(falla.id)
        allFallas.value     = allFallas.value.filter(f => f.id !== falla.id)
        drawerVisible.value = false
        toast.success('Falla eliminada', { duration: 2500 })
      } catch (err) {
        toast.error('Error', { description: err?.data?.detail, duration: 3000 })
      }
    },
  })
}

// ── Helpers visuales ──────────────────────────────────────────────────────
function prioColor(codigo) { return colorPrioridad(codigo, '#9ca3af') }

function prioPillStyle(codigo) {
  const c = prioColor(codigo)
  return { background: c + '12', color: c }
}

function bucketPillStyle(color, active) {
  if (!active) return {}
  return { color }
}

function rowClass(data) {
  return drawerFalla.value?.id === data.id ? 'gf-row-active' : ''
}

function initials(nombre) {
  if (!nombre) return '?'
  const parts = nombre.trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

function avatarStyle(user) {
  if (!user) return { background: '#9ca3af' }
  const id    = user.id ?? hashCode(user.nombre || '')
  const color = AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length]
  return { background: color }
}

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}

function diasClass(f) {
  if (f.estado?.es_estado_final) return 'dias-cerrada'
  const d = f.dias_abierta ?? 0
  if (d >= 7) return 'dias-red'
  if (d >= 3) return 'dias-yellow'
  return 'dias-green'
}

function horasTranscurridas(falla) {
  if (!falla?.fecha_identificacion) return 0
  const desde = new Date(falla.fecha_ocurrencia || (falla.fecha_identificacion + 'T00:00:00'))
  const hasta  = falla.fecha_resolucion ? new Date(falla.fecha_resolucion) : new Date()
  return Math.max(0, Math.round((hasta - desde) / 3_600_000))
}

function slaPct(falla) {
  if (!falla?.sla_limite_horas_efectivo) return null
  return Math.min(Math.round((horasTranscurridas(falla) / falla.sla_limite_horas_efectivo) * 100), 110)
}

function slaVencido(falla) {
  const p = slaPct(falla)
  return p != null && p >= 100
}

function slaFillStyle(falla) {
  const p = Math.min(slaPct(falla) ?? 0, 100)
  return { width: `${p}%`, background: slaTextColor(falla) }
}

function slaTextColor(falla) {
  if (falla?.sla_cumplido === true)  return '#16a34a'
  if (falla?.sla_cumplido === false) return '#dc2626'
  const p = slaPct(falla)
  if (p == null)  return '#9ca3af'
  if (p >= 100)   return '#dc2626'
  if (p >= 70)    return '#d97706'
  return '#16a34a'
}

function slaText(falla) {
  if (falla?.sla_cumplido === true)  return 'OK'
  if (falla?.sla_cumplido === false) return 'Vencido'
  const p = slaPct(falla)
  if (p == null) return '—'
  if (p >= 100)  return 'Vencido'
  return `${p}%`
}

function slaSeverity(falla) {
  const c = slaTextColor(falla)
  if (c === '#16a34a') return 'success'
  if (c === '#dc2626') return 'destructive'
  if (c === '#d97706') return 'warning'
  return 'default'
}

function fmtFecha(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO',
    { day: '2-digit', month: 'short', year: 'numeric' })
}

// Fecha + hora para campos datetime (ocurrencia, resolución).
function fmtFechaHora(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  if (isNaN(d)) return fmtFecha(String(dt).slice(0, 10))
  return d.toLocaleString('es-CO',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Moneda COP sin decimales.

// Duración legible a partir de horas (min / h / d h).
function fmtHoras(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${Math.round(h * 10) / 10} h`
  const dias = Math.floor(h / 24)
  const rest = Math.round(h % 24)
  return rest ? `${dias} d ${rest} h` : `${dias} d`
}

function relativeTime(d, includeAbsolute = false) {
  if (!d) return ''
  const date = typeof d === 'string' && d.length === 10
    ? new Date(d + 'T00:00:00')
    : new Date(d)
  const diff = (Date.now() - date.getTime()) / 1000
  let rel
  if (diff < 0) {
    const future = Math.abs(diff)
    if (future < 86400) rel = `en ${Math.floor(future / 3600)}h`
    else rel = `en ${Math.floor(future / 86400)}d`
  } else if (diff < 60)          rel = 'ahora'
  else if (diff < 3600)          rel = `hace ${Math.floor(diff / 60)}min`
  else if (diff < 86400)         rel = `hace ${Math.floor(diff / 3600)}h`
  else if (diff < 86400 * 30)    rel = `hace ${Math.floor(diff / 86400)}d`
  else if (diff < 86400 * 365)   rel = `hace ${Math.floor(diff / (86400 * 30))}m`
  else                           rel = `hace ${Math.floor(diff / (86400 * 365))}a`
  return rel
}

function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

// ── Computed: Generación ──────────────────────────────────────────────────
// Proyectos para los gráficos de generación.
// Prioridad: 1) srv_operacion + minigranja/gd  2) cualquier proyecto con P90
// 3) todos los proyectos (último recurso para que siempre haya datos).
const proyectosGenOp = computed(() => {
  if (!proyectos.value.length) return []
  const conOp = proyectos.value.filter(p =>
    p.srv_operacion === true && ['minigranja', 'gd'].includes(p.tipo_proyecto)
  )
  if (conOp.length) return conOp
  const conP90 = proyectos.value.filter(p => {
    const arr = p.p90_mensual_kwh
    return Array.isArray(arr) ? arr.some(v => Number(v) > 0)
         : arr && typeof arr === 'object' ? Object.values(arr).some(v => Number(v) > 0)
         : false
  })
  if (conP90.length) return conP90
  return proyectos.value   // muestra todos si no hay mejor opción
})
// IDs de esos proyectos para filtrar filas de generación
const genOpIds = computed(() => new Set(proyectosGenOp.value.map(p => p.id)))

// ── Constantes Chart.js ───────────────────────────────────────────────────
const FONT       = { family: 'inherit', size: 11 }
const GRID_COLOR = '#f0eaf8'
const BRAND      = '#915BD8'

// Chart 1 ─ Últimos 7 días
const gen7HasData   = computed(() => gen7Days.value.some(d => d.real != null || d.p90 != null))
const gen7HasP90    = computed(() => gen7Days.value.some(d => d.p90 != null && d.p90 > 0))
const gen7TotalReal = computed(() => +gen7Days.value.reduce((s, d) => s + (d.real || 0), 0).toFixed(0))
const gen7TotalP90  = computed(() => +gen7Days.value.reduce((s, d) => s + (d.p90  || 0), 0).toFixed(0))

const lineGen7Data = computed(() => ({
  labels: gen7Days.value.map(d =>
    new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
  ),
  datasets: [
    {
      label: 'Real (kWh)',
      data: gen7Days.value.map(d => d.real),
      borderColor: '#16a34a', backgroundColor: '#16a34a20',
      borderWidth: 2.5, fill: true, tension: 0.4,
      pointRadius: 5, pointHoverRadius: 7, spanGaps: true,
    },
    ...(gen7HasP90.value ? [{
      label: 'P90 (kWh)',
      data: gen7Days.value.map(d => d.p90),
      borderColor: '#f59e0b', backgroundColor: 'transparent',
      borderWidth: 2, borderDash: [6, 3], fill: false, tension: 0.4,
      pointRadius: 3, pointHoverRadius: 5, spanGaps: true,
    }] : []),
  ],
}))

const lineGen7Opts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', align: 'end', labels: { font: FONT, padding: 12, boxWidth: 12, boxHeight: 12 } },
    tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Number(ctx.raw ?? 0).toLocaleString('es-CO')} kWh` } },
  },
  scales: {
    x: { grid: { color: GRID_COLOR }, ticks: { font: FONT, color: '#6b7280' }, border: { display: false } },
    y: { grid: { color: GRID_COLOR }, ticks: { font: FONT, color: '#6b7280' }, border: { display: false }, beginAtZero: true },
  },
}

// Chart 3 ─ Hoy
const genHoyKpi = computed(() => {
  const totalReal = genHoyRows.value.reduce((s, r) => s + r.real, 0)
  const totalP90  = genHoyRows.value.reduce((s, r) => s + r.p90,  0)
  return { totalReal: +totalReal.toFixed(1), totalP90: +totalP90.toFixed(1), ratio: totalP90 > 0 ? Math.round(totalReal / totalP90 * 100) : 0 }
})

const barGenHoyData = computed(() => ({
  labels: genHoyRows.value.map(r => r.nombre),
  datasets: [
    {
      label: 'Real (kWh)',
      data: genHoyRows.value.map(r => r.real),
      backgroundColor: genHoyRows.value.map(r => r.p90 > 0 && r.real >= r.p90 ? '#16a34acc' : '#dc2626cc'),
      borderColor:     genHoyRows.value.map(r => r.p90 > 0 && r.real >= r.p90 ? '#16a34a'   : '#dc2626'),
      borderWidth: 1, borderRadius: 4, barThickness: 14,
    },
    {
      label: 'P90 (kWh)',
      data: genHoyRows.value.map(r => r.p90),
      backgroundColor: '#f59e0bcc', borderColor: '#f59e0b',
      borderWidth: 1, borderRadius: 4, barThickness: 14,
    },
  ],
}))

const barGenHoyOpts = {
  indexAxis: 'y', responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', align: 'end', labels: { font: FONT, padding: 12, boxWidth: 12, boxHeight: 12 } },
    tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('es-CO')} kWh` } },
  },
  scales: {
    x: { grid: { color: GRID_COLOR }, ticks: { font: FONT, color: '#6b7280' }, border: { display: false } },
    y: { grid: { display: false }, ticks: { font: { ...FONT, size: 11 }, color: '#374151' }, border: { display: false } },
  },
}

// Chart 2 ─ Generación por proyecto (puntos desde Solenium + fallas superpuestas)
const genProjFallasByDate = computed(() => {
  if (!genProjSel.value) return {}
  const fi = genProjFechaInicio.value?.toISOString().split('T')[0] || ''
  const ff = genProjFechaFin.value?.toISOString().split('T')[0] || ''
  const map = {}
  allFallas.value
    .filter(f => Number(f.proyecto?.id) === Number(genProjSel.value) &&
      (f.fecha_identificacion || '').split('T')[0] >= fi &&
      (f.fecha_identificacion || '').split('T')[0] <= ff)
    .forEach(f => {
      const d = (f.fecha_identificacion || '').split('T')[0]
      if (!map[d]) map[d] = []
      map[d].push(f)
    })
  return map
})

const genProjFallas = computed(() => {
  if (!genProjSel.value) return []
  const fi = genProjFechaInicio.value?.toISOString().split('T')[0] || ''
  const ff = genProjFechaFin.value?.toISOString().split('T')[0] || ''
  return allFallas.value
    .filter(f => Number(f.proyecto?.id) === Number(genProjSel.value) &&
      (f.fecha_identificacion || '').split('T')[0] >= fi &&
      (f.fecha_identificacion || '').split('T')[0] <= ff)
    .sort((a, b) => (a.fecha_identificacion || '').localeCompare(b.fecha_identificacion || ''))
})

const barGenProjData = computed(() => {
  const fbd = genProjFallasByDate.value
  const isHour = genProjGran.value === 'hour'
  return {
    labels: genProjPuntos.value.map(pt => {
      if (isHour) {
        // "2026-05-22 08:00" → "22 may 08h"
        const [day, time] = pt.label.split(' ')
        const d = new Date(day + 'T00:00:00')
        return `${d.toLocaleDateString('es-CO', { day:'2-digit', month:'short' })} ${time?.slice(0, 5) || ''}`
      }
      // "2026-05-22" → "22 may"
      return new Date(pt.label + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    }),
    datasets: [{
      label: 'Generación (kWh)',
      data: genProjPuntos.value.map(pt => pt.kwh),
      // Barras rojas en días con falla (solo en vista diaria)
      backgroundColor: genProjPuntos.value.map(pt => {
        if (isHour) return '#7c3aedcc'
        const day = pt.label.split(' ')[0]
        return fbd[day]?.length ? '#dc2626cc' : '#7c3aedcc'
      }),
      borderColor: genProjPuntos.value.map(pt => {
        if (isHour) return '#7c3aed'
        const day = pt.label.split(' ')[0]
        return fbd[day]?.length ? '#b91c1c' : '#7c3aed'
      }),
      borderWidth: genProjPuntos.value.map(pt => {
        if (isHour) return 1
        const day = pt.label.split(' ')[0]
        return fbd[day]?.length ? 2 : 1
      }),
      borderRadius: 3,
    }],
  }
})

const barGenProjOpts = computed(() => {
  const fbd = genProjFallasByDate.value
  const puntos = genProjPuntos.value
  const isHour = genProjGran.value === 'hour'
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const pt = puntos[items[0]?.dataIndex]
            return pt ? pt.label : ''
          },
          label: ctx => ` ${Number(ctx.raw ?? 0).toLocaleString('es-CO')} kWh`,
          afterBody: (items) => {
            if (isHour) return []
            const pt = puntos[items[0]?.dataIndex]
            if (!pt) return []
            const day = pt.label.split(' ')[0]
            const fallas = fbd[day] || []
            if (!fallas.length) return []
            const lines = ['', `⚡ ${fallas.length} falla(s):`]
            fallas.forEach(f => lines.push(`  · ${f.codigo_interno}: ${(f.descripcion || '').slice(0, 45)}`))
            return lines
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: GRID_COLOR },
        ticks: { font: FONT, color: '#6b7280', maxRotation: 45, maxTicksLimit: isHour ? 24 : 31 },
        border: { display: false },
      },
      y: {
        grid: { color: GRID_COLOR },
        ticks: { font: FONT, color: '#6b7280', callback: v => `${v.toLocaleString('es-CO')} kWh` },
        border: { display: false },
        beginAtZero: true,
      },
    },
  }
})

// ── Keyboard shortcuts ────────────────────────────────────────────────────
function onKeydown(e) {
  const t = e.target.tagName
  if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return
  if (activeTab.value !== 0) return
  if (e.key === '/') {
    e.preventDefault()
    nextTick(() => searchInputRef.value?.$el?.querySelector('input')?.focus())
  } else if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    abrirCrear()
  } else if (e.key === 'Escape' && drawerVisible.value) {
    drawerVisible.value = false
  } else if (drawerVisible.value && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    navegar(e.key === 'ArrowLeft' ? -1 : 1)
  }
}

// Medir altura real del sticky-header y exponerla como CSS custom property
let _headerRO = null
function measureHeader() {
  if (!stickyHeaderRef.value || !pageRef.value) return
  pageRef.value.style.setProperty('--gf-header-h', `${stickyHeaderRef.value.offsetHeight}px`)
}

onMounted(() => {
  cargar()
  cargarCatalogos()
  cargarProyectos()   // cargarGenHoy + cargarGen7 se llaman desde aquí tras cargar proyectos
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    measureHeader()
    if (window.ResizeObserver && stickyHeaderRef.value) {
      _headerRO = new ResizeObserver(measureHeader)
      _headerRO.observe(stickyHeaderRef.value)
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  _headerRO?.disconnect()
})

// Limpiar drawer al cerrar
watch(drawerVisible, (val) => {
  if (!val) setTimeout(() => { drawerFalla.value = null }, 200)
})

// Al cambiar de tab, volver arriba
watch(activeTab, () => {
  nextTick(() => {
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
    else window.scrollTo(0, 0)
  })
})

// Si cambia bucket y la falla abierta no pertenece al nuevo bucket, cerrar panel
watch(bucket, (newBucket) => {
  if (!drawerVisible.value || !drawerFalla.value) return
  if (newBucket === 'todas') return
  const pertenece = (() => {
    const f = drawerFalla.value
    if (newBucket === 'cerradas') return !!f.estado?.es_estado_final
    if (newBucket === 'alerta')   return !f.estado?.es_estado_final && esAlertaSLA(f)
    if (newBucket === 'activas')  return !f.estado?.es_estado_final
    return true
  })()
  if (!pertenece) drawerVisible.value = false
})
</script>

<style scoped>
/* ══ TAB BAR ══════════════════════════════════════════════════════════════ */
.mon-tab-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: #fff;
  border-bottom: 1px solid #ECE7F2;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 25;
}
.mon-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 5px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  color: #6B5A8A;
  border-radius: 6px;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.mon-tab svg { font-size: 12px; }
.mon-tab:hover:not(.mon-tab--active) { color: var(--color-unergy-deep); background: rgba(145,91,216,.08); }
.mon-tab--active {
  background: var(--color-unergy-purple);
  color: var(--color-unergy-avena);
  box-shadow: 0 1px 4px rgba(145,91,216,.3);
}
.mon-tab--active:hover { color: var(--color-unergy-avena); }
.mon-tab-group {
  display: inline-flex;
  background: #F4F1FA;
  border: 1px solid #E5E2EC;
  border-radius: 8px;
  padding: 2px;
  gap: 0;
}

/* ══ Página ══════════════════════════════════════════════════════════════ */
.gf-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #f8f7fa;
  min-height: 100%;
  font-family: 'Sora', system-ui, sans-serif;
}

/* ══ Sticky header ═══════════════════════════════════════════════════════ */
.gf-sticky-header {
  position: sticky;
  top: 41px;
  z-index: 20;
  background: #f8f7fa;
  padding-top: 4px;
  padding-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.gf-sticky-header::before {
  content: "";
  position: absolute;
  left: -24px;
  right: -24px;
  bottom: 100%;
  height: 28px;
  background: #f8f7fa;
  pointer-events: none;
}

/* ══ Topbar ══════════════════════════════════════════════════════════════ */
.gf-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 6px 10px;
  background: #fff;
  border-radius: 10px 10px 0 0;
  border: 1px solid #ece8f4;
  border-bottom: none;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
  min-height: 42px;
}
.gf-topbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.gf-topbar-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

/* ══ Bucket pills ════════════════════════════════════════════════════════ */
.gf-bucket-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: center;
  min-width: 0;
}
.bucket-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px 5px 8px;
  background: transparent;
  border: 1.5px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: #7c6a9a;
  transition: all 0.12s;
  white-space: nowrap;
}
.bucket-pill:hover {
  background: #f5f4f8;
  border-color: #e0d9ef;
  color: #4b3a6e;
}
.bucket-pill--active {
  background: #f0eaf8;
  border-color: #c4aee8;
  color: var(--color-unergy-deep);
  font-weight: 600;
}
.bucket-pill--active .bucket-pill-count {
  color: #4b3a6e;
}
.bucket-pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bucket-pill--active .bucket-pill-dot {
  box-shadow: none;
}
.bucket-pill-label { color: inherit; }
.bucket-pill-count {
  font-weight: 700;
  font-size: 11px;
}

/* ══ Toolbar ═════════════════════════════════════════════════════════════ */
.gf-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #fff;
  border-radius: 0 0 10px 10px;
  border: 1px solid #ece8f4;
  border-top: 1px solid #ece8f4;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
}
.gf-toolbar :deep(.p-inputtext),
.gf-toolbar :deep(.p-select),
.gf-toolbar :deep(.p-datepicker-input) {
  font-size: 12px !important;
  padding-top: 5px !important;
  padding-bottom: 5px !important;
}
.gf-toolbar :deep(.p-select-label) {
  font-size: 12px !important;
  padding-top: 5px !important;
  padding-bottom: 5px !important;
}

/* Selects con valor activo → borde y texto morado */
.gf-toolbar :deep(.p-select:not(.p-select-empty)) {
  border-color: #7c3aed;
  box-shadow: 0 0 0 1px #7c3aed22;
}
.gf-toolbar :deep(.p-select:not(.p-select-empty) .p-select-label) {
  color: #7c3aed;
  font-weight: 600;
}
.gf-toolbar :deep(.p-select:not(.p-select-empty) .p-select-dropdown) {
  color: #7c3aed;
}

/* ══ Layout ══════════════════════════════════════════════════════════════ */
.gf-layout { display: block; }
.gf-main { min-width: 0; }

@media (min-width: 1024px) {
  .gf-layout--split {
    display: grid;
    grid-template-columns: minmax(230px, 290px) minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
  }
  .gf-layout--split .gf-main { align-self: stretch; }
}
@media (min-width: 1440px) {
  .gf-layout--split {
    grid-template-columns: minmax(250px, 325px) minmax(0, 1fr);
  }
}

/* ══ Aside ════════════════════════════════════════════════════════════════ */
.gf-aside {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  justify-content: flex-end;
}
.gf-aside-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(28, 18, 50, 0.35);
  backdrop-filter: blur(2px);
}
.gf-aside-panel {
  position: relative;
  width: 100%;
  max-width: 560px;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(28, 18, 50, 0.12);
  overflow: hidden;
}
@media (min-width: 1024px) {
  .gf-aside {
    position: static;
    z-index: auto;
    display: block;
    max-height: none;
  }
  .gf-aside-backdrop { display: none; }
  .gf-aside-panel {
    max-width: none;
    height: auto;
    border-radius: 12px;
    border: 1px solid #ece8f4;
    box-shadow: 0 4px 14px rgba(28, 18, 50, 0.08);
  }
}

/* ══ Drawer header / body ════════════════════════════════════════════════ */
.gf-drawer-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid #ece8f4;
  background: #fff;
  flex-shrink: 0;
  flex-wrap: nowrap;
  overflow: hidden;
}
.gf-drawer-header > :deep(.p-button) { flex-shrink: 0; }
.gf-drawer-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}
.gf-drawer-body :deep(.p-tag) {
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 8px;
}

/* ══ Sections ════════════════════════════════════════════════════════════ */
.gf-section {
  background: #fff;
  border: 1px solid #ece8f4;
  border-radius: 10px;
  padding: 14px;
}
.gf-section--filled {
  background: #faf9fc;
  border-color: #ece8f4;
}
.gf-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.gf-section-icon { color: var(--color-unergy-purple); font-size: 13px; }
.gf-section-title { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); margin: 0; }
.gf-section-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-unergy-purple);
  background: rgba(145, 91, 216, 0.1);
  padding: 1px 8px;
  border-radius: 999px;
  min-width: 22px;
  text-align: center;
}
.gf-save-flag {
  margin-left: auto;
  font-size: 11.5px;
  color: #6b5a8a;
  display: flex;
  align-items: center;
  gap: 4px;
}
.gf-save-flag--ok { color: #047857; font-weight: 600; }

.gf-subhead {
  font-size: 11.5px;
  font-weight: 700;
  color: #6b5a8a;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin: 0 0 4px;
}
.gf-body-text {
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-unergy-deep);
  margin: 0;
}

/* ══ Hero ════════════════════════════════════════════════════════════════ */
.gf-hero {
  background: linear-gradient(180deg, #faf7ff 0%, #fff 100%);
  border: 1px solid #e9ddff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gf-hero-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-unergy-deep);
  line-height: 1.3;
  margin: 0;
}
.gf-hero-desc {
  font-size: 15px;
  line-height: 1.5;
  color: #1f1530;
  font-weight: 500;
  margin: 0;
  white-space: pre-line;
}

/* Clasificación / equipo que falló */
.gf-clasif-sub { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); }
.gf-flag {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px;
}
.gf-flag svg { font-size: 11px; }
.gf-flag--ok  { background: #f3f4f6; color: #6b7280; }
.gf-flag--bad { background: #fee2e2; color: #b91c1c; }
.gf-flag--warn{ background: #fef3c7; color: #b45309; }
.gf-inv-list { display: flex; flex-direction: column; gap: 8px; }
.gf-inv { border: 1px solid #eee6fa; border-radius: 9px; padding: 9px 11px; background: #faf9fc; }
.gf-inv-top { display: flex; align-items: center; gap: 6px; }
.gf-inv-top svg { color: var(--color-unergy-purple); font-size: 12px; }
.gf-inv-name { font-size: 13.5px; font-weight: 700; color: var(--color-unergy-deep); }
.gf-inv-pot { font-size: 12.5px; color: #6b5a8a; }
.gf-inv-tipos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.gf-inv-tag { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #915BD81a; color: var(--color-unergy-purple-dark); }
.gf-inv-empty { font-size: 12px; color: #9ca3af; margin: 6px 0 0; }
/* Capa aparte para el tipo de falla del inversor */
.gf-tipo-layer {
  border: 1px solid #e9ddff; border-radius: 10px; padding: 10px 12px;
  background: linear-gradient(180deg, #faf7ff 0%, #fff 100%);
}
.gf-tipo-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 6px; }
.gf-tipo-chip {
  font-size: 12.5px; font-weight: 700; padding: 5px 11px; border-radius: 8px;
  background: #915BD814; color: var(--color-unergy-purple-dark); border: 1px solid #915BD833;
}
.gf-legacy-note {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 12px; color: #9ca3af; margin: 8px 0 0; line-height: 1.4;
}
.gf-legacy-note svg { font-size: 11px; margin-top: 2px; flex-shrink: 0; }
.gf-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid #e9ddff;
}
@media (max-width: 480px) { .gf-facts { grid-template-columns: 1fr; } }
.gf-facts--flush { border-top: none; padding-top: 0; }
.gf-fact { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gf-fact-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #6b5a8a;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.gf-fact-label svg { font-size: 11px; }
.gf-fact-value {
  font-size: 14px;
  color: var(--color-unergy-deep);
  font-weight: 500;
  margin: 0;
  word-break: break-word;
}

/* ══ Two-col grid ════════════════════════════════════════════════════════ */
.gf-twocol {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}
@media (min-width: 640px) {
  .gf-twocol { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}

/* ══ Field row ═══════════════════════════════════════════════════════════ */
.gf-field-row { display: flex; align-items: center; gap: 8px; }
.gf-field-label {
  width: 70px;
  font-size: 12.5px;
  font-weight: 600;
  color: #4a3b6b;
  flex-shrink: 0;
}

/* ══ SLA stat ════════════════════════════════════════════════════════════ */
.gf-sla-stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
}
.gf-sla-num { font-size: 28px; font-weight: 800; line-height: 1; }
.gf-sla-of  { font-size: 16px; color: #4a3b6b; font-weight: 600; }

/* ══ SLA override (límite personalizado) ════════════════════════════════ */
.gf-sla-override {
  margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e5e0f0;
}
.gf-sla-override-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap;
  margin-bottom: 6px;
}
.gf-sla-override-label { font-size: 12px; font-weight: 600; color: #4a3b6b; }
.gf-sla-override-ref { font-size: 13px; color: #9b8db5; }
.gf-sla-override-ref strong { color: #4a3b6b; font-weight: 700; }
.gf-sla-override-input { display: flex; align-items: center; gap: 6px; }
.gf-sla-override-clear {
  width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; border: none;
  background: #f1eaf9; color: #6b5a8a; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.gf-sla-override-clear:hover { background: #e5d9f5; }
.gf-sla-override-hint { font-size: 11px; color: #9b8db5; line-height: 1.5; margin: 6px 0 0; }

/* ══ Avatars ═════════════════════════════════════════════════════════════ */
.avatar-md {
  width: 32px; height: 32px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0;
}

/* ══ Suggestion ══════════════════════════════════════════════════════════ */
.gf-suggestion {
  display: flex;
  gap: 12px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fcd34d;
  border-radius: 10px;
  padding: 12px 14px;
}
.gf-suggestion-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: rgba(217, 119, 6, 0.18);
  color: #92400e;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.gf-suggestion-icon svg { font-size: 14px; }
.gf-suggestion-label {
  font-size: 11.5px; font-weight: 700; color: #92400e;
  text-transform: uppercase; letter-spacing: 0.4px; margin: 0 0 3px;
}
.gf-suggestion-text {
  font-size: 14px; color: #1f1530; margin: 0; line-height: 1.45;
}

/* ══ Add note ════════════════════════════════════════════════════════════ */
.gf-add-note {
  background: #faf9fc;
  border: 1px solid #ece8f4;
  border-radius: 8px;
  padding: 10px;
}
.gf-add-note :deep(textarea) { font-size: 14px; }

/* ══ Acciones inline ═════════════════════════════════════════════════════ */
.gf-actions-inline {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.gf-actions-inline :deep(.p-button) {
  flex: 1 1 140px;
  min-width: 0;
  padding-top: 9px;
  padding-bottom: 9px;
  font-size: 13.5px;
  font-weight: 600;
}

/* ══ Table wrap ══════════════════════════════════════════════════════════ */
.gf-table-wrap {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ece8f4;
  box-shadow: 0 4px 14px rgba(28, 18, 50, 0.08);
  overflow: hidden;
}
@media (min-width: 1024px) {
  .gf-layout--split .gf-table-wrap {
    max-height: calc(100vh - var(--gf-header-h, 6.5rem) - 1rem);
    display: flex;
    flex-direction: column;
  }
  .gf-layout--split .gf-table-wrap :deep(.p-datatable) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .gf-layout--split .gf-table-wrap :deep(.p-datatable-wrapper) {
    flex: 1;
    overflow: auto;
  }
}

/* ══ DataTable tweaks ════════════════════════════════════════════════════ */
:deep(.gf-table .p-datatable-tbody > tr) { cursor: pointer; transition: background 0.12s; }
:deep(.gf-table .p-datatable-tbody > tr > td) {
  padding: 10px 12px;
  vertical-align: middle;
}
:deep(.gf-table .p-datatable-thead > tr > th) {
  background: #faf9fc;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #6b5a8a;
  padding: 10px 12px;
}
:deep(.gf-table .p-datatable-tbody > tr.gf-row-active) {
  background: #faf5ff !important;
  box-shadow: inset 3px 0 0 var(--color-unergy-purple);
}
:deep(.gf-table .p-datatable-tbody > tr.gf-row-active > td) {
  border-color: #e9ddff;
}
:deep(.gf-table .p-datatable-wrapper) { overflow-x: auto; }

/* ══ Prio stripe + pill + cat-dot ════════════════════════════════════════ */
.prio-stripe {
  width: 4px; height: 32px; border-radius: 2px; margin: 0 auto;
}
.cat-dot {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 50%;
  box-shadow: 0 0 0 2px #fff;
}

/* ══ Días abierta badge ══════════════════════════════════════════════════ */
.dias-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 400;
  white-space: nowrap;
}
.dias-green   { color: #16a34a; }
.dias-yellow  { color: #a16207; }
.dias-red     { color: #dc2626; }
.dias-cerrada { color: #9ca3af; }

/* ══ Row actions ══════════════════════════════════════════════════════════ */
.row-actions {
  display: flex; gap: 2px; opacity: 0.4; transition: opacity 0.15s;
}
:deep(tr:hover) .row-actions { opacity: 1; }

:deep(.p-datatable-tbody > tr > td) { padding: 6px 10px; }
:deep(.p-datatable-thead > tr > th) { padding: 6px 10px; }

/* ══ Line clamp ══════════════════════════════════════════════════════════ */
.line-clamp-1 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

/* ══ Compact list ════════════════════════════════════════════════════════ */
.gf-compact {
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ece8f4;
  box-shadow: 0 4px 14px rgba(28, 18, 50, 0.08);
  overflow: hidden;
}
@media (min-width: 1024px) {
  .gf-compact {
    position: sticky;
    top: var(--gf-header-h, 6.25rem);
    max-height: calc(100vh - var(--gf-header-h, 6.25rem) - 1.25rem);
    z-index: 1;
  }
}
.gf-compact-header {
  padding: 10px 14px;
  border-bottom: 1px solid #ece8f4;
  background: #faf9fc;
  flex-shrink: 0;
}
.gf-compact-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  padding: 24px;
}
.gf-compact-list { overflow-y: auto; flex: 1; min-height: 0; }
.gf-compact-row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 10px 14px 10px 10px;
  border: none;
  background: #fff;
  border-bottom: 1px solid #f3f1f8;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.12s;
}
.gf-compact-row:hover { background: #faf9fc; }
.gf-compact-row--active { background: #faf5ff; }
.gf-compact-row--active::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--color-unergy-purple);
}
.gf-compact-stripe { width: 3px; border-radius: 2px; flex-shrink: 0; }
.gf-compact-content {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.gf-compact-line1 { display: flex; align-items: center; gap: 6px; }
.gf-compact-code {
  font-family: 'Courier New', monospace;
  font-size: 10.5px; font-weight: 700; color: #6b5a8a;
  background: #f3f1f8; padding: 1px 6px; border-radius: 4px; letter-spacing: 0.2px;
}
.gf-compact-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; margin-left: auto;
}
.gf-compact-line2 {
  font-size: 13px; font-weight: 500; color: var(--color-unergy-deep); line-height: 1.3;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; word-break: break-word;
}
.gf-compact-row--active .gf-compact-line2 { color: #4a3b6b; font-weight: 600; }

/* ══ TAB 1 — GRÁFICOS ════════════════════════════════════════════════════ */
.mon-tab-view { padding: 24px 24px 40px; background: #f5f4f8; }
.mon-tab-calendario { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #f5f4f8; overflow-y: auto; }
.mon-tab-loading { display:flex; flex-direction:column; align-items:center; gap:14px; padding:80px 20px; color:#a094b8; font-size:13px; }
.mon-spinner { width:32px; height:32px; border:3px solid #ece8f4; border-top-color:var(--color-unergy-purple); border-radius:50%; animation:spin .75s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.mon-tab-empty { text-align:center; padding:80px 20px; }
.mon-empty-icon { font-size:40px; opacity:.2; margin-bottom:12px; }
.mon-empty-title { font-size:15px; font-weight:700; color:#6b7280; margin-bottom:5px; }
.mon-empty-sub { font-size:12.5px; color:#9ca3af; }

/* Container */
.charts-container { display:flex; flex-direction:column; gap:16px; }

/* Charts grid */
.chart-card {
  background:#fff; border:1px solid #ece8f4; border-radius:12px;
  padding:16px 18px; box-shadow:0 1px 4px rgba(28,18,50,.05);
}
.chart-card--wide { grid-column: 1 / -1; }
.chart-card-title { font-size:12.5px; font-weight:700; color:var(--color-unergy-deep); margin-bottom:14px; }
.chart-card-sub { font-size:11px; font-weight:500; color:#a094b8; }
.chart-canvas-wrap { position:relative; }

@media (max-width:768px) {
  .mon-tab-view { padding:16px; }
  .chart-card--wide { grid-column:1; }
}

/* ══ P90 Section ════════════════════════════════════════════════════════ */
.p90-section-head {
  display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  background:#fff; border:1px solid #ece8f4; border-radius:12px;
  padding:14px 18px; box-shadow:0 1px 3px rgba(28,18,50,.04);
}
.p90-section-title {
  display:flex; align-items:center; gap:8px; flex:1; min-width:0;
  font-size:13px; font-weight:700; color:var(--color-unergy-deep);
}
.p90-section-sub { font-size:11.5px; font-weight:500; color:#a094b8; }
.p90-controls { display:flex; align-items:center; gap:6px; flex-shrink:0; }
:deep(.p90-dp .p-datepicker-input) {
  font-size:12px !important; padding:5px 8px !important; width:110px !important;
}
.p90-reload-btn {
  width:30px; height:30px; display:flex; align-items:center; justify-content:center;
  background:#f4f1fa; border:1px solid #e5e0f0; border-radius:8px;
  cursor:pointer; color:#6b5a8a; font-size:12px; transition:background .12s;
}
.p90-reload-btn:hover:not(:disabled) { background:#e9e0f5; }
.p90-reload-btn:disabled { opacity:.4; cursor:not-allowed; }

.p90-kpis { display:flex; gap:8px; flex-wrap:wrap; }
.p90-kpi {
  display:flex; flex-direction:column; align-items:center;
  background:#faf9fc; border:1px solid #ece8f4; border-radius:10px;
  padding:8px 16px; min-width:72px;
}
.p90-kpi--green { background:#f0fdf4; border-color:#bbf7d0; }
.p90-kpi--red   { background:#fef2f2; border-color:#fecaca; }
.p90-kpi-val { font-size:20px; font-weight:900; line-height:1; }
.p90-kpi-lbl {
  font-size:9.5px; font-weight:700; text-transform:uppercase;
  letter-spacing:.3px; color:#9b89b5; margin-top:3px;
}

.p90-state {
  display:flex; flex-direction:column; align-items:center;
  gap:8px; padding:40px 20px; font-size:12.5px; color:#9ca3af;
}

.p90-bar-card { cursor:pointer; }
.p90-chart-legend {
  display:flex; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;
}
.p90-legend-item { display:flex; align-items:center; gap:5px; font-size:11.5px; color:#6b5a8a; }
.p90-legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.p90-legend-hint { font-size:11px; color:#a094b8; }

.p90-detail-card {
  background:#fff; border:1px solid #d1fae5; border-radius:12px;
  padding:14px 18px; box-shadow:0 1px 4px rgba(22,163,74,.08);
}
.p90-detail-head {
  display:flex; align-items:center; gap:8px; margin-bottom:14px; flex-wrap:wrap;
}
.p90-detail-kpis {
  margin-left:auto; display:flex; align-items:center; gap:10px;
  font-size:11.5px; font-weight:700;
}
.p90-close-btn {
  width:22px; height:22px; display:flex; align-items:center; justify-content:center;
  background:#f0eaf8; border:none; border-radius:6px;
  cursor:pointer; color:#6b5a8a; flex-shrink:0;
}

.p90-separator {
  display:flex; align-items:center; gap:8px;
  font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:.5px; color:#a094b8; padding:4px 0;
}
.p90-separator::after { content:''; flex:1; height:1px; background:#ece8f4; }

/* ── Gen cards ── */
.gen-card-head {
  display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px;
}
.gen-card-title {
  display:flex; align-items:center; gap:8px; flex:1; min-width:0;
  font-size:13px; font-weight:700; color:var(--color-unergy-deep);
}
.gen-legend {
  display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-left:auto;
}
.gen-kpi {
  font-size:11.5px; font-weight:700;
}
.gen-pr-controls {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px;
}
:deep(.gen-multiselect) {
  min-width:220px; flex:1; font-size:12px;
}

/* ── Generación de hoy — lista de barras de progreso ── */
.gen-hoy-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 20px 18px;
  max-height: 420px;
  overflow-y: auto;
}
.gen-hoy-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gen-hoy-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.gen-hoy-item-name {
  font-size: 11.5px;
  font-weight: 600;
  color: #374151;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.gen-hoy-item-vals {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  flex-shrink: 0;
}
.gen-hoy-pct {
  font-size: 11px;
  font-weight: 700;
  margin-left: 6px;
  min-width: 34px;
  text-align: right;
}
.gen-hoy-track {
  height: 7px;
  background: #f3f4f6;
  border-radius: 999px;
  overflow: hidden;
}
.gen-hoy-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(.4,0,.2,1);
  min-width: 2px;
}

/* ── Badges de fuente de datos (INV / MED / S/D) ── */
.gen-fuente-badge {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 3px;
  vertical-align: middle;
  cursor: default;
}
.gen-fuente-badge--inv {
  background: #dbeafe;
  color: #1d4ed8;
}
.gen-fuente-badge--med {
  background: #d1fae5;
  color: #065f46;
}
.gen-fuente-badge--nd {
  background: #f3f4f6;
  color: #9ca3af;
}

/* ── Generación por proyecto — controles ── */
.genproj-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px 10px;
  flex-wrap: wrap;
}
.genproj-controls--row2 {
  padding-top: 0;
  padding-bottom: 12px;
}
.genproj-select {
  min-width: 220px;
  flex: 1;
  max-width: 300px;
  font-size: 12px;
}
.genproj-quick-btns {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.genproj-quick-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.genproj-quick-btn:hover { border-color: var(--color-unergy-purple); color: var(--color-unergy-purple); }
.genproj-quick-btn--active {
  background: var(--color-unergy-purple);
  border-color: var(--color-unergy-purple);
  color: #fff;
}
.genproj-gran-toggle {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.genproj-gran-btn {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  background: #f9fafb;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.genproj-gran-btn + .genproj-gran-btn { border-left: 1px solid #e5e7eb; }
.genproj-gran-btn--active { background: #7c3aed; color: #fff; }
.genproj-gran-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.genproj-kpi {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 20px 8px;
  font-size: 11px;
  color: #6b7280;
}
.genproj-kpi-val { font-size: 15px; font-weight: 700; color: #7c3aed; }
.genproj-kpi-lbl { color: #9ca3af; }
.genproj-kpi-sep { color: #d1d5db; }

/* ── Generación por proyecto ── */
.genproj-leyenda {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 6px 20px 0;
  font-size: 11px;
  color: #6b7280;
}
.genproj-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 2px;
  margin-right: 5px;
  vertical-align: middle;
  box-sizing: border-box;
}
.genproj-fallas {
  margin: 14px 20px 4px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  overflow: hidden;
}
.genproj-fallas-header {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff7f7;
  padding: 7px 12px;
  font-size: 11.5px;
  font-weight: 700;
  color: #dc2626;
  border-bottom: 1px solid #fecaca;
}
.genproj-falla-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
  flex-wrap: wrap;
}
.genproj-falla-row:last-child { border-bottom: none; }
.genproj-codigo {
  font-family: monospace;
  font-size: 10.5px;
  background: #f3f4f6;
  color: #374151;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}
.genproj-fecha {
  color: #6b7280;
  flex-shrink: 0;
  min-width: 72px;
}
.genproj-estado {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
.genproj-prio {
  font-size: 10.5px;
  font-weight: 600;
  flex-shrink: 0;
  min-width: 60px;
}
.genproj-desc {
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.genproj-sin-fallas {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px 12px;
  font-size: 11px;
  color: #16a34a;
}

/* ══ DIALOG RESOLVER FALLA ══════════════════════════════════════════════════ */
.resolve-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
}
.resolve-dialog-code {
  font-size: 12px;
  font-weight: 600;
  color: #6b5a8a;
  background: #f5f0ff;
  border-radius: 6px;
  padding: 6px 10px;
  margin: 0;
}
.resolve-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.resolve-dialog-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #4a3b6b;
}
</style>
