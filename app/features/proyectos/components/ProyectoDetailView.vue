<template>
  <div v-if="proyecto">
    <DetalleLayout :volver="{ to: '/servicios-unificado?vista=proyectos', label: 'Proyectos' }"
                   :titulo="proyecto.nombre_comercial"
                   :codigo="proyecto.codigo_tsf || ''"
                   :tabs="TABS" v-model="activeTab">
      <!-- En modo edicion, nombre y estado se editan en la misma miga -->
      <template v-if="isEditMode" #titulo>
        <Input v-model="editForm.nombre_comercial" class="h-8 w-64" />
        <Select v-model="editForm.estado">
          <SelectTrigger size="sm" class="min-w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="e in ESTADOS" :key="e.value" :value="e.value">{{ e.label }}</SelectItem>
          </SelectContent>
        </Select>
      </template>
      <template v-if="!isEditMode" #chips>
        <GBadge :color="estadoSeverity(proyecto.estado)" class="text-xs">{{ proyecto.estado }}</GBadge>
      </template>
      <template #acciones>
        <template v-if="isEditMode">
          <Button variant="outline" size="sm" @click="cancelEdit">Cancelar</Button>
          <Button size="sm" :disabled="guardando" @click="saveEdit"><Spinner v-if="guardando" class="size-4" /> <CheckIcon v-else class="size-4" /> Guardar cambios</Button>
        </template>
        <template v-else>
          <!-- Trae de TSF lo que difiera (técnico, simulación, ECS…) y deja elegir qué aplicar. -->
          <SincronizarTsf v-if="unergyAuth" :proyecto="proyecto" @actualizado="recargarProyecto" />
          <Button variant="outline" size="sm" @click="enterEditMode"><PencilIcon class="size-4" /> Editar</Button>
        </template>
      </template>
      <template #default="{ tab }">
      <!-- ══ GENERAL ══ -->
      <div v-if="tab === 'general'">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <template v-if="!isEditMode">
            <InfoField label="Tipo" :value="proyecto.tipo_proyecto" />
            <InfoField label="Tecnología" :value="proyecto.tipo_tecnologia" />
            <InfoField label="Capacidad instalada (kWp)" :value="proyecto.info_tecnica?.capacidad_instalada_kwp" />
            <InfoField label="Departamento" :value="proyecto.departamento" />
            <InfoField label="Municipio" :value="proyecto.municipio" />
            <!-- Dirección y mapa, junto al resto de la ubicación. Estaban en la
                 pestaña Técnico, lejos de Departamento y Municipio. -->
            <div class="flex flex-col gap-1">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Ubicación</p>
              <p v-if="proyecto.direccion_vereda" class="text-foreground">{{ proyecto.direccion_vereda }}</p>
              <a v-if="proyecto.info_tecnica?.url_ubicacion" :href="proyecto.info_tecnica.url_ubicacion"
                 target="_blank" rel="noopener"
                 class="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                <MapPinIcon class="size-4" /> Ver en Google Maps
              </a>
              <span v-if="!proyecto.direccion_vereda && !proyecto.info_tecnica?.url_ubicacion"
                    class="text-muted-foreground">—</span>
            </div>
            <InfoField label="Operador de red" :value="proyecto.operador_red_legal || proyecto.operador_red" />
            <InfoField label="Clasificación" :value="proyecto.clasificacion_regulatoria" />
            <InfoField label="Carpeta Drive" :value="proyecto.carpeta_drive_codigo" />
            <InfoField label="API ID Unergy" :value="proyecto.sub_project" />
            <InfoField label="Código TSF" :value="proyecto.codigo_tsf" />
            <!-- ECS (Estudio de Conexión Simplificado) de TSF: lo trae «Sincronizar con TSF». -->
            <div v-if="proyecto.ecs_estado || proyecto.ecs_codigo_insumo" class="flex flex-col gap-1">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">ECS</p>
              <p>{{ proyecto.ecs_estado || '—' }}<span v-if="proyecto.ecs_codigo_insumo" class="text-muted-foreground"> · insumo {{ proyecto.ecs_codigo_insumo }}</span></p>
              <p class="text-xs text-muted-foreground">
                <template v-if="proyecto.ecs_vencimiento">Vence {{ fmtFecha(proyecto.ecs_vencimiento) }}</template>
                <a v-if="proyecto.ecs_archivo_url" :href="proyecto.ecs_archivo_url" target="_blank" rel="noopener" class="ml-2 text-primary hover:underline">Archivo</a>
                <a v-if="proyecto.ecs_conformidad_url" :href="proyecto.ecs_conformidad_url" target="_blank" rel="noopener" class="ml-2 text-primary hover:underline">Conformidad</a>
              </p>
            </div>
            <InfoField label="Fecha de operación en MEM" :value="fmtFecha(proyecto.fecha_entrada_operacion)" />
            <InfoField
              label="Inicio de comercialización (pruebas)"
              :value="proyecto.fecha_inicio_comercializacion ? (fmtFecha(proyecto.fecha_inicio_comercializacion) + (proyecto.fecha_comercializacion_editada_manual ? ' (manual)' : ' (auto)')) : '—'" />
            <InfoField label="Fecha de operación (mantenimiento)" :value="proyecto.fecha_operacion_mantenimiento ? fmtFecha(proyecto.fecha_operacion_mantenimiento) : '—'" />
            <InfoField label="Fecha de entrega del proyecto" :value="proyecto.fecha_entrega_proyecto ? fmtFecha(proyecto.fecha_entrega_proyecto) : '—'" />
            <InfoField label="Fecha fin de representación" :value="proyecto.fecha_fin_representacion ? fmtFecha(proyecto.fecha_fin_representacion) : '—'" />
            <!-- Se muestra pero ya NO se edita acá: la comunidad se negocia en
                 el PPA y el backend la deriva de ahí. Editarla en la planta era
                 lo que dejaba los dos datos contradiciéndose. -->
            <div class="flex flex-col gap-1">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Comunidad energética</p>
              <div>
                <GBadge v-if="proyecto.es_comunidad_energetica" color="success">{{ proyecto.nombre_comunidad ? ('🏘 ' + proyecto.nombre_comunidad) : '🏘 Sí' }}</GBadge>
                <span v-else class="text-muted-foreground">—</span>
              </div>
              <p v-if="proyecto.es_comunidad_energetica" class="text-xs text-muted-foreground">
                Se define en el PPA de comunidad.
              </p>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Tipo de proyecto</label>
              <Select :model-value="aValorSelect(editForm.tipo_proyecto)" @update:model-value="editForm.tipo_proyecto = deValorSelect($event) || null"><SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem><SelectItem v-for="o in TIPOS_PROYECTO" :key="o" :value="o">{{ o }}</SelectItem></SelectContent></Select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Tecnología</label>
              <Select :model-value="aValorSelect(editForm.tipo_tecnologia)" @update:model-value="editForm.tipo_tecnologia = deValorSelect($event) || null"><SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem><SelectItem v-for="o in TIPOS_TECNOLOGIA" :key="o" :value="o">{{ o }}</SelectItem></SelectContent></Select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Capacidad instalada (kWp)</label>
              <NumberField v-model="editInfoTecnica.capacidad_instalada_kwp" :step-snapping="false" :format-options="{ maximumFractionDigits: 3 }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Departamento</label>
              <ComboBox :model-value="editForm.departamento" :options="opcionesDepartamento" placeholder="Seleccionar"
                @update:model-value="editForm.departamento = deValorSelect($event) || null" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Municipio</label>
              <!-- `key`: al cambiar de departamento cambian las opciones y el texto del input se recalcula. -->
              <ComboBox :key="editForm.departamento ?? ''" :model-value="editForm.municipio" :options="opcionesMunicipio"
                placeholder="Seleccionar" :disabled="!editForm.departamento"
                @update:model-value="editForm.municipio = deValorSelect($event) || null" />
            </div>
            <!-- La Ubicación se edita donde se lee. Estos dos campos habían
                 quedado en Técnico cuando la vista de lectura pasó a General. -->
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Dirección</label>
              <Input v-model="editForm.direccion_vereda" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Link Google Maps</label>
              <Input v-model="editInfoTecnica.url_ubicacion" placeholder="https://maps.app.goo.gl/..." />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Operador de red</label>
              <ComboBox :key="opcionesOperadorRed.length" :model-value="editForm.operador_red_id != null ? String(editForm.operador_red_id) : null"
                :options="opcionesOperadorRed" placeholder="Seleccionar"
                @update:model-value="v => { const id = deValorSelect(v); editForm.operador_red_id = id ? Number(id) : null }" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Clasificación regulatoria</label>
              <Select :model-value="aValorSelect(editForm.clasificacion_regulatoria)" @update:model-value="editForm.clasificacion_regulatoria = deValorSelect($event) || null"><SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem><SelectItem v-for="o in CLASIFICACIONES" :key="o" :value="o">{{ o }}</SelectItem></SelectContent></Select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Carpeta Drive</label>
              <Input v-model="editForm.carpeta_drive_codigo" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">API ID Unergy</label>
              <Input v-model="editForm.sub_project" placeholder="ej: ibirico, bayunca" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Código TSF</label>
              <Input v-model="editForm.codigo_tsf" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de operación en MEM</label>
              <DatePicker v-model="editFechaEntrada" clearable placeholder="Seleccionar" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Inicio de comercialización (pruebas)</label>
              <DatePicker v-model="editFechaComerc" clearable placeholder="Auto (1er día con generación)" />
              <small class="text-xs text-muted-foreground">Se autoderiva del 1er día con generación. Si la fijas a mano, el sistema no la vuelve a cambiar.</small>
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de operación (mantenimiento)</label>
              <DatePicker v-model="editFechaOperMant" clearable placeholder="Seleccionar" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de entrega del proyecto</label>
              <DatePicker v-model="editFechaEntrega" clearable placeholder="Seleccionar" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha fin de representación</label>
              <DatePicker v-model="editFechaFinRep" clearable placeholder="Vigente" />
            </div>
          </template>
        </div>
      </div>

      <!-- ══ TÉCNICO ══ -->
      <div v-if="tab === 'tecnico'">
        <div class="space-y-6 text-sm">

          <!-- Vista lectura -->
          <template v-if="!isEditMode">
            <!-- La Ubicación vive en la pestaña General, junto a Departamento y
                 Municipio: es dónde está la planta, no cómo está construida. -->
            <!-- Eléctrico general -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">General</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Potencia AC (kW)" :value="proyecto.info_tecnica?.potencia_ac_kw" />
                <InfoField label="Capacidad instalada (kWp)" :value="proyecto.info_tecnica?.capacidad_instalada_kwp" />
                <InfoField label="Voltaje red" :value="proyecto.info_tecnica?.voltaje_red" />
                <InfoField label="Tipo tracker" :value="proyecto.info_tecnica?.tipo_tracker" />
                <InfoField label="Producción específica (kWh/kWp)" :value="proyecto.produccion_especifica_kwh_kwp" />
                <InfoField label="Latitud" :value="proyecto.latitud" />
                <InfoField label="Longitud" :value="proyecto.longitud" />
                <InfoField label="Altitud (msnm)" :value="proyecto.altitud_msnm" />
              </div>
            </div>
            <!-- Paneles -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Paneles</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Cantidad de paneles" :value="proyecto.info_tecnica?.cantidad_total_paneles" />
                <InfoField label="Potencia panel (kWp)" :value="proyecto.info_tecnica?.potencia_panel_kwp" />
                <InfoField label="Marca paneles" :value="proyecto.info_tecnica?.marca_paneles" />
              </div>
            </div>
            <!-- Inversores -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Inversores</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Cantidad inversores" :value="proyecto.info_tecnica?.cantidad_inversores" />
                <InfoField label="Potencia inversores (kWp)" :value="proyecto.info_tecnica?.potencia_inversores_kwp" />
                <InfoField label="Marca inversores" :value="proyecto.info_tecnica?.marca_inversores" />
                <InfoField label="Cantidad strings" :value="proyecto.info_tecnica?.cantidad_strings" />
              </div>
            </div>
            <!-- Equipos -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Marcas de equipos</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Transformador" :value="proyecto.info_tecnica?.marca_transformador" />
                <InfoField label="Reconectador / Relé" :value="proyecto.info_tecnica?.marca_reconectador_rele" />
                <InfoField label="Totalizador" :value="proyecto.info_tecnica?.marca_totalizador" />
                <InfoField label="Seguidor solar" :value="proyecto.info_tecnica?.marca_seguidor_solar" />
                <InfoField label="Medidores frontera" :value="proyecto.info_tecnica?.marca_medidores_frontera" />
                <InfoField label="Módem reconectador/relé" :value="proyecto.info_tecnica?.marca_modem_reconectador" />
                <InfoField label="Módems frontera" :value="proyecto.info_tecnica?.marca_modems_frontera" />
                <InfoField label="IP módem reconectador" :value="proyecto.info_tecnica?.ip_modem_reconectador" />
              </div>
            </div>
            <!-- CCTV y seguridad -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">CCTV y seguridad</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Estado CCTV" :value="proyecto.info_tecnica?.cctv_estado" />
                <InfoField label="Marca CCTV" :value="proyecto.info_tecnica?.marca_cctv" />
                <InfoField label="Seguridad física" :value="proyecto.info_tecnica?.seguridad_fisica" />
                <InfoField label="Internet" :value="proyecto.info_tecnica?.tiene_internet" />
              </div>
            </div>
          </template>

          <!-- Vista edición -->
          <template v-else>
            <!-- Ubicación -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ubicación</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CoordenadasInput v-model:latitud="editForm.latitud" v-model:longitud="editForm.longitud"
                  v-model:valido="coordenadasValidas" class="md:col-span-2" />
              </div>
            </div>
            <!-- Eléctrico general -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">General</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Potencia AC (kW)</label>
                  <NumberField v-model="editInfoTecnica.potencia_ac_kw" :step-snapping="false" :format-options="{ maximumFractionDigits: 3 }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Capacidad instalada (kWp)</label>
                  <NumberField v-model="editInfoTecnica.capacidad_instalada_kwp" :step-snapping="false" :format-options="{ maximumFractionDigits: 3 }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Voltaje red</label>
                  <Input v-model="editInfoTecnica.voltaje_red" placeholder="ej: 13.8/800" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Tipo tracker</label>
                  <Select :model-value="aValorSelect(editInfoTecnica.tipo_tracker)" @update:model-value="editInfoTecnica.tipo_tracker = deValorSelect($event) || null"><SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem><SelectItem v-for="o in ['1P','2P']" :key="o" :value="o">{{ o }}</SelectItem></SelectContent></Select>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Producción específica (kWh/kWp)</label>
                  <NumberField v-model="editForm.produccion_especifica_kwh_kwp" :step-snapping="false" :format-options="{ maximumFractionDigits: 2 }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Altitud (msnm)</label>
                  <NumberField v-model="editForm.altitud_msnm" :step-snapping="false" :min="-100" :max="6000" ><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
              </div>
            </div>
            <!-- Paneles -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Paneles</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Cantidad de paneles</label>
                  <NumberField v-model="editInfoTecnica.cantidad_total_paneles" :step-snapping="false" :min="0" :format-options="{ useGrouping: false }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Potencia panel (kWp)</label>
                  <Input v-model="editInfoTecnica.potencia_panel_kwp" placeholder="ej: 0.58" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Marca paneles</label>
                  <Input v-model="editInfoTecnica.marca_paneles" />
                </div>
              </div>
            </div>
            <!-- Inversores -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Inversores</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Cantidad inversores</label>
                  <NumberField v-model="editInfoTecnica.cantidad_inversores" :step-snapping="false" :min="0" :format-options="{ useGrouping: false }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Potencia inversores (kWp)</label>
                  <Input v-model="editInfoTecnica.potencia_inversores_kwp" placeholder="ej: 300, 50 y 40" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Marca inversores</label>
                  <Input v-model="editInfoTecnica.marca_inversores" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Cantidad strings</label>
                  <NumberField v-model="editInfoTecnica.cantidad_strings" :step-snapping="false" :min="0" :format-options="{ useGrouping: false }"><NumberFieldContent><NumberFieldInput /></NumberFieldContent></NumberField>
                </div>
              </div>
            </div>
            <!-- Equipos -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Marcas de equipos</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Transformador</label>
                  <Input v-model="editInfoTecnica.marca_transformador" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Reconectador / Relé</label>
                  <Input v-model="editInfoTecnica.marca_reconectador_rele" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Totalizador</label>
                  <Input v-model="editInfoTecnica.marca_totalizador" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Seguidor solar</label>
                  <Input v-model="editInfoTecnica.marca_seguidor_solar" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Medidores frontera</label>
                  <Input v-model="editInfoTecnica.marca_medidores_frontera" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Módem reconectador/relé</label>
                  <Input v-model="editInfoTecnica.marca_modem_reconectador" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Módems frontera</label>
                  <Input v-model="editInfoTecnica.marca_modems_frontera" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">IP módem reconectador</label>
                  <Input v-model="editInfoTecnica.ip_modem_reconectador" />
                </div>
              </div>
            </div>
            <!-- CCTV y seguridad -->
            <div>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">CCTV y seguridad</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Estado CCTV</label>
                  <Input v-model="editInfoTecnica.cctv_estado" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Marca CCTV</label>
                  <Input v-model="editInfoTecnica.marca_cctv" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Seguridad física</label>
                  <Input v-model="editInfoTecnica.seguridad_fisica" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Internet</label>
                  <Select :model-value="aValorSelect(editInfoTecnica.tiene_internet)" @update:model-value="editInfoTecnica.tiene_internet = deValorSelect($event) || null"><SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem :value="VALOR_SELECT_VACIO">Sin definir</SelectItem><SelectItem v-for="o in ['Sí','No']" :key="o" :value="o">{{ o }}</SelectItem></SelectContent></Select>
                </div>
              </div>
            </div>
          </template>

        </div>
      </div>

      <!-- ══ SIMULACIÓN ══ -->
      <div v-if="tab === 'simulacion'">
        <div class="space-y-6">
          <div v-if="!isEditMode && hasSimulacionData" class="flex justify-end">
            <Button variant="outline" size="sm" @click="descargarSimulacionExcel"><FileSpreadsheetIcon class="size-4" /> Descargar Excel</Button>
          </div>
          <div v-for="sim in SIMULACIONES" :key="sim.key">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {{ sim.label }} <span class="normal-case font-normal">(kWh/mes)</span>
            </p>
            <div class="grid grid-cols-6 gap-2">
              <div v-for="(mes, i) in MESES" :key="sim.key + '-' + i">
                <label class="block text-xs text-muted-foreground mb-0.5 text-center">{{ mes }}</label>
                <NumberField v-if="isEditMode" v-model="sim.editArray.value[i]" :step-snapping="false"
                  :format-options="{ maximumFractionDigits: 1 }">
                  <NumberFieldContent><NumberFieldInput class="px-1 text-center text-xs" /></NumberFieldContent>
                </NumberField>
                <p v-else class="text-center text-sm font-semibold text-foreground bg-muted rounded py-1.5 px-1 tabular-nums">
                  {{ sim.displayArray.value[i] != null ? Math.round(sim.displayArray.value[i]).toLocaleString('es-CO') : '—' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ INVERSIONISTAS ══ -->
      <div v-if="tab === 'inversionistas'">
        <div class="space-y-4">
          <!-- GTable a mano: la fila se edita en el sitio y la tabla lleva una
               fila de total, que blocks/DataTable no tiene. -->
          <GTable>
            <GTableHeader>
              <GTableRow>
                <GTableHead>Inversionista</GTableHead>
                <GTableHead>Participación (%)</GTableHead>
                <GTableHead>Inicio</GTableHead>
                <GTableHead>Fin</GTableHead>
                <GTableHead>Patrimonio autónomo</GTableHead>
                <GTableHead />
              </GTableRow>
            </GTableHeader>
            <GTableBody>
              <TableEmpty v-if="!proyecto.inversionistas?.length" :colspan="6">
                <p class="text-center text-muted-foreground py-4">Sin inversionistas registrados.</p>
              </TableEmpty>
              <GTableRow v-for="data in proyecto.inversionistas" :key="data.id">
                <GTableCell>{{ data.cliente_nombre }}</GTableCell>
                <GTableCell>
                  <NumberField v-if="editandoInvId === data.id" v-model="editPct" :step-snapping="false" :min="0" :max="100"
                    :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 7 }" class="w-36">
                    <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                  </NumberField>
                  <template v-else>
                    {{ data.porcentaje_participacion != null ? (data.porcentaje_participacion * 100).toFixed(4) + '%' : '—' }}
                  </template>
                </GTableCell>
                <GTableCell>
                  <div v-if="editandoInvId === data.id" class="w-48"><DatePicker v-model="editFechaInicio" clearable placeholder="—" /></div>
                  <span v-else>{{ fmtFecha(data.fecha_inicio) }}</span>
                </GTableCell>
                <GTableCell>
                  <div v-if="editandoInvId === data.id" class="w-48"><DatePicker v-model="editFechaFin" clearable placeholder="Vigente" /></div>
                  <span v-else>{{ data.fecha_fin ? fmtFecha(data.fecha_fin) : 'Vigente' }}</span>
                </GTableCell>
                <GTableCell>
                  <GBadge :color="data.es_patrimonio_autonomo ? 'information' : 'default'">{{ data.es_patrimonio_autonomo ? 'Sí' : 'No' }}</GBadge>
                </GTableCell>
                <GTableCell>
                  <div class="flex gap-1">
                    <template v-if="editandoInvId === data.id">
                      <Button size="icon-sm" :disabled="guardando" variant="ghost" title="Guardar" aria-label="Guardar" @click="guardarEdicionInversionista(data.id)"><Spinner v-if="guardando" class="size-4" /><CheckIcon v-else class="size-4 text-success" /></Button>
                      <Button size="icon-sm" variant="ghost" title="Cancelar" aria-label="Cancelar" @click="editandoInvId = null"><XIcon class="size-4" /></Button>
                    </template>
                    <template v-else>
                      <Button size="icon-sm" variant="ghost" title="Editar" aria-label="Editar" @click="iniciarEdicionInversionista(data)"><PencilIcon class="size-4 text-primary" /></Button>
                      <Button size="icon-sm" variant="ghost" title="Eliminar" aria-label="Eliminar" @click="eliminarInversionista(data.id)"><Trash2Icon class="size-4 text-destructive" /></Button>
                    </template>
                  </div>
                </GTableCell>
              </GTableRow>
            </GTableBody>
            <GTableFooter>
              <GTableRow>
                <GTableCell class="font-semibold">Total</GTableCell>
                <GTableCell class="font-semibold">{{ tieneVariosPeriodos ? '— (ver períodos)' : totalParticipacion.toFixed(4) + '%' }}</GTableCell>
                <GTableCell :colspan="4" />
              </GTableRow>
            </GTableFooter>
          </GTable>

          <!-- Histórico por período (cuando hay inversionistas de distintas fechas) -->
          <div v-if="tieneVariosPeriodos" class="rounded-lg bg-muted border border-border p-3 space-y-2">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Histórico por período
              <span class="normal-case font-normal text-muted-foreground">— el 100% se valida dentro de cada período, no sobre todo el histórico</span>
            </p>
            <div v-for="per in periodos" :key="per.key"
              class="flex items-center justify-between text-sm border-t border-border pt-1 first:border-0 first:pt-0">
              <span class="text-muted-foreground">
                {{ per.label }}
                <GBadge v-if="per.vigente" color="success" class="ml-2 scale-90">Vigente</GBadge>
                <span class="text-muted-foreground ml-1">· {{ per.count }} inversionista(s)</span>
              </span>
              <span class="font-semibold tabular-nums" :class="per.ok ? 'text-success' : 'text-warning'">
                {{ per.total.toFixed(2) }}%
                <span v-if="!per.ok" title="No suma ~100% en este período"><TriangleAlertIcon class="ml-1 size-3" /></span>
              </span>
            </div>
          </div>

          <Separator />
          <p class="font-semibold text-foreground">Agregar inversionista</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">Cliente</label>
              <ComboBox :model-value="nuevoInv.cliente_id != null ? String(nuevoInv.cliente_id) : null"
                :options="opcionesClientesDisponibles" placeholder="Seleccionar cliente"
                @update:model-value="v => { nuevoInv.cliente_id = v ? Number(v) : null }" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">Porcentaje de participación (%)</label>
              <NumberField v-model="nuevoInv.porcentaje_pct" :step-snapping="false" :min="0" :max="100"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 7 }">
                <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
              </NumberField>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">Fecha inicio</label>
              <DatePicker v-model="nuevoInv.fecha_inicio" clearable placeholder="—" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">Fecha fin (opcional = vigente)</label>
              <DatePicker v-model="nuevoInv.fecha_fin" clearable placeholder="Vigente" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">Patrimonio autónomo</label>
              <div class="flex items-center gap-2 h-10">
                <GSwitch v-model="nuevoInv.es_patrimonio_autonomo" />
                <span class="text-sm text-muted-foreground">{{ nuevoInv.es_patrimonio_autonomo ? 'Sí' : 'No' }}</span>
              </div>
            </div>
          </div>
          <Button class="mt-2" :disabled="guardando || !nuevoInv.cliente_id" @click="agregarInversionista"><Spinner v-if="guardando" class="size-4" /> <PlusIcon v-else class="size-4" /> Agregar</Button>
        </div>
      </div>

      <!-- ══ CONTACTOS ══ -->
      <div v-if="tab === 'contactos'">
        <div>
          <ProyectoAreaContactosPanel
            :proyecto-id="proyecto.id"
            :inversionistas="proyecto.inversionistas"
            :clientes-options="clientes" />
        </div>
      </div>

      <!-- ══ SERVICIOS ══ -->
      <div v-if="tab === 'servicios'">
        <!-- PPA, Representación y CGM, y Operación, con su detalle, sin salir de la ficha. -->
        <ServiciosDelProyecto :proyecto-id="Number(route.params.id)" :activos="srvFlags" />
      </div>

      <!-- ══ FRONTERAS ══ -->
      <div v-if="tab === 'fronteras'">
        <div>
          <DataTable :columns="COLUMNAS_FRONTERAS" :rows="fronteras" row-key="id">
            <template #cell="{ row, column }">
              <GBadge v-if="column.key === 'estado'" :color="FRONTERA_ESTADO_SEVERITY[row.estado] || 'information'">{{ row.estado }}</GBadge>
              <template v-else-if="column.key === 'codigo_frontera'">{{ row.codigo_frontera || '—' }}</template>
              <template v-else>{{ row[column.key] }}</template>
            </template>
          </DataTable>
          <p class="text-xs mt-3 text-muted-foreground">
            Ve a la pestaña Fronteras del menú si deseas reasignar el proyecto.
          </p>
        </div>
      </div>

      <!-- ══ ID LIQUIDACIONES ══ -->
      <div v-if="tab === 'id-liquidaciones'">
        <div class="space-y-3 text-sm">
          <p class="text-xs text-muted-foreground">
            <InfoIcon class="mr-1 size-3" />
            Estos códigos viven en la API de Liquidaciones de Unergy, no en esta base.
            <span v-if="liqConfig?.nombre_topico"> Tópico: <b>{{ liqConfig.nombre_topico }}</b>.</span>
          </p>

          <div v-if="!proyecto.sub_project && !proyecto.topico_liquidaciones" class="rounded-lg px-3 py-2 text-xs bg-warning/15 text-foreground">
            El proyecto no tiene <b>API ID Unergy</b> (código base), así que no se puede
            identificar en la API de Liquidaciones. Complétalo en la pestaña General.
          </div>

          <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <template v-if="!isEditMode">
              <InfoField label="SIC generación" :value="liqConfig?.sic_gen" />
              <InfoField label="SIC consumo" :value="liqConfig?.sic_con" />
              <InfoField label="Tópico en Liquidaciones"
                         :value="proyecto.topico_liquidaciones || '(usa el API ID Unergy)'" />
            </template>
            <template v-else>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">SIC generación</label>
                <Input v-model="editLiq.sic_gen" placeholder="ej: 3A44" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">SIC consumo</label>
                <Input v-model="editLiq.sic_con" placeholder="ej: 3A3P" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Tópico en Liquidaciones</label>
                <Input v-model="editForm.topico_liquidaciones" :placeholder="proyecto.sub_project || 'ej: mgs18'" />
                <small class="text-xs text-muted-foreground">
                  Solo si esta planta se llama distinto allá que en generación. Vacío = se
                  usa el API ID Unergy.
                </small>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ══ ID QUOIA ══ -->
      <div v-if="tab === 'id-quoia'">
        <div class="space-y-4 text-sm">
          <p class="text-xs text-muted-foreground">
            <InfoIcon class="mr-1 size-3" />
            Estos ids viven en la API de Liquidaciones de Unergy, uno por subproyecto -- no en esta base.
          </p>

          <div v-if="!proyecto.sub_project && !proyecto.topico_liquidaciones" class="rounded-lg px-3 py-2 text-xs bg-warning/15 text-foreground">
            El proyecto no tiene <b>API ID Unergy</b> (código base), así que no se puede
            identificar en la API de Liquidaciones. Complétalo en la pestaña General.
          </div>
          <div v-else-if="!isEditMode && !(liqConfig?.subproyectos?.length)" class="text-xs text-muted-foreground">
            Sin subproyectos registrados en la API de Liquidaciones.
          </div>

          <template v-else-if="!isEditMode">
            <div v-for="sub in liqConfig?.subproyectos ?? []" :key="sub.topic" class="space-y-2">
              <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {{ sub.name || sub.topic }}
              </div>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoField label="ID Reporte Generación Quoia" :value="sub.quoia_report_gen_id" />
                <InfoField label="ID Reporte Consumo Quoia" :value="sub.quoia_report_con_id" />
                <InfoField label="ID de Nodo Quoia" :value="sub.quoia_node_id" />
              </div>
            </div>
          </template>

          <template v-else>
            <p v-if="!editSubproyectos.length" class="text-xs text-muted-foreground">
              Sin subproyectos registrados en la API de Liquidaciones -- no hay dónde guardar estos ids.
            </p>
            <div v-for="sub in editSubproyectos" :key="sub.topic" class="space-y-2">
              <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {{ sub.name || sub.topic }}
              </div>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">ID Reporte Generación Quoia</label>
                  <Input v-model="sub.quoia_report_gen_id" maxlength="4" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">ID Reporte Consumo Quoia</label>
                  <Input v-model="sub.quoia_report_con_id" maxlength="4" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1">ID de Nodo Quoia</label>
                  <Input v-model="sub.quoia_node_id" maxlength="50" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      </template>
    </DetalleLayout>

  </div>

  <div v-else-if="loading" class="flex justify-center py-20">
    <Spinner class="size-8" />
  </div>

  <div v-else class="flex flex-col items-center py-20 gap-3 text-muted-foreground">
    <CircleAlertIcon class="text-destructive size-8" />
    <p class="text-sm">{{ errorMsg || 'No se pudo cargar el proyecto.' }}</p>
    <Button variant="outline" size="sm" @click="$router.go(0)"><RefreshCwIcon class="size-4" /> Reintentar</Button>
  </div>
