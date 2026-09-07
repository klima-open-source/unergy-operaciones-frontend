<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button text @click="$router.back()" class="-ml-2">
          <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
        </Button>
        <div>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <ZapIcon class="text-amber-500 text-sm size-[1em]" />
            </div>
            <h2 class="text-xl font-bold text-gray-800">Contratos PPA</h2>
          </div>
          <p v-if="proyectoNombre" class="text-xs text-gray-400 mt-0.5 ml-11">{{ proyectoNombre }}</p>
        </div>
      </div>
      <Button v-if="tabActivo === 0" label="Nuevo contrato" @click="abrirFormNuevo">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- Tabs -->
    <TabView v-model:activeIndex="tabActivo">

      <!-- Tab 1: Contratos asociados -->
      <TabPanel header="Contratos asociados">
        <div v-if="loading" class="flex justify-center py-16"><ProgressSpinner /></div>

        <div v-else-if="contratos.length === 0" class="flex flex-col items-center py-16 gap-3 text-gray-400">
          <ZapIcon class="text-4xl text-amber-300 size-[1em]" />
          <p class="text-sm">No hay contratos PPA registrados para este proyecto.</p>
          <Button label="Registrar primer contrato" outlined @click="abrirFormNuevo">
            <template #icon><PlusIcon class="size-[1em]" /></template>
          </Button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div v-for="c in contratos" :key="c.id"
            class="border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-3">
              <div>
                <p class="font-semibold text-gray-800">{{ c.nombre_interno || c.numero_codigo_contrato || 'Sin nombre' }}</p>
                <p v-if="c.nombre_interno && c.numero_codigo_contrato" class="text-xs text-gray-400 mt-0.5">{{ c.numero_codigo_contrato }}</p>
              </div>
              <div class="flex items-center gap-1">
                <GBadge :color="c.tipo_contrato === 'venta' ? 'success' : 'information'" class="text-xs">{{ c.tipo_contrato || '—' }}</GBadge>
                <Button text size="small" severity="secondary" @click="abrirFormEditar(c)">
                  <template #icon><PencilIcon class="size-[1em]" /></template>
                </Button>
                <Button text size="small" severity="danger" @click="confirmarEliminar(c)">
                  <template #icon><Trash2Icon class="size-[1em]" /></template>
                </Button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
              <span><b class="text-gray-600">Comprador:</b> {{ c.comprador_nombre || '—' }}</span>
              <span><b class="text-gray-600">Vendedor:</b> {{ c.vendedor_nombre || '—' }}</span>
              <span><b class="text-gray-600">Vigencia:</b> {{ formatFecha(c.fecha_inicio) }} → {{ formatFecha(c.fecha_fin) }}</span>
              <span><b class="text-gray-600">Tarifa base:</b> {{ c.tarifa_base != null ? `$${c.tarifa_base}/kWh` : '—' }}</span>
              <span><b class="text-gray-600">Índice:</b> {{ c.indice_indexacion || '—' }}</span>
              <span><b class="text-gray-600">Tiempo pago:</b> {{ c.tiempo_pago != null ? `${c.tiempo_pago} días` : '—' }}</span>
            </div>
            <div v-if="c.tarifas?.length || c.compromisos_energia?.length" class="mt-3 flex gap-2">
              <GBadge v-if="c.tarifas?.length" color="default" class="text-xs">{{ c.tarifas.length }} tarifas</GBadge>
              <GBadge v-if="c.compromisos_energia?.length" color="default" class="text-xs">{{ c.compromisos_energia.length }} compromisos</GBadge>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 2: ASIC -->
      <TabPanel header="ASIC">
        <div v-if="loadingAsic" class="flex justify-center py-16"><ProgressSpinner /></div>

        <div v-else-if="asicRows.length === 0" class="flex flex-col items-center py-16 gap-3 text-gray-400">
          <FilePenIcon class="text-4xl text-blue-300 size-[1em]" />
          <p class="text-sm">No hay registros GESCON/ASIC asociados a este proyecto.</p>
        </div>

        <div v-else class="pt-4">
          <p class="text-xs text-gray-400 mb-3">{{ asicRows.length }} registro{{ asicRows.length !== 1 ? 's' : '' }} en GESCON</p>
          <DataTable :value="asicRows" size="small" stripedRows :rowHover="true"
            class="text-sm" scrollable scrollHeight="500px">
            <Column field="codigo_sic_contrato" header="SIC" style="min-width:90px" />
            <Column field="contrato_interno" header="Contrato" style="min-width:120px" />
            <Column header="Tipo" style="min-width:110px">
              <template #body="{ data }">
                <GBadge :color="tipoSeverity(data.tipo_solicitud)" class="text-xs">{{ data.tipo_solicitud || '—' }}</GBadge>
              </template>
            </Column>
            <Column field="requerimiento_asic" header="Req." style="min-width:90px" />
            <Column header="Inicio" style="min-width:95px">
              <template #body="{ data }">{{ formatFecha(data.fecha_inicio) }}</template>
            </Column>
            <Column header="Fin" style="min-width:95px">
              <template #body="{ data }">
                <span :class="esVencido(data.fecha_fin) ? 'text-red-500 font-medium' : ''">
                  {{ formatFecha(data.fecha_fin) }}
                </span>
              </template>
            </Column>
            <Column header="Estado" style="min-width:110px">
              <template #body="{ data }">
                <GBadge :color="estadoSeverity(data.estado_solicitud)" class="text-xs">{{ data.estado_solicitud || '—' }}</GBadge>
              </template>
            </Column>
            <Column header="Desp. %" style="min-width:80px">
              <template #body="{ data }">
                {{ data.porcentaje_fncer != null ? `${data.porcentaje_fncer}%` : '—' }}
              </template>
            </Column>
            <Column header="Link" style="min-width:70px">
              <template #body="{ data }">
                <a v-if="data.link_archivo" :href="data.link_archivo" target="_blank"
                  class="text-blue-500 hover:text-blue-700">
                  <ExternalLinkIcon class="size-[1em]" />
                </a>
                <span v-else class="text-gray-300">—</span>
              </template>
            </Column>
            <Column style="min-width:60px">
              <template #body="{ data }">
                <Button text size="small" severity="danger" v-tooltip.top="'Eliminar registro'" @click="confirmarEliminarAsic(data)">
                  <template #icon><Trash2Icon class="size-[1em]" /></template>
                </Button>
              </template>
            </Column>
          </DataTable>
        </div>
      </TabPanel>

    </TabView>

    <!-- Dialog formulario PPA -->
    <Dialog v-model:visible="showForm" :header="editando ? 'Editar contrato PPA' : 'Nuevo contrato PPA'"
      modal :style="{ width: '780px' }" :breakpoints="{ '960px': '90vw' }" @hide="resetForm">
      <div class="space-y-5 pt-1">

        <!-- Identificación -->
        <fieldset class="border border-gray-100 rounded-lg p-4 space-y-3">
          <legend class="text-xs font-semibold text-amber-600 uppercase tracking-wide px-1">Identificación</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Número de contrato</label>
              <InputText v-model="form.numero_codigo_contrato" placeholder="Ej: PPA-2024-001" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Nombre interno</label>
              <InputText v-model="form.nombre_interno" placeholder="Ej: PPA Planta Laureles" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1 w-48">
            <label class="field-label">Tipo de contrato</label>
            <Select v-model="form.tipo_contrato" :options="TIPOS_CONTRATO" optionLabel="label" optionValue="value"
              placeholder="Seleccionar" class="w-full" />
          </div>
        </fieldset>

        <!-- Partes -->
        <fieldset class="border border-gray-100 rounded-lg p-4 space-y-3">
          <legend class="text-xs font-semibold text-amber-600 uppercase tracking-wide px-1">Partes</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Comprador — Nombre / Razón social</label>
              <InputText v-model="form.comprador_nombre" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Comprador — NIT</label>
              <InputText v-model="form.comprador_nit" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Vendedor — Nombre / Razón social</label>
              <InputText v-model="form.vendedor_nombre" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Vendedor — NIT</label>
              <InputText v-model="form.vendedor_nit" class="w-full" />
            </div>
          </div>
        </fieldset>

        <!-- Vigencia -->
        <fieldset class="border border-gray-100 rounded-lg p-4 space-y-3">
          <legend class="text-xs font-semibold text-amber-600 uppercase tracking-wide px-1">Vigencia</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha inicio de despacho</label>
              <DatePicker v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Fecha final del despacho</label>
              <DatePicker v-model="form.fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
          </div>
        </fieldset>

        <!-- Condiciones comerciales -->
        <fieldset class="border border-gray-100 rounded-lg p-4 space-y-3">
          <legend class="text-xs font-semibold text-amber-600 uppercase tracking-wide px-1">Condiciones comerciales</legend>
          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Tarifa base ($/kWh)</label>
              <InputNumber v-model="form.tarifa_base" :maxFractionDigits="4" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Índice de indexación</label>
              <InputText v-model="form.indice_indexacion" placeholder="Ej: IPP, IPC" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Periodicidad indexación</label>
              <Select v-model="form.periodicidad_indexacion" :options="PERIODICIDADES" optionLabel="label" optionValue="value"
                placeholder="Seleccionar" class="w-full" showClear />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Período base indexación (AAAA-MM)</label>
              <InputText v-model="form.periodo_indexacion_base" placeholder="2024-01" maxlength="7" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Valor base indexación</label>
              <InputNumber v-model="form.valor_indexacion_base" :maxFractionDigits="4" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Tiempo de pago (días)</label>
              <InputNumber v-model="form.tiempo_pago" :useGrouping="false" placeholder="Ej: 30" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Periodicidad facturación</label>
              <Select v-model="form.periodicidad_facturacion" :options="PERIODICIDADES" optionLabel="label" optionValue="value"
                placeholder="Seleccionar" class="w-full" showClear />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Condiciones de pago</label>
            <Textarea v-model="form.condiciones_pago" rows="2" class="w-full" autoResize />
          </div>
        </fieldset>

        <!-- Energía comprometida -->
        <fieldset class="border border-gray-100 rounded-lg p-4 space-y-3">
          <legend class="text-xs font-semibold text-amber-600 uppercase tracking-wide px-1">Energía comprometida</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Cantidad mínima (kWh/mes)</label>
              <InputNumber v-model="form.cantidad_minima_kwh_mes" :maxFractionDigits="3" locale="en-US" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Cantidad máxima (kWh/mes)</label>
              <InputNumber v-model="form.cantidad_maxima_kwh_mes" :maxFractionDigits="3" locale="en-US" class="w-full" />
            </div>
          </div>
        </fieldset>

        <!-- GESCON / ASIC -->
        <fieldset class="border border-gray-100 rounded-lg p-4 space-y-3">
          <legend class="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Registro GESCON / ASIC</legend>
          <div class="grid grid-cols-3 gap-3">
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
        </fieldset>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showForm = false" />
        <Button :label="editando ? 'Guardar cambios' : 'Crear contrato'" :loading="guardando" @click="guardar">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { PpaService } from '~/features/contratos/services/ppa'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, FilePenIcon, PencilIcon, PlusIcon, Trash2Icon, ZapIcon } from '@lucide/vue'

