<template>
  <div class="gen-page">

    <!-- ══ STICKY HEADER ═══════════════════════════════════════════════ -->
    <div class="gen-sticky-header">

      <!-- Title row -->
      <div class="gen-titlebar">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background: rgba(145,91,216,0.12)">
            <ChartLineIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
          </div>
          <h2 class="text-base font-bold text-gray-800">Generación</h2>
          <span class="text-xs text-gray-500 hidden sm:inline">· Compara la energía generada por proyecto</span>
        </div>
        <div class="flex items-center gap-2 ml-auto">
          <Button label="Excel" size="small" severity="success" outlined :disabled="!datasets.length" @click="exportarExcel">
            <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
          </Button>
          <Button size="small" outlined :loading="loading" @click="cargar" v-tooltip.bottom="'Actualizar'">
            <template #icon><RefreshCwIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>

      <!-- Filter row -->
      <div class="gen-filterbar">
        <!-- 1) Granularidad -->
        <div class="gen-segmented">
          <button v-for="g in GRANULARIDADES" :key="g.key"
            class="gen-seg-btn"
            :class="{ 'gen-seg-btn--active': granularidad === g.key }"
            @click="onGranularidadChange(g.key)">
            <component :is="g.icon" class="size-[1em]" />
            <span>{{ g.label }}</span>
          </button>
        </div>

        <!-- 2) Modo (cambia según granularidad: presets + intervalo) -->
        <div class="gen-segmented gen-segmented--modo">
          <button v-for="m in modosActuales" :key="m.key"
            class="gen-seg-btn"
            :class="{ 'gen-seg-btn--active': modo === m.key }"
            @click="onModoChange(m.key)">
            {{ m.label }}
          </button>
        </div>

        <!-- 3) Selector contextual según granularidad + modo -->
        <!-- Mensual · Año específico -->
        <Select v-if="granularidad === 'mensual' && modo === 'anio'"
          v-model="anioSel" :options="aniosDisponibles" optionLabel="label" optionValue="value"
          class="w-28" size="small" @update:modelValue="aplicarModo" />
        <!-- Mensual · Intervalo de meses (un solo picker de rango) -->
        <DatePicker v-else-if="granularidad === 'mensual' && modo === 'intervalo'"
          v-model="rango" selectionMode="range" view="month" dateFormat="mm/yy" :manualInput="false"
          :showIcon="true" size="small" class="w-56" :maxDate="hoy"
          placeholder="Mes inicial → final" @update:modelValue="aplicarModo" />
        <!-- Diaria · Mes específico -->
        <DatePicker v-else-if="granularidad === 'diaria' && modo === 'mes'"
          v-model="mesSel" view="month" dateFormat="MM yy" :manualInput="false"
          :showIcon="true" size="small" class="w-44" :maxDate="hoy"
          placeholder="Elige un mes" @update:modelValue="aplicarModo" />
        <!-- Diaria · Intervalo de días (UN solo picker de rango) -->
        <DatePicker v-else-if="granularidad === 'diaria' && modo === 'intervalo'"
          v-model="rango" selectionMode="range" :numberOfMonths="2" dateFormat="dd/mm/yy" :manualInput="false"
          :showIcon="true" size="small" class="w-64" :maxDate="hoy"
          placeholder="Día inicial → final" @update:modelValue="aplicarModo" />
        <!-- Horaria · Día específico -->
        <DatePicker v-else-if="granularidad === 'horaria' && modo === 'dia'"
          v-model="diaSel" dateFormat="dd/mm/yy" :manualInput="false"
          :showIcon="true" size="small" class="w-44" :maxDate="hoy"
          placeholder="Elige un día" @update:modelValue="aplicarModo" />
        <!-- Horaria · Intervalo de días (UN solo picker de rango) -->
        <DatePicker v-else-if="granularidad === 'horaria' && modo === 'intervalo'"
          v-model="rango" selectionMode="range" :numberOfMonths="2" dateFormat="dd/mm/yy" :manualInput="false"
          :showIcon="true" size="small" class="w-64" :maxDate="hoy"
          placeholder="Día inicial → final" @update:modelValue="aplicarModo" />

        <!-- Etiqueta del rango resuelto -->
        <span class="gen-range-label"><CalendarClockIcon class="size-[1em]" /> {{ rangoLabel }}</span>

        <!-- Avisos -->
        <span v-if="rangoError && rangoError !== 'Selecciona un rango'" class="gen-err">
          <CircleAlertIcon class="size-[1em]" /> {{ rangoError }}
        </span>
        <span v-else-if="avisoRango" class="gen-aviso">
          <InfoIcon class="size-[1em]" /> {{ avisoRango }}
        </span>

        <!-- Project multi-select (valor = sub_project = ID de API Unergy) -->
        <div class="gen-project-picker">
          <MultiSelect v-model="proyectosSel" :options="proyectos" optionLabel="nombre_comercial"
            optionValue="sub_project" :filter="true" :showToggleAll="false"
            display="chip" placeholder="Selecciona proyectos…"
            :maxSelectedLabels="3" :selectedItemsLabel="`{0} proyectos seleccionados`"
            class="w-full" size="small" @change="onProyectosChange">
            <template #option="{ option }">
              <div class="flex items-center justify-between gap-2 w-full">
                <span>{{ option.nombre_comercial }}</span>
                <span class="text-[10px] text-gray-400 whitespace-nowrap">{{ option.municipio }}</span>
              </div>
            </template>
          </MultiSelect>
        </div>

        <!-- Consultar (dispara la query del intervalo seleccionado) -->
        <Button label="Consultar" size="small" class="gen-consultar" :class="{ 'gen-consultar--pendiente': pendiente && proyectosSel.length && !rangoError }" :disabled="!proyectosSel.length || !!rangoError" :loading="loading" @click="cargar" v-tooltip.bottom="!proyectosSel.length ? 'Selecciona al menos un proyecto' : (rangoError ? 'Corrige el rango de fechas' : 'Consultar generación')">
          <template #icon><SearchIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <!-- Fuente de datos -->
      <div v-if="proyectos.length" class="gen-datahint">
        <ZapIcon class="size-[1em]" />
        <span>{{ proyectos.length }} proyectos disponibles · generación en vivo desde la API de Unergy</span>
      </div>

    </div><!-- /sticky-header -->

    <!-- ══ EMPTY STATE / GUIDE ════════════════════════════════════════ -->
    <div v-if="!proyectosSel.length" class="gen-empty">
      <InfoIcon class="text-3xl mb-3 size-[1em]" style="color:var(--color-unergy-purple)" />
      <p class="text-base font-semibold text-gray-700">Selecciona uno o más proyectos para comenzar</p>
      <p class="text-sm text-gray-500 mt-1">Elige proyectos y un rango, luego presiona <strong>Consultar</strong>.</p>
    </div>

    <!-- ══ LOADING ════════════════════════════════════════════════════ -->
    <div v-else-if="loading" class="gen-loading">
      <ProgressSpinner style="width:40px;height:40px" />
      <p class="text-sm text-gray-500 mt-3">Cargando datos de generación…</p>
    </div>

    <!-- ══ ERROR ═════════════════════════════════════════════════════ -->
    <div v-else-if="error" class="gen-error">
      <CircleAlertIcon class="text-2xl text-red-500 size-[1em]" />
      <div class="flex-1">
        <p class="font-semibold text-red-700">No se pudo consultar la generación</p>
        <p class="text-sm text-gray-600 mt-0.5">{{ error }}</p>
      </div>
      <Button label="Reintentar" outlined size="small" @click="cargar">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- ══ READY TO QUERY (proyectos elegidos, aún sin consultar) ═════ -->
    <div v-else-if="!hasQueried" class="gen-empty">
      <SearchIcon class="text-3xl mb-3 size-[1em]" style="color:var(--color-unergy-purple)" />
      <p class="text-base font-semibold text-gray-700">Listo para consultar</p>
      <p class="text-sm text-gray-500 mt-1">Ajusta el rango y la granularidad, luego presiona Consultar.</p>
      <Button label="Consultar" size="small" class="mt-3" :disabled="!!rangoError" :loading="loading" @click="cargar">
        <template #icon><SearchIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- ══ NO DATA ═══════════════════════════════════════════════════ -->
    <div v-else-if="!datasets.length || datasets.every(d => !d.points.length)" class="gen-empty">
      <DatabaseIcon class="text-3xl mb-3 text-gray-300 size-[1em]" />
      <p class="text-base font-semibold text-gray-700">Sin datos para el rango seleccionado</p>
      <p class="text-sm text-gray-500 mt-1">Los proyectos seleccionados no tienen generación registrada en este intervalo. Prueba con un rango más amplio o fechas anteriores.</p>
      <Button label="Ver el año en curso (mensual)" outlined size="small" class="mt-3" @click="verEsteAnioMensual">
        <template #icon><CalendarIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <!-- ══ MAIN CONTENT ══════════════════════════════════════════════ -->
    <template v-else>

      <!-- KPI cards -->
      <div class="gen-kpis">
        <div class="gen-kpi">
          <div class="gen-kpi-icon" style="background:rgba(212,160,23,0.12); color:#D4A017"><ZapIcon class="size-[1em]" /></div>
          <div>
            <div class="gen-kpi-val">{{ fmtNum(totalKwh) }}</div>
            <div class="gen-kpi-lbl">kWh totales</div>
          </div>
        </div>
        <div class="gen-kpi">
          <div class="gen-kpi-icon" style="background:rgba(145,91,216,0.12); color:var(--color-unergy-purple)"><ChartColumnIcon class="size-[1em]" /></div>
          <div>
            <div class="gen-kpi-val">{{ fmtNum(totalKwh / Math.max(1, datasets.length) / Math.max(1, periodos.length), 1) }}</div>
            <div class="gen-kpi-lbl">Promedio kWh / {{ unidadPeriodo }}</div>
          </div>
        </div>
        <div class="gen-kpi">
          <div class="gen-kpi-icon" style="background:rgba(16,185,129,0.12); color:#10b981"><TrophyIcon class="size-[1em]" /></div>
          <div>
            <div class="gen-kpi-val text-sm">{{ topProyecto?.nombre || '—' }}</div>
            <div class="gen-kpi-lbl">Mayor generación</div>
          </div>
        </div>
        <div class="gen-kpi">
          <div class="gen-kpi-icon" style="background:rgba(59,130,246,0.12); color:#3b82f6"><CalendarIcon class="size-[1em]" /></div>
          <div>
            <div class="gen-kpi-val text-sm">{{ periodos.length }} {{ unidadPeriodoPlural }}</div>
            <div class="gen-kpi-lbl">Período cubierto</div>
          </div>
        </div>
      </div>

      <!-- Chart card -->
      <section class="gen-card">
        <header class="gen-card-head">
          <ChartLineIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
          <h3 class="gen-card-title">{{ tituloGrafico }}</h3>
          <div class="flex items-center gap-2 ml-auto">
            <button v-for="t in ['line', 'bar']" :key="t"
              class="gen-toggle-btn" :class="{ 'gen-toggle-btn--active': tipoGrafico === t }"
              @click="tipoGrafico = t">
              <ChartLineIcon v-if="t === 'line'" class="size-[1em]" />
              <ChartColumnIcon v-else class="size-[1em]" />
            </button>
          </div>
        </header>

        <!-- Legend -->
        <div class="gen-legend">
          <button v-for="(ds, idx) in datasets" :key="ds.proyectoId"
            class="gen-legend-item" :class="{ 'gen-legend-item--off': ds.hidden }"
            @click="ds.hidden = !ds.hidden">
            <span class="gen-legend-dot" :style="{ background: ds.color }" />
            <span class="gen-legend-name">{{ ds.nombre }}</span>
            <span class="gen-legend-total">{{ fmtNum(ds.total) }} kWh</span>
          </button>
        </div>

        <!-- SVG chart -->
        <div class="gen-chart-wrap" ref="chartWrapRef">
          <svg ref="chartSvgRef" :viewBox="`0 0 ${chartW} ${chartH}`" preserveAspectRatio="none" class="gen-chart-svg"
            @mousemove="onChartMove" @mouseleave="onChartLeave">
            <!-- Y grid lines + labels -->
            <g class="gen-grid">
              <template v-for="(y, i) in yTicks" :key="'y' + i">
                <line :x1="paddingL" :x2="chartW - paddingR" :y1="yToPx(y)" :y2="yToPx(y)" />
                <text :x="paddingL - 6" :y="yToPx(y) + 3.5">{{ fmtYTick(y) }}</text>
              </template>
            </g>
            <!-- X labels -->
            <g class="gen-xlabels">
              <text v-for="(p, i) in xLabels" :key="'x' + i"
                :x="xToPx(p.idx)" :y="chartH - paddingB / 2 + 4"
                :text-anchor="i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'">
                {{ p.label }}
              </text>
            </g>
            <!-- Line series -->
            <template v-if="tipoGrafico === 'line'">
              <g v-for="ds in datasets.filter(d => !d.hidden)" :key="ds.proyectoId">
                <polyline
                  :points="lineaPoints(ds)" fill="none"
                  :stroke="ds.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
                <circle v-for="(pt, i) in ds.points" :key="i"
                  :cx="xToPx(i)" :cy="yToPx(pt.kwh)" r="2.5" :fill="ds.color" />
              </g>
            </template>
            <!-- Bar series -->
            <template v-else>
              <g v-for="(p, i) in periodos" :key="'b' + i">
                <rect v-for="(ds, j) in datasets.filter(d => !d.hidden)" :key="ds.proyectoId"
                  :x="barX(i, j, datasets.filter(d => !d.hidden).length)"
                  :y="yToPx(ds.points[i]?.kwh ?? 0)"
                  :width="barW(datasets.filter(d => !d.hidden).length)"
                  :height="Math.max(0, chartH - paddingB - yToPx(ds.points[i]?.kwh ?? 0))"
                  :fill="ds.color"
                  rx="1.5" />
              </g>
            </template>

            <!-- Fallas con impacto en generación: subrayado rojo del día/período -->
            <g v-if="periodosFlagged.length" class="gen-faults" pointer-events="none">
              <template v-for="i in periodosFlagged" :key="'fl' + i">
                <line :x1="xToPx(i)" :x2="xToPx(i)" :y1="paddingT" :y2="chartH - paddingB"
                  class="gen-fault-vline" />
                <line :x1="xToPx(i) - marcadorHalfW" :x2="xToPx(i) + marcadorHalfW"
                  :y1="chartH - paddingB + 2.5" :y2="chartH - paddingB + 2.5"
                  class="gen-fault-underline" />
                <circle :cx="xToPx(i)" :cy="paddingT + 2" r="2.6" class="gen-fault-dot" />
              </template>
            </g>

            <!-- Hover: línea guía vertical + puntos resaltados -->
            <g v-if="hover" class="gen-hover" pointer-events="none">
              <line :x1="hover.gx" :x2="hover.gx" :y1="paddingT" :y2="chartH - paddingB" class="gen-hover-line" />
              <circle v-for="s in hoverSeries" :key="'h' + s.proyectoId"
                :cx="hover.gx" :cy="yToPx(s.kwh)" r="4" :fill="s.color" stroke="#fff" stroke-width="1.5" />
            </g>
          </svg>

          <!-- Tooltip: valor de X (período) y de Y (kWh) bajo el cursor -->
          <div v-if="hover" class="gen-tooltip" :class="{ 'gen-tooltip--flip': hover.flip }"
            :style="{ left: hover.tipLeft + 'px', top: hover.tipTop + 'px' }">
            <div class="gen-tooltip-x">{{ hover.label }}</div>
            <div v-for="s in hoverSeries" :key="'t' + s.proyectoId" class="gen-tooltip-row">
              <span class="gen-tooltip-dot" :style="{ background: s.color }" />
              <span class="gen-tooltip-name">{{ s.nombre }}</span>
              <span class="gen-tooltip-val">{{ fmtNum(s.kwh, 1) }} kWh</span>
            </div>
            <div v-if="hoverSeries.length > 1" class="gen-tooltip-row gen-tooltip-total">
              <span class="gen-tooltip-name">Total</span>
              <span class="gen-tooltip-val">{{ fmtNum(hoverTotal, 1) }} kWh</span>
            </div>
            <div v-if="hoverFalla" class="gen-tooltip-fault">
              <TriangleAlertIcon class="size-[1em]" />
              {{ hoverFalla.count }} falla{{ hoverFalla.count !== 1 ? 's' : '' }} de generación · {{ fmtNum(hoverFalla.kwh) }} kWh perdidos
            </div>
          </div>
        </div>
      </section>

      <!-- Fallas reportadas en el período (cruce con generación) -->
      <section class="gen-card">
        <header class="gen-card-head">
          <TriangleAlertIcon class="text-sm size-[1em]" style="color:#dc2626" />
          <h3 class="gen-card-title">Fallas reportadas en el período</h3>
          <div class="ml-auto flex items-center gap-1.5 flex-wrap">
            <span class="gen-fchip">{{ fallasDelPeriodo.length }} en total</span>
            <span v-if="fallasGenCount" class="gen-fchip gen-fchip--red">{{ fallasGenCount }} afectan generación</span>
            <span v-if="kwhPerdidoTotal > 0" class="gen-fchip gen-fchip--red">
              {{ fmtNum(kwhPerdidoTotal) }} kWh perdidos
            </span>
          </div>
        </header>

        <div v-if="fallasCargando && !allFallas.length" class="gen-fallas-empty">
          <ProgressSpinner style="width:28px;height:28px" />
          <p>Cargando fallas…</p>
        </div>
        <div v-else-if="!fallasDelPeriodo.length" class="gen-fallas-empty">
          <CircleCheckIcon class="text-2xl size-[1em]" style="color:#16a34a" />
          <p>Sin fallas reportadas en este intervalo para los proyectos seleccionados.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <DataTable :value="fallasDelPeriodo" stripedRows rowHover class="text-sm gen-table"
            :rows="10" paginator :rowsPerPageOptions="[10, 20, 50]" :alwaysShowPaginator="fallasDelPeriodo.length > 10"
            :rowClass="fallaRowClass" selectionMode="single"
            @row-click="(e) => router.push('/fallas/' + e.data.id)">
            <Column header="" style="width:6px;padding:0" :pt="{ headerCell: { style: 'padding:0; border:none' } }">
              <template #body="{ data }">
                <div class="gen-falla-stripe" :class="{ 'gen-falla-stripe--gen': involucraGeneracion(data) }" />
              </template>
            </Column>
            <Column header="Fecha" field="fecha_identificacion" sortable style="width:96px">
              <template #body="{ data }">
                <span class="font-medium text-gray-800">{{ fmtFechaCorta(data.fecha_identificacion) }}</span>
              </template>
            </Column>
            <Column header="Proyecto" style="min-width:130px">
              <template #body="{ data }"><span class="text-gray-700">{{ data.proyecto?.nombre_comercial || '—' }}</span></template>
            </Column>
            <Column header="Falla" style="min-width:240px">
              <template #body="{ data }">
                <div class="font-medium text-gray-800">{{ data.tipo?.etiqueta || 'Sin tipo' }}</div>
                <div class="text-xs text-gray-500 gen-falla-desc">{{ data.descripcion }}</div>
              </template>
            </Column>
            <Column header="Prioridad" style="width:96px">
              <template #body="{ data }">
                <span class="gen-prio-pill" :style="prioPillStyle(data.prioridad?.codigo)">{{ data.prioridad?.etiqueta || '—' }}</span>
              </template>
            </Column>
            <Column header="Estado" style="width:120px">
              <template #body="{ data }">
                <GBadge :color="colorEstado(data.estado?.codigo)">{{ data.estado?.etiqueta || '—' }}</GBadge>
              </template>
            </Column>
            <Column header="Energía perdida" style="width:140px">
              <template #body="{ data }">
                <span v-if="involucraGeneracion(data)" class="gen-energy-badge">
                  <ZapIcon class="size-[1em]" /> {{ fmtNum(energiaPerdida(data)) }} kWh
                </span>
                <span v-else class="text-gray-300">—</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </section>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressSpinner from 'primevue/progressspinner'
