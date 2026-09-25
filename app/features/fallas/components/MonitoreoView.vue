<template>
  <div ref="pageRef" class="gf-page">

    <!-- ══ TAB BAR (sticky, fuera del sticky-header de la tab Fallas) ══════ -->
    <div
      ref="tabBarRef"
      class="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background px-3.5 py-2"
    >
      <div class="flex items-center gap-2 text-sm font-bold text-foreground">
        <ZapIcon class="size-4 text-primary" />
        Gestión de Fallas
      </div>
      <GTabs
        :model-value="String(activeTab)"
        @update:model-value="(v) => (activeTab = Number(v))"
      >
        <GTabsList variant="outline">
          <GTabsTrigger v-for="(tab, i) in TABS" :key="i" :value="String(i)" variant="outline">
            <component :is="tab.icon" class="size-4" />
            {{ tab.label }}
          </GTabsTrigger>
        </GTabsList>
      </GTabs>
    </div>

    <!-- ══ TAB 0 — FALLAS ════════════════════════════════════════════════ -->
    <template v-if="activeTab === 0">

      <!-- ══ STICKY HEADER ════════════════════════════════════════════════ -->
      <div ref="stickyHeaderRef" class="gf-sticky-header">

        <!-- ── Topbar ── -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Buckets -->
          <GTabs :model-value="bucket" @update:model-value="(v) => (bucket = v)">
            <GTabsList variant="outline">
              <GTabsTrigger v-for="b in BUCKETS" :key="b.key" :value="b.key" variant="outline">
                <component :is="b.icon" class="size-4" />
                {{ b.label }} · {{ counts[b.key] }}
              </GTabsTrigger>
            </GTabsList>
          </GTabs>

          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="loading" title="Actualizar" @click="cargar">
              <LoaderCircleIcon v-if="loading" class="animate-spin" />
              <RefreshCwIcon v-else />
            </Button>
            <Button size="sm" @click="abrirCrear">
              <PlusIcon /> Nueva falla
            </Button>
          </div>
        </div>

        <!-- ── Toolbar ── -->
        <div class="flex flex-wrap items-center gap-2">
          <InputGroup class="min-w-50 max-w-sm flex-1">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              ref="searchInputRef"
              v-model="search"
              placeholder="Buscar por código, descripción, proyecto, tipo..."
            />
          </InputGroup>

          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon />
                Filtros
                <Badge v-if="filtrosActivosCount" variant="secondary">{{ filtrosActivosCount }}</Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-80" align="start">
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                  <Label class="text-xs text-muted-foreground">Proyecto</Label>
                  <Combobox
                    :model-value="filtroProyecto"
                    open-on-click
                    open-on-focus
                    @update:model-value="(v) => (filtroProyecto = v ?? null)"
                  >
                    <ComboboxAnchor>
                      <ComboboxInput
                        :display-value="
                          (v) => proyectos.find((p) => p.id === v)?.nombre_comercial ?? ''
                        "
                        placeholder="Todos los proyectos"
                      />
                    </ComboboxAnchor>
                    <ComboboxList>
                      <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                      <ComboboxItem v-for="p in proyectos" :key="p.id" :value="p.id">
                        {{ p.nombre_comercial }}
                        <ComboboxItemIndicator>
                          <CheckIcon />
                        </ComboboxItemIndicator>
                      </ComboboxItem>
                    </ComboboxList>
                  </Combobox>
                </div>

                <div class="flex flex-col gap-1">
                  <Label class="text-xs text-muted-foreground">Prioridad</Label>
                  <Select v-model="filtroPrioridad">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="p in catalogos.prioridades"
                        :key="p.codigo"
                        :value="p.codigo"
                        >{{ p.etiqueta }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>

                <div class="flex flex-col gap-1">
                  <Label class="text-xs text-muted-foreground">Estado</Label>
                  <Select v-model="filtroEstado">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="e in catalogos.estados"
                        :key="e.codigo"
                        :value="e.codigo"
                        >{{ e.etiqueta }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">Desde</Label>
                    <Input v-model="filtroFechaDesde" type="date" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">Hasta</Label>
                    <Input v-model="filtroFechaHasta" type="date" />
                  </div>
                </div>

                <Button v-if="hayFiltros" variant="ghost" size="sm" @click="limpiarFiltros">
                  <XIcon /> Limpiar filtros
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <span v-if="!loading" class="ml-auto text-xs whitespace-nowrap text-muted-foreground">
            {{ filtradas.length }} / {{ porBucket.length }}
          </span>
        </div>

      </div><!-- /gf-sticky-header -->

      <div :class="['gf-layout', drawerVisible && 'gf-layout--split']">

        <div class="gf-main min-w-0">

          <!-- ══ COLA DE TRIAGE (ordenada por urgencia de SLA) ═══════════ -->
          <div class="flex flex-col rounded-lg border border-border bg-card">
            <div
              class="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase"
            >
              <span>{{ filtradas.length }} falla{{ filtradas.length !== 1 ? 's' : '' }}</span>
              <LoaderCircleIcon v-if="loading" class="size-3.5 animate-spin normal-case" />
            </div>

            <div v-if="error" class="flex items-center gap-3 p-6 text-destructive">
              <CircleAlertIcon class="size-5 shrink-0" />
              <div class="flex-1">
                <div class="font-semibold">Error al cargar</div>
                <div class="text-sm text-muted-foreground">{{ error }}</div>
              </div>
              <Button variant="outline" size="sm" @click="cargar">
                <RefreshCwIcon /> Reintentar
              </Button>
            </div>

            <div
              v-else-if="!filtradas.length"
              class="flex flex-col items-center gap-2 py-14 text-muted-foreground"
            >
              <component :is="bucketActual.icon" class="size-8" :style="{ color: bucketActual.color }" />
              <p class="text-sm font-semibold text-foreground">{{ emptyTitulo }}</p>
              <p class="text-xs">{{ emptySubtitulo }}</p>
              <Button
                v-if="bucket === 'activas' && !hayFiltros"
                variant="outline"
                size="sm"
                class="mt-2"
                @click="abrirCrear"
              >
                <PlusIcon /> Registrar primera falla
              </Button>
              <Button v-else-if="hayFiltros" variant="ghost" size="sm" class="mt-2" @click="limpiarFiltros">
                <XIcon /> Limpiar filtros
              </Button>
            </div>

            <div v-else class="flex flex-col divide-y divide-border">
              <button
                v-for="f in filtradas"
                :key="f.id"
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                :class="drawerFalla?.id === f.id ? 'bg-muted' : ''"
                @click="abrirDrawer(f)"
              >
                <span
                  class="h-8 w-1 shrink-0 rounded-full"
                  :style="{ background: prioColor(f.prioridad?.codigo) }"
                  :title="f.prioridad?.etiqueta"
                />
                <span
                  class="mt-0.5 hidden size-2 shrink-0 rounded-full sm:block"
                  :style="{ background: categoriaFalla(f).color }"
                  :title="categoriaFalla(f).etiqueta"
                />

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <code class="font-mono text-[10px] text-muted-foreground">{{ f.codigo_interno }}</code>
                    <span class="truncate text-sm font-medium text-foreground">{{ tituloFalla(f) }}</span>
                    <Badge
                      v-if="recurrencias(f) > 1"
                      variant="outline"
                      class="shrink-0 text-warning"
                      :title="`${recurrencias(f)}× mismo tipo en este proyecto`"
                    >
                      <RotateCcwIcon /> {{ recurrencias(f) }}×
                    </Badge>
                  </div>
                  <p v-if="!drawerVisible" class="truncate text-xs text-muted-foreground">
                    {{ f.proyecto?.nombre_comercial }}<span v-if="f.descripcion"> · {{ f.descripcion }}</span>
                  </p>
                </div>

                <div v-if="!drawerVisible" class="hidden shrink-0 items-center gap-1.5 md:flex">
                  <span
                    class="size-1.5 rounded-full"
                    :style="{ background: colorEstado(f.estado?.codigo, '#9ca3af') }"
                  />
                  <span class="text-xs text-muted-foreground">{{ f.estado?.etiqueta || '—' }}</span>
                </div>

                <div v-if="!drawerVisible" class="hidden shrink-0 text-right text-xs lg:block">
                  <div class="text-foreground">{{ fmtFecha(f.fecha_identificacion) }}</div>
                  <div class="text-muted-foreground">{{ relativeTime(f.fecha_identificacion) }}</div>
                </div>

                <span v-if="f.dias_abierta != null" class="shrink-0 text-xs font-bold" :class="diasClass(f)">
                  {{ f.dias_abierta }}d
                </span>

                <GBadge :color="slaSeverity(f)" size="sm" class="shrink-0">{{ slaText(f) }}</GBadge>

                <div v-if="!drawerVisible" class="hidden shrink-0 items-center gap-0.5 xl:flex" @click.stop>
                  <Button
                    v-if="!f.estado?.es_estado_final"
                    variant="ghost"
                    size="icon-sm"
                    class="text-success hover:text-success"
                    title="Marcar resuelta"
                    @click="quickResolve(f)"
                  >
                    <CircleCheckIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Editar" @click="abrirEditar(f)">
                    <PencilIcon />
                  </Button>
                </div>

                <ChevronRightIcon class="hidden size-4 shrink-0 text-muted-foreground lg:block" />
              </button>
            </div>
          </div>

        </div><!-- /gf-main -->

        <!-- ══ PANEL DETALLE ══════════════════════════════════════════════ -->
        <aside
v-if="drawerVisible && drawerFalla" class="gf-aside"
          @keydown.left.stop="navegar(-1)" @keydown.right.stop="navegar(1)">
          <!-- Backdrop solo en móvil -->
          <div class="gf-aside-backdrop" @click="drawerVisible = false" />
          <div class="gf-aside-panel">

            <!-- Header panel -->
            <div class="gf-drawer-header">
              <Button variant="ghost" size="icon-sm" title="Cerrar (Esc)" @click="drawerVisible = false">
                <XIcon />
              </Button>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <code class="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm text-primary">{{
                    drawerFalla.codigo_interno
                  }}</code>
                  <span class="text-xs text-muted-foreground">·</span>
                  <span class="truncate text-sm font-medium text-foreground">{{
                    tituloFalla(drawerFalla)
                  }}</span>
                  <span
                    v-if="navIndex >= 0"
                    class="ml-auto hidden text-[10px] whitespace-nowrap text-muted-foreground sm:inline-block"
                  >
                    {{ navIndex + 1 }} / {{ filtradas.length }}
                  </span>
                </div>
              </div>
              <ButtonGroup>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Anterior (←)"
                  :disabled="navIndex <= 0"
                  @click="navegar(-1)"
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Siguiente (→)"
                  :disabled="navIndex < 0 || navIndex >= filtradas.length - 1"
                  @click="navegar(1)"
                >
                  <ChevronRightIcon />
                </Button>
              </ButtonGroup>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Abrir página completa"
                @click="router.push(`/fallas/${drawerFalla.id}`)"
              >
                <ExternalLinkIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-destructive hover:text-destructive"
                title="Eliminar"
                @click="confirmDelete(drawerFalla)"
              >
                <Trash2Icon />
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
                    <GBadge :color="prioColor(drawerFalla.prioridad?.codigo)">{{ drawerFalla.prioridad?.etiqueta }}</GBadge>
                    <GBadge
v-if="categoriaFalla(drawerFalla).etiqueta"
                      :color="categoriaFalla(drawerFalla).color || '#915BD8'">{{ categoriaFalla(drawerFalla).etiqueta }}</GBadge>
                    <GBadge v-if="drawerFalla.pendiente_reclasificar" color="warning">Pendiente de reclasificar</GBadge>
                  </div>
                </div>
                <p v-if="drawerFalla.descripcion" class="gf-hero-desc">{{ drawerFalla.descripcion }}</p>
              </section>

              <!-- ── SLA: franja de estado propia, arriba del todo ────── -->
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
                    <Input
                      v-model.number="quickEdit.sla_limite_horas"
                      type="number"
                      placeholder="Sin personalizar"
                      min="1"
                      max="999"
                      class="flex-1"
                      @change="autosaveQuick()"
                    />
                    <Button
                      v-if="quickEdit.sla_limite_horas"
                      variant="ghost"
                      size="icon-sm"
                      title="Quitar personalización"
                      @click="
                        quickEdit.sla_limite_horas = null;
                        autosaveQuick()
                      "
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <p class="gf-sla-override-hint">
                    Opcional. Solo para casos puntuales que necesitan más o menos tiempo que el default de su prioridad.
                  </p>
                </div>
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
                    <GBadge
v-if="categoriaFalla(drawerFalla).etiqueta"
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

              <!-- ── EDICIÓN RÁPIDA ─────────────────────────────────── -->
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
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div class="gf-field-row">
                    <label class="gf-field-label">Estado</label>
                    <Select
                      :model-value="quickEdit.estado_id ? String(quickEdit.estado_id) : undefined"
                      @update:model-value="
                        (v) => {
                          quickEdit.estado_id = Number(v);
                          autosaveQuick();
                        }
                      "
                    >
                      <SelectTrigger class="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="e in catalogos.estados" :key="e.id" :value="String(e.id)">{{
                          e.etiqueta
                        }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="gf-field-row">
                    <label class="gf-field-label">Prioridad</label>
                    <Select
                      :model-value="quickEdit.prioridad_id ? String(quickEdit.prioridad_id) : undefined"
                      @update:model-value="
                        (v) => {
                          quickEdit.prioridad_id = Number(v);
                          autosaveQuick();
                        }
                      "
                    >
                      <SelectTrigger class="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="p in catalogos.prioridades" :key="p.id" :value="String(p.id)">{{
                          p.etiqueta
                        }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

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
                  <Textarea
                    v-model="nuevaNota.nota"
                    rows="2"
                    placeholder="Agregar nota o actualización…"
                    class="w-full"
                  />
                  <div class="flex items-center gap-2 mt-2">
                    <Select
                      :model-value="nuevaNota.estado_id ? String(nuevaNota.estado_id) : undefined"
                      @update:model-value="
                        (v) => (nuevaNota.estado_id = v && v !== '__sin_cambio__' ? Number(v) : null)
                      "
                    >
                      <SelectTrigger class="flex-1">
                        <SelectValue placeholder="Cambiar estado (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sin_cambio__">Sin cambio de estado</SelectItem>
                        <SelectItem v-for="e in catalogos.estados" :key="e.id" :value="String(e.id)">{{
                          e.etiqueta
                        }}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      :disabled="(!nuevaNota.nota.trim() && !nuevaNota.estado_id) || addingSeg"
                      @click="agregarSeguimiento"
                    >
                      <LoaderCircleIcon v-if="addingSeg" class="size-[1em] animate-spin" />
                      <SendIcon v-else class="size-[1em]" />
                      Agregar
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
                        <span class="text-xs text-gray-500">{{ relativeTime(seg.created_at) }}</span>
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
              <FallaArchivos v-if="drawerFalla?.id" :falla-id="drawerFalla.id" />

              <!-- ── ACCIONES PRINCIPALES ───────────────────────────── -->
              <div class="gf-actions-inline">
                <Button variant="outline" class="flex-1" @click="editarDesdeDrawer">
                  <PencilIcon class="size-[1em]" /> Editar completa
                </Button>
                <Button
                  v-if="!drawerFalla.estado?.es_estado_final"
                  class="flex-1 bg-success text-success-foreground hover:bg-success/90"
                  :disabled="resolvingFalla"
                  @click="quickResolve(drawerFalla)"
                >
                  <LoaderCircleIcon v-if="resolvingFalla" class="size-[1em] animate-spin" />
                  <CheckIcon v-else class="size-[1em]" />
                  Marcar resuelta
                </Button>
                <Button v-else variant="outline" class="flex-1 text-warning hover:text-warning" @click="reabrirFalla">
                  <RotateCcwIcon class="size-[1em]" /> Reabrir
                </Button>
              </div>

            </div><!-- /gf-drawer-body -->
          </div><!-- /gf-aside-panel -->
        </aside>

      </div><!-- /gf-layout -->

      <!-- ══ DIALOG CREAR / EDITAR ════════════════════════════════════════ -->
      <Dialog v-model:open="formDialogVisible">
        <DialogContent
          class="max-h-[90dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)]"
          :show-close-button="!savingForm"
          @escape-key-down="(e) => savingForm && e.preventDefault()"
          @pointer-down-outside="(e) => savingForm && e.preventDefault()"
        >
          <DialogHeader>
            <DialogTitle>{{
              editingFalla ? `Editar falla ${editingFalla.codigo_interno}` : 'Nueva falla'
            }}</DialogTitle>
          </DialogHeader>
          <div class="-mx-6 min-h-0 overflow-y-auto px-6">
            <FallaForm