const ppaService = new PpaService()
const proyectosService = new ProyectosService()

const route = useRoute()
const confirm = useConfirm()

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

const proyectoId = Number(route.params.id)
const proyectoNombre = ref('')
const tabActivo = ref(0)

// --- Tab Contratos asociados ---
const contratos = ref([])
const loading = ref(true)
const showForm = ref(false)
const guardando = ref(false)
const editando = ref(null)

// --- Tab ASIC ---
const asicRows = ref([])
const loadingAsic = ref(false)

const hoy = new Date().toISOString().slice(0, 10)

const FORM_EMPTY = {
  numero_codigo_contrato: null, nombre_interno: null, tipo_contrato: null,
  comprador_nombre: null, comprador_nit: null,
  vendedor_nombre: null, vendedor_nit: null,
  fecha_inicio: null, fecha_fin: null,
  tarifa_base: null, indice_indexacion: null,
  periodicidad_indexacion: null, periodo_indexacion_base: null, valor_indexacion_base: null,
  cantidad_minima_kwh_mes: null, cantidad_maxima_kwh_mes: null,
  periodicidad_facturacion: null, tiempo_pago: null, condiciones_pago: null,
  codigo_sic: null,
  gescon_codigo: null, gescon_fecha_inicio: null, gescon_fecha_fin: null,
  gescon_precio: null, gescon_cantidades_kwh: null,
}
const form = reactive({ ...FORM_EMPTY })

