<template>
  <div v-if="proyecto">
    <DetalleLayout :volver="{ to: '/servicios-unificado?vista=proyectos', label: 'Proyectos' }"
                   :titulo="proyecto.nombre_comercial"
                   :codigo="proyecto.codigo_tsf || ''"
                   :tabs="TABS" v-model="activeTab">
      <!-- En modo edicion, nombre y estado se editan en la misma miga -->
      <template v-if="isEditMode" #titulo>
        <InputText v-model="editForm.nombre_comercial" size="small" class="w-64" />
        <Select v-model="editForm.estado" :options="ESTADOS" optionLabel="label" optionValue="value"
                size="small" class="w-40" />
      </template>
      <template v-if="!isEditMode" #chips>
        <GBadge :color="estadoSeverity(proyecto.estado)" class="text-[10px]">{{ proyecto.estado }}</GBadge>
      </template>
      <template #acciones>
        <template v-if="isEditMode">
          <Button label="Cancelar" severity="secondary" outlined size="small" @click="cancelEdit" />
          <Button label="Guardar cambios" size="small" :loading="guardando" @click="saveEdit">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </template>
        <Button v-else label="Editar" outlined size="small" @click="enterEditMode">
          <template #icon><PencilIcon class="size-[1em]" /></template>
        </Button>
      </template>
      <template #default="{ tab }">
      <!-- ══ GENERAL ══ -->
      <div v-if="tab === 'general'">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 text-sm">
          <template v-if="!isEditMode">
            <InfoField label="Tipo" :value="proyecto.tipo_proyecto" />
            <InfoField label="Tecnología" :value="proyecto.tipo_tecnologia" />
            <InfoField label="Capacidad instalada (kWp)" :value="proyecto.info_tecnica?.capacidad_instalada_kwp" />
            <InfoField label="Departamento" :value="proyecto.departamento" />
            <InfoField label="Municipio" :value="proyecto.municipio" />
            <InfoField label="Operador de red" :value="proyecto.operador_red_legal || proyecto.operador_red" />
            <InfoField label="Clasificación" :value="proyecto.clasificacion_regulatoria" />
            <InfoField label="Carpeta Drive" :value="proyecto.carpeta_drive_codigo" />
            <InfoField label="API ID Unergy" :value="proyecto.sub_project" />
            <InfoField label="Código TSF" :value="proyecto.codigo_tsf" />
            <InfoField label="Fecha de entrada en operación" :value="fmtFecha(proyecto.fecha_entrada_operacion)" />
            <InfoField
              label="Inicio de comercialización"
              :value="proyecto.fecha_inicio_comercializacion ? (fmtFecha(proyecto.fecha_inicio_comercializacion) + (proyecto.fecha_comercializacion_editada_manual ? ' (manual)' : ' (auto)')) : '—'" />
            <InfoField label="Fecha fin de representación" :value="proyecto.fecha_fin_representacion ? fmtFecha(proyecto.fecha_fin_representacion) : '—'" />
            <div class="flex flex-col gap-1">
              <p class="text-xs text-gray-400 uppercase tracking-wide">Comunidad energética</p>
              <div>
                <GBadge v-if="proyecto.es_comunidad_energetica" color="success">{{ proyecto.nombre_comunidad ? ('🏘 ' + proyecto.nombre_comunidad) : '🏘 Sí' }}</GBadge>
                <span v-else class="text-gray-400">—</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col gap-1">
              <label class="field-label">Tipo de proyecto</label>
              <Select v-model="editForm.tipo_proyecto" :options="TIPOS_PROYECTO" class="w-full" placeholder="Seleccionar" showClear />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Tecnología</label>
              <Select v-model="editForm.tipo_tecnologia" :options="TIPOS_TECNOLOGIA" class="w-full" placeholder="Seleccionar" showClear />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Capacidad instalada (kWp)</label>
              <InputNumber v-model="editInfoTecnica.capacidad_instalada_kwp" :maxFractionDigits="3" locale="en-US" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Departamento</label>
              <Select v-model="editForm.departamento" :options="departamentos" class="w-full" placeholder="Seleccionar" showClear filter />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Municipio</label>
              <Select v-model="editForm.municipio" :options="municipiosDisponibles" class="w-full" placeholder="Seleccionar" showClear filter
                :disabled="!editForm.departamento" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Operador de red</label>
              <Select v-model="editForm.operador_red_id" :options="operadoresRedOptions" optionLabel="label"
                optionValue="id" class="w-full" placeholder="Seleccionar" showClear filter />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Clasificación regulatoria</label>
              <Select v-model="editForm.clasificacion_regulatoria" :options="CLASIFICACIONES" class="w-full" placeholder="Seleccionar" showClear />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Carpeta Drive</label>
              <InputText v-model="editForm.carpeta_drive_codigo" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">API ID Unergy</label>
              <InputText v-model="editForm.sub_project" class="w-full" placeholder="ej: ibirico, bayunca" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Código TSF</label>
              <InputText v-model="editForm.codigo_tsf" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha de entrada en operación</label>
              <DatePicker v-model="editFechaEntrada" dateFormat="yy-mm-dd" showIcon showClear class="w-full" placeholder="Seleccionar" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Inicio de comercialización</label>
              <DatePicker v-model="editFechaComerc" dateFormat="yy-mm-dd" showIcon showClear class="w-full" placeholder="Auto (1er día con generación)" />
              <small class="text-xs text-gray-400">Se autoderiva del 1er día con generación. Si la fijas a mano, el sistema no la vuelve a cambiar.</small>
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha fin de representación</label>
              <DatePicker v-model="editFechaFinRep" dateFormat="yy-mm-dd" showIcon showClear class="w-full" placeholder="Vigente" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Comunidad energética</label>
              <div class="flex items-center gap-2 h-full">
                <ToggleSwitch v-model="editForm.es_comunidad_energetica" />
                <span class="text-sm text-gray-500">{{ editForm.es_comunidad_energetica ? 'Sí' : 'No' }}</span>
              </div>
            </div>
            <div v-if="editForm.es_comunidad_energetica" class="flex flex-col gap-1">
              <label class="field-label">Nombre de la comunidad</label>
              <InputText v-model="editForm.nombre_comunidad" class="w-full" placeholder="Opcional" />
            </div>
          </template>
        </div>
      </div>

      <!-- ══ TÉCNICO ══ -->
      <div v-if="tab === 'tecnico'">
        <div class="p-4 space-y-6 text-sm">

          <!-- Vista lectura -->
          <template v-if="!isEditMode">
            <!-- Ubicación -->
            <div v-if="proyecto.direccion_vereda || proyecto.info_tecnica?.url_ubicacion">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ubicación</p>
              <div class="space-y-1">
                <p v-if="proyecto.direccion_vereda" class="text-gray-700">{{ proyecto.direccion_vereda }}</p>
                <a v-if="proyecto.info_tecnica?.url_ubicacion" :href="proyecto.info_tecnica.url_ubicacion"
                   target="_blank" rel="noopener"
                   class="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                  <MapPinIcon class="size-[1em]" /> Ver en Google Maps
                </a>
              </div>
            </div>
            <!-- Documentación -->
            <div v-if="proyecto.info_tecnica?.retie_url">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Documentación</p>
              <a :href="proyecto.info_tecnica.retie_url" target="_blank" rel="noopener"
                 class="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                <FileIcon class="size-[1em]" /> RETIE
              </a>
            </div>
            <!-- Eléctrico general -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">General</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Potencia AC (kW)" :value="proyecto.info_tecnica?.potencia_ac_kw" />
                <InfoField label="Capacidad instalada (kWp)" :value="proyecto.info_tecnica?.capacidad_instalada_kwp" />
                <InfoField label="Voltaje red" :value="proyecto.info_tecnica?.voltaje_red" />
                <InfoField label="Tipo tracker" :value="proyecto.info_tecnica?.tipo_tracker" />
                <InfoField label="Producción específica (kWh/kWp)" :value="proyecto.produccion_especifica_kwh_kwp" />
                <InfoField label="Latitud" :value="proyecto.latitud" />
                <InfoField label="Longitud" :value="proyecto.longitud" />
              </div>
            </div>
            <!-- Paneles -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Paneles</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Cantidad de paneles" :value="proyecto.info_tecnica?.cantidad_total_paneles" />
                <InfoField label="Potencia panel (kWp)" :value="proyecto.info_tecnica?.potencia_panel_kwp" />
                <InfoField label="Marca paneles" :value="proyecto.info_tecnica?.marca_paneles" />
              </div>
            </div>
            <!-- Inversores -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Inversores</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Cantidad inversores" :value="proyecto.info_tecnica?.cantidad_inversores" />
                <InfoField label="Potencia inversores (kWp)" :value="proyecto.info_tecnica?.potencia_inversores_kwp" />
                <InfoField label="Marca inversores" :value="proyecto.info_tecnica?.marca_inversores" />
                <InfoField label="Cantidad strings" :value="proyecto.info_tecnica?.cantidad_strings" />
              </div>
            </div>
            <!-- Equipos -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Marcas de equipos</p>
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
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">CCTV y seguridad</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Estado CCTV" :value="proyecto.info_tecnica?.cctv_estado" />
                <InfoField label="Marca CCTV" :value="proyecto.info_tecnica?.marca_cctv" />
                <InfoField label="Seguridad física" :value="proyecto.info_tecnica?.seguridad_fisica" />
                <InfoField label="Internet" :value="proyecto.info_tecnica?.tiene_internet" />
              </div>
            </div>
            <!-- Almacenamiento -->
            <div v-if="proyecto.info_tecnica?.tiene_almacenamiento">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Almacenamiento</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Capacidad (kWh)" :value="proyecto.info_tecnica?.capacidad_almacenamiento_kwh" />
                <InfoField label="Marca" :value="proyecto.info_tecnica?.marca_almacenamiento" />
                <InfoField label="Modelo" :value="proyecto.info_tecnica?.modelo_almacenamiento" />
              </div>
            </div>
          </template>

          <!-- Vista edición -->
          <template v-else>
            <!-- Ubicación -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ubicación</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Latitud</label>
                  <InputNumber v-model="editForm.latitud" :maxFractionDigits="6" locale="en-US" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Longitud</label>
                  <InputNumber v-model="editForm.longitud" :maxFractionDigits="6" locale="en-US" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Dirección</label>
                  <InputText v-model="editForm.direccion_vereda" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Link Google Maps</label>
                  <InputText v-model="editInfoTecnica.url_ubicacion" class="w-full" placeholder="https://maps.app.goo.gl/..." />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">RETIE (link Drive)</label>
                  <InputText v-model="editInfoTecnica.retie_url" class="w-full" placeholder="https://drive.google.com/..." />
                </div>
              </div>
            </div>
            <!-- Eléctrico general -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">General</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Potencia AC (kW)</label>
                  <InputNumber v-model="editInfoTecnica.potencia_ac_kw" :maxFractionDigits="3" locale="en-US" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Capacidad instalada (kWp)</label>
                  <InputNumber v-model="editInfoTecnica.capacidad_instalada_kwp" :maxFractionDigits="3" locale="en-US" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Voltaje red</label>
                  <InputText v-model="editInfoTecnica.voltaje_red" class="w-full" placeholder="ej: 13.8/800" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Tipo tracker</label>
                  <Select v-model="editInfoTecnica.tipo_tracker" :options="['1P','2P']" class="w-full" showClear placeholder="Seleccionar" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Producción específica (kWh/kWp)</label>
                  <InputNumber v-model="editForm.produccion_especifica_kwh_kwp" :maxFractionDigits="2" locale="en-US" class="w-full" />
                </div>
              </div>
            </div>
            <!-- Paneles -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Paneles</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Cantidad de paneles</label>
                  <InputNumber v-model="editInfoTecnica.cantidad_total_paneles" :useGrouping="false" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Potencia panel (kWp)</label>
                  <InputText v-model="editInfoTecnica.potencia_panel_kwp" class="w-full" placeholder="ej: 0.58" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Marca paneles</label>
                  <InputText v-model="editInfoTecnica.marca_paneles" class="w-full" />
                </div>
              </div>
            </div>
            <!-- Inversores -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Inversores</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Cantidad inversores</label>
                  <InputNumber v-model="editInfoTecnica.cantidad_inversores" :useGrouping="false" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Potencia inversores (kWp)</label>
                  <InputText v-model="editInfoTecnica.potencia_inversores_kwp" class="w-full" placeholder="ej: 300, 50 y 40" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Marca inversores</label>
                  <InputText v-model="editInfoTecnica.marca_inversores" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Cantidad strings</label>
                  <InputNumber v-model="editInfoTecnica.cantidad_strings" :useGrouping="false" class="w-full" />
                </div>
              </div>
            </div>
            <!-- Equipos -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Marcas de equipos</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Transformador</label>
                  <InputText v-model="editInfoTecnica.marca_transformador" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Reconectador / Relé</label>
                  <InputText v-model="editInfoTecnica.marca_reconectador_rele" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Totalizador</label>
                  <InputText v-model="editInfoTecnica.marca_totalizador" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Seguidor solar</label>
                  <InputText v-model="editInfoTecnica.marca_seguidor_solar" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Medidores frontera</label>
                  <InputText v-model="editInfoTecnica.marca_medidores_frontera" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Módem reconectador/relé</label>
                  <InputText v-model="editInfoTecnica.marca_modem_reconectador" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Módems frontera</label>
                  <InputText v-model="editInfoTecnica.marca_modems_frontera" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">IP módem reconectador</label>
                  <InputText v-model="editInfoTecnica.ip_modem_reconectador" class="w-full" />
                </div>
              </div>
            </div>
            <!-- CCTV y seguridad -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">CCTV y seguridad</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1 md:col-span-2">
                  <label class="field-label">Estado CCTV</label>
                  <InputText v-model="editInfoTecnica.cctv_estado" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Marca CCTV</label>
                  <InputText v-model="editInfoTecnica.marca_cctv" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Seguridad física</label>
                  <InputText v-model="editInfoTecnica.seguridad_fisica" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Internet</label>
                  <Select v-model="editInfoTecnica.tiene_internet" :options="['Sí','No']" class="w-full" showClear placeholder="Seleccionar" />
                </div>
              </div>
            </div>
            <!-- Almacenamiento -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Almacenamiento</p>
                <Checkbox v-model="editInfoTecnica.tiene_almacenamiento" binary />
                <span class="text-xs text-gray-500">{{ editInfoTecnica.tiene_almacenamiento ? 'Sí' : 'No' }}</span>
              </div>
              <div v-if="editInfoTecnica.tiene_almacenamiento" class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Capacidad (kWh)</label>
                  <InputNumber v-model="editInfoTecnica.capacidad_almacenamiento_kwh" :maxFractionDigits="3" locale="en-US" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Marca</label>
                  <InputText v-model="editInfoTecnica.marca_almacenamiento" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Modelo</label>
                  <InputText v-model="editInfoTecnica.modelo_almacenamiento" class="w-full" />
                </div>
              </div>
            </div>
          </template>

        </div>
      </div>

      <!-- ══ SIMULACIÓN ══ -->
      <div v-if="tab === 'simulacion'">
        <div class="p-4 space-y-6">
          <div v-if="!isEditMode && hasSimulacionData" class="flex justify-end">
            <Button label="Descargar Excel" size="small" outlined severity="success" @click="descargarSimulacionExcel">
              <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
            </Button>
          </div>
          <div v-for="sim in SIMULACIONES" :key="sim.key">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {{ sim.label }} <span class="normal-case font-normal">(kWh/mes)</span>
            </p>
            <div class="grid grid-cols-6 gap-2">
              <div v-for="(mes, i) in MESES" :key="sim.key + '-' + i">
                <label class="block text-[10px] text-gray-400 mb-0.5 text-center">{{ mes }}</label>
                <InputNumber
                  v-if="isEditMode"
                  v-model="sim.editArray.value[i]"
                  :maxFractionDigits="1"
                  locale="en-US"
                  class="w-full"
                  inputClass="text-center text-xs px-1 py-1"
                />
                <p v-else class="text-center text-sm font-semibold text-gray-800 bg-gray-50 rounded py-1.5 px-1 tabular-nums">
                  {{ sim.displayArray.value[i] != null ? Math.round(sim.displayArray.value[i]).toLocaleString('es-CO') : '—' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ INVERSIONISTAS ══ -->
      <div v-if="tab === 'inversionistas'">
        <div class="p-4 space-y-4">
          <DataTable :value="proyecto.inversionistas" class="text-sm" stripedRows>
            <Column field="cliente_nombre" header="Inversionista" />
            <Column header="Participación (%)">
              <template #body="{ data }">
                <template v-if="editandoInvId === data.id">
                  <InputNumber v-model="editPct" :min="0" :max="100" :minFractionDigits="2" :maxFractionDigits="7"
                    suffix="%" locale="en-US" class="w-32" />
                </template>
                <template v-else>
                  {{ data.porcentaje_participacion != null ? (data.porcentaje_participacion * 100).toFixed(4) + '%' : '—' }}
                </template>
              </template>
            </Column>
            <Column header="Inicio" style="width:170px">
              <template #body="{ data }">
                <DatePicker v-if="editandoInvId === data.id" v-model="editFechaInicio" dateFormat="yy-mm-dd"
                  showIcon showClear class="w-40" placeholder="—" />
                <span v-else>{{ fmtFecha(data.fecha_inicio) }}</span>
              </template>
            </Column>
            <Column header="Fin" style="width:170px">
              <template #body="{ data }">
                <DatePicker v-if="editandoInvId === data.id" v-model="editFechaFin" dateFormat="yy-mm-dd"
                  showIcon showClear class="w-40" placeholder="Vigente" />
                <span v-else>{{ data.fecha_fin ? fmtFecha(data.fecha_fin) : 'Vigente' }}</span>
              </template>
            </Column>
            <Column header="Patrimonio autónomo">
              <template #body="{ data }">
                <GBadge :color="data.es_patrimonio_autonomo ? 'information' : 'default'">{{ data.es_patrimonio_autonomo ? 'Sí' : 'No' }}</GBadge>
              </template>
            </Column>
            <Column header="" style="width:110px">
              <template #body="{ data }">
                <div class="flex gap-1">
                  <template v-if="editandoInvId === data.id">
                    <Button text severity="success" size="small" :loading="guardando" @click="guardarEdicionInversionista(data.id)" v-tooltip="'Guardar'">
                      <template #icon><CheckIcon class="size-[1em]" /></template>
                    </Button>
                    <Button text severity="secondary" size="small" @click="editandoInvId = null" v-tooltip="'Cancelar'">
                      <template #icon><XIcon class="size-[1em]" /></template>
                    </Button>
                  </template>
                  <template v-else>
                    <Button text severity="info" size="small" @click="iniciarEdicionInversionista(data)" v-tooltip="'Editar'">
                      <template #icon><PencilIcon class="size-[1em]" /></template>
                    </Button>
                    <Button text severity="danger" size="small" @click="eliminarInversionista(data.id)" v-tooltip="'Eliminar'">
                      <template #icon><Trash2Icon class="size-[1em]" /></template>
                    </Button>
                  </template>
                </div>
              </template>
            </Column>
            <template #empty>
              <p class="text-center text-gray-400 py-4">Sin inversionistas registrados.</p>
            </template>
            <ColumnGroup type="footer">
              <Row>
                <Column footer="Total" footerStyle="font-weight:600" />
                <Column :footer="tieneVariosPeriodos ? '— (ver períodos)' : totalParticipacion.toFixed(4) + '%'"
                  footerStyle="font-weight:600" />
                <Column />
                <Column />
                <Column />
                <Column />
              </Row>
            </ColumnGroup>
          </DataTable>

          <!-- Histórico por período (cuando hay inversionistas de distintas fechas) -->
          <div v-if="tieneVariosPeriodos" class="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Histórico por período
              <span class="normal-case font-normal text-gray-400">— el 100% se valida dentro de cada período, no sobre todo el histórico</span>
            </p>
            <div v-for="per in periodos" :key="per.key"
              class="flex items-center justify-between text-sm border-t border-gray-100 pt-1 first:border-0 first:pt-0">
              <span class="text-gray-600">
                {{ per.label }}
                <GBadge v-if="per.vigente" color="success" class="ml-2 scale-90">Vigente</GBadge>
                <span class="text-gray-400 ml-1">· {{ per.count }} inversionista(s)</span>
              </span>
              <span class="font-semibold tabular-nums" :class="per.ok ? 'text-green-600' : 'text-amber-600'">
                {{ per.total.toFixed(2) }}%
                <TriangleAlertIcon class="text-xs ml-1 size-[1em]" v-if="!per.ok" v-tooltip.left="'No suma ~100% en este período'" />
              </span>
            </div>
          </div>

          <Divider />
          <p class="font-semibold text-gray-700">Agregar inversionista</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Cliente</label>
              <Select v-model="nuevoInv.cliente_id" :options="clientesDisponibles"
                optionLabel="razon_social_nombre" optionValue="id"
                placeholder="Seleccionar cliente" filter class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Porcentaje de participación (%)</label>
              <InputNumber v-model="nuevoInv.porcentaje_pct" :min="0" :max="100"
                :minFractionDigits="2" :maxFractionDigits="7" suffix="%" locale="en-US" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Fecha inicio</label>
              <DatePicker v-model="nuevoInv.fecha_inicio" dateFormat="yy-mm-dd" showIcon showClear
                class="w-full" placeholder="—" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Fecha fin (opcional = vigente)</label>
              <DatePicker v-model="nuevoInv.fecha_fin" dateFormat="yy-mm-dd" showIcon showClear
                class="w-full" placeholder="Vigente" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500">Patrimonio autónomo</label>
              <div class="flex items-center gap-2 h-10">
                <ToggleSwitch v-model="nuevoInv.es_patrimonio_autonomo" />
                <span class="text-sm text-gray-600">{{ nuevoInv.es_patrimonio_autonomo ? 'Sí' : 'No' }}</span>
              </div>
            </div>
          </div>
          <Button label="Agregar" :loading="guardando" :disabled="!nuevoInv.cliente_id" @click="agregarInversionista" class="mt-2">
            <template #icon><PlusIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>

      <!-- ══ CONTACTOS ══ -->
      <div v-if="tab === 'contactos'">
        <div class="p-4">
          <ProyectoAreaContactosPanel
            :proyecto-id="proyecto.id"
            :inversionistas="proyecto.inversionistas"
            :clientes-options="clientes"
          />
        </div>
      </div>

      <!-- ══ SERVICIOS ══ -->
      <div v-if="tab === 'servicios'">
        <div class="p-6 space-y-4">

          <!-- Cards de servicio -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              v-for="srv in SERVICIOS_CARDS" :key="srv.key"
              class="relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 select-none"
              :class="srvExpanded === srv.key ? 'ring-2 ring-offset-1 shadow-md' : (srvFlags[srv.key] ? 'shadow-sm' : '')"
              :style="srvFlags[srv.key] || srvExpanded === srv.key
                ? `background:${srv.bg}; border-color:${srv.color}40`
                : 'background:#f9fafb; border-color:#e5e7eb'"
              @click="clickServicio(srv)"
            >
              <div class="w-12 h-12 rounded-full flex items-center justify-center"
                :style="`background:${(srvFlags[srv.key] || srvExpanded === srv.key) ? srv.color + '25' : '#e5e7eb'}`">
                <component :is="srv.icon" class="text-2xl size-[1em]" :style="`color:${(srvFlags[srv.key] || srvExpanded === srv.key) ? srv.color : '#9ca3af'}`" />
              </div>
              <span class="text-sm font-semibold text-center"
                :style="`color:${(srvFlags[srv.key] || srvExpanded === srv.key) ? srv.color : '#6b7280'}`">
                {{ srv.label }}
              </span>
              <span v-if="srvFlags[srv.key]"
                class="absolute top-2 right-2 w-2 h-2 rounded-full"
                :style="`background:${srv.color}`" />
              <ExternalLinkIcon class="absolute bottom-2 right-2 text-xs text-gray-300 size-[1em]" v-if="srv.key === 'srv_ppa'" />
            </div>
          </div>

          <!-- Panel inline de contratos -->
          <div v-if="srvExpanded" class="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div class="flex items-center gap-2">
                <component :is="SERVICIOS_CARDS.find(s => s.key === srvExpanded)?.icon" class="text-sm size-[1em]" :style="`color:${SERVICIOS_CARDS.find(s => s.key === srvExpanded)?.color}`" />
                <p class="text-sm font-semibold text-gray-700">
                  Contratos · {{ SERVICIOS_CARDS.find(s => s.key === srvExpanded)?.label }}
                </p>
              </div>
              <Button label="Nuevo contrato" size="small" :style="`background:${SERVICIOS_CARDS.find(s => s.key === srvExpanded)?.color}; border-color:${SERVICIOS_CARDS.find(s => s.key === srvExpanded)?.color}`" @click="showContratoWizard = true">
                <template #icon><PlusIcon class="size-[1em]" /></template>
              </Button>
            </div>
            <DataTable
              :value="contratosInline"
              :loading="loadingInline"
              stripedRows
              class="text-sm"
              rowHover
              emptyMessage="Sin contratos registrados para este proyecto."
              @row-click="(e) => $router.push(`/contratos/${e.data.id}`)"
            >
              <Column field="numero_contrato" header="N° contrato" style="width:140px">
                <template #body="{ data }">
                  <span class="font-mono text-xs text-gray-500">{{ data.numero_contrato || '—' }}</span>
                </template>
              </Column>
              <Column header="Contratante">
                <template #body="{ data }">{{ data.contratante_nombre || '—' }}</template>
              </Column>
              <Column header="Prestador">
                <template #body="{ data }">{{ data.prestador_nombre || '—' }}</template>
              </Column>
              <Column field="fecha_inicio" header="Inicio" style="width:95px">
                <template #body="{ data }">{{ formatFechaSrv(data.fecha_inicio) }}</template>
              </Column>
              <Column field="fecha_fin" header="Fin" style="width:95px">
                <template #body="{ data }">{{ formatFechaSrv(data.fecha_fin) }}</template>
              </Column>
              <Column header="Estado" style="width:120px">
                <template #body="{ data }">
                  <GBadge :color="ESTADO_SEVERITY_SRV[data.estado]">{{ ESTADO_LABELS_SRV[data.estado] || data.estado }}</GBadge>
                </template>
              </Column>
              <Column style="width:50px">
                <template #body="{ data }">
                  <Button text size="small" severity="secondary" @click.stop="$router.push(`/contratos/${data.id}`)">
                    <template #icon><ArrowRightIcon class="size-[1em]" /></template>
                  </Button>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Activar / desactivar servicios -->
          <div class="pt-2 border-t border-gray-100">
            <p class="text-xs text-gray-400 mb-3">Activar / desactivar servicios</p>
            <div class="flex flex-wrap gap-3">
              <div v-for="srv in SERVICIOS_FLAGS" :key="srv.key + '_toggle'"
                class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <ToggleSwitch v-model="srvFlags[srv.key]" @change="toggleServicio(srv.key, srvFlags[srv.key])" />
                <span class="text-xs text-gray-600">{{ srv.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Wizard nuevo contrato de servicio -->
        <ContratoServicioWizard
          v-if="showContratoWizard"
          :visible="showContratoWizard"
          :tipo="SERVICIOS_CARDS.find(s => s.key === srvExpanded)?.tipo ?? 'rec'"
          :proyecto-id-default="Number(route.params.id)"
          @cerrar="showContratoWizard = false"
          @creado="onContratoServicioCreado"
        />
      </div>

      <!-- ══ FRONTERAS ══ -->
      <div v-if="tab === 'fronteras'">
        <div class="p-4">
          <DataTable :value="fronteras" class="text-sm" stripedRows>
            <Column field="codigo_frontera" header="Código">
              <template #body="{ data }">{{ data.codigo_frontera || '—' }}</template>
            </Column>
            <Column field="nombre_frontera" header="Nombre" />
            <Column field="tipo_frontera" header="Tipo" />
            <Column header="Estado">
              <template #body="{ data }">
                <GBadge :color="FRONTERA_ESTADO_SEVERITY[data.estado] || 'information'">{{ data.estado }}</GBadge>
              </template>
            </Column>
          </DataTable>
          <p class="text-xs mt-3" style="color: #9b89b5;">
            Ve a la pestaña Fronteras del menú si deseas reasignar el proyecto.
          </p>
        </div>
      </div>

      <!-- ══ ID LIQUIDACIONES ══ -->
      <div v-if="tab === 'id-liquidaciones'">
        <div class="p-4 space-y-3 text-sm">
          <p class="text-[11px] text-gray-400">
            <InfoIcon class="mr-1 size-[1em]" />
            Estos códigos viven en la API de Liquidaciones de Unergy, no en esta base.
            <span v-if="liqConfig?.nombre_topico"> Tópico: <b>{{ liqConfig.nombre_topico }}</b>.</span>
          </p>

          <div v-if="!proyecto.sub_project && !proyecto.topico_liquidaciones" class="rounded-lg px-3 py-2 text-xs"
               style="background:#FEF3C7; color:#92400E">
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
                <label class="field-label">SIC generación</label>
                <InputText v-model="editLiq.sic_gen" class="w-full" placeholder="ej: 3A44" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="field-label">SIC consumo</label>
                <InputText v-model="editLiq.sic_con" class="w-full" placeholder="ej: 3A3P" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="field-label">Tópico en Liquidaciones</label>
                <InputText v-model="editForm.topico_liquidaciones" class="w-full"
                           :placeholder="proyecto.sub_project || 'ej: mgs18'" />
                <small class="text-[11px] text-gray-400">
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
        <div class="p-4 space-y-4 text-sm">
          <p class="text-[11px] text-gray-400">
            <InfoIcon class="mr-1 size-[1em]" />
            Estos ids viven en la API de Liquidaciones de Unergy, uno por subproyecto -- no en esta base.
          </p>

          <div v-if="!proyecto.sub_project && !proyecto.topico_liquidaciones" class="rounded-lg px-3 py-2 text-xs"
               style="background:#FEF3C7; color:#92400E">
            El proyecto no tiene <b>API ID Unergy</b> (código base), así que no se puede
            identificar en la API de Liquidaciones. Complétalo en la pestaña General.
          </div>
          <div v-else-if="!isEditMode && !(liqConfig?.subproyectos?.length)" class="text-xs text-gray-400">
            Sin subproyectos registrados en la API de Liquidaciones.
          </div>

          <template v-else-if="!isEditMode">
            <div v-for="sub in liqConfig?.subproyectos ?? []" :key="sub.topic" class="space-y-2">
              <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
            <p v-if="!editSubproyectos.length" class="text-xs text-gray-400">
              Sin subproyectos registrados en la API de Liquidaciones -- no hay dónde guardar estos ids.
            </p>
            <div v-for="sub in editSubproyectos" :key="sub.topic" class="space-y-2">
              <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {{ sub.name || sub.topic }}
              </div>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">ID Reporte Generación Quoia</label>
                  <InputText v-model="sub.quoia_report_gen_id" maxlength="4" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">ID Reporte Consumo Quoia</label>
                  <InputText v-model="sub.quoia_report_con_id" maxlength="4" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">ID de Nodo Quoia</label>
                  <InputText v-model="sub.quoia_node_id" maxlength="50" class="w-full" />
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
    <ProgressSpinner />
  </div>

  <div v-else class="flex flex-col items-center py-20 gap-3 text-gray-500">
    <CircleAlertIcon class="text-3xl text-red-400 size-[1em]" />
    <p class="text-sm">{{ errorMsg || 'No se pudo cargar el proyecto.' }}</p>
    <Button label="Reintentar" outlined size="small" @click="$router.go(0)">
      <template #icon><RefreshCwIcon class="size-[1em]" /></template>
    </Button>
  </div>
</template>

<script setup>
import { ArrowRightIcon, BadgeCheckIcon, BriefcaseIcon, ChartColumnIcon, ChartLineIcon, CheckIcon, CircleAlertIcon, DollarSignIcon, ExternalLinkIcon, FileIcon, FilePenIcon, FileSpreadsheetIcon, GlobeIcon, InfoIcon, LinkIcon, MailIcon, MapPinIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon, UsersIcon, WrenchIcon, XIcon, ZapIcon } from '@lucide/vue'
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ColumnGroup from 'primevue/columngroup'
import Row from 'primevue/row'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Divider from 'primevue/divider'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ClientesService } from '~/features/clientes/services/clientes'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { LiquidacionesApiService } from '~/features/liquidaciones/services/liquidaciones-api'
import divipola from '~/data/colombia-divipola.json'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'
import ProyectoAreaContactosPanel from '~/features/proyectos/components/ProyectoAreaContactosPanel.vue'
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
const SERVICIOS_CARDS = [
  { key: 'srv_ppa',           label: 'PPA',           icon: ZapIcon,       color: '#f59e0b', bg: '#fef3c7', tipo: null },
  { key: 'srv_operacion',     label: 'Operación',     icon: WrenchIcon,     color: '#10b981', bg: '#ecfdf5', tipo: null },
  { key: 'srv_representacion',label: 'Representación', icon: FilePenIcon,  color: '#3b82f6', bg: '#eff6ff', tipo: 'representacion' },
  { key: 'srv_rec',           label: 'REC',           icon: BadgeCheckIcon,   color: '#14b8a6', bg: '#f0fdfa', tipo: 'rec' },
]
const SERVICIOS_FLAGS = [
  ...SERVICIOS_CARDS,
  { key: 'srv_cgm',     label: 'CGM',     icon: ChartColumnIcon, color: '#10b981', bg: '#ecfdf5' },
  { key: 'srv_promotor',label: 'Promotor',icon: BriefcaseIcon, color: '#8b5cf6', bg: '#f5f3ff' },
]
const ESTADO_LABELS_SRV = { vigente: 'Vigente', vencido: 'Vencido', terminado: 'Terminado', en_renovacion: 'En renovación' }
const ESTADO_SEVERITY_SRV = { vigente: 'success', vencido: 'destructive', terminado: 'default', en_renovacion: 'warning' }
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
const srvFlags = reactive({})
const srvExpanded = ref(null)
const contratosInline = ref([])
const loadingInline = ref(false)
const showContratoWizard = ref(false)

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
  potencia_instalada_kwp: null,
  departamento: null,
  municipio: null,
  latitud: null,
  longitud: null,
  operador_red_id: null,
  clasificacion_regulatoria: null,
  carpeta_drive_codigo: null,
  sub_project: null,
  codigo_tsf: null,
  topico_liquidaciones: null,
  produccion_especifica_kwh_kwp: null,
  es_comunidad_energetica: false,
  nombre_comunidad: '',
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
  retie_url: null,
  cctv_estado: null,
  marca_cctv: null,
  seguridad_fisica: null,
  tiene_internet: null,
  tiene_almacenamiento: false,
  capacidad_almacenamiento_kwh: null,
  marca_almacenamiento: null,
  modelo_almacenamiento: null,
})

// Fechas del proyecto (DatePicker trabaja con Date; el API espera 'YYYY-MM-DD')
const editFechaEntrada = ref(null)
const editFechaComerc = ref(null)
const editFechaFinRep = ref(null)

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function toDate(v) {
  if (!v) return null
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d) // medianoche local (evita corrimiento de zona horaria)
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
      [`Potencia AC instalada: ${proyecto.value.potencia_instalada_kwp ?? '—'} kW`],
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
  editFechaEntrada.value = toDate(p.fecha_entrada_operacion)
  editFechaComerc.value = toDate(p.fecha_inicio_comercializacion)
  editFechaFinRep.value = toDate(p.fecha_fin_representacion)
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

async function saveEdit() {
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
    payload.es_comunidad_energetica = !!editForm.es_comunidad_energetica
    payload.nombre_comunidad = editForm.es_comunidad_energetica ? (editForm.nombre_comunidad || null) : null

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
  editFechaInicio.value = toDate(inv.fecha_inicio)
  editFechaFin.value = toDate(inv.fecha_fin)
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

// ── Servicios ─────────────────────────────────────────────────────────────────
async function toggleServicio(key, value) {
  try {
    await proyectosService.alternarServicio(route.params.id, { [key]: value })
    const [proy, inversionistas] = await Promise.all([
      proyectosService.obtener(route.params.id),
      proyectosService.listarInversionistas(route.params.id),
    ])
    proyecto.value = { ...proy, inversionistas }
    toast.success('Servicio actualizado', { duration: 2000 })
  } catch {
    srvFlags[key] = !value
    toast.error('Error al actualizar', { duration: 3000 })
  }
}

function clickServicio(srv) {
  if (srv.key === 'srv_ppa') {
    router.push(`/proyectos/${route.params.id}/ppa`)
    return
  }
  if (srv.key === 'srv_operacion') {
    router.push(`/proyectos/${route.params.id}/operacion`)
    return
  }
  if (srv.key === 'srv_representacion') {
    router.push(`/proyectos/${route.params.id}/representacion`)
    return
  }
  if (!srv.tipo) return
  if (srvExpanded.value === srv.key) {
    srvExpanded.value = null
    return
  }
  srvExpanded.value = srv.key
  cargarContratosInline(srv.tipo)
}

async function cargarContratosInline(tipo) {
  contratosInline.value = []
  loadingInline.value = true
  try {
    contratosInline.value = await proyectosService.listarContratosServicioInline(tipo, route.params.id)
  } catch {
    toast.error('Error al cargar contratos', { duration: 3000 })
  } finally {
    loadingInline.value = false
  }
}

function onContratoServicioCreado() {
  const srv = SERVICIOS_CARDS.find(s => s.key === srvExpanded.value)
  if (srv?.tipo) cargarContratosInline(srv.tipo)
}

function formatFechaSrv(f) {
  if (!f) return '—'
  return String(f).slice(0, 10)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const estadoSeverity = (e) => (
  { en_operacion: 'success', en_desarrollo: 'information', suspendido: 'warning', cancelado: 'default' }[e] || 'default'
)

// Departamento/municipio -- select en vez de texto libre (DIVIPOLA), para
// evitar variantes de escritura que luego no se puedan agrupar/filtrar bien.
const departamentos = Object.keys(divipola).sort()
const municipiosDisponibles = computed(() => editForm.departamento ? (divipola[editForm.departamento] || []) : [])
watch(() => editForm.departamento, (nuevo, anterior) => {
  if (nuevo !== anterior && editForm.municipio && !(divipola[nuevo] || []).includes(editForm.municipio)) {
    editForm.municipio = null
  }
})

// Catálogo de operadores de red -- select en vez de texto libre, para que
// coincida con el vínculo real que usa Reporte CGM (Frontera.operador_red_id).
const operadoresRed = ref([])
const operadoresRedOptions = computed(() =>
  operadoresRed.value.map(o => ({ id: o.id, label: o.nombre_comercial || o.nombre_legal }))
)

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
    for (const s of SERVICIOS_FLAGS) srvFlags[s.key] = proy[s.key]
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
      <p class="text-xs text-gray-400 uppercase tracking-wide">{{ props.label }}</p>
      <p class="text-gray-800 font-medium mt-0.5">{{ props.value ?? '—' }}</p>
    </div>
  `,
}
export default { components: { InfoField } }
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
