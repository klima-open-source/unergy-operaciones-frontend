<template>
  <div class="space-y-4">
    <!-- Período + navegación -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        :model-value="periodo"
        aria-label="Período"
        @update:model-value="(v) => cambiarPeriodo(v)"
      >
        <ToggleGroupItem v-for="p in PERIODOS" :key="p.valor" :value="p.valor">
          {{ p.etiqueta }}
        </ToggleGroupItem>
      </ToggleGroup>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Período anterior" @click="offset -= 1">
          <ChevronLeftIcon />
        </Button>
        <p class="min-w-56 text-center text-sm font-semibold">{{ etiqueta }}</p>
        <Button
          variant="outline"
          size="icon"
          aria-label="Período siguiente"
          :disabled="offset >= 0"
          @click="offset += 1"
        >
          <ChevronRightIcon />
        </Button>
        <Button v-if="offset !== 0" variant="link" size="sm" @click="offset = 0">
          Ir al más reciente
        </Button>
      </div>
    </div>

    <!-- Leyenda -->
    <div class="flex flex-wrap items-center gap-4 border-b pb-3 text-xs text-muted-foreground">
      <span v-for="l in LEYENDA" :key="l.etiqueta" class="flex items-center gap-1.5">
        <span class="inline-block size-2 rounded-full bg-(--c)" :style="{ '--c': l.color }" />
        {{ l.etiqueta }}
      </span>
    </div>

    <div v-if="cargando" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="size-8 animate-spin text-primary" />
    </div>

    <template v-else-if="resumenVentana">
      <!-- KPIs -->
      <div class="flex flex-wrap gap-4">
        <component
          :is="k.filtro ? 'button' : 'div'"
          v-for="k in kpis"
          :key="k.etiqueta"
          :type="k.filtro ? 'button' : undefined"
          :aria-pressed="k.filtro ? filtroKpi === k.filtro : undefined"
          class="flex min-w-40 flex-1 flex-col gap-1 rounded-xl border bg-card px-5 py-4 text-left shadow-sm"
          :class="[
            k.filtro ? 'cursor-pointer' : '',
            k.filtro && filtroKpi === k.filtro ? 'border-2 border-(--c)' : '',
          ]"
          :style="{ '--c': k.color }"
          @click="k.filtro && alternarFiltroKpi(k.filtro)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-muted-foreground">{{ k.etiqueta }}</span>
            <span v-if="k.filtro" class="text-xs font-semibold text-(--c)">
              {{ filtroKpi === k.filtro ? 'Filtrando ✕' : 'Filtrar' }}
            </span>
          </span>
          <span class="text-2xl font-semibold text-(--c) tabular-nums">{{ k.valor }}</span>
          <span v-if="k.sub" class="text-xs text-muted-foreground">{{ k.sub }}</span>
        </component>
      </div>

      <!-- Filtros -->
      <div class="flex flex-wrap items-center gap-3">
        <InputGroup class="max-w-sm">
          <InputGroupAddon>
            <SearchIcon class="size-4" />
          </InputGroupAddon>
          <InputGroupInput v-model="busqueda" placeholder="Buscar por frontera o proyecto…" />
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          :model-value="filtroTipo"
          aria-label="Tipo"
          @update:model-value="(v) => v && (filtroTipo = v as FiltroTipo)"
        >
          <ToggleGroupItem v-for="t in FILTROS_TIPO" :key="t.valor" :value="t.valor">
            {{ t.etiqueta }}
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          :model-value="filtroAutomatico"
          aria-label="Automático"
          @update:model-value="(v) => v && (filtroAutomatico = v as FiltroAutomatico)"
        >
          <ToggleGroupItem v-for="a in FILTROS_AUTOMATICO" :key="a.valor" :value="a.valor">
            {{ a.etiqueta }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <!-- Tabla: la peor primero -->
      <GTable>
        <GTableHeader>
          <GTableRow>
            <GTableHead>Frontera</GTableHead>
            <GTableHead>Tipo</GTableHead>
            <GTableHead>Automático</GTableHead>
            <GTableHead>Fuente</GTableHead>
            <GTableHead class="text-right"><span class="sr-only">Acciones</span></GTableHead>
          </GTableRow>
        </GTableHeader>
        <GTableBody>
          <template v-for="f in filasVisibles" :key="f.clave">
            <GTableRow>
              <GTableCell class="py-3">
                <p class="font-semibold">{{ f.fila.nombre_proyecto }}</p>
                <p v-if="f.fila.codigo_frontera" class="text-xs text-muted-foreground">
                  {{ f.fila.codigo_frontera }}
                </p>
                <p
                  v-if="periodo !== Periodo.DIA && f.fila.fechas_excluidas.length"
                  class="mt-0.5 text-xs text-warning"
                >
                  Excluido: {{ formatearExcluidos(f.fila.fechas_excluidas) }}
                </p>
              </GTableCell>
              <GTableCell class="text-muted-foreground">{{
                ETIQUETA_TIPO[f.fila.tipo]
              }}</GTableCell>
              <GTableCell>
                <GTooltip v-if="f.conTasa">
                  <GTooltipTrigger as-child>
                    <span class="flex items-center gap-2">
                      <span class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          class="block h-full w-(--w) bg-(--c)"
                          :style="{ '--w': `${f.fila.tasa}%`, '--c': colorTasa(f.fila.tasa) }"
                        />
                      </span>
                      <span
                        class="text-sm font-semibold text-(--c) tabular-nums"
                        :style="{ '--c': colorTasa(f.fila.tasa) }"
                        >{{ Math.round(f.fila.tasa) }}%</span
                      >
                    </span>
                  </GTooltipTrigger>
                  <GTooltipContent>
                    {{ f.fila.dias_automaticos }} de
                    {{ f.fila.dias_automaticos + f.fila.dias_no_automaticos }} días automáticos
                  </GTooltipContent>
                </GTooltip>
                <GBadge v-else shape="square" :color="COLOR_CATEGORIA[f.categoria]">
                  {{ ETIQUETA_CATEGORIA_FILA[f.categoria] }}
                </GBadge>
              </GTableCell>
              <GTableCell>
                <span v-if="f.fila.fuente_dominante" class="flex items-center gap-1.5">
                  <GBadge shape="square" :color="COLOR_FUENTE[f.fila.fuente_dominante]">
                    {{ f.fila.fuente_dominante_etiqueta }}
                  </GBadge>
                  <GTooltip v-if="f.fila.desglose_fuente.length > 1">
                    <GTooltipTrigger as-child>
                      <span class="cursor-default text-xs text-muted-foreground">
                        +{{ f.fila.desglose_fuente.length - 1 }} más
                      </span>
                    </GTooltipTrigger>
                    <GTooltipContent>
                      {{
                        f.fila.desglose_fuente
                          .map((d) => `${d.etiqueta}: ${d.dias} días`)
                          .join(' · ')
                      }}
                    </GTooltipContent>
                  </GTooltip>
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </GTableCell>
              <GTableCell class="text-right">
                <Button
                  v-if="periodo === Periodo.DIA"
                  variant="ghost"
                  size="sm"
                  @click="
                    emit('abrir', { fronteraId: f.fila.frontera_id, fecha: ventanaActual.hasta })
                  "
                >
                  Abrir <ChevronRightIcon />
                </Button>
                <Button
                  v-else
                  variant="ghost"
                  size="sm"
                  :aria-expanded="expandido === f.clave"
                  @click="expandido = expandido === f.clave ? null : f.clave"
                >
                  {{ expandido === f.clave ? 'Ocultar' : 'Ver días' }}
                  <ChevronDownIcon v-if="expandido === f.clave" />
                  <ChevronRightIcon v-else />
                </Button>
              </GTableCell>
            </GTableRow>

            <GTableRow v-if="expandido === f.clave" class="bg-muted/30 hover:bg-muted/30">
              <GTableCell colspan="5" class="px-4 pt-1 pb-4">
                <p class="mb-2 text-xs text-muted-foreground">
                  {{ periodo === Periodo.MES ? 'Días del mes' : 'Días de la semana' }} — clic en un
                  día para abrir esa fecha
                </p>
                <div class="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-1.5">
                  <button
                    v-for="d in f.dias"
                    :key="d.fecha"
                    type="button"
                    class="flex flex-col gap-0.5 rounded-lg border bg-card px-2.5 py-1.5 text-left"
                    @click="irADia(d.fecha)"
                  >
                    <span class="flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        class="inline-block size-2 rounded-full bg-(--c)"
                        :style="{ '--c': d.color }"
                      />
                      {{ fechaCorta(d.fecha) }}
                    </span>
                    <span class="text-xs text-muted-foreground">{{ d.texto }}</span>
                  </button>
                </div>
              </GTableCell>
            </GTableRow>
          </template>

          <GTableRow v-if="!filasVisibles.length">
            <GTableCell colspan="5" class="py-10 text-center text-muted-foreground">
              {{
                filas.length
                  ? 'Ninguna frontera coincide con los filtros.'
                  : 'No hay reporte en este período.'
              }}
            </GTableCell>
          </GTableRow>
        </GTableBody>
      </GTable>

      <!-- Distribución de fuente: resumen de cierre, después de la tabla -->
      <div v-if="franja.length" class="flex flex-col gap-2.5 rounded-xl border bg-card px-5 py-4">
        <p class="text-xs font-semibold text-muted-foreground">
          Distribución de fuente · {{ etiqueta
          }}{{ filtroTipo === FiltroTipo.TODOS ? '' : ` · ${etiquetaFiltroTipo}` }}
        </p>
        <div class="flex h-2.5 overflow-hidden rounded-full">
          <GTooltip v-for="g in franja" :key="g.clave">
            <GTooltipTrigger as-child>
              <span
                class="block h-full w-(--w) bg-(--c)"
                :style="{ '--w': `${g.pct}%`, '--c': g.color }"
              />
            </GTooltipTrigger>
            <GTooltipContent>
              {{ g.etiqueta }}: {{ g.dias }} días-frontera ({{ g.pct }}%)
            </GTooltipContent>
          </GTooltip>
        </div>
        <div class="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span v-for="g in franja" :key="g.clave" class="flex items-center gap-1.5">
            <span class="inline-block size-2 rounded-full bg-(--c)" :style="{ '--c': g.color }" />
            {{ g.etiqueta }} · {{ g.dias }} ({{ g.pct }}%)
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { ResumenVentanaReporteEnergia } from '~/features/fronteras/types'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import {
  CategoriaDia,
  COLOR_CATEGORIA,
  COLOR_FUENTE,
  ETIQUETA_CATEGORIA,
  ETIQUETA_TIPO,
  FiltroAutomatico,
  FiltroKpi,
  FiltroTipo,
  Periodo,
  aplicarFiltros,
  colorTasa,
  diasEntre,
  distribucion,
  etiquetaVentana,
  fechaCorta,
  filaVista,
  formatearExcluidos,
  ordenarDia,
  ventana,
} from '~/features/fronteras/resumenVentana'
import { ReporteEnergiaService } from '~/features/fronteras/services/reporte-energia'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  SearchIcon,
} from '@lucide/vue'

