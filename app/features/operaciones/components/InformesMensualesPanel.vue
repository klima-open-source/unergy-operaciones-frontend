<template>
  <div class="im-wrap">

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastMsg" :class="['im-toast', toastErr ? 'im-toast-err' : 'im-toast-ok']">
        {{ toastMsg }}
      </div>
    </transition>

    <!-- ══ Toolbar de configuración ═══════════════════════════════════ -->
    <section class="im-toolbar im-no-print">
      <!-- Tipo de informe -->
      <div class="im-row im-row-top">
        <div class="im-segmented im-segmented-lg">
          <button v-for="t in TIPOS" :key="t.key" class="im-seg-btn"
                  :class="{ 'im-seg-btn--active': tipo === t.key }"
                  @click="cambiarTipo(t.key)">
            <component :is="t.icon" class="size-[1em]" /> {{ t.label }}
          </button>
        </div>

        <div class="im-tip">
          <InfoIcon class="size-[1em]" />
          <span>{{ TIPOS.find(t => t.key === tipo)?.tip }}</span>
        </div>
      </div>

      <!-- Banner: días para entrega FMO -->
      <div v-if="tipo === 'fmo'" :class="['im-deadline', deadlineCls]">
        <div class="im-deadline-left">
          <CalendarClockIcon class="size-[1em]" />
          <span>Entrega informe FMO — primeros <b>5 días</b> del mes</span>
        </div>
        <div class="im-deadline-right">{{ deadlineLabel }}</div>
      </div>

      <!-- Selectores -->
      <div class="im-row">
        <!-- Proyecto (operacional individual y FMO) -->
        <div v-if="tipo === 'proyecto' || tipo === 'fmo'" class="im-field">
          <label class="im-label">{{ tipo === 'fmo' ? 'Proyecto con contrato FMO' : 'Proyecto' }}</label>
          <Select v-model="proyectoSel" :options="opcionesProyecto" optionLabel="label" optionValue="value"
                  :filter="true" filterPlaceholder="Buscar…" placeholder="Selecciona un proyecto…"
                  class="im-select" :loading="loadingCatalogos" />
        </div>

        <!-- Ranking vs P90: alcance (portafolio / proyectos) -->
        <div v-if="tipo === 'ranking'" class="im-field im-field-narrow">
          <label class="im-label">Alcance</label>
          <div class="im-segmented">
            <button class="im-seg-btn" :class="{ 'im-seg-btn--active': rankingScope === 'portafolio' }"
                    @click="rankingScope = 'portafolio'">Portafolio</button>
            <button class="im-seg-btn" :class="{ 'im-seg-btn--active': rankingScope === 'proyectos' }"
                    @click="rankingScope = 'proyectos'">Proyectos</button>
          </div>
        </div>

        <!-- Ranking por proyectos: multiselección -->
        <div v-if="tipo === 'ranking' && rankingScope === 'proyectos'" class="im-field">
          <label class="im-label">Proyectos (uno o varios)</label>
          <MultiSelect v-model="proyectosSel" :options="opcionesProyecto" optionLabel="label" optionValue="value"
                       :filter="true" filterPlaceholder="Buscar…" placeholder="Selecciona proyectos…"
                       display="chip" class="im-select" :loading="loadingCatalogos" />
        </div>

        <!-- Portafolio (tipo portafolio o ranking por portafolio) -->
        <div v-if="tipo === 'portafolio' || (tipo === 'ranking' && rankingScope === 'portafolio')" class="im-field">
          <label class="im-label">Portafolio / Cliente</label>
          <Select v-model="portafolioSel" :options="opcionesPortafolio" optionLabel="label" optionValue="value"
                  :filter="true" filterPlaceholder="Buscar…" placeholder="Selecciona un portafolio…"
                  class="im-select" :loading="loadingCatalogos">
            <template #option="{ option }">
              <div class="flex items-center justify-between gap-3 w-full">
                <span>{{ option.label }}</span>
                <span class="text-[10px] text-gray-400">{{ option.count }} proyecto{{ option.count !== 1 ? 's' : '' }}</span>
              </div>
            </template>
          </Select>
        </div>

        <!-- Modo de período -->
        <div class="im-field im-field-narrow">
          <label class="im-label">Período</label>
          <div class="im-segmented">
            <button class="im-seg-btn" :class="{ 'im-seg-btn--active': periodoMode === 'mes' }"
                    @click="periodoMode = 'mes'">Mensual</button>
            <button v-if="tipo !== 'fmo'" class="im-seg-btn"
                    :class="{ 'im-seg-btn--active': periodoMode === 'custom' }"
                    @click="periodoMode = 'custom'">Rango</button>
          </div>
        </div>

        <!-- Mes -->
        <div v-if="periodoMode === 'mes'" class="im-field im-field-narrow">
          <label class="im-label">Mes</label>
          <input type="month" v-model="mesSel" :max="mesMax" class="im-input" />
        </div>

        <!-- Rango custom (no FMO) -->
        <div v-if="periodoMode === 'custom' && tipo !== 'fmo'" class="im-field im-field-narrow">
          <label class="im-label">Desde</label>
          <input type="date" v-model="customDesde" :max="hoyISO" class="im-input" />
        </div>
        <div v-if="periodoMode === 'custom' && tipo !== 'fmo'" class="im-field im-field-narrow">
          <label class="im-label">Hasta</label>
          <input type="date" v-model="customHasta" :max="hoyISO" class="im-input" />
        </div>

        <!-- Acción principal -->
        <div class="im-field im-field-actions">
          <Button label="Generar" size="small" :loading="generando" :disabled="!puedeGenerar" @click="generar" class="im-btn-primary">
            <template #icon><SettingsIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </section>

    <!-- ══ Estados ════════════════════════════════════════════════════ -->
    <div v-if="loadingCatalogos && !catalogosListos" class="im-empty im-no-print">
      <ProgressSpinner style="width:36px;height:36px" />
      <p class="im-empty-title">Cargando catálogos…</p>
      <p class="im-empty-sub">Consultando proyectos, portafolios y contratos.</p>
    </div>

    <div v-else-if="generando" class="im-empty im-no-print">
      <ProgressSpinner style="width:36px;height:36px" />
      <p class="im-empty-title">{{ loadingMsg }}</p>
      <p class="im-empty-sub">{{ loadingSub }}</p>
    </div>

    <div v-else-if="error" class="im-error im-no-print">
      <CircleAlertIcon class="text-2xl text-red-500 size-[1em]" />
      <div class="flex-1">
        <p class="font-semibold text-red-700">{{ error.title || 'No se pudo generar el informe' }}</p>
        <p class="text-sm text-gray-600 mt-0.5">{{ error.detail || error.message || '' }}</p>
      </div>
      <Button label="Reintentar" outlined size="small" @click="generar">
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <div v-else-if="!htmlContent" class="im-empty im-no-print">
      <FilePenIcon class="text-4xl size-[1em]" style="color:var(--color-unergy-purple)" />
      <p class="im-empty-title">Listo para generar</p>
      <p class="im-empty-sub">Selecciona el tipo de informe, proyecto/portafolio y período, luego presiona <b>Generar informe</b>.</p>
    </div>

    <!-- ══ Resultado + acciones ════════════════════════════════════════ -->
    <template v-else>
      <section class="im-result-bar im-no-print">
        <div class="im-result-meta">
          <span class="im-result-pill" :class="`im-pill-${tipo}`">
            {{ tipo === 'fmo' ? 'FMO' : tipo === 'portafolio' ? 'Portafolio' : tipo === 'ranking' ? 'Ranking vs P90' : 'Operacional' }}
          </span>
          <span class="im-result-title">{{ resultTitle }}</span>
          <span class="im-result-sub">· {{ rangeLabel }}</span>
        </div>
        <div class="im-result-actions">
          <Button outlined severity="secondary" size="small" :disabled="guardando" @click="descartar" v-tooltip.bottom="'Descartar y volver al wizard'">
            <template #icon><XIcon class="size-[1em]" /></template>
          </Button>
          <Button label="PDF" outlined size="small" severity="warn" @click="imprimir" v-tooltip.bottom="'Imprimir o exportar a PDF'">
            <template #icon><PrinterIcon class="size-[1em]" /></template>
          </Button>
          <Button :label="guardando ? 'Guardando…' : (informeIdGuardado ? 'Actualizar' : 'Guardar')" :loading="guardando" size="small" class="im-btn-primary" @click="guardar" v-tooltip.bottom="'Guardar como borrador para revisión/aprobación'">
            <template #icon><SaveIcon class="size-[1em]" /></template>
          </Button>
          <Button v-if="informeIdGuardado" outlined size="small" @click="abrirEditor" v-tooltip.bottom="'Abrir en el editor (flujo de aprobación)'">
            <template #icon><ArrowRightIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </section>

      <!-- Reporte HTML embebido -->
      <div class="im-report-frame">
        <div ref="reportRef" class="im-report" v-html="htmlContent" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { logger } from '~/core/logger'
import { InformesService } from '~/features/operaciones/services/informes'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { FallasService } from '~/features/fallas/services/fallas'
import { buildReportHtmlDoc } from '~/features/operaciones/utils/rptStyles'
import { tituloFalla } from '~/features/fallas/utils/fallaTitulo'
import { ArrowRightIcon, CalendarClockIcon, ChartColumnIcon, CircleAlertIcon, FilePenIcon, InfoIcon, LayoutGridIcon, PrinterIcon, RefreshCwIcon, SaveIcon, SettingsIcon, XIcon, ZapIcon } from '@lucide/vue'

const router = useRouter()
const informesService = new InformesService()
const monitoreoLegacyService = new MonitoreoLegacyService()
const fallasService = new FallasService()

// ── Constantes ─────────────────────────────────────────────────────────
const TIPOS = [
  { key: 'proyecto',   label: 'Por proyecto',    icon: ZapIcon,          tip: 'Operacional individual con KPIs, semanal y eventos.' },
  { key: 'portafolio', label: 'Por portafolio',  icon: LayoutGridIcon,      tip: 'Consolidado del cliente + páginas por proyecto.' },
  { key: 'fmo',        label: 'FMO (O&M)',       icon: FilePenIcon,     tip: 'Contrato O&M: disponibilidad, SLA, multas, inversores.' },
  { key: 'ranking',    label: 'Ranking vs P90',  icon: ChartColumnIcon,     tip: 'Solo el gráfico de generación por proyecto vs P90 (un gráfico por mes).' },
]
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Estado ─────────────────────────────────────────────────────────────
const tipo = ref('proyecto')
const periodoMode = ref('mes')
const proyectoSel = ref('')
const portafolioSel = ref('')
const rankingScope = ref('portafolio')   // 'portafolio' | 'proyectos' (solo tipo === 'ranking')
const proyectosSel = ref([])             // sub_projects seleccionados (ranking por proyectos)
const today = new Date()
const hoyISO = today.toISOString().slice(0, 10)
const mesMax = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const mesSel = ref(mesMax)
const customDesde = ref('')
const customHasta = ref('')

const proyectos = ref([])            // proyectos en operación con sub_project
const portafolios = ref({})          // { portafolio_name: [proyecto_name, ...] }
const contratosFmo = ref([])         // proyectos con contrato O&M
const fallas = ref([])               // todas las fallas (filtradas localmente por período + proyecto)
const loadingCatalogos = ref(false)
const catalogosListos = ref(false)

const generando = ref(false)
const guardando = ref(false)
const loadingMsg = ref('')
const loadingSub = ref('')
const error = ref(null)

const htmlContent = ref('')           // HTML del informe generado
const resultTitle = ref('')
const rangeLabel = ref('')
const reportRef = ref(null)
const informeIdGuardado = ref(null)   // id luego de guardar
const ultimoSubProject = ref('')      // para upsert
const ultimoRange = ref(null)
const ultimoTipo = ref('')            // 'op' | 'fmo' | 'port' del último generado
const ultimaConsolidada = ref('')     // portafolio: HTML de la página consolidada (sin secciones)
const ultimosMiembros = ref([])       // portafolio: [{ sub_project, nombre, orden, html }]
const toastMsg = ref('')
const toastErr = ref(false)
let _toastTimer = null

// ── Computados ─────────────────────────────────────────────────────────

const opcionesProyecto = computed(() => {
  const lista = tipo.value === 'fmo'
    ? contratosFmo.value.map(c => ({
        value: c.sub_project,
        label: c.nombre_clientes || c.sub_project,
      }))
    : proyectos.value.map(p => ({
        value: p.sub_project,
        label: p.nombre_display || p.nombre_clientes || p.nombre_comercial || p.sub_project,
      }))
  return [...lista].sort((a, b) => a.label.localeCompare(b.label, 'es'))
})