function resetForm() {
  Object.assign(form, FORM_EMPTY)
  editando.value = null
}

function abrirFormNuevo() {
  resetForm()
  showForm.value = true
}

function abrirFormEditar(contrato) {
  resetForm()
  Object.keys(form).forEach(k => {
    form[k] = contrato[k] ?? null
  })
  editando.value = contrato.id
  showForm.value = true
}

function formatFecha(f) {
  if (!f) return '—'
  return String(f).slice(0, 10)
}

function esVencido(fecha) {
  if (!fecha) return false
  return String(fecha).slice(0, 10) < hoy
}

function tipoSeverity(tipo) {
  const map = { registro: 'success', modificacion: 'information', terminacion: 'destructive', desistimiento: 'warning' }
  return map[tipo] || 'default'
}

function estadoSeverity(estado) {
  const map = { publicado: 'success', en_proceso: 'information', rechazado: 'destructive', desistido: 'warning' }
  return map[estado] || 'default'
}

function toISODate(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

async function guardar() {
  guardando.value = true
  try {
    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      if (['fecha_inicio', 'fecha_fin', 'gescon_fecha_inicio', 'gescon_fecha_fin'].includes(k)) {
        payload[k] = toISODate(v)
      } else {
        payload[k] = v !== '' ? v : null
      }
    }

    if (editando.value) {
      await ppaService.actualizar(editando.value, payload)
      toast.success('Contrato actualizado', { duration: 3000 })
    } else {
      await ppaService.crear({ ...payload, proyecto_id: proyectoId })
      toast.success('Contrato creado', { duration: 3000 })
    }
    showForm.value = false
    await cargarContratos()
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

function confirmarEliminar(contrato) {
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Eliminar el contrato "${contrato.nombre_interno || contrato.numero_codigo_contrato || 'sin nombre'}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await ppaService.eliminar(contrato.id)
        contratos.value = contratos.value.filter(c => c.id !== contrato.id)
        toast.success('Contrato eliminado', { duration: 2000 })
      } catch (e) {
        const detail = e.data?.detail
        toast.error('No se puede eliminar', {
          description: detail || 'Error al eliminar el contrato.',
          duration: 6000,
        })
      }
    },
  })
}