const props = defineProps<{
  /** El día más reciente con reporte (ayer): el período 0 es el que lo contiene. */
  referencia: string
}>()

const emit = defineEmits<{
  /** Día: abrir esa frontera en Historial, en esa fecha. */
  abrir: [destino: { fronteraId: number; fecha: string }]
}>()

const PERIODOS = [
  { valor: Periodo.DIA, etiqueta: 'Día' },
  { valor: Periodo.SEMANA, etiqueta: 'Semana' },
  { valor: Periodo.MES, etiqueta: 'Mes' },
]
const FILTROS_TIPO = [
  { valor: FiltroTipo.TODOS, etiqueta: 'Todos' },
  { valor: FiltroTipo.GENERACION, etiqueta: 'Generación' },
  { valor: FiltroTipo.CONSUMO, etiqueta: 'Consumo' },
]
const FILTROS_AUTOMATICO = [
  { valor: FiltroAutomatico.TODOS, etiqueta: 'Todos' },
  { valor: FiltroAutomatico.AUTOMATICO, etiqueta: 'Automático' },
  { valor: FiltroAutomatico.NO_AUTOMATICO, etiqueta: 'No automático' },
]
const LEYENDA = [
  { etiqueta: 'Automático (CGM)', color: COLOR_CATEGORIA[CategoriaDia.AUTOMATICO] },
  { etiqueta: 'No automático', color: COLOR_CATEGORIA[CategoriaDia.NO_AUTOMATICO] },
  { etiqueta: 'Excluido / sin corrida', color: COLOR_CATEGORIA[CategoriaDia.EXCLUIDO] },
]
// En la tabla la etiqueta de la fila es corta: "No", no "No automático".
const ETIQUETA_CATEGORIA_FILA: Record<CategoriaDia, string> = {
  ...ETIQUETA_CATEGORIA,
  [CategoriaDia.NO_AUTOMATICO]: 'No',
}

