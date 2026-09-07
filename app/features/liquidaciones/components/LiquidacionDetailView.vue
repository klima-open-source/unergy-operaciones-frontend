<template>
  <div class="space-y-3 p-3" style="background:var(--color-unergy-avena); min-height:100vh">

    <!-- Header -->
    <div class="flex items-center gap-2 flex-wrap">
      <Button label="Volver" text size="small" @click="volver">
        <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
      </Button>
      <div class="flex items-center gap-2 flex-wrap">
        <h2 class="text-base font-semibold" style="color:var(--color-unergy-deep)">
          {{ liq?.proyecto_nombre }} — {{ formatPeriodo(liq?.periodo) }}
        </h2>
        <GBadge v-if="liq" :color="estadoSeverity(liq.estado)" class="text-xs">{{ liq.estado }}</GBadge>
      </div>
      <div class="ml-auto flex gap-2 flex-wrap items-center">
        <a v-if="liq?.estado_resultados_url" :href="liq.estado_resultados_url" target="_blank"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
          style="background:var(--color-unergy-yellow); color:var(--color-unergy-deep)">
          <ChartLineIcon class="text-xs size-[1em]" />Estado de Resultados
        </a>
        <Button label="Descargar PDF" size="small" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple)" @click="router.push(`/liquidaciones/${route.params.id}/pdf`)">
          <template #icon><FileTextIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <ProgressSpinner v-if="loading" class="block mx-auto" />

    <template v-if="!loading && liq">

      <!-- Banner filtro por inversionista -->
      <div v-if="invFiltroId && invFiltrado"
        class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs flex-wrap"
        style="background:rgba(145,91,216,0.08); border:1px solid rgba(145,91,216,0.2)">
        <UserIcon class="shrink-0 size-[1em]" style="color:var(--color-unergy-purple)" />
        <span style="color:var(--color-unergy-deep)">
          Mostrando datos de:
          <strong>{{ invFiltrado.cliente_nombre }}</strong>
          ({{ pct(invFiltrado.porcentaje_participacion) }})
        </span>
        <button class="ml-auto flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 shrink-0"
          style="color:var(--color-unergy-purple)"
          @click="router.push(`/liquidaciones/${route.params.id}`)">
          <CircleXIcon class="text-xs size-[1em]" />
          Ver proyecto completo
        </button>
      </div>

      <!-- Indicador: este mes vs promedio de los 3 meses anteriores (solo KPIs) -->
      <IngresoCostoComparativo :proyecto-id="liq.proyecto_id" :proyecto-nombre="liq.proyecto_nombre" :periodo="liq.periodo" :show-chart="false" />

      <!-- Generación y tarifas del mes (ancho completo) -->
      <GeneracionMensualChart :proyecto-id="liq.proyecto_id" :proyecto-nombre="liq.proyecto_nombre" :periodo="liq.periodo" />

      <!-- Estado de Resultados por inversionista: espejo del Panel Contable del período -->
      <EstadoResultadosConsolidado :panel="panelER" :filtro-pi-id="invFiltroId" />

      <!-- Datos adicionales: comprobante, consecutivos -->
      <div class="bg-white rounded-lg shadow-sm border px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style="color:var(--color-unergy-deep);border-color:#e8e0f0">
        <span><span class="text-gray-400">Comprobante:</span>
          <strong class="ml-1">{{ liq.comprobante_contable_ref || '—' }}</strong></span>
        <span><span class="text-gray-400">Consec. Ingresos:</span>
          <strong class="ml-1">{{ liq.consecutivo_inicial_ingresos ?? '—' }}</strong></span>
        <span><span class="text-gray-400">Consec. Costos:</span>
          <strong class="ml-1">{{ liq.consecutivo_inicial_costos ?? '—' }}</strong></span>
        <span><span class="text-gray-400">Tasa cambio:</span>
          <strong class="ml-1">{{ liq.tasa_cambio ?? '—' }}</strong></span>
        <span v-if="liq.observaciones_resultados" class="text-gray-500 italic">
          {{ liq.observaciones_resultados }}</span>
      </div>

      <!-- Las secciones editables (Ingresos/Costos/Servicios) se consolidaron en el
           Estado de Resultados de arriba (con soportes inline). -->
    </template>

    <!-- ─── Dialog: Estado ───────────────────────────────────────────────── -->
    <Dialog v-model:visible="dialogEstado" header="Actualizar estado" modal class="w-72">
      <div class="space-y-3 py-2">
        <Select v-model="nuevoEstado" :options="estadosOpciones" class="w-full" />
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" size="small" @click="dialogEstado = false" />
          <Button label="Guardar" size="small" :loading="guardando" @click="guardarEstado" />
        </div>
      </div>
    </Dialog>

    <!-- ─── Dialog: Resumen financiero ──────────────────────────────────── -->
    <Dialog v-model:visible="dialogResumen" header="Editar resumen financiero" modal class="w-full max-w-lg">
      <div class="grid grid-cols-2 gap-3 py-2">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">Tasa de cambio (USD/COP)</label>
          <InputNumber v-model="resumenForm.tasa_cambio" :maxFractionDigits="4" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">Comprobante contable</label>
          <InputText v-model="resumenForm.comprobante_contable_ref" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">Consecutivo inicial ingresos</label>
          <InputNumber v-model="resumenForm.consecutivo_inicial_ingresos" :useGrouping="false" :maxFractionDigits="0" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">Consecutivo inicial costos</label>
          <InputNumber v-model="resumenForm.consecutivo_inicial_costos" :useGrouping="false" :maxFractionDigits="0" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">Fecha inicio proceso</label>
          <DatePicker v-model="resumenForm.fecha_inicio_proceso" dateFormat="yy-mm-dd" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">Fecha firma</label>
          <DatePicker v-model="resumenForm.fecha_firma" dateFormat="yy-mm-dd" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-600">URL estado de resultados</label>
          <InputText v-model="resumenForm.estado_resultados_url" class="w-full" placeholder="https://..." />
        </div>
        <div class="flex flex-col gap-1 col-span-2">
          <label class="text-xs text-gray-600">Observaciones</label>
          <Textarea v-model="resumenForm.observaciones_resultados" rows="2" class="w-full" />
        </div>
        <div class="col-span-2 flex justify-end gap-2 pt-1">
          <Button label="Cancelar" severity="secondary" size="small" @click="dialogResumen = false" />
          <Button label="Guardar" size="small" :loading="guardando" @click="guardarResumen" />
        </div>
      </div>
    </Dialog>


  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { logger } from '~/core/logger'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import EstadoResultadosConsolidado from './components/EstadoResultadosConsolidado.vue'