const opcionesPortafolio = computed(() => {
  return Object.entries(portafolios.value)
    .map(([name, projs]) => ({ value: name, label: name, count: projs.length }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
})

const puedeGenerar = computed(() => {
  if (generando.value || !catalogosListos.value) return false
  if (tipo.value === 'proyecto' || tipo.value === 'fmo') {
    if (!proyectoSel.value) return false
  } else if (tipo.value === 'portafolio') {
    if (!portafolioSel.value) return false
  } else if (tipo.value === 'ranking') {
    if (rankingScope.value === 'portafolio' && !portafolioSel.value) return false
    if (rankingScope.value === 'proyectos' && !proyectosSel.value.length) return false
  }
  if (periodoMode.value === 'mes') {
    return !!mesSel.value
  }
  return !!customDesde.value && !!customHasta.value && customDesde.value <= customHasta.value
})

const deadlineLabel = computed(() => {
  const now = new Date()
  const day = now.getDate()
  const deadline = day <= 5
    ? new Date(now.getFullYear(), now.getMonth(), 5)
    : new Date(now.getFullYear(), now.getMonth() + 1, 5)
  const diff = Math.ceil((deadline - now) / 86400000)
  if (diff < 0) return `⚠️ VENCIDO hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}`
  if (diff === 0) return '⚠️ Hoy es el último día'
  if (diff <= 3) return `🔴 Quedan ${diff} día${diff !== 1 ? 's' : ''}`
  if (diff <= 7) return `🟡 Quedan ${diff} días`
  return `✅ Quedan ${diff} días`
})
const deadlineCls = computed(() => {
  const now = new Date()
  const day = now.getDate()
  const deadline = day <= 5
    ? new Date(now.getFullYear(), now.getMonth(), 5)
    : new Date(now.getFullYear(), now.getMonth() + 1, 5)
  const diff = Math.ceil((deadline - now) / 86400000)
  if (diff < 0 || diff <= 3) return 'im-deadline--red'
  if (diff <= 7) return 'im-deadline--yellow'
  return 'im-deadline--green'
})

// ── Acciones ───────────────────────────────────────────────────────────
function cambiarTipo(t) {
  if (tipo.value === t) return
  tipo.value = t
  if (t === 'fmo') periodoMode.value = 'mes'
  // No se borra el resultado; se mantiene visible hasta que se descarte o se genere otro
}

function descartar() {
  htmlContent.value = ''
  resultTitle.value = ''
  rangeLabel.value = ''
  informeIdGuardado.value = null
  ultimoSubProject.value = ''
  ultimoRange.value = null
  error.value = null
}

function imprimir() {
  if (!reportRef.value) return
  const html = reportRef.value.innerHTML
  if (!html) return
  const w = window.open('', '_blank', 'width=920,height=700')
  if (!w) {
    // fallback: impresión de la página completa si los popups están bloqueados
    document.body.classList.add('im-printing')
    window.print()
    setTimeout(() => document.body.classList.remove('im-printing'), 300)
    return
  }
  // El Ranking vs P90 se imprime con auto-ajuste: cada mes se escala para caber en una sola hoja.
  const autoFit = tipo.value === 'ranking'
  const doc = buildReportHtmlDoc(html, {
    title:  resultTitle.value || 'Informe Operacional',
    bgGray: false,
    autoFit,
  })
  w.document.open()
  w.document.write(doc)
  w.document.close()
  w.focus()
  // Con autoFit, el propio documento ajusta y dispara print(). Si no, esperamos a la fuente Sora.
  if (!autoFit) setTimeout(() => w.print(), 700)
}

function abrirEditor() {
  if (informeIdGuardado.value) router.push(`/informes/${informeIdGuardado.value}`)
}

function toast(msg, isErr = false) {
  toastMsg.value = msg
  toastErr.value = isErr
  if (_toastTimer) clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => { toastMsg.value = '' }, 4200)
}

// ── Catálogos ──────────────────────────────────────────────────────────
async function cargarCatalogos() {
  loadingCatalogos.value = true
  try {
    const [projRes, portRes, contRes, falRes] = await Promise.allSettled([
      monitoreoLegacyService.obtenerProyectos(),
      monitoreoLegacyService.obtenerPortafolios(),
      monitoreoLegacyService.obtenerTodosLosContratos(),
      cargarFallas(),
    ])
    if (projRes.status === 'fulfilled' && projRes.value?.projects) {
      proyectos.value = (projRes.value.projects || []).filter(p => p.sub_project)
    }
    if (portRes.status === 'fulfilled' && portRes.value?.portfolios) {
      portafolios.value = portRes.value.portfolios || {}
    }
    if (contRes.status === 'fulfilled' && contRes.value?.contratos) {
      contratosFmo.value = (contRes.value.contratos || []).filter(c => c.sub_project)
    }
    catalogosListos.value = true
  } catch (e) {
    error.value = { title: 'Error al cargar catálogos', detail: e.data?.detail || e.message }
  } finally {
    loadingCatalogos.value = false
  }
}

async function cargarFallas() {
  try {
    const primera = await fallasService.listar({ page: 1, size: 200 })
    const total = primera.total ?? 0
    const items = [...(primera.items ?? [])]
    if (total > 200) {
      const totalPages = Math.ceil(total / 200)
      const restResults = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fallasService.listar({ page: i + 2, size: 200 })
        )
      )
      for (const r of restResults) {
        if (r.status === 'fulfilled') items.push(...(r.value.items ?? []))
      }
    }
    fallas.value = items
  } catch { /* no crítico */ }
}

onMounted(cargarCatalogos)

// ── Resolver rango ─────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }
function buildRange() {
  if (periodoMode.value === 'mes' || tipo.value === 'fmo') {
    if (!mesSel.value) return null
    const [y, m] = mesSel.value.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return {
      from: `${y}-${pad(m)}-01`,
      to: `${y}-${pad(m)}-${pad(last)}`,
      year: y, month: m, monthName: MESES[m - 1], lastDay: last,
      label: `${MESES[m - 1]} ${y}`, headerPeriod: `${MESES[m - 1]} ${y}`,
      isCustom: false, totalDays: last,
    }
  }
  if (!customDesde.value || !customHasta.value) return null
  const [y, m, d] = customDesde.value.split('-').map(Number)
  const [y2, m2, d2] = customHasta.value.split('-').map(Number)
  const totalDays = Math.round((new Date(customHasta.value) - new Date(customDesde.value)) / 86400000) + 1
  const label = `${pad(d)}/${pad(m)}/${y} – ${pad(d2)}/${pad(m2)}/${y2}`
  return {
    from: customDesde.value, to: customHasta.value, year: y, month: m, monthName: MESES[m - 1],
    lastDay: d2, label, headerPeriod: label, isCustom: true, totalDays,
  }
}