const reporteEnergiaService = new ReporteEnergiaService()

const periodo = ref(Periodo.DIA)
const offset = ref(0)
const expandido = ref<string | null>(null)
const busqueda = ref('')
const filtroTipo = ref(FiltroTipo.TODOS)
const filtroAutomatico = ref(FiltroAutomatico.TODOS)
const filtroKpi = ref<FiltroKpi | null>(null)

const resumenVentana = ref<ResumenVentanaReporteEnergia | null>(null)
const cargando = ref(false)

const ventanaActual = computed(() => ventana(periodo.value, offset.value, props.referencia))
const etiqueta = computed(() => etiquetaVentana(periodo.value, ventanaActual.value))
const etiquetaFiltroTipo = computed(
  () => FILTROS_TIPO.find((t) => t.valor === filtroTipo.value)?.etiqueta ?? '',
)

function cambiarPeriodo(valor: AcceptableValue | AcceptableValue[]) {
  // Un ToggleGroup `single` deja deseleccionar: sin esto, un segundo clic sobre
  // el período activo dejaría la vista sin ninguno.
  if (!Object.values(Periodo).includes(valor as Periodo)) return
  periodo.value = valor as Periodo
  offset.value = 0
}

/** Clic en un día de la cuadrícula: ese día, en el período Día. */
function irADia(fecha: string) {
  periodo.value = Periodo.DIA
  offset.value = diasEntre(props.referencia, fecha)
}

