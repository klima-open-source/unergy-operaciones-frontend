<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal class="w-full max-w-3xl"
    :header="editandoId ? 'Editar contrato PPA' : 'Nuevo contrato PPA'" :closable="true" @hide="$emit('cerrar')">

    <!-- Step indicator -->
    <div class="px-6 pt-5 pb-4 border-b border-muted">
      <div class="flex items-start">
        <template v-for="(s, i) in STEPS" :key="i">
          <div class="flex flex-col items-center gap-1.5 flex-1">
            <div class="size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              :class="{
                'bg-warning text-white shadow-sm ': step === i,
                'bg-warning/80 text-white': step > i,
                'bg-muted text-muted-foreground': step < i,
              }">
              <CheckIcon class="size-3" v-if="step > i" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-xs text-center leading-tight px-0.5"
              :class="step === i ? 'text-warning font-semibold' : step > i ? 'text-muted-foreground' : 'text-muted-foreground/60'">
              {{ s.label }}
            </span>
          </div>
          <div v-if="i < STEPS.length - 1" class="h-0.5 mt-3.5 mx-0.5 transition-all flex-1"
            :class="step > i ? 'bg-warning/80' : 'bg-muted'" />
        </template>
      </div>
    </div>

    <!-- Contenido -->
    <div class="px-6 py-5 min-h-72">

      <!-- ── PASO 0: Proyectos e identificación ─────────────────────────── -->
      <template v-if="step === 0">
        <p class="text-xs font-semibold text-warning uppercase tracking-wide mb-4">Proyectos e identificación</p>
        <div class="space-y-4">
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Proyectos asociados <span class="text-muted-foreground">(opcional)</span></label>
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
              <label class="block text-xs font-medium text-muted-foreground mb-1">Número de contrato</label>
              <InputText v-model="form.numero_codigo_contrato" placeholder="Ej: UNERGY 001-2023" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Nombre interno</label>
              <InputText v-model="form.nombre_interno" placeholder="Ej: Terpel 1" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Responsable</label>
            <Select v-model="form.responsable_id" :options="responsablesOpts"
              optionLabel="label" optionValue="value" showClear
              placeholder="Empresa responsable del PPA" class="w-full" />
            <span class="text-xs text-muted-foreground">
              Empresa que gestiona este PPA. Los responsables marcados como no relevantes
              no aparecen en la Matriz anual de Cumplimiento.
            </span>
          </div>
        </div>
      </template>

      <!-- ── PASO 1: Partes ─────────────────────────────────────────────── -->
      <template v-if="step === 1">
        <p class="text-xs font-semibold text-warning uppercase tracking-wide mb-4">Partes del contrato</p>
        <div class="flex flex-col gap-1 mb-4">
          <label class="block text-xs font-medium text-muted-foreground mb-1">Tipo de contrato</label>
          <SelectButton v-model="form.tipo_contrato" :options="TIPOS_CONTRATO"
            optionLabel="label" optionValue="value" :allowEmpty="false" />
          <span class="text-xs text-muted-foreground">
            <strong>Venta:</strong> Unergy vende energía a la contraparte ·
            <strong>Compra:</strong> Unergy compra energía (ej. a un generador).
          </span>
        </div>

        <!-- La comunidad se define acá, no en la ficha de la planta: es lo que
             se negocia en este contrato. A las plantas que cubra dejan de
             prestárseles representación y CGM desde la fecha de entrada. -->
        <div class="flex flex-col gap-1 mb-4">
          <label class="block text-xs font-medium text-muted-foreground mb-1">Comunidad energética</label>
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="form.es_comunidad_energetica" inputId="ppa-comunidad" />
            <span class="text-sm text-muted-foreground">{{ form.es_comunidad_energetica ? 'Sí' : 'No' }}</span>
          </div>
          <span class="text-xs text-muted-foreground">
            A las plantas de este contrato dejan de prestárseles representación y
            CGM desde la fecha de entrada.
          </span>
        </div>
        <div v-if="form.es_comunidad_energetica" class="grid grid-cols-2 gap-4 mb-4">
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Nombre de la comunidad</label>
            <InputText v-model="form.nombre_comunidad" class="w-full" placeholder="Opcional" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha de entrada a la comunidad</label>
            <DatePicker v-model="form.fecha_entrada_comunidad" dateFormat="yy-mm-dd"
              showIcon class="w-full" />
            <span class="text-xs text-muted-foreground">
              Si se deja vacía, la exclusión aplica desde siempre.
            </span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1 mb-1 px-1">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comprador</span>
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendedor</span>
        </div>
        <div class="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted">
          <!-- Comprador -->
          <div class="space-y-3">
            <SelectorCliente
              v-model:id="form.comprador_id"
              v-model:nombre="form.comprador_nombre"
              v-model:nit="form.comprador_nit"
              label="Nombre / Razón social"
              requerido
            />
            <NitDeCliente :nit="form.comprador_nit" />
          </div>
          <!-- Vendedor -->
          <div class="space-y-3">
            <SelectorCliente
              v-model:id="form.vendedor_id"
              v-model:nombre="form.vendedor_nombre"
              v-model:nit="form.vendedor_nit"
              label="Nombre / Razón social"
              requerido
            />
            <NitDeCliente :nit="form.vendedor_nit" />
          </div>
        </div>
      </template>

      <!-- ── PASO 2: Condiciones comerciales ───────────────────────────── -->
      <template v-if="step === 2">
        <p class="text-xs font-semibold text-warning uppercase tracking-wide mb-4">Condiciones comerciales</p>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha inicio de despacho</label>
              <DatePicker v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha final del despacho</label>
              <DatePicker v-model="form.fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Índice de indexación</label>
              <Select v-model="form.indice_indexacion"
                :options="INDICES_INDEXACION"
                optionLabel="label" optionValue="value"
                placeholder="Seleccionar índice"
                showClear class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Periodicidad indexación</label>
              <Select v-model="form.periodicidad_indexacion" :options="PERIODICIDADES"
                optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Período base (AAAA-MM)</label>
              <InputText v-model="form.periodo_indexacion_base" placeholder="2023-07" maxlength="7" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Valor base indexación</label>
              <InputNumber v-model="form.valor_indexacion_base" :maxFractionDigits="4" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Periodicidad facturación</label>
              <Select v-model="form.periodicidad_facturacion" :options="PERIODICIDADES"
                optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Tiempo de pago (días)</label>
              <InputNumber v-model="form.tiempo_pago" :useGrouping="false" placeholder="15" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Condiciones de pago</label>
            <Textarea v-model="form.condiciones_pago" rows="2" autoResize class="w-full" />
          </div>
        </div>
      </template>

      <!-- ── PASO 3: Tarifas ────────────────────────────────────────────── -->
      <template v-if="step === 3">
        <p class="text-xs font-semibold text-warning uppercase tracking-wide mb-4">Tabla de tarifas <span class="normal-case font-normal text-muted-foreground">(opcional)</span></p>
        <p class="text-xs text-muted-foreground mb-3">
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
            <template #icon><RefreshCwIcon class="size-4" /></template>
          </Button>
          <Button v-if="tarifasRows.length" label="Limpiar" size="small" severity="danger" text @click="tarifasRows = []; tarifasPaste = ''">
            <template #icon><XIcon class="size-4" /></template>
          </Button>
          <span v-if="tarifasRows.length" class="text-xs text-success font-medium">
            ✓ {{ tarifasRows.length }} filas listas
          </span>
          <span v-if="tarifasError" class="text-xs text-destructive">{{ tarifasError }}</span>
        </div>
        <div v-if="tarifasRows.length" class="mt-3 border border-muted rounded-lg overflow-hidden">
          <table class="w-full text-xs">
            <thead class="bg-muted">
              <tr>
                <th class="px-3 py-1.5 text-left text-muted-foreground font-medium">Año</th>
                <th class="px-3 py-1.5 text-left text-muted-foreground font-medium">Mes</th>
                <th class="px-3 py-1.5 text-right text-muted-foreground font-medium">Tarifa ($/kWh)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in tarifasPreview" :key="i" class="border-t border-muted">
                <td class="px-3 py-1 text-foreground">{{ r.año }}</td>
                <td class="px-3 py-1 text-foreground">{{ r.mes }}</td>
                <td class="px-3 py-1 text-right text-foreground">{{ r.tarifa }}</td>
              </tr>
              <tr v-if="tarifasRows.length > PREVIEW_ROWS" class="border-t border-muted">
                <td colspan="3" class="px-3 py-1 text-muted-foreground/60 italic">… y {{ tarifasRows.length - PREVIEW_ROWS }} filas más</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── PASO 4: Compromisos de energía ────────────────────────────── -->
      <template v-if="step === 4">
        <p class="text-xs font-semibold text-warning uppercase tracking-wide mb-4">Compromisos de energía <span class="normal-case font-normal text-muted-foreground">(opcional)</span></p>
        <p class="text-xs text-muted-foreground mb-3">
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
            <template #icon><RefreshCwIcon class="size-4" /></template>
          </Button>
          <Button label="Descargar plantilla" size="small" severity="secondary" text @click="descargarPlantillaEnergia">
            <template #icon><DownloadIcon class="size-4" /></template>
          </Button>
          <Button v-if="energiaRows.length" label="Limpiar" size="small" severity="danger" text @click="energiaRows = []; energiaPaste = ''">
            <template #icon><XIcon class="size-4" /></template>
          </Button>
          <span v-if="energiaRows.length" class="text-xs text-success font-medium">
            ✓ {{ energiaRows.length }} filas listas
          </span>
          <span v-if="energiaError" class="text-xs text-destructive">{{ energiaError }}</span>
        </div>
        <div v-if="energiaRows.length" class="mt-3 border border-muted rounded-lg overflow-hidden">
          <table class="w-full text-xs">
            <thead class="bg-muted">
              <tr>
                <th class="px-3 py-1.5 text-left text-muted-foreground font-medium">Año</th>
                <th class="px-3 py-1.5 text-left text-muted-foreground font-medium">Mes</th>
                <th class="px-3 py-1.5 text-right text-muted-foreground font-medium">Mín (MWh)</th>
                <th class="px-3 py-1.5 text-right text-muted-foreground font-medium">Máx (MWh)</th>
                <th class="px-3 py-1.5 text-right text-muted-foreground font-medium">Plantas contrato</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in energiaPreview" :key="i" class="border-t border-muted">
                <td class="px-3 py-1 text-foreground">{{ r.año }}</td>
                <td class="px-3 py-1 text-foreground">{{ r.mes }}</td>
                <td class="px-3 py-1 text-right text-foreground">{{ r.energia_minima }}</td>
                <td class="px-3 py-1 text-right text-foreground">{{ r.energia_maxima }}</td>
                <td class="px-3 py-1 text-right text-foreground">{{ r.cantidad_proyectos ?? '—' }}</td>
              </tr>
              <tr v-if="energiaRows.length > PREVIEW_ROWS" class="border-t border-muted">
                <td colspan="5" class="px-3 py-1 text-muted-foreground/60 italic">… y {{ energiaRows.length - PREVIEW_ROWS }} filas más</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── PASO 5: GESCON + Resumen ───────────────────────────────────── -->
      <template v-if="step === 5">
        <p class="text-xs font-semibold text-warning uppercase tracking-wide mb-4">Resumen</p>

        <!-- Resumen -->
        <div class="rounded-lg border border-warning/20 bg-warning/10 p-4">
          <p class="text-xs font-semibold text-warning mb-3">Resumen</p>
          <div class="mb-2">
            <span class="text-xs text-muted-foreground">Proyectos:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="p in proyectosSeleccionados" :key="p.id"
                class="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                {{ p.nombre_comercial }}
              </span>
              <span v-if="!proyectosSeleccionados.length" class="text-xs text-muted-foreground/60">—</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground mt-3">
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
    <div class="px-6 py-4 border-t border-muted flex justify-between items-center">
      <Button v-if="step > 0" label="Anterior" severity="secondary" outlined @click="step--">
        <template #icon><ArrowLeftIcon class="size-4" /></template>
      </Button>
      <span v-else />
      <div class="flex gap-2">
        <Button label="Cancelar" severity="secondary" text @click="$emit('cerrar')" />
        <Button v-if="step < STEPS.length - 1" label="Siguiente" class="flex-row-reverse"
          :disabled="step === 1 && partesPendientes.length > 0"
          v-tooltip="avisoPartes"
          @click="avanzar">
          <template #icon><ArrowRightIcon class="size-4" /></template>
        </Button>
        <Button v-else label="Guardar contrato" :loading="guardando"
          :disabled="partesPendientes.length > 0" v-tooltip="avisoPartes" @click="guardar">
          <template #icon><CheckIcon class="size-4" /></template>
        </Button>
      </div>
    </div>

    <!-- Ya hay un PPA vigente que cubre esto. Avisa y deja seguir: una
         renovación, o un contrato de compra junto a uno de venta, son casos
         reales. Mismo diálogo que en el wizard de servicios. -->
    <Dialog :visible="!!duplicadoContrato" @update:visible="duplicadoContrato = null"
      header="Ya existe un contrato PPA para esto" modal class="w-full max-w-sm">
      <p class="text-sm text-muted-foreground">{{ duplicadoContrato?.mensaje }}</p>
      <p class="text-xs text-muted-foreground mt-2">
        Si es una renovación o un contrato distinto, podés crearlo igual.
      </p>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="duplicadoContrato = null" />
        <Button label="Crear igual" :loading="guardando" @click="crearDeTodosModos" />
      </template>
    </Dialog>
  </Dialog>
