<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal :style="{ width: '820px' }" :breakpoints="{ '900px': '95vw' }"
    :header="editandoId ? 'Editar contrato PPA' : 'Nuevo contrato PPA'" :closable="true" @hide="$emit('cerrar')">

    <!-- Step indicator -->
    <div class="px-6 pt-5 pb-4 border-b border-gray-100">
      <div class="flex items-start">
        <template v-for="(s, i) in STEPS" :key="i">
          <div class="flex flex-col items-center gap-1.5" style="flex:1">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              :class="{
                'bg-amber-500 text-white shadow-sm shadow-amber-200': step === i,
                'bg-amber-400 text-white': step > i,
                'bg-gray-100 text-gray-400': step < i,
              }">
              <CheckIcon class="text-xs size-[1em]" v-if="step > i" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-[10px] text-center leading-tight px-0.5"
              :class="step === i ? 'text-amber-600 font-semibold' : step > i ? 'text-gray-500' : 'text-gray-300'">
              {{ s.label }}
            </span>
          </div>
          <div v-if="i < STEPS.length - 1" class="h-0.5 mt-3.5 mx-0.5 transition-all" style="flex:1"
            :class="step > i ? 'bg-amber-400' : 'bg-gray-100'" />
        </template>
      </div>
    </div>

    <!-- Contenido -->
    <div class="px-6 py-5 min-h-72">

      <!-- ── PASO 0: Proyectos e identificación ─────────────────────────── -->
      <template v-if="step === 0">
        <p class="step-title">Proyectos e identificación</p>
        <div class="space-y-4">
          <div class="flex flex-col gap-1">
            <label class="field-label">Proyectos asociados <span class="text-gray-400">(opcional)</span></label>
            <MultiSelect
              v-model="proyectosSeleccionados"
              :options="todosProyectos"
              optionLabel="nombre_comercial"
              placeholder="Buscar y seleccionar proyectos…"
              filter
              filterPlaceholder="Buscar proyecto"
              :maxSelectedLabels="4"
              selectedItemsLabel="{0} proyectos seleccionados"
              class="w-full"
              display="chip"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Número de contrato</label>
              <InputText v-model="form.numero_codigo_contrato" placeholder="Ej: UNERGY 001-2023" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Nombre interno</label>
              <InputText v-model="form.nombre_interno" placeholder="Ej: Terpel 1" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Responsable</label>
            <Select v-model="form.responsable_id" :options="responsablesOpts"
              optionLabel="label" optionValue="value" showClear
              placeholder="Empresa responsable del PPA" class="w-full" />
            <span class="text-xs text-gray-400">
              Empresa que gestiona este PPA. Los responsables marcados como no relevantes
              no aparecen en la Matriz anual de Cumplimiento.
            </span>
          </div>
        </div>
      </template>

      <!-- ── PASO 1: Partes ─────────────────────────────────────────────── -->
      <template v-if="step === 1">
        <p class="step-title">Partes del contrato</p>
        <div class="flex flex-col gap-1 mb-4">
          <label class="field-label">Tipo de contrato</label>
          <SelectButton v-model="form.tipo_contrato" :options="TIPOS_CONTRATO"
            optionLabel="label" optionValue="value" :allowEmpty="false" />
          <span class="text-xs text-gray-400">
            <strong>Venta:</strong> Unergy vende energía a la contraparte ·
            <strong>Compra:</strong> Unergy compra energía (ej. a un generador).
          </span>
        </div>
        <div class="grid grid-cols-2 gap-1 mb-1 px-1">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comprador</span>
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendedor</span>
        </div>
        <div class="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50">
          <!-- Comprador -->
          <div class="space-y-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Nombre / Razón social</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="form.comprador_nombre"
                  :suggestions="compradoresFiltrados"
                  @complete="buscarCliente($event, 'comprador')"
                  @item-select="seleccionarCliente($event, 'comprador')"
                  @clear="limpiarParte('comprador')"
                  placeholder="Buscar cliente existente…"
                  class="flex-1"
                  inputClass="w-full"
                />
                <Button severity="secondary" outlined size="small" v-tooltip="'Crear nuevo cliente'" @click="abrirNuevoCliente('comprador')">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <div v-if="form.comprador_id" class="flex items-center gap-1 text-xs text-green-600">
                <LinkIcon class="text-xs size-[1em]" /> Cliente vinculado (id {{ form.comprador_id }})
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">NIT</label>
              <InputText v-model="form.comprador_nit" class="w-full" placeholder="Ej: 900123456-7" />
            </div>
          </div>
          <!-- Vendedor -->
          <div class="space-y-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Nombre / Razón social</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="form.vendedor_nombre"
                  :suggestions="vendedoresFiltrados"
                  @complete="buscarCliente($event, 'vendedor')"
                  @item-select="seleccionarCliente($event, 'vendedor')"
                  @clear="limpiarParte('vendedor')"
                  placeholder="Buscar cliente existente…"
                  class="flex-1"
                  inputClass="w-full"
                />
                <Button severity="secondary" outlined size="small" v-tooltip="'Crear nuevo cliente'" @click="abrirNuevoCliente('vendedor')">
                  <template #icon><PlusIcon class="size-[1em]" /></template>
                </Button>
              </div>
              <div v-if="form.vendedor_id" class="flex items-center gap-1 text-xs text-green-600">
                <LinkIcon class="text-xs size-[1em]" /> Cliente vinculado (id {{ form.vendedor_id }})
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">NIT</label>
              <InputText v-model="form.vendedor_nit" class="w-full" placeholder="Ej: 900123456-7" />
            </div>
          </div>
        </div>
      </template>

      <!-- Dialog nuevo cliente -->
      <NuevoClienteDialog
        v-model:visible="showNuevoCliente"
        @creado="onClienteCreado"
      />

      <!-- ── PASO 2: Condiciones comerciales ───────────────────────────── -->
      <template v-if="step === 2">
        <p class="step-title">Condiciones comerciales</p>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha inicio de despacho</label>
              <DatePicker v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha final del despacho</label>
              <DatePicker v-model="form.fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div class="flex flex-col gap-1">
              <label class="field-label">Índice de indexación</label>
              <Select v-model="form.indice_indexacion"
                :options="INDICES_INDEXACION"
                optionLabel="label" optionValue="value"
                placeholder="Seleccionar índice"
                showClear class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Periodicidad indexación</label>
              <Select v-model="form.periodicidad_indexacion" :options="PERIODICIDADES"
                optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Período base (AAAA-MM)</label>
              <InputText v-model="form.periodo_indexacion_base" placeholder="2023-07" maxlength="7" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Valor base indexación</label>
              <InputNumber v-model="form.valor_indexacion_base" :maxFractionDigits="4" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Periodicidad facturación</label>
              <Select v-model="form.periodicidad_facturacion" :options="PERIODICIDADES"
                optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Tiempo de pago (días)</label>
              <InputNumber v-model="form.tiempo_pago" :useGrouping="false" placeholder="15" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Condiciones de pago</label>
            <Textarea v-model="form.condiciones_pago" rows="2" autoResize class="w-full" />
          </div>
        </div>
      </template>

      <!-- ── PASO 3: Tarifas ────────────────────────────────────────────── -->
      <template v-if="step === 3">
        <p class="step-title">Tabla de tarifas <span class="normal-case font-normal text-gray-400">(opcional)</span></p>
        <p class="text-xs text-gray-400 mb-3">
          Copia las columnas <strong>Año · Mes · Tarifa</strong> desde Excel y pégalas aquí.
          Acepta tabulaciones o comas como separador. El mes puede ser nombre en español o número.
        </p>
        <Textarea
          v-model="tarifasPaste"
          rows="6"
          placeholder="2023&#9;Noviembre&#9;460&#10;2023&#9;Diciembre&#9;460&#10;2024&#9;Enero&#9;460"
          class="w-full font-mono text-xs"
          @paste="onPasteTarifas"
        />
        <div class="flex items-center gap-2 mt-2">
          <Button label="Procesar" size="small" severity="secondary" outlined @click="parseTarifas">
            <template #icon><RefreshCwIcon class="size-[1em]" /></template>
          </Button>
          <Button v-if="tarifasRows.length" label="Limpiar" size="small" severity="danger" text @click="tarifasRows = []; tarifasPaste = ''">
            <template #icon><XIcon class="size-[1em]" /></template>
          </Button>
          <span v-if="tarifasRows.length" class="text-xs text-green-600 font-medium">
            ✓ {{ tarifasRows.length }} filas listas
          </span>
          <span v-if="tarifasError" class="text-xs text-red-400">{{ tarifasError }}</span>
        </div>
        <div v-if="tarifasRows.length" class="mt-3 border border-gray-100 rounded-lg overflow-hidden">
          <table class="w-full text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-1.5 text-left text-gray-500 font-medium">Año</th>
                <th class="px-3 py-1.5 text-left text-gray-500 font-medium">Mes</th>
                <th class="px-3 py-1.5 text-right text-gray-500 font-medium">Tarifa ($/kWh)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in tarifasPreview" :key="i" class="border-t border-gray-50">
                <td class="px-3 py-1 text-gray-700">{{ r.año }}</td>
                <td class="px-3 py-1 text-gray-700">{{ r.mes }}</td>
                <td class="px-3 py-1 text-right text-gray-700">{{ r.tarifa }}</td>
              </tr>
              <tr v-if="tarifasRows.length > PREVIEW_ROWS" class="border-t border-gray-50">
                <td colspan="3" class="px-3 py-1 text-gray-300 italic">… y {{ tarifasRows.length - PREVIEW_ROWS }} filas más</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── PASO 4: Compromisos de energía ────────────────────────────── -->
      <template v-if="step === 4">
        <p class="step-title">Compromisos de energía <span class="normal-case font-normal text-gray-400">(opcional)</span></p>
        <p class="text-xs text-gray-400 mb-3">
          Copia las columnas <strong>Año · Mes · Mín · Máx · Plantas contrato</strong> desde Excel y pégalas aquí
          (Mín/Máx en MWh/mes; <strong>Plantas contrato</strong> = nº de plantas que el contrato exige ese mes).
          Las columnas <strong>Máx</strong> y <strong>Plantas contrato</strong> son opcionales. Usa
          <strong>Descargar plantilla</strong> para editar en Excel y volver a pegar.
        </p>
        <Textarea
          v-model="energiaPaste"
          rows="6"
          placeholder="2023&#9;Noviembre&#9;90&#9;180&#9;4&#10;2023&#9;Diciembre&#9;90&#9;180&#9;4"
          class="w-full font-mono text-xs"
          @paste="onPasteEnergia"
        />
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <Button label="Procesar" size="small" severity="secondary" outlined @click="parseEnergia">
            <template #icon><RefreshCwIcon class="size-[1em]" /></template>
          </Button>
          <Button label="Descargar plantilla" size="small" severity="secondary" text @click="descargarPlantillaEnergia">
            <template #icon><DownloadIcon class="size-[1em]" /></template>
          </Button>
          <Button v-if="energiaRows.length" label="Limpiar" size="small" severity="danger" text @click="energiaRows = []; energiaPaste = ''">
            <template #icon><XIcon class="size-[1em]" /></template>
          </Button>
          <span v-if="energiaRows.length" class="text-xs text-green-600 font-medium">
            ✓ {{ energiaRows.length }} filas listas
          </span>
          <span v-if="energiaError" class="text-xs text-red-400">{{ energiaError }}</span>
        </div>
        <div v-if="energiaRows.length" class="mt-3 border border-gray-100 rounded-lg overflow-hidden">
          <table class="w-full text-xs">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-1.5 text-left text-gray-500 font-medium">Año</th>
                <th class="px-3 py-1.5 text-left text-gray-500 font-medium">Mes</th>
                <th class="px-3 py-1.5 text-right text-gray-500 font-medium">Mín (MWh)</th>
                <th class="px-3 py-1.5 text-right text-gray-500 font-medium">Máx (MWh)</th>
                <th class="px-3 py-1.5 text-right text-gray-500 font-medium">Plantas contrato</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in energiaPreview" :key="i" class="border-t border-gray-50">
                <td class="px-3 py-1 text-gray-700">{{ r.año }}</td>
                <td class="px-3 py-1 text-gray-700">{{ r.mes }}</td>
                <td class="px-3 py-1 text-right text-gray-700">{{ r.energia_minima }}</td>
                <td class="px-3 py-1 text-right text-gray-700">{{ r.energia_maxima }}</td>
                <td class="px-3 py-1 text-right text-gray-700">{{ r.cantidad_proyectos ?? '—' }}</td>
              </tr>
              <tr v-if="energiaRows.length > PREVIEW_ROWS" class="border-t border-gray-50">
                <td colspan="5" class="px-3 py-1 text-gray-300 italic">… y {{ energiaRows.length - PREVIEW_ROWS }} filas más</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── PASO 5: GESCON + Resumen ───────────────────────────────────── -->
      <template v-if="step === 5">
        <p class="step-title text-gray-400">Registro GESCON / ASIC <span class="normal-case font-normal">(opcional)</span></p>
        <div class="grid grid-cols-3 gap-4 mb-5">
          <div class="flex flex-col gap-1">
            <label class="field-label">Código SIC</label>
            <InputText v-model="form.codigo_sic" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Código GESCON</label>
            <InputText v-model="form.gescon_codigo" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Precio GESCON ($/kWh)</label>
            <InputNumber v-model="form.gescon_precio" :maxFractionDigits="4" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Fecha inicio GESCON</label>
            <DatePicker v-model="form.gescon_fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Fecha fin GESCON</label>
            <DatePicker v-model="form.gescon_fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Cantidades GESCON (kWh)</label>
            <InputNumber v-model="form.gescon_cantidades_kwh" :maxFractionDigits="3" locale="en-US" class="w-full" />
          </div>
        </div>

        <!-- Resumen -->
        <div class="rounded-lg border border-amber-100 bg-amber-50 p-4">
          <p class="text-xs font-semibold text-amber-700 mb-3">Resumen</p>
          <div class="mb-2">
            <span class="text-xs text-gray-400">Proyectos:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="p in proyectosSeleccionados" :key="p.id"
                class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {{ p.nombre_comercial }}
              </span>
              <span v-if="!proyectosSeleccionados.length" class="text-xs text-gray-300">—</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-600 mt-3">
            <ResumenFila label="Tipo" :value="form.tipo_contrato === 'compra' ? 'Compra' : 'Venta'" />
            <ResumenFila label="Número" :value="form.numero_codigo_contrato" />
            <ResumenFila label="Nombre interno" :value="form.nombre_interno" />
            <ResumenFila label="Responsable" :value="responsableLabel" />
            <ResumenFila label="Comprador" :value="form.comprador_nombre" />
            <ResumenFila label="Vendedor" :value="form.vendedor_nombre" />
            <ResumenFila label="Inicio despacho" :value="formatFecha(form.fecha_inicio)" />
            <ResumenFila label="Fin despacho" :value="formatFecha(form.fecha_fin)" />
            <ResumenFila label="Índice" :value="form.indice_indexacion" />
            <ResumenFila label="Tiempo de pago" :value="form.tiempo_pago != null ? `${form.tiempo_pago} días` : null" />
            <ResumenFila label="Tarifas" :value="tarifasRows.length ? `${tarifasRows.length} filas` : null" />
            <ResumenFila label="Compromisos energía" :value="energiaRows.length ? `${energiaRows.length} filas` : null" />
          </div>
        </div>
      </template>

    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
      <Button v-if="step > 0" label="Anterior" severity="secondary" outlined @click="step--">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <span v-else />
      <div class="flex gap-2">
        <Button label="Cancelar" severity="secondary" text @click="$emit('cerrar')" />
        <Button v-if="step < STEPS.length - 1" label="Siguiente" class="flex-row-reverse" @click="avanzar">
          <template #icon><ArrowRightIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else label="Guardar contrato" :loading="guardando" @click="guardar">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, LinkIcon, PlusIcon, RefreshCwIcon, XIcon } from '@lucide/vue'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import AutoComplete from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import NuevoClienteDialog from '~/features/contratos/components/NuevoClienteDialog.vue'