// Lista de meses completos a graficar (uno por mes). En modo "mes" devuelve 1;
// en "rango" enumera cada mes calendario tocado por el rango (mes completo).
function monthsInRange() {
  if (periodoMode.value === 'mes') {
    if (!mesSel.value) return []
    const [y, m] = mesSel.value.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return [{ from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}`, label: `${MESES[m - 1]} ${y}` }]
  }
  if (!customDesde.value || !customHasta.value) return []
  const [y1, m1] = customDesde.value.split('-').map(Number)
  const [y2, m2] = customHasta.value.split('-').map(Number)
  const out = []
  let yy = y1, mm = m1
  while ((yy < y2 || (yy === y2 && mm <= m2)) && out.length < 36) {
    const last = new Date(yy, mm, 0).getDate()
    out.push({ from: `${yy}-${pad(mm)}-01`, to: `${yy}-${pad(mm)}-${pad(last)}`, label: `${MESES[mm - 1]} ${yy}` })
    mm++; if (mm > 12) { mm = 1; yy++ }
  }
  return out
}

// Página de informe que contiene ÚNICAMENTE el ranking de generación vs P90 de un mes.
function buildRankingPage(scopeLabel, monthLabel, items) {
  const conP90 = items.filter(i => i.p90 > 0).length
  const overP90 = items.filter(i => i.p90 > 0 && i.real >= i.p90).length
  const chart = svgRankingP90Chart(items)
  const fmt = (n) => Math.round(n).toLocaleString('es-CO')

  // Proyectos por debajo de P90 → nota editable (causa · estado · acción)
  const bajoP90 = items.filter(i => i.p90 > 0 && i.real < i.p90)
  let notasHtml
  if (bajoP90.length) {
    const slug = monthLabel.replace(/[^\w]/g, '').toLowerCase()
    const filas = bajoP90.map((it, i) => {
      const pct = (it.real - it.p90) / it.p90 * 100
      const pctStr = `${pct.toFixed(1)}%`
      return '<div class="rpt-nota-item" style="border:1px solid #EDE8F5;border-radius:8px;padding:8px 10px;background:#FCFAFF;margin-bottom:8px">' +
        `<div style="font-size:11px;font-weight:800;color:#2C2039;margin-bottom:4px">${esc(it.name)} ` +
        `<span style="color:#DC2626;font-weight:800">${pctStr}</span> ` +
        `<span style="color:#6B5F80;font-weight:600">· Real ${fmt(it.real)} / P90 ${fmt(it.p90)} kWh</span></div>` +
        `<div class="rpt-obs-editable" contenteditable="true" data-obs="rank-${slug}-${i}" ` +
        'style="min-height:42px;outline:none;border:1px solid #EDE8F5;border-radius:6px;padding:8px 10px;background:#fff;font-size:11px;color:#3D2D5C;line-height:1.6">' +
        'Causa: — · Estado: — · Acción tomada: —</div>'
        + '</div>'
    }).join('')
    notasHtml =
      '<div class="rpt-section"><div class="rpt-section-title">▌ Proyectos fuera de P90 — Causa, estado y acción ' +
      '<span class="rpt-edit-hint">✏️ clic para editar (1–5 líneas por proyecto)</span></div>' +
      filas + '</div>'
  } else {
    notasHtml =
      '<div class="rpt-section"><div class="rpt-section-title">▌ Proyectos fuera de P90</div>' +
      '<div style="font-size:12px;color:#16A34A;font-weight:700">✅ Todos los proyectos del período se encuentran en o por encima de P90.</div></div>'
  }

  return '<div class="rpt-page">' +
    '<div class="rpt-header">' +
    '<div style="display:flex;align-items:center;gap:13px">' + unergyLogoSVG() +
    '<div><div style="color:#fff;font-size:14px;font-weight:800;letter-spacing:.8px">GENERACIÓN POR PROYECTO — RANKING vs P90</div>' +
    '<div style="color:#6B5F80;font-size:10px;letter-spacing:.6px;margin-top:2px">Unergy Energía Digital S.A.S ESP | Operación &amp; Mantenimiento</div></div></div>' +
    `<div class="rpt-meta-grid">${rmeta('ALCANCE', scopeLabel)}${rmeta('PERÍODO', monthLabel)}${rmeta('PROYECTOS', String(items.length))}${rmeta('SOBRE P90', `${overP90} / ${conP90}`)}</div>` +
    '</div>' +
    `<div class="rpt-section"><div class="rpt-section-title">▌ Generación por Proyecto — Ranking vs P90 · ${esc(monthLabel)}</div>` +
    `<div class="rpt-chart-card">${chart}</div></div>` +
    notasHtml +
    '</div>'
}

// ── Helpers ────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtD = (iso) => {
  if (!iso) return '—'
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
const nextMes = (m) => MESES[m === 12 ? 0 : m]

// Normaliza un nombre para cruzar entre sistemas: minúsculas, sin acentos ni
// espacios extra (los nombres de proyecto difieren entre /fallas y getProjects).
function normNombre(s) {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function getFaultsForRange(proyectoCfg, range) {
  // El endpoint `getProjects` no devuelve `id`, así que cruzamos por nombre.
  // Se comparan TODOS los alias del proyecto (comercial, clientes, bitácora,
  // display, sub_project) contra TODOS los alias que trae la falla, para no
  // perder fallas cuando el nombre difiere entre sistemas.
  const candidatos = new Set([
    proyectoCfg.nombre_comercial,
    proyectoCfg.nombre_clientes,
    proyectoCfg.nombre_display,
    proyectoCfg.nombre_bitacora,
    proyectoCfg.sub_project,
  ].filter(Boolean).map(normNombre))
  return fallas.value.filter(f => {
    if (!f.fecha_identificacion) return false
    const fecha = f.fecha_identificacion.slice(0, 10)
    if (fecha < range.from || fecha > range.to) return false
    const p = f.proyecto || {}
    const fNames = [p.nombre_comercial, p.nombre_clientes, p.nombre_bitacora, p.sub_project]
      .filter(Boolean).map(normNombre)
    return fNames.some(n => candidatos.has(n))
  })
}

function calcAvailability(data, range) {
  const HORA_INI = 7, HORA_FIN = 17

  // Inferir frecuencia de muestreo a partir de intervalos consecutivos reales
  const allTimes = []
  data.forEach(d => {
    const tm = String(d.time || '').match(/(\d{2}):(\d{2})/)
    if (tm) allTimes.push(parseInt(tm[1]) * 60 + parseInt(tm[2]))
  })
  allTimes.sort((a, b) => a - b)
  const diffs = []
  for (let i = 1; i < allTimes.length; i++) {
    const diff = allTimes[i] - allTimes[i - 1]
    if (diff > 0 && diff <= 120) diffs.push(diff)
  }
  const freqMin = diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 60
  const freqClamped = Math.max(freqMin, 5)

  // Slots esperados por día en franja 07:00–17:00
  const slotsPerDay = Math.round((HORA_FIN - HORA_INI) * 60 / freqClamped) + 1
  const totalEsperado = slotsPerDay * range.totalDays

  // Registros reales con generación > 0 en la franja solar
  let conGeneracion = 0
  data.forEach(d => {
    const tm = String(d.time || '').match(/(\d{2}):(\d{2})/)
    if (!tm) return
    const h = parseInt(tm[1])
    if (h >= HORA_INI && h <= HORA_FIN && d.kwh > 0.001) conGeneracion++
  })

  const registrosCero = Math.max(0, totalEsperado - conGeneracion)
  const pct = totalEsperado > 0 ? Math.round((conGeneracion / totalEsperado) * 1000) / 10 : null
  return { pct, disponibles: conGeneracion, total: totalEsperado, cero: registrosCero }
}

function buildWeeks(data, range, p90d) {
  const dm = {}
  data.forEach(d => { dm[d.date] = (dm[d.date] || 0) + d.kwh })
  const pre = `${range.year}-${pad(range.month)}-`
  const mn = MESES[range.month - 1].slice(0, 3).toLowerCase()
  const w4end = range.lastDay
  return [{ s: 1, e: 7 }, { s: 8, e: 14 }, { s: 15, e: 21 }, { s: 22, e: w4end }].map((w, i) => {
    let tot = 0
    for (let d = w.s; d <= w.e; d++) tot += (dm[pre + pad(d)] || 0)
    const days = w.e - w.s + 1
    const p90w = p90d ? p90d * days : null
    const pct = p90w > 0 ? ((tot - p90w) / p90w * 100) : null
    return {
      lbl: `Semana ${i + 1}`,
      period: `${i < 3 ? `${w.s}-${w.e}` : `${w.s}-${w4end}`} ${mn}`,
      gen: tot, p90: p90w, pct, ok: pct === null ? null : pct >= -5,
    }
  })
}

// Causa raíz por CATEGORÍA estructurada (metodología actual de fallas), con
// respaldo al código legacy numérico para fallas viejas sin clasificación.
const CAUSA_POR_CATEGORIA = {
  red: 'Ausencia o anomalía en el suministro eléctrico externo (operador de red)',
  frontera: 'Falla en el sistema de medición / comunicación de la frontera comercial',
  inversores: 'Falla o anomalía en inversor(es) del sistema fotovoltaico',
  generando_sin_datos: 'Ausencia de datos de generación: no hay registro de monitoreo del período',
  eventos_adversos: 'Evento adverso externo, no atribuible a la infraestructura del proyecto',
}
function autoCause(f) {
  const cat = f?.clasificacion?.categoria
  if (cat && CAUSA_POR_CATEGORIA[cat]) return CAUSA_POR_CATEGORIA[cat]
  const pre = String(f?.tipo?.codigo || '').charAt(0)
  return ({
    '1': 'Falla en sistema de medición o comunicación de datos',
    '2': 'Falla eléctrica en componente del sistema fotovoltaico',
    '3': 'Evento adverso externo, no atribuible a la infraestructura del proyecto',
    '4': 'Desgaste o degradación de componente del sistema',
    '5': 'Falla en infraestructura civil o estructural',
    '6': 'Evento de seguridad laboral (HSE)',
    '7': 'Falla en sistema de almacenamiento (BESS)',
    '8': 'Incumplimiento administrativo o regulatorio',
    '9': 'Ausencia de suministro eléctrico externo (operador de red)',
  })[pre] || 'Causa identificada en campo — ver descripción del evento'
}

// Descripción del evento para el informe: el equipo/evento/detalle reportado
// (clasificación estructurada) + la narrativa libre si aporta información extra.
function eventoDesc(f) {
  const t = tituloFalla(f)
  const d = (f?.descripcion || '').trim()
  if (d && normNombre(d) !== normNombre(t)) return `${t} — ${d}`
  return t
}
function autoAction(f) {
  if (f.resolucion?.descripcion?.trim()) return f.resolucion.descripcion.trim()
  if (f.descripcion?.trim()) return f.descripcion.trim()
  return ({
    'abierta': 'Monitoreo continuo activo. Equipo técnico en seguimiento de la anomalía.',
    'en_gestion': 'Caso bajo revisión técnica. Pendiente definición de plan de acción.',
    'en_espera': 'Intervención programada. Coordinando visita técnica en sitio.',
    'cerrada': 'Falla resuelta satisfactoriamente. Sin intervención adicional requerida.',
  })[f.estado?.codigo] || 'Seguimiento activo por parte del equipo de operaciones.'
}
function autoObs(pname, total, avg, p90m, faultsArr, range, avail) {
  const pct = p90m > 0 ? ((total - p90m) / p90m * 100) : null
  const comp = pct !== null
    ? (pct >= 0 ? `superando en +${pct.toFixed(1)}% el umbral P90` : `por debajo en ${Math.abs(pct).toFixed(1)}% del umbral P90`)
    : ''
  let txt = `El proyecto ${pname} registró una generación total de ${Math.round(total).toLocaleString('es-CO')} kWh durante ${range.label}` +
    (comp ? `, ${comp}` : '.') + `, con un promedio diario de ${Math.round(avg).toLocaleString('es-CO')} kWh/día.`
  if (avail && avail.pct !== null) {
    const niv = avail.pct >= 95 ? 'alta' : avail.pct >= 85 ? 'aceptable' : 'baja'
    txt += ` La disponibilidad operativa del período fue de ${avail.pct.toFixed(1)}% (${avail.cero} hora(s) con generación cero en franja solar), considerada ${niv}.`
  }
  if (faultsArr.length) {
    const activas = faultsArr.filter(f => f.estado?.codigo !== 'cerrada')
    txt += ` Se registraron ${faultsArr.length} evento(s) operativo(s) durante el período.`
    txt += activas.length
      ? ` Al cierre del período, ${activas.length} evento(s) continúan con seguimiento activo.`
      : ' Todos los eventos fueron atendidos y resueltos durante el período.'
  } else {
    txt += ' No se registraron eventos operativos durante el período, lo que refleja la estabilidad operacional del activo.'
  }
  if (pct !== null && pct >= 0) {
    txt += ' El proyecto cerró el período en condición operativa y por encima del umbral de referencia P90, reflejando una gestión oportuna de las contingencias.'
  }
  return txt
}

function rmeta(lbl, val) { return `<div class="rpt-meta-item"><div class="rpt-meta-lbl">${esc(lbl)}</div><div class="rpt-meta-val">${esc(val)}</div></div>` }
function rkpi(ico, lbl, val, col) { return `<div class="rpt-kpi"><div class="rpt-kpi-ico">${ico}</div><div class="rpt-kpi-lbl">${esc(lbl)}</div><div class="rpt-kpi-val"${col ? ` style="color:${col}"` : ''}>${val}</div></div>` }

// ── Mini chart SVG: serie diaria con línea P90 y atípicos ─────────────
function svgDailyChart(days, values, p90d, atypDates) {
  if (!days.length) return '<div class="rpt-chart-empty">Sin datos para graficar</div>'
  const W = 460, H = 180, padL = 36, padR = 8, padT = 10, padB = 28
  const maxV = Math.max(...values, p90d || 0, 1)
  const xStep = (W - padL - padR) / Math.max(1, days.length - 1)
  const yTo = (v) => H - padB - (v / maxV) * (H - padT - padB)
  const atypSet = new Set(atypDates || [])

  let bars = ''
  const barW = Math.max(2, (W - padL - padR) / days.length - 1.2)
  days.forEach((d, i) => {
    const cx = padL + i * xStep - barW / 2
    const top = yTo(values[i])
    const h = (H - padB) - top
    const isAty = atypSet.has(d)
    const fill = isAty ? '#DC3232' : '#6B35C0'
    bars += `<rect data-date="${d}" x="${cx.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${fill}" opacity="0.78" rx="1.5" />`
  })

  let p90line = ''
  if (p90d) {
    const y = yTo(p90d)
    p90line = `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#CC8800" stroke-width="1.5" stroke-dasharray="5 3" />` +
      `<text x="${W - padR - 2}" y="${(y - 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#CC8800" font-weight="700">P90 ${Math.round(p90d).toLocaleString('es-CO')}</text>`
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => maxV * t)
  let grid = ''
  ticks.forEach(v => {
    const y = yTo(v)
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1" />` +
      `<text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#777">${v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : Math.round(v)}</text>`
  })

  const xLabelEvery = Math.ceil(days.length / 7)
  let xLabels = ''
  days.forEach((d, i) => {
    if (i % xLabelEvery !== 0 && i !== days.length - 1) return
    const cx = padL + i * xStep
    const short = d.slice(8, 10)
    xLabels += `<text x="${cx.toFixed(1)}" y="${H - padB + 14}" text-anchor="middle" font-size="9" fill="#777">${short}</text>`
  })

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">${grid}${bars}${p90line}${xLabels}</svg>`
}

// ── Mini chart SVG: comparativo Real vs P50/P90/P99 ──────────────────
function svgCompareChart(real, p50, p90, p99) {
  const items = [
    { l: 'Real', v: real, c: '#6B35C0' },
    p50 != null ? { l: 'P50', v: p50, c: '#4682C8' } : null,
    p90 != null ? { l: 'P90', v: p90, c: '#C89600' } : null,
    p99 != null ? { l: 'P99', v: p99, c: '#329650' } : null,
  ].filter(Boolean)
  if (!items.length) return '<div class="rpt-chart-empty">Sin simulaciones disponibles</div>'
  const W = 460, H = 180, padL = 40, padR = 10, padT = 14, padB = 28
  const maxV = Math.max(...items.map(i => i.v || 0), 1)
  const barW = (W - padL - padR) / items.length * 0.55
  const slot = (W - padL - padR) / items.length
  const yTo = (v) => H - padB - (v / maxV) * (H - padT - padB)

  let bars = '', labels = ''
  items.forEach((it, i) => {
    const cx = padL + slot * i + slot / 2 - barW / 2
    const top = yTo(it.v)
    const h = (H - padB) - top
    bars += `<rect x="${cx.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${it.c}" opacity="0.82" rx="3" />` +
      `<text x="${(cx + barW / 2).toFixed(1)}" y="${(top - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#444" font-weight="700">${Math.round(it.v).toLocaleString('es-CO')}</text>`
    labels += `<text x="${(cx + barW / 2).toFixed(1)}" y="${H - padB + 14}" text-anchor="middle" font-size="10" fill="#555" font-weight="600">${it.l}</text>`
  })
  const ticks = [0, 0.5, 1].map(t => maxV * t)
  let grid = ''
  ticks.forEach(v => {
    const y = yTo(v)
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1" />` +
      `<text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#777">${v >= 1000 ? (Math.round(v / 1000)) + 'k' : Math.round(v)}</text>`
  })
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">${grid}${bars}${labels}</svg>`
}

// ── Chart de portafolio (ranking horizontal) ─────────────────────────
function svgPortfolioChart(items) {
  if (!items.length) return ''
  const W = 600, rowH = 26, padL = 135, padR = 150, padT = 30, padB = 8
  const H = padT + items.length * rowH + padB
  const barAreaW = W - padL - padR
  // Escala incluye P90 para que el marcador/objetivo siempre quepa
  const maxV = Math.max(...items.map(i => Math.max(i.real || 0, i.p90 || 0)), 1)

  // Leyenda
  let html =
    `<g font-size="10" font-weight="700">` +
    `<rect x="${padL}" y="5" width="12" height="11" fill="#6B35C0" opacity="0.82" rx="2"/>` +
    `<text x="${padL + 17}" y="14" fill="#444">Real</text>` +
    `<rect x="${padL + 52}" y="5" width="12" height="11" fill="#22C55E" opacity="0.85" rx="2"/>` +
    `<text x="${padL + 69}" y="14" fill="#444">Excedente</text>` +
    `<line x1="${padL + 142}" y1="3" x2="${padL + 142}" y2="18" stroke="#C89600" stroke-width="2" stroke-dasharray="3 2"/>` +
    `<text x="${padL + 148}" y="14" fill="#444">P90 esperado (simulación)</text>` +
    `</g>`

  items.forEach((it, i) => {
    const y = padT + i * rowH
    const barY = y + 4, barH = 15
    const real = it.real || 0
    const p90 = (it.p90 != null && it.p90 > 0) ? it.p90 : null
    const wReal = (real / maxV) * barAreaW
    html += `<text x="${padL - 6}" y="${barY + 11}" text-anchor="end" font-size="10" fill="#444" font-weight="600">${esc(it.name.slice(0, 22))}</text>`

    if (p90 != null) {
      const wP90 = (p90 / maxV) * barAreaW
      if (real >= p90) {
        // Barra hasta P90 (morado) + excedente P90→Real (verde)
        html += `<rect x="${padL}" y="${barY}" width="${wP90.toFixed(1)}" height="${barH}" fill="#6B35C0" opacity="0.82" rx="2"/>`
        html += `<rect x="${(padL + wP90).toFixed(1)}" y="${barY}" width="${(wReal - wP90).toFixed(1)}" height="${barH}" fill="#22C55E" opacity="0.85" rx="2"/>`
      } else {
        // Barra Real (morado) + déficit Real→P90 (rojo translúcido)
        html += `<rect x="${padL}" y="${barY}" width="${wReal.toFixed(1)}" height="${barH}" fill="#6B35C0" opacity="0.82" rx="2"/>`
        html += `<rect x="${(padL + wReal).toFixed(1)}" y="${barY}" width="${(wP90 - wReal).toFixed(1)}" height="${barH}" fill="#FCA5A5" opacity="0.45" rx="2"/>`
      }
      // Marcador P90
      html += `<line x1="${(padL + wP90).toFixed(1)}" y1="${barY - 2}" x2="${(padL + wP90).toFixed(1)}" y2="${barY + barH + 2}" stroke="#C89600" stroke-width="2" stroke-dasharray="3 2"/>`
      // Etiqueta: Real + % vs P90 (coloreado)
      const pct = (real - p90) / p90 * 100
      const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
      const pctCol = pct >= 0 ? '#16A34A' : '#DC2626'
      const labelX = padL + Math.max(wReal, wP90) + 5
      html += `<text x="${labelX.toFixed(1)}" y="${barY + 11}" font-size="9.5" fill="#333" font-weight="700">${Math.round(real).toLocaleString('es-CO')} <tspan fill="${pctCol}" font-weight="800">${pctStr}</tspan></text>`
    } else {
      html += `<rect x="${padL}" y="${barY}" width="${wReal.toFixed(1)}" height="${barH}" fill="#6B35C0" opacity="0.82" rx="2"/>`
      html += `<text x="${(padL + wReal + 5).toFixed(1)}" y="${barY + 11}" font-size="9.5" fill="#333" font-weight="700">${Math.round(real).toLocaleString('es-CO')} kWh</text>`
    }
  })
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:${H}px;display:block">${html}</svg>`
}

// Gráfico de ranking vs P90 para el informe Ranking. Mantiene el excedente
// (verde) sobre P90 y muestra el valor de generación real, el valor de P90 y
// el % de desviación.
function svgRankingP90Chart(items) {
  if (!items.length) return ''
  const W = 660, rowH = 26, padL = 135, padR = 215, padT = 30, padB = 8
  const H = padT + items.length * rowH + padB
  const barAreaW = W - padL - padR
  const maxV = Math.max(...items.map(i => Math.max(i.real || 0, i.p90 || 0)), 1)
  const fmt = (n) => Math.round(n).toLocaleString('es-CO')

  // Leyenda: Real + Excedente + P90 esperado
  let html =
    `<g font-size="10" font-weight="700">` +
    `<rect x="${padL}" y="5" width="12" height="11" fill="#6B35C0" opacity="0.82" rx="2"/>` +
    `<text x="${padL + 17}" y="14" fill="#444">Real</text>` +
    `<rect x="${padL + 52}" y="5" width="12" height="11" fill="#22C55E" opacity="0.85" rx="2"/>` +
    `<text x="${padL + 69}" y="14" fill="#444">Excedente</text>` +
    `<line x1="${padL + 142}" y1="3" x2="${padL + 142}" y2="18" stroke="#C89600" stroke-width="2" stroke-dasharray="3 2"/>` +
    `<text x="${padL + 148}" y="14" fill="#444">P90 esperado (simulación)</text>` +
    `</g>`

  items.forEach((it, i) => {
    const y = padT + i * rowH
    const barY = y + 4, barH = 15
    const real = it.real || 0
    const p90 = (it.p90 != null && it.p90 > 0) ? it.p90 : null
    const wReal = (real / maxV) * barAreaW
    html += `<text x="${padL - 6}" y="${barY + 11}" text-anchor="end" font-size="10" fill="#444" font-weight="600">${esc(it.name.slice(0, 22))}</text>`

    if (p90 != null) {
      const wP90 = (p90 / maxV) * barAreaW
      if (real >= p90) {
        // Morado hasta P90 + excedente verde P90→Real
        html += `<rect x="${padL}" y="${barY}" width="${wP90.toFixed(1)}" height="${barH}" fill="#6B35C0" opacity="0.82" rx="2"/>`
        html += `<rect x="${(padL + wP90).toFixed(1)}" y="${barY}" width="${(wReal - wP90).toFixed(1)}" height="${barH}" fill="#22C55E" opacity="0.85" rx="2"/>`
      } else {
        // Morado hasta Real + déficit rojo translúcido Real→P90
        html += `<rect x="${padL}" y="${barY}" width="${wReal.toFixed(1)}" height="${barH}" fill="#6B35C0" opacity="0.82" rx="2"/>`
        html += `<rect x="${(padL + wReal).toFixed(1)}" y="${barY}" width="${(wP90 - wReal).toFixed(1)}" height="${barH}" fill="#FCA5A5" opacity="0.45" rx="2"/>`
      }
      // Marcador P90
      html += `<line x1="${(padL + wP90).toFixed(1)}" y1="${barY - 2}" x2="${(padL + wP90).toFixed(1)}" y2="${barY + barH + 2}" stroke="#C89600" stroke-width="2" stroke-dasharray="3 2"/>`
      // Etiqueta: Real · P90 · % desviación
      const pct = (real - p90) / p90 * 100
      const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
      const pctCol = pct >= 0 ? '#16A34A' : '#DC2626'
      const labelX = padL + Math.max(wReal, wP90) + 6
      html += `<text x="${labelX.toFixed(1)}" y="${barY + 11}" font-size="9" fill="#333" font-weight="700">` +
        `${fmt(real)} <tspan fill="#B8860B">· P90 ${fmt(p90)}</tspan> <tspan fill="${pctCol}" font-weight="800">${pctStr}</tspan></text>`
    } else {
      // Sin P90: barra morada sólida + valor
      html += `<rect x="${padL}" y="${barY}" width="${wReal.toFixed(1)}" height="${barH}" fill="#6B35C0" opacity="0.82" rx="2"/>`
      html += `<text x="${(padL + wReal + 6).toFixed(1)}" y="${barY + 11}" font-size="9" fill="#333" font-weight="700">${fmt(real)} kWh</text>`
    }
  })
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:${H}px;display:block">${html}</svg>`
}

// ── Página de proyecto (operacional individual) ─────────────────────
function buildProjectPage(cfg, genRes, mf, range, pageNum, totalPages, fmoMeta) {
  const data = genRes?.data || []
  const sim = genRes?.simulation || null
  const dm = {}
  data.forEach(d => { dm[d.date] = (dm[d.date] || 0) + d.kwh })
  const days = Object.keys(dm).sort()
  const kpd = days.map(d => Math.round(dm[d] * 100) / 100)
  const total = kpd.reduce((a, b) => a + b, 0)
  const avg = days.length ? total / days.length : 0
  const p90m = sim?.p90_monthly ?? null
  const p50m = sim?.p50_monthly ?? null
  const p90d = sim?.p90_daily ?? null
  const p99m = p90m ? Math.round(p90m * 0.9) : null
  const pct = p90m > 0 ? ((total - p90m) / p90m * 100) : null
  const pctStr = pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs P90` : '—'
  const pctCol = pct === null ? '#A89EC0' : pct >= 0 ? '#4ADE80' : '#FF5757'
  const avail = calcAvailability(data, range)
  const availStr = avail.pct !== null ? `${avail.pct.toFixed(1)}%` : '—'
  const availCol = avail.pct === null ? '#A89EC0' : avail.pct >= 95 ? '#4ADE80' : avail.pct >= 85 ? '#F6FF72' : '#FF5757'

  const atypical = []
  if (avg > 0) days.forEach((d, i) => {
    const v = kpd[i]
    if (v < avg * 0.7) atypical.push({ date: d, kwh: Math.round(v), pct: Math.round(v / avg * 100) })
  })

  const pname = cfg.nombre_clientes || cfg.nombre_display || cfg.nombre_comercial
  const muni = cfg.municipio || '—'
  const resp = 'Operaciones Unergy'
  const obs = autoObs(pname, total, avg, p90m, mf, range, avail)
  const activos = mf.filter(f => f.estado?.codigo !== 'cerrada')
  const stCol = pct === null ? '#A89EC0' : pct >= 0 ? '#4ADE80' : pct >= -10 ? '#F97316' : '#FF5757'
  const stTxt = pct === null ? '—' : pct >= 0 ? 'OPERATIVO' : 'ATENCIÓN'
  const pgLbl = totalPages > 1 ? `Página ${pageNum || 1} de ${totalPages}` : ''

  // Tabla semanal / custom
  let tableHtml = ''
  if (!range.isCustom) {
    const weeks = buildWeeks(data, range, p90d)
    tableHtml = '<table class="rpt-table" style="margin-top:12px"><thead><tr>' +
      '<th>SEMANA</th><th>PERÍODO</th><th>TENDENCIA</th><th>GENERACIÓN (kWh)</th><th>P90 ESPERADO (kWh)</th><th>DESV.</th><th>ESTADO</th></tr></thead><tbody>' +
      weeks.map((w, i) => {
        const wp = w.pct !== null ? `${w.pct >= 0 ? '+' : ''}${w.pct.toFixed(1)}%` : '—'
        const wc = w.ok === null ? '#A89EC0' : w.ok ? '#4ADE80' : '#F6FF72'
        let trendHtml = '—'
        if (i > 0 && weeks[i - 1].gen > 0) {
          const diff = w.gen - weeks[i - 1].gen
          const diffPct = Math.round((diff / weeks[i - 1].gen) * 100)
          const arrow = diff >= 0 ? '↑' : '↓'
          const tc = diff >= 0 ? '#4ADE80' : '#FF5757'
          trendHtml = `<span style="color:${tc};font-weight:800">${arrow} ${diff >= 0 ? '+' : ''}${diffPct}%</span>`
        }
        return `<tr><td style="font-weight:700">${esc(w.lbl)}</td><td>${esc(w.period)}</td>` +
          `<td style="text-align:center">${trendHtml}</td>` +
          `<td style="text-align:right;font-family:monospace;font-weight:700">${Math.round(w.gen).toLocaleString('es-CO')}</td>` +
          `<td style="text-align:right;font-family:monospace">${w.p90 ? Math.round(w.p90).toLocaleString('es-CO') : '—'}</td>` +
          `<td style="text-align:center;font-weight:700;color:${wc}">${wp}</td>` +
          `<td style="text-align:center">${w.ok === null ? '—' : (w.ok ? '✅ Normal' : '⚠️ Atención')}</td></tr>`
      }).join('') +
      `<tr class="rpt-total-row"><td>TOTAL</td><td>${range.lastDay} días</td><td></td>` +
      `<td style="text-align:right;font-family:monospace">${Math.round(total).toLocaleString('es-CO')}</td>` +
      `<td style="text-align:right;font-family:monospace">${p90m ? Math.round(p90m).toLocaleString('es-CO') : '—'}</td>` +
      `<td style="text-align:center;color:${pctCol}">${pctStr.split(' ')[0]}</td>` +
      `<td style="text-align:center;color:${pctCol}">${pct !== null ? (pct >= 0 ? '✅ Sobre P90' : '⚠️ Bajo P90') : '—'}</td></tr>` +
      '</tbody></table>'
  } else {
    tableHtml = '<table class="rpt-table" style="margin-top:12px"><thead><tr>' +
      '<th>PERÍODO</th><th>DÍAS CON DATOS</th><th>GENERACIÓN TOTAL (kWh)</th><th>PROMEDIO DIARIO (kWh)</th><th>DESV. P90</th></tr></thead><tbody>' +
      `<tr><td>${esc(range.headerPeriod)}</td><td style="text-align:center">${days.length}</td>` +
      `<td style="text-align:right;font-family:monospace;font-weight:700">${Math.round(total).toLocaleString('es-CO')}</td>` +
      `<td style="text-align:right;font-family:monospace">${Math.round(avg).toLocaleString('es-CO')}</td>` +
      `<td style="text-align:center;font-weight:700;color:${pctCol}">${pctStr}</td></tr>` +
      '</tbody></table>'
  }

  // Atípicos
  let atypHtml = ''
  if (atypical.length) {
    atypHtml = '<div style="margin-top:13px;background:#FFF5F5;border:1px solid #FF575730;border-radius:9px;padding:11px 14px">' +
      '<div style="font-size:10px;font-weight:800;color:#CC3333;letter-spacing:.7px;text-transform:uppercase;margin-bottom:8px">⚠️ Días atípicos — generación inferior al 70% del promedio</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>' +
      '<th style="text-align:left;padding:4px 8px;color:#888;font-size:9px;font-weight:700">FECHA</th>' +
      '<th style="text-align:right;padding:4px 8px;color:#888;font-size:9px;font-weight:700">GENERACIÓN (kWh)</th>' +
      '<th style="text-align:center;padding:4px 8px;color:#888;font-size:9px;font-weight:700">% VS PROMEDIO</th>' +
      '<th style="text-align:center;padding:4px 8px;color:#888;font-size:9px;font-weight:700">DÉFICIT (kWh)</th>' +
      '</tr></thead><tbody>' +
      atypical.map((a, i) => {
        const def = Math.round(avg - a.kwh)
        return `<tr style="background:${i % 2 === 0 ? '#FFF0F0' : '#FFF8F8'}">` +
          `<td style="padding:5px 8px;font-weight:700;color:#AA2222">${esc(a.date)}</td>` +
          `<td style="padding:5px 8px;text-align:right;font-family:monospace">${a.kwh.toLocaleString('es-CO')}</td>` +
          `<td style="padding:5px 8px;text-align:center;font-weight:800;color:#CC3333">${a.pct}%</td>` +
          `<td style="padding:5px 8px;text-align:center;color:#888">−${def.toLocaleString('es-CO')}</td></tr>`
      }).join('') +
      '</tbody></table></div>'
  }

  // Eventos
  let evHtml = ''
  if (mf.length) {
    mf.forEach(f => {
      const desc = eventoDesc(f).slice(0, 220)
      evHtml += `<tr><td style="white-space:nowrap;font-weight:700;color:#6B35C0">${esc(fmtD(f.fecha_identificacion))}</td>` +
        `<td style="text-align:center;white-space:nowrap">${esc(f.hora || '—')}</td>` +
        `<td>${esc(desc)}</td>` +
        `<td>${esc(autoCause(f))}</td>` +
        `<td>${esc(autoAction(f).slice(0, 220))}</td></tr>`
    })
  } else {
    evHtml = '<tr><td colspan="5" style="text-align:center;color:#A89EC0;padding:18px">Sin eventos operativos registrados en el período</td></tr>'
  }

  // Gráficos SVG embebidos
  const chart1 = svgDailyChart(days, kpd, p90d, atypical.map(a => a.date))
  const chart2 = svgCompareChart(Math.round(total), p50m, p90m, p99m)

  return '<div class="rpt-page">' +
    // Header
    '<div class="rpt-header">' +
    '<div style="display:flex;align-items:center;gap:13px">' +
    unergyLogoSVG() +
    '<div><div style="color:#fff;font-size:14px;font-weight:800;letter-spacing:.8px">INFORME OPERACIONAL MENSUAL · UNERGY ENERGÍA DIGITAL S.A.S ESP</div>' +
    '<div style="color:#6B5F80;font-size:10px;letter-spacing:.6px;margin-top:2px">Minigranjas Solares | Operación &amp; Mantenimiento</div></div></div>' +
    `<div class="rpt-meta-grid">${rmeta('PROYECTO', pname)}${rmeta('PERÍODO', range.headerPeriod)}${rmeta('MUNICIPIO', muni)}${rmeta('ELABORADO POR', resp)}</div>` +
    '</div>' +
    // S1
    `<div class="rpt-section"><div class="rpt-section-title">▌ 1. Resumen de Generación – ${esc(range.headerPeriod)}</div>` +
    '<div class="rpt-kpi-row">' +
    rkpi('⚡', 'Generación Total', `${Math.round(total).toLocaleString('es-CO')} kWh`, null) +
    rkpi('📅', 'Promedio Diario', `${Math.round(avg).toLocaleString('es-CO')} kWh/día`, null) +
    rkpi('🏆', 'Desv. vs P90', pctStr, pctCol) +
    '</div>' +
    '<div class="rpt-kpi-row" style="margin-top:10px">' +
    rkpi('🔆', 'Disponibilidad Operativa', availStr, availCol) +
    rkpi('📆', 'Días con datos', `${days.length} / ${range.totalDays} días`, null) +
    rkpi('🗓', 'Días atípicos', `${atypical.length} día${atypical.length !== 1 ? 's' : ''}`, atypical.length === 0 ? '#4ADE80' : atypical.length <= 2 ? '#F97316' : '#FF5757') +
    '</div>' +
    tableHtml + atypHtml + '</div>' +
    // S2 gráficos
    '<div class="rpt-section"><div class="rpt-section-title">▌ 2. Análisis Gráfico de Generación</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
    `<div class="rpt-chart-card"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:8px">Generación Diaria</div><div class="rpt-chart-box">${chart1}</div></div>` +
    `<div class="rpt-chart-card"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:8px">Comparativo vs Simulaciones</div><div class="rpt-chart-box">${chart2}</div></div>` +
    '</div></div>' +
    // S3 eventos
    '<div class="rpt-section"><div class="rpt-section-title">▌ 3. Eventos Operativos y Acciones Correctivas</div>' +
    '<table class="rpt-table"><thead><tr><th style="width:88px">FECHA</th><th style="width:52px">HORA</th>' +
    '<th>DESCRIPCIÓN DEL EVENTO</th><th>CAUSA RAÍZ</th><th>ACCIÓN CORRECTIVA</th></tr></thead>' +
    `<tbody>${evHtml}</tbody></table></div>` +
    // S4 obs
    '<div class="rpt-section"><div class="rpt-section-title">▌ 4. Observaciones y Estado del Proyecto</div>' +
    '<div style="display:grid;grid-template-columns:1fr 260px;gap:16px">' +
    '<div>' +
    '<div class="rpt-obs-title">OBSERVACIONES GENERALES ' +
    '<span class="rpt-edit-hint">✏️ clic para editar</span>' +
    '</div>' +
    `<div class="rpt-obs-text rpt-obs-editable" contenteditable="true" data-obs="1">${esc(obs)}</div>` +
    '</div>' +
    '<div class="rpt-status-box">' +
    '<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">' +
    `<span style="width:9px;height:9px;border-radius:50%;background:${stCol};display:inline-block"></span>` +
    `<span style="font-size:12px;font-weight:800;color:${stCol}">● ${stTxt}</span>` +
    '<span style="font-size:10px;color:#888;margin-left:2px">Con seguimiento activo</span></div>' +
    (pct !== null ? `<div class="rpt-status-row">✅ P90: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>` : '') +
    (avail.pct !== null ? `<div class="rpt-status-row">🔆 Disponibilidad: ${avail.pct.toFixed(1)}%</div>` : '') +
    `<div class="rpt-status-row">⚡ ${mf.length} evento(s) este período</div>` +
    (atypical.length ? `<div class="rpt-status-row" style="color:#F97316">⚠️ ${atypical.length} día(s) atípico(s)</div>` : '') +
    (activos.length ? `<div class="rpt-status-row" style="color:#F97316">En proceso: ${esc(activos.map(f => tituloFalla(f)).slice(0, 3).join(', '))}</div>` : '') +
    `<div class="rpt-status-row" style="margin-top:8px;padding-top:8px;border-top:1px solid #EDE8F5">Resp: ${esc(resp)}</div>` +
    '<div class="rpt-status-row">Contacto: operaciones@unergy.io</div>' +
    `<div class="rpt-status-row">Prox. reporte: ${esc(nextMes(range.month))} ${range.year}</div>` +
    '</div></div></div>' +
    '<div class="rpt-footer">' +
    '<span>UNERGY ENERGÍA DIGITAL S.A.S ESP | Medellín, Colombia | www.unergy.co</span>' +
    '<span style="display:flex;align-items:center;gap:16px">' +
    (pgLbl ? `<span style="font-weight:700;color:#6B35C0">${pgLbl}</span>` : '') +
    `<span>Documento confidencial – ${esc(range.headerPeriod)}</span>` +
    '</span></div>' +
    '</div>'
}

// ── Página consolidada portafolio ────────────────────────────────────
function buildConsolidatedPage(portName, projsData, range, totalPages) {
  const resp = 'Operaciones Unergy'
  const enriched = projsData.map(pd => {
    const data = pd.genRes?.data || []
    const sim = pd.genRes?.simulation
    const tot = data.reduce((a, d) => a + d.kwh, 0)
    const dset = new Set(); data.forEach(d => dset.add(d.date))
    const nd = dset.size
    const avg = nd ? tot / nd : 0
    const p90 = sim?.p90_monthly ?? null
    const pct = p90 > 0 ? ((tot - p90) / p90 * 100) : null
    const avail = calcAvailability(data, range)
    return { pd, tot, avg, p90, pct, avail }
  })

  let totalPort = 0, overP90 = 0, totalEv = 0, totalP90 = 0
  let rows = ''
  enriched.forEach((e, idx) => {
    const pc = e.pct === null ? '#A89EC0' : e.pct >= 0 ? '#4ADE80' : '#FF5757'
    const ps = e.pct !== null ? `${e.pct >= 0 ? '+' : ''}${e.pct.toFixed(1)}%` : '—'
    if (e.pct !== null && e.pct >= 0) overP90++
    totalPort += e.tot
    totalEv += e.pd.mf.length
    if (e.p90 !== null) totalP90 += e.p90
    const pn = e.pd.cfg.nombre_clientes || e.pd.cfg.nombre_display || e.pd.cfg.nombre_comercial
    let rankBadge = ''
    if (idx === 0) rankBadge = '<span style="font-size:10px;margin-left:5px">🥇</span>'
    else if (idx === 1) rankBadge = '<span style="font-size:10px;margin-left:5px">🥈</span>'
    else if (idx === 2) rankBadge = '<span style="font-size:10px;margin-left:5px">🥉</span>'
    else if (idx >= enriched.length - 3 && enriched.length > 3) rankBadge = '<span style="font-size:9px;color:#FF5757;font-weight:700;margin-left:5px">▼</span>'
    const rowBg = idx === 0 ? 'background:#FFFDF0;' : idx === 1 ? 'background:#F8F8F8;' : idx === 2 ? 'background:#FFF5EC;' : ''
    rows += `<tr style="${rowBg}">` +
      `<td style="font-weight:700">${idx + 1}. ${esc(pn)}${rankBadge}</td>` +
      `<td style="text-align:right;font-family:monospace;font-weight:700">${Math.round(e.tot).toLocaleString('es-CO')}</td>` +
      `<td style="text-align:right;font-family:monospace">${Math.round(e.avg).toLocaleString('es-CO')}</td>` +
      `<td style="text-align:center;font-weight:700;color:${pc}">${ps}</td>` +
      `<td style="text-align:center;color:${e.avail.pct === null ? '#888' : e.avail.pct >= 95 ? '#2D8A4E' : e.avail.pct >= 85 ? '#B8860B' : '#CC0000'}">${e.avail.pct !== null ? e.avail.pct.toFixed(1) + '%' : '—'}</td>` +
      `<td style="text-align:center">${e.pd.mf.length}</td>` +
      `<td style="text-align:center;color:${pc}">${esc(e.pct !== null ? (e.pct >= 0 ? '✅ Normal' : '⚠️ Atención') : '—')}</td></tr>`
  })

  const pctPort = totalP90 > 0 ? ((totalPort - totalP90) / totalP90 * 100) : null
  const pctPortStr = pctPort !== null ? `${pctPort >= 0 ? '+' : ''}${pctPort.toFixed(1)}%` : '—'
  const pctPortCol = pctPort === null ? '#F6FF72' : pctPort >= 0 ? '#4ADE80' : '#FF5757'

  const chart = svgPortfolioChart(enriched.map(e => ({
    name: e.pd.cfg.nombre_clientes || e.pd.cfg.nombre_display || e.pd.cfg.nombre_comercial,
    real: e.tot, p90: e.p90,
  })))

  const pgLbl = totalPages > 1 ? `Página 1 de ${totalPages}` : ''
  return '<div class="rpt-page">' +
    '<div class="rpt-header">' +
    '<div style="display:flex;align-items:center;gap:13px">' +
    unergyLogoSVG() +
    '<div><div style="color:#fff;font-size:14px;font-weight:800;letter-spacing:.8px">INFORME OPERACIONAL MENSUAL · PORTAFOLIO</div>' +
    '<div style="color:#6B5F80;font-size:10px;letter-spacing:.6px;margin-top:2px">Unergy Energía Digital S.A.S ESP | Operación &amp; Mantenimiento</div></div></div>' +
    `<div class="rpt-meta-grid">${rmeta('PORTAFOLIO', portName)}${rmeta('PERÍODO', range.headerPeriod)}${rmeta('PROYECTOS', `${projsData.length} proyectos`)}${rmeta('ELABORADO POR', resp)}</div>` +
    '</div>' +
    `<div class="rpt-section"><div class="rpt-section-title">▌ 1. Resumen Consolidado – ${esc(range.headerPeriod)}</div>` +
    '<div class="rpt-kpi-row">' +
    rkpi('⚡', 'Generación Total Portafolio', `${Math.round(totalPort).toLocaleString('es-CO')} kWh`, null) +
    rkpi('🎯', 'P90 Total Portafolio', `${Math.round(totalP90).toLocaleString('es-CO')} kWh`, null) +
    rkpi('🏭', 'Proyectos sobre P90', `${overP90} / ${projsData.length}`, overP90 === projsData.length ? '#4ADE80' : '#F59E0B') +
    rkpi('⚠️', 'Total Eventos del Período', `${totalEv} evento(s)`, totalEv > 0 ? '#F97316' : '#4ADE80') +
    '</div>' +
    '<table class="rpt-table" style="margin-top:12px"><thead><tr>' +
    '<th># PROYECTO</th><th>GENERACIÓN (kWh)</th><th>PROM. DIARIO</th><th>DESV. P90</th><th>DISPONIB.</th><th>EVENTOS</th><th>ESTADO</th>' +
    '</tr></thead><tbody>' + rows + '</tbody>' +
    '<tfoot><tr class="rpt-total-row"><td>TOTAL PORTAFOLIO</td>' +
    `<td style="text-align:right;font-family:monospace">${Math.round(totalPort).toLocaleString('es-CO')} kWh</td>` +
    `<td colspan="2" style="text-align:right;font-family:monospace">P90: ${Math.round(totalP90).toLocaleString('es-CO')} kWh</td>` +
    `<td colspan="3" style="text-align:center;font-weight:700;color:${pctPortCol}">${pctPortStr}</td></tr></tfoot>` +
    '</table></div>' +
    '<div class="rpt-section"><div class="rpt-section-title">▌ 2. Generación por Proyecto — Ranking vs P90</div>' +
    `<div class="rpt-chart-card"><div class="rpt-chart-box rpt-chart-box-tall">${chart}</div></div></div>` +
    '<div class="rpt-footer">' +
    '<span>UNERGY ENERGÍA DIGITAL S.A.S ESP | Medellín, Colombia | www.unergy.co</span>' +
    '<span style="display:flex;align-items:center;gap:16px">' +
    (pgLbl ? `<span style="font-weight:700;color:#6B35C0">${pgLbl}</span>` : '') +
    `<span>Documento confidencial – ${esc(range.headerPeriod)}</span>` +
    '</span></div>' +
    '</div>'
}

// ── Página FMO ───────────────────────────────────────────────────────
function calcSLA(f) {
  const fecha = f.fecha_identificacion?.slice(0, 10)
  if (!fecha) return { dias: 0, slaRevision: 2, slaLabel: 'Crítico (≥90%)', cumple: true }
  const dias = Math.max(0, Math.floor((Date.now() - new Date(fecha + 'T00:00:00')) / 86400000))
  let slaRevision = 2, slaLabel = 'Crítico (≥90%)'
  const cat = f?.clasificacion?.categoria
  if (cat) {
    // red = desconexión de suministro → crítico; frontera/inversores y falta de
    // datos de generación → grave; eventos adversos externos → medio.
    if (cat === 'frontera' || cat === 'inversores' || cat === 'generando_sin_datos') { slaRevision = 3; slaLabel = 'Grave (66-90%)' }
    else if (cat === 'eventos_adversos') { slaRevision = 4; slaLabel = 'Medio (<66%)' }
  } else {
    const pre = String(f.tipo?.codigo || '').charAt(0)
    if (pre === '1') { slaRevision = 3; slaLabel = 'Grave (66-90%)' }
    else if (pre === '4' || pre === '5') { slaRevision = 4; slaLabel = 'Medio (<66%)' }
  }
  const cumple = f.estado?.codigo === 'cerrada' ? true : dias <= slaRevision
  return { dias, slaRevision, slaLabel, cumple }
}

function buildFMOPage(cfg, genRes, mf, range, fmoData) {
  const data = genRes?.data || []
  const sim = genRes?.simulation
  const dm = {}
  data.forEach(d => { dm[d.date] = (dm[d.date] || 0) + d.kwh })
  const days = Object.keys(dm).sort()
  const kpd = days.map(d => Math.round(dm[d] * 100) / 100)
  const total = kpd.reduce((a, b) => a + b, 0)
  const avg = days.length ? total / days.length : 0
  const p90m = sim?.p90_monthly ?? null
  const p50m = sim?.p50_monthly ?? null
  const p90d = sim?.p90_daily ?? null
  const pct = p90m > 0 ? ((total - p90m) / p90m * 100) : null
  const pctStr = pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs P90` : '—'
  const pctCol = pct === null ? '#A89EC0' : pct >= 0 ? '#4ADE80' : '#FF5757'

  const avail = calcAvailability(data, range)
  const contrato = fmoData?.contrato || null
  const DISP_GAR = parseFloat(contrato?.disponibilidad_garantizada_pct || '97') || 97
  const dispPct = avail.pct
  const cumpleDisp = dispPct !== null && dispPct >= DISP_GAR
  const dispStr = dispPct !== null ? `${dispPct.toFixed(1)}%` : 'No calculado'
  const dispCol = dispPct === null ? '#A89EC0' : cumpleDisp ? '#4ADE80' : '#FF5757'

  let multaHtml = ''
  if (dispPct !== null && !cumpleDisp) {
    const deficit = DISP_GAR - dispPct
    const numIntervalos = Math.ceil(deficit / 0.25)
    const pctMulta = numIntervalos * 0.5
    const honorariosBase = parseFloat(contrato?.valor_estimado_ano1_cop || '0') || 0
    multaHtml = '<div class="fmo-multa-box"><div style="font-size:11px;font-weight:800;color:#CC0000;margin-bottom:6px">⚠️ INCUMPLIMIENTO DE DISPONIBILIDAD GARANTIZADA</div>' +
      '<div style="font-size:11px;color:#883333;line-height:1.7">' +
      `Déficit: <b>${deficit.toFixed(2)}%</b> (${numIntervalos} intervalo(s) de 0.25%) · ` +
      `Multa aplicable: <b>${pctMulta.toFixed(1)}%</b> del honorario anual` +
      (honorariosBase > 0 ? ` → estimado <b>COP $${Math.round(honorariosBase * pctMulta / 100).toLocaleString('es-CO')}</b>` : '') +
      '<br>Referencia: Sección XIII.04 — Multa por incumplimiento de la Disponibilidad Garantizada</div></div>'
  } else if (dispPct !== null && cumpleDisp) {
    multaHtml = '<div class="fmo-ok-box"><div style="font-size:11px;font-weight:800;color:#2D8A4E">✅ DISPONIBILIDAD GARANTIZADA CUMPLIDA — Sin multa aplicable</div>' +
      `<div style="font-size:11px;color:#2D7A3E;margin-top:3px">Real: ${dispStr} ≥ Garantizada: ${DISP_GAR}%</div></div>`
  }

  const atypical = []
  if (avg > 0) days.forEach((d, i) => {
    const v = kpd[i]
    if (v < avg * 0.7) atypical.push({ date: d, kwh: Math.round(v), pct: Math.round(v / avg * 100) })
  })

  const fallasSla = mf.map(f => ({ f, sla: calcSLA(f) }))
  const fueraSla = fallasSla.filter(x => !x.sla.cumple && x.f.estado?.codigo !== 'cerrada').length

  const weeks = buildWeeks(data, range, p90d)

  // Inversores
  const inverters = fmoData?.inverters || []
  const invErr = fmoData?.inverters_error
  let invTableHtml = ''
  if (inverters.length) {
    invTableHtml = '<table class="fmo-inv-table"><thead><tr>' +
      '<th>#</th><th>NOMBRE / S/N</th><th>CAPACIDAD</th><th>ESTADO ACTUAL</th><th>POTENCIA</th></tr></thead><tbody>'
    inverters.forEach((inv, i) => {
      const name = inv.name || inv.nombre || inv.inverter_name || inv.sn || `INV-${String(i + 1).padStart(2, '0')}`
      const sn = inv.serial_number || inv.sn || inv.serial || '—'
      const cap = inv.nominal_power || inv.capacity || inv.potencia_nominal || inv.power_kw
      const capStr = cap != null ? `${cap} kWp` : '—'
      const status = inv.status || inv.estado || inv.alarm_status || '—'
      const statusOk = String(status).toLowerCase().match(/normal|ok|^0$/) || status === 0
      const power = inv.active_power || inv.power || inv.potencia || inv.pac
      const powerStr = power != null ? `${(parseFloat(power) || 0).toFixed(1)} kW` : '—'
      invTableHtml += '<tr>' +
        `<td style="text-align:center;font-family:monospace;font-weight:700">${i + 1}</td>` +
        `<td><b>${esc(name)}</b>${sn !== '—' ? `<br><span style="font-size:9px;color:#888">${esc(sn)}</span>` : ''}</td>` +
        `<td style="text-align:center">${esc(capStr)}</td>` +
        `<td class="${statusOk ? 'fmo-status-ok' : 'fmo-status-err'}">${esc(String(status))}</td>` +
        `<td style="text-align:right;font-family:monospace">${esc(powerStr)}</td></tr>`
    })
    invTableHtml += '</tbody></table>'
  } else {
    invTableHtml = '<div style="font-size:11px;color:#A89EC0;padding:12px;background:#F9F7FD;border-radius:8px;text-align:center">' +
      (invErr ? `⚠️ ${esc(invErr)}` : 'Sin datos de inversores disponibles para este proyecto') +
      '</div>'
  }

  // Mantenimientos
  const mantArr = fmoData?.mantenimientos || []
  let mantHtml = ''
  if (mantArr.length) {
    mantHtml = '<table class="fmo-mant-table"><thead><tr>' +
      '<th style="width:95px">FECHA</th><th style="width:110px">TIPO</th><th>DESCRIPCIÓN</th><th style="width:100px">ESTADO</th></tr></thead><tbody>'
    mantArr.forEach(m => {
      const stCol = m.estado === 'Ejecutado' ? '#2D8A4E' : m.estado === 'Pospuesto' ? '#CC0000' : '#B8860B'
      mantHtml += '<tr>' +
        `<td style="font-size:10px;color:#6B35C0;font-weight:700">${esc(m.fecha || '—')}</td>` +
        `<td>${esc(m.tipo || '—')}</td>` +
        `<td>${esc(m.descripcion || '—')}</td>` +
        `<td style="color:${stCol};font-weight:700;text-align:center">${esc(m.estado || '—')}</td></tr>`
    })
    mantHtml += '</tbody></table>'
  } else {
    mantHtml = '<div style="font-size:11px;color:#A89EC0;padding:12px;background:#F9F7FD;border-radius:8px;text-align:center">' +
      'Sin registros de mantenimiento en el período.</div>'
  }

  // SLA table
  let slaHtml = '<table class="fmo-mant-table"><thead><tr>' +
    '<th style="width:90px">FECHA</th><th>DESCRIPCIÓN</th><th style="width:90px">GRAVEDAD</th><th style="width:70px">DÍAS ABIERTA</th><th style="width:80px">SLA</th>' +
    '</tr></thead><tbody>'
  if (mf.length) {
    fallasSla.forEach(x => {
      const f = x.f
      const sla = x.sla
      const desc = eventoDesc(f).slice(0, 110)
      slaHtml += '<tr>' +
        `<td style="font-weight:700;color:#6B35C0;font-size:10px">${esc(fmtD(f.fecha_identificacion))}</td>` +
        `<td>${esc(desc)}</td>` +
        `<td style="font-size:10px">${esc(sla.slaLabel)}</td>` +
        `<td style="text-align:center;font-weight:700">${sla.dias}d</td>` +
        `<td class="${sla.cumple || f.estado?.codigo === 'cerrada' ? 'fmo-sla-ok' : 'fmo-sla-err'}">${sla.cumple || f.estado?.codigo === 'cerrada' ? '✅ OK' : '❌ Excede'}</td></tr>`
    })
  } else {
    slaHtml += '<tr><td colspan="5" style="text-align:center;color:#A89EC0;padding:14px">Sin eventos en el período ✅</td></tr>'
  }
  slaHtml += '</tbody></table>'
  if (mf.length) {
    slaHtml += `<div style="font-size:10px;color:#888;margin-top:8px">${mf.length} evento(s) · ${mf.length - fueraSla} dentro del SLA · ${fueraSla} fuera del SLA</div>`
  }

  const chart1 = svgDailyChart(days, kpd, p90d, atypical.map(a => a.date))
  const chart2 = svgCompareChart(Math.round(total), p50m, p90m, p90m ? Math.round(p90m * 0.9) : null)

  const obsFMO = `El proyecto ${cfg.nombre_clientes || cfg.nombre_display || cfg.nombre_comercial} registró una generación total de ` +
    `${Math.round(total).toLocaleString('es-CO')} kWh durante ${range.monthName} ${range.year}` +
    (pct !== null ? `, ${pct >= 0 ? 'superando en +' : 'por debajo en '}${Math.abs(pct).toFixed(1)}% el umbral P90` : '') +
    `. La disponibilidad operativa calculada fue de ${dispStr}` +
    (cumpleDisp ? ` cumpliendo con el umbral contractual del ${DISP_GAR}%.` : ` por debajo del umbral garantizado del ${DISP_GAR}%, lo que genera la aplicación de multa según la Sección XIII.04 del contrato.`) +
    (mf.length ? ` Se registraron ${mf.length} evento(s) operativo(s).` : ' Sin eventos operativos en el período.') +
    (mantArr.length ? ` Se ejecutaron ${mantArr.length} actividad(es) de mantenimiento.` : '')

  const resp = 'Operaciones Unergy'
  const contratista = contrato?.contratista || 'Unergy S.A.S.'
  const muni = cfg.municipio || '—'
  const pname = cfg.nombre_clientes || cfg.nombre_display || cfg.nombre_comercial

  return '<div class="rpt-page">' +
    '<div class="rpt-header">' +
    '<div style="display:flex;align-items:center;gap:13px">' +
    unergyLogoSVG() +
    '<div><div style="color:#fff;font-size:13px;font-weight:800;letter-spacing:.8px">INFORME DE OPERACIÓN Y MANTENIMIENTO · FMO · UNERGY ENERGÍA DIGITAL S.A.S ESP</div>' +
    '<div style="color:#6B5F80;font-size:10px;letter-spacing:.5px;margin-top:2px">Reporte Mensual O&amp;M · Conforme Anexo 7 del Contrato</div></div></div>' +
    `<div class="rpt-meta-grid">${rmeta('PROYECTO', pname)}${rmeta('PERÍODO', range.headerPeriod)}${rmeta('MUNICIPIO', muni)}${rmeta('CONTRATISTA', contratista)}</div>` +
    `<div class="rpt-meta-grid" style="margin-top:6px">${rmeta('ELABORADO POR', resp)}${rmeta('DISPONIB. GARANTIZADA', DISP_GAR + '%')}${rmeta('DISPONIB. REAL', dispStr)}${rmeta('ENTREGA', `${range.monthName} ${range.year} · Primeros 5 días`)}</div>` +
    '</div>' +
    // S1
    `<div class="rpt-section"><div class="fmo-section-title">▌ 1. RESUMEN EJECUTIVO — ${esc(range.headerPeriod)}</div>` +
    '<div class="rpt-kpi-row">' +
    rkpi('⚡', 'Generación Total', `${Math.round(total).toLocaleString('es-CO')} kWh`, null) +
    rkpi('🔆', 'Disponibilidad Real', dispStr, dispCol) +
    rkpi('🏆', 'Desv. vs P90', pctStr, pctCol) +
    rkpi('📅', 'Promedio Diario', `${Math.round(avg).toLocaleString('es-CO')} kWh/día`, null) +
    '</div>' +
    '<div class="rpt-kpi-row" style="margin-top:10px">' +
    rkpi('📆', 'Días con datos', `${days.length} / ${range.totalDays}`, null) +
    rkpi('🗓', 'Días atípicos', `${atypical.length} día${atypical.length !== 1 ? 's' : ''}`, atypical.length === 0 ? '#4ADE80' : '#F97316') +
    rkpi('⚡', 'Eventos operativos', mf.length, mf.length === 0 ? '#4ADE80' : '#F97316') +
    rkpi('⚠️', 'Fuera de SLA', fueraSla, fueraSla === 0 ? '#4ADE80' : '#FF5757') +
    '</div>' + multaHtml + '</div>' +
    // S2
    '<div class="rpt-section"><div class="fmo-section-title">▌ 2. GENERACIÓN DEL PERÍODO</div>' +
    '<table class="rpt-table"><thead><tr>' +
    '<th>SEMANA</th><th>PERÍODO</th><th>TENDENCIA</th><th>GENERACIÓN (kWh)</th><th>P90 ESPERADO (kWh)</th><th>DESV.</th><th>ESTADO</th></tr></thead><tbody>' +
    weeks.map((w, i) => {
      const wp = w.pct !== null ? `${w.pct >= 0 ? '+' : ''}${w.pct.toFixed(1)}%` : '—'
      const wc = w.ok === null ? '#A89EC0' : w.ok ? '#4ADE80' : '#F6FF72'
      let trendHtml = '—'
      if (i > 0 && weeks[i - 1].gen > 0) {
        const diff = w.gen - weeks[i - 1].gen
        const dp = Math.round(diff / weeks[i - 1].gen * 100)
        trendHtml = `<span style="color:${diff >= 0 ? '#4ADE80' : '#FF5757'};font-weight:800">${diff >= 0 ? '↑' : '↓'}${diff >= 0 ? '+' : ''}${dp}%</span>`
      }
      return `<tr><td style="font-weight:700">${esc(w.lbl)}</td><td>${esc(w.period)}</td>` +
        `<td style="text-align:center">${trendHtml}</td>` +
        `<td style="text-align:right;font-family:monospace;font-weight:700">${Math.round(w.gen).toLocaleString('es-CO')}</td>` +
        `<td style="text-align:right;font-family:monospace">${w.p90 ? Math.round(w.p90).toLocaleString('es-CO') : '—'}</td>` +
        `<td style="text-align:center;font-weight:700;color:${wc}">${wp}</td>` +
        `<td style="text-align:center">${w.ok === null ? '—' : (w.ok ? '✅ Normal' : '⚠️ Atención')}</td></tr>`
    }).join('') +
    `<tr class="rpt-total-row"><td>TOTAL</td><td>${range.lastDay} días</td><td></td>` +
    `<td style="text-align:right;font-family:monospace">${Math.round(total).toLocaleString('es-CO')}</td>` +
    `<td style="text-align:right;font-family:monospace">${p90m ? Math.round(p90m).toLocaleString('es-CO') : '—'}</td>` +
    `<td style="text-align:center;color:${pctCol}">${pctStr.split(' ')[0]}</td>` +
    `<td style="text-align:center;color:${pctCol}">${pct !== null ? (pct >= 0 ? '✅ Sobre P90' : '⚠️ Bajo P90') : '—'}</td></tr>` +
    '</tbody></table>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">' +
    `<div class="rpt-chart-card"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:8px">Generación Diaria kWh</div><div class="rpt-chart-box">${chart1}</div></div>` +
    `<div class="rpt-chart-card"><div style="font-size:11px;font-weight:700;color:#555;margin-bottom:8px">Real vs P50 / P90 / P99</div><div class="rpt-chart-box">${chart2}</div></div>` +
    '</div>' +
    '</div>' +
    // S3
    '<div class="rpt-section"><div class="fmo-section-title">▌ 3. DISPONIBILIDAD GARANTIZADA — Anexo 1 del Contrato</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">' +
    rkpi('⏱', 'HPER (Horas período solar)', `${(range.totalDays * 11).toLocaleString('es-CO')} h`, null) +
    rkpi('❌', 'HUNA (Horas sin generación)', `${(avail.cero || 0).toLocaleString('es-CO')} h`, null) +
    rkpi('🔆', 'ASYS Calculado', dispStr, dispCol) +
    rkpi('📋', 'Disponibilidad Garantizada', `${DISP_GAR}%`, '#A89EC0') +
    '</div>' +
    '<div style="background:#F7F4FD;border-radius:9px;padding:11px 14px;margin-bottom:12px;font-size:11px;color:#555;line-height:1.7">' +
    '<b>Metodología:</b> ASYS = (HPER - HUNA) / HPER × 100 | HPER = horas franjas solar 06:00–17:00 · ' +
    'HUNA = horas con generación ≈ 0 en franja solar. Nota: cálculo a nivel de planta; el cálculo contractual (Anexo 1) requiere datos por inversor.' +
    '</div>' +
    invTableHtml + multaHtml + '</div>' +
    // S4
    '<div class="rpt-section"><div class="fmo-section-title">▌ 4. EVENTOS OPERATIVOS Y TIEMPOS DE RESPUESTA — Anexo 4</div>' +
    slaHtml +
    '</div>' +
    // S5
    '<div class="rpt-section"><div class="fmo-section-title">▌ 5. PLAN DE MANTENIMIENTO EJECUTADO — Anexo 3</div>' +
    mantHtml + '</div>' +
    // S6
    '<div class="rpt-section"><div class="fmo-section-title">▌ 6. ESTADO DE GARANTÍAS DE EQUIPOS</div>' +
    '<div class="rpt-obs-title">GARANTÍAS EN TRÁMITE / ESTADO ACTUAL <span class="rpt-edit-hint">✏️ clic para editar</span></div>' +
    '<div contenteditable="true" data-obs="2" class="rpt-obs-editable" style="min-height:60px;outline:none;border:1px solid #EDE8F5;border-radius:8px;padding:12px 14px;background:#F7F4FD;font-size:12px;color:#3D2D5C;line-height:1.8">' +
    (contrato?.garantias_equipos?.trim() ? esc(contrato.garantias_equipos) : 'Sin equipos en proceso de garantía actualmente. Edita aquí antes de imprimir si aplica.') +
    '</div></div>' +
    // S7
    '<div class="rpt-section"><div class="fmo-section-title">▌ 7. OBSERVACIONES Y ESTADO GENERAL</div>' +
    '<div style="display:grid;grid-template-columns:1fr 250px;gap:16px">' +
    '<div>' +
    '<div class="rpt-obs-title">OBSERVACIONES GENERALES <span class="rpt-edit-hint">✏️ clic para editar</span></div>' +
    `<div contenteditable="true" data-obs="3" class="rpt-obs-text rpt-obs-editable">${esc(obsFMO)}</div>` +
    '</div>' +
    '<div class="rpt-status-box">' +
    '<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">' +
    `<span style="width:9px;height:9px;border-radius:50%;background:${cumpleDisp ? '#4ADE80' : '#FF5757'};display:inline-block"></span>` +
    `<span style="font-size:12px;font-weight:800;color:${cumpleDisp ? '#4ADE80' : '#FF5757'}">● ${cumpleDisp ? 'OPERATIVO' : 'ATENCIÓN'}</span></div>` +
    `<div class="rpt-status-row" style="display:flex;justify-content:space-between"><span>🔆 Disponibilidad</span><span style="font-weight:700;color:${cumpleDisp ? '#2D8A4E' : '#CC0000'}">${dispStr}</span></div>` +
    `<div class="rpt-status-row" style="display:flex;justify-content:space-between"><span>⚡ Generación vs P90</span><span style="font-weight:700;color:${pctCol}">${pctStr}</span></div>` +
    `<div class="rpt-status-row" style="display:flex;justify-content:space-between"><span>📋 Eventos período</span><span style="font-weight:700">${mf.length}</span></div>` +
    `<div class="rpt-status-row" style="display:flex;justify-content:space-between"><span>⚠️ Fuera de SLA</span><span style="font-weight:700;color:${fueraSla === 0 ? '#2D8A4E' : '#CC0000'}">${fueraSla}</span></div>` +
    '<div style="border-top:1px solid #EDE8F5;margin-top:8px;padding-top:8px">' +
    `<div class="rpt-status-row">Resp: ${esc(resp)}</div>` +
    `<div class="rpt-status-row">Contratista: ${esc(contratista)}</div>` +
    `<div class="rpt-status-row">Prox. entrega: primeros 5 días de ${esc(nextMes(range.month))} ${range.year}</div>` +
    '</div></div></div></div>' +
    '<div class="rpt-footer">' +
    '<span>UNERGY ENERGÍA DIGITAL S.A.S ESP · Informe FMO · Confidencial</span>' +
    `<span>${esc(range.headerPeriod)} · Entrega: 5 primeros días del mes siguiente</span>` +
    '</div>' +
    '</div>'
}

function unergyLogoSVG() {
  return '<svg width="38" height="31" viewBox="0 0 44 36" fill="none"><circle cx="22" cy="4" r="3" fill="white"/><path d="M8 10 L8 24 Q8 34 22 34 Q36 34 36 24 L36 10" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'
}

// ── Generar ────────────────────────────────────────────────────────
async function generar() {
  if (!puedeGenerar.value) return
  const range = buildRange()
  if (!range) {
    error.value = { title: 'Rango inválido', detail: 'Selecciona un período válido.' }
    return
  }
  generando.value = true
  error.value = null
  htmlContent.value = ''
  informeIdGuardado.value = null
  ultimoRange.value = range
  loadingMsg.value = 'Consultando generación…'
  loadingSub.value = ''

  try {
    if (tipo.value === 'proyecto') {
      const sp = proyectoSel.value
      const cfg = proyectos.value.find(p => p.sub_project === sp)
      if (!cfg) throw new Error('Proyecto no encontrado')
      ultimoSubProject.value = sp
      const r = await monitoreoLegacyService.obtenerGeneracion({ sub_project: sp, date_from: range.from, date_to: range.to })
      const mf = getFaultsForRange(cfg, range)
      htmlContent.value = buildProjectPage(cfg, r || {}, mf, range, 1, 1)
      resultTitle.value = cfg.nombre_display || cfg.nombre_clientes || cfg.nombre_comercial || sp
      rangeLabel.value = range.label
    } else if (tipo.value === 'fmo') {
      const sp = proyectoSel.value
      const cfg = proyectos.value.find(p => p.sub_project === sp) || contratosFmo.value.find(c => c.sub_project === sp) || { sub_project: sp, nombre_clientes: sp }
      ultimoSubProject.value = sp
      loadingMsg.value = 'Consultando generación e inversores…'
      const [genRes, fmoRes] = await Promise.allSettled([
        monitoreoLegacyService.obtenerGeneracion({ sub_project: sp, date_from: range.from, date_to: range.to }),
        monitoreoLegacyService.obtenerDatosFmo({ sub_project: sp, date_from: range.from, date_to: range.to }),
      ])
      const r = genRes.status === 'fulfilled' ? genRes.value : { ok: true, data: [] }
      const fmoData = fmoRes.status === 'fulfilled' ? fmoRes.value : {}
      const mf = getFaultsForRange(cfg, range)
      htmlContent.value = buildFMOPage(cfg, r || {}, mf, range, fmoData || {})
      resultTitle.value = cfg.nombre_clientes || cfg.nombre_display || cfg.nombre_comercial || sp
      rangeLabel.value = range.label
    } else if (tipo.value === 'portafolio') {
      const portName = portafolioSel.value
      const projNames = portafolios.value[portName] || []
      if (!projNames.length) throw new Error(`Portafolio "${portName}" sin proyectos asociados`)
      const cfgs = projNames
        .map(name => {
          const nl = String(name).trim().toLowerCase()
          return proyectos.value.find(p =>
            nl === (p.nombre_clientes || '').trim().toLowerCase() ||
            nl === (p.nombre_display || '').trim().toLowerCase() ||
            nl === (p.nombre_bitacora || '').trim().toLowerCase() ||
            nl === (p.nombre_comercial || '').trim().toLowerCase()
          )
        })
        .filter(Boolean)
      if (!cfgs.length) throw new Error('No se encontraron proyectos del portafolio en la plataforma')
      ultimoSubProject.value = `port_${portName.replace(/[^\w-]/g, '_').toLowerCase()}`

      loadingMsg.value = `Consultando ${cfgs.length} proyectos…`
      const results = []
      for (let i = 0; i < cfgs.length; i++) {
        const c = cfgs[i]
        loadingSub.value = `(${i + 1}/${cfgs.length}) ${c.nombre_clientes || c.nombre_display || c.nombre_comercial}`
        try {
          const r = await monitoreoLegacyService.obtenerGeneracion({ sub_project: c.sub_project, date_from: range.from, date_to: range.to })
          results.push({ cfg: c, genRes: r && r.ok ? r : { ok: true, data: [] }, mf: getFaultsForRange(c, range) })
        } catch {
          results.push({ cfg: c, genRes: { ok: true, data: [] }, mf: [] })
        }
      }
      results.sort((a, b) => {
        const ta = a.genRes.data.reduce((s, d) => s + d.kwh, 0)
        const tb = b.genRes.data.reduce((s, d) => s + d.kwh, 0)
        return tb - ta
      })
      const totalPages = results.length + 1
      const consolidada = buildConsolidatedPage(portName, results, range, totalPages)
      const miembros = results.map((pd, i) => {
        const sp = pd.cfg.sub_project
        const html = buildProjectPage(pd.cfg, pd.genRes, pd.mf, range, i + 2, totalPages)
          .replace('<div class="rpt-page">', `<div class="rpt-page" data-sub-project="${sp}" data-nombre="${pd.cfg.nombre_clientes || pd.cfg.nombre_display || pd.cfg.nombre_comercial || sp}">`)
        return {
          sub_project: sp,
          nombre: pd.cfg.nombre_clientes || pd.cfg.nombre_display || pd.cfg.nombre_comercial || sp,
          orden: i,
          html,
        }
      })
      ultimaConsolidada.value = consolidada
      ultimosMiembros.value = miembros
      htmlContent.value = [consolidada, ...miembros.map(m => m.html)].join('<div class="rpt-page-sep"></div>')
      resultTitle.value = portName
      rangeLabel.value = range.label
    } else if (tipo.value === 'ranking') {
      // Resolver proyectos según alcance
      let cfgs = []
      let scopeLabel = ''
      if (rankingScope.value === 'portafolio') {
        const portName = portafolioSel.value
        const projNames = portafolios.value[portName] || []
        cfgs = projNames
          .map(name => {
            const nl = String(name).trim().toLowerCase()
            return proyectos.value.find(p =>
              nl === (p.nombre_clientes || '').trim().toLowerCase() ||
              nl === (p.nombre_display || '').trim().toLowerCase() ||
              nl === (p.nombre_bitacora || '').trim().toLowerCase() ||
              nl === (p.nombre_comercial || '').trim().toLowerCase()
            )
          })
          .filter(Boolean)
        scopeLabel = portName
        if (!cfgs.length) throw new Error('No se encontraron proyectos del portafolio en la plataforma')
      } else {
        cfgs = proyectos.value.filter(p => proyectosSel.value.includes(p.sub_project))
        scopeLabel = `${cfgs.length} proyecto${cfgs.length !== 1 ? 's' : ''}`
        if (!cfgs.length) throw new Error('Selecciona al menos un proyecto')
      }
      const meses = monthsInRange()
      if (!meses.length) throw new Error('Período inválido')

      const pages = []
      const totalReq = meses.length * cfgs.length
      let done = 0
      for (const mes of meses) {
        const items = []
        for (const c of cfgs) {
          done++
          const cn = c.nombre_comercial || c.nombre_display || c.nombre_clientes || c.sub_project
          loadingSub.value = `(${done}/${totalReq}) ${mes.label} — ${cn}`
          let tot = 0, p90 = null
          try {
            const r = await monitoreoLegacyService.obtenerGeneracion({ sub_project: c.sub_project, date_from: mes.from, date_to: mes.to })
            const arr = (r && r.data) || []
            tot = arr.reduce((s, d) => s + d.kwh, 0)
            p90 = r?.simulation?.p90_monthly ?? null
          } catch { /* sin datos para ese mes */ }
          items.push({ name: cn, real: tot, p90 })
        }
        items.sort((a, b) => (b.real || 0) - (a.real || 0))
        pages.push(buildRankingPage(scopeLabel, mes.label, items))
      }
      ultimoSubProject.value = `ranking_${rankingScope.value}_${scopeLabel}`.replace(/[^\w-]/g, '_').toLowerCase().slice(0, 180)
      htmlContent.value = pages.join('<div class="rpt-page-sep"></div>')
      resultTitle.value = scopeLabel
      rangeLabel.value = meses.length > 1 ? `${meses[0].label} – ${meses[meses.length - 1].label}` : meses[0].label
    }
    ultimoTipo.value = tipo.value === 'portafolio' ? 'port' : tipo.value === 'fmo' ? 'fmo' : tipo.value === 'ranking' ? 'ranking' : 'op'
  } catch (e) {
    logger.error('operaciones', e)
    error.value = { title: 'Error al generar el informe', detail: e.data?.detail || e.message }
  } finally {
    generando.value = false
    loadingSub.value = ''
    nextTick(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) })
  }
}

