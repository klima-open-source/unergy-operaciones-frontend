<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal
    :style="{ width: '800px' }" :breakpoints="{ '860px': '95vw' }"
    :header="null" :closable="true" @hide="$emit('cerrar')">

    <!-- Step indicator -->
    <div class="px-6 pt-5 pb-4 border-b border-gray-100">
      <p class="text-sm font-bold mb-4" :style="`color:${tipoColor}`">
        Nuevo contrato · {{ tipoLabel }}
      </p>
      <div class="flex items-start">
        <template v-for="(s, i) in STEPS" :key="i">
          <div class="flex flex-col items-center gap-1.5" style="flex:1">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              :style="step >= i ? `background:${tipoColor}; color:white` : 'background:#f3f4f6; color:#9ca3af'">
              <CheckIcon class="text-xs size-[1em]" v-if="step > i" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-[10px] text-center leading-tight px-0.5 font-medium"
              :style="step === i ? `color:${tipoColor}` : ''"
              :class="step < i ? 'text-gray-300' : step > i ? 'text-gray-500' : ''">
              {{ s.label }}
            </span>
          </div>
          <div v-if="i < STEPS.length - 1" class="h-0.5 mt-3.5 mx-0.5 transition-all" style="flex:1"
            :style="step > i ? `background:${tipoColor}60` : 'background:#f3f4f6'" />
        </template>
      </div>
    </div>

    <!-- Content -->
    <div class="px-6 py-5 min-h-72">

      <!-- PASO 0 (internet): solo los datos técnicos del servicio -->
      <template v-if="step === 0 && tipo === 'internet'">
        <p class="step-title">Datos del servicio</p>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Plan de datos</label>
              <InputText v-model="form.plan_datos_gb" class="w-full" placeholder="50 GB / Ilimitado" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Velocidad contratada</label>
              <InputNumber v-model="form.velocidad_mbps" suffix=" Mbps" :useGrouping="false" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Tipo de conexión</label>
            <Select v-model="form.tipo_conexion"
              :options="[{label:'Starlink',value:'Starlink'},{label:'Fibra',value:'Fibra'},{label:'4G',value:'4G'},{label:'Otro',value:'Otro'}]"
              optionLabel="label" optionValue="value" editable placeholder="Selecciona…" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Línea de servicio</label>
              <InputText v-model="form.linea_servicio" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">ID del router</label>
              <InputText v-model="form.id_router" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Número de kit</label>
              <InputText v-model="form.numero_kit" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Latencia</label>
              <InputNumber v-model="form.latencia_ms" suffix=" ms" :useGrouping="false" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Seguridad del wifi</label>
              <Select v-model="form.wifi_seguridad" :options="WIFI_SEGURIDAD_OPTS"
                optionLabel="label" optionValue="value" showClear placeholder="Selecciona…" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Contraseña wifi</label>
              <InputText v-model="form.wifi_password" class="w-full" />
            </div>
          </div>

          <!-- Ubicación del servicio -->
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-xs font-semibold text-gray-500">Ubicación del servicio</p>
                <p class="text-sm text-gray-700">Ubicación: {{ ubicacionLabel }}</p>
              </div>
              <Button type="button" :label="editandoUbicacion ? 'Listo' : 'Editar'" text size="small"
                @click="editandoUbicacion = !editandoUbicacion" />
            </div>
            <div v-if="editandoUbicacion" class="grid grid-cols-2 gap-4 mb-2">
              <div class="flex flex-col gap-1">
                <label class="field-label">Latitud</label>
                <InputNumber v-model="form.ubicacion_lat" :minFractionDigits="4" :maxFractionDigits="6" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="field-label">Longitud</label>
                <InputNumber v-model="form.ubicacion_lng" :minFractionDigits="4" :maxFractionDigits="6" class="w-full" />
              </div>
            </div>
            <p v-if="editandoUbicacion" class="text-xs text-gray-400 mb-2">
              Haz clic en el mapa para ubicar el servicio.
            </p>
            <div ref="ubicacionMapEl" class="rounded-md overflow-hidden" style="height:220px; background:#e5e3df"></div>
          </div>
        </div>
      </template>

      <!-- PASO 0: Identificación -->
      <template v-if="step === 0 && tipo !== 'internet'">
        <p class="step-title">Identificación del contrato</p>
        <div class="space-y-4">
          <div class="flex flex-col gap-1">
            <label class="field-label">Proyecto asociado <span class="text-gray-400">(opcional)</span></label>
            <Select
              v-model="form.proyecto_id"
              :options="todosProyectos"
              optionLabel="nombre_comercial"
              optionValue="id"
              placeholder="Seleccionar proyecto"
              filter
              filterPlaceholder="Buscar…"
              showClear
              class="w-full"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Número de contrato</label>
              <InputText v-model="form.numero_contrato" placeholder="Ej: REP-001-2024" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Estado</label>
              <Select v-model="form.estado" :options="ESTADOS" optionLabel="label" optionValue="value" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha firma <span class="text-gray-400">(opcional)</span></label>
              <DatePicker v-model="form.fecha_firma_contrato" dateFormat="yy-mm-dd" class="w-full" showClear />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Estado del pago <span class="text-gray-400">(opcional)</span></label>
              <Select v-model="form.estado_pago" :options="[{label:'Pendiente',value:'pendiente'},{label:'Revisado',value:'revisado'},{label:'Aprobado',value:'aprobado'}]"
                optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Enlace contrato en Drive <span class="text-gray-400">(opcional)</span></label>
            <InputText v-model="form.enlace_drive" placeholder="https://drive.google.com/…" class="w-full" />
          </div>
        </div>
      </template>

      <!-- PASO 1: Partes -->
      <template v-if="step === 1 && tipo !== 'internet'">
        <p class="step-title">Partes del contrato</p>
        <div class="grid grid-cols-2 gap-1 mb-1 px-1">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contratante</span>
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Prestador</span>
        </div>
        <div class="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50">
          <!-- Contratante -->
          <div class="space-y-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Nombre / Razón social</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="form.contratante_nombre"
                  :suggestions="contratantesFiltrados"
                  @complete="buscarCliente($event, 'contratante')"
                  @item-select="seleccionarCliente($event, 'contratante')"
                  @clear="limpiarParte('contratante')"
                  placeholder="Buscar cliente existente…"
                  class="flex-1"
                  inputClass="w-full"
                />
                <Button severity="secondary" outlined size="small" v-tooltip="'Crear nuevo cliente'" @click="abrirNuevoCliente('contratante')">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <div v-if="form.contratante_id" class="flex items-center gap-1 text-xs text-green-600">
                <LinkIcon class="text-xs size-[1em]" /> Cliente vinculado (id {{ form.contratante_id }})
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">NIT</label>
              <InputText v-model="form.contratante_nit" class="w-full" placeholder="Autocompletado" />
            </div>
          </div>
          <!-- Prestador -->
          <div class="space-y-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Nombre / Razón social</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="form.prestador_nombre"
                  :suggestions="prestadoresFiltrados"
                  @complete="buscarCliente($event, 'prestador')"
                  @item-select="seleccionarCliente($event, 'prestador')"
                  @clear="limpiarParte('prestador')"
                  placeholder="Buscar cliente existente…"
                  class="flex-1"
                  inputClass="w-full"
                />
                <Button severity="secondary" outlined size="small" v-tooltip="'Crear nuevo cliente'" @click="abrirNuevoCliente('prestador')">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <div v-if="form.prestador_id" class="flex items-center gap-1 text-xs text-green-600">
                <LinkIcon class="text-xs size-[1em]" /> Cliente vinculado (id {{ form.prestador_id }})
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">NIT</label>
              <InputText v-model="form.prestador_nit" class="w-full" placeholder="Autocompletado" />
            </div>
          </div>
        </div>

        <!-- Dialog nuevo cliente (dentro del mismo dialog) -->
        <NuevoClienteDialog
          v-model:visible="showNuevoCliente"
          @creado="onClienteCreado"
        />
      </template>

      <!-- PASO 2: Términos económicos -->
      <template v-if="step === 2 && tipo !== 'internet'">
        <p class="step-title">Términos económicos</p>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha inicio</label>
              <DatePicker v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha fin</label>
              <DatePicker v-model="form.fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Tarifa base (COP/kWh)</label>
              <InputNumber v-model="form.tarifa_base" :minFractionDigits="2" :maxFractionDigits="4" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Periodicidad de pago</label>
              <Select v-model="form.periodicidad_pago" :options="PERIODICIDADES"
                optionLabel="label" optionValue="value" showClear class="w-full" />
            </div>
          </div>

          <div class="max-w-xs">
            <div class="flex flex-col gap-1">
              <label class="field-label">Índice de indexación</label>
              <InputText v-model="form.indice_indexacion" placeholder="Ej: IPC, IPP" class="w-full" />
            </div>
          </div>

          <!-- Detalles operacionales y contractuales -->
          <div class="border-t border-gray-100 pt-3">
            <p class="text-xs font-semibold uppercase tracking-wide mb-3" :style="`color:${tipoColor}`">
              Detalles operacionales y contractuales
              <span class="normal-case font-normal text-gray-400">(opcional)</span>
            </p>
            <div class="space-y-4">
              <div class="flex flex-col gap-1">
                <label class="field-label">Alcance del servicio</label>
                <Textarea v-model="form.service_scope" rows="3" autoResize class="w-full"
                  placeholder="Describe el alcance del servicio…" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="field-label">Términos específicos del servicio</label>
                <Textarea v-model="form.specific_service_terms" rows="3" autoResize class="w-full"
                  placeholder="Términos específicos aplicables al servicio…" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="field-label">SLAs (Acuerdos de nivel de servicio)</label>
                <Textarea v-model="form.slas" rows="3" autoResize class="w-full"
                  placeholder="Acuerdos de nivel de servicio, tiempos de respuesta…" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="field-label">Responsabilidades</label>
                <Textarea v-model="form.responsibilities" rows="3" autoResize class="w-full"
                  placeholder="Responsabilidades de las partes…" />
              </div>
            </div>
          </div>

          <!-- REC extra fields at bottom of Términos -->
          <template v-if="tipo === 'rec'">
            <div class="border-t border-gray-100 pt-3">
              <p class="text-xs font-semibold uppercase tracking-wide mb-3" :style="`color:${tipoColor}`">
                Certificados REC
              </p>
              <div class="grid grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Cantidad (kWh)</label>
                  <InputNumber v-model="form.rec_cantidad" :minFractionDigits="0" :maxFractionDigits="3" locale="en-US" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Precio unitario (COP/kWh)</label>
                  <InputNumber v-model="form.rec_precio_unitario" :minFractionDigits="2" :maxFractionDigits="4" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="field-label">Vintage</label>
                  <InputText v-model="form.rec_vintage" placeholder="Ej: 2024" class="w-full" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- PASO 3: Arrendadores (solo ARRIENDO) -->
      <template v-if="tipo === 'arriendo' && step === STEPS.length - 1">
        <p class="step-title">Arrendadores</p>
        <p class="text-xs text-gray-400 mb-3">
          El contrato ya se creó. Agrega al menos un arrendador (persona/entidad que recibe el pago) antes de finalizar.
        </p>
        <div class="rounded-xl border" style="border-color:#ddd6fe">
          <div class="flex items-center justify-between px-4 py-2.5" style="background:#f5f3ff">
            <span class="text-xs font-semibold flex items-center gap-1.5" style="color:#5b21b6">
              <UsersIcon class="text-xs size-[1em]" style="color:#8b5cf6" />Arrendadores
            </span>
            <Button label="Agregar arrendador" size="small" text style="color:#8b5cf6" @click="openArrendadorDialog('crear')">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
          </div>
          <div v-if="!arrendadores.length" class="px-4 py-6 text-center text-xs text-gray-400">
            Sin arrendadores registrados.
          </div>
          <div v-else class="divide-y divide-gray-100">
            <div v-for="a in arrendadores" :key="a.id"
              class="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-semibold" style="color:#1c1917">{{ a.nombre }}</span>
                <span class="text-sm font-mono tabular-nums" style="color:#7c3aed">{{ formatCOP(a.valor_base) }}</span>
                <span v-if="a.responsable_iva" class="text-xs px-1.5 py-0.5 rounded font-bold leading-none"
                  style="background:#ede9fe;color:#7c3aed">Responsable IVA</span>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <Button size="small" text severity="secondary" @click="openArrendadorDialog('editar', a)">
                  <template #icon><PencilIcon class="size-[1em]" /></template>
                </Button>
                <Button size="small" text severity="danger" @click="eliminarArrendadorWizard(a)">
                  <template #icon><Trash2Icon class="size-[1em]" /></template>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Arrendador (crear/editar) -->
        <Dialog v-model:visible="arrendadorDialog.visible" modal
          :header="arrendadorDialog.modo === 'editar' ? 'Editar arrendador' : 'Agregar arrendador'"
          style="width: 26rem">
          <div class="flex flex-col gap-3 pt-2">
            <div>
              <label class="text-xs font-medium text-gray-600">Nombre <span class="text-red-400">*</span></label>
              <InputText v-model="arrendadorDialog.form.nombre" class="w-full" placeholder="Nombre o razón social" />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600">Valor base</label>
              <InputNumber v-model="arrendadorDialog.form.valor_base" class="w-full" mode="currency"
                currency="COP" locale="es-CO" :maxFractionDigits="0" />
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600">Responsable IVA</label>
              <Select v-model="arrendadorDialog.form.responsable_iva"
                :options="[{label:'Sí',value:true},{label:'No',value:false}]"
                optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Anticipo pagado desde</label>
              <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_desde" dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Anticipo pagado hasta</label>
              <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_hasta" dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Observaciones</label>
              <Textarea v-model="arrendadorDialog.form.observaciones" rows="2" class="w-full" />
            </div>
          </div>
          <template #footer>
            <Button label="Cancelar" text severity="secondary" @click="arrendadorDialog.visible = false" />
            <Button label="Guardar" :loading="arrendadorDialog.guardando" @click="guardarArrendadorWizard" />
          </template>
        </Dialog>
      </template>

      <!-- PASO 3: CGM (solo REPRESENTACIÓN) -->
      <template v-if="step === 3 && tipo === 'representacion'">
        <p class="step-title">CGM <span class="normal-case font-normal text-gray-400">(opcional)</span></p>
        <div class="space-y-4">
          <!-- CGM -->
          <div class="rounded-lg border border-gray-200 p-4 space-y-3">
            <div class="flex items-center gap-3">
              <ToggleSwitch v-model="form.tiene_cgm" />
              <span class="text-sm font-semibold text-gray-700">Incluye CGM</span>
              <span class="text-xs text-gray-400">(Comercializador Generador Minorista)</span>
            </div>
            <template v-if="form.tiene_cgm">
              <div class="pt-1 max-w-xs">
                <div class="flex flex-col gap-1">
                  <label class="field-label">Código SIC</label>
                  <InputText v-model="form.cgm_codigo_sic" placeholder="Ej: CGM-001" class="w-full" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>

    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
      <Button v-if="step > 0 && !contratoIdCreado" label="Anterior" severity="secondary" outlined @click="step--">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <span v-else />
      <div class="flex gap-2">
        <Button label="Cancelar" severity="secondary" text @click="$emit('cerrar')" />
        <Button v-if="tipo === 'arriendo' && step === STEPS.length - 2" label="Crear y continuar" class="flex-row-reverse"
          :loading="guardando"
          :style="`background:${tipoColor}; border-color:${tipoColor}`"
          @click="crearYContinuarArriendo">
          <template #icon><ArrowRightIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else-if="tipo === 'arriendo' && step === STEPS.length - 1" label="Finalizar" :style="`background:${tipoColor}; border-color:${tipoColor}`" @click="finalizarArriendo">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else-if="step < STEPS.length - 1" label="Siguiente" class="flex-row-reverse"
          :style="`background:${tipoColor}; border-color:${tipoColor}`"
          @click="step++">
          <template #icon><ArrowRightIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else label="Crear contrato" :loading="guardando" :style="`background:${tipoColor}; border-color:${tipoColor}`" @click="guardar">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

  </Dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Textarea from 'primevue/textarea'
