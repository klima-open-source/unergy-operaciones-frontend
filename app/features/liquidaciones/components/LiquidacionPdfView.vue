<template>
  <div class="liqpdf-wrapper">
    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastMsg" :class="['liqpdf-toast', toastErr ? 'is-err' : 'is-ok']">{{ toastMsg }}</div>
    </transition>

    <!-- Toolbar (no se imprime) -->
    <div class="liqpdf-toolbar">
      <div class="flex items-center gap-2">
        <Button label="Volver" text size="small" @click="volver">
          <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
        </Button>
        <div>
          <div class="text-sm font-bold" style="color:var(--color-unergy-deep)">Informe PDF — Estado de Resultados</div>
          <div class="text-[11px]" style="color:#9b8fb0">
            {{ liq?.proyecto_nombre }} · {{ periodoLabel }}
            <span v-if="actualizadoEn"> · guardado {{ actualizadoEn }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <Select v-model="selInv" :options="opcionesInv" optionLabel="label" optionValue="value"
          size="small" class="liqpdf-sel" :disabled="editMode" @change="onSelChange"
          title="Inversionista que aparecerá en el informe" />
        <Button v-if="!editMode" label="Editar" outlined size="small" style="border-color:var(--color-unergy-purple); color:var(--color-unergy-purple)" @click="enterEdit">
          <template #icon><PencilIcon class="size-[1em]" /></template>
        </Button>
        <Button v-if="editMode" label="Descartar" outlined size="small" severity="secondary" @click="discardEdit">
          <template #icon><UndoIcon class="size-[1em]" /></template>
        </Button>
        <Button v-if="editMode" label="Guardar" size="small" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple)" :loading="saving" @click="guardar">
          <template #icon><SaveIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Regenerar" outlined size="small" severity="secondary" @click="regenerar" :disabled="editMode" title="Reconstruir el informe desde los datos actuales">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Descargar PDF" size="small" style="background:var(--color-unergy-yellow); border-color:var(--color-unergy-yellow); color:var(--color-unergy-deep)" @click="descargar">
          <template #icon><FileTextIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Descargar Excel" size="small" style="background:#1D6F42; border-color:#1D6F42" @click="descargarExcel">
          <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <div v-if="editMode" class="liqpdf-hint">
      ✏️ Haz clic en cualquier texto para editarlo. Al terminar pulsa <b>Guardar</b>.
      El PDF respeta saltos de página: las capas no se cortan y el pie va siempre al final de cada hoja.
    </div>

    <ProgressSpinner v-if="loading" class="block mx-auto my-10" />

    <!-- Lienzo del informe -->
    <div v-show="!loading" class="liqpdf-canvas">
      <div ref="contentRef" class="liq-doc" :contenteditable="editMode ? 'true' : 'false'" v-html="htmlContent" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Select from 'primevue/select'
import ProgressSpinner from 'primevue/progressspinner'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { MonitoreoLegacyService } from '~/features/operaciones/services/monitoreo-legacy'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ArrowLeftIcon, FileSpreadsheetIcon, FileTextIcon, PencilIcon, RefreshCwIcon, SaveIcon, UndoIcon } from '@lucide/vue'
import {
  fmtCOP, pct, normPct, formatPeriodo,
  construirEstadoResultados, indiceSoportesProyecto,
} from '~/features/liquidaciones/utils/liquidaciones'

const route = useRoute()
const router = useRouter()
const liquidacionesService = new LiquidacionesService()
const monitoreoLegacyService = new MonitoreoLegacyService()
const contratosServicioService = new ContratosServicioService()
const proyectosService = new ProyectosService()

const liq = ref(null)
const inversionistas = ref([])
const panelER = ref(null)   // entrada de proyecto de resumen-panel (fuente única del ER)
const htmlContent = ref('')
const actualizadoEn = ref(null)
const loading = ref(false)
const saving = ref(false)
const editMode = ref(false)
const contentRef = ref(null)
const toastMsg = ref('')
const toastErr = ref(false)
let _t = null

const periodoLabel = computed(() => formatPeriodo(liq.value?.periodo))

// Selección de inversionista (null = todos: Total + cada inversionista)
const selInv = ref(null)
// Datos de generación (API monitoreo) y comparativo (vista por-proyecto)
const dias = ref([])            // [{date, kwh}]
const genActual = ref(null)     // kWh del mes
const genProm = ref(null)       // promedio kWh de los 3 meses anteriores
const comp = ref(null)          // { actual:{ingresos,costosOp,facturas,neto}, promedio:{…}|null }
const tarifas = ref({ representacion: null, cgm: null, admin: null })

// Columnas (Total + inversionistas con movimientos) para selector y armado
const cols = computed(() => columnasDe())
const opcionesInv = computed(() => [
  { label: 'Todos (Total + inversionistas)', value: null },
  ...cols.value.filter(c => !c.es_total).map(c => ({ label: `${c.nombre} (${c.pct})`, value: Number(String(c.id).replace('inv', '')) })),
])

const fmtKwh = (v) => v == null ? '—' : (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + ' MWh' : Math.round(v) + ' kWh')
// Administración se cobra como % (no $/kWh). Acepta fracción (0.02) o número (2).
const fmtAdminPct = (v) => v == null ? '—' : `${(Math.abs(Number(v)) < 1 ? Number(v) * 100 : Number(v)).toFixed(2)}%`