</template>

<script setup>
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, PlusIcon, RefreshCwIcon, XIcon } from '@lucide/vue'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Textarea from 'primevue/textarea'
import SelectorCliente from '~/features/clientes/components/SelectorCliente.vue'
import NitDeCliente from '~/features/clientes/components/NitDeCliente.vue'
import { PpaService } from '~/features/contratos/services/ppa'

const ppaService = new PpaService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

const props = defineProps({
  visible: Boolean,
  initialData: { type: Object, default: null },
  editandoId: { type: Number, default: null },
})
const emit = defineEmits(['update:visible', 'cerrar', 'creado', 'editado'])

const PREVIEW_ROWS = 5

// El ultimo paso era "GESCON" y pedia seis campos -- codigo_sic, gescon_codigo,
// sus dos fechas, precio y cantidades -- que se guardaban en ppa_contratos como
// copia a mano de lo que ya vive en asic_solicitudes. Ningun servicio del backend
// los leia, y un escalar no puede representar los muchos registros que tiene un
// PPA. El registro ante XM se crea en MEM -> GESCON; aqui solo queda el resumen.
const STEPS = [
  { label: 'Proyectos' },
  { label: 'Partes' },
  { label: 'Condiciones' },
  { label: 'Tarifas' },
  { label: 'Energía' },
  { label: 'Resumen' },
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
  es_comunidad_energetica: false,
  nombre_comunidad: '',
  fecha_entrada_comunidad: null,
  numero_codigo_contrato: null, nombre_interno: null, responsable_id: null,
  comprador_id: null, comprador_nombre: null, comprador_nit: null,
  vendedor_id: null, vendedor_nombre: null, vendedor_nit: null,
  fecha_inicio: null, fecha_fin: null,
  indice_indexacion: null, periodicidad_indexacion: null,
  periodo_indexacion_base: null, valor_indexacion_base: null,
  periodicidad_facturacion: null, tiempo_pago: null, condiciones_pago: null,
})