import NuevoClienteDialog from '~/features/contratos/components/NuevoClienteDialog.vue'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ClientesService } from '~/features/clientes/services/clientes'
import { formatCOP } from '~/utils/currency'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LinkIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from '@lucide/vue'

const contratosServicioService = new ContratosServicioService()
const proyectosService = new ProyectosService()
const clientesService = new ClientesService()

const props = defineProps({
  visible: Boolean,
  tipo: { type: String, required: true }, // representacion | mantenimiento | arriendo | internet | rec
  proyectoIdDefault: { type: Number, default: null },
})
const emit = defineEmits(['update:visible', 'cerrar', 'creado'])

const step = ref(0)
const guardando = ref(false)
const todosProyectos = ref([])
const todosClientes = ref([])
const contratantesFiltrados = ref([])
const prestadoresFiltrados = ref([])
const showNuevoCliente = ref(false)
const nuevoClienteRol = ref('contratante')

const TIPO_CONFIG = {
  representacion: { label: 'Representación', color: '#3b82f6' },
  rec:            { label: 'REC',             color: '#14b8a6' },
  mantenimiento:  { label: 'Mantenimiento',   color: '#f59e0b' },
  arriendo:       { label: 'Arriendo',        color: '#8b5cf6' },
  internet:       { label: 'Internet',        color: '#06b6d4' },
}

