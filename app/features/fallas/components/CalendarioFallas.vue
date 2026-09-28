<script setup lang="ts">
/**
 * Calendario mensual de fallas con `fecha_programada` (tab "Calendario" de
 * `MonitoreoView.vue`). Las EJECUTADAS (estado final) se homogenizan al color
 * primario de la plataforma y las PROGRAMADAS (pendientes) a gris — mientras
 * la falla sigue activa usa el color real de su estado, el mismo que el resto
 * de la plataforma (`colorEstado`/`colorPrioridad` en `utils/colores.ts`: no
 * se duplica ese mapa acá).
 */
import type { CatalogoItemFalla, Falla } from '~/features/fallas/types'
import {
  AlignLeftIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ClockIcon,
  FlagIcon,
  LoaderCircleIcon,
  PencilIcon,
  SearchIcon,
  SquareCheckIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { formatoLimiteSla } from '~/features/fallas/utils/formatoSla'
import { rangoDelMes } from '~/features/fallas/utils/rangoMes'
import { FallasService } from '~/features/fallas/services/fallas'
import type { ProyectoConDetalle } from '~/features/proyectos/types'

interface CeldaCalendario {
  key: string
  dia: number
  esDelMes: boolean
  esHoy: boolean
  eventos: Falla[]
  label: string
}

const fallasService = new FallasService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps<{
  // Incrementado por el padre cada vez que se guarda una falla → recarga automática
  refreshKey?: number
}>()
const emit = defineEmits<{
  editar: [falla: Falla]
  'ver-falla': [falla: Falla]
}>()

// ── Estado ───────────────────────────────────────────────────────────────────
const loading = ref(false)
const fallas = ref<Falla[]>([])
const proyectos = ref<ProyectoConDetalle[]>([])
const estados = ref<CatalogoItemFalla[]>([])
const detalle = ref<Falla | null>(null)
const diaModal = ref<{ label: string; eventos: Falla[] } | null>(null)

const hoy = new Date()
const mesActual = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

const filtroProyecto = ref<string | null>(null)
const filtroEstado = ref<string | null>(null)

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── Colores ───────────────────────────────────────────────────────────────────
function esFinal(falla: Falla | null | undefined): boolean {
  return falla?.estado?.es_estado_final === true
}

/** Color del punto/pastilla de un evento: homogeneiza ejecutadas/pendientes, real en el resto. */
function colorEvento(falla: Falla): string {
  if (esFinal(falla)) return 'var(--primary)'
  if (falla.estado?.codigo === 'programado') return 'var(--muted-foreground)'
  return colorEstado(falla.estado?.codigo)
}

// ── Computed ─────────────────────────────────────────────────────────────────
const mesLabel = computed(() =>
  mesActual.value
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase()),
)

const hayFiltros = computed(() => !!(filtroProyecto.value || filtroEstado.value))

const estadosConCodigo = computed(() =>
  estados.value.filter((e): e is CatalogoItemFalla & { codigo: string } => !!e.codigo),
)

const eventosFiltrados = computed(() => {
  let list = fallas.value
  if (filtroProyecto.value) {
    const pid = Number(filtroProyecto.value)
    list = list.filter((f) => f.proyecto_id === pid)
  }
  if (filtroEstado.value) list = list.filter((f) => f.estado?.codigo === filtroEstado.value)
  return list
})

const eventosMes = computed(() => {
  const año = mesActual.value.getFullYear()
  const mes = mesActual.value.getMonth()
  return eventosFiltrados.value.filter((f) => {
    if (!f.fecha_programada) return false
    const d = new Date(`${f.fecha_programada}T00:00:00`)
    return d.getFullYear() === año && d.getMonth() === mes
  })
})

// KPIs del mes visible
const kpiMes = computed(() => ({
  pendientes: eventosMes.value.filter((f) => !esFinal(f)).length,
  ejecutadas: eventosMes.value.filter((f) => esFinal(f)).length,
  total: eventosMes.value.length,
}))