// ── Guardar ─────────────────────────────────────────────────────────
// Para portafolio: averigua qué proyectos ya tienen informe individual ('op') guardado
// para el mismo período. Los que sí → se vinculan (html_inline=null, el portafolio usa
// el individual vivo). Los que no → se embeben (html_inline = sección generada/editada).
async function buildMiembrosPayload() {
  const from = ultimoRange.value.from
  const pages = [...reportRef.value.querySelectorAll('.rpt-page')]
  const secciones = pages.slice(1)   // pages[0] = consolidada
  const miembros = []
  for (let i = 0; i < ultimosMiembros.value.length; i++) {
    const m = ultimosMiembros.value[i]
    const el = secciones.find(p => p.getAttribute('data-sub-project') === m.sub_project) || secciones[i]
    const sectionHtml = el ? el.outerHTML : m.html
    let existeIndiv = false
    try {
      const data = await informesService.listar({
        tipo: 'op', sub_project: m.sub_project, periodo_desde_gte: from, periodo_desde_lte: from, limit: 1,
      })
      existeIndiv = Array.isArray(data) && data.length > 0
    } catch { /* si falla la consulta, embebemos por seguridad */ }
    miembros.push({
      sub_project: m.sub_project,
      nombre: m.nombre,
      orden: i,
      html_inline: existeIndiv ? null : sectionHtml,
    })
  }
  return miembros
}