</template>

<script setup>
import { BriefcaseIcon, ChartLineIcon, CheckIcon, CircleAlertIcon, DollarSignIcon, FileSpreadsheetIcon, GlobeIcon, InfoIcon, LinkIcon, MailIcon, MapPinIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon, UsersIcon, WrenchIcon, XIcon } from '@lucide/vue'
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DataTable from '~/components/blocks/DataTable.vue'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ClientesService } from '~/features/clientes/services/clientes'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'
import divipola from '~/data/colombia-divipola.json'
import ProyectoAreaContactosPanel from '~/features/proyectos/components/ProyectoAreaContactosPanel.vue'
import SincronizarTsf from '~/features/proyectos/components/SincronizarTsf.vue'
import ServiciosDelProyecto from '~/features/proyectos/components/ServiciosDelProyecto.vue'
import DetalleLayout from '~/components/blocks/DetalleLayout.vue'

const proyectosService = new ProyectosService()
const clientesService = new ClientesService()
const operadoresRedService = new OperadoresRedService()
const liquidacionesApiService = new LiquidacionesApiService()

const route = useRoute()
const router = useRouter()

// ── Constantes (sin hardcode en template) ────────────────────────────────────
const ESTADOS = [
  { label: 'En desarrollo', value: 'en_desarrollo' },
  { label: 'En operacion', value: 'en_operacion' },
  { label: 'Suspendido', value: 'suspendido' },
  { label: 'Cancelado', value: 'cancelado' },
]
const TIPOS_PROYECTO = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica']
const TIPOS_TECNOLOGIA = ['solar', 'eolica', 'hidraulica', 'biomasa', 'otra']
const CLASIFICACIONES = ['AGP', 'AGPE', 'AGGE', 'GD', 'DER', 'otra']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const FRONTERA_ESTADO_SEVERITY = { activa: 'success', en_registro: 'warning', en_falla: 'destructive', cancelada: 'default' }

