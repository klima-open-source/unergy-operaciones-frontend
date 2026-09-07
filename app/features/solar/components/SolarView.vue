<template>
  <div class="solar-layout">

    <!-- ═══════════════════════════════════════════════════════════════
         PANEL DE FILTROS (izquierda)
    ════════════════════════════════════════════════════════════════ -->
    <aside class="filter-panel">
      <div class="filter-header">
        <SlidersHorizontalIcon class="size-[1em]" style="color:var(--color-unergy-purple)" />
        <span>Filtros</span>
      </div>

      <div class="filter-group">
        <label class="flabel">Fecha inicio</label>
        <input v-model="filters.fechaIni" type="date" class="finput" />
      </div>
      <div class="filter-group">
        <label class="flabel">Fecha fin</label>
        <input v-model="filters.fechaFin" type="date" class="finput" />
      </div>

      <div class="filter-group">
        <label class="flabel">Municipio</label>
        <MultiSelect
          v-model="filters.municipios"
          :options="filtros.municipios"
          placeholder="Todos"
          :maxSelectedLabels="2"
          class="w-full filter-ms"
          filter
          emptyMessage="Sin opciones"
        />
      </div>

      <div class="filter-group">
        <label class="flabel">Departamento</label>
        <MultiSelect
          v-model="filters.departamentos"
          :options="filtros.departamentos"
          placeholder="Todos"
          :maxSelectedLabels="2"
          class="w-full filter-ms"
          filter
          emptyMessage="Sin opciones"
        />
      </div>

      <div class="filter-group">
        <label class="flabel">Estado</label>
        <div class="flex flex-col gap-1.5 mt-1">
          <label
            v-for="est in filtros.estados"
            :key="est"
            class="flex items-center gap-2 cursor-pointer"
          >
            <Checkbox v-model="filters.estados" :value="est" />
            <span class="text-xs" style="color:var(--color-unergy-deep)">{{ est }}</span>
          </label>
          <span v-if="!filtros.estados.length" class="text-xs text-gray-400">
            Sin estados disponibles
          </span>
        </div>
      </div>

      <div class="filter-actions">
        <Button label="Aplicar filtros" class="w-full" :loading="loading" @click="applyFilters">
          <template #icon><SearchIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Limpiar" severity="secondary" outlined class="w-full mt-2 text-sm" @click="clearFilters">
          <template #icon><XIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </aside>

    <!-- ═══════════════════════════════════════════════════════════════
         CONTENIDO PRINCIPAL
    ════════════════════════════════════════════════════════════════ -->
    <div class="solar-main">

      <!-- Encabezado ─────────────────────────────────────────────── -->
      <div class="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 class="page-title">☀️ Monitoreo Solar</h1>
          <p class="page-sub">Generación distribuida · Datos XM SinergoX</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <Button label="Recargar datos" size="small" severity="secondary" outlined :loading="reloading" @click="reloadCache">
            <template #icon><RefreshCwIcon class="size-[1em]" /></template>
          </Button>
          <Button label="Exportar CSV" size="small" @click="exportCSV" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple);">
            <template #icon><DownloadIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>

      <!-- Sin datos ──────────────────────────────────────────────── -->
      <div v-if="!loading && !genData.length && initialLoaded" class="empty-state">
        <SunIcon class="text-5xl mb-4 size-[1em]" style="color:var(--color-unergy-purple);opacity:0.25" />
        <h3 class="text-base font-semibold text-gray-600 mb-2">Sin datos disponibles</h3>
        <p class="text-sm text-gray-400 text-center max-w-xs leading-relaxed">
          Los archivos Excel no se encontraron en
          <code class="bg-gray-100 px-1 rounded">./datos/</code>.<br />
          Ejecuta <code class="bg-gray-100 px-1 rounded">solar_sin.py</code> para descargar los datos de XM SinergoX.
        </p>
        <Button label="Reintentar" class="mt-5" :loading="reloading" @click="reloadCache">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <!-- Loader ─────────────────────────────────────────────────── -->
      <div v-else-if="loading && !initialLoaded" class="empty-state">
        <SunIcon class="text-4xl mb-3 size-[1em] animate-spin" style="color:var(--color-unergy-purple)" />
        <p class="text-sm text-gray-500">Cargando datos solares…</p>
      </div>

      <!-- Contenido con datos ─────────────────────────────────────── -->
      <div v-else>

        <!-- KPI Cards ─────────────────────────────────────────────── -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon" style="background:rgba(145,91,216,0.1)">
              <LayoutGridIcon class="size-[1em]" style="color:var(--color-unergy-purple)" />
            </div>
            <div>
              <p class="kpi-val">{{ kpis.proyectos }}</p>
              <p class="kpi-lbl">Proyectos activos</p>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:rgba(246,255,114,0.25)">
              <ZapIcon class="size-[1em]" style="color:#a16207" />
            </div>
            <div>
              <p class="kpi-val">{{ fmtK(kpis.kwhTotal) }}</p>
              <p class="kpi-lbl">kWh Total</p>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:rgba(145,91,216,0.1)">
              <ChartLineIcon class="size-[1em]" style="color:var(--color-unergy-purple)" />
            </div>
            <div>
              <p class="kpi-val">{{ fmtK(kpis.promDiario) }}</p>
              <p class="kpi-lbl">Prom. kWh/día</p>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon" style="background:rgba(74,222,128,0.1)">
              <DatabaseIcon class="size-[1em]" style="color:#16a34a" />
            </div>
            <div>
              <p class="kpi-val">{{ kpis.capacidadMW.toFixed(2) }}</p>
              <p class="kpi-lbl">Capacidad (MW)</p>
            </div>
          </div>
        </div>

        <!-- Gráficas ───────────────────────────────────────────────── -->
        <div class="card mb-6">
          <!-- Tabs -->
          <div class="chart-tabs">
            <button
              v-for="tab in CHART_TABS"
              :key="tab.id"
              :class="['ctab', activeTab === tab.id && 'ctab-active']"
              @click="activeTab = tab.id"
            >
              <component :is="tab.icon" class="mr-1.5 text-xs size-[1em]" />{{ tab.label }}
            </button>
          </div>

          <!-- Tab: Comparación de proyectos (líneas SVG) -->
          <div v-show="activeTab === 'lineas'" class="pt-2">
            <div class="flex gap-3 items-center mb-4 flex-wrap">
              <div class="flex-1 min-w-48">
                <MultiSelect
                  v-model="selectedSics"
                  :options="proyectoOpts"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleccionar proyectos (máx. 12)"
                  :maxSelectedLabels="3"
                  :selectionLimit="12"
                  class="w-full"
                  filter
                />
              </div>
            </div>
            <div class="svg-wrap">
              <svg v-if="lineChart.series.length" :viewBox="`0 0 ${C.W} ${C.H}`" class="svg-chart">
                <!-- Y grid + labels -->
                <g v-for="(y, i) in lineChart.yGrid" :key="`yg${i}`">
                  <line :x1="C.ML" :y1="y" :x2="C.W - C.MR" :y2="y" stroke="#e5e7eb" stroke-width="1" />
                  <text :x="C.ML - 6" :y="y + 4" text-anchor="end" class="chart-label">
                    {{ fmtShort(lineChart.yTicks[i]) }}
                  </text>
                </g>
                <!-- Series -->
                <g v-for="(s, si) in lineChart.series" :key="s.sic">
                  <path
                    :d="s.path"
                    fill="none"
                    :stroke="COLORS[si % COLORS.length]"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <circle
                    v-for="pt in s.dots"
                    :key="`${s.sic}-${pt.x}`"
                    :cx="pt.x"
                    :cy="pt.y"
                    r="3"
                    :fill="COLORS[si % COLORS.length]"
                  />
                </g>
                <!-- X labels -->
                <text
                  v-for="xl in lineChart.xLabels"
                  :key="xl.x"
                  :x="xl.x"
                  :y="C.H - C.MB + 14"
                  text-anchor="middle"
                  class="chart-label"
                >{{ xl.text }}</text>
                <!-- Axes -->
                <line :x1="C.ML" :y1="C.MT" :x2="C.ML" :y2="C.H - C.MB" stroke="#d1d5db" stroke-width="1" />
                <line :x1="C.ML" :y1="C.H - C.MB" :x2="C.W - C.MR" :y2="C.H - C.MB" stroke="#d1d5db" stroke-width="1" />
              </svg>
              <div v-else class="chart-empty">Selecciona proyectos para visualizar su generación diaria</div>
            </div>
            <!-- Leyenda -->
            <div v-if="lineChart.series.length" class="flex flex-wrap gap-4 mt-3">
              <div v-for="(s, si) in lineChart.series" :key="s.sic" class="flex items-center gap-1.5">
                <span class="w-4 h-0.5 rounded-full inline-block" :style="`background:${COLORS[si % COLORS.length]}`" />
                <span class="text-xs text-gray-600 truncate max-w-[150px]" :title="s.nombre">{{ s.nombre }}</span>
              </div>
            </div>
          </div>

          <!-- Tab: Por Municipio -->
          <div v-show="activeTab === 'municipio'" class="pt-2">
            <div class="bar-list">
              <div v-for="item in barMunicipio" :key="item.label" class="bar-row">
                <div class="bar-lbl">{{ item.label }}</div>
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    :style="`width:${item.pct}%;background:var(--color-unergy-purple)`"
                  />
                </div>
                <div class="bar-val">{{ fmtShort(item.val) }}</div>
              </div>
              <div v-if="!barMunicipio.length" class="chart-empty">Sin datos para el período seleccionado</div>
            </div>
          </div>

          <!-- Tab: Por Departamento -->
          <div v-show="activeTab === 'departamento'" class="pt-2">
            <div class="bar-list">
              <div v-for="item in barDepto" :key="item.label" class="bar-row">
                <div class="bar-lbl">{{ item.label }}</div>
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    :style="`width:${item.pct}%;background:linear-gradient(90deg,var(--color-unergy-purple) 0%,#C89FF0 100%)`"
                  />
                </div>
                <div class="bar-val">{{ fmtShort(item.val) }} · {{ item.proyectos }} proy.</div>
              </div>
              <div v-if="!barDepto.length" class="chart-empty">Sin datos para el período seleccionado</div>
            </div>
          </div>

          <!-- Tab: Top Generadores -->
          <div v-show="activeTab === 'top'" class="pt-2">
            <div class="bar-list">
              <div v-for="(item, i) in rankingWithPct" :key="item.sic" class="bar-row">
                <div class="bar-lbl flex items-center gap-2">
                  <span class="rank-num">{{ i + 1 }}</span>
                  <span class="truncate" :title="item.nombre">{{ item.nombre }}</span>
                </div>
                <div class="bar-track">
                  <div
                    class="bar-fill transition-all duration-500"
                    :style="`width:${item.pct}%;background:${i < 3 ? 'var(--color-unergy-yellow)' : 'var(--color-unergy-purple)'}`"
                  />
                </div>
                <div class="bar-val">{{ fmtShort(item.kwh_total) }}</div>
              </div>
              <div v-if="!rankingWithPct.length" class="chart-empty">Sin datos para el período seleccionado</div>
            </div>
          </div>
        </div>

        <!-- Comparación Nacional XM vs. Interno BD ─────────────────── -->
        <div class="card mb-6">
          <h3 class="section-title">
            <ChartColumnIcon class="mr-2 size-[1em]" style="color:var(--color-unergy-purple)" />
            Comparación: XM Nacional vs. Proyectos Internos
          </h3>
          <p class="text-xs text-gray-400 mb-4">
            Contrasta la generación de proyectos del archivo XM con los proyectos registrados en tu base de datos.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="flabel">Proyectos Nacionales (XM)</label>
              <MultiSelect
                v-model="cmp.nacionales"
                :options="proyectoOpts"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar por SIC…"
                :maxSelectedLabels="3"
                :selectionLimit="8"
                class="w-full mt-1"
                filter
              />
            </div>
            <div>
              <label class="flabel">Proyectos Internos (BD)</label>
              <MultiSelect
                v-model="cmp.internos"
                :options="internosOpts"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar proyecto…"
                :maxSelectedLabels="3"
                :selectionLimit="8"
                class="w-full mt-1"
                filter
              />
            </div>
          </div>
          <Button label="Generar comparación" :loading="cmp.loading" :disabled="!cmp.nacionales.length && !cmp.internos.length" @click="loadComparacion">
            <template #icon><RefreshCwIcon class="size-[1em]" /></template>
          </Button>

          <!-- Chart comparación -->
          <div v-if="cmpChart.series.length" class="svg-wrap mt-5">
            <svg :viewBox="`0 0 ${C.W} ${C.H}`" class="svg-chart">
              <g v-for="(y, i) in cmpChart.yGrid" :key="`cy${i}`">
                <line :x1="C.ML" :y1="y" :x2="C.W - C.MR" :y2="y" stroke="#e5e7eb" stroke-width="1" />
                <text :x="C.ML - 6" :y="y + 4" text-anchor="end" class="chart-label">
                  {{ fmtShort(cmpChart.yTicks[i]) }}
                </text>
              </g>
              <g v-for="(s, si) in cmpChart.series" :key="s.sic">
                <path
                  :d="s.path"
                  fill="none"
                  :stroke="s.tipo === 'nacional' ? CMP_COLORS_NAC[si % CMP_COLORS_NAC.length] : CMP_COLORS_INT[si % CMP_COLORS_INT.length]"
                  :stroke-dasharray="s.tipo === 'interno' ? '6 3' : 'none'"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
              </g>
              <line :x1="C.ML" :y1="C.MT" :x2="C.ML" :y2="C.H - C.MB" stroke="#d1d5db" />
              <line :x1="C.ML" :y1="C.H - C.MB" :x2="C.W - C.MR" :y2="C.H - C.MB" stroke="#d1d5db" />
              <text
                v-for="xl in cmpChart.xLabels"
                :key="xl.x"
                :x="xl.x"
                :y="C.H - C.MB + 14"
                text-anchor="middle"
                class="chart-label"
              >{{ xl.text }}</text>
            </svg>
            <div class="flex flex-wrap gap-4 mt-3">
              <div v-for="(s, si) in cmpChart.series" :key="s.sic" class="flex items-center gap-1.5">
                <span
                  class="w-3 h-3 rounded-sm inline-block"
                  :style="`background:${s.tipo === 'nacional' ? CMP_COLORS_NAC[si % CMP_COLORS_NAC.length] : CMP_COLORS_INT[si % CMP_COLORS_INT.length]}`"
                />
                <span class="cmp-badge" :class="s.tipo === 'nacional' ? 'badge-nac' : 'badge-int'">
                  {{ s.tipo === 'nacional' ? 'XM' : 'BD' }}
                </span>
                <span class="text-xs text-gray-600">{{ s.nombre }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="!cmp.loading" class="chart-empty mt-4">
            Selecciona proyectos y presiona "Generar comparación"
          </div>
        </div>

        <!-- Mapa + Resumen por Depto ──────────────────────────────── -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          <!-- Mapa Colombia -->
          <div class="card lg:col-span-2">
            <h3 class="section-title mb-3">
              <MapPinIcon class="mr-2 size-[1em]" style="color:var(--color-unergy-purple)" />
              Mapa de Generación
            </h3>
            <svg viewBox="0 0 420 520" class="w-full max-h-80">
              <!-- Puntos por departamento -->
              <g v-for="d in mapData" :key="d.name">
                <circle
                  :cx="d.x"
                  :cy="d.y"
                  :r="d.r"
                  :fill="d.color"
                  opacity="0.88"
                  class="dept-circle"
                >
                  <title>{{ d.name }}: {{ fmtShort(d.kwh) }} kWh</title>
                </circle>
                <text
                  :x="d.x"
                  :y="d.y + d.r + 9"
                  text-anchor="middle"
                  font-size="7"
                  fill="#6b7280"
                >{{ d.short }}</text>
              </g>
              <!-- Gradiente leyenda -->
              <defs>
                <linearGradient id="mapGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stop-color="var(--color-unergy-deep)" />
                  <stop offset="45%"  stop-color="var(--color-unergy-purple)" />
                  <stop offset="100%" stop-color="var(--color-unergy-yellow)" />
                </linearGradient>
              </defs>
              <rect x="20" y="498" width="130" height="8" rx="4" fill="url(#mapGrad)" />
              <text x="18"  y="493" font-size="7.5" fill="#9ca3af">Bajo</text>
              <text x="152" y="493" text-anchor="end" font-size="7.5" fill="#9ca3af">Alto</text>
            </svg>
          </div>

          <!-- Tabla resumen por depto -->
          <div class="card lg:col-span-3 overflow-auto">
            <h3 class="section-title mb-3">
              <ChartColumnIcon class="mr-2 size-[1em]" style="color:var(--color-unergy-purple)" />
              Resumen por Departamento
            </h3>
            <table class="sum-table">
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th class="text-right">Proy.</th>
                  <th class="text-right">kWh Total</th>
                  <th class="text-right">MW</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in deptSummary" :key="row.depto">
                  <td>{{ row.depto }}</td>
                  <td class="text-right font-mono text-xs">{{ row.proyectos }}</td>
                  <td class="text-right font-mono text-xs">{{ fmtShort(row.kwh) }}</td>
                  <td class="text-right font-mono text-xs">{{ row.mw.toFixed(2) }}</td>
                </tr>
                <tr v-if="!deptSummary.length">
                  <td colspan="4" class="text-center text-gray-400 text-xs py-4">Sin datos</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tabla de proyectos ─────────────────────────────────────── -->
        <div class="card">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 class="section-title">
              <ListIcon class="mr-2 size-[1em]" style="color:var(--color-unergy-purple)" />
              Detalle por Proyecto
              <span class="ml-2 text-xs font-normal text-gray-400">({{ tableRows.length }} proyectos)</span>
            </h3>
          </div>
          <DataTable
            :value="tableRows"
            :rows="20"
            paginator
            sortMode="multiple"
            :loading="loading"
            class="text-sm"
            rowHover
            :rowsPerPageOptions="[10, 20, 50]"
          >
            <Column field="nombre" header="Proyecto" sortable style="min-width:160px">
              <template #body="{ data }">
                <div class="font-medium text-gray-800 truncate" style="max-width:200px" :title="data.nombre">
                  {{ data.nombre }}
                </div>
                <div class="text-[10px] text-gray-400 font-mono">{{ data.sic }}</div>
              </template>
            </Column>
            <Column field="municipio"    header="Municipio"    sortable />
            <Column field="departamento" header="Departamento" sortable />
            <Column field="agente"       header="Agente"       style="max-width:160px">
              <template #body="{ data }">
                <span class="truncate block text-xs" :title="data.agente">{{ data.agente || '—' }}</span>
              </template>
            </Column>
            <Column field="estado" header="Estado" sortable style="width:110px">
              <template #body="{ data }">
                <GBadge :color="estadoColor(data.estado)" class="text-[10px]">{{ data.estado }}</GBadge>
              </template>
            </Column>
            <Column field="capacidad_mw" header="Cap. MW" sortable style="width:90px">
              <template #body="{ data }">
                <span class="font-mono text-xs">{{ data.capacidad_mw.toFixed(3) }}</span>
              </template>
            </Column>
            <Column field="kwh_total" header="kWh Total" sortable style="width:120px">
              <template #body="{ data }">
                <span class="font-mono text-xs">{{ fmtShort(data.kwh_total) }}</span>
              </template>
            </Column>
            <Column field="kwh_dia_prom" header="kWh/día" sortable style="width:100px">
              <template #body="{ data }">
                <span class="font-mono text-xs">{{ fmtShort(data.kwh_dia_prom) }}</span>
              </template>
            </Column>
            <Column field="dias" header="Días" sortable style="width:65px">
              <template #body="{ data }">
                <span class="font-mono text-xs text-gray-500">{{ data.dias }}</span>
              </template>
            </Column>
          </DataTable>
        </div>

      </div><!-- /v-else datos -->
    </div><!-- /solar-main -->
  </div><!-- /solar-layout -->
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MultiSelect from 'primevue/multiselect'
import Checkbox   from 'primevue/checkbox'
import Button     from 'primevue/button'
import DataTable  from 'primevue/datatable'
import Column     from 'primevue/column'
import { toast } from 'vue-sonner'
import { SolarService } from '~/features/solar/services/solar'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ChartColumnIcon, ChartLineIcon, DatabaseIcon, DownloadIcon, GlobeIcon, LayoutGridIcon, ListIcon, MapIcon, MapPinIcon, RefreshCwIcon, SearchIcon, SlidersHorizontalIcon, SunIcon, TrophyIcon, XIcon, ZapIcon } from '@lucide/vue'

