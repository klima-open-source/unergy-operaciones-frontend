<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-4 pb-16">
    <!-- ══ LISTA DE PROYECTOS ══════════════════════════════════════════════ -->
    <div v-if="!seleccion" class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FileTextIcon class="size-4 text-primary" />
          <h1 class="text-lg font-extrabold text-foreground">Informe de Puesta en Marcha</h1>
          <Badge variant="secondary">{{ proyectos.length }}</Badge>
        </div>
        <Button variant="outline" size="sm" :disabled="loadingLista" @click="cargarLista">
          <LoaderCircleIcon v-if="loadingLista" class="animate-spin" />
          <RefreshCwIcon v-else />
          Actualizar
        </Button>
      </div>

      <InputGroup class="max-w-sm">
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput v-model="busqueda" placeholder="Buscar proyecto…" />
      </InputGroup>

      <div
        v-if="loadingLista"
        class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
      >
        <LoaderCircleIcon class="size-4 animate-spin" /> Cargando proyectos…
      </div>
      <div
        v-else-if="!proyectosFiltrados.length"
        class="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground"
      >
        <InboxIcon class="size-8 text-muted-foreground/50" />
        <p class="text-sm">
          {{
            proyectos.length
              ? 'Sin resultados'
              : 'No hay minigranjas en operación con servicio de operación'
          }}
        </p>
      </div>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="p in proyectosFiltrados"
          :key="p.id"
          class="cursor-pointer gap-3 transition-colors hover:border-primary"
          @click="abrir(p.id)"
        >
          <CardHeader>
            <CardTitle class="min-w-0 text-sm"
              ><TruncatedText :text="p.nombre_comercial"
            /></CardTitle>
            <CardAction>
              <GBadge :color="estadoProyectoColor(p)" size="sm">{{
                estadoProyectoLabel(p)
              }}</GBadge>
            </CardAction>
          </CardHeader>
          <CardContent class="flex flex-col gap-1 text-xs text-muted-foreground">
            <span v-if="p.municipio || p.departamento">
              <MapPinIcon class="mr-1 inline size-3.5" />
              {{ [p.municipio, p.departamento].filter(Boolean).join(', ') }}
            </span>
            <span v-if="p.potencia_ac_kw">
              <ZapIcon class="mr-1 inline size-3.5" />
              {{ fmtCapacidad(p.potencia_ac_kw) }}
            </span>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- ══ FICHA DE DETALLE ═══════════════════════════════════════════════ -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-if="loadingFicha"
        class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
      >
        <LoaderCircleIcon class="size-4 animate-spin" /> Cargando informe…
      </div>

      <template v-else>
        <div
          class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background py-2"
        >
          <Button variant="ghost" size="sm" @click="cerrar"> <ArrowLeftIcon /> Proyectos </Button>
          <div class="flex flex-wrap items-center gap-2">
            <span v-if="dirty" class="text-xs font-semibold text-warning">
              Cambios sin guardar
            </span>
            <Button
              variant="outline"
              size="sm"
              :disabled="exportandoPdf"
              title="Descargar PDF"
              @click="descargarPdf"
            >
              <LoaderCircleIcon v-if="exportandoPdf" class="animate-spin" />
              <FileTextIcon v-else />
              {{ exportandoPdf ? 'Generando…' : 'Descargar PDF' }}
            </Button>
            <Button
              v-if="ficha.estado === 'borrador'"
              variant="outline"
              size="sm"
              :disabled="generandoInforme"
              title="Marca la ficha como en revisión y la guarda"
              @click="enviarARevision"
            >
              <LoaderCircleIcon v-if="generandoInforme" class="animate-spin" />
              <FilePenIcon v-else />
              {{ generandoInforme ? 'Enviando…' : 'Enviar a revisión' }}
            </Button>
            <Button size="sm" :disabled="guardando || !dirty" @click="guardar">
              <LoaderCircleIcon v-if="guardando" class="animate-spin" />
              <CheckIcon v-else />
              {{ guardando ? 'Guardando…' : 'Guardar' }}
            </Button>
          </div>
        </div>

        <!-- Encabezado -->
        <Card>
          <CardContent class="flex flex-col gap-4">
            <div>
              <h2 class="text-xl font-extrabold text-foreground">
                {{ detalle.proyecto.nombre_comercial }}
              </h2>
              <p class="text-xs text-muted-foreground">
                Informe de Puesta en Marcha · Sistema de monitoreo
              </p>
            </div>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Cliente
                </span>
                <span class="text-sm font-semibold text-foreground">
                  {{ detalle.proyecto.nombre_clientes || '—' }}
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Ubicación
                </span>
                <span class="text-sm font-semibold text-foreground">{{ ubicacion || '—' }}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Potencia AC instalada
                </span>
                <span class="text-sm font-semibold text-foreground">
                  {{ fmtCapacidad(detalle.proyecto.potencia_ac_kw) }}
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Puesta en marcha
                </span>
                <span class="text-sm font-semibold text-foreground">
                  {{ fmtFecha(ficha.fecha_inicio_operacion) || '—' }}
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Versión
                </Label>
                <Input
                  v-model="ficha.version"
                  placeholder="01 — Inicial"
                  @update:model-value="marcar"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Elaborado por
                </Label>
                <Input v-model="ficha.elaborado_por" @update:model-value="marcar" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Estado
                </Label>
                <Select v-model="ficha.estado" @update:model-value="marcar">
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="en_revision">En revisión</SelectItem>
                    <SelectItem value="aprobado">Aprobado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- KPIs -->
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card size="sm">
            <CardContent class="flex items-center gap-2.5">
              <CircleCheckIcon class="size-5 text-primary" />
              <div>
                <p class="text-lg font-extrabold text-foreground">
                  {{ detalle.kpis.pruebas_ejecutadas }}
                </p>
                <p class="text-xs font-semibold text-muted-foreground">Pruebas ejecutadas</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent class="flex items-center gap-2.5">
              <BadgeCheckIcon class="size-5 text-success" />
              <div>
                <p class="text-lg font-extrabold text-foreground">
                  {{ detalle.kpis.pruebas_conformes }}
                </p>
                <p class="text-xs font-semibold text-muted-foreground">Conformes</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent class="flex items-center gap-2.5">
              <TriangleAlertIcon
                class="size-5"
                :class="detalle.kpis.pruebas_no_conformes > 0 ? 'text-warning' : 'text-primary'"
              />
              <div>
                <p class="text-lg font-extrabold text-foreground">
                  {{ detalle.kpis.pruebas_no_conformes }}
                </p>
                <p class="text-xs font-semibold text-muted-foreground">No conformidades</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent class="flex items-center gap-2.5">
              <ZapIcon
                class="size-5"
                :class="detalle.kpis.eventos_total > 0 ? 'text-warning' : 'text-primary'"
              />
              <div>
                <p class="text-lg font-extrabold text-foreground">
                  {{ detalle.kpis.eventos_total }}
                </p>
                <p class="text-xs font-semibold text-muted-foreground">Eventos registrados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Semáforo -->
        <div
          class="flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm"
          :class="
            detalle.kpis.estado_global === 'atencion'
              ? 'border-warning/30 bg-warning/10 text-warning'
              : 'border-success/30 bg-success/10 text-success'
          "
        >
          <div class="flex items-center gap-2 font-bold">
            <TriangleAlertIcon v-if="detalle.kpis.estado_global === 'atencion'" class="size-4" />
            <CircleCheckIcon v-else class="size-4" />
            <span>
              {{ detalle.kpis.estado_global === 'atencion' ? 'ATENCIÓN' : 'OPERATIVO' }} — Con
              seguimiento activo
            </span>
          </div>
          <div class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <span>
              Pruebas: {{ detalle.kpis.pruebas_conformes }}/{{ detalle.kpis.pruebas_ejecutadas }}
              conformes
            </span>
            <span>No conformidades: {{ detalle.kpis.pruebas_no_conformes }}</span>
            <span>
              Eventos: {{ detalle.kpis.eventos_total }} ({{
                detalle.kpis.eventos_cerrados
              }}
              cerrado(s), {{ detalle.kpis.eventos_en_gestion }} en gestión)
            </span>
            <span>
              Resp: {{ ficha.datos_generales.responsable_nombre || 'Operaciones Unergy' }}
            </span>
          </div>
        </div>

        <GAccordion v-model="seccionesAbiertas" type="multiple" variant="layout">
          <!-- ─ Objetivo y alcance ─ -->
          <GAccordionItem value="objetivo">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <FlagIcon class="size-4 text-primary" /> Objetivo y Alcance
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Objetivo</Label>
                <Textarea
                  v-model="ficha.objetivo_alcance.objetivo"
                  rows="3"
                  placeholder="Documentar y certificar las actividades de..."
                  @update:model-value="marcar"
                />
              </div>
              <ListaEditable
                v-model="ficha.objetivo_alcance.alcance_items"
                label="Incluido en el alcance"
                placeholder="Ítem del alcance…"
                @update:model-value="marcar"
              />
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Datos generales ─ -->
          <GAccordionItem value="generales">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <InfoIcon class="size-4 text-primary" /> Datos Generales
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Fecha de energización</Label>
                  <Input
                    v-model="ficha.fecha_energizacion"
                    type="date"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Empresa contratista</Label>
                  <Input v-model="ficha.empresa_contratista" @update:model-value="marcar" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Cantidad de inversores</Label>
                  <p class="pt-1.5 text-sm font-semibold text-foreground">
                    {{ detalle.inversores.length }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Seguidores solares — marca</Label>
                  <Input
                    v-model="ficha.datos_generales.seguidores_marca"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Medida comercial — marca</Label>
                  <Input
                    v-model="ficha.datos_generales.medida_comercial_marca"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Medida comercial — modelo</Label>
                  <Input
                    v-model="ficha.datos_generales.medida_comercial_modelo"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Responsable del monitoreo</Label>
                  <Input
                    v-model="ficha.datos_generales.responsable_nombre"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Correo del responsable</Label>
                  <Input
                    v-model="ficha.datos_generales.responsable_email"
                    @update:model-value="marcar"
                  />
                </div>
              </div>
              <ListaEditable
                v-model="ficha.datos_generales.plataformas_monitoreo"
                label="Plataformas de monitoreo"
                placeholder="Ej. Fusion Solar"
                @update:model-value="marcar"
              />
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Inversores (solo lectura, Solenium) ─ -->
          <GAccordionItem value="inversores">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <ZapIcon class="size-4 text-primary" /> Configuración de Inversores
                <Badge variant="secondary">
                  {{ detalle.inversores.length }} · {{ fmtCapacidad(capacidadTotal) }}
                </Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FlagIcon class="size-3.5" /> Datos en vivo de Solenium.
              </p>
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Inversor</GTableHead>
                    <GTableHead>Potencia</GTableHead>
                    <GTableHead>Estado</GTableHead>
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="inv in detalle.inversores" :key="inv.id">
                    <GTableCell>{{ inv.nombre }}</GTableCell>
                    <GTableCell>{{ fmtCapacidad(inv.potencia_nominal_kw) }}</GTableCell>
                    <GTableCell>{{ inv.state || '—' }}</GTableCell>
                  </GTableRow>
                </GTableBody>
              </GTable>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Checklist de comisionamiento (editable) ─ -->
          <GAccordionItem value="sistemas">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <MonitorIcon class="size-4 text-primary" /> Estado de Sistemas
                <Badge variant="secondary">
                  {{ detalle.kpis.checklist_aprobados }}/{{ detalle.kpis.checklist_total }}
                  aprobados
                </Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-4 px-4">
              <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div class="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
                  <span class="text-muted-foreground">Fusion Solar</span>
                  <b
                    :class="
                      detalle.fusion_solar_estado === 'aprobado' ? 'text-success' : 'text-warning'
                    "
                  >
                    {{ detalle.fusion_solar_estado === 'aprobado' ? 'Aprobado' : 'Pendiente' }}
                  </b>
                </div>
                <div class="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
                  <span class="text-muted-foreground">Frontera</span>
                  <b
                    :class="
                      detalle.frontera_estado === 'aprobado' ? 'text-success' : 'text-warning'
                    "
                  >
                    {{ detalle.frontera_estado === 'aprobado' ? 'Aprobado' : 'Pendiente' }}
                  </b>
                </div>
                <div class="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
                  <span class="text-muted-foreground">Estación meteo</span>
                  <b
                    :class="
                      detalle.estacion_meteo_estado === 'aprobado' ? 'text-success' : 'text-warning'
                    "
                  >
                    {{ detalle.estacion_meteo_estado === 'aprobado' ? 'Aprobado' : 'Pendiente' }}
                  </b>
                </div>
                <div class="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-xs">
                  <span class="text-muted-foreground">Reconectador</span>
                  <b
                    :class="
                      detalle.reconectador_estado === 'aprobado' ? 'text-success' : 'text-warning'
                    "
                  >
                    {{ detalle.reconectador_estado === 'aprobado' ? 'Aprobado' : 'Pendiente' }}
                  </b>
                </div>
              </div>

              <!-- Fusion Solar -->
              <div class="flex flex-col gap-2 rounded-lg border p-3">
                <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Fusion Solar
                </p>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs text-muted-foreground">Starlink</Label>
                    <SelectEstadoChecklist
                      v-model="ficha.checklist_fusion_solar.starlink.estado"
                      @update:model-value="marcar"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs text-muted-foreground">Datos coherentes</Label>
                    <SelectEstadoChecklist
                      v-model="ficha.checklist_fusion_solar.datos_coherentes.estado"
                      @update:model-value="marcar"
                    />
                  </div>
                </div>
                <Input
                  v-if="ficha.checklist_fusion_solar.starlink.estado === 'pendiente'"
                  v-model="ficha.checklist_fusion_solar.starlink.nota"
                  placeholder="¿Qué falta de Starlink?"
                  @update:model-value="marcar"
                />
                <EvidenciaUploader
                  v-model="ficha.checklist_fusion_solar.evidencia"
                  :proyecto-id="seleccion"
                  base-path="informe-om"
                  seccion="checklist-fusion-solar"
                  @update:model-value="marcar"
                  @error="mostrarError"
                />
                <GTable v-if="ficha.checklist_fusion_solar.inversores.length">
                  <GTableHeader>
                    <GTableRow>
                      <GTableHead>Inversor</GTableHead>
                      <GTableHead>Limitado</GTableHead>
                      <GTableHead>Motivo</GTableHead>
                    </GTableRow>
                  </GTableHeader>
                  <GTableBody>
                    <GTableRow v-for="inv in ficha.checklist_fusion_solar.inversores" :key="inv.id">
                      <GTableCell>{{ inv.nombre }}</GTableCell>
                      <GTableCell>
                        <Checkbox v-model="inv.limitado" @update:model-value="marcar" />
                      </GTableCell>
                      <GTableCell>
                        <Input
                          v-if="inv.limitado"
                          v-model="inv.motivo_limitacion"
                          placeholder="Motivo"
                          @update:model-value="marcar"
                        />
                      </GTableCell>
                    </GTableRow>
                  </GTableBody>
                </GTable>
              </div>

              <!-- Frontera -->
              <div class="flex flex-col gap-2 rounded-lg border p-3">
                <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Frontera
                </p>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs text-muted-foreground">Medidor principal</Label>
                    <SelectEstadoChecklist
                      v-model="ficha.checklist_frontera.principal.estado"
                      @update:model-value="marcar"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs text-muted-foreground">Medidor de respaldo</Label>
                    <SelectEstadoChecklist
                      v-model="ficha.checklist_frontera.respaldo.estado"
                      @update:model-value="marcar"
                    />
                  </div>
                </div>
                <EvidenciaUploader
                  v-model="ficha.checklist_frontera.principal.evidencia"
                  :proyecto-id="seleccion"
                  base-path="informe-om"
                  seccion="checklist-frontera-principal"
                  @update:model-value="marcar"
                  @error="mostrarError"
                />
                <EvidenciaUploader
                  v-model="ficha.checklist_frontera.respaldo.evidencia"
                  :proyecto-id="seleccion"
                  base-path="informe-om"
                  seccion="checklist-frontera-respaldo"
                  @update:model-value="marcar"
                  @error="mostrarError"
                />
              </div>

              <!-- Estación meteorológica -->
              <div class="flex flex-col gap-2 rounded-lg border p-3">
                <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Estación meteorológica
                </p>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div v-for="item in METEO_ITEMS" :key="item.key" class="flex flex-col gap-1.5">
                    <Label class="text-xs text-muted-foreground">{{ item.label }}</Label>
                    <SelectEstadoChecklist
                      v-model="ficha.checklist_estacion_meteo[item.key].estado"
                      @update:model-value="marcar"
                    />
                  </div>
                </div>
                <EvidenciaUploader
                  v-model="ficha.checklist_estacion_meteo.reporta_datos.evidencia"
                  :proyecto-id="seleccion"
                  base-path="informe-om"
                  seccion="checklist-estacion-meteo"
                  @update:model-value="marcar"
                  @error="mostrarError"
                />
              </div>

              <!-- Reconectador -->
              <div class="flex flex-col gap-2 rounded-lg border p-3">
                <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Reconectador
                </p>
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground">¿Tiene reconectador?</Label>
                  <Select
                    :model-value="reconectadorTieneSelect"
                    @update:model-value="(v) => setReconectadorTiene(v)"
                  >
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">—</SelectItem>
                      <SelectItem value="si">Sí</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <template v-if="ficha.checklist_reconectador.tiene">
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs text-muted-foreground">En la plataforma</Label>
                      <SelectEstadoChecklist
                        v-model="ficha.checklist_reconectador.en_plataforma.estado"
                        @update:model-value="marcar"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs text-muted-foreground">Calidad de los datos</Label>
                      <SelectEstadoChecklist
                        v-model="ficha.checklist_reconectador.calidad_datos.estado"
                        @update:model-value="marcar"
                      />
                    </div>
                  </div>
                  <EvidenciaUploader
                    v-model="ficha.checklist_reconectador.evidencia"
                    :proyecto-id="seleccion"
                    base-path="informe-om"
                    seccion="checklist-reconectador"
                    @update:model-value="marcar"
                    @error="mostrarError"
                  />
                </template>
              </div>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Arquitectura de comunicación ─ -->
          <GAccordionItem value="arquitectura">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <NetworkIcon class="size-4 text-primary" /> Arquitectura de Comunicación
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Enlace principal</Label>
                  <Input
                    v-model="ficha.arquitectura_comunicacion.enlace_principal"
                    placeholder="Ej. Starlink (satelital)"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Enlaces celulares</Label>
                  <Input
                    v-model="ficha.arquitectura_comunicacion.enlaces_celulares"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Concentrador de datos</Label>
                  <Input
                    v-model="ficha.arquitectura_comunicacion.concentrador_datos"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Destino de los datos</Label>
                  <Input
                    v-model="ficha.arquitectura_comunicacion.destino_datos"
                    @update:model-value="marcar"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Sincronización horaria</Label>
                  <Input
                    v-model="ficha.arquitectura_comunicacion.sincronizacion_horaria"
                    @update:model-value="marcar"
                  />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground"
                  >Diagrama de arquitectura (Anexo)</Label
                >
                <EvidenciaUploader
                  v-model="ficha.evidencia_arquitectura"
                  :proyecto-id="seleccion"
                  base-path="informe-om"
                  seccion="arquitectura"
                  @update:model-value="marcar"
                  @error="mostrarError"
                />
              </div>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Equipos integrados ─ -->
          <GAccordionItem value="equipos">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <BoxIcon class="size-4 text-primary" /> Equipos Integrados
                <Badge variant="secondary">{{ ficha.equipos.length }}</Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Descripción</GTableHead>
                    <GTableHead>Marca</GTableHead>
                    <GTableHead>Cant.</GTableHead>
                    <GTableHead>Ubicación</GTableHead>
                    <GTableHead>N.º serie</GTableHead>
                    <GTableHead />
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="(e, i) in ficha.equipos" :key="i">
                    <GTableCell
                      ><Input
                        v-model="e.descripcion"
                        placeholder="Ej. Inversor 300 kW"
                        @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="e.marca" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input
                        v-model.number="e.cantidad"
                        type="number"
                        min="0"
                        @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input
                        v-model="e.ubicacion"
                        placeholder="Ej. Campo solar"
                        @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="e.numero_serie" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:bg-destructive/10"
                        @click="quitarFila(ficha.equipos, i)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </GTableCell>
                  </GTableRow>
                  <TableEmpty v-if="!ficha.equipos.length" :colspan="6">
                    Sin equipos. Agrega uno.
                  </TableEmpty>
                </GTableBody>
              </GTable>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                @click="
                  agregarFila(ficha.equipos, {
                    descripcion: '',
                    marca: '',
                    cantidad: 1,
                    ubicacion: '',
                    numero_serie: '',
                  })
                "
              >
                <PlusIcon class="size-3.5" /> Agregar equipo
              </Button>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Variables monitoreadas ─ -->
          <GAccordionItem value="variables">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <ChartLineIcon class="size-4 text-primary" /> Variables Monitoreadas
                <Badge variant="secondary">{{ ficha.variables_monitoreadas.length }}</Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Variable</GTableHead>
                    <GTableHead>Unidad</GTableHead>
                    <GTableHead>Fuente</GTableHead>
                    <GTableHead>Registro</GTableHead>
                    <GTableHead>Plataforma</GTableHead>
                    <GTableHead />
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="(v, i) in ficha.variables_monitoreadas" :key="i">
                    <GTableCell
                      ><Input
                        v-model="v.variable"
                        placeholder="Ej. Irradiancia"
                        @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="v.unidad" placeholder="W/m²" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="v.fuente" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="v.registro" placeholder="5 min" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="v.plataforma" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:bg-destructive/10"
                        @click="quitarFila(ficha.variables_monitoreadas, i)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </GTableCell>
                  </GTableRow>
                  <TableEmpty v-if="!ficha.variables_monitoreadas.length" :colspan="6">
                    Sin variables. Agrega una.
                  </TableEmpty>
                </GTableBody>
              </GTable>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                @click="
                  agregarFila(ficha.variables_monitoreadas, {
                    variable: '',
                    unidad: '',
                    fuente: '',
                    registro: '',
                    plataforma: '',
                  })
                "
              >
                <PlusIcon class="size-3.5" /> Agregar variable
              </Button>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Configuración del monitoreo ─ -->
          <GAccordionItem value="config">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <BellIcon class="size-4 text-primary" /> Configuración del Monitoreo
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-4 px-4">
              <div class="flex flex-col gap-2">
                <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Usuarios y destinatarios de notificación
                </p>
                <GTable>
                  <GTableHeader>
                    <GTableRow>
                      <GTableHead>Rol</GTableHead>
                      <GTableHead>Nombre</GTableHead>
                      <GTableHead>Canal</GTableHead>
                      <GTableHead>Alcance</GTableHead>
                      <GTableHead />
                    </GTableRow>
                  </GTableHeader>
                  <GTableBody>
                    <GTableRow
                      v-for="(n, i) in ficha.configuracion_monitoreo.notificaciones"
                      :key="i"
                    >
                      <GTableCell
                        ><Input
                          v-model="n.rol"
                          placeholder="Ej. Líder de operaciones"
                          @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell
                        ><Input v-model="n.nombre" @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell
                        ><Input
                          v-model="n.canal"
                          placeholder="Correo / WhatsApp"
                          @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell
                        ><Input v-model="n.alcance" @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          class="text-destructive hover:bg-destructive/10"
                          @click="quitarFila(ficha.configuracion_monitoreo.notificaciones, i)"
                        >
                          <Trash2Icon class="size-4" />
                        </Button>
                      </GTableCell>
                    </GTableRow>
                    <TableEmpty
                      v-if="!ficha.configuracion_monitoreo.notificaciones.length"
                      :colspan="5"
                    >
                      Sin destinatarios.
                    </TableEmpty>
                  </GTableBody>
                </GTable>
                <Button
                  variant="outline"
                  size="sm"
                  class="self-start"
                  @click="
                    agregarFila(ficha.configuracion_monitoreo.notificaciones, {
                      rol: '',
                      nombre: '',
                      canal: '',
                      alcance: '',
                    })
                  "
                >
                  <PlusIcon class="size-3.5" /> Agregar destinatario
                </Button>
              </div>

              <div class="flex flex-col gap-2">
                <p class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Umbrales de alarma
                </p>
                <GTable>
                  <GTableHeader>
                    <GTableRow>
                      <GTableHead>Evento</GTableHead>
                      <GTableHead>Condición</GTableHead>
                      <GTableHead>Notificación</GTableHead>
                      <GTableHead>Destinatarios</GTableHead>
                      <GTableHead />
                    </GTableRow>
                  </GTableHeader>
                  <GTableBody>
                    <GTableRow
                      v-for="(u, i) in ficha.configuracion_monitoreo.umbrales_alarma"
                      :key="i"
                    >
                      <GTableCell
                        ><Input
                          v-model="u.evento"
                          placeholder="Ej. Inversor fuera de línea"
                          @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell
                        ><Input v-model="u.condicion" @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell
                        ><Input
                          v-model="u.notificacion"
                          placeholder="Inmediata"
                          @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell
                        ><Input v-model="u.destinatarios" @update:model-value="marcar"
                      /></GTableCell>
                      <GTableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          class="text-destructive hover:bg-destructive/10"
                          @click="quitarFila(ficha.configuracion_monitoreo.umbrales_alarma, i)"
                        >
                          <Trash2Icon class="size-4" />
                        </Button>
                      </GTableCell>
                    </GTableRow>
                    <TableEmpty
                      v-if="!ficha.configuracion_monitoreo.umbrales_alarma.length"
                      :colspan="5"
                    >
                      Sin umbrales.
                    </TableEmpty>
                  </GTableBody>
                </GTable>
                <Button
                  variant="outline"
                  size="sm"
                  class="self-start"
                  @click="
                    agregarFila(ficha.configuracion_monitoreo.umbrales_alarma, {
                      evento: '',
                      condicion: '',
                      notificacion: '',
                      destinatarios: '',
                    })
                  "
                >
                  <PlusIcon class="size-3.5" /> Agregar umbral
                </Button>
              </div>

              <ListaEditable
                v-model="ficha.configuracion_monitoreo.politicas_datos"
                label="Políticas de datos"
                placeholder="Ej. Retención de históricos…"
                @update:model-value="marcar"
              />
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Protocolo de pruebas ─ -->
          <GAccordionItem value="pruebas">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <ListChecksIcon class="size-4 text-primary" /> Protocolo de Pruebas y Resultados
                <Badge variant="secondary">
                  {{ detalle.kpis.pruebas_conformes }}/{{ detalle.kpis.pruebas_ejecutadas }}
                </Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Código</GTableHead>
                    <GTableHead>Prueba</GTableHead>
                    <GTableHead>Criterio de aceptación</GTableHead>
                    <GTableHead>Resultado</GTableHead>
                    <GTableHead>Observación</GTableHead>
                    <GTableHead />
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="(p, i) in ficha.protocolo_pruebas" :key="i">
                    <GTableCell
                      ><Input v-model="p.codigo" placeholder="P-01" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="p.prueba" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="p.criterio_aceptacion" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Select
                        :model-value="aValorSelect(p.resultado)"
                        @update:model-value="
                          (val) => {
                            p.resultado = deValorSelect(val)
                            marcar()
                          }
                        "
                      >
                        <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="VALOR_SELECT_VACIO">—</SelectItem>
                          <SelectItem value="conforme">Conforme</SelectItem>
                          <SelectItem value="no_conforme">No conforme</SelectItem>
                          <SelectItem value="na">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </GTableCell>
                    <GTableCell
                      ><Input v-model="p.observacion" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:bg-destructive/10"
                        @click="quitarFila(ficha.protocolo_pruebas, i)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </GTableCell>
                  </GTableRow>
                  <TableEmpty v-if="!ficha.protocolo_pruebas.length" :colspan="6">
                    Sin pruebas. Agrega una.
                  </TableEmpty>
                </GTableBody>
              </GTable>
              <Button variant="outline" size="sm" class="self-start" @click="agregarPrueba">
                <PlusIcon class="size-3.5" /> Agregar prueba
              </Button>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Eventos operativos ─ -->
          <GAccordionItem value="eventos">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <CircleAlertIcon class="size-4 text-primary" /> Eventos Operativos y Acciones
                Correctivas
                <Badge variant="secondary">{{ ficha.eventos_operativos.length }}</Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Código</GTableHead>
                    <GTableHead>Descripción</GTableHead>
                    <GTableHead>Causa raíz</GTableHead>
                    <GTableHead>Acción correctiva</GTableHead>
                    <GTableHead>Estado</GTableHead>
                    <GTableHead />
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="(e, i) in ficha.eventos_operativos" :key="i">
                    <GTableCell
                      ><Input v-model="e.codigo" placeholder="I-01" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="e.descripcion" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="e.causa_raiz" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="e.accion_correctiva" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Select
                        :model-value="aValorSelect(e.estado)"
                        @update:model-value="
                          (val) => {
                            e.estado = deValorSelect(val)
                            marcar()
                          }
                        "
                      >
                        <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="VALOR_SELECT_VACIO">—</SelectItem>
                          <SelectItem value="abierta">Abierta</SelectItem>
                          <SelectItem value="en_gestion">En gestión</SelectItem>
                          <SelectItem value="cerrada">Cerrada</SelectItem>
                        </SelectContent>
                      </Select>
                    </GTableCell>
                    <GTableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:bg-destructive/10"
                        @click="quitarFila(ficha.eventos_operativos, i)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </GTableCell>
                  </GTableRow>
                  <TableEmpty v-if="!ficha.eventos_operativos.length" :colspan="6">
                    Sin eventos operativos registrados.
                  </TableEmpty>
                </GTableBody>
              </GTable>
              <Button variant="outline" size="sm" class="self-start" @click="agregarEvento">
                <PlusIcon class="size-3.5" /> Agregar evento
              </Button>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Pendientes ─ -->
          <GAccordionItem value="pendientes">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <ListIcon class="size-4 text-primary" /> Pendientes
                <Badge variant="secondary">{{ ficha.pendientes.length }}</Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Descripción</GTableHead>
                    <GTableHead>Responsable</GTableHead>
                    <GTableHead>Fecha compromiso</GTableHead>
                    <GTableHead>Estado</GTableHead>
                    <GTableHead />
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="(p, i) in ficha.pendientes" :key="i">
                    <GTableCell
                      ><Input v-model="p.descripcion" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="p.responsable" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="p.fecha_compromiso" type="date" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Select
                        :model-value="aValorSelect(p.estado)"
                        @update:model-value="
                          (val) => {
                            p.estado = deValorSelect(val)
                            marcar()
                          }
                        "
                      >
                        <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="VALOR_SELECT_VACIO">—</SelectItem>
                          <SelectItem value="abierto">Abierto</SelectItem>
                          <SelectItem value="en_gestion">En gestión</SelectItem>
                          <SelectItem value="cerrado">Cerrado</SelectItem>
                        </SelectContent>
                      </Select>
                    </GTableCell>
                    <GTableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:bg-destructive/10"
                        @click="quitarFila(ficha.pendientes, i)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </GTableCell>
                  </GTableRow>
                  <TableEmpty v-if="!ficha.pendientes.length" :colspan="5"
                    >Sin pendientes.</TableEmpty
                  >
                </GTableBody>
              </GTable>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                @click="
                  agregarFila(ficha.pendientes, {
                    descripcion: '',
                    responsable: '',
                    fecha_compromiso: '',
                    clasificacion: '',
                    estado: 'abierto',
                    observaciones: '',
                  })
                "
              >
                <PlusIcon class="size-3.5" /> Agregar pendiente
              </Button>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Observaciones ─ -->
          <GAccordionItem value="observaciones">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <EyeIcon class="size-4 text-primary" /> Observaciones y Estado del Sistema
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Observaciones generales</Label>
                <Textarea
                  v-model="ficha.observaciones.generales"
                  rows="4"
                  @update:model-value="marcar"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Factor pendiente (opcional)</Label>
                <Textarea
                  v-model="ficha.observaciones.factor_pendiente"
                  rows="2"
                  @update:model-value="marcar"
                />
              </div>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Recomendaciones ─ -->
          <GAccordionItem value="recomendaciones">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <ThumbsUpIcon class="size-4 text-primary" /> Recomendaciones de Operación y
                Mantenimiento
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <ListaEditable
                v-model="ficha.recomendaciones"
                placeholder="Ej. Verificación diaria del estado de comunicación…"
                @update:model-value="marcar"
              />
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Conclusión ─ -->
          <GAccordionItem value="conclusion">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <FileCheckIcon class="size-4 text-primary" /> Conclusión
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="px-4">
              <Textarea v-model="ficha.conclusion" rows="4" @update:model-value="marcar" />
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Firmas ─ -->
          <GAccordionItem value="firmas">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <PencilIcon class="size-4 text-primary" /> Aceptación y Firmas
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-3 px-4">
              <GTable>
                <GTableHeader>
                  <GTableRow>
                    <GTableHead>Nombre</GTableHead>
                    <GTableHead>Cargo</GTableHead>
                    <GTableHead>Fecha</GTableHead>
                    <GTableHead />
                  </GTableRow>
                </GTableHeader>
                <GTableBody>
                  <GTableRow v-for="(f, i) in ficha.firmas" :key="i">
                    <GTableCell
                      ><Input v-model="f.nombre" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="f.cargo" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell
                      ><Input v-model="f.fecha" type="date" @update:model-value="marcar"
                    /></GTableCell>
                    <GTableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:bg-destructive/10"
                        @click="quitarFila(ficha.firmas, i)"
                      >
                        <Trash2Icon class="size-4" />
                      </Button>
                    </GTableCell>
                  </GTableRow>
                  <TableEmpty v-if="!ficha.firmas.length" :colspan="4">Sin firmantes.</TableEmpty>
                </GTableBody>
              </GTable>
              <Button
                variant="outline"
                size="sm"
                class="self-start"
                @click="agregarFila(ficha.firmas, { nombre: '', cargo: '', fecha: '' })"
              >
                <PlusIcon class="size-3.5" /> Agregar firmante
              </Button>
            </GAccordionContent>
          </GAccordionItem>

          <!-- ─ Anexos: evidencia ─ -->
          <GAccordionItem value="anexos">
            <GAccordionTrigger>
              <span class="flex items-center gap-2">
                <ImagesIcon class="size-4 text-primary" /> Anexos — Evidencia
                <Badge variant="secondary">{{ detalle.evidencia_relacionada.length }}</Badge>
              </span>
            </GAccordionTrigger>
            <GAccordionContent class="flex flex-col gap-2 px-4">
              <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FlagIcon class="size-3.5" /> Es la misma evidencia ya subida en cada sección
                (Inversores, Frontera, Monitoreo, Estación Meteo, Reconectador) y en Arquitectura de
                Comunicación arriba — se muestra junta aquí para el informe.
              </p>
              <p
                v-if="!detalle.evidencia_relacionada.length"
                class="py-2 text-sm text-muted-foreground"
              >
                Sin evidencia subida todavía.
              </p>
              <div
                v-for="(ev, i) in detalle.evidencia_relacionada"
                :key="i"
                class="flex flex-wrap items-center gap-2 border-b py-1.5 text-sm last:border-b-0"
              >
                <Badge variant="secondary" class="shrink-0">{{ ev.seccion }}</Badge>
                <a
                  :href="ev.url"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <PaperclipIcon class="size-3.5" /> {{ ev.nombre }}
                </a>
              </div>
            </GAccordionContent>
          </GAccordionItem>
        </GAccordion>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  BellIcon,
  BoxIcon,
  ChartLineIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  FileCheckIcon,
  FilePenIcon,
  FileTextIcon,
  FlagIcon,
  ImagesIcon,
  InboxIcon,
  InfoIcon,
  ListChecksIcon,
  ListIcon,
  LoaderCircleIcon,
  MapPinIcon,
  MonitorIcon,
  NetworkIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ThumbsUpIcon,
  Trash2Icon,
  TriangleAlertIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import EvidenciaUploader from '~/features/operaciones/components/EvidenciaUploader.vue'
import ListaEditable from '~/features/operaciones/components/ListaEditable.vue'
import SelectEstadoChecklist from '~/features/operaciones/components/SelectEstadoChecklist.vue'
import { InformeOmService } from '~/features/operaciones/services/informe-om'
import type {
  ArchivoEvidencia,
  ChecklistItemConEvidenciaOm,
  ChecklistItemOm,
  DetalleInformeOm,
  EquipoOm,
  EstadoChecklistOm,
  EstadoEventoOperativoOm,
  EstadoFichaOm,
  EventoOperativoOm,
  FirmanteOm,
  InversorFichaFusionSolarOm,
  NotificacionMonitoreoOm,
  PendienteOm,
  ProyectoInformeOm,
  PruebaOm,
  ResultadoPruebaOm,
  UmbralAlarmaOm,
  VariableMonitoreadaOm,
} from '~/features/operaciones/types'

const informeOmService = new InformeOmService()

interface MeteoItem {
  key:
    | 'instalacion'
    | 'en_plataforma'
    | 'reporta_datos'
    | 'poa'
    | 'temperatura_ambiente'
    | 'velocidad_viento'
    | 'direccion_viento'
  label: string
}
const METEO_ITEMS: MeteoItem[] = [
  { key: 'instalacion', label: 'Estación instalada' },
  { key: 'en_plataforma', label: 'En la plataforma de monitoreo' },
  { key: 'reporta_datos', label: 'Reporta datos' },
  { key: 'poa', label: 'POA (irradiancia en plano del arreglo)' },
  { key: 'temperatura_ambiente', label: 'Temperatura ambiente' },
  { key: 'velocidad_viento', label: 'Velocidad del viento' },
  { key: 'direccion_viento', label: 'Dirección del viento' },
]

/** Estado local del formulario: a diferencia de `FichaInformeOm` (la forma que
 * viaja por la API, con todo opcional), acá cada campo siempre existe —
 * `fichaVacia()` es la única fuente de la forma completa. */
interface FichaCompleta {
  version: string
  elaborado_por: string
  actividad: string
  estado: EstadoFichaOm
  empresa_contratista: string
  fecha_energizacion: string
  fecha_inicio_operacion: string
  pendientes: PendienteOm[]
  checklist_fusion_solar: {
    starlink: ChecklistItemConEvidenciaOm
    datos_coherentes: ChecklistItemOm
    evidencia: ArchivoEvidencia[]
    nota: string
    inversores: InversorFichaFusionSolarOm[]
  }
  checklist_frontera: {
    principal: ChecklistItemConEvidenciaOm
    respaldo: ChecklistItemConEvidenciaOm
  }
  checklist_estacion_meteo: {
    instalacion: ChecklistItemOm
    en_plataforma: ChecklistItemOm
    reporta_datos: ChecklistItemConEvidenciaOm
    poa: ChecklistItemOm
    temperatura_ambiente: ChecklistItemOm
    velocidad_viento: ChecklistItemOm
    direccion_viento: ChecklistItemOm
  }
  checklist_reconectador: {
    tiene: boolean | null
    en_plataforma: ChecklistItemOm
    calidad_datos: ChecklistItemOm
    evidencia: ArchivoEvidencia[]
    nota: string
  }
  objetivo_alcance: { objetivo: string; alcance_items: string[] }
  datos_generales: {
    seguidores_marca: string
    medida_comercial_marca: string
    medida_comercial_modelo: string
    plataformas_monitoreo: string[]
    responsable_nombre: string
    responsable_email: string
  }
  arquitectura_comunicacion: {
    enlace_principal: string
    enlaces_celulares: string
    concentrador_datos: string
    destino_datos: string
    sincronizacion_horaria: string
  }
  equipos: EquipoOm[]
  variables_monitoreadas: VariableMonitoreadaOm[]
  configuracion_monitoreo: {
    notificaciones: NotificacionMonitoreoOm[]
    umbrales_alarma: UmbralAlarmaOm[]
    politicas_datos: string[]
  }
  protocolo_pruebas: PruebaOm[]
  eventos_operativos: EventoOperativoOm[]
  observaciones: { generales: string; factor_pendiente: string }
  recomendaciones: string[]
  conclusion: string
  firmas: FirmanteOm[]
  evidencia_arquitectura: ArchivoEvidencia[]
}

const proyectos = ref<ProyectoInformeOm[]>([])
const loadingLista = ref(false)
const busqueda = ref('')

const seleccion = ref<number | null>(null)

function detalleVacio(): DetalleInformeOm {
  return {
    proyecto: {},
    ficha: {},
    kpis: {
      pruebas_ejecutadas: 0,
      pruebas_conformes: 0,
      pruebas_no_conformes: 0,
      eventos_total: 0,
      eventos_cerrados: 0,
      eventos_en_gestion: 0,
      checklist_aprobados: 0,
      checklist_total: 4,
      estado_global: 'operativo',
    },
    inversores: [],
    evidencia_relacionada: [],
    fusion_solar_estado: null,
    frontera_estado: null,
    estacion_meteo_estado: null,
    reconectador_estado: null,
  }
}
const detalle = reactive<DetalleInformeOm>(detalleVacio())

function itemChecklist(): ChecklistItemOm {
  return { estado: null, nota: '' }
}
function itemChecklistConEvidencia(): ChecklistItemConEvidenciaOm {
  return { ...itemChecklist(), evidencia: [] }
}

function fichaVacia(): FichaCompleta {
  return {
    version: '',
    elaborado_por: 'Operaciones Unergy',
    actividad: '',
    estado: 'borrador',
    empresa_contratista: '',
    fecha_energizacion: '',
    fecha_inicio_operacion: '',
    pendientes: [],
    checklist_fusion_solar: {
      starlink: itemChecklistConEvidencia(),
      datos_coherentes: itemChecklist(),
      evidencia: [],
      nota: '',
      inversores: [],
    },
    checklist_frontera: {
      principal: itemChecklistConEvidencia(),
      respaldo: itemChecklistConEvidencia(),
    },
    checklist_estacion_meteo: {
      instalacion: itemChecklist(),
      en_plataforma: itemChecklist(),
      reporta_datos: itemChecklistConEvidencia(),
      poa: itemChecklist(),
      temperatura_ambiente: itemChecklist(),
      velocidad_viento: itemChecklist(),
      direccion_viento: itemChecklist(),
    },
    checklist_reconectador: {
      tiene: null,
      en_plataforma: itemChecklist(),
      calidad_datos: itemChecklist(),
      evidencia: [],
      nota: '',
    },
    objetivo_alcance: { objetivo: '', alcance_items: [] },
    datos_generales: {
      seguidores_marca: '',
      medida_comercial_marca: '',
      medida_comercial_modelo: '',
      plataformas_monitoreo: [],
      responsable_nombre: '',
      responsable_email: '',
    },
    arquitectura_comunicacion: {
      enlace_principal: '',
      enlaces_celulares: '',
      concentrador_datos: '',
      destino_datos: '',
      sincronizacion_horaria: '',
    },
    equipos: [],
    variables_monitoreadas: [],
    configuracion_monitoreo: { notificaciones: [], umbrales_alarma: [], politicas_datos: [] },
    protocolo_pruebas: [],
    eventos_operativos: [],
    observaciones: { generales: '', factor_pendiente: '' },
    recomendaciones: [],
    conclusion: '',
    firmas: [],
    evidencia_arquitectura: [],
  }
}

const ficha = reactive<FichaCompleta>(fichaVacia())
const loadingFicha = ref(false)
const guardando = ref(false)
const exportandoPdf = ref(false)
const generandoInforme = ref(false)
const dirty = ref(false)
const seccionesAbiertas = ref<string[]>([
  'objetivo',
  'generales',
  'pruebas',
  'eventos',
  'observaciones',
  'anexos',
])

const proyectosFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return proyectos.value
  return proyectos.value.filter((p) => (p.nombre_comercial || '').toLowerCase().includes(q))
})

