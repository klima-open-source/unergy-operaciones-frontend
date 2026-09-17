<template>
  <div class="flex h-full flex-col overflow-hidden">

    <!-- ══ TAB BAR ══ -->
    <GTabs :model-value="tab" @update:model-value="(v) => (tab = v)">
      <GTabsList variant="outline">
        <GTabsTrigger value="live" variant="outline">
          <ZapIcon class="size-4" /> Tiempo Real
        </GTabsTrigger>
        <GTabsTrigger value="hist" variant="outline">
          <ChartLineIcon class="size-4" /> Histórico
        </GTabsTrigger>
      </GTabsList>
    </GTabs>

    <!-- ══ LIVE TAB ══ -->
    <div v-if="tab === 'live'" class="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">

    <!-- ══ HEADER ══ -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-lg font-extrabold text-foreground">Generación Solar</h1>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Potencia en tiempo real por proyecto
          <!-- Es la hora en que se PREGUNTO, no la del dato. Decirlo evita que
               se lea como frescura: media flota puede estar horas atrasada y
               este numero seguiria diciendo la hora actual. -->
          <span v-if="lastUpdated" class="text-muted-foreground/70">· consultado {{ lastUpdated }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2.5">
        <!-- Filtro por proyecto -->
        <div class="relative w-64">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="filtro" placeholder="Buscar proyecto..." class="pl-8" />
          <button
            v-if="filtro"
            type="button"
            class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar filtro"
            @click="filtro = ''"
          >
            <XIcon class="size-4" />
          </button>
        </div>
        <!-- Toggle columnas -->
        <div class="flex items-center gap-1">
          <Button
            v-for="c in [1, 2, 4]"
            :key="c"
            type="button"
            :variant="cols === c ? 'secondary' : 'outline'"
            size="sm"
            :title="`${c} columna${c > 1 ? 's' : ''}`"
            @click="cols = c"
          >
            {{ c }}
          </Button>
        </div>
        <!-- Botón actualizar + auto-refresh -->
        <div class="flex items-center gap-1.5">
          <Button variant="outline" size="sm" :disabled="loading" @click="cargar">
            <LoaderCircleIcon v-if="loading" class="animate-spin" />
            <RefreshCwIcon v-else />
            Actualizar
          </Button>
          <Popover v-model:open="autoMenuOpen">
            <PopoverTrigger as-child>
              <Button :variant="autoInterval ? 'secondary' : 'outline'" size="sm">
                <ClockIcon />
                <span v-if="autoInterval">{{ autoLabel }}</span>
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-44 p-1">
              <Button
                variant="ghost"
                size="sm"
                class="w-full justify-start"
                :class="!autoInterval ? 'bg-muted' : ''"
                @click="setAuto(0)"
              >
                Desactivado
              </Button>
              <Button
                v-for="opt in autoOptions"
                :key="opt.ms"
                variant="ghost"
                size="sm"
                class="w-full justify-start"
                :class="autoInterval === opt.ms ? 'bg-muted' : ''"
                @click="setAuto(opt.ms)"
              >
                Cada {{ opt.label }}
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>

    <!-- ══ LOADING inicial ══ -->
    <div v-if="loading && !proyectos.length" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <LoaderCircleIcon class="size-7 animate-spin text-primary" />
      <span class="text-sm">Cargando proyectos...</span>
    </div>

    <!-- ══ EMPTY ══ -->
    <div v-else-if="!loading && !proyectos.length" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <SunIcon class="size-8 text-muted-foreground/40" />
      <p class="text-sm">Sin proyectos disponibles</p>
    </div>

    <!-- ══ SIN COINCIDENCIAS ══ -->
    <div v-else-if="sinCoincidencias" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <SearchIcon class="size-8 text-muted-foreground/40" />
      <p class="text-sm">Ningún proyecto coincide con "{{ filtro }}"</p>
    </div>

    <!-- ══ PROYECTOS (drag & drop) ══ -->
    <draggable
      v-else
      v-model="proyectos"
      item-key="proyecto_id"
      handle=".sl-drag-handle"
      class="grid gap-4"
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }"
      :disabled="!!filtro.trim()"
      @end="saveOrder"
    >
      <template #item="{ element: proy }">
        <div
          v-show="matchesFiltro(proy)"
          :ref="el => observarTarjeta(el, proy.proyecto_id)"
        >
        <Card size="sm">
        <CardContent class="flex flex-col gap-3">

          <!-- Nombre + estado -->
          <div class="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <MenuIcon class="sl-drag-handle size-4 shrink-0 cursor-grab text-muted-foreground/50 hover:text-primary active:cursor-grabbing" title="Arrastrar para reorganizar" />
            <span class="size-2 shrink-0 rounded-full" :style="{ background: STATUS_COLORS[proy.status] || '#9ca3af' }" />
            <span class="min-w-0 flex-1 truncate">{{ proy.nombre }}</span>
          </div>

          <!-- Cargando detalle -->
          <div v-if="!detailMap[proy.proyecto_id]" class="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <LoaderCircleIcon class="size-3.5 animate-spin" />
            <span>Cargando datos...</span>
          </div>

          <template v-else>
            <!-- % diferencia inversores vs medidores (mejor nodo) -->
            <div v-if="getDiffPct(proy.proyecto_id) !== null" class="flex items-center gap-2 text-xs">
              <span class="text-muted-foreground">Inversores vs medidor</span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-bold"
                :class="Math.abs(getDiffPct(proy.proyecto_id)) > 5 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
              >
                {{ getDiffPct(proy.proyecto_id) > 0 ? '+' : '' }}{{ getDiffPct(proy.proyecto_id) }}%
              </span>
            </div>

            <!-- Gráficas -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">

              <!-- Inversores -->
              <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <span class="size-2 shrink-0 rounded-full bg-primary" />
                  Inversores
                </div>
                <!-- Mismo tratamiento que Medidores: el acumulado del dia en
                     grande, con hasta que hora cubre. Son horas sumadas, no una
                     lectura del ultimo instante. -->
                <div class="flex items-baseline gap-2">
                  <span
                    class="text-xl font-bold tabular-nums"
                    :class="acumuladoInversores(detailMap[proy.proyecto_id]) === null ? 'text-muted-foreground' : 'text-foreground'"
                  >
                    {{ fmtKwh(acumuladoInversores(detailMap[proy.proyecto_id])) }}
                  </span>
                  <span v-if="hastaInversores(detailMap[proy.proyecto_id])" class="text-[10px] text-muted-foreground">
                    hasta {{ hastaInversores(detailMap[proy.proyecto_id]) }}
                    <template v-if="haceCuanto(hastaInversores(detailMap[proy.proyecto_id]))">
                      · {{ haceCuanto(hastaInversores(detailMap[proy.proyecto_id])) }}
                    </template>
                  </span>
                </div>
                <div v-if="getInversorData(proy.proyecto_id).labels.length" class="relative h-45">
                  <Line :data="getInversorData(proy.proyecto_id)" :options="chartOptionsInv(proy.proyecto_id)"
                    :plugins="[crosshairPlugin]" :key="'inv-' + proy.proyecto_id" />
                </div>
                <div v-else class="flex h-45 items-center justify-center text-sm text-muted-foreground">Sin datos</div>
              </div>

              <!-- Medidores -- el backend ya eligio cual mostrar -->
              <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <template v-if="panelesMedidor[proy.proyecto_id]">
                  <div class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    <span class="size-2 shrink-0 rounded-full bg-warning" />
                    Medidores
                    <Badge v-if="panelesMedidor[proy.proyecto_id].tipo" variant="outline">{{ panelesMedidor[proy.proyecto_id].tipo }}</Badge>
                  </div>
                  <!-- El numero grande es la generacion del dia: es lo que alguien
                       quiere saber de un vistazo, y no se cae a cero de noche como
                       la potencia instantanea. Sale del contador, con su hora. -->
                  <div class="flex items-baseline gap-2">
                    <span
                      class="text-xl font-bold tabular-nums"
                      :class="panelesMedidor[proy.proyecto_id].energiaKwh === null ? 'text-muted-foreground' : 'text-foreground'"
                    >
                      {{ fmtKwh(panelesMedidor[proy.proyecto_id].energiaKwh) }}
                    </span>
                    <span v-if="panelesMedidor[proy.proyecto_id].energiaHasta" class="text-[10px] text-muted-foreground">
                      hasta {{ panelesMedidor[proy.proyecto_id].energiaHasta }}
                      <template v-if="haceCuanto(panelesMedidor[proy.proyecto_id].energiaHasta)">
                        · {{ haceCuanto(panelesMedidor[proy.proyecto_id].energiaHasta) }}
                      </template>
                    </span>
                  </div>
                  <div v-if="panelesMedidor[proy.proyecto_id].chart" class="relative h-45">
                    <Line :data="panelesMedidor[proy.proyecto_id].chart" :options="chartOptionsMed(proy.proyecto_id)"
                      :plugins="[crosshairPlugin]" :key="'med-' + proy.proyecto_id" />
                  </div>
                  <div v-else class="flex h-45 items-center justify-center text-sm text-muted-foreground">Sin datos</div>
                </template>
                <div v-else class="flex h-45 items-center justify-center text-sm text-muted-foreground">Sin medidor</div>
              </div>

            </div>

            <!-- ── Generación de hoy ── -->
            <div class="flex flex-col gap-1.5 border-t border-border pt-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-warning uppercase">
                  <SunIcon class="size-3" />
                  Generación de hoy
                </span>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="text-xs font-bold"
                    :class="getGenHoy(proy.proyecto_id).pct === null ? 'text-muted-foreground'
                      : getGenHoy(proy.proyecto_id).pct >= 100 ? 'text-success'
                      : getGenHoy(proy.proyecto_id).pct >= 75 ? 'text-warning'
                      : 'text-destructive'"
                  >
                    {{ getGenHoy(proy.proyecto_id).real.toLocaleString('es-CO') }} kWh
                  </span>
                  <span class="text-xs text-muted-foreground">/</span>
                  <span class="text-xs text-muted-foreground">
                    {{ getGenHoy(proy.proyecto_id).p90.toLocaleString('es-CO') }} kWh P90
                  </span>
                  <span
                    v-if="getGenHoy(proy.proyecto_id).pct !== null"
                    class="text-xs font-bold"
                    :class="getGenHoy(proy.proyecto_id).pct >= 100 ? 'text-success'
                      : getGenHoy(proy.proyecto_id).pct >= 75 ? 'text-warning'
                      : 'text-destructive'"
                  >
                    {{ getGenHoy(proy.proyecto_id).pct }}%
                  </span>
                  <Badge v-if="getGenHoy(proy.proyecto_id).fuente === 'inversor'" variant="secondary" title="Dato de inversores">INV</Badge>
                  <Badge v-else-if="getGenHoy(proy.proyecto_id).fuente === 'medidor'" variant="secondary" title="Dato de medidor de frontera">MED</Badge>
                  <Badge v-else variant="outline" title="Sin dato disponible">S/D</Badge>
                </div>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="getGenHoy(proy.proyecto_id).pct >= 100 ? 'bg-success'
                    : getGenHoy(proy.proyecto_id).real > 0 ? 'bg-primary/40'
                    : 'bg-muted'"
                  :style="{
                    width: getGenHoy(proy.proyecto_id).p90 > 0
                      ? Math.min(100, getGenHoy(proy.proyecto_id).real / getGenHoy(proy.proyecto_id).p90 * 100) + '%'
                      : '0%'
                  }"
                />
              </div>
            </div>

          </template>
        </CardContent>
        </Card>
        </div>
      </template>
    </draggable>

    </div><!-- /live tab -->

    <!-- ══ HISTORIC TAB ══ -->
    <div v-else class="flex-1 overflow-y-auto">
      <GeneracionView />
    </div>

  </div><!-- /root -->