:initial="editingFalla" :catalogos="catalogos"
              @save="onSaveForm" @cancel="formDialogVisible = false" />
          </div>
        </DialogContent>
      </Dialog>

      <!-- ══ DIALOG RESOLVER FALLA ══════════════════════════════════════════ -->
      <Dialog v-model:open="resolveDialogVisible">
        <DialogContent
          class="max-w-sm"
          :show-close-button="!resolvingFalla"
          @escape-key-down="(e) => resolvingFalla && e.preventDefault()"
          @pointer-down-outside="(e) => resolvingFalla && e.preventDefault()"
        >
          <DialogHeader>
            <DialogTitle>Resolver falla</DialogTitle>
          </DialogHeader>
          <div v-if="resolveFallaTarget" class="resolve-dialog-body">
            <p class="resolve-dialog-code">{{ resolveFallaTarget.codigo_interno }} — {{ resolveFallaTarget.proyecto?.nombre_comercial }}</p>
            <div class="resolve-dialog-field">
              <label class="resolve-dialog-label">Fecha y hora de solución *</label>
              <Input
                type="datetime-local"
                :model-value="toDatetimeLocalValue(resolveFecha)"
                class="w-full"
                @update:model-value="(v) => (resolveFecha = v ? new Date(v) : new Date())"
              />
            </div>
            <div class="resolve-dialog-field">
              <label class="resolve-dialog-label">Tipo de solución</label>
              <Select
                :model-value="resolveResolucionId ? String(resolveResolucionId) : undefined"
                @update:model-value="(v) => (resolveResolucionId = v ? Number(v) : null)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Seleccionar (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="r in catalogos.resoluciones" :key="r.id" :value="String(r.id)">{{
                    r.etiqueta
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" :disabled="resolvingFalla" @click="resolveDialogVisible = false">Cancelar</Button>
            <Button
              class="bg-success text-success-foreground hover:bg-success/90"
              :disabled="resolvingFalla"
              @click="confirmarResolve"
            >
              <LoaderCircleIcon v-if="resolvingFalla" class="size-[1em] animate-spin" />
              <CheckIcon v-else class="size-[1em]" />
              Marcar resuelta
            </Button>
          </DialogFooter>
        </DialogContent>
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

    <!-- ══ BOTÓN FLOTANTE: Diagrama fasorial ══════════════════════════════ -->
    <FasorialButton />

  </div><!-- /gf-page -->
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import FallaForm from './FallaForm.vue'
import FallaArchivos from './FallaArchivos.vue'
import CalendarioFallas from './CalendarioFallas.vue'
import FasorialButton from '~/features/fallas/components/FasorialButton.vue'
import { FallasService } from '~/features/fallas/services/fallas'
import { tituloFalla, categoriaFalla, clasificacionDetalle } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { formatCOP as fmtCOP } from '~/utils/currency'
import { BellIcon, BriefcaseIcon, BuildingIcon, CalendarIcon, CalendarPlusIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon, ClockIcon, DollarSignIcon, ExternalLinkIcon, HourglassIcon, InfoIcon, LightbulbIcon, ListIcon, LoaderCircleIcon, MessagesSquareIcon, PencilIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon, SearchIcon, SendIcon, ServerIcon, SlidersHorizontalIcon, TimerIcon, Trash2Icon, UserPenIcon, WifiIcon, WrenchIcon, XIcon, ZapIcon } from '@lucide/vue'