const tipoColor = computed(() => TIPO_CONFIG[props.tipo]?.color ?? '#6b7280')
const tipoLabel = computed(() => TIPO_CONFIG[props.tipo]?.label ?? props.tipo)

const STEPS = computed(() => {
  if (props.tipo === 'internet') return [{ label: 'Datos del servicio' }]
  const base = [
    { label: 'Identificación' },
    { label: 'Partes' },
    { label: 'Términos' },
  ]
  if (props.tipo === 'representacion') return [...base, { label: 'CGM' }]
  if (props.tipo === 'arriendo') return [...base, { label: 'Arrendadores' }]
  return base
})

const ESTADOS = [
  { label: 'Vigente',       value: 'vigente' },
  { label: 'Vencido',       value: 'vencido' },
  { label: 'Terminado',     value: 'terminado' },
  { label: 'En renovación', value: 'en_renovacion' },
]

const PERIODICIDADES = [
  { label: 'Mensual',    value: 'mensual' },
  { label: 'Bimestral',  value: 'bimestral' },
  { label: 'Trimestral', value: 'trimestral' },
  { label: 'Anual',      value: 'anual' },
]

const form = reactive({
  proyecto_id: null,
  numero_contrato: '',
  estado: 'vigente',
  contratante_id: null,
  contratante_nombre: null,
  contratante_nit: '',
  prestador_id: null,
  prestador_nombre: null,
  prestador_nit: '',
  fecha_inicio: null,
  fecha_fin: null,
  tarifa_base: null,
  periodicidad_pago: null,
  indice_indexacion: '',
  fecha_firma_contrato: null,
  enlace_drive: '',
  estado_pago: null,
  tiene_cgm: false,
  cgm_codigo_sic: '',
  rec_cantidad: null,
  rec_precio_unitario: null,
  rec_vintage: '',
  service_scope: '',
  specific_service_terms: '',
  slas: '',
  responsibilities: '',
  plan_datos_gb: '',
  velocidad_mbps: null,
  tipo_conexion: null,
  linea_servicio: '',
  id_router: '',
  numero_kit: '',
  latencia_ms: null,
  wifi_seguridad: null,
  wifi_password: '',
  ubicacion_lat: null,
  ubicacion_lng: null,
})