function estadoProyectoLabel(p: ProyectoInformeOm): string {
  if (!p.tiene_ficha) return 'Sin iniciar'
  return p.estado_global === 'atencion' ? 'Atención' : 'Operativo'
}
function estadoProyectoColor(p: ProyectoInformeOm): GandalfBadgeColor {
  if (!p.tiene_ficha) return 'default'
  return p.estado_global === 'atencion' ? 'warning' : 'success'
}

async function cargarLista() {
  loadingLista.value = true
  try {
    proyectos.value = await informeOmService.listarProyectos()
  } catch {
    proyectos.value = []
  } finally {
    loadingLista.value = false
  }
}

async function abrir(id: number) {
  seleccion.value = id
  loadingFicha.value = true
  dirty.value = false
  try {
    const data = await informeOmService.obtener(id)
    Object.assign(detalle, data)
    const base = fichaVacia()
    const entrante = data.ficha
    Object.assign(ficha, base, entrante, {
      objetivo_alcance: { ...base.objetivo_alcance, ...entrante.objetivo_alcance },
      datos_generales: { ...base.datos_generales, ...entrante.datos_generales },
      arquitectura_comunicacion: {
        ...base.arquitectura_comunicacion,
        ...entrante.arquitectura_comunicacion,
      },
      configuracion_monitoreo: {
        notificaciones: entrante.configuracion_monitoreo?.notificaciones || [],
        umbrales_alarma: entrante.configuracion_monitoreo?.umbrales_alarma || [],
        politicas_datos: entrante.configuracion_monitoreo?.politicas_datos || [],
      },
      observaciones: { ...base.observaciones, ...entrante.observaciones },
      checklist_fusion_solar: {
        ...base.checklist_fusion_solar,
        ...entrante.checklist_fusion_solar,
        starlink: {
          ...base.checklist_fusion_solar.starlink,
          ...entrante.checklist_fusion_solar?.starlink,
        },
        datos_coherentes: {
          ...base.checklist_fusion_solar.datos_coherentes,
          ...entrante.checklist_fusion_solar?.datos_coherentes,
        },
      },
      checklist_frontera: {
        principal: {
          ...base.checklist_frontera.principal,
          ...entrante.checklist_frontera?.principal,
        },
        respaldo: {
          ...base.checklist_frontera.respaldo,
          ...entrante.checklist_frontera?.respaldo,
        },
      },
      checklist_estacion_meteo: {
        ...base.checklist_estacion_meteo,
        ...entrante.checklist_estacion_meteo,
      },
      checklist_reconectador: {
        ...base.checklist_reconectador,
        ...entrante.checklist_reconectador,
        en_plataforma: {
          ...base.checklist_reconectador.en_plataforma,
          ...entrante.checklist_reconectador?.en_plataforma,
        },
        calidad_datos: {
          ...base.checklist_reconectador.calidad_datos,
          ...entrante.checklist_reconectador?.calidad_datos,
        },
      },
    })
    // Un inversor por cada uno de los que Solenium reporta en vivo ahora --
    // preserva limitado/motivo_limitacion de los que ya se habían marcado,
    // no duplica ni deja huérfanos si la flota de inversores cambió.
    const limitadosPrevios = new Map(
      (entrante.checklist_fusion_solar?.inversores || []).map((i) => [i.id, i]),
    )
    ficha.checklist_fusion_solar.inversores = (data.inversores || []).map((inv) => ({
      id: inv.id,
      nombre: inv.nombre,
      limitado: limitadosPrevios.get(inv.id)?.limitado || false,
      motivo_limitacion: limitadosPrevios.get(inv.id)?.motivo_limitacion || '',
    }))
  } catch {
    toast.error('No se pudo cargar el informe', { duration: 3000 })
    seleccion.value = null
  } finally {
    loadingFicha.value = false
  }
}

