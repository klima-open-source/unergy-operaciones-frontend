<template>
  <div class="sl-root">

    <!-- ══ TAB BAR ══ -->
    <div class="sl-tabbar">
      <div class="sl-tabs">
        <button :class="['sl-tab', tab === 'live' && 'sl-tab--active']" @click="tab = 'live'">
          <ZapIcon class="size-[1em]" /> Tiempo Real
        </button>
        <button :class="['sl-tab', tab === 'hist' && 'sl-tab--active']" @click="tab = 'hist'">
          <ChartLineIcon class="size-[1em]" /> Histórico
        </button>
      </div>
    </div>

    <!-- ══ LIVE TAB ══ -->
    <div v-if="tab === 'live'" class="sl-page">

    <!-- ══ HEADER ══ -->
    <div class="sl-header">
      <div>
        <h1 class="sl-title">Generación Solar</h1>
        <p class="sl-subtitle">
          Potencia en tiempo real por proyecto
          <!-- Es la hora en que se PREGUNTO, no la del dato. Decirlo evita que
               se lea como frescura: media flota puede estar horas atrasada y
               este numero seguiria diciendo la hora actual. -->
          <span v-if="lastUpdated" class="sl-ts">· consultado {{ lastUpdated }}</span>
        </p>
      </div>
      <div class="sl-header-right">
        <!-- Filtro por proyecto -->
        <div class="sl-filter-wrap">
          <SearchIcon class="sl-filter-icon size-[1em]" />
          <AutoComplete
            v-model="filtro"
            :suggestions="projectSuggestions"
            @complete="onFiltroComplete"
            :completeOnFocus="true"
            :delay="0"
            scrollHeight="280px"
            placeholder="Buscar o seleccionar proyecto..."
            class="sl-filter-ac"
            inputClass="sl-filter-input"
          />
          <XIcon class="sl-filter-clear size-[1em]" v-if="filtro" @click="filtro = ''" />
        </div>
        <!-- Toggle columnas -->
        <div class="sl-cols-toggle">
          <button v-for="c in [1,2,4]" :key="c"
            :class="['sl-col-btn', cols === c && 'sl-col-btn--active']"
            @click="cols = c" :title="`${c} columna${c > 1 ? 's' : ''}`">
            <span class="sl-col-icon">
              <span v-for="n in c" :key="n" class="sl-col-bar" />
            </span>
          </button>
        </div>
        <!-- Botón actualizar + auto-refresh -->
        <div class="sl-refresh-wrap">
          <button class="sl-refresh-btn" @click="cargar" :disabled="loading">
            <LoaderCircleIcon v-if="loading" class="size-[1em] animate-spin" />
            <RefreshCwIcon v-else class="size-[1em]" />
            Actualizar
          </button>
          <div class="sl-auto-wrap">
            <button class="sl-auto-btn" :class="autoInterval && 'sl-auto-btn--on'" @click="toggleAutoMenu" :title="autoInterval ? `Auto: ${autoLabel}` : 'Auto-actualizar'">
              <ClockIcon class="size-[1em]" />
              <span v-if="autoInterval" class="sl-auto-label">{{ autoLabel }}</span>
              <ChevronDownIcon class="sl-auto-caret size-[1em]" />
            </button>
            <div v-if="autoMenuOpen" class="sl-auto-menu">
              <button class="sl-auto-option" :class="!autoInterval && 'sl-auto-option--active'" @click="setAuto(0)">Desactivado</button>
              <button v-for="opt in autoOptions" :key="opt.ms" class="sl-auto-option" :class="autoInterval === opt.ms && 'sl-auto-option--active'" @click="setAuto(opt.ms)">
                Cada {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ LOADING inicial ══ -->
    <div v-if="loading && !proyectos.length" class="sl-loading">
      <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:28px;color:var(--color-unergy-purple)" />
      <span>Cargando proyectos...</span>
    </div>

    <!-- ══ EMPTY ══ -->
    <div v-else-if="!loading && !proyectos.length" class="sl-empty">
      <SunIcon class="size-[1em]" style="font-size:32px;color:#cbd5e1" />
      <p>Sin proyectos disponibles</p>
    </div>

    <!-- ══ SIN COINCIDENCIAS ══ -->
    <div v-else-if="sinCoincidencias" class="sl-empty">
      <SearchIcon class="size-[1em]" style="font-size:32px;color:#cbd5e1" />
      <p>Ningún proyecto coincide con "{{ filtro }}"</p>
    </div>

    <!-- ══ PROYECTOS (drag & drop) ══ -->
    <draggable
      v-else
      v-model="proyectos"
      item-key="proyecto_id"
      handle=".sl-drag-handle"
      class="sl-grid"
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }"
      :disabled="!!filtro.trim()"
      @end="saveOrder"
    >
      <template #item="{ element: proy }">
        <div v-show="matchesFiltro(proy)" class="sl-project-block">

          <!-- Nombre + estado -->
          <div class="sl-project-name">
            <MenuIcon class="sl-drag-handle size-[1em]" title="Arrastrar para reorganizar" />
            <span class="sl-status-dot" :style="{ background: STATUS_COLORS[proy.status] || '#9ca3af' }" />
            <span class="sl-project-nombre">{{ proy.nombre }}</span>
          </div>

          <!-- Cargando detalle -->
          <div v-if="!detailMap[proy.proyecto_id]" class="sl-detail-loading">
            <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:14px;color:#6b5a8a" />
            <span>Cargando datos...</span>
          </div>

          <template v-else>
            <!-- % diferencia inversores vs medidores (mejor nodo) -->
            <div v-if="getDiffPct(proy.proyecto_id) !== null" class="sl-diff-row">
              <span class="sl-diff-label">Inversores vs Medidor</span>
              <span :class="['sl-diff-badge', Math.abs(getDiffPct(proy.proyecto_id)) > 5 ? 'sl-diff-warn' : 'sl-diff-ok']">
                {{ getDiffPct(proy.proyecto_id) > 0 ? '+' : '' }}{{ getDiffPct(proy.proyecto_id) }}%
              </span>
            </div>

            <!-- Gráficas -->
            <div class="sl-charts-row">

              <!-- Inversores -->
              <div class="sl-chart-card">
                <div class="sl-chart-header">
                  <div class="sl-chart-title">
                    <span class="sl-dot" style="background:var(--color-unergy-purple)" />
                    Inversores
                  </div>
                </div>
                <!-- Mismo tratamiento que Medidores: el acumulado del dia en
                     grande, con hasta que hora cubre. Son horas sumadas, no una
                     lectura del ultimo instante. -->
                <div class="sl-ahora">
                  <span :class="['sl-ahora-kw', { 'sl-ahora-sin': acumuladoInversores(detailMap[proy.proyecto_id]) === null }]">
                    {{ fmtKwh(acumuladoInversores(detailMap[proy.proyecto_id])) }}
                  </span>
                  <span v-if="hastaInversores(detailMap[proy.proyecto_id])" class="sl-ahora-t">
                    hasta {{ hastaInversores(detailMap[proy.proyecto_id]) }}
                    <template v-if="haceCuanto(hastaInversores(detailMap[proy.proyecto_id]))">
                      · {{ haceCuanto(hastaInversores(detailMap[proy.proyecto_id])) }}
                    </template>
                  </span>
                </div>
                <div v-if="getInversorData(proy.proyecto_id).labels.length" class="sl-chart-wrap">
                  <Line :data="getInversorData(proy.proyecto_id)" :options="chartOptionsInv(proy.proyecto_id)"
                    :plugins="[crosshairPlugin]" :key="'inv-' + proy.proyecto_id" />
                </div>
                <div v-else class="sl-no-data">Sin datos</div>
              </div>

              <!-- Medidores -- el backend ya eligio cual mostrar -->
              <div class="sl-chart-card">
                <template v-if="panelesMedidor[proy.proyecto_id]">
                  <div class="sl-chart-header">
                    <div class="sl-chart-title">
                      <span class="sl-dot" style="background:#D4A017" />
                      Medidores
                      <span v-if="panelesMedidor[proy.proyecto_id].tipo" class="sl-med-tipo">{{ panelesMedidor[proy.proyecto_id].tipo }}</span>
                    </div>
                  </div>
                  <!-- El numero grande es la generacion del dia: es lo que alguien
                       quiere saber de un vistazo, y no se cae a cero de noche como
                       la potencia instantanea. Sale del contador, con su hora. -->
                  <div class="sl-ahora">
                    <span :class="['sl-ahora-kw', { 'sl-ahora-sin': panelesMedidor[proy.proyecto_id].energiaKwh === null }]">
                      {{ fmtKwh(panelesMedidor[proy.proyecto_id].energiaKwh) }}
                    </span>
                    <span v-if="panelesMedidor[proy.proyecto_id].energiaHasta" class="sl-ahora-t">
                      hasta {{ panelesMedidor[proy.proyecto_id].energiaHasta }}
                      <template v-if="haceCuanto(panelesMedidor[proy.proyecto_id].energiaHasta)">
                        · {{ haceCuanto(panelesMedidor[proy.proyecto_id].energiaHasta) }}
                      </template>
                    </span>
                  </div>
                  <div v-if="panelesMedidor[proy.proyecto_id].chart" class="sl-chart-wrap">
                    <Line :data="panelesMedidor[proy.proyecto_id].chart" :options="chartOptionsMed(proy.proyecto_id)"
                      :plugins="[crosshairPlugin]" :key="'med-' + proy.proyecto_id" />
                  </div>
                  <div v-else class="sl-no-data">Sin datos</div>
                </template>
                <div v-else class="sl-no-data">Sin medidor</div>
              </div>

            </div>

            <!-- ── Generación de hoy ── -->
            <div class="sl-genhoy">
              <div class="sl-genhoy-head">
                <span class="sl-genhoy-title">
                  <SunIcon class="size-[1em]" style="color:#f59e0b;font-size:11px" />
                  Generación de hoy
                </span>
                <div class="sl-genhoy-vals">
                  <span :style="{
                    color: getGenHoy(proy.proyecto_id).pct === null ? '#6b5a8a'
                         : getGenHoy(proy.proyecto_id).pct >= 100 ? '#4ade80'
                         : getGenHoy(proy.proyecto_id).pct >= 75  ? '#fbbf24'
                         : '#f87171',
                    fontWeight: 700, fontSize: '12px'
                  }">
                    {{ getGenHoy(proy.proyecto_id).real.toLocaleString('es-CO') }} kWh
                  </span>
                  <span style="color:#4a3960;font-size:11px">/</span>
                  <span style="color:#a89fc0;font-size:11px">
                    {{ getGenHoy(proy.proyecto_id).p90.toLocaleString('es-CO') }} kWh P90
                  </span>
                  <span v-if="getGenHoy(proy.proyecto_id).pct !== null"
                    class="sl-genhoy-pct"
                    :style="{
                      color: getGenHoy(proy.proyecto_id).pct >= 100 ? '#4ade80'
                           : getGenHoy(proy.proyecto_id).pct >= 75  ? '#fbbf24'
                           : '#f87171'
                    }">
                    {{ getGenHoy(proy.proyecto_id).pct }}%
                  </span>
                  <span v-if="getGenHoy(proy.proyecto_id).fuente === 'inversor'"
                    class="sl-genhoy-badge" title="Dato de inversores">INV</span>
                  <span v-else-if="getGenHoy(proy.proyecto_id).fuente === 'medidor'"
                    class="sl-genhoy-badge sl-genhoy-badge--med" title="Dato de medidor de frontera">MED</span>
                  <span v-else
                    class="sl-genhoy-badge sl-genhoy-badge--nd" title="Sin dato disponible">S/D</span>
                </div>
              </div>
              <div class="sl-genhoy-track">
                <div class="sl-genhoy-fill" :style="{
                  width: getGenHoy(proy.proyecto_id).p90 > 0
                    ? Math.min(100, getGenHoy(proy.proyecto_id).real / getGenHoy(proy.proyecto_id).p90 * 100) + '%'
                    : '0%',
                  background: getGenHoy(proy.proyecto_id).pct >= 100 ? '#4ADE80'
                    : getGenHoy(proy.proyecto_id).real > 0 ? '#C4B5FD'
                    : '#e9e6f5'
                }" />
              </div>
            </div>

          </template>
        </div>
      </template>
    </draggable>

    </div><!-- /sl-page live -->

    <!-- ══ HISTORIC TAB ══ -->
    <div v-else class="sl-hist">
      <GeneracionView />
    </div>

  </div><!-- /sl-root -->

