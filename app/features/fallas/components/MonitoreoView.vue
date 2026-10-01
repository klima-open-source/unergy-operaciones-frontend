<template>
  <div ref="pageRef" class="flex min-h-full flex-col bg-muted" :style="pageStyle">
    <!-- ══ TAB BAR (sticky, fuera del sticky-header de la tab Fallas) ══════ -->
    <div
      ref="tabBarRef"
      class="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background px-3.5 py-2"
    >
      <div class="flex items-center gap-2 text-sm font-bold text-foreground">
        <ZapIcon class="size-4 text-primary" />
        Gestión de Fallas
      </div>
      <GTabs :model-value="String(activeTab)" @update:model-value="(v) => (activeTab = Number(v))">
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
      <div
        ref="stickyHeaderRef"
        class="sticky top-(--gf-tabbar-h) z-20 flex flex-col gap-0 bg-muted pt-1 pb-3 before:absolute before:-inset-x-4 before:bottom-full before:h-7 before:bg-muted md:before:-inset-x-8"
      >
        <!-- ── Topbar ── -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Buckets -->
          <GTabs :model-value="bucket" @update:model-value="(v) => (bucket = v as BucketKey)">
            <GTabsList variant="outline">
              <GTabsTrigger v-for="b in BUCKETS" :key="b.key" :value="b.key" variant="outline">
                <component :is="b.icon" class="size-4" />
                {{ b.label }} · {{ counts[b.key] }}
              </GTabsTrigger>
            </GTabsList>
          </GTabs>

          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="loading"
              title="Actualizar"
              @click="cargar()"
            >
              <LoaderCircleIcon v-if="loading" class="animate-spin" />
              <RefreshCwIcon v-else />
            </Button>
            <Button size="sm" @click="abrirCrear"> <PlusIcon /> Nueva falla </Button>
          </div>
        </div>

        <!-- ── Toolbar ── -->
        <div class="flex flex-wrap items-center gap-2">
          <InputGroup class="max-w-sm min-w-50 flex-1">
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
                <Badge v-if="filtrosActivosCount" variant="secondary">{{
                  filtrosActivosCount
                }}</Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                  <Label class="text-xs text-muted-foreground">Proyecto</Label>
                  <Combobox
                    :model-value="filtroProyecto"
                    open-on-click
                    open-on-focus
                    @update:model-value="(v) => (filtroProyecto = (v as number | null) ?? null)"
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
                      <ComboboxViewport>
                        <ComboboxItem v-for="p in proyectos" :key="p.id" :value="p.id">
                          {{ p.nombre_comercial }}
                          <ComboboxItemIndicator>
                            <CheckIcon />
                          </ComboboxItemIndicator>
                        </ComboboxItem>
                      </ComboboxViewport>
                    </ComboboxList>
                  </Combobox>
                </div>

                <div class="flex flex-col gap-1">
                  <Label class="text-xs text-muted-foreground">Prioridad</Label>
                  <Select
                    :model-value="filtroPrioridad ?? undefined"
                    @update:model-value="(v) => (filtroPrioridad = (v as string) ?? null)"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="p in catalogos.prioridades"
                        :key="p.codigo"
                        :value="p.codigo!"
                        >{{ p.etiqueta }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>

                <div class="flex flex-col gap-1">
                  <Label class="text-xs text-muted-foreground">Estado</Label>
                  <Select
                    :model-value="filtroEstado ?? undefined"
                    @update:model-value="(v) => (filtroEstado = (v as string) ?? null)"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="e in catalogos.estados"
                        :key="e.codigo"
                        :value="e.codigo!"
                        >{{ e.etiqueta }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">Desde</Label>
                    <Input
                      :model-value="filtroFechaDesde ?? undefined"
                      type="date"
                      @update:model-value="(v) => (filtroFechaDesde = v ? String(v) : null)"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">Hasta</Label>
                    <Input
                      :model-value="filtroFechaHasta ?? undefined"
                      type="date"
                      @update:model-value="(v) => (filtroFechaHasta = v ? String(v) : null)"
                    />
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
      </div>
      <!-- /gf-sticky-header -->

      <div
        :class="
          drawerVisible && drawerFalla ? 'lg:grid lg:grid-cols-4 lg:items-stretch lg:gap-4' : ''
        "
      >
        <div class="min-w-0 lg:col-span-1">
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
              <Button variant="outline" size="sm" @click="cargar()">
                <RefreshCwIcon /> Reintentar
              </Button>
            </div>

            <div
              v-else-if="!filtradas.length"
              class="flex flex-col items-center gap-2 py-14 text-muted-foreground"
            >
              <component
                :is="bucketActual.icon"
                class="size-8 text-(--c)"
                :style="{ '--c': bucketActual.color }"
              />
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
              <Button
                v-else-if="hayFiltros"
                variant="ghost"
                size="sm"
                class="mt-2"
                @click="limpiarFiltros"
              >
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
                  class="h-8 w-1 shrink-0 rounded-full bg-(--c)"
                  :style="{ '--c': prioColor(f.prioridad?.codigo) }"
                  :title="f.prioridad?.etiqueta"
                />
                <span
                  class="mt-0.5 hidden size-2 shrink-0 rounded-full bg-(--c) sm:block"
                  :style="{ '--c': categoriaFalla(f).color }"
                  :title="categoriaFalla(f).etiqueta"
                />

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <code class="font-mono text-xs text-muted-foreground">{{
                      f.codigo_interno
                    }}</code>
                    <TruncatedText
                      :text="tituloFalla(f)"
                      class="min-w-0 text-sm font-medium text-foreground"
                    />
                    <Badge
                      v-if="recurrencias(f) > 1"
                      variant="outline"
                      class="shrink-0 text-warning"
                      :title="`${recurrencias(f)}× mismo tipo en este proyecto`"
                    >
                      <RotateCcwIcon /> {{ recurrencias(f) }}×
                    </Badge>
                  </div>
                  <TruncatedText
                    v-if="!drawerVisible"
                    :text="
                      [f.proyecto?.nombre_comercial, f.descripcion].filter(Boolean).join(' · ')
                    "
                    class="text-xs text-muted-foreground"
                  />
                </div>

                <div v-if="!drawerVisible" class="hidden shrink-0 items-center gap-1.5 md:flex">
                  <span
                    class="size-1.5 rounded-full bg-(--c)"
                    :style="{ '--c': colorEstado(f.estado?.codigo, 'var(--muted-foreground)') }"
                  />
                  <span class="text-xs text-muted-foreground">{{ f.estado?.etiqueta || '—' }}</span>
                </div>

                <div v-if="!drawerVisible" class="hidden shrink-0 text-right text-xs lg:block">
                  <div class="text-foreground">{{ fmtFecha(f.fecha_identificacion) }}</div>
                  <div class="text-muted-foreground">
                    {{ relativeTime(f.fecha_identificacion) }}
                  </div>
                </div>

                <span
                  v-if="f.dias_abierta != null"
                  class="shrink-0 text-xs font-bold"
                  :class="diasClass(f)"
                >
                  {{ f.dias_abierta }}d
                </span>

                <GBadge :color="slaSeverity(f)" size="sm" class="shrink-0">{{ slaText(f) }}</GBadge>

                <div
                  v-if="!drawerVisible"
                  class="hidden shrink-0 items-center gap-0.5 xl:flex"
                  @click.stop
                >
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
        </div>
        <!-- /gf-main -->

        <!-- ══ PANEL DETALLE ══════════════════════════════════════════════ -->
        <aside
          v-if="drawerVisible && drawerFalla"
          class="fixed inset-0 z-30 flex justify-end lg:static lg:z-auto lg:col-span-3 lg:block"
          @keydown.left.stop="navegar(-1)"
          @keydown.right.stop="navegar(1)"
        >
          <!-- Backdrop solo en móvil -->
          <div
            class="absolute inset-0 bg-black/35 backdrop-blur-xs lg:hidden"
            @click="drawerVisible = false"
          />
          <div
            class="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl lg:h-auto lg:max-w-none lg:rounded-xl lg:border lg:shadow-sm"
          >
            <!-- Header panel -->
            <div class="flex shrink-0 items-center gap-1 overflow-hidden border-b px-3 py-2.5">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Cerrar (Esc)"
                @click="drawerVisible = false"
              >
                <XIcon />
              </Button>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <code class="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm text-primary">{{
                    drawerFalla.codigo_interno
                  }}</code>
                  <span class="text-xs text-muted-foreground">·</span>
                  <TruncatedText
                    :text="tituloFalla(drawerFalla)"
                    class="min-w-0 text-sm font-medium text-foreground"
                  />
                  <span
                    v-if="navIndex >= 0"
                    class="ml-auto hidden text-xs whitespace-nowrap text-muted-foreground sm:inline-block"
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
            <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <!-- ── HERO: título + estado + descripción ──────────────── -->
              <section
                class="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5"
              >
                <div>
                  <p class="text-base font-bold text-foreground">{{ tituloFalla(drawerFalla) }}</p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <GBadge :color="colorEstado(drawerFalla.estado?.codigo)">{{
                      drawerFalla.estado?.etiqueta
                    }}</GBadge>
                    <GBadge :color="prioColor(drawerFalla.prioridad?.codigo)">{{
                      drawerFalla.prioridad?.etiqueta
                    }}</GBadge>
                    <GBadge
                      v-if="categoriaFalla(drawerFalla).etiqueta"
                      :color="categoriaFalla(drawerFalla).color || '#915BD8'"
                      >{{ categoriaFalla(drawerFalla).etiqueta }}</GBadge
                    >
                    <GBadge v-if="drawerFalla.pendiente_reclasificar" color="warning"
                      >Pendiente de reclasificar</GBadge
                    >
                  </div>
                </div>
                <p
                  v-if="drawerFalla.descripcion"
                  class="text-sm font-medium whitespace-pre-line text-foreground"
                >
                  {{ drawerFalla.descripcion }}
                </p>
              </section>

              <!-- ── SLA: franja de estado propia, arriba del todo ────── -->
              <section class="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3.5">
                <header class="flex items-center gap-2">
                  <ClockIcon class="size-3.5 text-primary" />
                  <h3 class="text-sm font-bold text-foreground">SLA</h3>
                  <GBadge class="ml-auto" :color="slaSeverity(drawerFalla)">{{
                    slaText(drawerFalla)
                  }}</GBadge>
                </header>
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-2xl font-extrabold text-(--c)"
                    :style="{ '--c': slaTextColor(drawerFalla) }"
                    >{{ horasTranscurridas(drawerFalla) }}h</span
                  >
                  <span class="text-sm font-semibold text-muted-foreground"
                    >de {{ drawerFalla.sla_limite_horas_efectivo }}h</span
                  >
                </div>
                <Progress
                  :model-value="slaFillPct(drawerFalla)"
                  class="*:bg-(--c)"
                  :style="{ '--c': slaTextColor(drawerFalla) }"
                />

                <div class="mt-2 flex flex-col gap-1.5 border-t pt-2.5">
                  <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <span class="text-xs font-semibold text-muted-foreground"
                      >Límite personalizado</span
                    >
                    <span v-if="!quickEdit.sla_limite_horas" class="text-xs text-muted-foreground">
                      Por defecto:
                      <strong class="text-foreground"
                        >{{ drawerFalla.sla_limite_horas_efectivo }}h</strong
                      >
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Input
                      v-model.number="slaLimiteHorasModel"
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
                      @click="limpiarSlaPersonalizado"
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    Opcional. Solo para casos puntuales que necesitan más o menos tiempo que el
                    default de su prioridad.
                  </p>
                </div>
              </section>

              <!-- ── EQUIPO QUE FALLÓ / CLASIFICACIÓN ──────────────────── -->
              <section class="flex flex-col gap-3 rounded-xl border p-3.5">
                <header class="flex items-center gap-2">
                  <component
                    :is="clasifDrawer ? clasifDrawer.icono : ServerIcon"
                    class="size-3.5"
                    :class="clasifDrawer ? 'text-(--c)' : 'text-primary'"
                    :style="{ '--c': clasifDrawer?.categoriaColor }"
                  />
                  <h3 class="text-sm font-bold text-foreground">Equipo / clasificación</h3>
                </header>

                <template v-if="clasifDrawer">
                  <div class="flex flex-wrap items-center gap-2">
                    <GBadge :color="clasifDrawer.categoriaColor || '#915BD8'">{{
                      clasifDrawer.categoriaEtiqueta
                    }}</GBadge>
                    <span
                      v-if="clasifDrawer.subtitulo"
                      class="text-sm font-semibold text-foreground"
                      >{{ clasifDrawer.subtitulo }}</span
                    >
                  </div>
                  <p
                    v-if="clasifDrawer.detalle"
                    class="text-sm whitespace-pre-line text-foreground"
                  >
                    {{ clasifDrawer.detalle }}
                  </p>

                  <!-- Frontera: flags de medición / comunicación -->
                  <div v-if="clasifDrawer.frontera" class="flex flex-wrap gap-2">
                    <span
                      class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
                      :class="
                        clasifDrawer.frontera.afectaMedicion
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      <CircleXIcon v-if="clasifDrawer.frontera.afectaMedicion" class="size-3" />
                      <CircleCheckIcon v-else class="size-3" />
                      {{
                        clasifDrawer.frontera.afectaMedicion
                          ? 'Afecta la medición'
                          : 'No afecta la medición'
                      }}
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
                      :class="
                        clasifDrawer.frontera.perdidaComunicacion
                          ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      <WifiIcon v-if="clasifDrawer.frontera.perdidaComunicacion" class="size-3" />
                      <CircleCheckIcon v-else class="size-3" />
                      {{
                        clasifDrawer.frontera.perdidaComunicacion
                          ? 'Pérdida de comunicación'
                          : 'Comunicación OK'
                      }}
                    </span>
                  </div>

                  <!-- Capa aparte: TIPO(S) DE FALLA del inversor -->
                  <div
                    v-if="clasifDrawer.inversorTipos.length"
                    class="rounded-lg border border-primary/20 bg-primary/5 p-2.5"
                  >
                    <p
                      class="mb-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"
                    >
                      Tipo{{ clasifDrawer.inversorTipos.length > 1 ? 's' : '' }} de falla
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="(t, ti) in clasifDrawer.inversorTipos"
                        :key="ti"
                        class="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                        >{{ t }}</span
                      >
                    </div>
                  </div>

                  <!-- Capa: INVERSORES afectados -->
                  <div v-if="clasifDrawer.inversores.length" class="flex flex-col gap-2">
                    <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      Inversores afectados ({{ clasifDrawer.inversores.length }})
                    </p>
                    <div
                      v-for="(inv, idx) in clasifDrawer.inversores"
                      :key="idx"
                      class="rounded-lg border bg-muted/40 p-2.5"
                    >
                      <div class="flex items-center gap-1.5">
                        <ServerIcon class="size-3 text-primary" />
                        <span class="text-sm font-semibold text-foreground">{{ inv.nombre }}</span>
                        <span v-if="inv.potenciaKw != null" class="text-xs text-muted-foreground"
                          >· {{ inv.potenciaKw }} kW</span
                        >
                      </div>
                      <!-- Chips por inversor solo si los tipos difieren entre inversores -->
                      <div
                        v-if="!clasifDrawer.tiposUniformes && inv.tipos.length"
                        class="mt-1.5 flex flex-wrap gap-1.5"
                      >
                        <span
                          v-for="(t, ti) in inv.tipos"
                          :key="ti"
                          class="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                          >{{ t }}</span
                        >
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Falla sin clasificación estructurada (catálogo anterior) -->
                <template v-else>
                  <div class="flex flex-wrap items-center gap-2">
                    <GBadge
                      v-if="categoriaFalla(drawerFalla).etiqueta"
                      :color="categoriaFalla(drawerFalla).color || '#915BD8'"
                      >{{ categoriaFalla(drawerFalla).etiqueta }}</GBadge
                    >
                    <span class="text-sm font-semibold text-foreground">{{
                      drawerFalla.tipo?.etiqueta || drawerFalla.tipo_libre || 'Sin clasificación'
                    }}</span>
                  </div>
                  <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <InfoIcon class="mt-0.5 size-3 shrink-0" />
                    Registrada sin desglose específico por equipo/inversor. Las fallas nuevas
                    capturan el detalle (p. ej. inversor afectado y tipo de falla).
                  </p>
                </template>
              </section>

              <!-- ── FECHAS Y TIEMPOS ──────────────────────────────────── -->
              <section class="flex flex-col gap-3 rounded-xl border p-3.5">
                <header class="flex items-center gap-2">
                  <CalendarIcon class="size-3.5 text-primary" />
                  <h3 class="text-sm font-bold text-foreground">Fechas y tiempos</h3>
                </header>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <CalendarPlusIcon class="size-3" /> Identificada
                    </dt>
                    <dd class="text-sm font-medium text-foreground">
                      {{ fmtFecha(drawerFalla.fecha_identificacion)
                      }}<span v-if="drawerFalla.hora_identificacion">
                        · {{ String(drawerFalla.hora_identificacion).slice(0, 5) }}</span
                      >
                      <span class="text-muted-foreground">
                        · {{ relativeTime(drawerFalla.fecha_identificacion) }}</span
                      >
                    </dd>
                  </div>
                  <div v-if="drawerFalla.fecha_ocurrencia" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <ClockIcon class="size-3" /> Ocurrencia
                    </dt>
                    <dd class="text-sm font-medium text-foreground">
                      {{ fmtFechaHora(drawerFalla.fecha_ocurrencia) }}
                    </dd>
                  </div>
                  <div v-if="drawerFalla.fecha_programada" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <CalendarIcon class="size-3" /> Programada
                    </dt>
                    <dd class="text-sm font-medium text-foreground">
                      {{ fmtFecha(drawerFalla.fecha_programada) }}
                    </dd>
                  </div>
                  <div v-if="drawerFalla.fecha_resolucion" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <CircleCheckIcon class="size-3" /> Resuelta
                    </dt>
                    <dd class="text-sm font-semibold text-success">
                      {{ fmtFechaHora(drawerFalla.fecha_resolucion) }}
                    </dd>
                  </div>
                  <div v-if="drawerFalla.dias_abierta != null" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <HourglassIcon class="size-3" /> Días abierta
                    </dt>
                    <dd class="text-sm font-medium">
                      <span class="font-bold" :class="diasClass(drawerFalla)"
                        >{{ drawerFalla.dias_abierta }}d</span
                      >
                    </dd>
                  </div>
                  <div
                    v-if="drawerFalla.tiempo_afectacion_horas != null"
                    class="flex flex-col gap-0.5"
                  >
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <TimerIcon class="size-3" /> Tiempo de afectación
                    </dt>
                    <dd class="text-sm font-semibold text-warning">
                      {{ fmtHoras(drawerFalla.tiempo_afectacion_horas) }}
                    </dd>
                  </div>
                  <div
                    v-if="tiempoEnEstadoActual && !drawerFalla.estado?.es_estado_final"
                    class="flex flex-col gap-0.5"
                  >
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <TimerIcon class="size-3" /> En estado actual
                    </dt>
                    <dd class="text-sm font-medium text-foreground">{{ tiempoEnEstadoActual }}</dd>
                  </div>
                </dl>
              </section>

              <!-- ── GESTIÓN E IMPACTO ─────────────────────────────────── -->
              <section class="flex flex-col gap-3 rounded-xl border p-3.5">
                <header class="flex items-center gap-2">
                  <BriefcaseIcon class="size-3.5 text-primary" />
                  <h3 class="text-sm font-bold text-foreground">Gestión e impacto</h3>
                </header>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <BuildingIcon class="size-3" /> Proyecto
                    </dt>
                    <dd class="text-sm font-medium text-foreground">
                      {{ drawerFalla.proyecto?.nombre_comercial || '—' }}
                    </dd>
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <UserPenIcon class="size-3" /> Registrado por
                    </dt>
                    <dd class="text-sm font-medium text-foreground">
                      {{ drawerFalla.registrado_por?.nombre || '—' }}
                    </dd>
                  </div>
                  <div v-if="drawerFalla.resolucion" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <WrenchIcon class="size-3" /> Resolución
                    </dt>
                    <dd class="text-sm font-semibold text-success">
                      {{ drawerFalla.resolucion.etiqueta }}
                    </dd>
                  </div>
                  <div
                    v-if="drawerFalla.kwh_perdidos_estimado != null"
                    class="flex flex-col gap-0.5"
                  >
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <ZapIcon class="size-3" /> Energía perdida
                    </dt>
                    <dd class="text-sm font-semibold text-destructive">
                      {{ Number(drawerFalla.kwh_perdidos_estimado).toLocaleString('es-CO') }} kWh
                    </dd>
                  </div>
                  <div
                    v-if="drawerFalla.impacto_economico_cop != null"
                    class="flex flex-col gap-0.5"
                  >
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <DollarSignIcon class="size-3" /> Impacto económico
                    </dt>
                    <dd class="text-sm font-semibold text-destructive">
                      {{ fmtCOP(drawerFalla.impacto_economico_cop) }}
                    </dd>
                  </div>
                  <div v-if="recurrencias(drawerFalla) > 1" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase"
                    >
                      <RotateCcwIcon class="size-3" /> Reincidencia
                    </dt>
                    <dd class="text-sm font-semibold text-warning">
                      {{ recurrencias(drawerFalla) }}× mismo tipo en este proyecto
                    </dd>
                  </div>
                  <div v-if="origenFalla" class="flex flex-col gap-0.5">
                    <dt
                      class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase"
                    >
                      <BellIcon class="size-3" /> Origen
                    </dt>
                    <dd class="text-sm font-medium text-foreground">{{ origenFalla }}</dd>
                  </div>
                </dl>
              </section>

              <!-- ── EDICIÓN RÁPIDA ─────────────────────────────────── -->
              <section class="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3.5">
                <header class="flex items-center gap-2">
                  <ZapIcon class="size-3.5 text-primary" />
                  <h3 class="text-sm font-bold text-foreground">Edición rápida</h3>
                  <span
                    v-if="savingQuick"
                    class="ml-auto flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <LoaderCircleIcon class="size-3.5 animate-spin" /> Guardando…
                  </span>
                  <span
                    v-else-if="savedFlash"
                    class="ml-auto flex items-center gap-1 text-xs font-semibold text-success"
                  >
                    <CheckIcon class="size-3.5" /> Guardado
                  </span>
                </header>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div class="grid grid-cols-3 items-center gap-2">
                    <label class="text-xs font-semibold text-muted-foreground">Estado</label>
                    <Select
                      :model-value="quickEdit.estado_id ? String(quickEdit.estado_id) : undefined"
                      @update:model-value="
                        (v) => {
                          quickEdit.estado_id = Number(v)
                          autosaveQuick()
                        }
                      "
                    >
                      <SelectTrigger class="col-span-2 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="e in catalogos.estados"
                          :key="e.id"
                          :value="String(e.id)"
                          >{{ e.etiqueta }}</SelectItem
                        >
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid grid-cols-3 items-center gap-2">
                    <label class="text-xs font-semibold text-muted-foreground">Prioridad</label>
                    <Select
                      :model-value="
                        quickEdit.prioridad_id ? String(quickEdit.prioridad_id) : undefined
                      "
                      @update:model-value="
                        (v) => {
                          quickEdit.prioridad_id = Number(v)
                          autosaveQuick()
                        }
                      "
                    >
                      <SelectTrigger class="col-span-2 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="p in catalogos.prioridades"
                          :key="p.id"
                          :value="String(p.id)"
                          >{{ p.etiqueta }}</SelectItem
                        >
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <!-- ── ACCIÓN SUGERIDA ────────────────────────────────── -->
              <aside
                v-if="drawerFalla.tipo?.accion_sugerida"
                class="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3"
              >
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning"
                >
                  <LightbulbIcon class="size-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-warning uppercase">Acción sugerida</p>
                  <p class="text-sm text-foreground">{{ drawerFalla.tipo.accion_sugerida }}</p>
                </div>
              </aside>

              <!-- ── ANÁLISIS ───────────────────────────────────────── -->
              <section
                v-if="drawerFalla.causa_raiz || drawerFalla.acciones_correctivas"
                class="flex flex-col gap-3 rounded-xl border p-3.5"
              >
                <header class="flex items-center gap-2">
                  <SearchIcon class="size-3.5 text-primary" />
                  <h3 class="text-sm font-bold text-foreground">Análisis</h3>
                </header>
                <div class="flex flex-col gap-3">
                  <div v-if="drawerFalla.causa_raiz">
                    <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      Causa raíz
                    </p>
                    <p class="text-sm text-foreground">{{ drawerFalla.causa_raiz }}</p>
                  </div>
                  <div v-if="drawerFalla.acciones_correctivas">
                    <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      Acciones correctivas
                    </p>
                    <p class="text-sm text-foreground">{{ drawerFalla.acciones_correctivas }}</p>
                  </div>
                </div>
              </section>

              <!-- ── SEGUIMIENTOS ───────────────────────────────────── -->
              <section class="flex flex-col gap-3 rounded-xl border p-3.5">
                <header class="flex items-center gap-2">
                  <MessagesSquareIcon class="size-3.5 text-primary" />
                  <h3 class="text-sm font-bold text-foreground">Seguimientos</h3>
                  <Badge variant="secondary" class="ml-auto">{{
                    drawerFalla.seguimientos?.length || 0
                  }}</Badge>
                </header>

                <!-- Agregar nota -->
                <div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-2.5">
                  <Textarea
                    v-model="nuevaNota.nota"
                    rows="2"
                    placeholder="Agregar nota o actualización…"
                    class="w-full"
                  />
                  <div class="flex items-center gap-2">
                    <Select
                      :model-value="nuevaNota.estado_id ? String(nuevaNota.estado_id) : undefined"
                      @update:model-value="
                        (v) =>
                          (nuevaNota.estado_id = v && v !== '__sin_cambio__' ? Number(v) : null)
                      "
                    >
                      <SelectTrigger class="flex-1">
                        <SelectValue placeholder="Cambiar estado (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sin_cambio__">Sin cambio de estado</SelectItem>
                        <SelectItem
                          v-for="e in catalogos.estados"
                          :key="e.id"
                          :value="String(e.id)"
                          >{{ e.etiqueta }}</SelectItem
                        >
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      :disabled="(!nuevaNota.nota.trim() && !nuevaNota.estado_id) || addingSeg"
                      @click="agregarSeguimiento"
                    >
                      <LoaderCircleIcon v-if="addingSeg" class="animate-spin" />
                      <SendIcon v-else />
                      Agregar
                    </Button>
                  </div>
                </div>

                <!-- Timeline -->
                <div v-if="sortedSeguimientos.length" class="flex flex-col gap-3">
                  <div v-for="seg in sortedSeguimientos" :key="seg.id" class="flex gap-2.5">
                    <div
                      class="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--c) text-xs font-bold text-white"
                      :style="{ '--c': avatarColor(seg.usuario) }"
                    >
                      {{ initials(seg.usuario?.nombre) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="mb-0.5 flex flex-wrap items-center gap-2">
                        <span class="text-sm font-semibold text-foreground">{{
                          seg.usuario?.nombre || 'Sistema'
                        }}</span>
                        <span class="text-xs text-muted-foreground">{{
                          relativeTime(seg.created_at)
                        }}</span>
                      </div>
                      <p v-if="seg.nota" class="text-sm whitespace-pre-line text-foreground">
                        {{ seg.nota }}
                      </p>
                      <div v-if="seg.estado_nuevo" class="mt-1.5">
                        <GBadge :color="colorEstado(seg.estado_nuevo?.codigo)">{{
                          seg.estado_nuevo?.etiqueta
                        }}</GBadge>
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else class="text-sm text-muted-foreground">
                  Aún no hay seguimientos registrados.
                </p>
              </section>

              <!-- ── ARCHIVOS ADJUNTOS ─────────────────────────────── -->
              <FallaArchivos v-if="drawerFalla?.id" :falla-id="drawerFalla.id" />

              <!-- ── ACCIONES PRINCIPALES ───────────────────────────── -->
              <div class="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" class="flex-1" @click="editarDesdeDrawer">
                  <PencilIcon /> Editar completa
                </Button>
                <Button
                  v-if="!drawerFalla.estado?.es_estado_final"
                  class="flex-1 bg-success text-primary-foreground hover:bg-success/90"
                  :disabled="resolvingFalla"
                  @click="quickResolve(drawerFalla)"
                >
                  <LoaderCircleIcon v-if="resolvingFalla" class="animate-spin" />
                  <CheckIcon v-else />
                  Marcar resuelta
                </Button>
                <Button
                  v-else
                  variant="outline"
                  class="flex-1 text-warning hover:text-warning"
                  @click="reabrirFalla"
                >
                  <RotateCcwIcon /> Reabrir
                </Button>
              </div>
            </div>
            <!-- /drawer body -->
          </div>
          <!-- /drawer panel -->
        </aside>
      </div>
      <!-- /layout -->

      <!-- ══ DIALOG CREAR / EDITAR ════════════════════════════════════════ -->
      <Dialog v-model:open="formDialogVisible">
        <DialogContent
          class="flex max-h-11/12 max-w-3xl flex-col"
          :show-close-button="!savingForm"
          @escape-key-down="(e) => savingForm && e.preventDefault()"
          @pointer-down-outside="(e) => savingForm && e.preventDefault()"
        >
          <DialogHeader>
            <DialogTitle>{{
              editingFalla ? `Editar falla ${editingFalla.codigo_interno}` : 'Nueva falla'
            }}</DialogTitle>
          </DialogHeader>
          <div class="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
            <FallaForm
              :initial="editingFalla"
              :catalogos="catalogos"
              @save="onSaveForm"
              @cancel="formDialogVisible = false"
            />
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
          <div v-if="resolveFallaTarget" class="flex flex-col gap-3 py-1">
            <p
              class="rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {{ resolveFallaTarget.codigo_interno }} —
              {{ resolveFallaTarget.proyecto?.nombre_comercial }}
            </p>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Fecha y hora de solución *</Label>
              <Input
                type="datetime-local"
                :model-value="toDatetimeLocalValue(resolveFecha)"
                class="w-full"
                @update:model-value="(v) => (resolveFecha = v ? new Date(String(v)) : new Date())"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Tipo de solución</Label>
              <Select
                :model-value="resolveResolucionId ? String(resolveResolucionId) : undefined"
                @update:model-value="(v) => (resolveResolucionId = v ? Number(v) : null)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Seleccionar (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="r in catalogos.resoluciones"
                    :key="r.id"
                    :value="String(r.id)"
                    >{{ r.etiqueta }}</SelectItem
                  >
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              :disabled="resolvingFalla"
              @click="resolveDialogVisible = false"
              >Cancelar</Button
            >
            <Button
              class="bg-success text-primary-foreground hover:bg-success/90"
              :disabled="resolvingFalla"
              @click="confirmarResolve"
            >
              <LoaderCircleIcon v-if="resolvingFalla" class="animate-spin" />
              <CheckIcon v-else />
              Marcar resuelta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
    <!-- /TAB 0 -->

    <!-- ══ TAB 1 — CALENDARIO ══════════════════════════════════════════════ -->
    <div v-if="activeTab === 1" class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted">
      <CalendarioFallas
        :refresh-key="calRefreshKey"
        @editar="abrirEditar"
        @ver-falla="irAFallaDesdeCalendario"
      />
    </div>
    <!-- /TAB 1 -->

    <!-- ══ BOTÓN FLOTANTE: Diagrama fasorial ══════════════════════════════ -->
    <FasorialButton />
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import type {
  CatalogosFalla,
  Falla,
  PayloadFalla,
  PayloadFallaForm,
  ResultadoNotificacionFalla,
} from '~/features/fallas/types'
import type { ProyectoLiviano } from '~/features/proyectos/types'
import {
  BellIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarPlusIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  HourglassIcon,
  InfoIcon,
  LightbulbIcon,
  ListIcon,
  LoaderCircleIcon,
  MessagesSquareIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  TimerIcon,
  Trash2Icon,
  UserPenIcon,
  WifiIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { formatCOP as fmtCOP } from '~/utils/currency'
import { FallasService } from '~/features/fallas/services/fallas'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import {
  categoriaFalla,
  clasificacionDetalle,
  tituloFalla,
} from '~/features/fallas/utils/fallaTitulo'
import CalendarioFallas from './CalendarioFallas.vue'
import FallaArchivos from './FallaArchivos.vue'
import FallaForm from './FallaForm.vue'
import FasorialButton from '~/features/fallas/components/FasorialButton.vue'

const fallasService = new FallasService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

// ── Calendario: refresh automático al guardar fallas ─────────────────────
const calRefreshKey = ref(0)

// ── Tabs ─────────────────────────────────────────────────────────────────
interface MonitoreoTab {
  label: string
  icon: Component
}
const TABS: MonitoreoTab[] = [
  { label: 'Fallas', icon: ZapIcon },
  { label: 'Calendario', icon: CalendarIcon },
]
const activeTab = ref(0)

// ── Buckets ───────────────────────────────────────────────────────────────
type BucketKey = 'activas' | 'alerta' | 'cerradas' | 'todas'
interface Bucket {
  key: BucketKey
  label: string
  icon: Component
  color: string
}
const BUCKETS: Bucket[] = [
  { key: 'activas', label: 'Activas', icon: ZapIcon, color: 'var(--destructive)' },
  { key: 'alerta', label: 'Alerta SLA', icon: CircleAlertIcon, color: 'var(--warning)' },
  { key: 'cerradas', label: 'Cerradas', icon: CircleCheckIcon, color: 'var(--success)' },
  { key: 'todas', label: 'Todas', icon: ListIcon, color: 'var(--primary)' },
]

const AVATAR_PALETTE = [
  'var(--primary)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--success)',
  'var(--warning)',
]

// ── Estado base ───────────────────────────────────────────────────────────
const allFallas = ref<Falla[]>([])
const proyectos = ref<ProyectoLiviano[]>([])
const catalogos = ref<CatalogosFalla>({ estados: [], prioridades: [], tipos: [], resoluciones: [] })
const loading = ref(false)
const error = ref<string | null>(null)

// ── Filtros ───────────────────────────────────────────────────────────────
// Sincronizados con la URL (?q=&proyecto=&prioridad=&estado=&desde=&hasta=)
// para que se sostengan al volver con "atras" o al refrescar.
function queryStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
const bucket = ref<BucketKey>('activas')
const search = ref(queryStr(route.query.q))
const filtroProyecto = ref<number | null>(
  route.query.proyecto ? Number(route.query.proyecto) : null,
)
const filtroPrioridad = ref<string | null>(queryStr(route.query.prioridad) || null)
const filtroEstado = ref<string | null>(queryStr(route.query.estado) || null)
const filtroFechaDesde = ref<string | null>(queryStr(route.query.desde) || null)
const filtroFechaHasta = ref<string | null>(queryStr(route.query.hasta) || null)

watch(
  [search, filtroProyecto, filtroPrioridad, filtroEstado, filtroFechaDesde, filtroFechaHasta],
  ([q, proyecto, prioridad, estado, desde, hasta]) => {
    const query: Record<string, string> = {}
    if (q) query.q = String(q)
    if (proyecto) query.proyecto = String(proyecto)
    if (prioridad) query.prioridad = String(prioridad)
    if (estado) query.estado = String(estado)
    if (desde) query.desde = String(desde)
    if (hasta) query.hasta = String(hasta)
    router.replace({ query })
  },
)

const filtrosActivosCount = computed(
  () =>
    [
      filtroProyecto.value,
      filtroPrioridad.value,
      filtroEstado.value,
      filtroFechaDesde.value,
      filtroFechaHasta.value,
    ].filter((v) => v != null && v !== '').length,
)

// ── Refs DOM ─────────────────────────────────────────────────────────────
const searchInputRef = ref<{ $el?: HTMLElement } | null>(null)
const pageRef = ref<HTMLElement | null>(null)
// Altura inicial del tab bar (una fila con py-2 y controles sm) mientras no se mide;
// measureHeader() la reemplaza con la altura real.
const TABBAR_H_INICIAL = 41
const pageStyle = { '--gf-tabbar-h': `${TABBAR_H_INICIAL}px` }
const tabBarRef = ref<HTMLElement | null>(null)
const stickyHeaderRef = ref<HTMLElement | null>(null)

// ── Drawer / detalle ──────────────────────────────────────────────────────
const drawerVisible = ref(false)
const drawerFalla = ref<Falla | null>(null)
const quickEdit = reactive<{
  estado_id: number | null
  prioridad_id: number | null
  sla_limite_horas: number | null
}>({ estado_id: null, prioridad_id: null, sla_limite_horas: null })
const savingQuick = ref(false)
const savedFlash = ref(false)
const resolvingFalla = ref(false)
const resolveDialogVisible = ref(false)
const resolveFallaTarget = ref<Falla | null>(null)
const resolveFecha = ref(new Date())
const resolveResolucionId = ref<number | null>(null)
const addingSeg = ref(false)
const nuevaNota = reactive<{ nota: string; estado_id: number | null }>({
  nota: '',
  estado_id: null,
})
/** Adaptador de tipo: `Input` no acepta `null` en su `model-value`, solo `undefined`. */
const slaLimiteHorasModel = computed<number | undefined>({
  get: () => quickEdit.sla_limite_horas ?? undefined,
  set: (v) => {
    quickEdit.sla_limite_horas = v ?? null
  },
})

// ── Dialog formulario ─────────────────────────────────────────────────────
const formDialogVisible = ref(false)
const editingFalla = ref<Falla | null>(null)
const savingForm = ref(false)

// ── Computed: lógica de buckets ───────────────────────────────────────────
function esAlertaSLA(f: Falla): boolean {
  return !f.estado?.es_estado_final && (f.sla_cumplido === false || (f.dias_abierta ?? 0) >= 7)
}

const counts = computed(() => {
  const c: Record<BucketKey, number> = {
    activas: 0,
    alerta: 0,
    cerradas: 0,
    todas: allFallas.value.length,
  }
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
  if (bucket.value === 'todas') return allFallas.value
  if (bucket.value === 'cerradas') return allFallas.value.filter((f) => f.estado?.es_estado_final)
  if (bucket.value === 'alerta')
    return allFallas.value.filter((f) => !f.estado?.es_estado_final && esAlertaSLA(f))
  // activas
  return allFallas.value.filter((f) => !f.estado?.es_estado_final)
})

const filtradas = computed(() => {
  let arr = porBucket.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    arr = arr.filter(
      (f) =>
        (f.codigo_interno || '').toLowerCase().includes(q) ||
        (f.descripcion || '').toLowerCase().includes(q) ||
        (f.proyecto?.nombre_comercial || '').toLowerCase().includes(q) ||
        tituloFalla(f).toLowerCase().includes(q) ||
        categoriaFalla(f).etiqueta.toLowerCase().includes(q),
    )
  }
  if (filtroProyecto.value) arr = arr.filter((f) => f.proyecto?.id === filtroProyecto.value)
  if (filtroPrioridad.value) arr = arr.filter((f) => f.prioridad?.codigo === filtroPrioridad.value)
  if (filtroEstado.value) arr = arr.filter((f) => f.estado?.codigo === filtroEstado.value)
  if (filtroFechaDesde.value) {
    const desde = startOfDay(filtroFechaDesde.value)
    arr = arr.filter(
      (f) => f.fecha_identificacion && new Date(`${f.fecha_identificacion}T00:00:00`) >= desde,
    )
  }
  if (filtroFechaHasta.value) {
    const hasta = startOfDay(filtroFechaHasta.value)
    hasta.setHours(23, 59, 59, 999)
    arr = arr.filter(
      (f) => f.fecha_identificacion && new Date(`${f.fecha_identificacion}T00:00:00`) <= hasta,
    )
  }
  // Cola de triage: primero lo más urgente por SLA (vencido > en alerta > ok),
  // y dentro de la misma severidad, lo que lleva más días abierta.
  return [...arr].sort((a, b) => {
    const diff = slaSeverityRank(a) - slaSeverityRank(b)
    if (diff !== 0) return diff
    return (b.dias_abierta ?? 0) - (a.dias_abierta ?? 0)
  })
})

const hayFiltros = computed(
  () =>
    !!(
      search.value ||
      filtroProyecto.value ||
      filtroPrioridad.value ||
      filtroEstado.value ||
      filtroFechaDesde.value ||
      filtroFechaHasta.value
    ),
)

const bucketActual = computed(() => BUCKETS.find((b) => b.key === bucket.value) ?? BUCKETS[0]!)

const EMPTY_TITULO: Record<BucketKey, string> = {
  activas: 'No hay fallas activas',
  alerta: 'Sin fallas en alerta SLA',
  cerradas: 'Sin fallas cerradas',
  todas: 'No hay fallas registradas',
}
const EMPTY_SUBTITULO: Record<BucketKey, string> = {
  activas: 'Todas las incidencias están bajo control',
  alerta: 'Ninguna falla supera el umbral de SLA',
  cerradas: 'Aún no se han cerrado fallas',
  todas: 'Registra la primera para empezar',
}
const emptyTitulo = computed(() =>
  hayFiltros.value ? 'Sin resultados con los filtros aplicados' : EMPTY_TITULO[bucket.value],
)
const emptySubtitulo = computed(() =>
  hayFiltros.value
    ? 'Prueba con otros filtros o limpia la búsqueda'
    : EMPTY_SUBTITULO[bucket.value],
)

const sortedSeguimientos = computed(() =>
  [...(drawerFalla.value?.seguimientos ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  ),
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
  const m: Record<string, number> = {}
  for (const f of allFallas.value) {
    if (!f.proyecto?.id || !f.tipo?.id) continue
    const k = `${f.proyecto.id}-${f.tipo.id}`
    m[k] = (m[k] || 0) + 1
  }
  return m
})

function recurrencias(f: Falla | null | undefined): number {
  if (!f?.proyecto?.id || !f?.tipo?.id) return 0
  return recurrenciaMap.value[`${f.proyecto.id}-${f.tipo.id}`] || 0
}

// ── Tiempo en estado actual (desde último cambio de estado en seguimientos) ─
const tiempoEnEstadoActual = computed(() => {
  if (!drawerFalla.value) return null
  const segs = [...(drawerFalla.value.seguimientos ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )
  const lastChange = segs.find((s) => s.estado_nuevo)
  if (!lastChange?.created_at) return null
  const diffH = (Date.now() - new Date(lastChange.created_at).getTime()) / 3_600_000
  if (diffH < 1) return `${Math.round(diffH * 60)} min`
  if (diffH < 24) return `${Math.round(diffH)}h`
  return `${Math.round(diffH / 24)}d`
})

const navIndex = computed(() => {
  if (!drawerFalla.value) return -1
  return filtradas.value.findIndex((f) => f.id === drawerFalla.value!.id)
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
const ventanaDesde = ref<Date | null>(null)

function haceDias(dias: number): Date {
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
function fechaLocalISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

async function cargar(desde: Date | null = null) {
  loading.value = true
  error.value = null
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
    const porId = new Map<number, Falla>()
    for (const f of [...(abiertas.items ?? []), ...(cerradas.items ?? [])]) {
      porId.set(f.id, f)
    }
    allFallas.value = [...porId.values()]
    ventanaDesde.value = inicio
  } catch (e) {
    error.value = normalizeError(e).message
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
  } catch {
    /* no crítico */
  }
}

async function cargarProyectos() {
  try {
    // Solo alimenta el desplegable "Proyecto" de los filtros: `id` y
    // `nombre_comercial`. El catalogo completo son 538 kB en dos peticiones.
    proyectos.value = await catalogoProyectos.cargarLiviano()
  } catch {
    /* no crítico */
  }
}

// ── Acciones ──────────────────────────────────────────────────────────────
function limpiarFiltros() {
  search.value = ''
  filtroProyecto.value = null
  filtroPrioridad.value = null
  filtroEstado.value = null
  filtroFechaDesde.value = null
  filtroFechaHasta.value = null
}

function navegar(delta: number) {
  if (!filtradas.value.length) return
  const cur = navIndex.value
  if (cur < 0) return
  const next = Math.max(0, Math.min(filtradas.value.length - 1, cur + delta))
  if (next === cur) return
  abrirDrawer(filtradas.value[next]!)
}

function abrirDrawer(falla: Falla) {
  drawerFalla.value = falla
  quickEdit.estado_id = falla.estado?.id ?? null
  quickEdit.prioridad_id = falla.prioridad?.id ?? null
  quickEdit.sla_limite_horas = falla.sla_limite_horas ?? null
  nuevaNota.nota = ''
  nuevaNota.estado_id = null
  drawerVisible.value = true
}

function abrirCrear() {
  editingFalla.value = null
  formDialogVisible.value = true
}

function abrirEditar(falla: Falla) {
  editingFalla.value = falla
  formDialogVisible.value = true
}

async function _mostrarResultadoNotificacion(fallaIds: number[]) {
  // Envía notificación para cada falla y muestra un toast con el resultado.
  // Si alguna falla, muestra advertencia pero NO bloquea el flujo.
  const resultados: ResultadoNotificacionFalla[] = await Promise.all(
    fallaIds.map((id) =>
      fallasService.notificar(id).catch((err): ResultadoNotificacionFalla => ({
        ok: false,
        enviados: [],
        errores: [normalizeError(err).message],
        sin_correos: false,
      })),
    ),
  )

  const todosOk = resultados.every((r) => r.ok)
  const sinCorreos = resultados.some((r) => r.sin_correos)
  const enviados = [...new Set(resultados.flatMap((r) => r.enviados || []))]
  const errores = resultados.flatMap((r) => r.errores || []).filter(Boolean)

  if (todosOk) {
    toast.success('✉️ Notificación enviada', {
      description: `Correo enviado a: ${enviados.join(', ')}`,
      duration: 5000,
    })
  } else if (sinCorreos) {
    toast.warning('⚠️ Sin correos configurados', {
      description:
        'La falla fue guardada pero el cliente no tiene correos operacionales configurados. Agrégalos en Clientes → Correos Operacionales.',
      duration: 8000,
    })
  } else {
    // Obtener el error SMTP más descriptivo
    const errorSmtp = errores.find(
      (e) => e.includes('534') || e.includes('Application-specific') || e.includes('password'),
    )
    toast.error('✉️ Error al enviar notificación', {
      description: errorSmtp
        ? 'Error de autenticación SMTP: Gmail requiere una App Password (contraseña de aplicación). Configúrala en las variables de Railway.'
        : `Error: ${errores[0] || 'Error desconocido'}`,
      duration: 10000,
    })
  }
}

function irAFallaDesdeCalendario(falla: Falla) {
  // Cambia al tab Fallas y abre el drawer con la falla seleccionada
  activeTab.value = 0
  nextTick(() => abrirDrawer(falla))
}

function editarDesdeDrawer() {
  if (!drawerFalla.value) return
  editingFalla.value = drawerFalla.value
  formDialogVisible.value = true
}

async function onSaveForm(payload: PayloadFallaForm) {
  savingForm.value = true
  try {
    const notificar = !!payload.notificacion

    if (editingFalla.value) {
      // ── Edición (un solo proyecto) ──────────────────────────────────────
      const fallaId = editingFalla.value.id
      const { nota_inicial: notaInicial, _archivos: archivosEdit, ...patchPayload } = payload
      await fallasService.actualizar(fallaId, patchPayload)
      if (notaInicial) await fallasService.crearSeguimiento(fallaId, { nota: notaInicial })
      if (archivosEdit?.length) {
        await Promise.all(archivosEdit.map((file) => fallasService.subirArchivo(fallaId, file)))
      }
      toast.success('Falla actualizada', { duration: 2500 })

      // Notificación tras edición
      if (notificar) await _mostrarResultadoNotificacion([fallaId])
    } else {
      // ── Creación (uno o más proyectos) ──────────────────────────────────
      const { proyecto_ids, nota_inicial: notaInicial, _archivos: archivos, ...base } = payload
      const ids = proyecto_ids ?? []

      // Una falla por proyecto, en paralelo
      const nuevas = await Promise.all(
        ids.map((pid) => fallasService.crear({ ...base, proyecto_id: pid })),
      )
      // Nota inicial para cada falla creada (si la hay)
      if (notaInicial) {
        await Promise.all(
          nuevas.map((f) => fallasService.crearSeguimiento(f.id, { nota: notaInicial })),
        )
      }
      // Subir archivos adjuntos a cada falla (si los hay)
      if (archivos?.length) {
        await Promise.all(
          nuevas.flatMap((f) => archivos.map((file) => fallasService.subirArchivo(f.id, file))),
        )
      }
      const n = nuevas.length
      toast.success(n === 1 ? 'Falla registrada' : `${n} fallas registradas`, {
        description:
          n > 1 ? 'Se creó una falla independiente por cada proyecto seleccionado' : undefined,
        duration: 3000,
      })

      // Notificación tras creación
      if (notificar && nuevas.length) await _mostrarResultadoNotificacion(nuevas.map((f) => f.id))
    }
    formDialogVisible.value = false
    calRefreshKey.value++ // ← dispara recarga del calendario
    await cargar()
    if (drawerFalla.value && editingFalla.value) {
      const refreshed = allFallas.value.find((f) => f.id === editingFalla.value!.id)
      if (refreshed) abrirDrawer(refreshed)
    }
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    savingForm.value = false
  }
}

// Autosave con debounce
let _autosaveTimer: ReturnType<typeof setTimeout> | null = null
function autosaveQuick() {
  if (_autosaveTimer) clearTimeout(_autosaveTimer)
  _autosaveTimer = setTimeout(() => guardarQuickEdit(), 350)
}

function limpiarSlaPersonalizado() {
  quickEdit.sla_limite_horas = null
  autosaveQuick()
}

async function guardarQuickEdit() {
  if (!drawerFalla.value) return
  const payload: PayloadFalla = {}
  if (quickEdit.estado_id !== drawerFalla.value.estado?.id) payload.estado_id = quickEdit.estado_id
  if (quickEdit.prioridad_id !== drawerFalla.value.prioridad?.id)
    payload.prioridad_id = quickEdit.prioridad_id
  if ((quickEdit.sla_limite_horas || null) !== (drawerFalla.value.sla_limite_horas || null))
    payload.sla_limite_horas = quickEdit.sla_limite_horas || null
  if (!Object.keys(payload).length) return

  savingQuick.value = true
  try {
    const data = await fallasService.actualizar(drawerFalla.value.id, payload)
    drawerFalla.value = data
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    savedFlash.value = true
    setTimeout(() => {
      savedFlash.value = false
    }, 1500)
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message, duration: 3000 })
    quickEdit.estado_id = drawerFalla.value.estado?.id ?? null
    quickEdit.prioridad_id = drawerFalla.value.prioridad?.id ?? null
    quickEdit.sla_limite_horas = drawerFalla.value.sla_limite_horas ?? null
  } finally {
    savingQuick.value = false
  }
}

function quickResolve(falla: Falla) {
  const estadoFinal = catalogos.value.estados.find((e) => e.es_estado_final)
  if (!estadoFinal) {
    toast.warning('Sin estado final configurado', { duration: 3000 })
    return
  }
  resolveFallaTarget.value = falla
  resolveFecha.value = new Date()
  resolveResolucionId.value = null
  resolveDialogVisible.value = true
}

async function confirmarResolve() {
  const falla = resolveFallaTarget.value
  if (!falla) return
  const estadoFinal = catalogos.value.estados.find((e) => e.es_estado_final)
  if (!estadoFinal) return
  resolvingFalla.value = true
  try {
    const payload: PayloadFalla = {
      estado_id: estadoFinal.id,
      fecha_resolucion: resolveFecha.value.toISOString(),
      sla_cumplido: !slaVencido(falla),
    }
    if (resolveResolucionId.value) payload.resolucion_id = resolveResolucionId.value
    const data = await fallasService.actualizar(falla.id, payload)
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    if (drawerFalla.value?.id === data.id) drawerFalla.value = data
    resolveDialogVisible.value = false
    calRefreshKey.value++
    toast.success('Falla resuelta', { duration: 2500 })
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 3000 })
  } finally {
    resolvingFalla.value = false
  }
}

async function reabrirFalla() {
  if (!drawerFalla.value) return
  const abierta =
    catalogos.value.estados.find((e) => e.codigo === 'abierta') ??
    catalogos.value.estados.find((e) => !e.es_estado_final)
  if (!abierta) {
    toast.warning('Sin estado abierto configurado', { duration: 3000 })
    return
  }
  try {
    const data = await fallasService.actualizar(drawerFalla.value.id, {
      estado_id: abierta.id,
      fecha_resolucion: null,
    })
    drawerFalla.value = data
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    quickEdit.estado_id = data.estado?.id ?? null
    toast.success('Falla reabierta', { duration: 2500 })
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 3000 })
  }
}

async function agregarSeguimiento() {
  if (!drawerFalla.value) return
  if (!nuevaNota.nota.trim() && !nuevaNota.estado_id) return
  addingSeg.value = true
  try {
    const payload: { nota?: string; estado_nuevo_id?: number } = {}
    if (nuevaNota.nota.trim()) payload.nota = nuevaNota.nota.trim()
    if (nuevaNota.estado_id) payload.estado_nuevo_id = nuevaNota.estado_id
    await fallasService.crearSeguimiento(drawerFalla.value.id, payload)
    nuevaNota.nota = ''
    nuevaNota.estado_id = null
    const data = await fallasService.obtener(drawerFalla.value.id)
    drawerFalla.value = data
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    quickEdit.estado_id = data.estado?.id ?? null
    if (payload.estado_nuevo_id) calRefreshKey.value++
    toast.success('Seguimiento agregado', { duration: 2000 })
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 3000 })
  } finally {
    addingSeg.value = false
  }
}