const solarService = new SolarService()
const proyectosService = new ProyectosService()

// ─── Constantes de diseño ────────────────────────────────────────────────────

const COLORS = ['#915BD8','#3b82f6','#16a34a','#ea580c','#0891b2','#db2777','#7c3aed','#ca8a04','#dc2626','#059669','#6366f1','#d97706']
const CMP_COLORS_NAC = ['#915BD8','#7c3aed','#6366f1','#3b82f6','#0891b2','#0ea5e9','#06b6d4','#14b8a6']
const CMP_COLORS_INT = ['#16a34a','#15803d','#166534','#65a30d','#84cc16','#22c55e','#4ade80','#86efac']

const CHART_TABS = [
  { id: 'lineas',       label: 'Comparación proyectos', icon: ChartLineIcon },
  { id: 'municipio',    label: 'Por Municipio',          icon: MapIcon },
  { id: 'departamento', label: 'Por Departamento',       icon: GlobeIcon },
  { id: 'top',          label: 'Top Generadores',        icon: TrophyIcon },
]

// Dimensiones SVG de los gráficos de líneas
const C = { W: 700, H: 230, ML: 58, MR: 16, MT: 16, MB: 32 }

// Posiciones geográficas de departamentos en SVG 420×520
const DEPT_POSITIONS = [
  { name: 'LA GUAJIRA',              short: 'Guajira',       x: 305, y: 38  },
  { name: 'MAGDALENA',               short: 'Magdalena',     x: 255, y: 72  },
  { name: 'ATLÁNTICO',               short: 'Atlántico',     x: 205, y: 78  },
  { name: 'BOLÍVAR',                 short: 'Bolívar',       x: 192, y: 120 },
  { name: 'SUCRE',                   short: 'Sucre',         x: 183, y: 152 },
  { name: 'CÓRDOBA',                 short: 'Córdoba',       x: 163, y: 138 },
  { name: 'CESAR',                   short: 'Cesar',         x: 285, y: 110 },
  { name: 'NORTE DE SANTANDER',      short: 'N.Santander',   x: 308, y: 155 },
  { name: 'SANTANDER',               short: 'Santander',     x: 272, y: 196 },
  { name: 'BOYACÁ',                  short: 'Boyacá',        x: 287, y: 240 },
  { name: 'ARAUCA',                  short: 'Arauca',        x: 340, y: 188 },
  { name: 'CASANARE',                short: 'Casanare',      x: 337, y: 228 },
  { name: 'VICHADA',                 short: 'Vichada',       x: 392, y: 265 },
  { name: 'META',                    short: 'Meta',          x: 332, y: 297 },
  { name: 'CUNDINAMARCA',            short: 'Cundina.',      x: 270, y: 278 },
  { name: 'ANTIOQUIA',               short: 'Antioquia',     x: 192, y: 212 },
  { name: 'CHOCÓ',                   short: 'Chocó',         x: 148, y: 238 },
  { name: 'CALDAS',                  short: 'Caldas',        x: 208, y: 268 },
  { name: 'RISARALDA',               short: 'Risaralda',     x: 195, y: 284 },
  { name: 'QUINDÍO',                 short: 'Quindío',       x: 198, y: 300 },
  { name: 'VALLE DEL CAUCA',         short: 'Valle',         x: 165, y: 325 },
  { name: 'TOLIMA',                  short: 'Tolima',        x: 245, y: 312 },
  { name: 'HUILA',                   short: 'Huila',         x: 260, y: 358 },
  { name: 'CAUCA',                   short: 'Cauca',         x: 183, y: 375 },
  { name: 'NARIÑO',                  short: 'Nariño',        x: 178, y: 426 },
  { name: 'PUTUMAYO',                short: 'Putumayo',      x: 232, y: 432 },
  { name: 'CAQUETÁ',                 short: 'Caquetá',       x: 285, y: 395 },
  { name: 'GUAVIARE',                short: 'Guaviare',      x: 342, y: 370 },
  { name: 'AMAZONAS',                short: 'Amazonas',      x: 300, y: 475 },
  { name: 'GUAINÍA',                 short: 'Guainía',       x: 396, y: 348 },
  { name: 'VAUPÉS',                  short: 'Vaupés',        x: 372, y: 425 },
  { name: 'SAN ANDRÉS',              short: 'S.Andrés',      x: 70,  y: 128 },
]

