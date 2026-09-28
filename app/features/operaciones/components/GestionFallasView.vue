<template>
  <div class="flex flex-col gap-3">
    <!-- ══ HEADER STICKY: título + buckets + acciones + filtros ══════════ -->
    <div class="sticky top-0 z-20 flex flex-col gap-2 bg-background pt-1 pb-3">
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border bg-card px-3.5 py-2"
      >
        <div class="flex items-center gap-2 text-sm font-bold text-foreground">
          <ZapIcon class="size-4 text-primary" /> Gestión de Fallas
        </div>

        <GTabs :model-value="bucket" @update:model-value="(v) => (bucket = v as BucketKey)">
          <GTabsList variant="outline">
            <GTabsTrigger v-for="b in BUCKETS" :key="b.key" :value="b.key" variant="outline">
              <component :is="b.icon" class="size-4" :style="{ color: b.color }" />
              {{ b.label }} · {{ counts[b.key] }}
            </GTabsTrigger>
          </GTabsList>
        </GTabs>

        <div class="flex items-center gap-1.5">
          <GTooltip>
            <GTooltipTrigger as-child>
              <Button variant="outline" size="sm" :disabled="loading" @click="cargar()">
                <LoaderCircleIcon v-if="loading" class="animate-spin" />
                <RefreshCwIcon v-else />
              </Button>
            </GTooltipTrigger>
            <GTooltipContent>Actualizar</GTooltipContent>
          </GTooltip>
          <Button size="sm" @click="abrirCrear"><PlusIcon /> Nueva</Button>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center gap-2 rounded-b-xl border border-t-0 bg-card px-3.5 py-2"
      >
        <InputGroup class="max-w-sm min-w-52 flex-1">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput
            ref="searchInputRef"
            v-model="search"
            placeholder="Buscar por código, descripción, proyecto, tipo..."
          />
        </InputGroup>

        <ComboBox
          v-model="filtroProyectoStr"
          :options="proyectoOpciones"
          placeholder="Proyecto"
          class="w-40"
        />

        <Select
          :model-value="filtroPrioridad || undefined"
          @update:model-value="(v) => (filtroPrioridad = (v as string) ?? '')"
        >
          <SelectTrigger size="sm" class="w-32"
            ><SelectValue placeholder="Prioridad"
          /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in catalogos.prioridades" :key="p.codigo" :value="p.codigo!">{{
              p.etiqueta
            }}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="filtroEstado || undefined"
          @update:model-value="(v) => (filtroEstado = (v as string) ?? '')"
        >
          <SelectTrigger size="sm" class="w-32"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="e in catalogos.estados" :key="e.codigo" :value="e.codigo!">{{
              e.etiqueta
            }}</SelectItem>
          </SelectContent>
        </Select>

        <DatePicker v-model="filtroFechaDesde" placeholder="Desde" clearable class="w-32" />
        <DatePicker v-model="filtroFechaHasta" placeholder="Hasta" clearable class="w-32" />

        <GTooltip v-if="hayFiltros">
          <GTooltipTrigger as-child>
            <Button variant="ghost" size="icon-sm" @click="limpiarFiltros"><XIcon /></Button>
          </GTooltipTrigger>
          <GTooltipContent>Limpiar filtros</GTooltipContent>
        </GTooltip>

        <span v-if="!loading" class="ml-auto text-xs whitespace-nowrap text-muted-foreground">
          {{ filtradas.length }} / {{ porBucket.length }}
        </span>
      </div>
    </div>

    <!-- ══ TABLA ══════════════════════════════════════════════════════════ -->
    <div class="rounded-xl border bg-card">
      <div v-if="error" class="flex items-center gap-3 p-6 text-destructive">
        <CircleAlertIcon class="size-5 shrink-0" />
        <div class="flex-1">
          <div class="font-semibold">Error al cargar</div>
          <div class="text-sm text-muted-foreground">{{ error }}</div>
        </div>
        <Button variant="outline" size="sm" @click="cargar()"><RefreshCwIcon /> Reintentar</Button>
      </div>

      <DataTable
        v-else
        :columns="columns"
        :rows="paginadas"
        row-key="id"
        :sort="sort"
        :page="pagina"
        :page-size="filasPorPagina"
        :total="ordenadas.length"
        @update:sort="(s) => (sort = s)"
        @update:page="(p) => (pagina = p)"
        @row-click="(row) => abrirDrawer(asFalla(row))"
      >
        <template #empty>
          <div class="flex flex-col items-center gap-2 py-14 text-muted-foreground">
            <component
              :is="bucketActual.icon"
              class="size-8"
              :style="{ color: bucketActual.color }"
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
        </template>

        <template #cell="{ row, column }">
          <span
            v-if="column.key === 'stripe'"
            class="block h-8 w-1 rounded-full"
            :style="{ background: prioColor(asFalla(row).prioridad?.codigo) }"
          />
          <code
            v-else-if="column.key === 'codigo'"
            class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
            >{{ asFalla(row).codigo_interno }}</code
          >
          <div v-else-if="column.key === 'falla'" class="flex items-start gap-2">
            <GTooltip>
              <GTooltipTrigger as-child>
                <span
                  class="mt-1.5 size-2 shrink-0 rounded-full"
                  :style="{ background: categoriaFalla(asFalla(row)).color }"
                />
              </GTooltipTrigger>
              <GTooltipContent>{{ categoriaFalla(asFalla(row)).etiqueta }}</GTooltipContent>
            </GTooltip>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-foreground">
                {{ tituloFalla(asFalla(row)) }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ asFalla(row).descripcion }}
              </div>
            </div>
          </div>
          <span v-else-if="column.key === 'proyecto'" class="text-sm text-foreground">{{
            asFalla(row).proyecto?.nombre_comercial || '—'
          }}</span>
          <GBadge
            v-else-if="column.key === 'prioridad'"
            :color="prioColor(asFalla(row).prioridad?.codigo)"
          >
            {{ asFalla(row).prioridad?.etiqueta || '—' }}
          </GBadge>
          <GBadge
            v-else-if="column.key === 'estado'"
            :color="colorEstado(asFalla(row).estado?.codigo)"
          >
            {{ asFalla(row).estado?.etiqueta || '—' }}
          </GBadge>
          <div v-else-if="column.key === 'fecha'" class="text-xs">
            <div class="text-foreground">{{ fmtFecha(asFalla(row).fecha_identificacion) }}</div>
            <div class="text-muted-foreground">
              {{ relativeTime(asFalla(row).fecha_identificacion) }}
            </div>
          </div>
          <div v-else-if="column.key === 'acciones'" class="flex items-center gap-0.5" @click.stop>
            <GTooltip v-if="!asFalla(row).estado?.es_estado_final">
              <GTooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="text-success hover:text-success"
                  @click="quickResolve(asFalla(row))"
                >
                  <CircleCheckIcon />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Marcar resuelta</GTooltipContent>
            </GTooltip>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button variant="ghost" size="icon-sm" @click="abrirEditar(asFalla(row))">
                  <PencilIcon />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Editar</GTooltipContent>
            </GTooltip>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button variant="ghost" size="icon-sm" @click="abrirDrawer(asFalla(row))">
                  <ArrowRightIcon />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Ver detalle</GTooltipContent>
            </GTooltip>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- ══ PANEL DETALLE (overlay) ═══════════════════════════════════════ -->
    <div v-if="drawerVisible && drawerFalla" class="fixed inset-0 z-30 flex justify-end">
      <div
        class="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        @click="drawerVisible = false"
      />
      <div
        class="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-background shadow-2xl"
      >
        <!-- Header -->
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

        <!-- Body -->
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <!-- Hero -->
          <section
            class="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5"
          >
            <p class="text-sm font-medium whitespace-pre-line text-foreground">
              {{ drawerFalla.descripcion }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <GBadge :color="colorEstado(drawerFalla.estado?.codigo)">{{
                drawerFalla.estado?.etiqueta
              }}</GBadge>
              <GBadge :color="prioColor(drawerFalla.prioridad?.codigo)">{{
                drawerFalla.prioridad?.etiqueta
              }}</GBadge>
              <GBadge
                v-if="categoriaFalla(drawerFalla).etiqueta"
                :color="categoriaFalla(drawerFalla).color || '#915BD8'"
              >
                {{ categoriaFalla(drawerFalla).etiqueta }}
              </GBadge>
            </div>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-primary/20 pt-3">
              <div class="flex flex-col gap-0.5">
                <dt
                  class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
                >
                  <BuildingIcon class="size-3" /> Proyecto
                </dt>
                <dd class="text-sm font-medium text-foreground">
                  {{ drawerFalla.proyecto?.nombre_comercial || '—' }}
                </dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt
                  class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
                >
                  <CalendarIcon class="size-3" /> Identificada
                </dt>
                <dd class="text-sm font-medium text-foreground">
                  {{ fmtFecha(drawerFalla.fecha_identificacion)
                  }}<span v-if="drawerFalla.hora_identificacion">
                    · {{ fmtHora(drawerFalla.hora_identificacion) }}</span
                  >
                  <span class="text-muted-foreground">
                    · {{ relativeTime(drawerFalla.fecha_identificacion) }}</span
                  >
                </dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt
                  class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
                >
                  <UserPenIcon class="size-3" /> Registrado por
                </dt>
                <dd class="text-sm font-medium text-foreground">
                  {{ drawerFalla.registrado_por?.nombre || '—' }}
                </dd>
              </div>
              <div v-if="drawerFalla.fecha_resolucion" class="flex flex-col gap-0.5">
                <dt
                  class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
                >
                  <CircleCheckIcon class="size-3" /> Resuelta
                </dt>
                <dd class="text-sm font-semibold text-success">
                  {{ fmtFechaHora(drawerFalla.fecha_resolucion) }}
                </dd>
              </div>
              <div v-if="drawerFalla.tiempo_afectacion_horas != null" class="flex flex-col gap-0.5">
                <dt
                  class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
                >
                  <ClockIcon class="size-3" /> Tiempo de afectación
                </dt>
                <dd class="text-sm font-semibold text-warning">
                  {{ fmtDuracion(drawerFalla.tiempo_afectacion_horas) }}
                </dd>
              </div>
              <div v-if="drawerFalla.kwh_perdidos_estimado != null" class="flex flex-col gap-0.5">
                <dt
                  class="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase"
                >
                  <ZapIcon class="size-3" /> Energía perdida
                </dt>
                <dd class="text-sm font-semibold text-destructive">
                  {{ Number(drawerFalla.kwh_perdidos_estimado).toLocaleString('es-CO') }} kWh
                </dd>
              </div>
            </dl>
          </section>

          <!-- Edición rápida + SLA -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <label class="w-16 shrink-0 text-xs font-semibold text-muted-foreground"
                    >Estado</label
                  >
                  <Select
                    :model-value="quickEdit.estado_id ? String(quickEdit.estado_id) : undefined"
                    @update:model-value="
                      (v) => {
                        quickEdit.estado_id = v ? Number(v) : null
                        autosaveQuick()
                      }
                    "
                  >
                    <SelectTrigger size="sm" class="flex-1"><SelectValue /></SelectTrigger>
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
                <div class="flex items-center gap-2">
                  <label class="w-16 shrink-0 text-xs font-semibold text-muted-foreground"
                    >Prioridad</label
                  >
                  <Select
                    :model-value="
                      quickEdit.prioridad_id ? String(quickEdit.prioridad_id) : undefined
                    "
                    @update:model-value="
                      (v) => {
                        quickEdit.prioridad_id = v ? Number(v) : null
                        autosaveQuick()
                      }
                    "
                  >
                    <SelectTrigger size="sm" class="flex-1"><SelectValue /></SelectTrigger>
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

            <section class="flex flex-col gap-1 rounded-xl border bg-muted/40 p-3.5">
              <header class="flex items-center gap-2">
                <ClockIcon class="size-3.5 text-primary" />
                <h3 class="text-sm font-bold text-foreground">SLA</h3>
                <GBadge class="ml-auto" :color="slaSeverity(drawerFalla)">{{
                  slaText(drawerFalla)
                }}</GBadge>
              </header>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="text-2xl font-extrabold" :style="{ color: slaTextColor(drawerFalla) }">
                  {{ horasTranscurridas(drawerFalla) }}h
                </span>
                <span class="text-sm font-semibold text-muted-foreground">
                  de {{ drawerFalla.sla_limite_horas_efectivo }}h
                </span>
              </div>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full transition-all"
                  :style="slaFillStyle(drawerFalla)"
                />
              </div>
            </section>
          </div>

          <!-- Acción sugerida -->
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
              <p class="text-[11px] font-bold text-warning uppercase">Acción sugerida</p>
              <p class="text-sm text-foreground">{{ drawerFalla.tipo.accion_sugerida }}</p>
            </div>
          </aside>

          <!-- Análisis -->
          <section
            v-if="drawerFalla.causa_raiz || drawerFalla.acciones_correctivas"
            class="flex flex-col gap-3 rounded-xl border p-3.5"
          >
            <header class="flex items-center gap-2">
              <SearchIcon class="size-3.5 text-primary" />
              <h3 class="text-sm font-bold text-foreground">Análisis</h3>
            </header>
            <div v-if="drawerFalla.causa_raiz">
              <p class="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                Causa raíz
              </p>
              <p class="text-sm text-foreground">{{ drawerFalla.causa_raiz }}</p>
            </div>
            <div v-if="drawerFalla.acciones_correctivas">
              <p class="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                Acciones correctivas
              </p>
              <p class="text-sm text-foreground">{{ drawerFalla.acciones_correctivas }}</p>
            </div>
          </section>

          <!-- Seguimientos -->
          <section class="flex flex-col gap-3 rounded-xl border p-3.5">
            <header class="flex items-center gap-2">
              <MessagesSquareIcon class="size-3.5 text-primary" />
              <h3 class="text-sm font-bold text-foreground">Seguimientos</h3>
              <Badge variant="secondary" class="ml-auto">{{
                drawerFalla.seguimientos?.length || 0
              }}</Badge>
            </header>

            <div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-2.5">
              <Textarea
                v-model="nuevaNota.nota"
                rows="2"
                placeholder="Agregar nota o actualización…"
              />
              <div class="flex items-center gap-2">
                <Select
                  :model-value="nuevaNota.estado_id ? String(nuevaNota.estado_id) : undefined"
                  @update:model-value="(v) => (nuevaNota.estado_id = v ? Number(v) : null)"
                >
                  <SelectTrigger size="sm" class="flex-1">
                    <SelectValue placeholder="Cambiar estado (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <LoaderCircleIcon v-if="addingSeg" class="animate-spin" />
                  <SendIcon v-else />
                  Agregar
                </Button>
              </div>
            </div>

            <div
              v-if="cargandoSeguimientos"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircleIcon class="size-3.5 animate-spin" /> Cargando seguimientos…
            </div>
            <div v-else-if="sortedSeguimientos.length" class="flex flex-col gap-3">
              <div v-for="seg in sortedSeguimientos" :key="seg.id" class="flex gap-2.5">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  :style="avatarStyle(seg.usuario)"
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
            <p v-else class="text-sm text-muted-foreground">Aún no hay seguimientos registrados.</p>
          </section>

          <!-- Acciones principales -->
          <div class="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" class="flex-1" @click="editarDesdeDrawer">
              <PencilIcon /> Editar completa
            </Button>
            <Button
              v-if="!drawerFalla.estado?.es_estado_final"
              class="text-success-foreground flex-1 bg-success hover:bg-success/90"
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
      </div>
    </div>

    <!-- ══ DIALOG CREAR / EDITAR ══════════════════════════════════════════ -->
    <Dialog v-model:open="formDialogVisible">
      <DialogContent
        class="max-h-[90dvh] max-w-2xl grid-rows-[auto_minmax(0,1fr)]"
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
            :initial="editingFalla"
            :catalogos="catalogos"
            :proyectos="proyectos"
            @save="onSaveForm"
            @cancel="formDialogVisible = false"
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- ══ DIALOG RESOLVER ═══════════════════════════════════════════════ -->
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
          <p class="text-sm text-muted-foreground">
            Vas a marcar la falla
            <strong class="text-foreground">{{ resolveFallaTarget.codigo_interno }}</strong> como
            <strong class="text-foreground">resuelta</strong>. Confirma o edita la fecha y hora de
            cierre:
          </p>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Fecha y hora de solución</Label>
            <Input
              type="datetime-local"
              :model-value="toDatetimeLocalValue(resolveFecha)"
              @update:model-value="(v) => (resolveFecha = v ? new Date(String(v)) : new Date())"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="resolvingFalla"
            @click="resolveDialogVisible = false"
          >
            Cancelar
          </Button>
          <Button
            class="text-success-foreground bg-success hover:bg-success/90"
            :disabled="resolvingFalla"
            @click="confirmarResolver"
          >
            <LoaderCircleIcon v-if="resolvingFalla" class="animate-spin" />
            <CheckIcon v-else />
            Marcar resuelta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import {
  ArrowRightIcon,
  BuildingIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  ExternalLinkIcon,
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
  Trash2Icon,
  UserPenIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
  type DataTableSort,
} from '~/components/blocks/DataTable.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import FallaForm from '~/features/fallas/components/FallaForm.vue'
import { FallasService } from '~/features/fallas/services/fallas'
import type { CatalogosFalla, Falla, PayloadFalla, PayloadFallaForm } from '~/features/fallas/types'
import { categoriaFalla, tituloFalla } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import type { ProyectoConDetalle } from '~/features/proyectos/types'

const route = useRoute()
const router = useRouter()
const fallasService = new FallasService()
// El catálogo de plantas se pide UNA vez para toda la aplicación: ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()
const confirm = useConfirm()

// ── Constantes ───────────────────────────────────────────────────────────
type BucketKey = 'activas' | 'programadas' | 'resueltas' | 'todas'
interface Bucket {
  key: BucketKey
  label: string
  icon: Component
  color: string
}
const BUCKETS: Bucket[] = [
  { key: 'activas', label: 'Activas', icon: ZapIcon, color: '#dc2626' },
  { key: 'programadas', label: 'Programadas', icon: CalendarClockIcon, color: '#2563eb' },
  { key: 'resueltas', label: 'Resueltas', icon: CircleCheckIcon, color: '#16a34a' },
  { key: 'todas', label: 'Todas', icon: ListIcon, color: '#915BD8' },
]

const AVATAR_PALETTE = [
  '#915BD8',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#0891b2',
  '#7c3aed',
  '#db2777',
]

// ── Estado base ──────────────────────────────────────────────────────────
const allFallas = ref<Falla[]>([])
const proyectos = ref<ProyectoConDetalle[]>([])
const catalogos = ref<CatalogosFalla>({ estados: [], prioridades: [], tipos: [], resoluciones: [] })

const loading = ref(false)
const error = ref<string | null>(null)

const bucket = ref<BucketKey>('todas')
// Sincronizados con la URL (?q=&proyecto=&prioridad=&estado=&desde=&hasta=) para
// que se sostengan al volver con "atrás" o al refrescar.
function queryStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
const search = ref(queryStr(route.query.q))
const filtroProyecto = ref<number | null>(
  route.query.proyecto ? Number(route.query.proyecto) : null,
)
const filtroPrioridad = ref(queryStr(route.query.prioridad))
const filtroEstado = ref(queryStr(route.query.estado))
/** `blocks/DatePicker` trabaja en ISO `yyyy-mm-dd` — igual que el query param. */
const filtroFechaDesde = ref<string | null>(queryStr(route.query.desde) || null)
const filtroFechaHasta = ref<string | null>(queryStr(route.query.hasta) || null)

/** El filtro de proyecto de la barra es un `ComboBox` (string) — `''` es "todos". */
const filtroProyectoStr = computed<string | null>({
  get: () => (filtroProyecto.value != null ? String(filtroProyecto.value) : ''),
  set: (v) => {
    filtroProyecto.value = v ? Number(v) : null
  },
})
const proyectoOpciones = computed<ComboBoxOption[]>(() => [
  { label: 'Todos los proyectos', value: '' },
  ...proyectos.value.map((p) => ({ label: p.nombre_comercial ?? '', value: String(p.id) })),
])

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

const searchInputRef = ref<{ $el?: HTMLElement } | null>(null)

// ── Drawer / detalle ─────────────────────────────────────────────────────
const drawerVisible = ref(false)
const drawerFalla = ref<Falla | null>(null)
const quickEdit = reactive<{ estado_id: number | null; prioridad_id: number | null }>({
  estado_id: null,
  prioridad_id: null,
})
const savingQuick = ref(false)
const savedFlash = ref(false)
const resolvingFalla = ref(false)
const resolveDialogVisible = ref(false)
const resolveFallaTarget = ref<Falla | null>(null)
const resolveFecha = ref(new Date())
const addingSeg = ref(false)
const nuevaNota = reactive<{ nota: string; estado_id: number | null }>({
  nota: '',
  estado_id: null,
})

// ── Dialog formulario ────────────────────────────────────────────────────
const formDialogVisible = ref(false)
const editingFalla = ref<Falla | null>(null)
const savingForm = ref(false)

// ── Computed: buckets/filtros ────────────────────────────────────────────
const hoy = new Date()
hoy.setHours(0, 0, 0, 0)

function bucketDeFalla(f: Falla): BucketKey {
  if (f.estado?.es_estado_final) return 'resueltas'
  const fid = f.fecha_identificacion ? new Date(f.fecha_identificacion + 'T00:00:00') : null
  if (fid && fid.getTime() > hoy.getTime()) return 'programadas'
  return 'activas'
}

const counts = computed(() => {
  const c: Record<BucketKey, number> = {
    activas: 0,
    programadas: 0,
    resueltas: 0,
    todas: allFallas.value.length,
  }
  for (const f of allFallas.value) c[bucketDeFalla(f)]++
  return c
})

const porBucket = computed(() => {
  if (bucket.value === 'todas') return allFallas.value
  return allFallas.value.filter((f) => bucketDeFalla(f) === bucket.value)
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
    const desde = filtroFechaDesde.value
    arr = arr.filter((f) => f.fecha_identificacion && f.fecha_identificacion >= desde)
  }
  if (filtroFechaHasta.value) {
    const hasta = filtroFechaHasta.value
    arr = arr.filter((f) => f.fecha_identificacion && f.fecha_identificacion <= hasta)
  }
  return arr
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
  programadas: 'Sin fallas programadas',
  resueltas: 'Sin fallas resueltas',
  todas: 'No hay fallas registradas',
}
const EMPTY_SUBTITULO: Record<BucketKey, string> = {
  activas: 'Todas las incidencias están bajo control',
  programadas: 'No hay intervenciones planificadas a futuro',
  resueltas: 'Aún no se han cerrado fallas',
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

// Índice de la falla actual del panel en la lista filtrada (para navegación)
const navIndex = computed(() => {
  if (!drawerFalla.value) return -1
  return filtradas.value.findIndex((f) => f.id === drawerFalla.value!.id)
})

function navegar(delta: number) {
  if (!filtradas.value.length) return
  const cur = navIndex.value
  if (cur < 0) return
  const next = Math.max(0, Math.min(filtradas.value.length - 1, cur + delta))
  if (next === cur) return
  abrirDrawer(filtradas.value[next]!)
}

// ── Tabla (paginación/orden en cliente) ──────────────────────────────────
const columns: DataTableColumn[] = [
  { key: 'stripe', header: '', class: 'w-1 p-0' },
  { key: 'codigo', header: 'Código', sortable: true },
  { key: 'falla', header: 'Falla' },
  { key: 'proyecto', header: 'Proyecto' },
  { key: 'prioridad', header: 'Prioridad' },
  { key: 'estado', header: 'Estado' },
  { key: 'fecha', header: 'Fecha', sortable: true },
  { key: 'acciones', header: '' },
]
const sort = ref<DataTableSort | null>(null)
const pagina = ref(1)
const filasPorPagina = ref(25)

const ordenadas = computed(() => {
  if (!sort.value) return filtradas.value
  const { key, direction } = sort.value
  const factor = direction === 'asc' ? 1 : -1
  return [...filtradas.value].sort((a, b) => {
    const av = key === 'fecha' ? (a.fecha_identificacion ?? '') : (a.codigo_interno ?? '')
    const bv = key === 'fecha' ? (b.fecha_identificacion ?? '') : (b.codigo_interno ?? '')
    if (av === bv) return 0
    return av < bv ? -factor : factor
  })
})
const paginadas = computed(() => {
  const inicio = (pagina.value - 1) * filasPorPagina.value
  return ordenadas.value.slice(inicio, inicio + filasPorPagina.value)
})
watch(filtradas, () => {
  pagina.value = 1
})
function asFalla(row: DataTableRow): Falla {
  return row as unknown as Falla
}

// ── Carga ────────────────────────────────────────────────────────────────

/** Cuánto historial de fallas CERRADAS se trae sin que nadie lo pida. */
const DIAS_HISTORIAL = 90

/** Desde qué fecha están cargadas las cerradas (`yyyy-mm-dd`). */
const ventanaDesde = ref<string | null>(null)

/**
 * `YYYY-MM-DD` de una fecha LOCAL.
 *
 * No `toISOString()`: eso pasa por UTC, y la medianoche local de Bogotá
 * (UTC-5) es el mismo día, pero en un navegador al este de Greenwich sería el
 * día anterior. Acá ese número decide qué se le pide al servidor.
 */
function fechaLocalISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
function haceDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return fechaLocalISO(d)
}

async function cargar(desde: string | null = null) {
  loading.value = true
  error.value = null
  const inicio = desde ?? haceDias(DIAS_HISTORIAL)
  try {
    // Dos peticiones con sentido, no muchas: de las fallas vivas, la gran
    // mayoría están CERRADAS. Traer solo las activas + una ventana de
    // cerradas evita pedir miles de filas para mostrar un puñado de abiertas.
    const [abiertas, cerradas] = await Promise.all([
      fallasService.listar({ solo_activas: true, size: 500 }),
      fallasService.listar({ fecha_identificacion_desde: inicio, size: 500 }),
    ])
    // Se solapan —una falla abierta identificada dentro de la ventana llega en
    // las dos— así que se unen por id.
    const porId = new Map<number, Falla>()
    for (const f of [...(abiertas.items ?? []), ...(cerradas.items ?? [])]) {
      porId.set(f.id, f)
    }
    allFallas.value = [...porId.values()]
    ventanaDesde.value = inicio
  } catch (err) {
    error.value = normalizeError(err).message
  } finally {
    loading.value = false
  }
}

// Pedir una fecha anterior a la cargada trae ese tramo del histórico. Al
// revés no: estrechar el filtro se resuelve en el navegador, sin ir a la red.
watch(filtroFechaDesde, (nueva) => {
  if (nueva && ventanaDesde.value && nueva < ventanaDesde.value) cargar(nueva)
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
    proyectos.value = await catalogoProyectos.cargar()
  } catch {
    /* no crítico */
  }
}

// ── Acciones ─────────────────────────────────────────────────────────────
function limpiarFiltros() {
  search.value = ''
  filtroProyecto.value = null
  filtroPrioridad.value = ''
  filtroEstado.value = ''
  filtroFechaDesde.value = null
  filtroFechaHasta.value = null
}

// El listado (GET /fallas) no trae seguimientos/intervalos/inversores_afectados
// -- forzaría un lazy-load por fila en el backend. Se completan aparte al abrir
// el detalle puntual.
const cargandoSeguimientos = ref(false)

async function abrirDrawer(falla: Falla) {
  drawerFalla.value = falla
  quickEdit.estado_id = falla.estado?.id ?? null
  quickEdit.prioridad_id = falla.prioridad?.id ?? null
  nuevaNota.nota = ''
  nuevaNota.estado_id = null
  drawerVisible.value = true

  cargandoSeguimientos.value = true
  try {
    const data = await fallasService.obtener(falla.id)
    if (drawerFalla.value?.id === falla.id) drawerFalla.value = data
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
  } catch {
    // no crítico -- el drawer ya muestra los datos livianos del listado
  } finally {
    cargandoSeguimientos.value = false
  }
}

function abrirCrear() {
  editingFalla.value = null
  formDialogVisible.value = true
}

function abrirEditar(falla: Falla) {
  editingFalla.value = falla
  formDialogVisible.value = true
}

function editarDesdeDrawer() {
  if (!drawerFalla.value) return
  editingFalla.value = drawerFalla.value
  formDialogVisible.value = true
}

async function onSaveForm(payload: PayloadFallaForm) {
  savingForm.value = true
  try {
    if (editingFalla.value) {
      const { nota_inicial: notaInicial, _archivos, ...patchPayload } = payload
      void _archivos
      await fallasService.actualizar(editingFalla.value.id, patchPayload)
      if (notaInicial) {
        fallasService.crearSeguimiento(editingFalla.value.id, { nota: notaInicial }).catch(() => {})
      }
      toast.success('Falla actualizada', { duration: 2500 })
    } else {
      // Al crear: puede venir proyecto_ids (array) → una falla por proyecto
      const { proyecto_ids, nota_inicial, _archivos: _archivosCrear, ...basePayload } = payload
      void _archivosCrear
      const ids = proyecto_ids?.length ? proyecto_ids : [basePayload.proyecto_id].filter(Boolean)
      if (!ids.length) throw new Error('Selecciona al menos un proyecto')
      const created: Falla[] = []
      for (const pid of ids) {
        const nueva = await fallasService.crear({
          ...basePayload,
          proyecto_id: pid,
        } as PayloadFalla)
        created.push(nueva)
        // La nota inicial se agrega por separado — no bloquea el guardado si falla
        if (nota_inicial) {
          fallasService.crearSeguimiento(nueva.id, { nota: nota_inicial }).catch(() => {})
        }
      }
      toast.success(
        created.length > 1 ? `${created.length} fallas registradas` : 'Falla registrada',
        {
          duration: 2500,
        },
      )
    }
    formDialogVisible.value = false
    await cargar()
    // Si el drawer estaba abierto, refrescar su contenido
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

// Autosave quick-edit con debounce
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
function autosaveQuick() {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => guardarQuickEdit(), 350)
}

async function guardarQuickEdit() {
  if (!drawerFalla.value) return
  const payload: PayloadFalla = {}
  if (quickEdit.estado_id !== drawerFalla.value.estado?.id) payload.estado_id = quickEdit.estado_id
  if (quickEdit.prioridad_id !== drawerFalla.value.prioridad?.id)
    payload.prioridad_id = quickEdit.prioridad_id
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
    // Revertir UI
    quickEdit.estado_id = drawerFalla.value.estado?.id ?? null
    quickEdit.prioridad_id = drawerFalla.value.prioridad?.id ?? null
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
  resolveDialogVisible.value = true
}

async function confirmarResolver() {
  const falla = resolveFallaTarget.value
  if (!falla) return
  const estadoFinal = catalogos.value.estados.find((e) => e.es_estado_final)
  if (!estadoFinal) return
  resolvingFalla.value = true
  try {
    const data = await fallasService.actualizar(falla.id, {
      estado_id: estadoFinal.id,
      fecha_resolucion: resolveFecha.value.toISOString(),
      sla_cumplido: !slaVencido(falla),
    })
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    if (drawerFalla.value?.id === data.id) drawerFalla.value = data
    resolveDialogVisible.value = false
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
    await fallasService.crearSeguimiento(drawerFalla.value.id, {
      nota: nuevaNota.nota.trim() || undefined,
      estado_nuevo_id: nuevaNota.estado_id ?? undefined,
    })
    nuevaNota.nota = ''
    nuevaNota.estado_id = null
    // Refrescar la falla del drawer
    const data = await fallasService.obtener(drawerFalla.value.id)
    drawerFalla.value = data
    const idx = allFallas.value.findIndex((f) => f.id === data.id)
    if (idx >= 0) allFallas.value[idx] = data
    quickEdit.estado_id = data.estado?.id ?? null
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

// ── Helpers visuales ─────────────────────────────────────────────────────
function prioColor(codigo?: string | null): string {
  return colorPrioridad(codigo, '#9ca3af')
}

function initials(nombre?: string): string {
  if (!nombre) return '?'
  const parts = nombre.trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

function avatarStyle(user?: { id?: number; nombre?: string } | null) {
  if (!user) return { background: '#9ca3af' }
  const id = user.id ?? hashCode(user.nombre || '')
  const color = AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length]
  return { background: color }
}

function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return h
}

// El reloj del SLA lo calcula el backend: `sla_horas_transcurridas` y `sla_pct`
// vienen del serializer de fallas. Esta vista solo los LEE.
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
function slaFillStyle(falla: Falla) {
  const p = Math.min(slaPct(falla) ?? 0, 100)
  return { width: `${p}%`, background: slaTextColor(falla) }
}
function slaTextColor(falla: Falla): string {
  if (falla.sla_cumplido === true) return '#16a34a'
  if (falla.sla_cumplido === false) return '#dc2626'
  const p = slaPct(falla)
  if (p == null) return '#9ca3af'
  if (p >= 100) return '#dc2626'
  if (p >= 70) return '#d97706'
  return '#16a34a'
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
  if (c === '#16a34a') return 'success'
  if (c === '#dc2626') return 'destructive'
  if (c === '#d97706') return 'warning'
  return 'default'
}

function fmtFecha(d?: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Fecha + hora (para fechas con timestamp completo, ej. resolución). */
function fmtFechaHora(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "08:30" / "08:30:00" → "08:30". */
function fmtHora(h?: string | null): string {
  if (!h) return ''
  return String(h).slice(0, 5)
}

/** Horas decimales → "1 d 4 h", "3 h 30 min", "45 min". */
function fmtDuracion(horas?: number | null): string {
  if (horas == null || horas < 0) return '—'
  const totalMin = Math.round(horas * 60)
  if (totalMin === 0) return '0 min'
  const dias = Math.floor(totalMin / 1440)
  const hrs = Math.floor((totalMin % 1440) / 60)
  const min = totalMin % 60
  const parts: string[] = []
  if (dias) parts.push(`${dias} d`)
  if (hrs) parts.push(`${hrs} h`)
  if (min) parts.push(`${min} min`)
  return parts.join(' ')
}

function relativeTime(d?: string | null): string {
  if (!d) return ''
  const date = typeof d === 'string' && d.length === 10 ? new Date(d + 'T00:00:00') : new Date(d)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 0) {
    const future = Math.abs(diff)
    return future < 86400 ? `en ${Math.floor(future / 3600)}h` : `en ${Math.floor(future / 86400)}d`
  }
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 30) return `hace ${Math.floor(diff / 86400)}d`
  if (diff < 86400 * 365) return `hace ${Math.floor(diff / (86400 * 30))}m`
  return `hace ${Math.floor(diff / (86400 * 365))}a`
}

/** Formato local para `<input type="datetime-local">`: `YYYY-MM-DDTHH:mm` en hora del navegador. */
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Montado + teclado ────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
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

onMounted(() => {
  cargar()
  cargarCatalogos()
  cargarProyectos()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// Limpiar drawer al cerrar
watch(drawerVisible, (val) => {
  if (!val) {
    setTimeout(() => {
      drawerFalla.value = null
    }, 200)
  }
})

// Si el usuario cambia de bucket y la falla abierta NO pertenece al nuevo bucket,
// cerrar el panel para evitar inconsistencias (ej: viendo una activa y cambias a resueltas).
watch(bucket, (newBucket) => {
  if (!drawerVisible.value || !drawerFalla.value) return
  if (newBucket === 'todas') return
  if (bucketDeFalla(drawerFalla.value) !== newBucket) drawerVisible.value = false
})
</script>
