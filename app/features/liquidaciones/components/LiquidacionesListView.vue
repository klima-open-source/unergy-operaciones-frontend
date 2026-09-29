<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, PlusIcon, SearchIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import { TIPOS_VENTA } from '~/features/liquidaciones/constants'
import type { ProyectoResumenPanel, TipoVentaLiquidacion } from '~/features/liquidaciones/types'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import {
  estadoFlujoPanel,
  fmtCompact,
  formatPeriodo,
} from '~/features/liquidaciones/utils/liquidaciones'
import { proyectoActivoEnMes } from '~/utils/proyectoActivo'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DatePicker`.
import DatePicker from '~/components/blocks/DatePicker.vue'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    /** "YYYY-MM-01" (del contenedor). */
    periodo?: string | null
    tipo?: string
  }>(),
  { embedded: false, periodo: null, tipo: 'preliquidacion' },
)

const router = useRouter()
const route = useRoute()
const liquidacionesService = new LiquidacionesService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

// Filtro por tipo de proyecto vía query ?tipo= (minigranja | autoconsumo | null)
const tipoFilter = computed(() => {
  const t = route.query.tipo
  return t === 'minigranja' || t === 'autoconsumo' ? t : null
})
const TIPO_PROYECTO_LABEL: Record<string, string> = {
  minigranja: 'Minigranjas',
  autoconsumo: 'Autoconsumo',
}
const tipoLabel = computed(() => TIPO_PROYECTO_LABEL[tipoFilter.value ?? ''] || '')

const periodoYYYYMM = computed(() => (props.periodo || '').slice(0, 7))

const loading = ref(false)
const proyectos = ref<ProyectoResumenPanel[]>([])
const expandidos = reactive(new Set<number>())
const q = ref('')
const estadoFiltro = ref<string>('')
const ESTADO_OPCIONES = [
  { label: 'Firmado', value: 'firmado' },
  { label: 'Pendiente', value: 'pendiente' },
]

const proyectosFiltrados = computed(() => {
  const term = q.value.toLowerCase().trim()
  const tf = tipoFilter.value
  const ef = estadoFiltro.value
  return proyectos.value.filter(
    (p) =>
      (!term || (p.proyecto || '').toLowerCase().includes(term)) &&
      (!tf || p.tipo_proyecto === tf) &&
      (!ef || p.estado === ef),
  )
})

function toggleExpand(panelId: number | undefined) {
  if (panelId == null) return
  if (expandidos.has(panelId)) expandidos.delete(panelId)
  else expandidos.add(panelId)
}

async function load() {
  if (!periodoYYYYMM.value) return
  loading.value = true
  try {
    const data = await liquidacionesService.obtenerResumenPanel({
      periodo: periodoYYYYMM.value,
      tipo: props.tipo ?? 'preliquidacion',
    })
    proyectos.value = data.proyectos || []
  } catch {
    proyectos.value = []
  } finally {
    loading.value = false
  }
}

watch([() => props.periodo, () => props.tipo], load)

// ─── Nueva liquidación (detalle operativo) ────────────────────────────────────
const dialogNueva = ref(false)
const creando = ref(false)
const nuevoProyectoId = ref<number | null>(null)
const nuevoPeriodo = ref<string | null>(null)
const nuevoTipoVenta = ref<TipoVentaLiquidacion>('bolsa')
const proyectosOpciones = ref<ProyectoConDetalle[]>([])
const creandoDesde = ref<number | null>(null)

const proyectosOpcionesFiltradas = computed(() => {
  if (!nuevoPeriodo.value) return proyectosOpciones.value
  const d = new Date(nuevoPeriodo.value)
  return proyectosOpciones.value.filter((p) =>
    proyectoActivoEnMes(p, d.getFullYear(), d.getMonth() + 1),
  )
})

async function loadProyectosOpciones() {
  try {
    proyectosOpciones.value = await catalogoProyectos.cargar()
  } catch {
    proyectosOpciones.value = []
  }
}

async function crearLiquidacion() {
  if (!nuevoProyectoId.value || !nuevoPeriodo.value) return
  creando.value = true
  try {
    const data = await liquidacionesService.crear({
      proyecto_id: nuevoProyectoId.value,
      periodo: nuevoPeriodo.value.slice(0, 7) + '-01',
      tipo_venta: nuevoTipoVenta.value,
    })
    dialogNueva.value = false
    toast.success('Creada', { duration: 2000 })
    router.push(`/liquidaciones/${data.id}`)
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message, duration: 3000 })
  } finally {
    creando.value = false
  }
}

// Crear el detalle operativo directamente desde una fila del Panel
async function crearDesdeProyecto(row: ProyectoResumenPanel) {
  if (!props.periodo) return
  creandoDesde.value = row.proyecto_id
  try {
    const data = await liquidacionesService.crear({
      proyecto_id: row.proyecto_id,
      periodo: props.periodo,
      tipo_venta: 'bolsa',
    })
    router.push(`/liquidaciones/${data.id}`)
  } catch (e) {
    // Conflicto = ya existe: recargar para traer el liquidacion_id y navegar
    const err = normalizeError(e)
    const existente = err.code === 'CONFLICT'
    if (existente) {
      toast.info('Ya existe', { description: 'Recargando…', duration: 2500 })
      await load()
    } else {
      toast.error('Error', { description: 'No se pudo crear el detalle', duration: 2500 })
    }
  } finally {
    creandoDesde.value = null
  }
}

onMounted(() => {
  load()
  loadProyectosOpciones()
})
</script>

<template>
  <div class="space-y-4" :class="{ 'p-4 sm:p-5': embedded }">
    <PageHeader v-if="!embedded" title="Liquidaciones">
      <template #actions>
        <Button size="sm" @click="dialogNueva = true">
          <PlusIcon class="size-4" />
          Nueva liquidación
        </Button>
      </template>
    </PageHeader>

    <!-- Barra: filtro por tipo (vía ?tipo=), búsqueda, aviso de espejo, acción -->
    <div class="flex flex-wrap items-center gap-3">
      <span v-if="tipoLabel" class="text-sm font-semibold text-primary">{{ tipoLabel }}</span>
      <NuxtLink
        v-if="tipoLabel"
        to="/liquidaciones?tab=proyectos"
        class="text-xs text-muted-foreground hover:underline"
        >Ver todos</NuxtLink
      >
      <InputGroup class="w-56">
        <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
        <InputGroupInput v-model="q" placeholder="Buscar proyecto…" />
      </InputGroup>
      <Select v-model="estadoFiltro">
        <SelectTrigger class="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Estado: todos</SelectItem>
          <SelectItem v-for="op in ESTADO_OPCIONES" :key="op.value" :value="op.value">{{
            op.label
          }}</SelectItem>
        </SelectContent>
      </Select>
      <span class="ml-auto text-xs text-muted-foreground">
        Espejo del Panel Contable · edición en Panel Contable
      </span>
      <Button size="sm" @click="dialogNueva = true">
        <PlusIcon class="size-4" />
        Nueva liquidación
      </Button>
    </div>

    <Spinner v-if="loading" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <div v-else class="overflow-hidden rounded-xl border bg-card">
      <div class="flex items-center gap-2 border-b px-4 py-2.5">
        <h3 class="text-sm font-bold text-foreground">Proyectos · {{ formatPeriodo(periodo) }}</h3>
        <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{{
          proyectosFiltrados.length
        }}</span>
      </div>

      <div v-if="!proyectosFiltrados.length" class="py-8 text-center text-sm text-muted-foreground">
        Sin paneles para este período/tipo. Cárgalos en Panel Contable.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <th class="w-12 px-3 py-2" />
              <th class="px-3 py-2 font-medium">Proyecto</th>
              <th class="px-3 py-2 font-medium">Estado</th>
              <th v-if="tipo === 'oficial'" class="px-3 py-2 text-right font-medium">
                Consec. Ing.
              </th>
              <th v-if="tipo === 'oficial'" class="px-3 py-2 text-right font-medium">
                Consec. Cos.
              </th>
              <th class="px-3 py-2 text-right font-medium">Ingresos</th>
              <th class="px-3 py-2 text-right font-medium">Costos</th>
              <th class="px-3 py-2 text-right font-medium">Valor a pagar</th>
              <th class="w-14 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <template v-for="p in proyectosFiltrados" :key="p.panel_id">
              <tr class="border-b hover:bg-muted/20">
                <td class="px-3 py-2">
                  <button
                    class="text-muted-foreground hover:text-foreground"
                    @click="toggleExpand(p.panel_id)"
                  >
                    <ChevronDownIcon v-if="expandidos.has(p.panel_id ?? -1)" class="size-3.5" />
                    <ChevronRightIcon v-else class="size-3.5" />
                  </button>
                </td>
                <td class="px-3 py-2 font-medium text-foreground">{{ p.proyecto }}</td>
                <td class="px-3 py-2">
                  <GBadge :color="estadoFlujoPanel(p, tipo).sev" class="text-xs">{{
                    estadoFlujoPanel(p, tipo).label
                  }}</GBadge>
                </td>
                <td v-if="tipo === 'oficial'" class="px-3 py-2 text-right font-mono text-xs">
                  {{ p.consecutivo_ingresos ?? '—' }}
                </td>
                <td v-if="tipo === 'oficial'" class="px-3 py-2 text-right font-mono text-xs">
                  {{ p.consecutivo_costos ?? '—' }}
                </td>
                <td class="px-3 py-2 text-right font-mono text-xs">
                  {{ fmtCompact(p.ingresos_cop) }}
                </td>
                <td class="px-3 py-2 text-right font-mono text-xs text-destructive">
                  {{ fmtCompact(p.costos_cop) }}
                </td>
                <td class="px-3 py-2 text-right font-mono text-xs font-semibold text-primary">
                  {{ fmtCompact(p.valor_a_pagar_total) }}
                </td>
                <td class="px-3 py-2 text-right">
                  <Button
                    v-if="p.liquidacion_id"
                    variant="ghost"
                    size="icon"
                    class="size-7"
                    title="Ver detalle operativo"
                    @click="router.push(`/liquidaciones/${p.liquidacion_id}`)"
                  >
                    <EyeIcon class="size-3.5" />
                  </Button>
                  <Button
                    v-else
                    variant="ghost"
                    size="icon"
                    class="size-7"
                    title="Crear detalle operativo"
                    :disabled="creandoDesde === p.proyecto_id"
                    @click="crearDesdeProyecto(p)"
                  >
                    <PlusIcon class="size-3.5" />
                  </Button>
                </td>
              </tr>
              <tr v-if="expandidos.has(p.panel_id ?? -1)" class="border-b bg-muted/10">
                <td :colspan="tipo === 'oficial' ? 9 : 7" class="px-4 py-3">
                  <p class="mb-2 text-xs font-semibold text-muted-foreground">Por inversionista</p>
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="text-left text-muted-foreground">
                        <th class="pb-1 font-medium">Inversionista</th>
                        <th class="pb-1 font-medium">%</th>
                        <th class="pb-1 text-right font-medium">Valor a pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="inv in p.inversionistas"
                        :key="inv.proyecto_inversionista_id ?? inv.nombre ?? undefined"
                        class="border-t"
                      >
                        <td class="py-1.5 text-foreground">
                          {{ inv.cliente_nombre || inv.nombre || '—' }}
                        </td>
                        <td class="py-1.5 font-mono text-muted-foreground">
                          {{ inv.porcentaje != null ? inv.porcentaje.toFixed(2) + '%' : '—' }}
                        </td>
                        <td class="py-1.5 text-right font-mono font-semibold text-primary">
                          {{ fmtCompact(inv.valor_a_pagar) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p
                    v-if="!p.inversionistas?.length"
                    class="py-2 text-center text-xs text-muted-foreground"
                  >
                    Sin inversionistas en este panel.
                  </p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Dialog nueva liquidación (detalle operativo) -->
    <Dialog v-model:open="dialogNueva">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva liquidación (detalle operativo)</DialogTitle>
          <DialogDescription>
            Crea el registro operativo (mandatos/facturas/XM). Los valores contables viven en el
            Panel Contable.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <Field>
            <FieldLabel>Proyecto</FieldLabel>
            <Select
              :model-value="nuevoProyectoId ? String(nuevoProyectoId) : ''"
              @update:model-value="(v) => (nuevoProyectoId = v ? Number(v) : null)"
            >
              <SelectTrigger class="w-full"
                ><SelectValue placeholder="Seleccionar proyecto"
              /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in proyectosOpcionesFiltradas"
                  :key="p.id"
                  :value="String(p.id)"
                  >{{ p.nombre_comercial }}</SelectItem
                >
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Período</FieldLabel>
            <DatePicker v-model="nuevoPeriodo" />
          </Field>
          <Field>
            <FieldLabel>Tipo venta</FieldLabel>
            <Select v-model="nuevoTipoVenta">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in TIPOS_VENTA" :key="t" :value="t">{{ t }}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogNueva = false">Cancelar</Button>
          <Button :disabled="creando" @click="crearLiquidacion">Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