// ── Estado base ───────────────────────────────────────────────────────────────
const proyecto = ref(null)
// Configuración de liquidaciones: vive en la API de Unergy, no en esta base.
const liqConfig = ref(null)
const editLiq = reactive({ sic_gen: '', sic_con: '' })
// IDs de Quoia: viven en la API de Liquidaciones, uno por subproyecto (no en
// esta base -- ver auditoría 2026-08-31: la pestaña "ID Quoia" editaba antes
// proyectos.quoia_* acá, una copia muerta que la vista de lista de IDs ni
// siquiera mostraba, porque esa vista ya prioriza el dato real de la API).
const editSubproyectos = ref([])
const fronteras = ref([])
const clientes = ref([])
const loading = ref(true)
const errorMsg = ref(null)
const guardando = ref(false)
// Qué servicios tiene la planta: `servicios` del backend, calculado de los
// contratos vigentes. Solo lectura.
const srvFlags = computed(() => proyecto.value?.servicios ?? {})

// ── Pestaña activa ──────────────────────────────────────────────────────────
// Se puede abrir el detalle directo en una pestaña vía ?tab=... (ej. desde la
// vista "IDs proyectos", que enlaza a las pestañas de IDs).
// La pestaña Fronteras solo se muestra si el proyecto tiene fronteras
// asociadas -- los índices de las pestañas siguientes dependen de eso.
const activeTab = ref('general')
// Las pestanas se identifican por llave de texto, asi que Fronteras puede
// aparecer o no sin desplazar a las demas. Antes habia un TAB_INDEX numerico
// que se recalculaba, y un ?tab=id-liquidaciones o ?tab=id-quoia podia caer en
// la pestana equivocada segun si la planta tenia fronteras.
const TABS = computed(() => [
  { key: 'general',          label: 'General',          icon: InfoIcon },
  { key: 'tecnico',          label: 'Técnico',          icon: WrenchIcon },
  { key: 'simulacion',       label: 'Simulación',       icon: ChartLineIcon },
  // Mismo orden que el detalle de Cliente: identidad -> contactos -> servicios
  // -> relaciones -> integracion. Asi las tres vistas se leen igual.
  { key: 'contactos',        label: 'Contactos',        icon: MailIcon },
  { key: 'servicios',        label: 'Servicios',        icon: BriefcaseIcon },
  { key: 'inversionistas',   label: 'Inversionistas',   icon: UsersIcon },
  { key: 'fronteras',        label: 'Fronteras',        icon: GlobeIcon,
    badge: fronteras.value.length || null, oculta: !fronteras.value.length },
  { key: 'id-liquidaciones', label: 'ID liquidaciones', icon: DollarSignIcon },
  { key: 'id-quoia',         label: 'ID Quoia',         icon: LinkIcon },
])