import { useRouter } from 'vue-router'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { FallasService } from '~/features/fallas/services/fallas'
import { CalendarClockIcon, CalendarIcon, ChartColumnIcon, ChartLineIcon, CircleAlertIcon, CircleCheckIcon, ClockIcon, DatabaseIcon, FileSpreadsheetIcon, InfoIcon, ListIcon, RefreshCwIcon, SearchIcon, TriangleAlertIcon, TrophyIcon, ZapIcon } from '@lucide/vue'

const router = useRouter()
const monitoreoLegacyService = new MonitoreoLegacyService()
const fallasService = new FallasService()

// ── Constantes ────────────────────────────────────────────────────────
const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const PALETTE = ['#915BD8', '#2563eb', '#10b981', '#D4A017', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#65a30d', '#0d9488']

const GRANULARIDADES = [
  { key: 'mensual', label: 'Mensual', icon: CalendarIcon },
  { key: 'diaria',  label: 'Diaria',  icon: ListIcon },
  { key: 'horaria', label: 'Horaria', icon: ClockIcon },
]

// Modos de selección por granularidad: presets rápidos + intervalo libre.
// La unidad natural de cada granularidad: año (mensual), mes (diaria), día (horaria).
const MODOS = {
  mensual: [
    { key: 'actual',    label: 'Este año' },
    { key: 'pasado',    label: 'Año pasado' },
    { key: 'anio',      label: 'Año…' },
    { key: 'intervalo', label: 'Intervalo' },
  ],
  diaria: [
    { key: 'actual',    label: 'Este mes' },
    { key: 'mes',       label: 'Mes…' },
    { key: 'intervalo', label: 'Intervalo' },
  ],
  horaria: [
    { key: 'ayer',      label: 'Ayer' },
    { key: 'dia',       label: 'Día…' },
    { key: 'intervalo', label: 'Intervalo' },
  ],
}
const MODO_DEFAULT = { mensual: 'actual', diaria: 'actual', horaria: 'ayer' }

const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

// ── Estado ───────────────────────────────────────────────────────────
const loading = ref(false)
const error = ref(null)
const proyectos = ref([])
const proyectosSel = ref([])

const granularidad = ref('diaria')
const modo = ref('actual')
const fechaDesde = ref(new Date())
const fechaHasta = ref(new Date())
// Selectores específicos por modo:
const anioSel = ref(new Date().getFullYear())  // mensual · "Año…"
const mesSel = ref(new Date())                  // diaria  · "Mes…"  (cualquier día del mes)
const diaSel = ref(new Date())                  // horaria · "Día…"
const rango = ref(null)                         // modo intervalo: UN solo picker de rango [desde, hasta]

const datasets = ref([])
const tipoGrafico = ref('line')
const chartWrapRef = ref(null)
const chartSvgRef = ref(null)
const chartContainerWidth = ref(900)

// Hover sobre la gráfica: período (X) + valor kWh (Y) de cada serie bajo el cursor.
const hover = ref(null)  // { idx, gx, tipLeft, tipTop, flip, label } | null

// Consulta manual: hasQueried distingue "aún no consultado" de "sin datos";
// pendiente resalta el botón Consultar cuando hay cambios sin aplicar.
const hasQueried = ref(false)
const pendiente = ref(false)

// Mapa sub_project → nombre comercial (para etiquetar cada serie).
const nombrePorSub = computed(() => {
  const m = {}
  for (const p of proyectos.value) if (p.sub_project) m[p.sub_project] = p.nombre_comercial
  return m
})

// ── Fallas del período (correlación generación ↔ incidencias) ─────────
const allFallas = ref([])
const fallasCargando = ref(false)
// Snapshot del rango/proyectos consultados, para que el panel de fallas coincida
// con lo que MUESTRA la gráfica (no con filtros aún sin aplicar).
const qDesde = ref(null)
const qHasta = ref(null)
const qNombres = ref([])  // nombres_comerciales consultados

// ── Modo de selección + cálculo de fechas ─────────────────────────────
const modosActuales = computed(() => MODOS[granularidad.value] || [])

const aniosDisponibles = computed(() => {
  const y = new Date().getFullYear()
  const arr = []
  for (let a = y; a >= 2019; a--) arr.push({ label: String(a), value: a })
  return arr
})

function finDeAnioOHoy(y) {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const last = new Date(y, 11, 31)
  return last > t ? t : last
}
function finDeMesOHoy(y, m) { // m 0-based
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const last = new Date(y, m + 1, 0)
  return last > t ? t : last
}

// Rango del picker único (modo intervalo) para día/hora → [desde, hasta] normalizado.
function rangoDiasSel() {
  const r = rango.value || []
  const a = r[0] ? new Date(r[0]) : new Date(fechaDesde.value)
  const b = r[1] ? new Date(r[1]) : new Date(r[0] || fechaHasta.value)
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0)
  return b < a ? [b, a] : [a, b]
}
// Rango del picker único (modo intervalo mensual) → límites de mes.
function rangoMesesSel() {
  const r = rango.value || []
  const a0 = r[0] ? new Date(r[0]) : new Date(fechaDesde.value)
  const b0 = r[1] ? new Date(r[1]) : new Date(r[0] || fechaHasta.value)
  let a = new Date(a0.getFullYear(), a0.getMonth(), 1)
  let b = finDeMesOHoy(b0.getFullYear(), b0.getMonth())
  return b < a ? [new Date(b0.getFullYear(), b0.getMonth(), 1), finDeMesOHoy(a0.getFullYear(), a0.getMonth())] : [a, b]
}