const WIFI_SEGURIDAD_OPTS = [
  { label: 'WPA2',            value: 'WPA2' },
  { label: 'WPA3',            value: 'WPA3' },
  { label: 'WPA2/WPA3',       value: 'WPA2/WPA3' },
  { label: 'WPA3-OWE',        value: 'WPA3-OWE' },
  { label: 'Remoto RADIUS',   value: 'Remoto RADIUS' },
  { label: 'A bordo RADIUS',  value: 'A bordo RADIUS' },
  { label: 'Abierta',         value: 'Abierta' },
]

// ── Mapa de ubicación (solo servicio de internet) ─────────────────────────────
const editandoUbicacion = ref(false)
const ubicacionMapEl = ref(null)
let ubicacionMap = null
let ubicacionMarker = null
let ubicacionMapRO = null

const ubicacionLabel = computed(() => {
  if (form.ubicacion_lat == null || form.ubicacion_lng == null) return 'Sin definir'
  return `${form.ubicacion_lat},${form.ubicacion_lng}`
})

async function initUbicacionMap() {
  if (!ubicacionMapEl.value || ubicacionMap) return
  const { default: maplibregl } = await import('maplibre-gl')
  await import('maplibre-gl/dist/maplibre-gl.css')
  if (!ubicacionMapEl.value || ubicacionMap) return   // pudo cerrarse el diálogo mientras cargaba

  const centro = (form.ubicacion_lat != null && form.ubicacion_lng != null)
    ? [form.ubicacion_lng, form.ubicacion_lat]
    : [-74.297, 4.571]   // centro de Colombia por defecto

  ubicacionMap = new maplibregl.Map({
    container: ubicacionMapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: centro,
    zoom: (form.ubicacion_lat != null && form.ubicacion_lng != null) ? 12 : 5,
    attributionControl: false,
  })

  if (form.ubicacion_lat != null && form.ubicacion_lng != null) {
    ubicacionMarker = new maplibregl.Marker({ color: '#06b6d4' })
      .setLngLat([form.ubicacion_lng, form.ubicacion_lat])
      .addTo(ubicacionMap)
  }

  ubicacionMap.on('click', (e) => {
    if (!editandoUbicacion.value) return
    const { lng, lat } = e.lngLat
    form.ubicacion_lat = Number(lat.toFixed(6))
    form.ubicacion_lng = Number(lng.toFixed(6))
    if (ubicacionMarker) {
      ubicacionMarker.setLngLat([lng, lat])
    } else {
      ubicacionMarker = new maplibregl.Marker({ color: '#06b6d4' }).setLngLat([lng, lat]).addTo(ubicacionMap)
    }
  })

  ubicacionMapRO = new ResizeObserver(() => ubicacionMap?.resize())
  ubicacionMapRO.observe(ubicacionMapEl.value)
}