// ─── Estado ──────────────────────────────────────────────────────────────────

const route        = useRoute()
const router       = useRouter()
const loading      = ref(false)
const reloading    = ref(false)
const initialLoaded = ref(false)

const proyectos    = ref([])   // metadatos del Excel
const genData      = ref([])   // generación filtrada actual
const filtros      = ref({ municipios: [], departamentos: [], estados: [] })
const rankingData  = ref([])   // top N del API
const internosOpts = ref([])   // proyectos internos BD

// Sincronizados con la URL (mismos nombres que buildParams()) para que se
// sostengan al volver con "atras" o al refrescar.
const filters = reactive({
  fechaIni:     route.query.fechaIni || '',
  fechaFin:     route.query.fechaFin || '',
  municipios:   route.query.municipio ? route.query.municipio.split(',') : [],
  departamentos: route.query.departamento ? route.query.departamento.split(',') : [],
  estados:      route.query.estado ? route.query.estado.split(',') : [],
})

const activeTab    = ref('lineas')
const selectedSics = ref([])

const cmp = reactive({
  nacionales: [],
  internos:   [],
  loading:    false,
  raw:        { nacionales: [], internos: [] },
})

// ─── Carga inicial ────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadFiltros(), loadProyectos(), loadInternos()])
  await loadGeneracion()
  await loadRanking()
  initialLoaded.value = true
})