function alternarFiltroKpi(filtro: FiltroKpi) {
  filtroKpi.value = filtroKpi.value === filtro ? null : filtro
}

// Cada cambio de período dispara una consulta; solo la última puede escribir.
// Sin esto, pasar rápido de mes en mes deja en pantalla la que llegue de
// última, que no siempre es la del mes que se está viendo.
let consulta = 0
async function cargar() {
  const esta = ++consulta
  const { desde, hasta } = ventanaActual.value
  cargando.value = true
  expandido.value = null
  filtroKpi.value = null
  try {
    const respuesta = await reporteEnergiaService.obtenerResumenVentana(desde, hasta)
    if (esta === consulta) resumenVentana.value = respuesta
  } catch (err) {
    if (esta !== consulta) return
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
    resumenVentana.value = null
  } finally {
    if (esta === consulta) cargando.value = false
  }
}
watch(ventanaActual, cargar, { immediate: true })

const filas = computed(() => {
  const vistas = (resumenVentana.value?.filas ?? []).map((f) =>
    filaVista(f, periodo.value, ventanaActual.value.fechas),
  )
  return periodo.value === Periodo.DIA ? ordenarDia(vistas) : vistas
})

const filasVisibles = computed(() =>
  aplicarFiltros(filas.value, {
    busqueda: busqueda.value,
    tipo: filtroTipo.value,
    automatico: filtroAutomatico.value,
    kpi: filtroKpi.value,
  }),
)

const franja = computed(() =>
  distribucion(filas.value, { busqueda: busqueda.value, tipo: filtroTipo.value }),
)

interface Kpi {
  etiqueta: string
  valor: string
  sub: string
  color: string
  filtro: FiltroKpi | null
}

const AZUL = COLOR_CATEGORIA[CategoriaDia.AUTOMATICO]
const NARANJA = COLOR_CATEGORIA[CategoriaDia.NO_AUTOMATICO]
const NEUTRO = 'var(--foreground)'
const SUB_CAMBIO = 'más de 2 días vs. período anterior'

const kpis = computed<Kpi[]>(() => {
  if (periodo.value === Periodo.DIA) {
    const total = filas.value.length
    const automaticas = filas.value.filter((f) => f.categoria === CategoriaDia.AUTOMATICO).length
    const manuales = filas.value.filter((f) => f.categoria === CategoriaDia.NO_AUTOMATICO).length
    return [
      {
        etiqueta: 'Automático',
        valor: `${total ? Math.round((automaticas / total) * 100) : 0}%`,
        sub: `${automaticas} de ${total} fronteras`,
        color: AZUL,
        filtro: null,
      },
      {
        etiqueta: 'Con fuente manual',
        valor: String(manuales),
        sub: `de ${total} fronteras`,
        color: NARANJA,
        filtro: null,
      },
    ]
  }
  const k = resumenVentana.value?.kpis
  if (!k) return []
  return [
    {
      etiqueta: 'Automático en general',
      valor: `${Math.round(k.tasa_general)}%`,
      sub: `${k.dias_automaticos_totales} de ${k.dias_totales} días-frontera automáticos`,
      color: NEUTRO,
      filtro: null,
    },
    {
      etiqueta: 'Reportan siempre automático',
      valor: String(k.siempre_automatico),
      sub: '',
      color: AZUL,
      filtro: FiltroKpi.SIEMPRE,
    },
    {
      etiqueta: 'Nunca reportan automático',
      valor: String(k.nunca_automatico),
      sub: '',
      color: NARANJA,
      filtro: FiltroKpi.NUNCA,
    },
    {
      etiqueta: 'Mejoraron',
      valor: String(k.mejoraron),
      sub: SUB_CAMBIO,
      color: AZUL,
      filtro: null,
    },
    {
      etiqueta: 'Empeoraron',
      valor: String(k.empeoraron),
      sub: SUB_CAMBIO,
      color: NARANJA,
      filtro: null,
    },
  ]
})
</script>