</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import draggable from 'vuedraggable'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
// Los datos y las DECISIONES que esta vista comparte con la app movil. Vive
// aparte porque las dos ya se separaron dos veces leyendo el mismo endpoint --
// ver el docstring del modulo.
import {
  TIME_LABELS,
  acumuladoInversores,
  acumuladoMedidor,
  fmtKwh,
  haceCuanto,
  hastaInversores,
  hastaMedidor,
  inverterSeries,
  meterSeries,
} from '~/features/solar/serieSolar'
import GeneracionView from '~/features/operaciones/components/GeneracionView.vue'

const generacionSolarService = new GeneracionSolarService()
import { ChartLineIcon, ChevronDownIcon, ClockIcon, LoaderCircleIcon, MenuIcon, RefreshCwIcon, SearchIcon, SunIcon, XIcon, ZapIcon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const STORAGE_KEY = 'solar_project_order'

// ── Tab ────────────────────────────────────────────────────────────────────
const tab = ref('live')

// ── Estado ─────────────────────────────────────────────────────────────────
const loading     = ref(false)
const proyectos   = ref([])
const detailMap   = reactive({})
const lastUpdated = ref('')
const cols        = ref(1)
let refreshTimer  = null

// ── Filtro por proyecto ────────────────────────────────────────────────────
const filtro = ref('')

function matchesFiltro(proy) {
  const q = filtro.value.trim().toLowerCase()
  if (!q) return true
  return (proy.nombre || '').toLowerCase().includes(q)
}

const sinCoincidencias = computed(() =>
  !!filtro.value.trim() && !proyectos.value.some(matchesFiltro)
)

// ── Generación de hoy ──────────────────────────────────────────────────────
// El P90 del dia lo manda /monitoring en cada proyecto (`p90_diario_kwh`).
//
// Antes se calculaba aca, y para eso esta vista se traia el listado COMPLETO de
// proyectos (~188, con las cinco relaciones anidadas del serializer de
// /proyectos) para leer un array de 12 numeros de las ~47 plantas que muestra.
// Era la peticion mas pesada de la pantalla y existia solo para eso.
function dailyP90(proyectoId) {
  const p = proyectos.value.find(x => x.proyecto_id === proyectoId)
  return p?.p90_diario_kwh ?? 0
}

/**
 * Lo generado hoy y contra que meta, para la barra inferior de cada tarjeta.
 *
 * Sale del DETALLE que esta misma vista ya cargo, no de `/generacion-hoy`.
 * Ese endpoint devolvia el mismo numero por otro camino --vuelve a preguntarle
 * a SolarView planta por planta, una o dos llamadas externas cada una-- asi que
 * la pantalla pedia dos veces lo mismo. Y al ser dos caminos distintos podian
 * no coincidir entre si: la tarjeta mostraba un numero arriba y otro abajo.
 *
 * El criterio de la fuente es el mismo que usaba el backend: mandan los
 * inversores y el medidor es el respaldo cuando dan cero.
 */
function getGenHoy(id) {
  const d = detailMap[id]
  const inv = acumuladoInversores(d)
  const med = acumuladoMedidor(d)

  let real = 0
  let fuente = 'sin_dato'
  if (inv > 0) { real = inv; fuente = 'inversor' }
  else if (med > 0) { real = med; fuente = 'medidor' }

  real = +Number(real).toFixed(1)
  const p90 = dailyP90(id)
  const pct = p90 > 0 ? Math.round(real / p90 * 100) : null
  return { real, p90, fuente, pct }
}

// ── Auto-refresh ───────────────────────────────────────────────────────────
const AUTO_KEY = 'solar_auto_refresh'
const autoOptions = [
  { ms: 60000,  label: '1 min' },
  { ms: 300000, label: '5 min' },
  { ms: 900000, label: '15 min' },
  { ms: 1800000,label: '30 min' },
]
const autoInterval = ref(parseInt(localStorage.getItem(AUTO_KEY) || '0'))
const autoMenuOpen = ref(false)
const autoLabel    = computed(() => autoOptions.find(o => o.ms === autoInterval.value)?.label ?? '')

function setAuto(ms) {
  autoMenuOpen.value = false
  autoInterval.value = ms
  localStorage.setItem(AUTO_KEY, String(ms))
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = ms ? setInterval(cargar, ms) : null
}

const STATUS_COLORS = {
  online: '#16a34a', degradado: '#d97706', caido: '#dc2626',
  sin_comunicacion: '#9ca3af', offline: '#d1d5db',
}

// ── Orden persistido ───────────────────────────────────────────────────────
function saveOrder() {
  const order = proyectos.value.map(p => p.proyecto_id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

function applyOrder(list) {
  try {
    const order = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!order.length) return list
    const map = Object.fromEntries(list.map(p => [p.proyecto_id, p]))
    const sorted = order.map(id => map[id]).filter(Boolean)
    const rest = list.filter(p => !order.includes(p.proyecto_id))
    return [...sorted, ...rest]
  } catch { return list }
}

// ── Crosshair plugin ───────────────────────────────────────────────────────
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (!chart.tooltip?._active?.length) return
    const x = chart.tooltip._active[0].element.x
    const { ctx, chartArea: { top, bottom } } = chart
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(28,18,50,0.18)'
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.restore()
  },
}