</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import draggable from 'vuedraggable'
import AutoComplete from 'primevue/autocomplete'
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
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import GeneracionView from '~/features/operaciones/components/GeneracionView.vue'

const generacionSolarService = new GeneracionSolarService()
const proyectosService = new ProyectosService()
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

// Sugerencias para el AutoComplete: escribir filtra en vivo (mismo filtro),
// enfocar despliega la lista completa de proyectos para seleccionar.
const projectSuggestions = ref([])
function onFiltroComplete(e) {
  const nombres = [...new Set((proyectos.value || []).map(p => p.nombre).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
  const q = (e.query || '').toLowerCase().trim()
  projectSuggestions.value = q ? nombres.filter(n => n.toLowerCase().includes(q)) : nombres
}

// ── Generación de hoy ──────────────────────────────────────────────────────
const genHoyMap  = reactive({})   // proyecto_id → { kwh_real, fuente }
const p90List    = ref([])        // proyectos con p90_mensual_kwh

const _todayColStr = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)

function dailyP90(proyectoId) {
  const p   = p90List.value.find(x => x.id === proyectoId)
  const arr = p?.p90_mensual_kwh
  if (!arr?.length) return 0
  const dt           = new Date(_todayColStr + 'T00:00:00')
  const daysInMonth  = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()
  return +((Number(arr[dt.getMonth()]) || 0) / daysInMonth).toFixed(1)
}

function getGenHoy(id) {
  const g    = genHoyMap[id]
  const real = g ? +Number(g.kwh_real || 0).toFixed(1) : 0
  const p90  = dailyP90(id)
  const fuente = g?.fuente ?? 'sin_dato'
  const pct  = p90 > 0 ? Math.round(real / p90 * 100) : null
  return { real, p90, fuente, pct }
}

async function cargarGenHoy() {
  try {
    const [filasHoy, proyectos] = await Promise.all([
      generacionSolarService.obtenerGeneracionHoy(),
      proyectosService.listar({ size: 500 }),
    ])
    p90List.value = proyectos
    for (const row of filasHoy) {
      genHoyMap[row.proyecto_id] = { kwh_real: row.kwh_real, fuente: row.fuente }
    }
  } catch { /* silencioso */ }
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

function toggleAutoMenu() { autoMenuOpen.value = !autoMenuOpen.value }

function onClickOutside(e) {
  if (!e.target.closest('.sl-auto-wrap')) autoMenuOpen.value = false
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

// ── Carga ─────────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  try {
    const res = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = applyOrder(res.projects ?? [])
    lastUpdated.value = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

    // El boton sigue en "cargando" hasta que terminen tambien gen-hoy y los
    // detalles. Antes `loading` se apagaba apenas respondia /monitoring, que
    // solo trae la lista y el estado: las tarjetas -- que son lo que de verdad
    // cambia en pantalla -- seguian llegando de a 10 despues, asi que el boton
    // decia "listo" varios segundos antes de que los numeros se movieran.
    const ids = proyectos.value.map(p => p.proyecto_id)
    const BATCH = 10
    const detalles = (async () => {
      for (let i = 0; i < ids.length; i += BATCH) {
        await Promise.all(ids.slice(i, i + BATCH).map(id => loadDetail(id)))
      }
    })()
    await Promise.all([cargarGenHoy(), detalles])
  } catch { /* silencioso */ } finally {
    loading.value = false
  }
}

async function loadDetail(id) {
  try {
    detailMap[id] = await generacionSolarService.obtenerDetalle(id)
  } catch { detailMap[id] = {} }
}



onMounted(() => {
  cargar()
  if (autoInterval.value) refreshTimer = setInterval(cargar, autoInterval.value)
  document.addEventListener('click', onClickOutside)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
/* ── Root (full height shell) ── */
.sl-root {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
  font-family: 'Sora', system-ui, sans-serif; background: #f3f4f6;
}

/* ── Tab bar ── */
.sl-tabbar {
  display: flex; align-items: center; padding: 10px 24px 0;
  background: #f3f4f6; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
}
.sl-tabs { display: flex; gap: 2px; }
.sl-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 16px 9px; border: none; background: transparent; cursor: pointer;
  font-size: 13px; font-weight: 600; color: #6b5a8a; border-radius: 6px 6px 0 0;
  font-family: inherit; transition: color 0.15s; border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.sl-tab:hover { color: var(--color-unergy-deep); }
.sl-tab--active { color: var(--color-unergy-purple); border-bottom-color: var(--color-unergy-purple); }
.sl-tab svg { font-size: 12px; }

/* ── Live tab content ── */
.sl-page {
  flex: 1; display: flex; flex-direction: column; gap: 20px;
  overflow-y: auto; padding: 24px; box-sizing: border-box;
}

/* ── Historic tab content ── */
.sl-hist {
  flex: 1; overflow-y: auto; background: #f3f4f6;
  padding: 0 24px 24px; box-sizing: border-box;
}

/* ── Header ── */
.sl-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sl-header-right { display: flex; align-items: center; gap: 10px; }
.sl-title { font-size: 20px; font-weight: 800; color: var(--color-unergy-deep); margin: 0; }
.sl-subtitle { font-size: 12px; color: #6b5a8a; margin: 3px 0 0; }
.sl-ts { color: #9ca3af; }

/* ── Filtro por proyecto ── */
.sl-filter-wrap { position: relative; display: flex; align-items: center; }
.sl-filter-icon { position: absolute; left: 11px; font-size: 12px; color: #9ca3af; pointer-events: none; }
.sl-filter-input {
  width: 260px; padding: 7px 28px 7px 30px; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fff; font-size: 13px; font-family: inherit; color: var(--color-unergy-deep); outline: none;
  transition: border-color 0.15s;
}
.sl-filter-input:focus { border-color: var(--color-unergy-purple); }
.sl-filter-input::placeholder { color: #9ca3af; }
/* AutoComplete del filtro: mismo aspecto que el input anterior */
.sl-filter-ac :deep(input) {
  width: 260px; padding: 7px 28px 7px 30px; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fff; font-size: 13px; font-family: inherit; color: var(--color-unergy-deep); outline: none;
  transition: border-color 0.15s;
}
.sl-filter-ac :deep(input:focus) { border-color: var(--color-unergy-purple); }
.sl-filter-ac :deep(input::placeholder) { color: #9ca3af; }
.sl-filter-clear { position: absolute; right: 10px; font-size: 11px; color: #9ca3af; cursor: pointer; }
.sl-filter-clear:hover { color: #6b5a8a; }

/* ── Column toggle ── */
.sl-cols-toggle { display: flex; gap: 4px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 3px; }
.sl-col-btn { display: flex; align-items: center; justify-content: center; width: 30px; height: 26px; border-radius: 6px; border: none; background: transparent; cursor: pointer; transition: background 0.15s; }
.sl-col-btn:hover { background: rgba(145,91,216,0.12); }
.sl-col-btn--active { background: var(--color-unergy-purple); }
.sl-col-icon { display: flex; gap: 2px; align-items: center; }
.sl-col-bar { display: block; width: 4px; height: 14px; border-radius: 2px; background: #9ca3af; }
.sl-col-btn--active .sl-col-bar { background: #fff; }

/* ── Refresh ── */
.sl-refresh-wrap { display: flex; align-items: center; gap: 6px; }
.sl-refresh-btn { display: flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; background: var(--color-unergy-purple); color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.2s; }
.sl-refresh-btn:hover:not(:disabled) { background: #7a3fc0; }
.sl-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Auto-refresh dropdown ── */
.sl-auto-wrap { position: relative; }
.sl-auto-btn { display: flex; align-items: center; gap: 5px; padding: 7px 10px; border-radius: 8px; background: #fff; color: #6b5a8a; border: 1px solid #e5e7eb; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; white-space: nowrap; }
.sl-auto-btn:hover { background: #f3f1f8; color: var(--color-unergy-deep); }
.sl-auto-btn--on { background: rgba(145,91,216,0.1); color: #7c3aed; border-color: var(--color-unergy-purple); }
.sl-auto-label { font-size: 11px; }
.sl-auto-caret { font-size: 10px; }
.sl-auto-menu { position: absolute; right: 0; top: calc(100% + 6px); background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; min-width: 140px; overflow: hidden; z-index: 50; box-shadow: 0 8px 24px rgba(28,18,50,0.12); }
.sl-auto-option { display: block; width: 100%; padding: 9px 14px; background: none; border: none; color: #4a3b6b; font-size: 13px; text-align: left; cursor: pointer; transition: background 0.15s; }
.sl-auto-option:hover { background: #f3f1f8; }
.sl-auto-option--active { background: rgba(145,91,216,0.1); color: #7c3aed; font-weight: 600; }

/* ── Estados ── */
.sl-loading, .sl-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 0; color: #6b5a8a; font-size: 14px; }

/* ── Grid ── */
.sl-grid { display: grid; gap: 20px; }

/* ── Bloque proyecto ── */
.sl-project-block { background: #fff; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; border: 1px solid #ece8f4; box-shadow: 0 1px 3px rgba(28,18,50,0.04); }

/* ── Drag handle ── */
.sl-drag-handle { font-size: 13px; color: #cbd5e1; cursor: grab; flex-shrink: 0; transition: color 0.15s; }
.sl-drag-handle:hover { color: var(--color-unergy-purple); }
.sl-drag-handle:active { cursor: grabbing; }

.sl-project-name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; color: var(--color-unergy-deep); }
.sl-status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* Potencia instantanea del medidor */
.sl-ahora { display: flex; align-items: baseline; gap: 8px; margin: 2px 0 8px; }
.sl-ahora-kw { font-size: 22px; font-weight: 700; color: #2c2340; font-variant-numeric: tabular-nums; }
.sl-ahora-sin { color: #9b89b5; }
.sl-ahora-t { font-size: 10px; color: #9b89b5; }
.sl-acum-hasta { font-weight: 400; opacity: 0.75; }
.sl-power-badge { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--color-unergy-purple); background: rgba(145,91,216,0.12); padding: 2px 10px; border-radius: 999px; }

/* ── Loading detalle ── */
.sl-detail-loading { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #9ca3af; padding: 8px 0; }

/* ── % Diferencia ── */
.sl-diff-row { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.sl-diff-label { color: #6b5a8a; }
.sl-diff-badge { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.sl-diff-ok   { background: rgba(22,163,74,0.1);  color: #16a34a; }
.sl-diff-warn { background: rgba(217,119,6,0.12);   color: #d97706; }

/* ── Fila gráficas ── */
.sl-charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }

/* ── Tarjeta gráfica ── */
.sl-chart-card { background: #f9fafb; border-radius: 10px; border: 1px solid #eef0f4; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.sl-chart-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sl-chart-title { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b5a8a; }
.sl-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Acumulado ── */
.sl-acum { font-size: 12px; font-weight: 700; padding: 1px 9px; border-radius: 999px; }
.sl-acum.inv { background: rgba(145,91,216,0.12); color: #7c3aed; }
.sl-acum.med { background: rgba(212,160,23,0.14); color: #a16207; }
.sl-med-tipo { font-size: 9px; font-weight: 700; color: #6b5a8a; background: #f3f1f8; border-radius: 4px; padding: 1px 5px; margin-left: 4px; }

/* ── Wrap gráfica ── */
.sl-chart-wrap { height: 180px; position: relative; }
.sl-no-data { height: 180px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #cbd5e1; }

/* ── Generación de hoy ── */
.sl-genhoy { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; border-top: 1px solid #ece8f4; }
.sl-genhoy-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.sl-genhoy-title { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-unergy-purple); }
.sl-genhoy-vals { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sl-genhoy-pct { font-size: 11px; font-weight: 700; }
.sl-genhoy-badge { font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px; background: rgba(145,91,216,0.12); color: #7c3aed; letter-spacing: 0.3px; }
.sl-genhoy-badge--med { background: rgba(212,160,23,0.14); color: #a16207; }
.sl-genhoy-badge--nd  { background: #f1f0f5; color: #9ca3af; }
.sl-genhoy-track { height: 5px; background: #e9e6f5; border-radius: 999px; overflow: hidden; }
.sl-genhoy-fill  { height: 100%; border-radius: 999px; transition: width 0.6s ease, background 0.3s; }

/* ── Project name row ── */
.sl-project-nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

</style>