async function loadFiltros() {
  try {
    const data = await solarService.obtenerFiltros()
    filtros.value = data
    // Seleccionar todos los estados por defecto -- salvo que ya vinieran
    // restaurados desde la URL (?estado=...), para no pisar ese filtro.
    if (!route.query.estado) {
      filters.estados = [...data.estados]
    }
  } catch { /* silencioso */ }
}

async function loadProyectos() {
  try {
    proyectos.value = await solarService.listarProyectos()
  } catch { /* silencioso */ }
}

async function loadInternos() {
  try {
    const items = await proyectosService.listar({ size: 500, page: 1 })
    internosOpts.value = items.map(p => ({ label: p.nombre_comercial, value: p.id }))
  } catch { /* silencioso */ }
}

async function loadGeneracion() {
  loading.value = true
  try {
    genData.value = await solarService.obtenerGeneracion(buildParams())
  } catch (e) {
    toast.error('Error', { description: 'No se pudo cargar la generación solar', duration: 4000 })
  } finally {
    loading.value = false
  }
}

async function loadRanking() {
  try {
    rankingData.value = await solarService.obtenerRanking({ ...buildParams(), top: 20 })
  } catch { /* silencioso */ }
}

async function loadComparacion() {
  if (!cmp.nacionales.length && !cmp.internos.length) return
  cmp.loading = true
  try {
    cmp.raw = await solarService.obtenerComparacion({
      ...buildParams(),
      sicNacionales: cmp.nacionales.join(',') || undefined,
      idsInternos:   cmp.internos.join(',') || undefined,
    })
  } catch {
    toast.error('Error', { description: 'No se pudo generar la comparación', duration: 4000 })
  } finally {
    cmp.loading = false
  }
}