// ── Datos de gráficas ─────────────────────────────────────────────────────
// La SERIE la arma serieSolar (igual que la grafica del movil); aca solo va la
// configuracion de Chart.js, que si es propia del escritorio. Antes esta funcion
// repetia el bucketeo literalmente -- el mismo copiar-pegar que hizo divergir
// las dos vistas dos veces esta semana.
function getInversorData(id) {
  const data = inverterSeries(detailMap[id])
  if (!data) return { labels: [], datasets: [] }
  return {
    labels: TIME_LABELS,
    datasets: [{ label: 'Inversores (kW)', data, borderColor: '#915BD8',
      backgroundColor: 'rgba(145,91,216,0.18)', fill: true, tension: 0.35,
      pointRadius: 0, borderWidth: 2, spanGaps: true }],
  }
}


// ── Selección del mejor snapshot de medidor ───────────────────────────────
// Todo lo que el panel de Medidores necesita, en un solo lugar. El backend ya
// entrega el medidor elegido y resuelto en `medidor` (potencia de ahora,
// energia del dia, curva sin rellenar y frescura), asi que aca no se decide
// nada: se formatea. Antes esto eran seis funciones sueltas y una septima que
// re-elegia el medidor con un criterio duplicado del backend (2026-09-03).
// Se calcula una vez por proyecto y no en cada interpolacion del template.
const panelesMedidor = computed(() => Object.fromEntries(
  (proyectos.value ?? []).map(p => [p.proyecto_id, medidorPanel(p.proyecto_id)]),
))