const fallasService = new FallasService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

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
const filtroFechaDesde = ref(route.query.desde || null)
const filtroFechaHasta = ref(route.query.hasta || null)

watch([search, filtroProyecto, filtroPrioridad, filtroEstado, filtroFechaDesde, filtroFechaHasta],
  ([q, proyecto, prioridad, estado, desde, hasta]) => {
    const query = {}
    if (q) query.q = q
    if (proyecto) query.proyecto = proyecto
    if (prioridad) query.prioridad = prioridad
    if (estado) query.estado = estado
    if (desde) query.desde = desde
    if (hasta) query.hasta = hasta
    router.replace({ query })
  })

const filtrosActivosCount = computed(() =>
  [filtroProyecto.value, filtroPrioridad.value, filtroEstado.value, filtroFechaDesde.value, filtroFechaHasta.value]
    .filter((v) => v != null && v !== '').length,
)

// ── Refs DOM ─────────────────────────────────────────────────────────────
const searchInputRef  = ref(null)
const pageRef         = ref(null)
const tabBarRef       = ref(null)
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

// ── Computed: lógica de buckets ───────────────────────────────────────────
function esAlertaSLA(f) {
  return !f.estado?.es_estado_final && (f.sla_cumplido === false || (f.dias_abierta ?? 0) >= 7)
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
  // Cola de triage: primero lo más urgente por SLA (vencido > en alerta > ok),
  // y dentro de la misma severidad, lo que lleva más días abierta.
  return [...arr].sort((a, b) => {
    const diff = slaSeverityRank(a) - slaSeverityRank(b)
    if (diff !== 0) return diff
    return (b.dias_abierta ?? 0) - (a.dias_abierta ?? 0)
  })
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
//
// Se traia el historial COMPLETO de fallas al abrir la vista. Con 6.400 filas
// eso eran 33 peticiones, y ademas mal contadas: el bucle pedia paginas de 500
// y el servidor las sirve de 100, asi que cada pagina se solapaba con la
// anterior y la lista se cortaba a la mitad. Llegaban filas duplicadas y
// faltaba el 47%.
//
// Pero el arreglo no es paginar bien: de esas 6.400, solo ~115 estan ABIERTAS.
// La vista se traia seis mil filas cerradas para mostrar ciento quince.
//
// Ahora son dos peticiones con sentido:
//
//   · las abiertas, TODAS, filtradas en el servidor (`solo_activas`, un filtro
//     que ya existia y nadie usaba). Son las que alimentan las pestanas
//     Activas y Alerta, que es para lo que se abre esta pantalla.
//   · las cerradas de una ventana de tiempo, porque el historico completo no
//     se lee con el scroll -- se busca.
//
// Y la ventana la manda el filtro "Desde" que ya esta en la barra: si se pide
// una fecha anterior a la cargada, se vuelve a pedir al servidor desde ahi. El
// historico sigue estando entero, solo que se trae cuando se pide.

/** Cuanto historial de fallas CERRADAS se trae sin que nadie lo pida. */
const DIAS_HISTORIAL = 90

/** Desde que fecha estan cargadas las cerradas. */
const ventanaDesde = ref(null)

function haceDias(dias) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - dias)
  return d
}