watch(step, async (s) => {
  if (s === 0 && props.tipo === 'internet') {
    await nextTick()
    await initUbicacionMap()
  }
})

onBeforeUnmount(() => {
  ubicacionMapRO?.disconnect()
  ubicacionMap?.remove()
  ubicacionMap = null
})

function buscarCliente(event, rol) {
  const q = (event.query ?? '').toLowerCase()
  const resultado = todosClientes.value
    .filter(c => c.razon_social_nombre?.toLowerCase().includes(q))
    .map(c => c.razon_social_nombre)
  if (rol === 'contratante') contratantesFiltrados.value = resultado
  else prestadoresFiltrados.value = resultado
}

function seleccionarCliente(event, rol) {
  const found = todosClientes.value.find(c => c.razon_social_nombre === event.value)
  if (!found) return
  if (rol === 'contratante') {
    form.contratante_id = found.id
    form.contratante_nombre = found.razon_social_nombre
    form.contratante_nit = found.nit_cedula ?? ''
  } else {
    form.prestador_id = found.id
    form.prestador_nombre = found.razon_social_nombre
    form.prestador_nit = found.nit_cedula ?? ''
  }
}

function limpiarParte(rol) {
  if (rol === 'contratante') { form.contratante_id = null; form.contratante_nit = '' }
  else { form.prestador_id = null; form.prestador_nit = '' }
}