function medidorPanel(id) {
  const d = detailMap[id]
  const m = d?.medidor
  if (!m) return null
  const data = meterSeries(d)
  return {
    // 'P'/'R' solo si hay dos medidores; con uno solo la etiqueta sobra.
    tipo: d.medidor_respaldo ? (m.node_id === d.medidor_principal?.node_id ? 'P' : 'R') : null,
    energiaKwh: acumuladoMedidor(d),
    energiaHasta: hastaMedidor(d),
    // Sin relleno: si la telemetria de potencia se cayo, el hueco se ve.
    chart: data
      ? { labels: TIME_LABELS, datasets: [{ label: 'Medidores (kW)', data, borderColor: '#D4A017',
          backgroundColor: 'rgba(212,160,23,0.15)', fill: true, tension: 0.35,
          pointRadius: 0, borderWidth: 2, spanGaps: true }] }
      : null,
  }
}



// Potencia de AHORA y su frescura: los dos ya llegaban en la respuesta y la
// vista los descartaba, en una pestana cuyo proposito es el tiempo real.

// ── % diferencia ─────────────────────────────────────────────────────────
function getDiffPct(id) {
  const inv = acumuladoInversores(detailMap[id])
  const med = medidorPanel(id)?.energiaKwh ?? null
  if (inv == null || med == null || med === 0) return null
  return +((inv - med) / med * 100).toFixed(1)
}