/**
 * `YYYY-MM-DD` de una fecha LOCAL.
 *
 * No `toISOString()`: eso pasa por UTC, y la medianoche local de Bogota
 * (UTC-5) es el mismo dia, pero en un navegador al este de Greenwich seria el
 * dia anterior. Acá ese numero decide que se le pide al servidor, asi que se
 * arma con las partes locales.
 */
function fechaLocalISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

async function cargar(desde = null) {
  loading.value = true
  error.value   = null
  const inicio = desde ?? haceDias(DIAS_HISTORIAL)
  try {
    const [abiertas, cerradas] = await Promise.all([
      // Sin `size`: son ~115 y caben en una respuesta. Si algun dia no
      // cupieran, `completarPaginas` no se activa sin `size` -- por eso va
      // explicito y holgado.
      fallasService.listar({ solo_activas: true, size: 500 }),
      fallasService.listar({ fecha_identificacion_desde: fechaLocalISO(inicio), size: 500 }),
    ])
    // Las dos listas se solapan (una falla abierta identificada dentro de la
    // ventana esta en ambas), asi que se unen por id.
    const porId = new Map()
    for (const f of [...(abiertas.items ?? []), ...(cerradas.items ?? [])]) {
      porId.set(f.id, f)
    }
    allFallas.value = [...porId.values()]
    ventanaDesde.value = inicio
  } catch (e) {
    error.value = e.data?.detail || e.message || 'Error de conexión'
  } finally {
    loading.value = false
  }
}