import { PpaService } from '~/features/contratos/services/ppa'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ClientesService } from '~/features/clientes/services/clientes'

const ppaService = new PpaService()
const proyectosService = new ProyectosService()
const clientesService = new ClientesService()

const props = defineProps({
  visible: Boolean,
  initialData: { type: Object, default: null },
  editandoId: { type: Number, default: null },
})
const emit = defineEmits(['update:visible', 'cerrar', 'creado', 'editado'])

const PREVIEW_ROWS = 5

const STEPS = [
  { label: 'Proyectos' },
  { label: 'Partes' },
  { label: 'Condiciones' },
  { label: 'Tarifas' },
  { label: 'Energía' },
  { label: 'GESCON' },
]

const TIPOS_CONTRATO = [
  { label: 'Venta', value: 'venta' },
  { label: 'Compra', value: 'compra' },
]

const PERIODICIDADES = [
  { label: 'Mensual', value: 'mensual' },
  { label: 'Bimestral', value: 'bimestral' },
  { label: 'Trimestral', value: 'trimestral' },
  { label: 'Anual', value: 'anual' },
]

const INDICES_INDEXACION = [
  { label: 'IPP', value: 'IPP' },
  { label: 'IPC', value: 'IPC' },
  { label: 'IPC + spread', value: 'IPC + spread' },
  { label: 'IPP + spread', value: 'IPP + spread' },
  { label: 'Fijo', value: 'Fijo' },
  { label: 'Otro', value: 'Otro' },
]