function cerrar() {
  if (dirty.value && !confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return
  seleccion.value = null
}

async function guardar() {
  guardando.value = true
  try {
    const data = await informeOmService.guardar(seleccion.value!, ficha)
    Object.assign(detalle, data)
    dirty.value = false
    toast.success('Informe guardado', { duration: 2000 })
    cargarLista()
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message, duration: 3500 })
  } finally {
    guardando.value = false
  }
}

interface DocConAutoTable {
  lastAutoTable: { finalY: number }
}

async function descargarPdf() {
  exportandoPdf.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const { slugify } = await import('~/features/mem/components/cumplimientoAnualExport.js')

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const docConTabla = doc as unknown as DocConAutoTable
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 40
    let y = 90

    doc.setFillColor(44, 32, 57)
    doc.rect(0, 0, pageW, 64, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('UNERGY', marginX, 30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Informe de Puesta en Marcha · Sistema de monitoreo', marginX, 47)

    function checkSpace(needed: number) {
      if (y + needed > pageH - 50) {
        doc.addPage()
        y = 40
      }
    }
    function sectionTitle(text: string) {
      checkSpace(30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(110, 63, 184)
      doc.text(text, marginX, y)
      y += 16
    }
    function paragraph(text?: string) {
      if (!text) return
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(44, 32, 57)
      const lines = doc.splitTextToSize(text, pageW - marginX * 2)
      checkSpace(lines.length * 12 + 6)
      doc.text(lines, marginX, y)
      y += lines.length * 12 + 10
    }
    function bullets(items?: string[]) {
      const list = (items || []).filter(Boolean)
      if (!list.length) return
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(44, 32, 57)
      for (const item of list) {
        const lines = doc.splitTextToSize('• ' + item, pageW - marginX * 2 - 10)
        checkSpace(lines.length * 12 + 2)
        doc.text(lines, marginX + 6, y)
        y += lines.length * 12 + 2
      }
      y += 8
    }
    function tabla(head: string[], body: (string | number)[][]) {
      if (!body.length) {
        paragraph('Sin registros.')
        return
      }
      checkSpace(40)
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [head],
        body,
        headStyles: { fillColor: [145, 91, 216], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 8.5, cellPadding: 4 },
        theme: 'grid',
      })
      y = docConTabla.lastAutoTable.finalY + 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(44, 32, 57)
    doc.text(detalle.proyecto.nombre_comercial || '', marginX, y)
    y += 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(122, 110, 138)
    doc.text(
      [
        detalle.proyecto.nombre_clientes,
        ubicacion.value,
        fmtCapacidad(detalle.proyecto.potencia_ac_kw),
      ]
        .filter(Boolean)
        .join(' · '),
      marginX,
      y,
    )
    y += 14
    doc.text(
      `Versión: ${ficha.version || '—'}  ·  Elaborado por: ${ficha.elaborado_por || '—'}  ·  Puesta en marcha: ${fmtFecha(ficha.fecha_inicio_operacion) || '—'}`,
      marginX,
      y,
    )
    y += 22

    const k = detalle.kpis
    const semColor: [number, number, number] =
      k.estado_global === 'atencion' ? [253, 246, 178] : [220, 252, 231]
    const semText: [number, number, number] =
      k.estado_global === 'atencion' ? [146, 64, 14] : [21, 128, 61]
    checkSpace(44)
    doc.setFillColor(...semColor)
    doc.roundedRect(marginX, y, pageW - marginX * 2, 34, 4, 4, 'F')
    doc.setTextColor(...semText)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text(
      `${k.estado_global === 'atencion' ? 'ATENCIÓN' : 'OPERATIVO'} — Pruebas ${k.pruebas_conformes}/${k.pruebas_ejecutadas} conformes · No conformidades ${k.pruebas_no_conformes} · Eventos ${k.eventos_total} (${k.eventos_cerrados} cerrado(s))`,
      marginX + 10,
      y + 21,
    )
    y += 50

    sectionTitle('1. Objetivo y Alcance')
    paragraph(ficha.objetivo_alcance.objetivo)
    bullets(ficha.objetivo_alcance.alcance_items)

    sectionTitle('2. Datos Generales')
    paragraph(
      `Fecha de energización: ${fmtFecha(ficha.fecha_energizacion) || '—'}   ·   Empresa contratista: ${ficha.empresa_contratista || '—'}`,
    )
    paragraph(
      `Seguidores solares: ${ficha.datos_generales.seguidores_marca || '—'}   ·   Medida comercial: ${[ficha.datos_generales.medida_comercial_marca, ficha.datos_generales.medida_comercial_modelo].filter(Boolean).join(' ') || '—'}`,
    )
    paragraph(
      `Plataformas de monitoreo: ${ficha.datos_generales.plataformas_monitoreo.filter(Boolean).join(', ') || '—'}`,
    )
    paragraph(
      `Responsable: ${ficha.datos_generales.responsable_nombre || '—'} (${ficha.datos_generales.responsable_email || '—'})`,
    )

    sectionTitle('3. Configuración de Inversores')
    tabla(
      ['Inversor', 'Potencia', 'Estado'],
      detalle.inversores.map((i) => [
        i.nombre || '',
        fmtCapacidad(i.potencia_nominal_kw),
        i.state || '—',
      ]),
    )

    sectionTitle('4. Estado de Sistemas')
    const estLbl = (v?: EstadoChecklistOm | null) => (v === 'aprobado' ? 'Aprobado' : 'Pendiente')
    paragraph(
      `Fusion Solar: ${estLbl(detalle.fusion_solar_estado)}   ·   Frontera: ${estLbl(detalle.frontera_estado)}   ·   Estación meteo: ${estLbl(detalle.estacion_meteo_estado)}   ·   Reconectador: ${estLbl(detalle.reconectador_estado)}`,
    )

    sectionTitle('5. Arquitectura de Comunicación')
    const ac = ficha.arquitectura_comunicacion
    paragraph(
      `Enlace principal: ${ac.enlace_principal || '—'}   ·   Enlaces celulares: ${ac.enlaces_celulares || '—'}`,
    )
    paragraph(
      `Concentrador de datos: ${ac.concentrador_datos || '—'}   ·   Destino de los datos: ${ac.destino_datos || '—'}`,
    )
    paragraph(`Sincronización horaria: ${ac.sincronizacion_horaria || '—'}`)

    sectionTitle('6. Equipos Integrados')
    tabla(
      ['Descripción', 'Marca', 'Cant.', 'Ubicación', 'N.º serie'],
      ficha.equipos.map((e) => [e.descripcion, e.marca, e.cantidad, e.ubicacion, e.numero_serie]),
    )

    sectionTitle('7. Variables Monitoreadas')
    tabla(
      ['Variable', 'Unidad', 'Fuente', 'Registro', 'Plataforma'],
      ficha.variables_monitoreadas.map((v) => [
        v.variable,
        v.unidad,
        v.fuente,
        v.registro,
        v.plataforma,
      ]),
    )

    sectionTitle('8. Configuración del Monitoreo')
    paragraph('Usuarios y destinatarios de notificación:')
    tabla(
      ['Rol', 'Nombre', 'Canal', 'Alcance'],
      ficha.configuracion_monitoreo.notificaciones.map((n) => [
        n.rol,
        n.nombre,
        n.canal,
        n.alcance,
      ]),
    )
    paragraph('Umbrales de alarma:')
    tabla(
      ['Evento', 'Condición', 'Notificación', 'Destinatarios'],
      ficha.configuracion_monitoreo.umbrales_alarma.map((u) => [
        u.evento,
        u.condicion,
        u.notificacion,
        u.destinatarios,
      ]),
    )
    bullets(ficha.configuracion_monitoreo.politicas_datos)

    sectionTitle('9. Protocolo de Pruebas y Resultados')
    tabla(
      ['Código', 'Prueba', 'Criterio', 'Resultado', 'Observación'],
      ficha.protocolo_pruebas.map((p) => [
        p.codigo,
        p.prueba,
        p.criterio_aceptacion,
        p.resultado === 'conforme'
          ? 'Conforme'
          : p.resultado === 'no_conforme'
            ? 'No conforme'
            : p.resultado || '—',
        p.observacion,
      ]),
    )

    sectionTitle('10. Eventos Operativos y Acciones Correctivas')
    tabla(
      ['Código', 'Descripción', 'Causa raíz', 'Acción correctiva', 'Estado'],
      ficha.eventos_operativos.map((e) => [
        e.codigo,
        e.descripcion,
        e.causa_raiz,
        e.accion_correctiva,
        e.estado,
      ]),
    )

    sectionTitle('11. Pendientes')
    tabla(
      ['Descripción', 'Responsable', 'Estado'],
      ficha.pendientes.map((p) => [p.descripcion, p.responsable, p.estado || 'abierto']),
    )

    sectionTitle('12. Observaciones y Estado del Sistema')
    paragraph(ficha.observaciones.generales)
    if (ficha.observaciones.factor_pendiente)
      paragraph('Factor pendiente: ' + ficha.observaciones.factor_pendiente)

    sectionTitle('13. Recomendaciones de Operación y Mantenimiento')
    bullets(ficha.recomendaciones)

    sectionTitle('14. Conclusión')
    paragraph(ficha.conclusion)

    sectionTitle('15. Aceptación y Firmas')
    tabla(
      ['Nombre', 'Cargo', 'Fecha'],
      ficha.firmas.map((f) => [f.nombre, f.cargo, fmtFecha(f.fecha) || '—']),
    )

    sectionTitle('16. Anexos — Evidencia')
    if (!detalle.evidencia_relacionada.length) {
      paragraph('Sin evidencia subida todavía.')
    } else {
      for (const ev of detalle.evidencia_relacionada) {
        checkSpace(14)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(107, 90, 138)
        doc.text(`${ev.seccion}:`, marginX, y)
        const labelW = doc.getTextWidth(`${ev.seccion}: `)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(110, 63, 184)
        doc.textWithLink(ev.nombre, marginX + labelW, y, { url: ev.url })
        y += 13
      }
      y += 8
    }

    const pageCount = doc.getNumberOfPages()
    const fechaGen = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Generado el ${fechaGen} · Unergy`, marginX, pageH - 20)
      doc.text(`Página ${p} de ${pageCount}`, pageW - marginX - 60, pageH - 20)
    }

    const slug = slugify(detalle.proyecto.nombre_comercial || 'informe').toLowerCase()
    doc.save(`informe_puesta_en_marcha_${slug}.pdf`)
  } catch (err) {
    logger.error('operaciones', err)
    toast.error('No se pudo generar el PDF', { duration: 3500 })
  } finally {
    exportandoPdf.value = false
  }
}

// ── Enviar a revisión ────────────────────────────────────────────────────
// Antes esto mandaba una foto HTML congelada al sistema genérico de
// InformeGuardado (compartido con Mensuales/Portafolio/Ranking, revisor
// hardcodeado por email, desconectado de esta ficha) -- ahora el estado
// vive en la propia ficha y "Descargar PDF" siempre arma el documento con
// el contenido actual, no una foto vieja (ver plan de reestructuración,
// 2026-08-31).
async function enviarARevision() {
  generandoInforme.value = true
  ficha.estado = 'en_revision'
  try {
    await guardar()
  } finally {
    generandoInforme.value = false
  }
}

function marcar() {
  dirty.value = true
}
function mostrarError(msg: string) {
  toast.error(msg, { duration: 3500 })
}
function agregarFila<T>(lista: T[], plantilla: T) {
  lista.push({ ...plantilla })
  marcar()
}
function quitarFila<T>(lista: T[], i: number) {
  lista.splice(i, 1)
  marcar()
}
function agregarPrueba() {
  const codigo = `P-${String(ficha.protocolo_pruebas.length + 1).padStart(2, '0')}`
  agregarFila<PruebaOm>(ficha.protocolo_pruebas, {
    codigo,
    prueba: '',
    criterio_aceptacion: '',
    resultado: '' as ResultadoPruebaOm,
    observacion: '',
  })
}
function agregarEvento() {
  const codigo = `I-${String(ficha.eventos_operativos.length + 1).padStart(2, '0')}`
  agregarFila<EventoOperativoOm>(ficha.eventos_operativos, {
    codigo,
    descripcion: '',
    causa_raiz: '',
    accion_correctiva: '',
    estado: 'abierta' as EstadoEventoOperativoOm,
  })
}

/** El `<select>` nativo original tenía 3 estados (sí/no/sin definir); el `Select`
 * de shadcn solo trabaja con strings, así que se traduce acá. */
const reconectadorTieneSelect = computed(() => {
  if (ficha.checklist_reconectador.tiene === true) return 'si'
  if (ficha.checklist_reconectador.tiene === false) return 'no'
  return 'null'
})
function setReconectadorTiene(valor: unknown) {
  ficha.checklist_reconectador.tiene = valor === 'si' ? true : valor === 'no' ? false : null
  marcar()
}

const capacidadTotal = computed(() =>
  detalle.inversores.reduce((s, i) => s + (Number(i.potencia_nominal_kw) || 0), 0),
)
const ubicacion = computed(() =>
  [detalle.proyecto.municipio, detalle.proyecto.departamento, detalle.proyecto.direccion_vereda]
    .filter(Boolean)
    .join(', '),
)

function fmtCapacidad(kwp?: number | null) {
  const n = Number(kwp)
  if (!n) return '—'
  return n >= 1000 ? (n / 1000).toFixed(2) + ' MW' : n.toLocaleString('es-CO') + ' kW'
}
function fmtFecha(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(cargarLista)
</script>