async function reloadCache() {
  reloading.value = true
  try {
    const data = await solarService.recargarCache()
    toast.success('Caché recargado', {
      description: `${data.proyectos} proyectos · ${data.registros_generacion} registros`,
      duration: 4000,
    })
    await loadFiltros()
    await loadProyectos()
    await loadGeneracion()
    await loadRanking()
  } catch {
    toast.error('Error', { description: 'No se pudo recargar el caché', duration: 4000 })
  } finally {
    reloading.value = false
  }
}

function buildParams() {
  const p = {}
  if (filters.fechaIni)           p.fechaIni     = filters.fechaIni
  if (filters.fechaFin)           p.fechaFin     = filters.fechaFin
  if (filters.municipios.length)  p.municipio    = filters.municipios.join(',')
  if (filters.departamentos.length) p.departamento = filters.departamentos.join(',')
  if (filters.estados.length)     p.estado       = filters.estados.join(',')
  return p
}

async function applyFilters() {
  router.replace({ query: buildParams() })
  await Promise.all([loadGeneracion(), loadRanking()])
}

function clearFilters() {
  filters.fechaIni      = ''
  filters.fechaFin      = ''
  filters.municipios    = []
  filters.departamentos = []
  filters.estados       = [...filtros.value.estados]
  applyFilters()
}