const MESES_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

const step = ref(0)
const guardando = ref(false)
const todosProyectos = ref([])
const responsables = ref([])
const responsablesOpts = computed(() => responsables.value.map(r => ({
  value: r.id,
  label: r.incluir_en_cumplimiento ? r.nombre : `${r.nombre} (oculto en Matriz anual)`,
})))
const responsableLabel = computed(() =>
  responsables.value.find(r => r.id === form.responsable_id)?.nombre ?? null)
const proyectosSeleccionados = ref([])
const errores = reactive({})

// Clientes registrados
const todosClientes = ref([])
const compradoresFiltrados = ref([])
const vendedoresFiltrados = ref([])

// Dialog nuevo cliente
const showNuevoCliente = ref(false)
const nuevoClienteRol = ref('comprador') // 'comprador' | 'vendedor'

function buscarCliente(event, rol) {
  const q = event.query.toLowerCase()
  const resultado = todosClientes.value
    .filter(c => c.razon_social_nombre.toLowerCase().includes(q))
    .map(c => c.razon_social_nombre)
  if (rol === 'comprador') compradoresFiltrados.value = resultado
  else vendedoresFiltrados.value = resultado
}

function seleccionarCliente(event, rol) {
  const found = todosClientes.value.find(c => c.razon_social_nombre === event.value)
  if (!found) return
  if (rol === 'comprador') {
    form.comprador_id = found.id
    form.comprador_nombre = found.razon_social_nombre
    form.comprador_nit = found.nit_cedula || ''
  } else {
    form.vendedor_id = found.id
    form.vendedor_nombre = found.razon_social_nombre
    form.vendedor_nit = found.nit_cedula || ''
  }
}