// Pedir una fecha anterior a la cargada trae ese tramo del historico. Al
// revés no: estrechar el filtro se resuelve en el navegador, sin ir a la red.
watch(filtroFechaDesde, (nueva) => {
  if (nueva && ventanaDesde.value && startOfDay(nueva) < ventanaDesde.value) {
    cargar(startOfDay(nueva))
  }
})

async function cargarCatalogos() {
  try {
    catalogos.value = await fallasService.obtenerCatalogos()
  } catch { /* no crítico */ }
}

async function cargarProyectos() {
  try {
    // Solo alimenta el desplegable "Proyecto" de los filtros: `id` y
    // `nombre_comercial`. El catalogo completo son 538 kB en dos peticiones.
    proyectos.value = await catalogoProyectos.cargarLiviano()
    // Cargar gráficos de generación una vez que los proyectos estén disponibles
  } catch { /* no crítico */ }
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
  if (f.estado?.es_estado_final) return 'text-muted-foreground'
  const d = f.dias_abierta ?? 0
  if (d >= 7) return 'text-destructive'
  if (d >= 3) return 'text-warning'
  return 'text-success'
}

// El reloj del SLA lo calcula el backend: `sla_horas_transcurridas` y `sla_pct`
// vienen del serializer de fallas (`dominio.horas_transcurridas_sla` /
// `dominio.sla_pct`). Esta vista solo los LEE.
//
// Antes las tres pantallas de fallas tenian cada una su copia de este calculo, y
// las tres anclaban a `fecha_identificacion + 'T00:00:00'`: para una critica
// (SLA 8 h) identificada a las 9 a.m. la barra marcaba "Excedido" desde que se
// creaba. Y contaban desde `fecha_ocurrencia` mientras el limite se calculaba
// desde la identificacion, asi que el porcentaje no correspondia con el badge de
// la misma pantalla.
function horasTranscurridas(falla) {
  return Math.round(falla?.sla_horas_transcurridas ?? 0)
}