// ── Modo edición ──────────────────────────────────────────────────────────────
const isEditMode = computed(() => route.query.edit === 'true')

const editForm = reactive({
  nombre_comercial: '',
  estado: '',
  tipo_proyecto: null,
  tipo_tecnologia: null,
  potencia_ac_kw: null,
  departamento: null,
  municipio: null,
  latitud: null,
  longitud: null,
  // `altitud_msnm` y `direccion_vereda` faltaban acá, y `populateEditForm` solo
  // llena las claves declaradas: la Dirección aparecía SIEMPRE vacía al entrar
  // en edición aunque el proyecto la tuviera, y la altitud no se podía editar
  // desde ninguna parte (el campo existe en la base y en la API desde que se
  // eliminó `fronteras.altitud_msnm`, pero se perdió al migrar la ficha).
  altitud_msnm: null,
  direccion_vereda: null,
  operador_red_id: null,
  clasificacion_regulatoria: null,
  carpeta_drive_codigo: null,
  sub_project: null,
  codigo_tsf: null,
  topico_liquidaciones: null,
  produccion_especifica_kwh_kwp: null,
})

const editInfoTecnica = reactive({
  voltaje_red: null,
  potencia_ac_kw: null,
  capacidad_instalada_kwp: null,
  tipo_tracker: null,
  cantidad_total_paneles: null,
  potencia_panel_kwp: null,
  marca_paneles: null,
  cantidad_inversores: null,
  potencia_inversores_kwp: null,
  marca_inversores: null,
  cantidad_strings: null,
  marca_transformador: null,
  marca_reconectador_rele: null,
  marca_totalizador: null,
  marca_seguidor_solar: null,
  marca_medidores_frontera: null,
  marca_modem_reconectador: null,
  marca_modems_frontera: null,
  ip_modem_reconectador: null,
  url_ubicacion: null,
  cctv_estado: null,
  marca_cctv: null,
  seguridad_fisica: null,
  tiene_internet: null,
})