// ─── Opciones de proyectos para MultiSelect ───────────────────────────────────

const proyectoOpts = computed(() =>
  proyectos.value.map(p => ({ label: `${p.nombre} (${p.sic})`, value: p.sic }))
)

// ─── KPI Cards ────────────────────────────────────────────────────────────────

const kpis = computed(() => {
  const sics      = new Set(genData.value.map(r => r.sic))
  const kwhTotal  = genData.value.reduce((s, r) => s + r.kwh, 0)
  const fechas    = new Set(genData.value.map(r => r.fecha))
  const promDiario = fechas.size > 0 ? kwhTotal / fechas.size : 0
  const caps      = proyectos.value.filter(p => sics.has(p.sic))
  const capacidadMW = caps.reduce((s, p) => s + p.capacidad_mw, 0)
  return { proyectos: sics.size, kwhTotal, promDiario, capacidadMW }
})

// ─── Bar charts ───────────────────────────────────────────────────────────────

const barMunicipio = computed(() => {
  const agg = {}
  for (const r of genData.value) {
    if (!r.municipio) continue
    agg[r.municipio] = (agg[r.municipio] || 0) + r.kwh
  }
  const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 25)
  const max = entries[0]?.[1] || 1
  return entries.map(([label, val]) => ({ label, val, pct: (val / max) * 100 }))
})

const barDepto = computed(() => {
  const agg  = {}
  const sicc = {}
  for (const r of genData.value) {
    if (!r.departamento) continue
    agg[r.departamento] = (agg[r.departamento] || 0) + r.kwh
    if (!sicc[r.departamento]) sicc[r.departamento] = new Set()
    sicc[r.departamento].add(r.sic)
  }
  const entries = Object.entries(agg).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] || 1
  return entries.map(([label, val]) => ({
    label, val,
    pct: (val / max) * 100,
    proyectos: sicc[label]?.size || 0,
  }))
})

const rankingWithPct = computed(() => {
  const max = rankingData.value[0]?.kwh_total || 1
  return rankingData.value.map(r => ({ ...r, pct: (r.kwh_total / max) * 100 }))
})

// ─── Tabla de proyectos (agrega genData por SIC) ──────────────────────────────

const tableRows = computed(() => {
  const agg = {}
  for (const r of genData.value) {
    if (!agg[r.sic]) {
      agg[r.sic] = {
        sic: r.sic, nombre: r.nombre, municipio: r.municipio,
        departamento: r.departamento, agente: r.agente,
        estado: r.estado, capacidad_mw: r.capacidad_mw,
        kwh_total: 0, _dias: new Set(),
      }
    }
    agg[r.sic].kwh_total += r.kwh
    agg[r.sic]._dias.add(r.fecha)
  }
  return Object.values(agg).map(r => ({
    ...r,
    dias:         r._dias.size,
    kwh_dia_prom: r._dias.size > 0 ? r.kwh_total / r._dias.size : 0,
    _dias:        undefined,
  })).sort((a, b) => b.kwh_total - a.kwh_total)
})

// ─── Mapa Colombia ────────────────────────────────────────────────────────────

const deptKwhMap = computed(() => {
  const m = {}
  for (const r of genData.value) {
    const k = (r.departamento || '').toUpperCase()
    m[k] = (m[k] || 0) + r.kwh
  }
  return m
})

const maxDeptKwh = computed(() => Math.max(...Object.values(deptKwhMap.value), 1))