// ── Chart options ─────────────────────────────────────────────────────────
function makeOptions(color, maxY) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff', titleColor: '#374151', bodyColor: '#4b5563',
        borderColor: '#e5e7eb', borderWidth: 1, padding: 10, displayColors: true,
        callbacks: { label: ctx => `${ctx.parsed.y != null ? ctx.parsed.y.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} kW` },
      },
    },
    scales: {
      x: { ticks: { font: { size: 9 }, color: '#9ca3af', maxTicksLimit: 9 }, grid: { color: 'rgba(28,18,50,0.06)' } },
      y: {
        beginAtZero: true, ticks: { font: { size: 9 }, color: '#9ca3af' },
        grid: { color: 'rgba(28,18,50,0.06)' }, title: { display: true, text: 'kW', font: { size: 9 }, color: '#9ca3af' },
        ...(maxY ? { max: maxY } : {}),
      },
    },
  }
}

// Escala Y compartida entre Inversores y Medidores del MISMO proyecto -- si
// cada gráfica autoescala su propio máximo, dos curvas con magnitudes muy
// distintas pueden verse "igual de altas" aunque haya una diferencia real
// grande (ej. +44%). Con un máximo compartido, la diferencia se ve a simple
// vista en vez de quedar escondida por el autoescalado independiente.
function getChartMax(id) {
  const invValores = getInversorData(id).datasets?.[0]?.data ?? []
  const medValores = medidorPanel(id)?.chart?.datasets?.[0]?.data ?? []
  const valores = [...invValores, ...medValores].filter(v => v != null)
  if (!valores.length) return undefined
  const max = Math.max(...valores)
  // Redondeado al múltiplo de 50 más cercano, +10% de aire para que el pico
  // no toque el borde superior del gráfico.
  return Math.ceil((max * 1.1) / 50) * 50
}

function chartOptionsInv(id) { return makeOptions('#915BD8', getChartMax(id)) }
function chartOptionsMed(id) { return makeOptions('#D4A017', getChartMax(id)) }