// Fechas del proyecto (DatePicker trabaja con Date; el API espera 'YYYY-MM-DD')
const editFechaEntrada = ref(null)
const editFechaComerc = ref(null)
const editFechaOperMant = ref(null)
const editFechaEntrega = ref(null)
const editFechaFinRep = ref(null)

// ── Helpers de fecha ──────────────────────────────────────────────────────────
/** Fecha del API -> 'aaaa-mm-dd', que es lo que usa DatePicker (y lo que `formatFecha` devuelve tal cual). */
function aFecha(v) {
  if (!v) return null
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return String(v).slice(0, 10)
}
function formatFecha(v) {
  if (!v) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).slice(0, 10)
}
function fmtFecha(v) {
  return v ? String(v).slice(0, 10) : '—'
}

// ── Simulación P90 / P50 / P99 ───────────────────────────────────────────────
const editP90 = ref(Array(12).fill(null))
const editP50 = ref(Array(12).fill(null))
const editP99 = ref(Array(12).fill(null))

const p90Display = computed(() => parseMonthArray(proyecto.value?.p90_mensual_kwh))
const p50Display = computed(() => parseMonthArray(proyecto.value?.p50_mensual_kwh))
const p99Display = computed(() => parseMonthArray(proyecto.value?.p99_mensual_kwh))