function limpiarParte(rol) {
  if (rol === 'comprador') { form.comprador_id = null; form.comprador_nit = '' }
  else { form.vendedor_id = null; form.vendedor_nit = '' }
}

function abrirNuevoCliente(rol) {
  nuevoClienteRol.value = rol
  showNuevoCliente.value = true
}

function onClienteCreado(cliente) {
  todosClientes.value.push(cliente)
  seleccionarCliente({ value: cliente.razon_social_nombre }, nuevoClienteRol.value)
}

// Paste state — tarifas
const tarifasPaste = ref('')
const tarifasRows = ref([])
const tarifasError = ref('')
const tarifasPreview = computed(() => tarifasRows.value.slice(0, PREVIEW_ROWS))

// Paste state — energía
const energiaPaste = ref('')
const energiaRows = ref([])
const energiaError = ref('')
const energiaPreview = computed(() => energiaRows.value.slice(0, PREVIEW_ROWS))

const form = reactive({
  tipo_contrato: 'venta',
  numero_codigo_contrato: null, nombre_interno: null, responsable_id: null,
  comprador_id: null, comprador_nombre: null, comprador_nit: null,
  vendedor_id: null, vendedor_nombre: null, vendedor_nit: null,
  fecha_inicio: null, fecha_fin: null,
  indice_indexacion: null, periodicidad_indexacion: null,
  periodo_indexacion_base: null, valor_indexacion_base: null,
  periodicidad_facturacion: null, tiempo_pago: null, condiciones_pago: null,
  codigo_sic: null,
  gescon_codigo: null, gescon_fecha_inicio: null, gescon_fecha_fin: null,
  gescon_precio: null, gescon_cantidades_kwh: null,
})