// ── Carga perezosa del detalle ──────────────────────────────────────────────
//
// El detalle de UNA tarjeta cuesta cuatro llamadas externas (la curva de
// potencia, la generacion de hoy y los dos medidores). Pedirlo de las ~47
// plantas eran ~188 llamadas por carga, la mayoria de tarjetas que el usuario
// nunca bajaba a ver. Ahora se pide de las que estan en pantalla.
//
// El esqueleto por tarjeta ("Cargando datos...") ya existia, asi que las que
// aun no llegaron no se ven rotas: se ven cargando, que es lo que estan.

const tarjetasVisibles = new Set()
const idDeTarjeta = new WeakMap()
const detalleEnVuelo = new Set()
let observador = null

/** Un poco antes de que entre: para cuando el usuario llega, ya esta. */
const MARGEN_PRECARGA = '400px'

/**
 * Cuantas tarjetas cargar sin esperar a que el observador diga nada.
 *
 * En la primera carga todavia no hay nada dibujado, asi que el observador no
 * puede saber que se ve. Tres filas cubren la pantalla en cualquiera de los
 * anchos de columna que ofrece el selector, y el observador se encarga del
 * resto apenas se pinta.
 */
function tamanoPrimeraOla() {
  return Math.min(12, Math.max(4, cols.value * 3))
}

function observarTarjeta(el, id) {
  if (!el) return
  idDeTarjeta.set(el, id)
  observador?.observe(el)   // observar dos veces el mismo nodo no hace nada
}

function alCambiarVisibilidad(entradas) {
  for (const entrada of entradas) {
    const id = idDeTarjeta.get(entrada.target)
    if (id == null) continue
    if (entrada.isIntersecting) {
      tarjetasVisibles.add(id)
      loadDetail(id)
    } else {
      tarjetasVisibles.delete(id)
    }
  }
}

// ── Carga ─────────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  try {
    const res = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = applyOrder(res.projects ?? [])
    lastUpdated.value = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

    // El boton sigue en "cargando" hasta que lleguen tambien los detalles de lo
    // que se ve. Antes `loading` se apagaba apenas respondia /monitoring, que
    // solo trae la lista y el estado: las tarjetas -- que son lo que de verdad
    // cambia en pantalla -- seguian llegando despues, asi que el boton decia
    // "listo" varios segundos antes de que los numeros se movieran.
    //
    // En el refresco automatico se refrescan las que estan en pantalla. Las que
    // quedaron arriba o abajo no se vuelven a pedir hasta que se vuelvan a ver:
    // nadie las esta mirando, y volver a pedirlas era el grueso del gasto de un
    // refresco cada minuto.
    const ids = proyectos.value.map(p => p.proyecto_id)
    const aCargar = tarjetasVisibles.size
      ? ids.filter(id => tarjetasVisibles.has(id))
      : ids.slice(0, tamanoPrimeraOla())

    const BATCH = 10
    for (let i = 0; i < aCargar.length; i += BATCH) {
      await Promise.all(aCargar.slice(i, i + BATCH).map(id => loadDetail(id, true)))
    }
  } catch { /* silencioso */ } finally {
    loading.value = false
  }
}

/**
 * El detalle de una tarjeta. `refrescar` lo vuelve a pedir aunque ya este.
 *
 * Sin `refrescar`, una tarjeta ya cargada no se vuelve a pedir: el observador
 * dispara cada vez que entra y sale de pantalla, y sin esta guarda scrollear
 * arriba y abajo pedia lo mismo una y otra vez.
 */
async function loadDetail(id, refrescar = false) {
  if (!refrescar && detailMap[id] !== undefined) return
  if (detalleEnVuelo.has(id)) return
  detalleEnVuelo.add(id)
  try {
    detailMap[id] = await generacionSolarService.obtenerDetalle(id)
  } catch {
    // `{}` y no dejarlo sin definir: sin esto la tarjeta se queda con el
    // esqueleto girando para siempre en vez de mostrar que no hay datos.
    detailMap[id] = {}
  } finally {
    detalleEnVuelo.delete(id)
  }
}



onMounted(() => {
  // Sin IntersectionObserver (navegador viejo) no se rompe nada: `observador`
  // queda en null, `observarTarjeta` no hace nada y cada carga trae la primera
  // ola, igual que antes pero mas corta.
  if (typeof IntersectionObserver !== 'undefined') {
    observador = new IntersectionObserver(alCambiarVisibilidad, { rootMargin: MARGEN_PRECARGA })
  }
  cargar()
  if (autoInterval.value) refreshTimer = setInterval(cargar, autoInterval.value)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  observador?.disconnect()
  observador = null
  tarjetasVisibles.clear()
})
</script>