const SIMULACIONES = [
  { key: 'p90', label: 'P90', editArray: editP90, displayArray: p90Display },
  { key: 'p50', label: 'P50', editArray: editP50, displayArray: p50Display },
  { key: 'p99', label: 'P99', editArray: editP99, displayArray: p99Display },
]

const hasSimulacionData = computed(() =>
  SIMULACIONES.some(s => s.displayArray.value.some(v => v != null))
)

function sanitizeFilename(name) {
  return String(name || 'proyecto').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'proyecto'
}

async function descargarSimulacionExcel() {
  try {
    if (!proyecto.value) return
    const XLSX = await import('xlsx')
    const header = ['Escenario', ...MESES, 'Total anual (kWh)']
    const rows = SIMULACIONES.map(sim => {
      const vals = sim.displayArray.value.map(v => (v == null ? null : Number(v)))
      const total = vals.reduce((acc, v) => acc + (v ?? 0), 0)
      return [sim.label, ...vals, total]
    })
    const aoa = [
      [`Simulación de generación — ${proyecto.value.nombre_comercial || ''}`],
      [`Potencia AC instalada: ${proyecto.value.potencia_ac_kw ?? '—'} kW`],
      [`Exportado: ${new Date().toLocaleString('es-CO')}`],
      [],
      header,
      ...rows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 14 }, ...MESES.map(() => ({ wch: 10 })), { wch: 18 }]
    if (!ws['!merges']) ws['!merges'] = []
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Simulación')
    const filename = `simulacion_${sanitizeFilename(proyecto.value.nombre_comercial)}.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success('Excel descargado', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo generar el Excel', { description: e?.message, duration: 4000 })
  }
}

function parseMonthArray(val) {
  if (!val) return Array(12).fill(null)
  // Si ya es un array (API devuelve lista directamente), úsalo tal cual
  if (Array.isArray(val)) return val.map(v => (v ?? null))
  // Si es string JSON (formato legado), parsearlo
  try {
    const arr = JSON.parse(val)
    return Array.isArray(arr) ? arr.map(v => (v ?? null)) : Array(12).fill(null)
  } catch {
    return Array(12).fill(null)
  }
}

function serializeMonthArray(arr) {
  if (arr.every(v => v === null || v === undefined)) return null
  return JSON.stringify(arr.map(v => v ?? null))
}

function populateEditForm() {
  if (!proyecto.value) return
  const p = proyecto.value
  Object.keys(editForm).forEach(k => { if (k in p) editForm[k] = p[k] ?? null })
  const it = p.info_tecnica
  if (it) Object.keys(editInfoTecnica).forEach(k => { if (k in it) editInfoTecnica[k] = it[k] ?? null })
  editP90.value = parseMonthArray(p.p90_mensual_kwh)
  editP50.value = parseMonthArray(p.p50_mensual_kwh)
  editP99.value = parseMonthArray(p.p99_mensual_kwh)
  editFechaEntrada.value = aFecha(p.fecha_entrada_operacion)
  editFechaComerc.value = aFecha(p.fecha_inicio_comercializacion)
  editFechaOperMant.value = aFecha(p.fecha_operacion_mantenimiento)
  editFechaEntrega.value = aFecha(p.fecha_entrega_proyecto)
  editFechaFinRep.value = aFecha(p.fecha_fin_representacion)
  editLiq.sic_gen = liqConfig.value?.sic_gen ?? ''
  editLiq.sic_con = liqConfig.value?.sic_con ?? ''
  editSubproyectos.value = (liqConfig.value?.subproyectos ?? []).map(s => ({
    topic: s.topic,
    name: s.name,
    quoia_report_gen_id: s.quoia_report_gen_id ?? '',
    quoia_report_con_id: s.quoia_report_con_id ?? '',
    quoia_node_id: s.quoia_node_id ?? '',
  }))
}

watch(isEditMode, (entering) => {
  if (entering && proyecto.value) populateEditForm()
})

// Autocompleta el link de Google Maps con las coordenadas en cuanto haya
// latitud y longitud -- solo si el campo está vacío, nunca pisa un link
// ya cargado a mano.
watch([() => editForm.latitud, () => editForm.longitud], ([lat, lon]) => {
  if (lat != null && lon != null && !editInfoTecnica.url_ubicacion) {
    editInfoTecnica.url_ubicacion = `https://www.google.com/maps?q=${lat},${lon}`
  }
})

function enterEditMode() {
  // replace, no push -- entrar/salir de edicion es un cambio de estado de la
  // UI, no una navegacion real; con push se acumulan entradas de historial y
  // el boton "atras" cae en el modo edicion en vez de la pagina anterior.
  router.replace({ query: { edit: 'true' } })
}