// Calcula fechaDesde/fechaHasta a partir de {granularidad, modo, selectores}.
function recomputarFechas() {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const y = t.getFullYear()
  let d = null, h = null
  if (granularidad.value === 'mensual') {
    if (modo.value === 'actual') { d = new Date(y, 0, 1); h = finDeAnioOHoy(y) }
    else if (modo.value === 'pasado') { d = new Date(y - 1, 0, 1); h = new Date(y - 1, 11, 31) }
    else if (modo.value === 'anio') { const yy = anioSel.value || y; d = new Date(yy, 0, 1); h = finDeAnioOHoy(yy) }
    else { [d, h] = rangoMesesSel() }
  } else if (granularidad.value === 'diaria') {
    if (modo.value === 'actual') { d = new Date(y, t.getMonth(), 1); h = new Date(t) }
    else if (modo.value === 'mes') { const m = mesSel.value || t; d = new Date(m.getFullYear(), m.getMonth(), 1); h = finDeMesOHoy(m.getFullYear(), m.getMonth()) }
    else { [d, h] = rangoDiasSel() }
  } else { // horaria
    if (modo.value === 'ayer') { const ay = new Date(t); ay.setDate(ay.getDate() - 1); d = ay; h = new Date(ay) }
    else if (modo.value === 'dia') { const dd = new Date(diaSel.value || t); dd.setHours(0, 0, 0, 0); d = dd; h = new Date(dd) }
    else { [d, h] = rangoDiasSel() }
  }
  if (d) fechaDesde.value = d
  if (h) fechaHasta.value = h
}