function confirmDelete(falla: Falla) {
  confirm({
    title: 'Eliminar falla',
    description: `¿Eliminar la falla ${falla.codigo_interno}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await fallasService.eliminar(falla.id)
        allFallas.value = allFallas.value.filter((f) => f.id !== falla.id)
        drawerVisible.value = false
        toast.success('Falla eliminada', { duration: 2500 })
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message, duration: 3000 })
      }
    },
  })
}

// ── Helpers visuales ──────────────────────────────────────────────────────
function prioColor(codigo?: string | null): string {
  return colorPrioridad(codigo, 'var(--muted-foreground)')
}

function initials(nombre?: string): string {
  if (!nombre) return '?'
  const parts = nombre.trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

function avatarColor(user?: { id?: number; nombre?: string } | null): string {
  if (!user) return 'var(--muted-foreground)'
  const id = user.id ?? hashCode(user.nombre || '')
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length] ?? 'var(--primary)'
}

function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}

function diasClass(f: Falla): string {
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
function horasTranscurridas(falla: Falla): number {
  return Math.round(falla.sla_horas_transcurridas ?? 0)
}

function slaPct(falla: Falla): number | null {
  return falla.sla_pct ?? null
}

function slaVencido(falla: Falla): boolean {
  const p = slaPct(falla)
  return p != null && p >= 100
}

function slaFillPct(falla: Falla): number {
  return Math.min(slaPct(falla) ?? 0, 100)
}

function slaTextColor(falla: Falla): string {
  if (falla.sla_cumplido === true) return 'var(--success)'
  if (falla.sla_cumplido === false) return 'var(--destructive)'
  const p = slaPct(falla)
  if (p == null) return 'var(--muted-foreground)'
  if (p >= 100) return 'var(--destructive)'
  if (p >= 70) return 'var(--warning)'
  return 'var(--success)'
}

function slaText(falla: Falla): string {
  if (falla.sla_cumplido === true) return 'OK'
  if (falla.sla_cumplido === false) return 'Vencido'
  const p = slaPct(falla)
  if (p == null) return '—'
  if (p >= 100) return 'Vencido'
  return `${p}%`
}

function slaSeverity(falla: Falla): GandalfBadgeColor {
  const c = slaTextColor(falla)
  if (c === 'var(--success)') return 'success'
  if (c === 'var(--destructive)') return 'destructive'
  if (c === 'var(--warning)') return 'warning'
  return 'default'
}

// Orden de urgencia para la cola de triage: vencido primero, luego alerta,
// luego sin dato de SLA, y al final lo que ya cumple/está resuelto.
const SLA_SEVERITY_RANK: Record<string, number> = {
  destructive: 0,
  warning: 1,
  default: 2,
  success: 3,
}
function slaSeverityRank(falla: Falla): number {
  return SLA_SEVERITY_RANK[slaSeverity(falla)] ?? 2
}

function fmtFecha(d?: string | null): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Fecha + hora para campos datetime (ocurrencia, resolución).
function fmtFechaHora(dt?: string | null): string {
  if (!dt) return '—'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return fmtFecha(String(dt).slice(0, 10))
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Formato local para <input type="datetime-local">: YYYY-MM-DDTHH:mm en hora del navegador.
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Duración legible a partir de horas (min / h / d h).
function fmtHoras(h?: number | null): string {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${Math.round(h * 10) / 10} h`
  const dias = Math.floor(h / 24)
  const rest = Math.round(h % 24)
  return rest ? `${dias} d ${rest} h` : `${dias} d`
}

function relativeTime(d?: string | null): string {
  if (!d) return ''
  const date = typeof d === 'string' && d.length === 10 ? new Date(`${d}T00:00:00`) : new Date(d)
  const diff = (Date.now() - date.getTime()) / 1000
  let rel: string
  if (diff < 0) {
    const future = Math.abs(diff)
    if (future < 86400) rel = `en ${Math.floor(future / 3600)}h`
    else rel = `en ${Math.floor(future / 86400)}d`
  } else if (diff < 60) rel = 'ahora'
  else if (diff < 3600) rel = `hace ${Math.floor(diff / 60)}min`
  else if (diff < 86400) rel = `hace ${Math.floor(diff / 3600)}h`
  else if (diff < 86400 * 30) rel = `hace ${Math.floor(diff / 86400)}d`
  else if (diff < 86400 * 365) rel = `hace ${Math.floor(diff / (86400 * 30))}m`
  else rel = `hace ${Math.floor(diff / (86400 * 365))}a`
  return rel
}

function startOfDay(d: string | Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const t = target.tagName
  if (t === 'INPUT' || t === 'TEXTAREA' || target.isContentEditable) return
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
let _headerRO: ResizeObserver | null = null
let _tabBarRO: ResizeObserver | null = null
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
  cargarProyectos()
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
  if (!val) {
    setTimeout(() => {
      drawerFalla.value = null
    }, 200)
  }
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
    const f = drawerFalla.value!
    if (newBucket === 'cerradas') return !!f.estado?.es_estado_final
    if (newBucket === 'alerta') return !f.estado?.es_estado_final && esAlertaSLA(f)
    if (newBucket === 'activas') return !f.estado?.es_estado_final
    return true
  })()
  if (!pertenece) drawerVisible.value = false
})
</script>