const celdas = computed<CeldaCalendario[]>(() => {
  const año = mesActual.value.getFullYear()
  const mes = mesActual.value.getMonth()
  const primer = new Date(año, mes, 1)
  const offsetLun = (primer.getDay() + 6) % 7
  const ultimoDia = new Date(año, mes + 1, 0).getDate()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const cells: CeldaCalendario[] = []
  for (let i = offsetLun - 1; i >= 0; i--) {
    const d = new Date(año, mes, -i)
    cells.push({
      key: `prev-${i}`,
      dia: d.getDate(),
      esDelMes: false,
      esHoy: false,
      eventos: [],
      label: '',
    })
  }
  for (let d = 1; d <= ultimoDia; d++) {
    const dStr = `${año}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const eventos = eventosMes.value.filter((f) => f.fecha_programada === dStr)
    cells.push({
      key: dStr,
      dia: d,
      esDelMes: true,
      esHoy: dStr === hoyStr,
      eventos,
      label: new Date(`${dStr}T00:00:00`).toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    })
  }
  const resto = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= resto; i++) {
    cells.push({ key: `next-${i}`, dia: i, esDelMes: false, esHoy: false, eventos: [], label: '' })
  }
  return cells
})

// ── Navegación ────────────────────────────────────────────────────────────────
function mesAnterior() {
  const m = mesActual.value
  mesActual.value = new Date(m.getFullYear(), m.getMonth() - 1, 1)
}
function mesSiguiente() {
  const m = mesActual.value
  mesActual.value = new Date(m.getFullYear(), m.getMonth() + 1, 1)
}
function irAHoy() {
  mesActual.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
}
function limpiarFiltros() {
  filtroProyecto.value = null
  filtroEstado.value = null
}

// ── Acciones ──────────────────────────────────────────────────────────────────
function abrirDetalle(falla: Falla) {
  detalle.value = falla
}
function abrirDetalleDesdeDia(falla: Falla) {
  abrirDetalle(falla)
  diaModal.value = null
}
function cerrarDetalle() {
  detalle.value = null
}
function cerrarDiaModal() {
  diaModal.value = null
}
function abrirListaDia(cell: CeldaCalendario) {
  diaModal.value = { label: cell.label, eventos: cell.eventos }
}
function irAFalla(falla: Falla) {
  emit('ver-falla', falla)
  detalle.value = null
}
function emitEditar(falla: Falla) {
  emit('editar', falla)
  detalle.value = null
}

// ── Carga de datos ────────────────────────────────────────────────────────────

/** El rango que el calendario realmente pinta -- ver rangoMes.ts. */
const rangoVisible = computed(() => rangoDelMes(mesActual.value))

/**
 * Las fallas del mes visible.
 *
 * Antes pedía `size: 5000` sin rango: el historial COMPLETO de fallas
 * programadas, para pintar 30 días. Dos problemas. El servidor recorta toda
 * respuesta a 100 filas (`api/pagination.py`), así que el calendario mostraba
 * las primeras 100 fallas de la historia y los meses recientes salían vacíos
 * sin que nada lo dijera. Y aunque llegaran todas, traer miles de filas para
 * mostrar un mes es trabajo tirado: `eventosMes` descartaba el resto en el
 * navegador.
 *
 * El endpoint ya filtra por rango (`fecha_programada__gte/lte` en
 * `apps/monitoreo/services/fallas/consultas.py`), así que se le pide el mes y
 * ya. `size: 200` es holgado para un mes; si alguno se pasara, `BaseService`
 * completa las páginas que falten.
 *
 * `silencioso`: al navegar de mes NO se toca `loading`. La grilla vive en el
 * `v-else` de ese flag, así que ponerlo en true la desmonta y la vuelve a
 * montar -- un parpadeo en cada clic de flecha. Es la misma forma del bug que
 * tenía "Validar" en el Historial del Reporte de energía.
 */
async function cargarFallas({ silencioso = false }: { silencioso?: boolean } = {}) {
  if (!silencioso) loading.value = true
  try {
    const { desde, hasta } = rangoVisible.value
    const res = await fallasService.listar({
      size: 200,
      con_fecha_programada: true,
      fecha_programada_desde: desde,
      fecha_programada_hasta: hasta,
    })
    fallas.value = res.items ?? []
  } finally {
    if (!silencioso) loading.value = false
  }
}

/** Proyectos y catálogos alimentan los filtros y no dependen del mes: se piden
 *  una sola vez, no en cada navegación. */
async function cargarFijos() {
  const [listaProyectos, catalogos] = await Promise.all([
    catalogoProyectos.cargar(),
    fallasService.obtenerCatalogos(),
  ])
  proyectos.value = listaProyectos
  estados.value = catalogos.estados ?? []
}

async function cargar() {
  loading.value = true
  try {
    await Promise.all([cargarFallas({ silencioso: true }), cargarFijos()])
  } finally {
    loading.value = false
  }
}

// Cambiar de mes trae las fallas de ese mes -- ya no están todas en memoria.
//
// Se observa el rango COMO TEXTO y no el computed: `rangoVisible` devuelve un
// objeto nuevo cada vez que se recalcula, y `watch` compara por referencia, así
// que "ir a hoy" estando ya en el mes actual dispararía una recarga que no hace
// falta. Dos cadenas iguales son iguales.
watch(
  () => `${rangoVisible.value.desde}|${rangoVisible.value.hasta}`,
  () => cargarFallas({ silencioso: true }),
)

// Recarga automática cuando el padre guarda una falla
watch(
  () => props.refreshKey,
  (newVal, oldVal) => {
    if (newVal !== oldVal) cargarFallas({ silencioso: true })
  },
)

onMounted(cargar)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 p-5">
    <!-- ── Filtros + navegación ─────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-3">
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" @click="mesAnterior">
          <ChevronLeftIcon class="size-4" />
        </Button>
        <span class="min-w-40 text-center text-sm font-extrabold text-foreground">{{
          mesLabel
        }}</span>
        <Button variant="outline" size="icon-sm" @click="mesSiguiente">
          <ChevronRightIcon class="size-4" />
        </Button>
        <Button variant="outline" size="sm" @click="irAHoy">Hoy</Button>
      </div>

      <div class="flex flex-1 flex-wrap items-center gap-2">
        <Select v-model="filtroProyecto">
          <SelectTrigger size="sm" class="w-44">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in proyectos" :key="p.id" :value="String(p.id)">{{
              p.nombre_comercial
            }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filtroEstado">
          <SelectTrigger size="sm" class="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="e in estadosConCodigo" :key="e.codigo" :value="e.codigo">{{
              e.etiqueta
            }}</SelectItem>
          </SelectContent>
        </Select>
        <Button v-if="hayFiltros" variant="ghost" size="sm" @click="limpiarFiltros">
          <XIcon class="size-4" /> Limpiar
        </Button>
      </div>

      <div class="ml-auto flex gap-4">
        <span class="flex flex-col items-center">
          <span class="text-lg font-extrabold text-muted-foreground">{{ kpiMes.pendientes }}</span>
          <span class="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
            >pendientes</span
          >
        </span>
        <span class="flex flex-col items-center">
          <span class="text-lg font-extrabold text-primary">{{ kpiMes.ejecutadas }}</span>
          <span class="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
            >ejecutadas</span
          >
        </span>
        <span class="flex flex-col items-center">
          <span class="text-lg font-extrabold text-foreground">{{ kpiMes.total }}</span>
          <span class="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
            >este mes</span
          >
        </span>
      </div>
    </div>

    <!-- ── Leyenda ─────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-2">
      <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span class="size-2.5 shrink-0 rounded-full" style="background: var(--muted-foreground)" />
        Programada (pendiente)
      </span>
      <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span class="size-2.5 shrink-0 rounded-full bg-primary" />
        Ejecutada / Cerrada
      </span>
      <span
        v-for="codigo in ['abierta', 'en_gestion', 'en_espera']"
        :key="codigo"
        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: colorEstado(codigo) }" />
        {{ estados.find((e) => e.codigo === codigo)?.etiqueta ?? codigo }}
      </span>
    </div>

    <!-- ── Loading ─────────────────────────────────────────────────────── -->
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center gap-3 py-16 text-sm text-muted-foreground"
    >
      <LoaderCircleIcon class="size-6 animate-spin text-primary" />
      <span>Cargando fallas...</span>
    </div>

    <!-- ── Grilla del calendario ────────────────────────────────────────── -->
    <div v-else class="flex flex-col overflow-hidden rounded-xl border bg-card">
      <!-- Cabecera días -->
      <div class="grid grid-cols-7 border-b bg-muted/40">
        <div
          v-for="d in DIAS"
          :key="d"
          class="py-2 text-center text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase"
        >
          {{ d }}
        </div>
      </div>

      <!-- Celda de días -->
      <div class="grid grid-cols-7">
        <div
          v-for="cell in celdas"
          :key="cell.key"
          class="flex min-h-28 flex-col gap-0.5 border-r border-b p-1.5 last:border-r-0"
          :class="[!cell.esDelMes && 'bg-muted/20', cell.esHoy && 'bg-primary/5']"
        >
          <span
            class="mb-0.5 self-start text-xs font-bold"
            :class="
              cell.esHoy
                ? 'flex size-5.5 items-center justify-center rounded-full bg-primary text-primary-foreground'
                : cell.esDelMes
                  ? 'text-foreground'
                  : 'text-muted-foreground/50'
            "
          >
            {{ cell.dia }}
          </span>

          <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
            <button
              v-for="ev in cell.eventos.slice(0, 3)"
              :key="ev.id"
              type="button"
              class="flex items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-left transition-opacity hover:opacity-80"
              :class="esFinal(ev) && 'opacity-90'"
              :style="{
                background: `color-mix(in oklab, ${colorEvento(ev)} 12%, transparent)`,
                borderLeft: `3px solid ${colorEvento(ev)}`,
              }"
              :title="`[${ev.estado?.etiqueta}] ${ev.proyecto?.nombre_comercial} — ${ev.descripcion}`"
              @click="abrirDetalle(ev)"
            >
              <CircleCheckIcon v-if="esFinal(ev)" class="size-3 shrink-0 text-primary" />
              <ClockIcon v-else class="size-3 shrink-0 text-muted-foreground" />
              <span
                class="truncate text-[10px] font-semibold"
                :class="esFinal(ev) ? 'text-muted-foreground line-through' : 'text-foreground'"
                >{{ ev.proyecto?.nombre_comercial }}</span
              >
            </button>
            <button
              v-if="cell.eventos.length > 3"
              type="button"
              class="rounded px-1 text-left text-[10px] font-bold text-primary hover:bg-primary/10"
              @click="abrirListaDia(cell)"
            >
              +{{ cell.eventos.length - 3 }} más
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Diálogo detalle falla ──────────────────────────────────────────── -->
    <Dialog :open="!!detalle" @update:open="(v: boolean) => !v && cerrarDetalle()">
      <DialogContent v-if="detalle" class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="font-mono">{{ detalle.codigo_interno }}</span>
            <GBadge :color="colorEstado(detalle.estado?.codigo)">{{
              detalle.estado?.etiqueta
            }}</GBadge>
          </DialogTitle>
        </DialogHeader>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <ZapIcon class="size-3.5" /> Proyecto
            </span>
            <span class="text-sm font-semibold text-foreground">{{
              detalle.proyecto?.nombre_comercial
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <CalendarIcon class="size-3.5" /> Fecha programada
            </span>
            <span class="text-sm font-extrabold text-primary">{{
              detalle.fecha_programada ?? '—'
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <FlagIcon class="size-3.5" /> Prioridad
            </span>
            <span class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span
                class="size-2 rounded-full"
                :style="{ background: colorPrioridad(detalle.prioridad?.codigo) }"
              />
              {{ detalle.prioridad?.etiqueta }}
            </span>
          </div>
          <div class="col-span-2 flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <AlignLeftIcon class="size-3.5" /> Descripción
            </span>
            <p class="rounded-md bg-muted/50 p-2 text-sm text-foreground">
              {{ detalle.descripcion }}
            </p>
          </div>
          <div v-if="detalle.causa_raiz" class="col-span-2 flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <SearchIcon class="size-3.5" /> Causa raíz
            </span>
            <p class="rounded-md bg-muted/50 p-2 text-sm text-foreground">
              {{ detalle.causa_raiz }}
            </p>
          </div>
          <div v-if="detalle.acciones_correctivas" class="col-span-2 flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <SquareCheckIcon class="size-3.5" /> Acciones correctivas
            </span>
            <p class="rounded-md bg-muted/50 p-2 text-sm text-foreground">
              {{ detalle.acciones_correctivas }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <CalendarClockIcon class="size-3.5" /> Identificado
            </span>
            <span class="text-sm font-semibold text-foreground">{{
              detalle.fecha_identificacion
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="flex items-center gap-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
            >
              <ClockIcon class="size-3.5" /> SLA
            </span>
            <span class="text-sm font-semibold text-foreground">{{
              formatoLimiteSla(detalle.sla_limite_horas_efectivo)
            }}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="irAFalla(detalle)">
            <ArrowRightIcon class="size-4" /> Ver en Gestión de Fallas
          </Button>
          <Button @click="emitEditar(detalle)"> <PencilIcon class="size-4" /> Editar </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Diálogo lista día ──────────────────────────────────────────────── -->
    <Dialog :open="!!diaModal" @update:open="(v: boolean) => !v && cerrarDiaModal()">
      <DialogContent v-if="diaModal" class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fallas — {{ diaModal.label }}</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col">
          <button
            v-for="ev in diaModal.eventos"
            :key="ev.id"
            type="button"
            class="flex items-center gap-2.5 rounded-md px-1.5 py-2 text-left hover:bg-muted"
            @click="abrirDetalleDesdeDia(ev)"
          >
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: colorEvento(ev) }" />
            <div>
              <div class="font-mono text-xs font-bold text-foreground">{{ ev.codigo_interno }}</div>
              <div class="text-xs text-muted-foreground">{{ ev.proyecto?.nombre_comercial }}</div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