function aplicarModo() { recomputarFechas(); marcarPendiente() }

function onGranularidadChange(g) {
  if (g === granularidad.value) return
  granularidad.value = g
  modo.value = MODO_DEFAULT[g]
  recomputarFechas()
  marcarPendiente()
}

function onModoChange(m) {
  if (m === modo.value) return
  modo.value = m
  // Al entrar a "intervalo", precarga el picker de rango con el rango vigente.
  if (m === 'intervalo') rango.value = [new Date(fechaDesde.value), new Date(fechaHasta.value)]
  recomputarFechas()
  marcarPendiente()
}

// Atajo desde el estado "sin datos": vista mensual del año en curso.
function verEsteAnioMensual() {
  granularidad.value = 'mensual'
  modo.value = 'actual'
  recomputarFechas()
  cargar()
}

// Marca que hay filtros sin aplicar (resalta el botón Consultar).
function marcarPendiente() { pendiente.value = true }

// Cambio en la selección de proyectos: si se vacía, limpia resultados.
function onProyectosChange() {
  pendiente.value = true
  if (!proyectosSel.value.length) {
    datasets.value = []
    hasQueried.value = false
    error.value = null
  }
}

// ── Validación (sin límites de tamaño: sólo coherencia) ───────────────
const rangoDias = computed(() => {
  if (!fechaDesde.value || !fechaHasta.value) return 0
  return Math.max(0, Math.ceil((fechaHasta.value - fechaDesde.value) / 86400000) + 1)
})
const rangoError = computed(() => {
  if (!fechaDesde.value || !fechaHasta.value) return 'Selecciona un rango'
  if (fechaHasta.value < fechaDesde.value) return 'La fecha final debe ser igual o posterior a la inicial'
  return null
})
// Aviso NO bloqueante (rango horario muy amplio puede truncarse en la API).
const avisoRango = computed(() =>
  granularidad.value === 'horaria' && rangoDias.value > 31
    ? 'Rango horario amplio: la API puede truncar lecturas muy extensas.'
    : null
)

