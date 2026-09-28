<script setup lang="ts">
import {
  ArrowLeftIcon,
  ChartLineIcon,
  CircleXIcon,
  FileTextIcon,
  PencilIcon,
  UserIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import type { InversionistaProyecto } from '~/features/proyectos/types'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ESTADOS_LIQUIDACION } from '~/features/liquidaciones/constants'
import type {
  Liquidacion,
  PayloadActualizarLiquidacion,
  ProyectoResumenPanel,
} from '~/features/liquidaciones/types'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { estadoSeverity, formatPeriodo, pct } from '~/features/liquidaciones/utils/liquidaciones'
import EstadoResultadosConsolidado from './components/EstadoResultadosConsolidado.vue'
import GeneracionMensualChart from './components/GeneracionMensualChart.vue'
import IngresoCostoComparativo from './components/IngresoCostoComparativo.vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DatePicker`.
import DatePicker from '~/components/blocks/DatePicker.vue'

const SCOPE = 'liquidaciones'

const route = useRoute()
const router = useRouter()
const liquidacionesService = new LiquidacionesService()
const proyectosService = new ProyectosService()

// Navegación determinística hacia arriba (el padre del detalle es el listado).
// Evita loops de history.back() cuando se entra por link directo.
function volver() {
  router.push('/liquidaciones')
}

const liq = ref<Liquidacion | null>(null)
const proyectoInversionistas = ref<InversionistaProyecto[]>([])
const panelER = ref<ProyectoResumenPanel | null>(null) // entrada del Panel Contable (resumen-panel) para este proyecto+período
const loading = ref(false)
const guardando = ref(false)

// ─── Dialogs estado ───────────────────────────────────────────────────────────
const dialogEstado = ref(false)
const nuevoEstado = ref('')

function abrirEditEstado() {
  if (!liq.value) return
  nuevoEstado.value = liq.value.estado || ''
  dialogEstado.value = true
}

// ─── Dialog resumen ───────────────────────────────────────────────────────────
const dialogResumen = ref(false)
const resumenForm = reactive({
  tasa_cambio: null as number | null,
  comprobante_contable_ref: '',
  consecutivo_inicial_ingresos: null as number | null,
  consecutivo_inicial_costos: null as number | null,
  fecha_inicio_proceso: null as string | null,
  fecha_firma: null as string | null,
  estado_resultados_url: '',
  observaciones_resultados: '',
})

function abrirEditResumen() {
  if (!liq.value) return
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
const invFiltroId = computed(() => (route.query.inv ? Number(route.query.inv) : null))
const invFiltrado = computed(() =>
  invFiltroId.value != null
    ? (proyectoInversionistas.value.find((pi) => pi.id === invFiltroId.value) ?? null)
    : null,
)

// ─── Carga ────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await liquidacionesService.obtener(Number(route.params.id))
    liq.value = data
  } catch (e) {
    logger.error(SCOPE, e)
    toast.error(`Error — liq ${route.params.id}`, {
      description: normalizeError(e).message,
      duration: 10000,
    })
  } finally {
    loading.value = false
  }

  if (liq.value?.proyecto_id) {
    try {
      proyectoInversionistas.value = await proyectosService.listarInversionistas(
        liq.value.proyecto_id,
      )
    } catch (e) {
      logger.error(SCOPE, e)
    }

    // Estado de Resultados = espejo del Panel Contable del período (fuente única).
    try {
      const per = (liq.value.periodo || '').slice(0, 7) // "YYYY-MM"
      if (per) {
        const data = await liquidacionesService.obtenerResumenPanel({
          periodo: per,
          tipo: 'preliquidacion',
        })
        panelER.value =
          (data.proyectos || []).find((p) => p.proyecto_id === liq.value?.proyecto_id) || null
      }
    } catch (e) {
      logger.error(SCOPE, e)
      panelER.value = null
    }
  }
}

// ─── Guardar estado ───────────────────────────────────────────────────────────
async function guardarEstado() {
  if (!liq.value) return
  guardando.value = true
  try {
    await liquidacionesService.actualizar(Number(route.params.id), { estado: nuevoEstado.value })
    liq.value.estado = nuevoEstado.value
    dialogEstado.value = false
    toast.success('Estado actualizado', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message, duration: 3000 })
  } finally {
    guardando.value = false
  }
}