// Al DUPLICAR un contrato, lo que identifica al original no se copia. Los tres
// campos de GESCON que estaban aqui salieron con el paso 5: ya no viven en el
// formulario.
const EXCLUIR_DUPLICADO = ['numero_codigo_contrato', 'fecha_inicio', 'fecha_fin']

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

/**
 * El aviso de "ya existe un PPA vigente que cubre esto".
 *
 * Mismo tratamiento que en el wizard de servicios: avisa y deja seguir. Una
 * renovación, o un contrato de compra junto a uno de venta, son casos reales.
 */
const duplicadoContrato = ref(null)
const forzarDuplicado = ref(false)

function duplicadoDe(e) {
  const detail = e?.data?.detail ?? e?.response?.data?.detail
  return e?.status === 409 && detail?.duplicado_contrato ? detail : null
}

async function crearDeTodosModos() {
  forzarDuplicado.value = true
  duplicadoContrato.value = null
  try {
    await guardar()
  } finally {
    forzarDuplicado.value = false
  }
}

/**
 * Las partes que quedaron sin cliente vinculado.
 *
 * Un PPA con el nombre escrito a mano no aparece en el panel de ese cliente ni
 * en sus contratos, y Facturación no sabe a quién cobrarle: por eso bloquea el
 * guardado en vez de solo avisar.
 */