function cancelEdit() {
  router.replace({ query: {} })
}

// Ver CoordenadasInput: con una coordenada ilegible en pantalla no se guarda.
const coordenadasValidas = ref(true)

async function saveEdit() {
  if (!coordenadasValidas.value) {
    toast.error('Coordenada inválida', {
      description: 'Revisa la latitud y la longitud en la pestaña Técnico.',
      duration: 4000,
    })
    return
  }
  if (!editForm.nombre_comercial?.trim()) {
    toast.error('Falta el nombre', {
      description: 'El nombre comercial no puede quedar vacío.',
      duration: 4000,
    })
    return
  }
  guardando.value = true
  try {
    // Siempre se envían todas las claves (no solo las no-vacías): editForm ya
    // viene pre-poblado con el estado actual del proyecto (populateEditForm),
    // así que reenviarlas sin filtrar preserva lo que no se tocó Y permite
    // limpiar un campo a null -- filtrar por "!= ''" (como antes) hacía que
    // borrar un valor y guardar nunca lo limpiara de verdad (bug real
    // encontrado con "Capacidad instalada" en Bayunca, 2026-08-11).
    const payload = {}
    for (const [k, v] of Object.entries(editForm)) {
      payload[k] = v === '' ? null : v
    }
    const p90json = serializeMonthArray(editP90.value)
    const p50json = serializeMonthArray(editP50.value)
    const p99json = serializeMonthArray(editP99.value)
    if (p90json !== null) payload.p90_mensual_kwh = p90json
    if (p50json !== null) payload.p50_mensual_kwh = p50json
    if (p99json !== null) payload.p99_mensual_kwh = p99json
    // Fechas: se inicializan desde los valores actuales, así que enviarlas siempre
    // preserva lo existente y permite limpiarlas (null) explícitamente.
    payload.fecha_entrada_operacion = formatFecha(editFechaEntrada.value)
    payload.fecha_operacion_mantenimiento = formatFecha(editFechaOperMant.value)
    payload.fecha_entrega_proyecto = formatFecha(editFechaEntrega.value)
    payload.fecha_fin_representacion = formatFecha(editFechaFinRep.value)
    // Inicio de comercialización: solo se envía si el usuario la cambió, para no
    // marcarla como "editada a mano" en cada guardado (el backend fija ese flag
    // cuando este campo llega en el payload).
    const comercNueva = formatFecha(editFechaComerc.value)
    const comercActual = proyecto.value?.fecha_inicio_comercializacion || null
    if (comercNueva !== comercActual) payload.fecha_inicio_comercializacion = comercNueva
    // Comunidad energética: enviar siempre el flag y el nombre (permite limpiarlo).
    // Se envía siempre para poder dejarlo vacío: el loop de arriba omite lo
    // vacío, y sin esto no habría forma de quitar un tópico ya puesto.
    payload.topico_liquidaciones = editForm.topico_liquidaciones || null

    await proyectosService.actualizar(route.params.id, payload)
    // Los códigos SIC se guardan en la API de Liquidaciones, no en esta base.
    if (proyecto.value?.sub_project) {
      const sicCambio =
        (editLiq.sic_gen || null) !== (liqConfig.value?.sic_gen || null) ||
        (editLiq.sic_con || null) !== (liqConfig.value?.sic_con || null)
      if (sicCambio) {
        await liquidacionesApiService.actualizarConfigProyecto(route.params.id, {
          sic_gen: editLiq.sic_gen || null,
          sic_con: editLiq.sic_con || null,
        })
      }
    }
    // IDs de Quoia: uno por subproyecto, viven en la API de Liquidaciones.
    // Se compara contra el original para no golpear la API de subproyectos
    // que no se tocaron.
    for (const sub of editSubproyectos.value) {
      const original = (liqConfig.value?.subproyectos ?? []).find(s => s.topic === sub.topic)
      const cambio =
        (sub.quoia_report_gen_id || null) !== (original?.quoia_report_gen_id || null) ||
        (sub.quoia_report_con_id || null) !== (original?.quoia_report_con_id || null) ||
        (sub.quoia_node_id || null) !== (original?.quoia_node_id || null)
      if (!cambio) continue
      await liquidacionesApiService.actualizarSubproyecto(sub.topic, {
        quoia_report_gen_id: sub.quoia_report_gen_id || null,
        quoia_report_con_id: sub.quoia_report_con_id || null,
        quoia_node_id: sub.quoia_node_id || null,
      })
    }
    // Mismo criterio que arriba -- sin filtrar, para poder limpiar un campo
    // (ver comentario en el payload de editForm).
    const itPayload = {}
    for (const [k, v] of Object.entries(editInfoTecnica)) {
      itPayload[k] = v === '' ? null : v
    }
    await proyectosService.guardarInfoTecnica(route.params.id, itPayload)
    const [proy, inversionistas] = await Promise.all([
      proyectosService.obtener(route.params.id),
      proyectosService.listarInversionistas(route.params.id),
    ])
    proyecto.value = { ...proy, inversionistas }
    try {
      liqConfig.value = await liquidacionesApiService.obtenerConfigProyecto(route.params.id)
    } catch { /* la API externa puede no responder; no bloquea el guardado */ }
    router.replace({ query: {} })
    toast.success('Proyecto actualizado', { duration: 3000 })
  } catch (e) {
    toast.error('Error al guardar', {
      description: e.data?.detail || e.message || 'No se pudo actualizar el proyecto.',
      duration: 5000,
    })
  } finally {
    guardando.value = false
  }
}

// ── Inversionistas ────────────────────────────────────────────────────────────
const nuevoInv = reactive({ cliente_id: null, porcentaje_pct: null, es_patrimonio_autonomo: false, fecha_inicio: null, fecha_fin: null })
const editandoInvId = ref(null)
const editPct = ref(null)
const editFechaInicio = ref(null)
const editFechaFin = ref(null)


const clientesDisponibles = computed(() => {
  if (!proyecto.value) return clientes.value
  const yaAgregados = new Set(proyecto.value.inversionistas.map(i => i.cliente_id))
  return clientes.value.filter(c => !yaAgregados.has(c.id))
})

const opcionesClientesDisponibles = computed(() =>
  clientesDisponibles.value.map(c => ({ value: String(c.id), label: c.razon_social_nombre })))

const COLUMNAS_FRONTERAS = [
  { key: 'codigo_frontera', header: 'Código' },
  { key: 'nombre_frontera', header: 'Nombre' },
  { key: 'tipo_frontera', header: 'Tipo' },
  { key: 'estado', header: 'Estado' },
]

const totalParticipacion = computed(() => {
  if (!proyecto.value?.inversionistas?.length) return 0
  return proyecto.value.inversionistas.reduce((sum, i) => sum + (i.porcentaje_participacion ?? 0) * 100, 0)
})