const EXCLUIR_DUPLICADO = ['numero_codigo_contrato', 'fecha_inicio', 'fecha_fin',
  'gescon_fecha_inicio', 'gescon_fecha_fin', 'gescon_codigo']

watch(() => props.visible, (visible) => {
  if (visible && props.initialData) {
    const esEdicion = !!props.editandoId
    Object.keys(form).forEach(k => {
      const limpiar = !esEdicion && EXCLUIR_DUPLICADO.includes(k)
      form[k] = limpiar ? null : (props.initialData[k] ?? null)
    })
    // El tipo de contrato nunca debe quedar vacío en el selector: backend usa 'venta' por defecto.
    if (!form.tipo_contrato) form.tipo_contrato = 'venta'

    if (esEdicion) {
      // Tarifas: { año, mes, tarifa } — mismo formato que tarifasRows
      const tarifasData = props.initialData.tarifas ?? []
      tarifasRows.value = tarifasData.map(t => ({ año: t.año, mes: t.mes, tarifa: t.tarifa }))
      tarifasPaste.value = tarifasData.map(t => `${t.año}\t${t.mes}\t${t.tarifa}`).join('\n')

      // Cantidades: { año, mes, energia_minima, energia_maxima, cantidad_proyectos }
      const cantData = props.initialData.compromisos_energia ?? []
      energiaRows.value = cantData.map(c => ({ año: c.año, mes: c.mes, energia_minima: c.energia_minima, energia_maxima: c.energia_maxima, cantidad_proyectos: c.cantidad_proyectos ?? null }))
      energiaPaste.value = cantData.map(c => `${c.año}\t${c.mes}\t${c.energia_minima ?? ''}\t${c.energia_maxima ?? ''}\t${c.cantidad_proyectos ?? ''}`).join('\n')

      // Proyectos: precargar seleccionados cuando todosProyectos esté disponible
      const proyectosData = props.initialData.proyectos ?? []
      if (proyectosData.length) {
        watch(() => todosProyectos.value, (lista) => {
          if (!lista.length) return
          proyectosSeleccionados.value = lista.filter(p =>
            proyectosData.some(pd => pd.id === p.id)
          )
        }, { immediate: true })
      } else {
        proyectosSeleccionados.value = []
      }
    }
  }
}, { immediate: true })

