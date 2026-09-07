<template>
  <div class="p-5 space-y-5 min-h-screen" style="background: var(--color-unergy-avena); color: var(--color-unergy-deep);">

    <!-- Header -->
    <PageHeader title="Descubrimientos en Bolsa" subtitle="Exposición financiera por compras y excedentes de energía valorados a precio de bolsa" />

    <!-- Selectors -->
    <div class="flex flex-wrap gap-3 items-end">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Año</label>
        <Select v-model="selectedYear" :options="years" class="w-24" @change="loadData" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Desde</label>
        <Select v-model="monthFrom" :options="MESES_OPTIONS" optionLabel="label" optionValue="value" class="w-36" @change="loadData" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-unergy-purple);">Hasta</label>
        <Select v-model="monthTo" :options="MESES_OPTIONS" optionLabel="label" optionValue="value" class="w-36" @change="loadData" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <ProgressSpinner style="width:48px;height:48px;" strokeWidth="4" animationDuration=".8s" />
      <p class="text-sm" style="color: #7a6e8a;">Calculando descubrimientos…</p>
    </div>

    <!-- Error -->
    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>

    <!-- Content -->
    <template v-else-if="data">

      <!-- KPI cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-xl border p-4" style="background: white; border-color: rgba(44,32,57,0.12);">
          <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: #D64455;">Compras en Bolsa</div>
          <div class="font-mono text-xl font-bold" style="color: #D64455;">{{ fmtCop(data.totales.compras_bolsa_cop) }}</div>
          <div class="text-xs mt-1" style="color: #7a6e8a;">{{ fmtMwh(data.totales.compras_bolsa_mwh) }} MWh</div>
        </div>
        <div class="rounded-xl border p-4" style="background: white; border-color: rgba(44,32,57,0.12);">
          <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: #F0C040;">Excedentes en Bolsa</div>
          <div class="font-mono text-xl font-bold" style="color: #9a6700;">{{ fmtCop(data.totales.excedentes_bolsa_cop) }}</div>
          <div class="text-xs mt-1" style="color: #7a6e8a;">{{ fmtMwh(data.totales.excedentes_bolsa_mwh) }} MWh</div>
        </div>
        <div class="rounded-xl border p-4" style="background: white; border-color: rgba(44,32,57,0.12);">
          <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: var(--color-unergy-purple);">Exposición Neta</div>
          <div class="font-mono text-xl font-bold" :style="{ color: data.totales.exposicion_neta_cop > 0 ? '#D64455' : '#2e7d32' }">
            {{ fmtCop(data.totales.exposicion_neta_cop) }}
          </div>
          <div class="text-xs mt-1" style="color: #7a6e8a;">
            {{ data.totales.exposicion_neta_cop > 0 ? 'Costo neto' : 'Ingreso neto' }}
          </div>
        </div>
        <div class="rounded-xl border p-4" style="background: white; border-color: rgba(44,32,57,0.12);">
          <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: #7a6e8a;">Meses con Datos</div>
          <div class="font-mono text-xl font-bold" style="color: var(--color-unergy-deep);">{{ mesesConDatos }}<span class="text-sm font-normal" style="color: #7a6e8a;"> / {{ data.meses.length }}</span></div>
          <div class="text-xs mt-1" style="color: #7a6e8a;">{{ selectedYear }}</div>
        </div>
      </div>

      <!-- SVG Chart — monthly exposure bars -->
      <div class="rounded-xl border p-4" style="background: white; border-color: rgba(44,32,57,0.12);">
        <p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--color-unergy-purple);">Exposición mensual</p>
        <div ref="chartBox" class="relative select-none" style="width: 100%; height: 320px;">
          <svg
            :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
            preserveAspectRatio="xMidYMid meet"
            style="width: 100%; height: 100%;"
            @mousemove="onSvgMousemove"
            @mouseleave="hovered = null"
            @click="onSvgClick"
          >
            <!-- Grid lines -->
            <g v-for="gl in yGridLines" :key="gl.val">
              <line :x1="PAD_L" :y1="gl.y" :x2="SVG_W - PAD_R" :y2="gl.y" stroke="rgba(44,32,57,0.07)" stroke-width="1" />
              <text :x="PAD_L - 7" :y="gl.y + 4" text-anchor="end" font-size="10" fill="#7a6e8a">{{ fmtShort(gl.val) }}</text>
            </g>

            <!-- Zero line -->
            <line :x1="PAD_L" :y1="zeroY" :x2="SVG_W - PAD_R" :y2="zeroY" stroke="rgba(44,32,57,0.25)" stroke-width="1" />

            <!-- Monthly bars -->
            <g v-for="(mes, i) in chartMeses" :key="i">
              <!-- Hover highlight -->
              <rect v-if="hovered === i" :x="slotX(i)" :y="PAD_T" :width="slotW" :height="PLOT_H" fill="rgba(145,91,216,0.07)" />
              <!-- Selected highlight -->
              <rect v-if="expandedMonth === mes.month" :x="slotX(i)" :y="PAD_T" :width="slotW" :height="PLOT_H" fill="rgba(240,192,64,0.08)" />

              <!-- Compras bar (up = cost) -->
              <rect v-if="mes.compras_cop > 0"
                :x="barX(i)" :y="toY(mes.compras_cop)" :width="barHalfW"
                :height="zeroY - toY(mes.compras_cop)"
                fill="#D64455" opacity="0.85"
              />
              <!-- Excedentes bar (down = income, shown as positive below zero) -->
              <rect v-if="mes.excedentes_cop > 0"
                :x="barX(i) + barHalfW + 2" :y="zeroY" :width="barHalfW"
                :height="toY(-mes.excedentes_cop) - zeroY"
                fill="#F0C040" opacity="0.85"
              />

              <!-- Month label -->
              <text
                :x="barX(i) + barHalfW + 1" :y="SVG_H - PAD_B + 17"
                text-anchor="middle" font-size="11"
                :fill="expandedMonth === mes.month ? '#F0C040' : '#7a6e8a'"
                :font-weight="expandedMonth === mes.month ? '700' : '400'"
              >{{ MESES_CORTOS[mes.month - 1] }}</text>

              <!-- Invisible hit area -->
              <rect :x="slotX(i)" :y="PAD_T" :width="slotW" :height="PLOT_H" fill="transparent" style="cursor: pointer;" />
            </g>

            <!-- Axes -->
            <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="PAD_T + PLOT_H" stroke="rgba(44,32,57,0.18)" stroke-width="1" />
            <line :x1="PAD_L" :y1="PAD_T + PLOT_H" :x2="SVG_W - PAD_R" :y2="PAD_T + PLOT_H" stroke="rgba(44,32,57,0.18)" stroke-width="1" />
          </svg>

          <!-- Tooltip -->
          <div
            v-if="hovered !== null && chartMeses[hovered]"
            class="absolute pointer-events-none z-10 rounded-xl shadow-lg text-sm"
            style="background: var(--color-unergy-deep); color: var(--color-unergy-avena); padding: 10px 14px; min-width: 220px;"
            :style="{ left: tooltipX + 'px', top: tooltipY + 'px', transform: 'translateY(-100%)' }"
          >
            <div class="font-bold mb-2" style="color: #F0C040;">
              {{ MESES[chartMeses[hovered].month - 1] }} {{ selectedYear }}
            </div>
            <div class="space-y-1">
              <div class="flex justify-between gap-6">
                <span style="color: rgba(253,250,247,0.65);">Precio bolsa</span>
                <span class="font-mono">{{ chartMeses[hovered].precio_bolsa_avg ? fmtPrecio(chartMeses[hovered].precio_bolsa_avg) : '—' }}</span>
              </div>
              <div class="flex justify-between gap-6">
                <span style="color: #D64455;">Compras</span>
                <span class="font-mono font-semibold" style="color: #D64455;">{{ fmtCop(chartMeses[hovered].compras_cop) }}</span>
              </div>
              <div class="flex justify-between gap-6">
                <span style="color: #F0C040;">Excedentes</span>
                <span class="font-mono font-semibold" style="color: #9a6700;">{{ fmtCop(chartMeses[hovered].excedentes_cop) }}</span>
              </div>
              <div class="flex justify-between gap-6 mt-2 pt-2" style="border-top: 1px solid rgba(255,255,255,0.1);">
                <span style="color: rgba(253,250,247,0.65);">Neto</span>
                <span class="font-mono font-bold" :style="{ color: (chartMeses[hovered].compras_cop - chartMeses[hovered].excedentes_cop) > 0 ? '#D64455' : '#2e7d32' }">
                  {{ fmtCop(chartMeses[hovered].compras_cop - chartMeses[hovered].excedentes_cop) }}
                </span>
              </div>
            </div>
            <div class="mt-2 pt-1 text-xs" style="color: rgba(253,250,247,0.35);">Clic para ver contratos</div>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-5 mt-3 pl-1">
          <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: rgba(214,68,85,0.85);"></div>Compras en bolsa (costo)</div>
          <div class="flex items-center gap-2 text-xs" style="color: #7a6e8a;"><div class="w-4 h-4 rounded-sm" style="background: rgba(240,192,64,0.85);"></div>Excedentes en bolsa (ingreso)</div>
        </div>
      </div>

      <!-- Monthly summary table -->
      <div>
        <h2 class="text-base font-semibold mb-3" style="color: var(--color-unergy-deep);">Resumen mensual — {{ selectedYear }}</h2>
        <DataTable
          :value="data.meses"
          size="small"
          stripedRows
          class="border rounded-xl overflow-hidden cursor-pointer"
          style="border-color: rgba(44,32,57,0.12);"
          @row-click="e => toggleMonth(e.data.month)"
          :rowClass="row => expandedMonth === row.month ? 'row-selected' : ''"
        >
          <Column header="Mes" style="min-width: 100px;">
            <template #body="{ data: row }">
              <span class="font-semibold text-sm" style="color: var(--color-unergy-deep);">{{ MESES[row.month - 1] }}</span>
            </template>
          </Column>
          <Column header="Precio Bolsa" style="width: 130px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.precio_bolsa_avg" class="font-mono text-sm">{{ fmtPrecio(row.precio_bolsa_avg) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">Sin datos</span>
            </template>
          </Column>
          <Column header="Días" style="width: 70px; text-align: center;">
            <template #body="{ data: row }">
              <span class="font-mono text-sm" :style="{ color: row.dias_con_precios > 0 ? 'var(--color-unergy-deep)' : '#b0a0c0' }">{{ row.dias_con_precios }}</span>
            </template>
          </Column>
          <Column header="Compras MWh" style="width: 130px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.compras_mwh > 0" class="font-mono text-sm" style="color: #D64455;">{{ fmtMwh(row.compras_mwh) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
            </template>
          </Column>
          <Column header="Compras COP" style="width: 150px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.compras_cop > 0" class="font-mono text-sm font-semibold" style="color: #D64455;">{{ fmtCop(row.compras_cop) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
            </template>
          </Column>
          <Column header="Excedentes MWh" style="width: 140px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.excedentes_mwh > 0" class="font-mono text-sm" style="color: #9a6700;">{{ fmtMwh(row.excedentes_mwh) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
            </template>
          </Column>
          <Column header="Excedentes COP" style="width: 150px; text-align: right;">
            <template #body="{ data: row }">
              <span v-if="row.excedentes_cop > 0" class="font-mono text-sm font-semibold" style="color: #9a6700;">{{ fmtCop(row.excedentes_cop) }}</span>
              <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
            </template>
          </Column>
          <Column style="width: 44px; text-align: center;">
            <template #body="{ data: row }">
              <ChevronDownIcon v-if="expandedMonth === row.month" class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
              <ChevronRightIcon v-else class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
            </template>
          </Column>
        </DataTable>
      </div>

      <!-- Expanded month — contract breakdown -->
      <template v-if="expandedMonth && expandedContratos.length > 0">
        <div class="rounded-xl border overflow-hidden" style="background: white; border-color: rgba(145,91,216,0.25);">
          <div class="px-5 py-3 flex items-center justify-between" style="background: rgba(145,91,216,0.06); border-bottom: 1px solid rgba(145,91,216,0.12);">
            <div>
              <span class="font-bold text-base" style="color: var(--color-unergy-deep);">{{ MESES[expandedMonth - 1] }} {{ selectedYear }}</span>
              <span class="ml-2 text-xs" style="color: #7a6e8a;">{{ expandedContratos.length }} contratos con descubrimientos</span>
            </div>
            <button class="rounded-lg p-1.5" style="color: #7a6e8a;" @click="expandedMonth = null">
              <XIcon class="text-sm size-[1em]" />
            </button>
          </div>
          <div class="px-5 py-4">
            <table class="w-full text-sm">
              <thead>
                <tr style="color: #7a6e8a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                  <th class="text-left pb-2">Contrato</th>
                  <th class="text-right pb-2">Mín MWh</th>
                  <th class="text-right pb-2">Máx MWh</th>
                  <th class="text-right pb-2">Gen. Asig.</th>
                  <th class="text-right pb-2">Compras</th>
                  <th class="text-right pb-2">Excedentes</th>
                  <th class="text-right pb-2">Sobrecosto PPA</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in expandedContratos" :key="c.contrato_id" style="border-top: 1px solid rgba(44,32,57,0.06);">
                  <td class="py-2 pr-2">
                    <div class="font-medium" style="color: var(--color-unergy-deep);">{{ c.nombre }}</div>
                    <div class="text-xs" style="color: #7a6e8a;">{{ c.comprador }}</div>
                  </td>
                  <td class="py-2 px-2 text-right font-mono" style="color: #7a6e8a;">{{ fmtMwh(c.min_mwh) }}</td>
                  <td class="py-2 px-2 text-right font-mono" style="color: #7a6e8a;">{{ fmtMwh(c.max_mwh) }}</td>
                  <td class="py-2 px-2 text-right font-mono" style="color: var(--color-unergy-purple);">{{ fmtMwh(c.gen_asignada_mwh) }}</td>
                  <td class="py-2 px-2 text-right">
                    <div v-if="c.compras_cop > 0">
                      <span class="font-mono font-semibold" style="color: #D64455;">{{ fmtCop(c.compras_cop) }}</span>
                      <div class="text-xs font-mono" style="color: #7a6e8a;">{{ fmtMwh(c.compras_mwh) }} MWh</div>
                    </div>
                    <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
                  </td>
                  <td class="py-2 px-2 text-right">
                    <div v-if="c.excedentes_cop > 0">
                      <span class="font-mono font-semibold" style="color: #9a6700;">{{ fmtCop(c.excedentes_cop) }}</span>
                      <div class="text-xs font-mono" style="color: #7a6e8a;">{{ fmtMwh(c.excedentes_mwh) }} MWh</div>
                    </div>
                    <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
                  </td>
                  <td class="py-2 pl-2 text-right">
                    <span v-if="c.sobrecosto_vs_ppa_cop !== null" class="font-mono text-sm" :style="{ color: c.sobrecosto_vs_ppa_cop > 0 ? '#D64455' : '#2e7d32' }">
                      {{ fmtCop(c.sobrecosto_vs_ppa_cop) }}
                    </span>
                    <span v-else class="text-xs" style="color: #b0a0c0;">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- Empty expanded state -->
      <div v-else-if="expandedMonth" class="text-center py-8 rounded-xl border" style="color: #7a6e8a; border-color: rgba(44,32,57,0.10);">
        <CircleCheckIcon class="text-3xl mb-2 block size-[1em]" style="color: #2e7d32;" />
        <p>Sin descubrimientos en {{ MESES[expandedMonth - 1] }} — toda la generación dentro de compromisos.</p>
      </div>

    </template>

    <!-- Empty state -->
    <div v-else-if="!loading && !error" class="text-center py-16 rounded-xl border" style="color: #7a6e8a; border-color: rgba(44,32,57,0.10);">
      <ZapIcon class="text-4xl mb-3 block size-[1em]" style="color: var(--color-unergy-purple);" />
      <p>Selecciona un rango de meses para ver los descubrimientos.</p>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { CumplimientoService } from '~/features/mem/services/cumplimiento'
import { ChevronDownIcon, ChevronRightIcon, CircleCheckIcon, XIcon, ZapIcon } from '@lucide/vue'

const cumplimientoService = new CumplimientoService()

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_OPTIONS = MESES.map((m, i) => ({ label: m, value: i + 1 }))

const now = new Date()
const years = Array.from({ length: 18 }, (_, i) => 2024 + i)

const selectedYear = ref(now.getFullYear())
const monthFrom = ref(1)
const monthTo = ref(12)
const data = ref(null)
const loading = ref(false)
const error = ref(null)
const expandedMonth = ref(null)
const hovered = ref(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
const chartBox = ref(null)

// ── Chart constants ──────────────────────────────────────────────────────────
const SVG_W = 820
const SVG_H = 300
const PAD_L = 72
const PAD_R = 22
const PAD_T = 18
const PAD_B = 42
const PLOT_W = SVG_W - PAD_L - PAD_R
const PLOT_H = SVG_H - PAD_T - PAD_B

const chartMeses = computed(() => data.value?.meses || [])
const N = computed(() => chartMeses.value.length || 12)
const slotW = computed(() => PLOT_W / (N.value || 1))
const barHalfW = computed(() => slotW.value * 0.24)

const yAbsMax = computed(() => {
  let m = 0
  for (const mes of chartMeses.value) {
    m = Math.max(m, mes.compras_cop || 0, mes.excedentes_cop || 0)
  }
  return m > 0 ? m * 1.2 : 1000000
})

const zeroY = computed(() => PAD_T + PLOT_H / 2)

const yGridLines = computed(() => {
  const step = niceStep(yAbsMax.value)
  const lines = []
  for (let v = step; v <= yAbsMax.value; v += step) {
    lines.push({ val: v, y: toY(v) })
    lines.push({ val: -v, y: toY(-v) })
  }
  lines.push({ val: 0, y: zeroY.value })
  return lines
})

function niceStep(max) {
  const rough = max / 3
  const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
  const mult = rough / mag
  if (mult < 1.5) return mag
  if (mult < 3.5) return 2 * mag
  if (mult < 7.5) return 5 * mag
  return 10 * mag
}

function toY(val) {
  return zeroY.value - (val / yAbsMax.value) * (PLOT_H / 2)
}

function slotX(i) { return PAD_L + i * slotW.value }
function barX(i) { return PAD_L + i * slotW.value + (slotW.value - barHalfW.value * 2 - 2) / 2 }

// ── Chart interaction ────────────────────────────────────────────────────────
function monthIdxFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const svgX = (event.clientX - rect.left) * (SVG_W / rect.width)
  const idx = Math.floor((svgX - PAD_L) / slotW.value)
  return (idx >= 0 && idx < N.value && svgX >= PAD_L) ? idx : null
}

function onSvgMousemove(event) {
  const idx = monthIdxFromEvent(event)
  hovered.value = idx
  if (idx !== null && chartBox.value) {
    const r = chartBox.value.getBoundingClientRect()
    tooltipX.value = Math.min(event.clientX - r.left + 12, r.width - 240)
    tooltipY.value = event.clientY - r.top - 10
  }
}

function onSvgClick(event) {
  const idx = monthIdxFromEvent(event)
  if (idx === null || !chartMeses.value[idx]) return
  toggleMonth(chartMeses.value[idx].month)
}

// ── Computed ─────────────────────────────────────────────────────────────────
const mesesConDatos = computed(() => {
  if (!data.value) return 0
  return data.value.meses.filter(m => m.dias_con_precios > 0).length
})

const expandedContratos = computed(() => {
  if (!expandedMonth.value || !data.value) return []
  const mes = data.value.meses.find(m => m.month === expandedMonth.value)
  return mes?.contratos || []
})

// ── Actions ──────────────────────────────────────────────────────────────────
function toggleMonth(month) {
  expandedMonth.value = expandedMonth.value === month ? null : month
}

async function loadData() {
  if (monthFrom.value > monthTo.value) return
  loading.value = true
  error.value = null
  data.value = null
  expandedMonth.value = null
  try {
    data.value = await cumplimientoService.obtenerDescubrimientos({
      year: selectedYear.value, month_from: monthFrom.value, month_to: monthTo.value,
    })
  } catch (e) {
    error.value = e.data?.detail || 'Error al cargar descubrimientos'
  } finally {
    loading.value = false
  }
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmtCop(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return (v < 0 ? '-' : '') + '$' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (v < 0 ? '-' : '') + '$' + Math.round(abs).toLocaleString('es-CO')
  return '$' + Math.round(v).toLocaleString('es-CO')
}

function fmtMwh(v) {
  if (v == null) return '—'
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('es-CO')
}

function fmtPrecio(v) {
  if (v == null) return '—'
  return '$' + v.toFixed(2) + '/kWh'
}

function fmtShort(val) {
  const abs = Math.abs(val)
  if (abs >= 1e9) return (val < 0 ? '-' : '') + (abs / 1e9).toFixed(0) + 'B'
  if (abs >= 1e6) return (val < 0 ? '-' : '') + (abs / 1e6).toFixed(0) + 'M'
  if (abs >= 1e3) return (val < 0 ? '-' : '') + (abs / 1e3).toFixed(0) + 'K'
  return Math.round(val).toString()
}

onMounted(loadData)
</script>

<style scoped>
:deep(.p-datatable .p-datatable-thead > tr > th) {
  background: rgba(145, 91, 216, 0.06);
  color: #7a6e8a;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(44, 32, 57, 0.10);
}
:deep(.p-datatable .p-datatable-tbody > tr) {
  background: white;
}
:deep(.p-datatable .p-datatable-tbody > tr:nth-child(even)) {
  background: rgba(253, 250, 247, 0.6);
}
:deep(.p-datatable .p-datatable-tbody > tr > td) {
  border-bottom: 1px solid rgba(44, 32, 57, 0.06);
  padding: 10px 12px;
}
:deep(.p-datatable .p-datatable-tbody > tr.row-selected) {
  background: rgba(145, 91, 216, 0.08) !important;
}
:deep(.p-datatable .p-datatable-tbody > tr.row-selected > td) {
  border-bottom-color: rgba(145, 91, 216, 0.15);
}
</style>