// Histórico separado por período: dos inversionistas son simultáneos si comparten
// el mismo rango [fecha_inicio, fecha_fin]. El 100% se valida dentro de cada
// período, NO sobre todo el histórico (de ahí venía el 200% engañoso de Merengue).
const periodos = computed(() => {
  const invs = proyecto.value?.inversionistas ?? []
  if (!invs.length) return []
  const grupos = new Map()
  for (const i of invs) {
    const ini = i.fecha_inicio ? String(i.fecha_inicio).slice(0, 10) : null
    const fin = i.fecha_fin ? String(i.fecha_fin).slice(0, 10) : null
    const key = `${ini ?? '∅'}|${fin ?? '∅'}`
    if (!grupos.has(key)) grupos.set(key, { key, ini, fin, total: 0, count: 0 })
    const g = grupos.get(key)
    g.total += (i.porcentaje_participacion ?? 0) * 100
    g.count += 1
  }
  return [...grupos.values()]
    .sort((a, b) => (a.ini ?? '').localeCompare(b.ini ?? ''))
    .map(g => ({
      ...g,
      label: `${g.ini ?? 'Sin inicio'} → ${g.fin ?? 'Vigente'}`,
      vigente: g.fin == null,
      ok: Math.abs(g.total - 100) < 0.5,
    }))
})

const tieneVariosPeriodos = computed(() => periodos.value.length > 1)

async function agregarInversionista() {
  if (!nuevoInv.cliente_id) {
    toast.warning('Selecciona un cliente', { duration: 2000 })
    return
  }
  guardando.value = true
  try {
    await proyectosService.agregarInversionista(route.params.id, {
      cliente_id: nuevoInv.cliente_id,
      porcentaje_participacion: nuevoInv.porcentaje_pct != null ? nuevoInv.porcentaje_pct / 100 : null,
      es_patrimonio_autonomo: nuevoInv.es_patrimonio_autonomo,
      fecha_inicio: formatFecha(nuevoInv.fecha_inicio),
      fecha_fin: formatFecha(nuevoInv.fecha_fin),
    })
    proyecto.value.inversionistas = await proyectosService.listarInversionistas(route.params.id)
    nuevoInv.cliente_id = null
    nuevoInv.porcentaje_pct = null
    nuevoInv.es_patrimonio_autonomo = false
    nuevoInv.fecha_inicio = null
    nuevoInv.fecha_fin = null
    toast.success('Inversionista agregado', { duration: 2000 })
  } catch (e) {
    toast.error('Error al agregar', { description: e.data?.detail, duration: 3000 })
  } finally {
    guardando.value = false
  }
}

async function eliminarInversionista(invId) {
  if (!confirm('¿Estás seguro de que deseas eliminar este inversionista?')) return
  try {
    await proyectosService.eliminarInversionista(route.params.id, invId)
    proyecto.value.inversionistas = proyecto.value.inversionistas.filter(i => i.id !== invId)
    toast.success('Inversionista eliminado', { duration: 2000 })
  } catch (e) {
    toast.error('Error al eliminar', { description: e.data?.detail, duration: 3000 })
  }
}

function iniciarEdicionInversionista(inv) {
  editandoInvId.value = inv.id
  editPct.value = inv.porcentaje_participacion != null ? +(inv.porcentaje_participacion * 100).toFixed(7) : null
  editFechaInicio.value = aFecha(inv.fecha_inicio)
  editFechaFin.value = aFecha(inv.fecha_fin)
}

async function guardarEdicionInversionista(invId) {
  guardando.value = true
  try {
    await proyectosService.actualizarInversionista(route.params.id, invId, {
      porcentaje_participacion: editPct.value != null ? editPct.value / 100 : null,
      fecha_inicio: formatFecha(editFechaInicio.value),
      fecha_fin: formatFecha(editFechaFin.value),
    })
    editandoInvId.value = null
    editPct.value = null
    editFechaInicio.value = null
    editFechaFin.value = null
    proyecto.value.inversionistas = await proyectosService.listarInversionistas(route.params.id)
    toast.success('Porcentaje actualizado', { duration: 2000 })
  } catch (e) {
    toast.error('Error al actualizar', { description: e.data?.detail, duration: 3000 })
  } finally {
    guardando.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const estadoSeverity = (e) => (
  { en_operacion: 'success', en_desarrollo: 'information', suspendido: 'warning', cancelado: 'default' }[e] || 'default'
)

// Departamento/municipio -- select en vez de texto libre (DIVIPOLA), para
// evitar variantes de escritura que luego no se puedan agrupar/filtrar bien.
const departamentos = Object.keys(divipola).sort()

/** Opciones de un ComboBox con la primera para dejarlo vacío (el showClear de PrimeVue). */
function conVacio(opciones) {
  return [{ value: VALOR_SELECT_VACIO, label: 'Sin definir' }, ...opciones]
}
const opcionesDepartamento = conVacio(departamentos.map(d => ({ value: d, label: d })))
const municipiosDisponibles = computed(() => editForm.departamento ? (divipola[editForm.departamento] || []) : [])
const opcionesMunicipio = computed(() => conVacio(municipiosDisponibles.value.map(m => ({ value: m, label: m }))))
watch(() => editForm.departamento, (nuevo, anterior) => {
  if (nuevo !== anterior && editForm.municipio && !(divipola[nuevo] || []).includes(editForm.municipio)) {
    editForm.municipio = null
  }
})

// Catálogo de operadores de red -- select en vez de texto libre, para que
// coincida con el vínculo real que usa Reporte CGM (Frontera.operador_red_id).
const operadoresRed = ref([])
const opcionesOperadorRed = computed(() =>
  conVacio(operadoresRed.value.map(o => ({ value: String(o.id), label: o.nombre_comercial || o.nombre_legal })))
)

// «Sincronizar con TSF» necesita el token de Unergy Auth: con el login propio no se muestra.
const unergyAuth = useRuntimeConfig().public.unergyAuthEnabled

async function recargarProyecto() {
  const [proy, inversionistas] = await Promise.all([
    proyectosService.obtener(route.params.id),
    proyectosService.listarInversionistas(route.params.id),
  ])
  proyecto.value = { ...proy, inversionistas }
}

// ── Carga inicial ─────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [proy, clientesList, inversionistas, operadoresRes, fronterasRes] = await Promise.all([
      proyectosService.obtener(route.params.id),
      clientesService.listar({ size: 200 }),
      proyectosService.listarInversionistas(route.params.id),
      operadoresRedService.listar().catch(() => []),
      proyectosService.listarFronterasDelProyecto(route.params.id).catch(() => []),
    ])
    liquidacionesApiService.obtenerConfigProyecto(route.params.id)
      .then(config => { liqConfig.value = config; if (isEditMode.value) populateEditForm() })
      .catch(() => { liqConfig.value = null })
    proyecto.value = { ...proy, inversionistas }
    clientes.value = clientesList
    fronteras.value = fronterasRes
    operadoresRed.value = operadoresRes
    if (isEditMode.value) populateEditForm()
  } catch (e) {
    errorMsg.value = e.data?.detail || e.message || 'Error de conexión con el servidor'
  } finally {
    loading.value = false
  }
})
</script>

<script>
// Componente auxiliar local (Composition API): distinto del `InfoField` global
// de `~/components/blocks/`, que lleva los colores de marca -- este usa la
// paleta gris de Tailwind, así que no son intercambiables sin cambiar el diseño.
const InfoField = {
  props: { label: String, value: [String, Number, Boolean] },
  setup(props) {
    return { props }
  },
  template: `
    <div>
      <p class="text-xs text-muted-foreground uppercase tracking-wide">{{ props.label }}</p>
      <p class="text-foreground font-medium mt-0.5">{{ props.value ?? '—' }}</p>
    </div>
  `,
}
export default { components: { InfoField } }
</script>