// ── Parsers ─────────────────────────────────────────────────────────────────

function splitRow(line) {
  // handle tab-separated (Excel) or comma-separated (CSV)
  return line.includes('\t') ? line.split('\t') : line.split(',')
}

function parseMes(raw) {
  const s = String(raw).trim()
  const num = parseInt(s, 10)
  if (!isNaN(num) && num >= 1 && num <= 12) return num
  return MESES_ES[s.toLowerCase()] ?? null
}

function parseTarifas() {
  tarifasError.value = ''
  const lines = tarifasPaste.value.split('\n').map(l => l.trim()).filter(Boolean)
  const rows = []
  for (const [i, line] of lines.entries()) {
    const cols = splitRow(line)
    if (cols.length < 3) { tarifasError.value = `Fila ${i + 1}: se esperan 3 columnas`; tarifasRows.value = []; return }
    const año = parseInt(cols[0].trim(), 10)
    const mes = parseMes(cols[1].trim())
    const tarifa = parseFloat(cols[2].trim().replace(',', '.'))
    if (isNaN(año) || !mes || isNaN(tarifa)) { tarifasError.value = `Fila ${i + 1}: datos inválidos`; tarifasRows.value = []; return }
    rows.push({ año, mes, tarifa })
  }
  tarifasRows.value = rows
}

function parseEnergia() {
  energiaError.value = ''
  const lines = energiaPaste.value.split('\n').map(l => l.trim()).filter(Boolean)
  const rows = []
  for (const [i, line] of lines.entries()) {
    const cols = splitRow(line)
    if (cols.length < 3) { energiaError.value = `Fila ${i + 1}: se esperan al menos 3 columnas (Año · Mes · Mín)`; energiaRows.value = []; return }
    const año = parseInt(cols[0].trim(), 10)
    const mes = parseMes(cols[1].trim())
    const min = parseFloat(cols[2].trim().replace(',', '.'))
    const max = cols[3] ? parseFloat(cols[3].trim().replace(',', '.')) : null
    const plantasRaw = cols[4] ? cols[4].trim() : ''
    const plantas = plantasRaw ? parseInt(plantasRaw.replace(',', '.'), 10) : null
    if (isNaN(año) || !mes || isNaN(min)) { energiaError.value = `Fila ${i + 1}: datos inválidos`; energiaRows.value = []; return }
    rows.push({
      año, mes,
      energia_minima: min,
      energia_maxima: (max !== null && !isNaN(max)) ? max : null,
      cantidad_proyectos: (plantas !== null && !isNaN(plantas)) ? plantas : null,
    })
  }
  energiaRows.value = rows
}