async function guardar() {
  if (!htmlContent.value || !reportRef.value || !ultimoRange.value) return
  guardando.value = true
  try {
    const tipoApi = ultimoTipo.value || (tipo.value === 'portafolio' ? 'port' : tipo.value === 'fmo' ? 'fmo' : 'op')
    const payload = {
      tipo: tipoApi,
      sub_project: ultimoSubProject.value,
      periodo_desde: ultimoRange.value.from,
      periodo_hasta: ultimoRange.value.to,
      periodo_display: ultimoRange.value.label,
      proyecto_nombre: resultTitle.value,
      html_content: reportRef.value.innerHTML,
    }
    if (tipoApi === 'port') {
      // El portafolio guarda SOLO la página consolidada como html_content; las secciones
      // van en miembros (vinculadas o embebidas).
      const pages = [...reportRef.value.querySelectorAll('.rpt-page')]
      payload.html_content = pages.length ? pages[0].outerHTML : ultimaConsolidada.value
      payload.miembros = await buildMiembrosPayload()
    }
    const data = await informesService.guardar(payload)
    informeIdGuardado.value = data.id
    toast('💾 Informe guardado como borrador')
  } catch (e) {
    const detail = e.data?.detail
    const msg = Array.isArray(detail) ? detail.map(d => `${d.loc?.slice(-1)[0] ?? ''}: ${d.msg}`).join(' | ') : (detail ?? e.message)
    toast(`⚠️ ${msg}`, true)
  } finally {
    guardando.value = false
  }
}