function lerpColor(t) {
  // 0 → #2C2039  |  0.5 → #915BD8  |  1 → #F6FF72
  const stops = [[44, 32, 57], [145, 91, 216], [246, 255, 114]]
  let c1, c2, tt
  if (t <= 0.5) { c1 = stops[0]; c2 = stops[1]; tt = t * 2 }
  else          { c1 = stops[1]; c2 = stops[2]; tt = (t - 0.5) * 2 }
  const ch = c1.map((v, i) => Math.round(v + (c2[i] - v) * tt))
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

const mapData = computed(() =>
  DEPT_POSITIONS.map(d => {
    const kwh = deptKwhMap.value[d.name] || 0
    const t   = kwh / maxDeptKwh.value
    return { ...d, kwh, r: 5 + t * 16, color: kwh > 0 ? lerpColor(t) : '#e5e7eb' }
  })
)

const deptSummary = computed(() => {
  const kwh  = deptKwhMap.value
  const mwM  = {}
  const pM   = {}
  for (const p of proyectos.value) {
    const d = (p.departamento || '').toUpperCase()
    mwM[d]  = (mwM[d]  || 0) + p.capacidad_mw
  }
  for (const r of genData.value) {
    const d = (r.departamento || '').toUpperCase()
    if (!pM[d]) pM[d] = new Set()
    pM[d].add(r.sic)
  }
  return Object.entries(kwh)
    .sort((a, b) => b[1] - a[1])
    .map(([depto, kw]) => ({
      depto:     depto.charAt(0) + depto.slice(1).toLowerCase(),
      kwh:       kw,
      proyectos: pM[depto]?.size || 0,
      mw:        mwM[depto] || 0,
    }))
})

// ─── Helpers SVG charts ───────────────────────────────────────────────────────

function niceScale(maxVal, n = 5) {
  if (!maxVal) return Array.from({ length: n }, (_, i) => i)
  const raw  = maxVal / (n - 1)
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = Math.ceil(raw / mag) * mag
  return Array.from({ length: n }, (_, i) => Math.round(i * step))
}

function buildLineChart(bySic, allDates, selectedList, namesMap) {
  if (!allDates.length || !selectedList.length) return { series: [], xLabels: [], yGrid: [], yTicks: [] }

  const n = allDates.length
  let maxVal = 0
  for (const sic of selectedList)
    for (const d of allDates)
      maxVal = Math.max(maxVal, bySic[sic]?.[d] || 0)

  const ticks = niceScale(maxVal)
  const topTick = ticks[ticks.length - 1] || 1
  const innerW = C.W - C.ML - C.MR
  const innerH = C.H - C.MT - C.MB

  const xOf = i  => C.ML + (n > 1 ? i / (n - 1) : 0.5) * innerW
  const yOf = v  => C.H - C.MB - (v / topTick) * innerH

  const yGrid = ticks.map(t => C.H - C.MB - (t / topTick) * innerH)

  const series = selectedList.map(sic => {
    const pts = allDates.map((d, i) => ({ x: xOf(i), y: yOf(bySic[sic]?.[d] || 0) }))
    const path = pts.length > 1
      ? 'M ' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')
      : ''
    const dots = n <= 40 ? pts : []
    return { sic, nombre: namesMap[sic] || sic, path, dots }
  })

  // X labels (máx 10 visibles)
  const step = Math.max(1, Math.ceil(n / 10))
  const xLabels = allDates
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % step === 0 || i === n - 1)
    .map(({ d, i }) => ({ x: xOf(i), text: d.slice(5) }))

  return { series, xLabels, yGrid, yTicks: ticks }
}

// Chart de comparación de proyectos seleccionados
const lineChart = computed(() => {
  if (!selectedSics.value.length) return { series: [], xLabels: [], yGrid: [], yTicks: [] }

  const bySic = {}
  const dates = new Set()
  for (const r of genData.value) {
    if (!selectedSics.value.includes(r.sic)) continue
    dates.add(r.fecha)
    if (!bySic[r.sic]) bySic[r.sic] = {}
    bySic[r.sic][r.fecha] = (bySic[r.sic][r.fecha] || 0) + r.kwh
  }

  const namesMap = Object.fromEntries(proyectos.value.map(p => [p.sic, p.nombre]))
  return buildLineChart(bySic, [...dates].sort(), selectedSics.value, namesMap)
})

// Chart de comparación nacional vs interno
const cmpChart = computed(() => {
  const nacRaw = cmp.raw?.nacionales || []
  const intRaw = cmp.raw?.internos   || []
  if (!nacRaw.length && !intRaw.length) return { series: [], xLabels: [], yGrid: [], yTicks: [] }

  const allDates = new Set()
  const bySic    = {}
  const namesMap = {}
  const typeMap  = {}

  for (const s of nacRaw) {
    bySic[s.sic]    = {}
    namesMap[s.sic] = s.nombre
    typeMap[s.sic]  = 'nacional'
    for (const pt of s.daily) {
      allDates.add(pt.fecha)
      bySic[s.sic][pt.fecha] = pt.kwh
    }
  }
  for (const s of intRaw) {
    const k = `int_${s.id}`
    bySic[k]    = {}
    namesMap[k] = s.nombre
    typeMap[k]  = 'interno'
    for (const pt of s.daily) {
      allDates.add(pt.fecha)
      bySic[k][pt.fecha] = pt.kwh
    }
  }

  const allKeys = [...Object.keys(bySic)]
  const base = buildLineChart(bySic, [...allDates].sort(), allKeys, namesMap)

  return {
    ...base,
    series: base.series.map(s => ({ ...s, tipo: typeMap[s.sic] || 'nacional' })),
  }
})

// ─── Exportar CSV ────────────────────────────────────────────────────────────