import GeneracionMensualChart from './components/GeneracionMensualChart.vue'
import IngresoCostoComparativo from './components/IngresoCostoComparativo.vue'
import { ArrowLeftIcon, ChartLineIcon, CircleXIcon, FileTextIcon, UserIcon } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const liquidacionesService = new LiquidacionesService()
const proyectosService = new ProyectosService()

// Navegación determinística hacia arriba (el padre del detalle es el listado).
// Evita loops de history.back() cuando se entra por link directo.
function volver() {
  router.push('/liquidaciones')
}

const liq = ref(null)
const proyectoInversionistas = ref([])
const panelER = ref(null)   // entrada del Panel Contable (resumen-panel) para este proyecto+período
const loading = ref(false)
const guardando = ref(false)

// Secciones de edición colapsadas por defecto: el resumen lo da el Estado de Resultados arriba
const seccionesAbiertas = ref(new Set())
function toggleSeccion(key) {
  if (seccionesAbiertas.value.has(key)) seccionesAbiertas.value.delete(key)
  else seccionesAbiertas.value.add(key)
  seccionesAbiertas.value = new Set(seccionesAbiertas.value)
}

// ─── Catálogos ────────────────────────────────────────────────────────────────
const estadosOpciones = [
  'iniciada', 'costos_registrados', 'xm_procesado', 'mandatos_emitidos',
  'en_contabilidad', 'en_revisoria', 'facturado', 'entregado',
]

// ─── Dialogs estado ───────────────────────────────────────────────────────────
const dialogEstado = ref(false)
const nuevoEstado = ref('')

// ─── Dialog resumen ───────────────────────────────────────────────────────────
const dialogResumen = ref(false)
const resumenForm = reactive({
  tasa_cambio: null,
  comprobante_contable_ref: '', consecutivo_inicial_ingresos: null,
  consecutivo_inicial_costos: null, fecha_inicio_proceso: null,
  fecha_firma: null, estado_resultados_url: '', observaciones_resultados: '',
})