function slaPct(falla) {
  return falla?.sla_pct ?? null
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

// Orden de urgencia para la cola de triage: vencido primero, luego alerta,
// luego sin dato de SLA, y al final lo que ya cumple/está resuelto.
const SLA_SEVERITY_RANK = { destructive: 0, warning: 1, default: 2, success: 3 }
function slaSeverityRank(falla) {
  return SLA_SEVERITY_RANK[slaSeverity(falla)] ?? 2
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

// Formato local para <input type="datetime-local">: YYYY-MM-DDTHH:mm en hora del navegador.
function toDatetimeLocalValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Duración legible a partir de horas (min / h / d h).
function fmtHoras(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${Math.round(h * 10) / 10} h`
  const dias = Math.floor(h / 24)
  const rest = Math.round(h % 24)
  return rest ? `${dias} d ${rest} h` : `${dias} d`
}

function relativeTime(d) {
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

// ── Keyboard shortcuts ────────────────────────────────────────────────────
function onKeydown(e) {
  const t = e.target.tagName
  if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return
  if (activeTab.value !== 0) return
  if (e.key === '/') {
    e.preventDefault()
    nextTick(() => searchInputRef.value?.$el?.focus())
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

// Medir altura real del tab bar y del sticky-header, y exponerlas como
// variables CSS -- así el offset del segundo sticky nunca queda desincronizado
// de lo que el primero realmente mide (antes era un `top: 41px` a mano).
let _headerRO = null
let _tabBarRO = null
function measureHeader() {
  if (!pageRef.value) return
  if (tabBarRef.value) {
    pageRef.value.style.setProperty('--gf-tabbar-h', `${tabBarRef.value.offsetHeight}px`)
  }
  if (stickyHeaderRef.value) {
    pageRef.value.style.setProperty('--gf-header-h', `${stickyHeaderRef.value.offsetHeight}px`)
  }
}

onMounted(() => {
  cargar()
  cargarCatalogos()
  cargarProyectos()   // cargarGenHoy + cargarGen7 se llaman desde aquí tras cargar proyectos
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    measureHeader()
    if (window.ResizeObserver) {
      if (stickyHeaderRef.value) {
        _headerRO = new ResizeObserver(measureHeader)
        _headerRO.observe(stickyHeaderRef.value)
      }
      if (tabBarRef.value) {
        _tabBarRO = new ResizeObserver(measureHeader)
        _tabBarRO.observe(tabBarRef.value)
      }
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  _headerRO?.disconnect()
  _tabBarRO?.disconnect()
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
  top: var(--gf-tabbar-h, 41px);
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
  left: -16px;
  right: -16px;
  bottom: 100%;
  height: 28px;
  background: #f8f7fa;
  pointer-events: none;
}
@media (min-width: 768px) {
  .gf-sticky-header::before {
    left: -32px;
    right: -32px;
  }
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
.gf-drawer-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
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
/* ══ Días abierta badge ══════════════════════════════════════════════════ */
.dias-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 400;
  white-space: nowrap;
}

/* ══ TAB 1 — CALENDARIO ══════════════════════════════════════════════════ */
.mon-tab-calendario { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #f5f4f8; overflow-y: auto; }

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