function exportCSV() {
  const rows = tableRows.value
  if (!rows.length) {
    toast.warning('Sin datos', { description: 'No hay datos para exportar', duration: 3000 })
    return
  }
  const cols = ['sic','nombre','municipio','departamento','agente','estado','capacidad_mw','kwh_total','kwh_dia_prom','dias']
  const hdr  = cols.join(',')
  const body = rows.map(r =>
    cols.map(c => {
      const v = r[c] ?? ''
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    }).join(',')
  ).join('\n')
  const blob = new Blob([`﻿${hdr}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `solar_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV exportado', { duration: 2500 })
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

/** Formatea un número en k / M con locale ES-CO */
function fmtShort(n) {
  if (n == null || isNaN(n)) return '—'
  const v = Math.round(n)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + ' M'
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + ' k'
  return v.toLocaleString('es-CO')
}

/** Alias para las KPI cards */
const fmtK = fmtShort

function estadoColor(e) {
  return { 'OPERACIÓN': 'success', 'PRUEBAS': 'warning', 'INACTIVO': 'default' }[e] ?? 'default'
}
</script>

<style scoped>
/* ─── Layout principal ──────────────────────────────────────────────────────── */
.solar-layout {
  display: flex;
  gap: 0;
  min-height: 100%;
  background: #f3f4f6;
}

/* ─── Panel de filtros ──────────────────────────────────────────────────────── */
.filter-panel {
  width: 230px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  position: sticky;
  top: 0;
  height: calc(100vh - 57px); /* topbar height */
}

.filter-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-unergy-deep);
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--color-unergy-yellow);
}

.filter-group {
  margin-bottom: 14px;
}

.flabel {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.finput {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
  background: #f9fafb;
  outline: none;
  transition: border-color 0.15s;
}
.finput:focus { border-color: var(--color-unergy-purple); background: #fff; }

:deep(.filter-ms .p-multiselect) { font-size: 12px; }

.filter-actions {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

/* ─── Contenido principal ───────────────────────────────────────────────────── */
.solar-main {
  flex: 1;
  min-width: 0;
  padding: 24px;
  overflow-y: auto;
}

/* ─── Encabezado ────────────────────────────────────────────────────────────── */
.page-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-unergy-deep);
  line-height: 1.2;
}
.page-sub {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 3px;
}

/* ─── Estado vacío ──────────────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  background: #fff;
  border-radius: 16px;
  border: 2px dashed #e5e7eb;
}

/* ─── KPI Cards ─────────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
@media (min-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(4, 1fr); }
}
.kpi-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
  border: 1px solid rgba(145,91,216,0.08);
  transition: box-shadow 0.2s;
}
.kpi-card:hover { box-shadow: 0 4px 12px rgba(145,91,216,0.12); }
.kpi-icon {
  width: 42px; height: 42px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.kpi-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-unergy-deep);
  line-height: 1;
}
.kpi-lbl {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 3px;
  font-weight: 500;
}

/* ─── Card genérica ─────────────────────────────────────────────────────────── */
.card {
  background: #ffffff;
  border-radius: 14px;
  padding: 20px 22px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid rgba(145,91,216,0.07);
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-unergy-deep);
  display: flex;
  align-items: center;
}

/* ─── Tabs de gráficas ──────────────────────────────────────────────────────── */
.chart-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  border-bottom: 2px solid #f3f4f6;
  padding-bottom: 10px;
}
.ctab {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.ctab:hover { background: rgba(145,91,216,0.07); color: var(--color-unergy-purple); }
.ctab-active {
  background: rgba(145,91,216,0.12) !important;
  color: var(--color-unergy-purple) !important;
  font-weight: 700;
}

/* ─── Bar charts CSS ────────────────────────────────────────────────────────── */
.bar-list { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
.bar-row {
  display: grid;
  grid-template-columns: 160px 1fr 90px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.bar-lbl { color: #374151; truncate: ellipsis; white-space: nowrap; overflow: hidden; display: flex; align-items: center; gap: 6px; }
.bar-track { height: 10px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(.4,0,.2,1); min-width: 2px; }
.bar-val   { text-align: right; font-family: monospace; color: #6b7280; font-size: 11px; }

.rank-num {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: rgba(145,91,216,0.12);
  color: var(--color-unergy-purple);
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ─── SVG Chart ─────────────────────────────────────────────────────────────── */
.svg-wrap    { width: 100%; overflow-x: auto; }
.svg-chart   { width: 100%; height: auto; display: block; }
.chart-empty {
  min-height: 140px;
  display: flex; align-items: center; justify-content: center;
  color: #d1d5db;
  font-size: 13px;
  border: 2px dashed #f3f4f6;
  border-radius: 10px;
}
:deep(.chart-label) { font-size: 10px; fill: #9ca3af; }

/* ─── Mapa Colombia ─────────────────────────────────────────────────────────── */
.dept-circle { transition: r 0.4s ease, fill 0.4s ease; cursor: default; }
.dept-circle:hover { opacity: 1 !important; filter: brightness(1.15); }

/* ─── Tabla resumen ─────────────────────────────────────────────────────────── */
.sum-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sum-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #9ca3af;
  border-bottom: 2px solid #f3f4f6;
}
.sum-table td { padding: 7px 10px; border-bottom: 1px solid #f9fafb; color: #374151; }
.sum-table tr:hover td { background: rgba(145,91,216,0.03); }

/* ─── Badges comparación ───────────────────────────────────────────────────── */
.cmp-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
}
.badge-nac { background: rgba(145,91,216,0.12); color: #7c3aed; }
.badge-int { background: rgba(22,163,74,0.12);  color: #15803d; }
</style>