function confirmarEliminarAsic(registro) {
  const label = registro.codigo_sic_contrato || registro.contrato_interno || `ID ${registro.id}`
  confirm({
    title: 'Confirmar eliminación GESCON',
    description: `¿Eliminar el registro GESCON "${label}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await ppaService.eliminarAsic(registro.id)
        asicRows.value = asicRows.value.filter(r => r.id !== registro.id)
        toast.success('Registro GESCON eliminado', { duration: 2000 })
      } catch (e) {
        const detail = e.data?.detail
        toast.error('No se puede eliminar', {
          description: detail || 'Error al eliminar el registro GESCON.',
          duration: 6000,
        })
      }
    },
  })
}

async function cargarContratos() {
  contratos.value = await ppaService.listar({ proyecto_id: proyectoId })
}

async function cargarAsic() {
  loadingAsic.value = true
  try {
    asicRows.value = await ppaService.listarAsic({ proyecto_id: proyectoId, size: 200 })
  } catch (e) {
    toast.error('Error ASIC', { description: e.message, duration: 4000 })
  } finally {
    loadingAsic.value = false
  }
}

onMounted(async () => {
  try {
    const [proyecto] = await Promise.all([
      proyectosService.obtener(proyectoId),
      cargarContratos(),
      cargarAsic(),
    ])
    proyectoNombre.value = proyecto.nombre_comercial
  } catch (e) {
    toast.error('Error al cargar', { description: e.message, duration: 4000 })
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