// Etiqueta legible del rango resuelto (feedback claro de qué se va a consultar).
const rangoLabel = computed(() => {
  const d = fechaDesde.value, h = fechaHasta.value
  if (!d || !h) return ''
  if (granularidad.value === 'mensual')
    return `${MESES_ES[d.getMonth()]} ${d.getFullYear()} → ${MESES_ES[h.getMonth()]} ${h.getFullYear()}`
  const f = x => `${String(x.getDate()).padStart(2, '0')} ${MESES_ES[x.getMonth()].toLowerCase()} ${x.getFullYear()}`
  if (d.getTime() === h.getTime()) return f(d)
  return `${f(d)} → ${f(h)}`
})

// ── Período label helper ─────────────────────────────────────────────
const unidadPeriodo = computed(() => ({ mensual: 'mes', diaria: 'día', horaria: 'hora' }[granularidad.value]))
const unidadPeriodoPlural = computed(() => ({ mensual: 'meses', diaria: 'días', horaria: 'horas' }[granularidad.value]))

// ── Carga (datos EN VIVO de la API de Unergy vía /monitoreo/_legacy) ──────
// La generación NO vive en la tabla local; se consulta a api.unergy.io con el
// sub_project de cada proyecto (misma fuente que usa el resto de la plataforma).
async function cargar() {
  if (!proyectosSel.value.length || rangoError.value) return
  loading.value = true
  error.value = null
  pendiente.value = false
  hasQueried.value = true
  // Snapshot del query → el panel de fallas se alinea con lo que muestra la gráfica.
  qDesde.value = new Date(fechaDesde.value)
  qHasta.value = new Date(fechaHasta.value)
  qNombres.value = proyectosSel.value.map(sub => nombrePorSub.value[sub]).filter(Boolean)
  try {
    const fInicio = isoDate(fechaDesde.value)
    const fFin = isoDate(fechaHasta.value)

    // Una llamada por proyecto: getGeneration trae lecturas en vivo de Unergy.
    // Endpoint real: /api/v1/monitoreo/_legacy (baseURL del cliente ya es /api/v1).
    const results = await Promise.allSettled(
      proyectosSel.value.map(sub =>
        monitoreoLegacyService
          .obtenerGeneracion({ sub_project: sub, date_from: fInicio, date_to: fFin })
          .then(body => ({ sub, body }))
      )
    )

    const parsed = []
    const errores = []
    results.forEach((r, idx) => {
      const sub = proyectosSel.value[idx]
      const nombre = nombrePorSub.value[sub] || sub
      if (r.status !== 'fulfilled') {
        const reason = r.reason
        const msg = reason?.data?.detail || reason?.message || 'error de conexión'
        errores.push(`${nombre}: ${msg}`)
        return
      }
      const body = r.value.body
      if (body && body.ok === false) {
        errores.push(`${nombre}: ${body.error || 'la API de Unergy no devolvió datos'}`)
        return
      }
      const raw = Array.isArray(body?.data) ? body.data : []
      parsed.push({ sub, nombre, map: sumarPorGranularidad(raw) })
    })

    // Si TODAS fallaron, es un fallo real: mostrarlo (no "sin datos").
    if (!parsed.length && errores.length) {
      error.value = errores.length === 1
        ? errores[0]
        : `No se pudo consultar ningún proyecto. ${errores[0]}`
      datasets.value = []
      return
    }
    if (errores.length) {
      toast.warning('Algunos proyectos no cargaron', { description: errores.join(' · '), duration: 6000 })
    }

    // Eje común continuo → todas las series quedan alineadas en chart y tabla.
    const keys = construirEjeKeys()
    const ds = parsed.map((p, idx) => {
      const points = keys.map(k => ({ key: k, kwh: p.map.get(k) ?? 0, label: labelDeClave(k) }))
      const total = points.reduce((s, pt) => s + pt.kwh, 0)
      return { proyectoId: p.sub, nombre: p.nombre, color: PALETTE[idx % PALETTE.length], points, total, hidden: false }
    })
    ds.sort((a, b) => b.total - a.total)
    datasets.value = ds
  } catch (e) {
    error.value = e.data?.detail || e.message || 'Error de conexión'
  } finally {
    loading.value = false
  }
}

// ── Agregación por granularidad ───────────────────────────────────────
// raw: [{ time: 'YYYY-MM-DD HH:MM', date: 'YYYY-MM-DD', kwh: number }] (deltas por intervalo)
function sumarPorGranularidad(raw) {
  const map = new Map()
  for (const it of raw) {
    if (it == null || it.kwh == null) continue
    let k = null
    if (granularidad.value === 'diaria') k = it.date
    else if (granularidad.value === 'mensual') k = (it.date || '').slice(0, 7)
    else {
      // horaria: agrupa por hora real usando el timestamp de la lectura
      const t = it.time || ''
      k = t.length >= 13 ? `${t.slice(0, 10)} ${t.slice(11, 13)}:00` : (it.date ? `${it.date} 00:00` : null)
    }
    if (!k) continue
    map.set(k, (map.get(k) || 0) + Number(it.kwh))
  }
  return map
}

// Eje continuo de períodos en el rango seleccionado (alinea todas las series).
function construirEjeKeys() {
  const keys = []
  if (!fechaDesde.value || !fechaHasta.value) return keys
  const start = new Date(fechaDesde.value); start.setHours(0, 0, 0, 0)
  const end = new Date(fechaHasta.value); end.setHours(0, 0, 0, 0)
  if (granularidad.value === 'diaria') {
    const cur = new Date(start)
    while (cur <= end) { keys.push(isoDate(cur)); cur.setDate(cur.getDate() + 1) }
  } else if (granularidad.value === 'mensual') {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= last) { keys.push(isoDate(cur).slice(0, 7)); cur.setMonth(cur.getMonth() + 1) }
  } else {
    const cur = new Date(start)
    const endH = new Date(end); endH.setHours(23, 0, 0, 0)
    while (cur <= endH) {
      keys.push(`${isoDate(cur)} ${String(cur.getHours()).padStart(2, '0')}:00`)
      cur.setHours(cur.getHours() + 1)
    }
  }
  return keys
}