// Descarga la plantilla Excel (Año · Mes · Mín · Máx · Plantas contrato) precargada con los
// compromisos actuales para editarla y volver a pegarla en el cuadro de texto.
async function descargarPlantillaEnergia() {
  const XLSX = await import('xlsx')
  const header = ['Año', 'Mes', 'Mín (MWh)', 'Máx (MWh)', 'Plantas contrato']
  const filas = energiaRows.value.length
    ? energiaRows.value.map(r => [r.año, r.mes, r.energia_minima, r.energia_maxima, r.cantidad_proyectos])
    : [[new Date().getFullYear(), 1, '', '', '']]
  const aoa = [header, ...filas]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Compromisos')
  const nombre = form.numero_codigo_contrato || form.nombre_interno || 'contrato'
  XLSX.writeFile(wb, `plantilla_compromisos_${String(nombre).replace(/[^\w-]+/g, '_')}.xlsx`)
}

function onPasteTarifas(e) {
  setTimeout(() => parseTarifas(), 50)
}

function onPasteEnergia(e) {
  setTimeout(() => parseEnergia(), 50)
}

// ── Navegación ───────────────────────────────────────────────────────────────

function avanzar() {
  step.value++
}

// ── Utils ────────────────────────────────────────────────────────────────────

function formatFecha(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// ── Guardar ──────────────────────────────────────────────────────────────────

async function guardar() {
  guardando.value = true
  try {
    const payload = { ...form }
    for (const k of ['fecha_inicio', 'fecha_fin', 'gescon_fecha_inicio', 'gescon_fecha_fin']) {
      payload[k] = formatFecha(form[k])
    }
    payload.proyecto_ids = proyectosSeleccionados.value.map(p => p.id)

    const contrato = props.editandoId
      ? await ppaService.actualizar(props.editandoId, payload)
      : await ppaService.crear(payload)

    const contratoId = contrato?.id ?? props.editandoId
    if (tarifasRows.value.length) {
      await ppaService.guardarTarifas(contratoId, tarifasRows.value)
    }
    if (energiaRows.value.length) {
      await ppaService.guardarCompromisos(contratoId, energiaRows.value)
    }

    if (props.editandoId) {
      toast.success('Contrato actualizado', { duration: 3000 })
      emit('editado', contrato)
    } else {
      const msg = [
        `Contrato "${contrato.nombre_interno || contrato.numero_codigo_contrato}" creado`,
        tarifasRows.value.length ? `${tarifasRows.value.length} tarifas` : null,
        energiaRows.value.length ? `${energiaRows.value.length} compromisos` : null,
      ].filter(Boolean).join(' · ')
      toast.success('Contrato creado', { description: msg, duration: 4000 })
      emit('creado', contrato)
    }
    emit('cerrar')
  } catch (e) {
    toast.error('Error al guardar', { description: e.data?.detail || e.message, duration: 5000 })
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  try {
    const [proyectos, clientes] = await Promise.all([
      proyectosService.listar({ size: 500 }),
      clientesService.listar({ size: 500 }),
    ])
    todosProyectos.value = proyectos
    todosClientes.value = clientes
  } catch { /* silencioso */ }
  // Aparte: el catálogo de responsables es opcional; si falla, el Select queda
  // vacío pero el wizard sigue sirviendo (no debe tumbar proyectos/clientes).
  try {
    responsables.value = await ppaService.listarResponsables()
  } catch { /* silencioso */ }
})
</script>

<script>
// Componente auxiliar local (Composition API).
const ResumenFila = {
  props: { label: String, value: [String, Number] },
  setup(props) {
    return { props }
  },
  template: `
    <div v-if="props.value">
      <span class="text-gray-400">{{ props.label }}:</span>
      <span class="font-medium text-gray-700">{{ props.value }}</span>
    </div>
  `,
}
export default { components: { ResumenFila } }
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
.step-title { @apply text-xs font-semibold text-amber-600 uppercase tracking-wide mb-4; }
</style>