function abrirEditResumen() {
  Object.assign(resumenForm, {
    tasa_cambio: liq.value.tasa_cambio ?? null,
    comprobante_contable_ref: liq.value.comprobante_contable_ref ?? '',
    consecutivo_inicial_ingresos: liq.value.consecutivo_inicial_ingresos ?? null,
    consecutivo_inicial_costos: liq.value.consecutivo_inicial_costos ?? null,
    fecha_inicio_proceso: liq.value.fecha_inicio_proceso ?? null,
    fecha_firma: liq.value.fecha_firma ?? null,
    estado_resultados_url: liq.value.estado_resultados_url ?? '',
    observaciones_resultados: liq.value.observaciones_resultados ?? '',
  })
  dialogResumen.value = true
}

// ─── Computed ─────────────────────────────────────────────────────────────────

// Filtro de inversionista desde query param ?inv=<proyecto_inversionista_id>
const invFiltroId = computed(() => route.query.inv ? Number(route.query.inv) : null)
const invFiltrado = computed(() =>
  invFiltroId.value != null
    ? (proyectoInversionistas.value.find(pi => pi.id === invFiltroId.value) ?? null)
    : null
)

// Inversionistas a mostrar en la capa "por inversionista": si hay filtro ?inv=,
// solo ese; si no, todos los del proyecto.
function pct(v) {
  if (v == null) return '—'
  return (v * 100).toFixed(4) + '%'
}
function formatPeriodo(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${meses[parseInt(m) - 1]} ${y}`
}
function estadoSeverity(e) {
  return {
    iniciada: 'default', costos_registrados: 'information', xm_procesado: 'information',
    mandatos_emitidos: 'warning', en_contabilidad: 'warning', en_revisoria: 'warning',
    facturado: 'success', entregado: 'default',
  }[e] || 'default'
}
function facturaEstadoSeverity(e) {
  return { emitida: 'info', pagada: 'success', vencida: 'danger' }[e] || 'secondary'
}
function isoDate(v) {
  if (!v) return null
  if (typeof v === 'string') return v
  const d = new Date(v)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Carga ────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await liquidacionesService.obtener(route.params.id)
    liq.value = data
    nuevoEstado.value = data.estado
  } catch (e) {
    logger.error('liquidaciones', e)
    toast.error(`Error ${e?.status || 'red'} — liq ${route.params.id}`, {
      description: JSON.stringify(e?.data ?? e?.message ?? 'sin detalle').slice(0, 300),
      duration: 10000,
    })
  } finally {
    loading.value = false
  }

  if (liq.value?.proyecto_id) {
    try {
      const raw = await proyectosService.listarInversionistas(liq.value.proyecto_id)
      proyectoInversionistas.value = Array.isArray(raw) ? raw : (raw.items ?? [])
    } catch (e) {
      logger.error('liquidaciones', e)
    }

    // Estado de Resultados = espejo del Panel Contable del período (fuente única).
    try {
      const per = (liq.value.periodo || '').slice(0, 7)   // "YYYY-MM"
      if (per) {
        const data = await liquidacionesService.obtenerResumenPanel({ periodo: per, tipo: 'preliquidacion' })
        panelER.value = (data.proyectos || []).find(p => p.proyecto_id === liq.value.proyecto_id) || null
      }
    } catch (e) {
      logger.error('liquidaciones', e)
      panelER.value = null
    }
  }
}

// ─── Guardar estado ───────────────────────────────────────────────────────────
async function guardarEstado() {
  guardando.value = true
  try {
    await liquidacionesService.actualizar(route.params.id, { estado: nuevoEstado.value })
    liq.value.estado = nuevoEstado.value
    dialogEstado.value = false
    toast.success('Estado actualizado', { duration: 2000 })
  } catch {
    toast.error('Error', { description: 'No se pudo actualizar', duration: 3000 })
  } finally {
    guardando.value = false
  }
}

// ─── Guardar resumen ──────────────────────────────────────────────────────────
async function guardarResumen() {
  guardando.value = true
  try {
    const payload = {}
    const keys = Object.keys(resumenForm)
    for (const k of keys) {
      const v = resumenForm[k]
      // Incluir números (incluso 0), strings no vacíos, booleans, fechas
      if (v !== null && v !== undefined) {
        if (typeof v === 'string') {
          payload[k] = v || null  // convertir string vacío a null
        } else if (v instanceof Date) {
          payload[k] = isoDate(v)
        } else {
          payload[k] = v
        }
      }
    }
    await liquidacionesService.actualizar(route.params.id, payload)
    // Recargar para asegurar consistencia con el servidor
    await load()
    dialogResumen.value = false
    toast.success('Resumen actualizado', { duration: 2000 })
  } catch {
    toast.error('Error', { description: 'No se pudo actualizar', duration: 3000 })
  } finally {
    guardando.value = false
  }
}

onMounted(load)
</script>