function labelDeClave(k) {
  if (granularidad.value === 'mensual') return mesLabel(k)
  if (granularidad.value === 'horaria') return `${k.slice(8, 10)}/${k.slice(5, 7)} ${k.slice(11)}`
  return diaLabel(k)
}

function mesLabel(yyyymm) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_ES[+m - 1]} ${y.slice(2)}`
}

function diaLabel(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}/${m}`
}

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Período + chart data ─────────────────────────────────────────────
const periodos = computed(() => datasets.value[0]?.points || [])

const totalKwh = computed(() =>
  datasets.value.reduce((s, d) => s + (d.hidden ? 0 : d.total), 0)
)

const topProyecto = computed(() => {
  const sorted = [...datasets.value].filter(d => !d.hidden).sort((a, b) => b.total - a.total)
  return sorted[0] || null
})

const tituloGrafico = computed(() => {
  if (!datasets.value.length) return 'Sin datos'
  const d1 = isoDate(fechaDesde.value)
  const d2 = isoDate(fechaHasta.value)
  return `Generación ${granularidad.value === 'mensual' ? 'mensual' : granularidad.value === 'diaria' ? 'diaria' : 'horaria'} · ${d1} → ${d2}`
})

// ── Chart geometry (SVG) ─────────────────────────────────────────────
const paddingL = 50
const paddingR = 20
const paddingT = 16
const paddingB = 30
const chartH = 280
const chartW = computed(() => chartContainerWidth.value)

const maxY = computed(() => {
  let max = 0
  datasets.value.forEach(d => {
    if (d.hidden) return
    d.points.forEach(p => { if (p.kwh > max) max = p.kwh })
  })
  return max > 0 ? max * 1.08 : 10
})

const yTicks = computed(() => {
  const max = maxY.value
  const step = max / 4
  return [0, step, step * 2, step * 3, max]
})

function yToPx(y) {
  if (maxY.value === 0) return chartH - paddingB
  return paddingT + (1 - y / maxY.value) * (chartH - paddingT - paddingB)
}

function xToPx(idx) {
  const n = periodos.value.length
  if (n <= 1) return paddingL
  return paddingL + (idx / (n - 1)) * (chartW.value - paddingL - paddingR)
}

function lineaPoints(ds) {
  return ds.points.map((p, i) => `${xToPx(i)},${yToPx(p.kwh)}`).join(' ')
}

function barX(periodIdx, dsIdx, dsCount) {
  const slotW = (chartW.value - paddingL - paddingR) / Math.max(1, periodos.value.length)
  const innerW = slotW * 0.7
  const barWidth = innerW / Math.max(1, dsCount)
  return paddingL + slotW * periodIdx + (slotW - innerW) / 2 + barWidth * dsIdx
}
function barW(dsCount) {
  const slotW = (chartW.value - paddingL - paddingR) / Math.max(1, periodos.value.length)
  return (slotW * 0.7) / Math.max(1, dsCount)
}

const xLabels = computed(() => {
  const n = periodos.value.length
  if (n === 0) return []
  // Show max ~8 labels evenly distributed
  const stride = Math.max(1, Math.ceil(n / 8))
  const labels = []
  for (let i = 0; i < n; i += stride) {
    labels.push({ idx: i, label: periodos.value[i].label })
  }
  // Always show the last one
  if (labels[labels.length - 1]?.idx !== n - 1) {
    labels.push({ idx: n - 1, label: periodos.value[n - 1].label })
  }
  return labels
})

function fmtYTick(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k'
  return v.toFixed(0)
}

// Separador de miles = espacio (evita confundirlo con la coma decimal), coma decimal.
function fmtNum(v, maxDecimals = 0) {
  return (v ?? 0)
    .toLocaleString('es-CO', { maximumFractionDigits: maxDecimals })
    .replace(/\./g, ' ')
}

// ── Hover (tooltip de valores X/Y) ───────────────────────────────────
// Series visibles con su valor en el período bajo el cursor.
const hoverSeries = computed(() => {
  if (!hover.value) return []
  const i = hover.value.idx
  return datasets.value
    .filter(d => !d.hidden)
    .map(d => ({ proyectoId: d.proyectoId, color: d.color, nombre: d.nombre, kwh: d.points[i]?.kwh ?? 0 }))
})
const hoverTotal = computed(() => hoverSeries.value.reduce((s, d) => s + d.kwh, 0))

function onChartMove(e) {
  const n = periodos.value.length
  if (!n || !chartSvgRef.value) { hover.value = null; return }
  const rect = chartSvgRef.value.getBoundingClientRect()
  if (!rect.width) return
  // mapea pixel del cursor → coordenada X del viewBox (preserveAspectRatio=none ⇒ lineal)
  const userX = (e.clientX - rect.left) / rect.width * chartW.value
  const span = chartW.value - paddingL - paddingR
  let idx = n <= 1 ? 0 : Math.round(((userX - paddingL) / span) * (n - 1))
  idx = Math.max(0, Math.min(n - 1, idx))
  const wrapRect = chartWrapRef.value?.getBoundingClientRect()
  const tipLeft = wrapRect ? e.clientX - wrapRect.left : 0
  const tipTop = wrapRect ? e.clientY - wrapRect.top : 0
  const flip = wrapRect ? tipLeft > wrapRect.width * 0.6 : false
  hover.value = { idx, gx: xToPx(idx), tipLeft, tipTop, flip, label: periodos.value[idx]?.label || '' }
}
function onChartLeave() { hover.value = null }

// ── Fallas del período + correlación con la gráfica ───────────────────
function energiaPerdida(f) {
  const v = f?.kwh_perdidos_estimado
  return v == null ? 0 : Number(v) || 0
}
function involucraGeneracion(f) {
  return energiaPerdida(f) > 0
}

// Fallas de los proyectos consultados dentro del rango consultado (snapshot).
const fallasDelPeriodo = computed(() => {
  if (!qDesde.value || !qHasta.value || !qNombres.value.length) return []
  const nombres = new Set(qNombres.value)
  const desde = isoDate(qDesde.value)
  const hasta = isoDate(qHasta.value)
  return allFallas.value
    .filter(f => {
      const fi = (f.fecha_identificacion || '').slice(0, 10)
      if (!fi || fi < desde || fi > hasta) return false
      return nombres.has(f.proyecto?.nombre_comercial)
    })
    .sort((a, b) => (b.fecha_identificacion || '').localeCompare(a.fecha_identificacion || ''))
})

const fallasGenCount = computed(() => fallasDelPeriodo.value.filter(involucraGeneracion).length)
const kwhPerdidoTotal = computed(() => fallasDelPeriodo.value.reduce((s, f) => s + energiaPerdida(f), 0))