const partesPendientes = computed(() => {
  const faltan = []
  if (!form.comprador_id) faltan.push('el comprador')
  if (!form.vendedor_id) faltan.push('el vendedor')
  return faltan
})

const avisoPartes = computed(() =>
  partesPendientes.value.length
    ? `Falta vincular ${partesPendientes.value.join(' y ')} a un cliente registrado.`
    : undefined,
)

// ── Utils ────────────────────────────────────────────────────────────────────

function formatFecha(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// ── Guardar ──────────────────────────────────────────────────────────────────

/**
 * Guarda el contrato.
 *
 * **Al CREAR va todo en una sola petición** — contrato, plantas, tarifas y
 * compromisos—, porque el backend lo escribe en una transacción: o queda
 * completo o no queda nada. Antes eran tres peticiones seguidas sin transacción
 * común: si fallaba la segunda, el contrato quedaba creado y sin tarifas, y el
 * usuario no tenía cómo saberlo. Así quedaron 13 contratos sin tarifas y 14 sin
 * compromisos (ver `docs/DIAGNOSTICO_PPA.md` en el backend).
 *
 * **Al EDITAR siguen siendo peticiones aparte**, y no es una inconsistencia: los
 * `PUT` de tarifas y compromisos REEMPLAZAN el conjunto, así que mandarlos en
 * cada edición del contrato borraría las series de quien solo vino a corregir
 * una fecha. Se mandan solo si el usuario tocó esas pestañas.
 */
async function guardar() {
  guardando.value = true
  try {
    const payload = { ...form }
    // Las partes viajan solo como cliente: nombre y NIT son los de su ficha.
    for (const k of ['comprador_nombre', 'comprador_nit', 'vendedor_nombre', 'vendedor_nit']) {
      delete payload[k]
    }
    for (const k of ['fecha_inicio', 'fecha_fin', 'fecha_entrada_comunidad']) {
      payload[k] = formatFecha(form[k])
    }
    payload.proyecto_ids = proyectosSeleccionados.value.map(p => p.id)

    let contrato
    if (props.editandoId) {
      contrato = await ppaService.actualizar(props.editandoId, payload)
      if (tarifasRows.value.length) {
        await ppaService.guardarTarifas(props.editandoId, tarifasRows.value)
      }
      if (energiaRows.value.length) {
        await ppaService.guardarCompromisos(props.editandoId, energiaRows.value)
      }
      toast.success('Contrato actualizado', { duration: 3000 })
      emit('editado', contrato)
    } else {
      contrato = await ppaService.crear({
        ...payload,
        tarifas: tarifasRows.value,
        compromisos: energiaRows.value,
      }, forzarDuplicado.value)
      const msg = [
        `Contrato "${contrato.nombre_interno || contrato.numero_codigo_contrato}" creado`,
        tarifasRows.value.length ? `${tarifasRows.value.length} tarifas` : null,
        energiaRows.value.length ? `${energiaRows.value.length} compromisos` : null,
      ].filter(Boolean).join(' · ')
      toast.success('Contrato creado', { description: msg, duration: 4000 })

      // Lo que quedó cojo lo dice el backend, no el formulario: un contrato sin
      // plantas o sin compromisos no lo puede medir Cumplimiento. Se muestra
      // aparte del «creado» para que no se lea como un error.
      for (const aviso of contrato.avisos ?? []) {
        toast.warning('Revisa el contrato', { description: aviso, duration: 8000 })
      }
      emit('creado', contrato)
    }
    emit('cerrar')
  } catch (e) {
    const aviso = duplicadoDe(e)
    if (aviso) {
      duplicadoContrato.value = aviso
      return
    }
    toast.error('Error al guardar', { description: e.data?.detail || e.message, duration: 5000 })
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  try {
    // Los clientes los pide el catálogo compartido, una vez por pantalla:
    // ver ~/features/clientes/services/catalogoClientes.
    todosProyectos.value = await catalogoProyectos.cargar()
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
      <span class="text-muted-foreground">{{ props.label }}:</span>
      <span class="font-medium text-foreground">{{ props.value }}</span>
    </div>
  `,
}
export default { components: { ResumenFila } }
</script>