function abrirNuevoCliente(rol) {
  nuevoClienteRol.value = rol
  showNuevoCliente.value = true
}

function onClienteCreado(cliente) {
  todosClientes.value.push(cliente)
  seleccionarCliente({ value: cliente.razon_social_nombre }, nuevoClienteRol.value)
}

function formatFecha(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// ── Arrendadores (solo tipo === 'arriendo') ──────────────────────────────────
const contratoIdCreado = ref(null)
const arrendadores = ref([])
const arrendadorDialog = reactive({
  visible: false,
  modo: 'crear',
  editId: null,
  guardando: false,
  form: {
    nombre: '', valor_base: null, responsable_iva: false, activo: true,
    anticipo_pagado_desde: null, anticipo_pagado_hasta: null, observaciones: '',
  },
})

async function cargarArrendadoresWizard() {
  if (!contratoIdCreado.value) { arrendadores.value = []; return }
  try {
    arrendadores.value = await contratosServicioService.listarArrendadores(contratoIdCreado.value)
  } catch {
    arrendadores.value = []
  }
}

function openArrendadorDialog(modo, arrendador = null) {
  arrendadorDialog.modo = modo
  arrendadorDialog.editId = arrendador?.id ?? null
  arrendadorDialog.form.nombre = arrendador?.nombre || ''
  arrendadorDialog.form.valor_base = arrendador?.valor_base ?? null
  arrendadorDialog.form.responsable_iva = arrendador?.responsable_iva ?? false
  arrendadorDialog.form.activo = arrendador?.activo ?? true
  arrendadorDialog.form.anticipo_pagado_desde = arrendador?.anticipo_pagado_desde ? new Date(arrendador.anticipo_pagado_desde) : null
  arrendadorDialog.form.anticipo_pagado_hasta = arrendador?.anticipo_pagado_hasta ? new Date(arrendador.anticipo_pagado_hasta) : null
  arrendadorDialog.form.observaciones = arrendador?.observaciones || ''
  arrendadorDialog.visible = true
}

async function guardarArrendadorWizard() {
  if (!contratoIdCreado.value) return
  if (!arrendadorDialog.form.nombre?.trim()) {
    toast.error('El nombre es obligatorio', { duration: 3000 })
    return
  }
  arrendadorDialog.guardando = true
  try {
    const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : (d || null)
    const payload = {
      nombre: arrendadorDialog.form.nombre.trim(),
      valor_base: arrendadorDialog.form.valor_base,
      responsable_iva: arrendadorDialog.form.responsable_iva ?? false,
      activo: arrendadorDialog.form.activo ?? true,
      anticipo_pagado_desde: toISO(arrendadorDialog.form.anticipo_pagado_desde),
      anticipo_pagado_hasta: toISO(arrendadorDialog.form.anticipo_pagado_hasta),
      observaciones: arrendadorDialog.form.observaciones?.trim() || null,
    }
    if (arrendadorDialog.modo === 'editar' && arrendadorDialog.editId) {
      await contratosServicioService.actualizarArrendador(arrendadorDialog.editId, payload)
    } else {
      await contratosServicioService.crearArrendador(contratoIdCreado.value, payload)
    }
    arrendadorDialog.visible = false
    await cargarArrendadoresWizard()
    toast.success('Arrendador guardado', { duration: 2500 })
  } catch (e) {
    toast.error('Error al guardar arrendador', { description: e.data?.detail, duration: 3500 })
  } finally {
    arrendadorDialog.guardando = false
  }
}

async function eliminarArrendadorWizard(arrendador) {
  if (!confirm(`¿Eliminar al arrendador "${arrendador.nombre}"?`)) return
  try {
    await contratosServicioService.eliminarArrendador(arrendador.id)
    await cargarArrendadoresWizard()
  } catch (e) {
    toast.error('Error al eliminar', { description: e.data?.detail, duration: 3500 })
  }
}

async function crearContrato() {
  const payload = {
      servicio_aplica: props.tipo,
      proyecto_id: form.proyecto_id ?? null,
      numero_contrato: form.numero_contrato?.trim() || null,
      estado: form.estado ?? 'vigente',
      contratante_id: form.contratante_id ?? null,
      contratante_nombre: form.contratante_nombre || null,
      contratante_nit: form.contratante_nit?.trim() || null,
      prestador_id: form.prestador_id ?? null,
      prestador_nombre: form.prestador_nombre || null,
      prestador_nit: form.prestador_nit?.trim() || null,
      fecha_firma_contrato: formatFecha(form.fecha_firma_contrato),
      enlace_drive: form.enlace_drive?.trim() || null,
      estado_pago: form.estado_pago ?? null,
      fecha_inicio: formatFecha(form.fecha_inicio),
      fecha_fin: formatFecha(form.fecha_fin),
      tarifa_base: form.tarifa_base ?? null,
      periodicidad_pago: form.periodicidad_pago ?? null,
      indice_indexacion: form.indice_indexacion?.trim() || null,
      tiene_cgm: form.tiene_cgm,
      cgm_codigo_sic: form.tiene_cgm ? (form.cgm_codigo_sic?.trim() || null) : null,
      rec_cantidad: form.rec_cantidad ?? null,
      rec_precio_unitario: form.rec_precio_unitario ?? null,
      rec_vintage: form.rec_vintage?.trim() || null,
      service_scope: form.service_scope?.trim() || null,
      specific_service_terms: form.specific_service_terms?.trim() || null,
      slas: form.slas?.trim() || null,
      responsibilities: form.responsibilities?.trim() || null,
      plan_datos_gb: props.tipo === 'internet' ? (form.plan_datos_gb?.trim() || null) : null,
      velocidad_mbps: props.tipo === 'internet' ? (form.velocidad_mbps ?? null) : null,
      tipo_conexion: props.tipo === 'internet' ? (form.tipo_conexion || null) : null,
      linea_servicio: props.tipo === 'internet' ? (form.linea_servicio?.trim() || null) : null,
      id_router: props.tipo === 'internet' ? (form.id_router?.trim() || null) : null,
      numero_kit: props.tipo === 'internet' ? (form.numero_kit?.trim() || null) : null,
      latencia_ms: props.tipo === 'internet' ? (form.latencia_ms ?? null) : null,
      wifi_seguridad: props.tipo === 'internet' ? (form.wifi_seguridad || null) : null,
      wifi_password: props.tipo === 'internet' ? (form.wifi_password?.trim() || null) : null,
      ubicacion_lat: props.tipo === 'internet' ? (form.ubicacion_lat ?? null) : null,
      ubicacion_lng: props.tipo === 'internet' ? (form.ubicacion_lng ?? null) : null,
    }
  return contratosServicioService.crear(payload)
}

async function guardar() {
  guardando.value = true
  try {
    const data = await crearContrato()
    toast.success('Contrato creado', { duration: 2500 })
    emit('creado', data)
    emit('cerrar')
  } catch (e) {
    toast.error('Error', { description: e.data?.detail ?? e.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

async function crearYContinuarArriendo() {
  guardando.value = true
  try {
    const data = await crearContrato()
    contratoIdCreado.value = data.id
    toast.success('Contrato creado — agrega los arrendadores', { duration: 3000 })
    step.value++
  } catch (e) {
    toast.error('Error', { description: e.data?.detail ?? e.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

function finalizarArriendo() {
  emit('creado', { id: contratoIdCreado.value })
  emit('cerrar')
}

onMounted(async () => {
  const [proyectos, clientes] = await Promise.all([
    proyectosService.listar({ size: 500 }),
    clientesService.listar({ size: 500 }),
  ])
  todosProyectos.value = proyectos
  todosClientes.value = clientes
  if (props.proyectoIdDefault) form.proyecto_id = props.proyectoIdDefault
  if (props.tipo === 'internet') {
    await nextTick()
    await initUbicacionMap()
  }
})
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.step-title { @apply text-sm font-semibold text-gray-700 mb-4; }
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