// ─── Guardar resumen ──────────────────────────────────────────────────────────
async function guardarResumen() {
  guardando.value = true
  try {
    const payload: PayloadActualizarLiquidacion = {}
    for (const [k, v] of Object.entries(resumenForm)) {
      // Incluir números (incluso 0), strings no vacíos, booleans, fechas
      if (v === null || v === undefined) continue
      payload[k] = typeof v === 'string' ? v || null : v // convertir string vacío a null
    }
    await liquidacionesService.actualizar(Number(route.params.id), payload)
    // Recargar para asegurar consistencia con el servidor
    await load()
    dialogResumen.value = false
    toast.success('Resumen actualizado', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message, duration: 3000 })
  } finally {
    guardando.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" @click="volver">
        <ArrowLeftIcon class="size-4" />
        Volver
      </Button>
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-base font-semibold text-foreground">
          {{ liq?.proyecto_nombre }} — {{ formatPeriodo(liq?.periodo) }}
        </h2>
        <button
          v-if="liq"
          class="inline-flex items-center gap-1"
          title="Cambiar el estado"
          @click="abrirEditEstado"
        >
          <GBadge :color="estadoSeverity(liq.estado)" class="text-xs">{{ liq.estado }}</GBadge>
          <PencilIcon class="size-3 text-muted-foreground" />
        </button>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <a
          v-if="liq?.estado_resultados_url"
          :href="liq.estado_resultados_url"
          target="_blank"
          class="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
        >
          <ChartLineIcon class="size-3.5" />Estado de Resultados
        </a>
        <Button size="sm" @click="router.push(`/liquidaciones/${route.params.id}/pdf`)">
          <FileTextIcon class="size-4" />
          Descargar PDF
        </Button>
      </div>
    </div>

    <Spinner v-if="loading" class="mx-auto block size-6 text-muted-foreground" />

    <template v-if="!loading && liq">
      <!-- Banner filtro por inversionista -->
      <div
        v-if="invFiltroId && invFiltrado"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs"
      >
        <UserIcon class="size-4 shrink-0 text-primary" />
        <span class="text-foreground">
          Mostrando datos de:
          <strong>{{ invFiltrado.cliente_nombre }}</strong>
          ({{ pct(invFiltrado.porcentaje_participacion) }})
        </span>
        <button
          class="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-70"
          @click="router.push(`/liquidaciones/${route.params.id}`)"
        >
          <CircleXIcon class="size-3.5" />
          Ver proyecto completo
        </button>
      </div>

      <!-- Indicador: este mes vs promedio de los 3 meses anteriores (solo KPIs) -->
      <IngresoCostoComparativo
        :proyecto-id="liq.proyecto_id"
        :proyecto-nombre="liq.proyecto_nombre"
        :periodo="liq.periodo"
        :show-chart="false"
      />

      <!-- Generación y tarifas del mes (ancho completo) -->
      <GeneracionMensualChart
        :proyecto-id="liq.proyecto_id"
        :proyecto-nombre="liq.proyecto_nombre"
        :periodo="liq.periodo"
      />

      <!-- Estado de Resultados por inversionista: espejo del Panel Contable del período -->
      <EstadoResultadosConsolidado :panel="panelER" :filtro-pi-id="invFiltroId" />

      <!-- Datos adicionales: comprobante, consecutivos -->
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-3 py-2 text-[11px] text-foreground"
      >
        <span
          ><span class="text-muted-foreground">Comprobante:</span>
          <strong class="ml-1">{{ liq.comprobante_contable_ref || '—' }}</strong></span
        >
        <span
          ><span class="text-muted-foreground">Consec. Ingresos:</span>
          <strong class="ml-1">{{ liq.consecutivo_inicial_ingresos ?? '—' }}</strong></span
        >
        <span
          ><span class="text-muted-foreground">Consec. Costos:</span>
          <strong class="ml-1">{{ liq.consecutivo_inicial_costos ?? '—' }}</strong></span
        >
        <span
          ><span class="text-muted-foreground">Tasa cambio:</span>
          <strong class="ml-1">{{ liq.tasa_cambio ?? '—' }}</strong></span
        >
        <span v-if="liq.observaciones_resultados" class="text-muted-foreground italic">
          {{ liq.observaciones_resultados }}</span
        >
        <Button variant="ghost" size="sm" class="ml-auto" @click="abrirEditResumen">
          <PencilIcon class="size-3.5" />
          Editar resumen
        </Button>
      </div>
    </template>

    <!-- ─── Dialog: Estado ───────────────────────────────────────────────── -->
    <Dialog v-model:open="dialogEstado">
      <DialogContent class="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Actualizar estado</DialogTitle>
        </DialogHeader>
        <Select v-model="nuevoEstado">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="e in ESTADOS_LIQUIDACION" :key="e" :value="e">{{ e }}</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" @click="dialogEstado = false">Cancelar</Button>
          <Button :disabled="guardando" @click="guardarEstado">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ─── Dialog: Resumen financiero ──────────────────────────────────── -->
    <Dialog v-model:open="dialogResumen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar resumen financiero</DialogTitle>
        </DialogHeader>
        <div class="grid grid-cols-2 gap-3 py-2">
          <Field>
            <FieldLabel>Tasa de cambio (USD/COP)</FieldLabel>
            <NumberField
              v-model="resumenForm.tasa_cambio"
              :format-options="{ maximumFractionDigits: 4 }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </Field>
          <Field>
            <FieldLabel>Comprobante contable</FieldLabel>
            <Input v-model="resumenForm.comprobante_contable_ref" />
          </Field>
          <Field>
            <FieldLabel>Consecutivo inicial ingresos</FieldLabel>
            <NumberField
              v-model="resumenForm.consecutivo_inicial_ingresos"
              :format-options="{ maximumFractionDigits: 0, useGrouping: false }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </Field>
          <Field>
            <FieldLabel>Consecutivo inicial costos</FieldLabel>
            <NumberField
              v-model="resumenForm.consecutivo_inicial_costos"
              :format-options="{ maximumFractionDigits: 0, useGrouping: false }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </Field>
          <Field>
            <FieldLabel>Fecha inicio proceso</FieldLabel>
            <DatePicker v-model="resumenForm.fecha_inicio_proceso" clearable />
          </Field>
          <Field>
            <FieldLabel>Fecha firma</FieldLabel>
            <DatePicker v-model="resumenForm.fecha_firma" clearable />
          </Field>
          <Field class="col-span-2">
            <FieldLabel>URL estado de resultados</FieldLabel>
            <Input v-model="resumenForm.estado_resultados_url" placeholder="https://..." />
          </Field>
          <Field class="col-span-2">
            <FieldLabel>Observaciones</FieldLabel>
            <Textarea v-model="resumenForm.observaciones_resultados" rows="2" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogResumen = false">Cancelar</Button>
          <Button :disabled="guardando" @click="guardarResumen">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