function toast(msg, err = false) {
  toastMsg.value = msg; toastErr.value = err
  clearTimeout(_t); _t = setTimeout(() => { toastMsg.value = '' }, 4000)
}
function volver() {
  // Si hay edición sin guardar, confirmar antes de salir.
  if (editMode.value && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return
  // Navegación determinística hacia arriba (el padre del informe es su detalle).
  // Evita el ping-pong/loop que causa mezclar history.back() con push.
  router.push(`/liquidaciones/${route.params.id}`)
}

// ── Construcción del informe (bloques verticales: Total + cada inversionista) ──
// Una matriz ancha se desborda en el PDF; en su lugar cada entidad (Total e
// inversionista) lleva su propia tabla angosta Concepto · Valor · Soporte, que
// pagina limpio y nunca corta columnas.
const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const esDel = (m, piId) => m.inversionista?.id === piId || m.inversionista_id === piId

// Grupos del ER en orden; los negativos (comercializacion/costos/facturas) se
// muestran como magnitud con signo del grupo (igual que construirEstadoResultados).
const GRUPOS_ER = [
  { key: 'ingresos', label: 'Ingresos', sign: 1 },
  { key: 'comercializacion', label: 'Comercialización / Bolsa', sign: -1 },
  { key: 'costos', label: 'Costos operativos (OPEX)', sign: -1 },
  { key: 'facturas', label: 'Facturas de servicio', sign: -1 },
]

// Construye el mismo shape de `er` que construirEstadoResultados, pero desde los
// conceptos del Panel Contable (fuente única). El Panel guarda los costos con signo
// negativo; aquí se toma la magnitud por grupo (sign indica dirección), y el neto se
// calcula con signo para coincidir con utilidad(inv) del Panel.
function erDesdeConceptos(conceptos) {
  const grupos = []
  let ingresosTot = 0, comercTot = 0, costosTot = 0, facturasTot = 0
  for (const g of GRUPOS_ER) {
    const order = []
    const map = new Map()
    for (const c of (conceptos || [])) {
      if (c.grupo !== g.key) continue
      if (!map.has(c.concepto)) { map.set(c.concepto, 0); order.push(c.concepto) }
      map.set(c.concepto, map.get(c.concepto) + (Number(c.valor_cop) || 0))
    }
    if (!order.length) continue
    const rawTotal = order.reduce((s, c) => s + map.get(c), 0)
    const neg = g.sign < 0
    const lineas = order.map(c => ({
      label: c, valor: neg ? Math.abs(map.get(c)) : map.get(c),
      soporte_url: null, referencia: null, refCodigo: null,
    }))
    grupos.push({ key: g.key, label: g.label, lineas, total: neg ? Math.abs(rawTotal) : rawTotal, sign: g.sign })
    if (g.key === 'ingresos') ingresosTot = rawTotal
    else if (g.key === 'comercializacion') comercTot = Math.abs(rawTotal)
    else if (g.key === 'costos') costosTot = Math.abs(rawTotal)
    else if (g.key === 'facturas') facturasTot = Math.abs(rawTotal)
  }
  const valorAPagar = ingresosTot - comercTot
  const neto = valorAPagar - costosTot - facturasTot   // = ingresos + comerc + costos + facturas (con signo)
  return { grupos, valorAPagar, costosOperativos: costosTot, facturasTotal: facturasTot, neto }
}

// Columnas (Total + cada inversionista) desde el Panel Contable del período.
function columnasDe() {
  const p = panelER.value
  if (!p) return []
  const invs = p.inversionistas || []
  const cols = [{
    id: 'total', nombre: 'Total', pct: '100%', es_total: true,
    er: erDesdeConceptos(invs.flatMap(i => i.conceptos || [])),
  }]
  for (const inv of invs) {
    const er = erDesdeConceptos(inv.conceptos || [])
    if (!er.grupos.length) continue
    cols.push({
      id: 'inv' + (inv.proyecto_inversionista_id ?? inv.cliente_id ?? inv.nombre),
      nombre: inv.cliente_nombre || inv.nombre || 'Inversionista',
      pct: inv.porcentaje != null ? inv.porcentaje.toFixed(2) + '%' : '—',
      er,
    })
  }
  for (const c of cols) c.neto = c.er.neto
  return cols
}

// Con el Panel, cada inversionista ya trae sus facturas de servicio en sus conceptos.
function erConFacturas(col) { return col?.er }

// Tabla angosta (Concepto · Valor · Soporte) para un estado de resultados.
// Subtotales "Valor a pagar" que se insertan tras cada bloque contable
// (Mandato = Ingresos−Comercialización, Costos, Facturas), espejo de los
// mismos 3 checkpoints que muestra el Panel Contable.
const SUBTOT_TRAS_GRUPO = {
  comercializacion: (er) => ({ label: 'Valor a pagar (Ingresos − Comercialización)', valor: er.valorAPagar }),
  costos: (er) => ({ label: 'Valor a pagar (Costos Operativos)', valor: -Math.abs(er.costosOperativos || 0) }),
  facturas: (er) => ({ label: 'Valor a pagar (Facturas de Servicio)', valor: -Math.abs(er.facturasTotal || 0) }),
}

function detalleHtml(er) {
  const filas = er.grupos.map(g => {
    const neg = g.sign < 0
    const sub = `<tr class="rpt-grp"><td class="rpt-c-con">${esc(g.label)}</td>` +
      `<td class="rpt-c-val" style="color:${neg ? '#D64455' : '#2C2039'}">${neg ? '−' : ''}${fmtCOP(Math.abs(g.total))}</td>` +
      `<td class="rpt-c-sop"></td></tr>`
    const lineas = g.lineas.map(ln => {
      let sop = ''
      if (ln.soporte_url) sop = `<a class="rpt-sop" href="${esc(ln.soporte_url)}" target="_blank" rel="noopener">${esc(ln.refCodigo || 'Soporte')}</a>`
      else if (ln.refCodigo) sop = `<span class="rpt-sop-muted">${esc(ln.refCodigo)}</span>`
      return `<tr class="rpt-ln"><td class="rpt-c-con rpt-indent">${esc(ln.label)}</td>` +
        `<td class="rpt-c-val">${fmtCOP(ln.valor)}</td><td class="rpt-c-sop">${sop}</td></tr>`
    }).join('')
    const mkSub = SUBTOT_TRAS_GRUPO[g.key]
    const subtot = mkSub ? (({ label, valor }) =>
      `<tr class="rpt-subtot"><td class="rpt-c-con">${esc(label)}</td>` +
      `<td class="rpt-c-val">${fmtCOP(valor)}</td><td class="rpt-c-sop"></td></tr>`)(mkSub(er)) : ''
    return sub + lineas + subtot
  }).join('')
  const neto = `<tr class="rpt-neto"><td class="rpt-c-con">Valor a pagar</td><td class="rpt-c-val">${fmtCOP(er.neto)}</td><td class="rpt-c-sop"></td></tr>`
  return `<table class="rpt-detail"><thead><tr><th class="rpt-c-con">Concepto</th><th class="rpt-c-val">Valor</th><th class="rpt-c-sop">Soporte</th></tr></thead><tbody>${filas}${neto}</tbody></table>`
}

function kpisHtml(er) {
  // "Ingresos" = ingreso bruto (total del grupo Ingresos), no el valor a pagar.
  const ingresos = er.grupos.find(g => g.key === 'ingresos')?.total ?? er.valorAPagar
  const costosTot = (er.costosOperativos || 0) + (er.facturasTotal || 0)
  const k = [
    { lbl: 'Ingresos', val: fmtCOP(ingresos) },
    { lbl: 'Costos y facturas', val: fmtCOP(costosTot) },
    { lbl: 'Ingreso neto', val: fmtCOP(er.neto), big: true },
  ]
  return `<div class="rpt-kpis">${k.map(x => `<div class="rpt-kpi${x.big ? ' rpt-kpi-big' : ''}"><div class="rpt-kpi-lbl">${x.lbl}</div><div class="rpt-kpi-val">${x.val}</div></div>`).join('')}</div>`
}

// Gráfica de generación diaria como SVG inline (vive en el HTML guardado/impreso).
function svgGeneracion(ds) {
  if (!ds.length) return '<div class="rpt-empty">Sin datos de generación para este período.</div>'
  const W = 720, H = 168, padL = 42, padR = 8, padT = 8, padB = 20
  const max = Math.max(...ds.map(d => d.kwh), 1)
  const innerW = W - padL - padR, innerH = H - padT - padB
  const n = ds.length, bw = innerW / n, baseY = padT + innerH
  const bars = ds.map((d, i) => {
    const h = Math.max((d.kwh / max) * innerH, 0)
    const x = padL + i * bw + bw * 0.12, y = baseY - h
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="#915BD8"/>`
  }).join('')
  const xlabels = ds.map((d, i) => {
    if (i % 5 !== 0 && i !== n - 1) return ''
    const x = padL + i * bw + bw * 0.5
    return `<text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="8" fill="#9b8fb0">${Number(d.date.split('-')[2])}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">` +
    `<line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="#ece4f5"/>` +
    `<text x="${padL - 5}" y="${padT + 8}" text-anchor="end" font-size="8" fill="#9b8fb0">${fmtKwh(max)}</text>` +
    `<text x="${padL - 5}" y="${baseY}" text-anchor="end" font-size="8" fill="#9b8fb0">0</text>` +
    `${bars}${xlabels}</svg>`
}

// "Este mes vs promedio del proyecto" (nivel proyecto, contexto del informe).
function comparativoSectionHtml() {
  const c = comp.value
  if (!c || !c.actual) return ''
  const a = c.actual, p = c.promedio
  const delta = (cur, prev) => (prev && cur != null ? (cur - prev) / Math.abs(prev) * 100 : null)
  const costosA = a.costosOp + a.facturas
  const costosP = p ? p.costosOp + p.facturas : null
  const items = [
    { lbl: 'Generado', val: fmtKwh(genActual.value), d: delta(genActual.value, genProm.value) },
    { lbl: 'Ingresos', val: fmtCOP(a.ingresos), d: delta(a.ingresos, p?.ingresos) },
    { lbl: 'Costos totales', val: fmtCOP(costosA), d: delta(costosA, costosP) },
    { lbl: 'Ingreso neto', val: fmtCOP(a.neto), d: delta(a.neto, p?.neto) },
  ]
  const cards = items.map(x => `<div class="rpt-kpi"><div class="rpt-kpi-lbl">${x.lbl}</div><div class="rpt-kpi-val">${x.val}</div>` +
    (x.d != null ? `<div class="rpt-delta ${x.d >= 0 ? 'up' : 'down'}">${x.d >= 0 ? '▲' : '▼'} ${Math.abs(x.d).toFixed(0)}% vs prom.</div>` : '') + `</div>`).join('')
  return `<section class="rpt-block"><h2 class="rpt-h2">Este mes vs promedio del proyecto</h2><div class="rpt-kpis rpt-kpis-4">${cards}</div></section>`
}

// Generación del mes (gráfica + KPIs + tarifas), nivel proyecto.
function generacionSectionHtml() {
  if (!dias.value.length) return ''
  const tot = dias.value.reduce((s, d) => s + d.kwh, 0)
  const t = tarifas.value
  const hayTar = t.representacion != null || t.cgm != null || t.admin != null
  const tarifasHtml = hayTar ? `<div class="rpt-tarifas">
      <div class="rpt-tar"><span>Representación ($/kWh)</span><b>${fmtCOP(t.representacion)}</b></div>
      <div class="rpt-tar"><span>CGM ($/kWh)</span><b>${fmtCOP(t.cgm)}</b></div>
      <div class="rpt-tar"><span>Administración (%)</span><b>${fmtAdminPct(t.admin)}</b></div>
    </div>` : ''
  return `<section class="rpt-block">
      <h2 class="rpt-h2">Generación del mes</h2>
      <div class="rpt-gen-kpis"><span>Generado <b>${fmtKwh(tot)}</b></span><span>Días <b>${dias.value.length}</b></span><span>Promedio/día <b>${fmtKwh(tot / dias.value.length)}</b></span></div>
      <div class="rpt-chart">${svgGeneracion(dias.value)}</div>
      ${tarifasHtml}
    </section>`
}

function buildHtml() {
  const l = liq.value
  if (!l) return ''
  const cs = cols.value
  const periodo = formatPeriodo(l.periodo)
  const proyecto = esc(l.proyecto_nombre || '')

  // Estado de Resultados según selección de inversionista
  const sel = selInv.value
  const selCol = sel != null ? cs.find(c => c.id === 'inv' + sel) : null
  let estado = ''
  if (!cs.length) {
    estado = `<section class="rpt-block"><div class="rpt-empty">Sin panel contable para este período. Carga el ER en Panel Contable.</div></section>`
  } else if (selCol) {
    const erSel = erConFacturas(selCol)
    estado = `
    <section class="rpt-block rpt-inv">
      <div class="rpt-inv-head"><span class="rpt-inv-name">${esc(selCol.nombre)}</span><span class="rpt-inv-pct">${selCol.pct}</span></div>
      ${kpisHtml(erSel)}
      ${detalleHtml(erSel)}
    </section>`
  } else {
    const total = cs.find(c => c.es_total)
    const invsCols = cs.filter(c => !c.es_total)
    estado = (total ? `
    <section class="rpt-block">
      <h2 class="rpt-h2">Resumen del proyecto · Total</h2>
      ${kpisHtml(total.er)}
      ${detalleHtml(total.er)}
    </section>` : '') +
      (invsCols.length ? `
    <section class="rpt-block"><h2 class="rpt-h2">Desglose por inversionista</h2></section>` +
        invsCols.map(c => `
    <section class="rpt-block rpt-inv">
      <div class="rpt-inv-head"><span class="rpt-inv-name">${esc(c.nombre)}</span><span class="rpt-inv-pct">${c.pct}</span></div>
      ${detalleHtml(c.er)}
    </section>`).join('') : '')
  }

  const invLine = selCol ? `<div class="rpt-cover-inv">Inversionista: <b>${esc(selCol.nombre)}</b> · ${selCol.pct}</div>` : ''
  const cover = `
    <section class="rpt-block rpt-cover">
      <div class="rpt-title">Estado de Resultados</div>
      <div class="rpt-subtitle">${proyecto}</div>
      ${invLine}
      <div class="rpt-meta-grid">
        <div class="rpt-meta"><div class="rpt-meta-lbl">Periodo</div><div class="rpt-meta-val">${periodo}</div></div>
        <div class="rpt-meta"><div class="rpt-meta-lbl">Estado</div><div class="rpt-meta-val">${esc(l.estado || '—')}</div></div>
        <div class="rpt-meta"><div class="rpt-meta-lbl">Tasa de cambio</div><div class="rpt-meta-val">${l.tasa_cambio ?? '—'}</div></div>
        <div class="rpt-meta"><div class="rpt-meta-lbl">Comprobante</div><div class="rpt-meta-val">${esc(l.comprobante_contable_ref || '—')}</div></div>
      </div>
    </section>`

  const obs = l.observaciones_resultados ? `
    <section class="rpt-block">
      <h2 class="rpt-h2">Observaciones</h2>
      <p class="rpt-obs">${esc(l.observaciones_resultados)}</p>
    </section>` : ''

  const content = cover + comparativoSectionHtml() + generacionSectionHtml() + estado + obs

  // Wrapper de página con thead/tfoot → header y pie se repiten en cada hoja.
  return `
<table class="rpt-page">
  <thead class="rpt-running"><tr><td>
    <div class="rpt-head"><span class="rpt-head-brand">Unergy · Estado de Resultados</span><span class="rpt-head-meta">${proyecto} — ${periodo}</span></div>
  </td></tr></thead>
  <tbody><tr><td>
    <div class="rpt-content">${content}</div>
  </td></tr></tbody>
  <tfoot class="rpt-running"><tr><td>
    <div class="rpt-foot"><span>Unergy S.A.S. · Informe para uso del cliente</span><span>${proyecto} — ${periodo}</span></div>
  </td></tr></tfoot>
</table>`.trim()
}

// ── Datos en vivo: generación (API monitoreo) y comparativo (vista por-proyecto) ─
const _norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
function ultimoDiaMes(periodo) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mesPrevio(periodo, k) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 1 - k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
async function resolverSub() {
  const data = await monitoreoLegacyService.obtenerProyectos()
  const projects = data?.projects ?? []
  const pid = liq.value?.proyecto_id != null ? String(liq.value.proyecto_id) : null
  const nombre = _norm(liq.value?.proyecto_nombre)
  let m = pid && projects.find(p => String(p.id ?? p.proyecto_id) === pid && p.sub_project)
  if (!m && nombre) m = projects.find(p => _norm(p.nombre_comercial) === nombre && p.sub_project)
  if (!m && nombre) m = projects.find(p => p.sub_project && (_norm(p.nombre_comercial).includes(nombre) || nombre.includes(_norm(p.nombre_comercial))))
  return m?.sub_project ?? null
}
async function _genData(sub, periodo) {
  const data = await monitoreoLegacyService.obtenerGeneracion({ sub_project: sub, date_from: periodo, date_to: ultimoDiaMes(periodo) })
  if (data && data.ok === false) return null
  const map = new Map()
  for (const it of (Array.isArray(data?.data) ? data.data : [])) {
    if (!it || it.kwh == null || !it.date) continue
    map.set(it.date, (map.get(it.date) || 0) + Number(it.kwh))
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, kwh]) => ({ date, kwh }))
}
async function loadGeneracion() {
  dias.value = []; genActual.value = null; genProm.value = null
  if (!liq.value?.periodo) return
  try {
    const sub = await resolverSub()
    if (sub) {
      dias.value = await _genData(sub, liq.value.periodo) || []
      genActual.value = dias.value.length ? dias.value.reduce((s, d) => s + d.kwh, 0) : null
      const prevs = []
      for (let k = 1; k <= 3; k++) {
        const ds = await _genData(sub, mesPrevio(liq.value.periodo, k))
        const t = (ds || []).reduce((s, d) => s + d.kwh, 0)
        if (t > 0) prevs.push(t)
      }
      if (prevs.length) genProm.value = prevs.reduce((a, b) => a + b, 0) / prevs.length
    }
  } catch { /* generación opcional */ }
  await loadTarifas()
}
async function loadTarifas() {
  tarifas.value = { representacion: null, cgm: null, admin: null }
  if (!liq.value?.proyecto_id) return
  try {
    const data = await contratosServicioService.listar({ proyecto_id: liq.value.proyecto_id })
    const contratos = Array.isArray(data) ? data : []
    const anio = Number(liq.value.periodo.split('-')[0])
    const tar = (idx, base) => {
      const arr = Array.isArray(idx) ? idx.filter(r => r && r.valor != null) : []
      if (arr.length) {
        const ex = arr.find(r => Number(r.año ?? r.anio) === anio)
        if (ex) return Number(ex.valor)
        const pr = arr.filter(r => Number(r.año ?? r.anio) <= anio).sort((a, b) => Number(b.año ?? b.anio) - Number(a.año ?? a.anio))
        if (pr.length) return Number(pr[0].valor)
      }
      return base != null ? Number(base) : null
    }
    const tv = { representacion: null, cgm: null, admin: null }
    for (const c of contratos) {
      if (tv.representacion == null && (c.indexacion_representacion?.length || c.tarifa_representacion != null)) tv.representacion = tar(c.indexacion_representacion, c.tarifa_representacion)
      if (tv.cgm == null && (c.indexacion_cgm?.length || c.tarifa_cgm != null)) tv.cgm = tar(c.indexacion_cgm, c.tarifa_cgm)
      if (tv.admin == null && c.tarifa_admin != null) tv.admin = Number(c.tarifa_admin)
    }
    tarifas.value = tv
  } catch { /* tarifas opcionales */ }
}
async function loadComparativo() {
  // "Este mes vs promedio 3 meses" desde el Panel Contable (fuente única), no de la
  // vista operativa vieja. costos_cop ya viene con signo (comercializacion+costos+facturas).
  comp.value = null
  if (!liq.value?.proyecto_id || !liq.value?.periodo) return
  try {
    const per = liq.value.periodo.slice(0, 7)
    const [y, m] = per.split('-').map(Number)
    const d0 = new Date(y, m - 1 - 3, 1)
    const desde = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`
    const data = await liquidacionesService.obtenerResumenPanelRango({
      periodo_desde: desde, periodo_hasta: per, tipo: 'preliquidacion',
    })
    const byMes = {}
    for (const entry of (data.periodos || [])) {
      const proy = (entry.proyectos || []).find(p => p.proyecto_id === liq.value.proyecto_id)
      if (proy) byMes[entry.periodo] = { ingresos: proy.ingresos_cop, costosOp: proy.costos_cop, facturas: 0, neto: proy.valor_a_pagar_total }
    }
    const actual = byMes[per] || null
    const prevKeys = Object.keys(byMes).filter(k => k < per).sort().slice(-3)
    let promedio = null
    if (prevKeys.length) {
      const avg = (f) => prevKeys.reduce((s, k) => s + (byMes[k][f] || 0), 0) / prevKeys.length
      promedio = { ingresos: avg('ingresos'), costosOp: avg('costosOp'), facturas: avg('facturas'), neto: avg('neto') }
    }
    comp.value = { actual, promedio }
  } catch { /* comparativo opcional */ }
}

// ── Carga ─────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await liquidacionesService.obtener(route.params.id)
    liq.value = data
    if (data?.proyecto_id) {
      try {
        inversionistas.value = await proyectosService.listarInversionistas(data.proyecto_id)
      } catch { inversionistas.value = [] }
      // Estado de Resultados del informe = espejo del Panel Contable del período.
      try {
        const per = (data.periodo || '').slice(0, 7)
        if (per) {
          const rp = await liquidacionesService.obtenerResumenPanel({ periodo: per, tipo: 'preliquidacion' })
          panelER.value = (rp.proyectos || []).find(p => p.proyecto_id === data.proyecto_id) || null
        }
      } catch { panelER.value = null }
    }
    // Datos en vivo (generación + comparativo), opcionales y en paralelo
    await Promise.all([loadGeneracion(), loadComparativo()])
    // Informe guardado en BD
    let guardado = null
    try {
      const inf = await liquidacionesService.obtenerInforme(route.params.id)
      guardado = inf?.html_content || null
      actualizadoEn.value = inf?.actualizado_en ? new Date(inf.actualizado_en).toLocaleString('es-CO') : null
    } catch { /* sin informe previo */ }
    htmlContent.value = guardado || buildHtml()
  } catch (e) {
    toast('Error cargando la liquidación', true)
  } finally {
    loading.value = false
  }
}

function enterEdit() { editMode.value = true }
function discardEdit() {
  editMode.value = false
  // recargar último guardado / generado
  load()
}
function onSelChange() {
  if (editMode.value || !liq.value) return
  htmlContent.value = buildHtml()
}
function regenerar() {
  if (!liq.value) return
  htmlContent.value = buildHtml()
  toast('Informe regenerado desde los datos')
}

async function guardar() {
  if (!contentRef.value) return
  saving.value = true
  try {
    const newHtml = contentRef.value.innerHTML
    const data = await liquidacionesService.guardarInforme(route.params.id, newHtml)
    htmlContent.value = newHtml
    actualizadoEn.value = data?.actualizado_en ? new Date(data.actualizado_en).toLocaleString('es-CO') : null
    editMode.value = false
    toast('💾 Informe guardado en la base de datos')
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || 'No se pudo guardar'), true)
  } finally {
    saving.value = false
  }
}

// ── Descargar PDF (ventana aislada → print) ───────────────────────────────────
function descargar() {
  const inner = (editMode.value && contentRef.value) ? contentRef.value.innerHTML : htmlContent.value
  const titulo = `Estado de Resultados — ${liq.value?.proyecto_nombre || ''} ${periodoLabel.value}`
  const w = window.open('', '_blank')
  if (!w) { toast('Permite las ventanas emergentes para descargar el PDF', true); return }
  const barCSS = `.liq-bar{position:sticky;top:0;z-index:50;display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:8px 14px;background:#2C2039;font-family:'Sora',sans-serif}
.liq-bar .t{margin-right:auto;color:#cdbfe2;font-size:12px;font-weight:600}
.liq-bar button{font-family:'Sora',sans-serif;font-size:12px;font-weight:700;border:none;border-radius:7px;padding:7px 13px;cursor:pointer;background:#4a3560;color:#fff}
.liq-bar button.prim{background:#F6FF72;color:#2C2039}
@media print{.liq-bar{display:none!important}}`
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>` +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet">` +
    `<style>${REPORT_CSS}${PRINT_PAGE_CSS}${barCSS}</style></head><body>` +
    `<div class="liq-bar"><span class="t">${esc(titulo)}</span>` +
    `<button onclick="window.close()">✕ Cerrar</button>` +
    `<button class="prim" onclick="window.print()">Imprimir / Guardar PDF</button></div>` +
    `<div class="liq-doc">${inner}</div>` +
    `<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script></body></html>`)
  w.document.close()
}

// ── Descargar Excel (identidad de marca + fórmulas + multi-hoja) ───────────────
async function descargarExcel() {
  if (!liq.value) return
  try {
    const XLSX = await import('xlsx-js-style')
    const cs = cols.value
    const sel = selInv.value
    const list = sel != null ? cs.filter(c => c.id === 'inv' + sel) : cs
    if (!list.length) { toast('No hay datos para exportar', true); return }
    const wb = XLSX.utils.book_new()
    const usados = new Set()
    for (const c of list) {
      let base = (c.es_total ? 'Total' : (c.nombre || 'Inversionista')).replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 28).trim() || 'Hoja'
      let name = base, i = 2
      while (usados.has(name)) { name = `${base.slice(0, 25)} ${i++}` }
      usados.add(name)
      XLSX.utils.book_append_sheet(wb, sheetForEr(XLSX, c), name)
    }
    const slug = (liq.value.proyecto_nombre || 'liquidacion').replace(/[^a-z0-9]+/gi, '_')
    XLSX.writeFile(wb, `Estado_Resultados_${slug}_${(liq.value.periodo || '').slice(0, 7)}.xlsx`)
  } catch (e) {
    toast('⚠️ No se pudo generar el Excel', true)
  }
}

function sheetForEr(XLSX, col) {
  const er = erConFacturas(col)
  const proyecto = liq.value?.proyecto_nombre || ''
  const periodo = formatPeriodo(liq.value?.periodo)
  const entidad = col.es_total ? 'Total del proyecto' : `${col.nombre} (${col.pct})`

  // Paleta de marca Unergy
  const C = { morado: '915BD8', moradoOsc: '6E3FB8', oscuro: '2C2039', lila: 'F4F1FA', neto: 'EAE0FB', blanco: 'FFFFFF', gris: '6B5A8A', borde: 'ECE4F5' }
  const COP = '"$"#,##0'
  const bf = { style: 'thin', color: { rgb: C.borde } }
  const bAll = { top: bf, bottom: bf, left: bf, right: bf }
  const bTop = { ...bAll, top: { style: 'medium', color: { rgb: C.morado } } }

  const rows = [
    ['UNERGY — Estado de Resultados', '', ''],
    [proyecto, '', ''],
    [`${periodo}  ·  ${entidad}`, '', ''],
    ['', '', ''],
    ['Concepto', 'Valor (COP)', 'Soporte / Ref.'],
  ]
  const grupos = []
  er.grupos.forEach(g => {
    const hdr = rows.length
    rows.push([g.label, null, ''])
    const start = rows.length
    g.lineas.forEach(l => rows.push([`    ${l.label}`, Number(l.valor) || 0, l.refCodigo || l.referencia || '']))
    grupos.push({ hdr, sign: g.sign, start, end: rows.length - 1 })
  })
  const netoRow = rows.length
  rows.push(['Valor a pagar (neto)', null, ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const enc = (r, c) => XLSX.utils.encode_cell({ r, c })
  const setCell = (r, c, patch) => { const ref = enc(r, c); ws[ref] = { ...(ws[ref] || { t: 's', v: '' }), ...patch } }
  const setStyle = (r, c, s) => { const ref = enc(r, c); if (!ws[ref]) ws[ref] = { t: 's', v: '' }; ws[ref].s = s }

  // Fórmulas: subtotal por grupo = SUM(líneas); neto = Σ signo·subtotal
  grupos.forEach(g => {
    if (g.end >= g.start) setCell(g.hdr, 1, { t: 'n', f: `SUM(${enc(g.start, 1)}:${enc(g.end, 1)})` })
    else setCell(g.hdr, 1, { t: 'n', v: 0 })
  })
  const terms = grupos.map(g => `${g.sign < 0 ? '-' : '+'}${enc(g.hdr, 1)}`).join('').replace(/^\+/, '')
  setCell(netoRow, 1, { t: 'n', f: terms || '0' })

  // Estilos de marca
  setStyle(0, 0, { font: { bold: true, sz: 14, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.oscuro } }, alignment: { vertical: 'center' } })
  setStyle(1, 0, { font: { bold: true, sz: 12, color: { rgb: C.moradoOsc } } })
  setStyle(2, 0, { font: { sz: 10, color: { rgb: C.gris } } })
  for (let c = 0; c < 3; c++) setStyle(4, c, { font: { bold: true, sz: 10, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.morado } }, alignment: { horizontal: c === 1 ? 'right' : (c === 2 ? 'center' : 'left') }, border: bAll })
  grupos.forEach(g => {
    setStyle(g.hdr, 0, { font: { bold: true, sz: 10, color: { rgb: C.moradoOsc } }, fill: { fgColor: { rgb: C.lila } }, border: bAll })
    setStyle(g.hdr, 1, { font: { bold: true, color: { rgb: C.oscuro } }, fill: { fgColor: { rgb: C.lila } }, numFmt: COP, alignment: { horizontal: 'right' }, border: bAll })
    setStyle(g.hdr, 2, { fill: { fgColor: { rgb: C.lila } }, border: bAll })
    for (let r = g.start; r <= g.end; r++) {
      setStyle(r, 0, { font: { color: { rgb: C.oscuro } }, border: bAll })
      setStyle(r, 1, { numFmt: COP, alignment: { horizontal: 'right' }, font: { color: { rgb: C.oscuro } }, border: bAll })
      setStyle(r, 2, { font: { sz: 9, color: { rgb: C.moradoOsc } }, alignment: { horizontal: 'center' }, border: bAll })
    }
  })
  setStyle(netoRow, 0, { font: { bold: true, sz: 11, color: { rgb: C.oscuro } }, fill: { fgColor: { rgb: C.neto } }, border: bTop })
  setStyle(netoRow, 1, { font: { bold: true, sz: 11, color: { rgb: C.moradoOsc } }, fill: { fgColor: { rgb: C.neto } }, numFmt: COP, alignment: { horizontal: 'right' }, border: bTop })
  setStyle(netoRow, 2, { fill: { fgColor: { rgb: C.neto } }, border: bTop })

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ]
  ws['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 22 }]
  ws['!rows'] = [{ hpt: 24 }]
  return ws
}

// ── CSS del informe (inyectado para preview + usado en la ventana de impresión) ─
// El @page va solo a la ventana de impresión (PRINT_PAGE_CSS) para no afectar el resto de la app.
const REPORT_CSS = `
.liq-doc{background:#fff;color:#2C2039;font-family:'Sora',system-ui,sans-serif;font-size:12px;line-height:1.45;}
.rpt-page{width:100%;border-collapse:collapse;table-layout:fixed;}
.rpt-running > tr > td{padding:0;}
.rpt-head,.rpt-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:10px;color:#9b8fb0;}
.rpt-head{border-bottom:1px solid #ece4f5;padding-bottom:6px;margin-bottom:14px;}
.rpt-foot{border-top:1px solid #ece4f5;padding-top:6px;margin-top:14px;}
.rpt-head-brand{font-weight:700;color:#6E3FB8;}
.rpt-block{margin-bottom:16px;}
.rpt-cover{margin-bottom:18px;}
.rpt-title{font-size:21px;font-weight:800;letter-spacing:-.5px;color:#2C2039;}
.rpt-subtitle{font-size:14px;font-weight:600;color:#6E3FB8;margin:2px 0 12px;}
.rpt-meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.rpt-meta{background:#faf7ff;border:1px solid #ece4f5;border-radius:8px;padding:8px 10px;}
.rpt-meta-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#9b8fb0;margin-bottom:2px;}
.rpt-meta-val{font-size:13px;font-weight:700;color:#2C2039;}
.rpt-h2{font-size:13px;font-weight:800;color:#2C2039;margin:0 0 10px;padding-left:9px;border-left:3px solid #915BD8;}
.rpt-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
.rpt-kpi{background:#faf7ff;border:1px solid #ece4f5;border-radius:8px;padding:8px 10px;}
.rpt-kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9b8fb0;margin-bottom:3px;}
.rpt-kpi-val{font-size:15px;font-weight:800;color:#2C2039;font-variant-numeric:tabular-nums;}
.rpt-kpi-big{background:rgba(145,91,216,0.08);border-color:rgba(145,91,216,.25);}
.rpt-kpi-big .rpt-kpi-val{color:#6E3FB8;}
.rpt-kpis-4{grid-template-columns:repeat(4,1fr);}
.rpt-delta{font-size:9px;font-weight:700;margin-top:2px;}
.rpt-delta.up{color:#2D8A4E;}
.rpt-delta.down{color:#D64455;}
.rpt-cover-inv{font-size:12px;color:#2C2039;margin:-6px 0 12px;}
.rpt-cover-inv b{color:#6E3FB8;}
.rpt-gen-kpis{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px;font-size:11px;color:#6b5a8a;}
.rpt-gen-kpis b{color:#2C2039;font-size:13px;margin-left:4px;}
.rpt-chart{background:#fcfaff;border:1px solid #ece4f5;border-radius:8px;padding:10px;margin-bottom:8px;}
.rpt-chart svg{display:block;width:100%;height:auto;}
.rpt-empty{color:#9b8fb0;font-size:11px;padding:8px;}
.rpt-tarifas{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.rpt-tar{background:#faf7ff;border:1px solid #ece4f5;border-radius:8px;padding:6px 10px;text-align:center;font-size:10px;color:#6E3FB8;font-weight:700;text-transform:uppercase;letter-spacing:.4px;}
.rpt-tar b{display:block;color:#2C2039;font-size:13px;margin-top:2px;font-variant-numeric:tabular-nums;}
.rpt-inv{margin-bottom:14px;}
.rpt-inv-head{display:flex;justify-content:space-between;align-items:center;background:#faf7ff;border:1px solid #ece4f5;border-bottom:none;border-radius:8px 8px 0 0;padding:7px 10px;}
.rpt-inv-name{font-weight:800;font-size:12px;color:#2C2039;}
.rpt-inv-pct{font-size:11px;font-weight:700;color:#6E3FB8;font-variant-numeric:tabular-nums;}
.rpt-detail{width:100%;border-collapse:collapse;font-size:11px;}
.rpt-detail th{background:#faf7ff;color:#6E3FB8;font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding:5px 9px;border-bottom:1px solid #ece4f5;}
.rpt-detail td{padding:4px 9px;border-top:1px solid #f4eefc;vertical-align:top;}
.rpt-c-con{text-align:left;color:#3d3550;word-break:break-word;}
.rpt-c-val{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;width:30%;}
.rpt-c-sop{text-align:right;white-space:nowrap;width:22%;}
.rpt-indent{padding-left:20px !important;color:#5b5470;}
.rpt-grp td{background:#fcfaff;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:#6E3FB8;}
.rpt-grp .rpt-c-val{color:#2C2039;}
.rpt-neto td{border-top:2px solid #915BD8;background:rgba(145,91,216,0.08);font-weight:800;}
.rpt-neto .rpt-c-con{color:#2C2039;}
.rpt-neto .rpt-c-val{color:#6E3FB8;}
.rpt-subtot td{border-top:1px dashed #d8cdec;font-style:italic;font-size:10px;}
.rpt-subtot .rpt-c-con{color:#6b6380;}
.rpt-subtot .rpt-c-val{color:#6b6380;font-weight:700;}
.rpt-sop{font-size:9px;color:#6E3FB8;text-decoration:none;}
.rpt-sop-muted{font-size:9px;color:#bba8d4;}
.rpt-obs{background:#faf7ff;border-left:3px solid #4ADE80;border-radius:8px;padding:10px 12px;color:#3d3550;font-size:11px;}
@media print{
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  .liq-doc{font-size:11px;}
  thead.rpt-running{display:table-header-group;}
  tfoot.rpt-running{display:table-footer-group;}
  /* No cortar: filas, KPIs, portada, gráfica, tarifas ni bloques de inversionista */
  .rpt-detail tr{break-inside:avoid;page-break-inside:avoid;}
  .rpt-kpis,.rpt-cover,.rpt-inv,.rpt-chart,.rpt-tarifas,.rpt-gen-kpis{break-inside:avoid;page-break-inside:avoid;}
  /* Mantener cada encabezado pegado a su contenido */
  .rpt-h2,.rpt-inv-head{break-after:avoid;page-break-after:avoid;}
  /* Tablas largas paginan repitiendo su encabezado */
  .rpt-detail thead{display:table-header-group;}
}
`
const PRINT_PAGE_CSS = `@page{size:A4;margin:13mm;}
html,body{margin:0;padding:0;background:#fff;}
body .liq-doc{padding:0;}`

let _styleEl = null
onMounted(async () => {
  _styleEl = document.createElement('style')
  _styleEl.setAttribute('data-liqpdf', '')
  _styleEl.textContent = REPORT_CSS
  document.head.appendChild(_styleEl)
  await load()
})
onBeforeUnmount(() => { if (_styleEl) _styleEl.remove() })
</script>

<style scoped>
.liqpdf-wrapper{ padding:14px; background:var(--color-unergy-avena); min-height:100vh; }
.liqpdf-toolbar{
  position:sticky; top:0; z-index:20; background:#fff;
  border:1px solid #e8e0f0; border-radius:12px; padding:10px 14px;
  display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  box-shadow:0 2px 10px rgba(44,32,57,.04); margin-bottom:12px;
}
.liqpdf-sel{ max-width:260px; }
.liqpdf-hint{
  background:rgba(145,91,216,0.06); border:1px solid rgba(145,91,216,0.2);
  border-radius:8px; padding:8px 12px; font-size:11px; color:#6b5a8a; margin-bottom:12px; line-height:1.5;
}
/* Lienzo tipo hoja */
.liqpdf-canvas{ display:flex; justify-content:center; }
.liqpdf-canvas .liq-doc{
  width:210mm; max-width:100%; background:#fff;
  border:1px solid #e8e0f0; border-radius:10px;
  box-shadow:0 6px 30px rgba(44,32,57,.10);
  padding:18mm 14mm; min-height:60vh;
}
.liq-doc[contenteditable="true"]{ outline:2px dashed rgba(145,91,216,.35); outline-offset:4px; }
.liq-doc :focus{ outline:none; }
/* Toast */
.liqpdf-toast{ position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:9999;
  padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; color:#fff; box-shadow:0 6px 24px rgba(0,0,0,.25); }
.liqpdf-toast.is-ok{ background:#2D8A4E; }
.liqpdf-toast.is-err{ background:#b3324a; }
.fade-enter-active,.fade-leave-active{ transition:opacity .3s; }
.fade-enter-from,.fade-leave-to{ opacity:0; }

@media print{
  .liqpdf-toolbar,.liqpdf-hint,.liqpdf-toast{ display:none !important; }
  .liqpdf-wrapper{ padding:0 !important; background:#fff !important; }
  .liqpdf-canvas .liq-doc{ border:none !important; border-radius:0 !important; box-shadow:none !important; padding:0 !important; width:auto !important; }
}
</style>