// Días con fallas que impactan generación → para subrayar en rojo.
const faultsByDay = computed(() => {
  const m = {}  // 'YYYY-MM-DD' → { count, kwh }
  for (const f of fallasDelPeriodo.value) {
    if (!involucraGeneracion(f)) continue
    const d = (f.fecha_identificacion || '').slice(0, 10)
    if (!d) continue
    if (!m[d]) m[d] = { count: 0, kwh: 0 }
    m[d].count++; m[d].kwh += energiaPerdida(f)
  }
  return m
})
const flaggedMonths = computed(() => {
  const s = {}
  for (const d in faultsByDay.value) {
    const mk = d.slice(0, 7)
    if (!s[mk]) s[mk] = { count: 0, kwh: 0 }
    s[mk].count += faultsByDay.value[d].count
    s[mk].kwh += faultsByDay.value[d].kwh
  }
  return s
})

// Info de fallas-generación para la clave de un período del eje (según granularidad).
function infoFallaPeriodo(key) {
  if (!key) return null
  if (granularidad.value === 'mensual') return flaggedMonths.value[key] || null
  if (granularidad.value === 'horaria') return faultsByDay.value[key.slice(0, 10)] || null
  return faultsByDay.value[key] || null  // diaria
}

// Índices de períodos marcados (para los subrayados rojos).
const periodosFlagged = computed(() =>
  periodos.value.map((p, i) => (infoFallaPeriodo(p.key) ? i : -1)).filter(i => i >= 0)
)
// Medio ancho del marcador rojo en coordenadas SVG.
const marcadorHalfW = computed(() => {
  const n = periodos.value.length
  if (n <= 1) return 6
  const span = chartW.value - paddingL - paddingR
  return Math.max(3, Math.min(12, (span / (n - 1)) * 0.4))
})
// Info de falla del período bajo el cursor (para el tooltip).
const hoverFalla = computed(() => {
  if (!hover.value) return null
  return infoFallaPeriodo(periodos.value[hover.value.idx]?.key)
})

// Helpers visuales de la tabla de fallas.
function prioPillStyle(codigo) {
  const c = colorPrioridad(codigo, '#9ca3af')
  return { background: c + '18', color: c, border: `1px solid ${c}40` }
}
function fmtFechaCorta(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}
function fallaRowClass(data) {
  return involucraGeneracion(data) ? 'gen-falla-row--gen' : ''
}

// ── Tabla ────────────────────────────────────────────────────────────
const tablaFilas = computed(() => {
  return periodos.value.map((p, i) => {
    const row = { periodo: p.label, total: 0 }
    datasets.value.forEach(ds => {
      const v = ds.points[i]?.kwh
      if (v != null) {
        row[ds.proyectoId] = v
        row.total += v
      }
    })
    return row
  })
})