// Watchers para limpiar selecciones cuando cambia el tipo
watch(tipo, (t) => {
  // No se limpia en 'ranking' (usa portafolio o proyectos según el alcance)
  if (t === 'portafolio') proyectoSel.value = ''
  else if (t === 'proyecto' || t === 'fmo') portafolioSel.value = ''
})
</script>

<style scoped>
.im-wrap {
  font-family: 'Sora', system-ui, sans-serif;
}

/* Toast */
.im-toast {
  position: fixed; top: 80px; right: 24px;
  padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 700;
  z-index: 60; box-shadow: 0 4px 18px rgba(0,0,0,.16);
}
.im-toast-ok { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
.im-toast-err { background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Toolbar compacto */
.im-toolbar {
  background: #fff;
  border-radius: 10px;
  padding: 10px 14px 12px;
  margin: 12px 16px 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
  border: 1px solid #ECE7F2;
}
.im-row {
  display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px;
}
.im-row-top { align-items: center; margin-bottom: 10px; gap: 14px; }

.im-segmented {
  display: inline-flex; background: #F4F1FA; border-radius: 7px; padding: 2px; border: 1px solid #E5E2EC;
}
.im-segmented-lg .im-seg-btn { padding: 6px 11px; font-size: 12px; }
.im-seg-btn {
  border: none; background: transparent; color: #6B5A8A;
  padding: 5px 10px; border-radius: 5px; font-size: 11px; font-weight: 700;
  cursor: pointer; transition: all .15s; font-family: inherit;
  display: inline-flex; align-items: center; gap: 5px;
}
.im-seg-btn:hover { color: var(--color-unergy-deep); }
.im-seg-btn--active {
  background: var(--color-unergy-purple); color: var(--color-unergy-avena);
  box-shadow: 0 2px 6px rgba(145,91,216,.25);
}
.im-seg-btn--active:hover { color: #fff; }

.im-tip {
  font-size: 11px; color: #6B5A8A;
  display: inline-flex; align-items: center; gap: 5px;
}
.im-tip svg { color: var(--color-unergy-purple); font-size: 11px; }

.im-field { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 200px; }
.im-field-narrow { flex: 0 0 auto; min-width: 120px; }
.im-field-actions { flex: 0 0 auto; }
.im-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; color: #9CA3AF;
}
.im-select :deep(.p-select) { width: 100%; }
.im-select :deep(.p-select-label) { padding: 5px 10px; font-size: 12px; }
.im-input {
  border: 1.5px solid #E5E2EC; border-radius: 6px; padding: 5px 10px;
  font-size: 12px; color: var(--color-unergy-deep); outline: none; font-family: inherit;
  background: #fff;
  transition: border-color .15s;
  color-scheme: light;
  height: 30px;
}
.im-input:focus { border-color: var(--color-unergy-purple); }
:deep(.im-btn-primary) {
  background: var(--color-unergy-purple) !important; border-color: var(--color-unergy-purple) !important; color: var(--color-unergy-avena) !important;
}
:deep(.im-btn-primary:hover) {
  background: #7C3AED !important; border-color: #7C3AED !important;
}
:deep(.im-btn-primary.p-button:focus) {
  box-shadow: 0 0 0 2px rgba(145,91,216,.25) !important;
}

/* Deadline banner (compacto) */
.im-deadline {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; padding: 6px 12px; border-radius: 8px;
  margin: 0 0 10px; border: 1px solid;
  font-size: 12px;
}
.im-deadline-left { display: inline-flex; align-items: center; gap: 6px; color: #4B3A6E; }
.im-deadline-right { font-weight: 800; font-size: 12px; }
.im-deadline--green  { background: #F0FDF4; border-color: #BBF7D0; }
.im-deadline--green  .im-deadline-right { color: #16A34A; }
.im-deadline--yellow { background: #FEFCE8; border-color: #FDE68A; }
.im-deadline--yellow .im-deadline-right { color: #B45309; }
.im-deadline--red    { background: #FEF2F2; border-color: #FECACA; }
.im-deadline--red    .im-deadline-right { color: #DC2626; }

/* Estados (loading/error/empty) — más compactos */
.im-empty, .im-error {
  margin: 16px;
  background: #fff; border: 1px solid #ECE7F2; border-radius: 10px;
  padding: 40px 24px; text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.im-error { flex-direction: row; text-align: left; padding: 14px 18px; align-items: center; }
.im-empty-title { font-size: 14px; font-weight: 800; color: var(--color-unergy-deep); }
.im-empty-sub { font-size: 12px; color: #6B5A8A; max-width: 460px; }

/* Result bar (sticky-friendly y compacto) */
.im-result-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
  margin: 10px 16px 0;
  padding: 7px 14px;
  background: #fff; border-radius: 10px;
  border: 1px solid #ECE7F2;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
  position: sticky; top: 0; z-index: 8;
}
.im-result-meta { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.im-result-pill {
  font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 20px;
  letter-spacing: .4px; text-transform: uppercase;
}
.im-pill-proyecto   { background: #F3F0FF; color: #6D28D9; border: 1px solid #E9D5FF; }
.im-pill-portafolio { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
.im-pill-fmo        { background: #DBEAFE; color: #1D4ED8; border: 1px solid #BFDBFE; }
.im-result-title { font-weight: 700; color: #1A1025; font-size: 13px; }
.im-result-sub { color: #6B5A8A; font-size: 11px; }
.im-result-actions { display: inline-flex; gap: 6px; flex-wrap: wrap; }

/* Report frame */
.im-report-frame {
  margin: 10px 16px 60px;
  background: #ECE9F2;
  border-radius: 10px;
  padding: 18px;
  border: 1px solid #DAD3EA;
}
.im-report {
  max-width: 920px; margin: 0 auto;
  font-family: 'Sora', system-ui, sans-serif;
}

/* ─── Estilos del INFORME (rpt-*) — reaprovechan los estilos del legacy ─── */
.im-report :deep(.rpt-page) {
  background: #fff;
  padding: 30px 36px;
  border-radius: 8px;
  box-shadow: 0 2px 14px rgba(0,0,0,.08);
  margin-bottom: 24px;
  color: var(--color-unergy-deep);
}
.im-report :deep(.rpt-page-sep) {
  height: 22px;
}
.im-report :deep(.rpt-header) {
  background: linear-gradient(135deg, var(--color-unergy-deep) 0%, #3d2b52 70%, #4a2d6e 100%);
  border-radius: 8px;
  padding: 18px 22px 16px;
  color: var(--color-unergy-avena);
  margin: -30px -36px 22px;
}
.im-report :deep(.rpt-meta-grid) {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
  margin-top: 14px;
}
.im-report :deep(.rpt-meta-item) {
  background: rgba(255,255,255,.06); padding: 7px 10px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.12);
}
.im-report :deep(.rpt-meta-lbl) {
  font-size: 9px; color: rgba(253,250,247,.55); font-weight: 700;
  letter-spacing: .6px; text-transform: uppercase; margin-bottom: 2px;
}
.im-report :deep(.rpt-meta-val) {
  font-size: 12px; color: var(--color-unergy-avena); font-weight: 700;
}
.im-report :deep(.rpt-section) {
  margin-bottom: 26px;
}
.im-report :deep(.rpt-section-title), .im-report :deep(.fmo-section-title) {
  font-size: 13px; font-weight: 800; color: #6B35C0;
  letter-spacing: .3px; margin-bottom: 12px;
  padding-bottom: 6px; border-bottom: 2px solid #ECE7F2;
}
.im-report :deep(.rpt-kpi-row) {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
}
.im-report :deep(.rpt-kpi-row > .rpt-kpi:only-child) { grid-column: span 3; }
.im-report :deep(.rpt-kpi) {
  background: #F7F4FD; border: 1px solid #ECE7F2; border-radius: 9px;
  padding: 12px 14px; text-align: center;
}
.im-report :deep(.rpt-kpi-ico) { font-size: 18px; margin-bottom: 4px; }
.im-report :deep(.rpt-kpi-lbl) {
  font-size: 9px; color: #888; font-weight: 700; letter-spacing: .6px;
  text-transform: uppercase;
}
.im-report :deep(.rpt-kpi-val) {
  font-size: 16px; font-weight: 800; color: #1A1025; margin-top: 4px;
}
.im-report :deep(.rpt-table) {
  width: 100%; border-collapse: collapse; font-size: 11px;
  background: #fff; border: 1px solid #ECE7F2; border-radius: 6px; overflow: hidden;
}
.im-report :deep(.rpt-table thead tr) {
  background: #F7F4FD;
}
.im-report :deep(.rpt-table thead th) {
  padding: 7px 9px; text-align: left; font-size: 9px;
  font-weight: 800; color: #6B5A8A; letter-spacing: .5px; text-transform: uppercase;
  border-bottom: 1px solid #E5E2EC;
}
.im-report :deep(.rpt-table tbody td) {
  padding: 7px 9px; border-bottom: 1px solid #F3F0F9; color: var(--color-unergy-deep);
}
.im-report :deep(.rpt-total-row) {
  background: #FAF8FE; font-weight: 800; border-top: 2px solid #6B35C0;
}
.im-report :deep(.rpt-total-row td) { font-weight: 800; }

.im-report :deep(.rpt-chart-card) {
  background: #FCFAFE; border: 1px solid #ECE7F2; border-radius: 9px;
  padding: 12px 14px;
}
.im-report :deep(.rpt-chart-box) {
  position: relative; height: 200px; width: 100%;
}
.im-report :deep(.rpt-chart-box-tall) { height: auto; min-height: 220px; }
.im-report :deep(.rpt-chart-empty) {
  height: 200px; display: flex; align-items: center; justify-content: center;
  color: #A89EC0; font-size: 11px;
}

.im-report :deep(.rpt-obs-title) {
  font-size: 9px; color: #A89EC0; font-weight: 700; letter-spacing: .7px;
  text-transform: uppercase; margin-bottom: 6px;
}
.im-report :deep(.rpt-edit-hint) {
  font-size: 9px; color: var(--color-unergy-purple); font-weight: 700; letter-spacing: 0;
  text-transform: none; margin-left: 6px; cursor: pointer;
}
.im-report :deep(.rpt-obs-text), .im-report :deep(.rpt-obs-editable) {
  min-height: 80px; outline: none; border-left: 3px solid #4ADE80;
  padding: 13px 15px; border-radius: 8px; background: #F0FFF4;
  font-size: 12px; color: #3D2D5C; line-height: 1.8;
}
.im-report :deep(.rpt-obs-editable:focus) {
  background: #FFFBF0; border-left-color: #6B35C0;
  box-shadow: 0 0 0 2px rgba(145,91,216,.15);
}
.im-report :deep(.rpt-status-box) {
  background: #F7F4FD; border: 1px solid #ECE7F2; border-radius: 9px;
  padding: 14px 16px;
}
.im-report :deep(.rpt-status-row) {
  font-size: 11px; color: #4B3A6E; margin-bottom: 5px; line-height: 1.5;
}
.im-report :deep(.rpt-footer) {
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;
  margin-top: 18px; padding-top: 12px; border-top: 1px solid #ECE7F2;
  font-size: 10px; color: #888;
}

/* FMO-specific */
.im-report :deep(.fmo-multa-box) {
  background: #FEF2F2; border: 1px solid #FECACA; border-radius: 9px;
  padding: 12px 14px; margin-top: 10px;
}
.im-report :deep(.fmo-ok-box) {
  background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 9px;
  padding: 12px 14px; margin-top: 10px;
}
.im-report :deep(.fmo-inv-table), .im-report :deep(.fmo-mant-table) {
  width: 100%; border-collapse: collapse; font-size: 11px;
  background: #fff; border: 1px solid #ECE7F2; border-radius: 6px; overflow: hidden;
}
.im-report :deep(.fmo-inv-table thead), .im-report :deep(.fmo-mant-table thead) {
  background: #F7F4FD;
}
.im-report :deep(.fmo-inv-table thead th), .im-report :deep(.fmo-mant-table thead th) {
  padding: 7px 9px; text-align: left; font-size: 9px;
  font-weight: 800; color: #6B5A8A; letter-spacing: .5px; text-transform: uppercase;
  border-bottom: 1px solid #E5E2EC;
}
.im-report :deep(.fmo-inv-table tbody td), .im-report :deep(.fmo-mant-table tbody td) {
  padding: 6px 9px; border-bottom: 1px solid #F3F0F9;
}
.im-report :deep(.fmo-status-ok) { color: #2D8A4E; font-weight: 700; }
.im-report :deep(.fmo-status-err) { color: #CC0000; font-weight: 700; }
.im-report :deep(.fmo-sla-ok) { color: #2D8A4E; font-weight: 800; text-align: center; }
.im-report :deep(.fmo-sla-err) { color: #CC0000; font-weight: 800; text-align: center; }

</style>

<!-- Reglas globales (sin scoped) para impresión -->
<style>
@media print {
  body.im-printing { background: #fff !important; }
  body.im-printing .im-no-print { display: none !important; }
  body.im-printing .inf-hero,
  body.im-printing .inf-tabs,
  body.im-printing .inf-kpis,
  body.im-printing .inf-filtros-bar,
  body.im-printing aside,
  body.im-printing header,
  body.im-printing nav { display: none !important; }
  body.im-printing .im-report-frame {
    margin: 0 !important; padding: 0 !important; background: #fff !important;
    border: none !important;
  }
  body.im-printing .im-report { max-width: none !important; margin: 0 !important; }
  body.im-printing .im-report .rpt-page {
    box-shadow: none !important; margin: 0 0 16px !important;
    border-radius: 0 !important;
    page-break-after: always; break-after: page;
  }
  body.im-printing .im-report .rpt-page-sep { display: none !important; }
  body.im-printing .rpt-edit-hint { display: none !important; }
}
</style>