// ── Export Excel ─────────────────────────────────────────────────────
async function exportarExcel() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen
    const resumen = [
      ['Reporte de Generación'],
      [`Generado: ${new Date().toLocaleString('es-CO')}`],
      [`Granularidad: ${unidadPeriodo.value}`],
      [`Período: ${isoDate(fechaDesde.value)} → ${isoDate(fechaHasta.value)}`],
      [`Proyectos: ${datasets.value.map(d => d.nombre).join(', ')}`],
      [],
      ['Proyecto', 'Total kWh', `Promedio kWh/${unidadPeriodo.value}`],
      ...datasets.value.map(d => [
        d.nombre,
        Number(d.total.toFixed(2)),
        Number((d.total / Math.max(1, d.points.length)).toFixed(2)),
      ]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(resumen)
    ws1['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

    // Hoja 2: Detalle
    const headers = [unidadPeriodo.value, ...datasets.value.map(d => d.nombre), 'Total']
    const rows = tablaFilas.value.map(r => {
      const arr = [r.periodo]
      datasets.value.forEach(ds => arr.push(r[ds.proyectoId] != null ? Number(r[ds.proyectoId].toFixed(2)) : null))
      arr.push(Number(r.total.toFixed(2)))
      return arr
    })
    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws2['!cols'] = [{ wch: 14 }, ...datasets.value.map(() => ({ wch: 18 })), { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle')

    const filename = `generacion_${granularidad.value}_${isoDate(fechaDesde.value)}_${isoDate(fechaHasta.value)}.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success('Excel descargado', { description: filename, duration: 2500 })
  } catch (e) {
    toast.error('Error al exportar', { description: e?.message, duration: 4000 })
  }
}

// ── Carga inicial ────────────────────────────────────────────────────
// Proyectos consultables = los que tienen sub_project (API ID Unergy).
// getProjects ya filtra a proyectos en operación con ID de API y lo entrega.
async function cargarProyectos() {
  try {
    const data = await monitoreoLegacyService.obtenerProyectos()
    const seen = new Set()
    proyectos.value = (data?.projects ?? [])
      .filter(p => {
        if (!p.sub_project || seen.has(p.sub_project)) return false
        seen.add(p.sub_project)
        return true
      })
      .sort((a, b) => (a.nombre_comercial || '').localeCompare(b.nombre_comercial || ''))
  } catch (e) {
    error.value = 'No se pudieron cargar los proyectos'
  }
}

// Carga todas las fallas una vez (se filtran en cliente por proyecto + rango).
async function cargarFallas() {
  fallasCargando.value = true
  try {
    const primera = await fallasService.listar({ page: 1, size: 200 })
    const total = primera.total ?? 0
    const items = [...(primera.items ?? [])]
    if (total > 200) {
      const totalPages = Math.ceil(total / 200)
      const rest = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fallasService.listar({ page: i + 2, size: 200 })
        )
      )
      for (const r of rest) if (r.status === 'fulfilled') items.push(...(r.value.items ?? []))
    }
    allFallas.value = items
  } catch (e) {
    /* no crítico: la gráfica funciona sin el cruce de fallas */
  } finally {
    fallasCargando.value = false
  }
}

// ── ResizeObserver para chart responsive ─────────────────────────────
let resizeObserver
onMounted(async () => {
  recomputarFechas()   // fija el rango inicial según granularidad/modo por defecto
  await cargarProyectos()
  cargarFallas()
  await nextTick()
  if (chartWrapRef.value) {
    const upd = () => { chartContainerWidth.value = chartWrapRef.value?.clientWidth || 900 }
    upd()
    resizeObserver = new ResizeObserver(upd)
    resizeObserver.observe(chartWrapRef.value)
  }
})

watch(chartWrapRef, (el) => {
  if (el && resizeObserver) resizeObserver.observe(el)
})
</script>

<style scoped>
.gen-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Sticky header (title + filters) ───────────────────────────────── */
.gen-sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #f3f4f6;
  padding-top: 4px;
  padding-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* Tapa la franja superior (padding 24px del <main>) por la que el contenido
   se asomaría al hacer scroll. Mismo patrón que Gestión de Fallas. */
.gen-sticky-header::before {
  content: "";
  position: absolute;
  left: -24px;
  right: -24px;
  bottom: 100%;
  height: 28px;
  background: #f3f4f6;
  pointer-events: none;
}

.gen-titlebar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 6px 12px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ece8f4;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
  min-height: 42px;
}

.gen-filterbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ece8f4;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
}

/* Segmented control (granularity) */
.gen-segmented {
  display: inline-flex;
  background: #f3f1f8;
  border-radius: 8px;
  padding: 2px;
}
.gen-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #6b5a8a;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
}
.gen-seg-btn:hover:not(:disabled) { color: var(--color-unergy-deep); }
.gen-seg-btn--active {
  background: #fff;
  color: var(--color-unergy-purple);
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.1);
}
.gen-seg-btn--disabled { opacity: 0.5; cursor: not-allowed; }

/* Segmento de "modo" — tono distinto para diferenciarlo de la granularidad */
.gen-segmented--modo { background: #eef4ff; }
.gen-segmented--modo .gen-seg-btn--active { color: #2563eb; }

/* Etiqueta del rango resuelto */
.gen-range-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: #4a3b6b;
  background: #faf5ff;
  border: 1px solid #e9ddff;
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
}
.gen-range-label svg { font-size: 11px; color: var(--color-unergy-purple); }

/* Aviso no bloqueante */
.gen-aviso {
  font-size: 11.5px;
  color: #b45309;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Validation error */
.gen-err {
  font-size: 11.5px;
  color: #dc2626;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Project picker */
.gen-project-picker { flex: 1; min-width: 240px; }
.gen-project-picker :deep(.p-multiselect) { width: 100%; }

/* Línea de disponibilidad de datos */
.gen-datahint {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 12px;
  font-size: 11.5px;
  color: #6b5a8a;
}
.gen-datahint > svg { font-size: 11px; }
.gen-datahint-btn {
  border: 1px solid #e9ddff;
  background: #faf5ff;
  color: #7c3aed;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.gen-datahint-btn:hover { background: #f1e8ff; }

/* Botón Consultar */
.gen-consultar { flex-shrink: 0; }
/* Resalta cuando hay filtros sin aplicar (pendiente de consultar) */
.gen-consultar--pendiente :deep(.p-button),
.gen-consultar--pendiente.p-button {
  animation: gen-pulse 1.6s ease-in-out infinite;
}
@keyframes gen-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(145, 91, 216, 0.45); }
  50%      { box-shadow: 0 0 0 4px rgba(145, 91, 216, 0.18); }
}

/* Empty / loading / error states */
.gen-empty, .gen-loading, .gen-error {
  background: #fff;
  border: 1px solid #ece8f4;
  border-radius: 12px;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.gen-error {
  flex-direction: row;
  align-items: flex-start;
  text-align: left;
  padding: 18px;
  gap: 14px;
}

/* KPIs */
.gen-kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 768px) {
  .gen-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.gen-kpi {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ece8f4;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
}
.gen-kpi-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.gen-kpi-val { font-size: 20px; font-weight: 800; line-height: 1.1; color: var(--color-unergy-deep); }
.gen-kpi-lbl { font-size: 11.5px; font-weight: 600; color: #6b5a8a; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

/* Card */
.gen-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ece8f4;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
  overflow: hidden;
}
.gen-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #ece8f4;
  background: #faf9fc;
}
.gen-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-unergy-deep);
  margin: 0;
}

/* Chart toggle */
.gen-toggle-btn {
  width: 30px; height: 30px;
  border: 1px solid #ece8f4;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  color: #6b5a8a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.gen-toggle-btn--active { background: var(--color-unergy-purple); color: #fff; border-color: var(--color-unergy-purple); }
.gen-toggle-btn svg { font-size: 12px; }

/* Legend */
.gen-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid #ece8f4;
}
.gen-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #faf9fc;
  border: 1px solid #ece8f4;
  border-radius: 999px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
}
.gen-legend-item:hover { background: #f3f1f8; }
.gen-legend-item--off { opacity: 0.4; }
.gen-legend-dot { width: 9px; height: 9px; border-radius: 50%; }
.gen-legend-name { font-weight: 600; color: var(--color-unergy-deep); }
.gen-legend-total { color: #6b5a8a; font-weight: 500; }

/* Chart SVG */
.gen-chart-wrap {
  width: 100%;
  padding: 12px 16px 4px;
  position: relative;   /* ancla del tooltip de hover */
}
.gen-chart-svg {
  width: 100%;
  height: 280px;
  display: block;
}

/* Hover: línea guía + tooltip de valores X/Y */
.gen-hover-line {
  stroke: var(--color-unergy-purple);
  stroke-width: 1;
  stroke-dasharray: 4 3;
  opacity: 0.75;
}
.gen-tooltip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  min-width: 150px;
  max-width: 240px;
  background: #fff;
  border: 1px solid #e9ddff;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(28, 18, 50, 0.16);
  padding: 8px 10px;
  font-size: 11.5px;
  transform: translate(12px, -50%);
}
.gen-tooltip--flip { transform: translate(calc(-100% - 12px), -50%); }
.gen-tooltip-x {
  font-weight: 700;
  color: var(--color-unergy-deep);
  margin-bottom: 5px;
  white-space: nowrap;
}
.gen-tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
}
.gen-tooltip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.gen-tooltip-name {
  color: #6b5a8a;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gen-tooltip-val { font-weight: 700; color: var(--color-unergy-deep); font-variant-numeric: tabular-nums; }
.gen-tooltip-total { border-top: 1px solid #f0ebf7; margin-top: 4px; padding-top: 4px; }
.gen-tooltip-fault {
  border-top: 1px solid #fde2e2;
  margin-top: 5px;
  padding-top: 5px;
  color: #dc2626;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 5px;
}
.gen-tooltip-fault svg { font-size: 11px; }

/* Marcadores de falla en la gráfica (subrayado rojo del día/período) */
.gen-fault-underline { stroke: #dc2626; stroke-width: 3; stroke-linecap: round; }
.gen-fault-vline { stroke: #dc2626; stroke-width: 1; stroke-dasharray: 2 3; opacity: 0.35; }
.gen-fault-dot { fill: #dc2626; }

.gen-chart-svg .gen-grid line {
  stroke: #ece8f4;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.gen-chart-svg .gen-grid text {
  font-size: 9px;
  fill: #6b5a8a;
  text-anchor: end;
  font-family: inherit;
}
.gen-chart-svg .gen-xlabels text {
  font-size: 9px;
  fill: #6b5a8a;
  font-family: inherit;
}

/* Table */
.gen-table :deep(.p-datatable-thead > tr > th) {
  background: #faf9fc;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #6b5a8a;
}
.gen-table :deep(.p-datatable-tbody > tr > td) {
  padding: 8px 12px;
  vertical-align: middle;
}
.gen-table :deep(.p-datatable-tbody > tr) { cursor: pointer; }

/* ── Panel de fallas del período ─────────────────────────────────────── */
.gen-fchip {
  font-size: 11px;
  font-weight: 700;
  color: #6b5a8a;
  background: #f3f1f8;
  border: 1px solid #ece8f4;
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
}
.gen-fchip--red { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }

.gen-fallas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
}

.gen-falla-stripe { width: 4px; height: 30px; border-radius: 2px; background: #d1d5db; margin: 0 auto; }
.gen-falla-stripe--gen { background: #dc2626; }
.gen-falla-row--gen :deep(td) { background: #fff7f7; }
:deep(.gen-falla-row--gen:hover td) { background: #fdeaea !important; }

.gen-falla-desc {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  max-width: 360px;
}
.gen-prio-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2px;
}
.gen-energy-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 2px 8px;
}
.gen-energy-badge svg { font-size: 10px; }
</style>
