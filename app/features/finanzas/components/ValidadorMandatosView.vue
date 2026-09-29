<template>
  <div>
    <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
    <div class="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5">
      <FileCheckIcon class="size-4 text-unergy-purple" />
      <span class="text-base font-bold text-foreground whitespace-nowrap mr-2">Validador de Mandatos</span>
      <span class="font-mono text-xs text-muted-foreground">v8.0</span>
    </div>

    <!-- El validador (HTML/JS portado tal cual) se inyecta aquí en onMounted -->
    <div ref="root" class="vm-root"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as XLSX from 'xlsx'
import { FileCheckIcon } from '@lucide/vue'
import {
  parseAsientos, extractMandate, suggestTag, reconciliar, fmt, norm as normNombre,
  parseIngresos, matchIngresoContab, normalizarCifra,
  parseIngresosPorConcepto, matchIngresoConceptos,
  INGRESO_ACC_PREFIX, AUTOCONSUMO_ACC_PREFIXES, OPCIONES_AUTOCONSUMO,
} from '~/features/finanzas/utils/conciliacionMandatos'

const root = ref(null)

// IDs de las funciones globales que el markup invoca vía onclick — se limpian al desmontar
const GLOBAL_FNS = [
  'switchTab', 'setMode', 'updateAuditUI', 'loadExcel', 'setConcMode',
  'updateConcUI', 'startConciliation', 'renderConcTable', 'exportConcCSV',
  'startAudit', 'setCostoTag', 'focusSinPdfOrEtiqueta',
]

// Carga un <script> externo una sola vez (pdf.js / xlsx desde CDN, igual que el HTML original)
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve() })
    s.addEventListener('error', reject)
    document.head.appendChild(s)
  })
}

// ── Clases Tailwind del HTML inyectado ──
// Siempre completas y literales en este archivo: Tailwind las detecta al escanear el fuente.
// Las pestañas y las zonas de carga cambian de estado con data-active / data-loaded.

/** Display real que se alterna junto con `hidden` (ver `mostrar`). */
/** @typedef {'block' | 'flex' | 'table-row'} Display */

/** Clases de cada estado del cálculo por concepto / conciliación. */
const TEXTO_CONCEPTO = {
  OK: 'text-success',
  DIFERENCIA: 'text-destructive',
  FALTA_CONTAB: 'text-warning',
  SOBRA_CONTAB: 'text-warning',
}
const TEXTO_NIVEL = { ok: 'text-success', warn: 'text-warning', bad: 'text-destructive' }
const TEXTO_ESTADO = {
  OK: 'text-success',
  DIFERENCIA: 'text-destructive',
  SIN_CONTAB: 'text-warning',
  ERROR_PDF: 'text-warning',
}

const CLS = {
  tabBar: 'mb-4.5 flex gap-2.5 rounded-lg bg-border p-1',
  tab: 'flex-1 cursor-pointer rounded-lg border-0 bg-transparent p-3 text-sm font-semibold text-muted-foreground transition data-active:bg-card data-active:text-unergy-purple data-active:shadow-sm',
  modeBar: 'mb-4 flex gap-2.5 rounded-lg bg-border p-1',
  modeBtn: 'flex-1 cursor-pointer rounded-lg border-0 bg-transparent p-2.5 text-sm font-semibold text-muted-foreground transition data-active:bg-card data-active:text-unergy-purple data-active:shadow-sm',
  dropZone: 'group mb-3.5 cursor-pointer rounded-xl border-2 border-dashed border-border bg-card text-center transition hover:border-unergy-purple hover:bg-muted data-loaded:border-solid data-loaded:border-success data-loaded:bg-success/10',
  dzIcon: 'group-data-loaded:text-success',
  btnPrimary: 'cursor-pointer rounded-lg border-0 bg-unergy-purple px-5 py-3.5 text-base font-semibold text-card transition enabled:hover:bg-unergy-purple-dark disabled:cursor-not-allowed disabled:opacity-40',
  btnSecondary: 'cursor-pointer whitespace-nowrap rounded-lg border-0 bg-chart-2 px-5 py-3.5 text-sm font-semibold text-card disabled:cursor-not-allowed disabled:opacity-40',
  stats: 'mb-4.5 flex-wrap gap-3',
  stat: 'min-w-25 flex-1 rounded-lg border border-border bg-card p-3.5 text-center',
  statVal: 'block text-xl font-bold',
  panel: 'mb-4.5 rounded-xl border border-border bg-card p-5 shadow-sm',
  h3: 'text-base font-semibold text-unergy-deep',
  table: 'w-full border-collapse text-sm',
  th: 'border-b-2 border-border bg-muted px-3 py-2.5 text-left text-xs font-semibold',
  thR: 'border-b-2 border-border bg-muted px-3 py-2.5 text-right text-xs font-semibold',
  td: 'border-b border-muted px-3 py-2.5 group-last:border-b-0',
  tol: 'w-22 rounded-lg border border-border px-2.5 py-1.5 text-sm',
  toggle: 'flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm',
  step: 'mr-2 inline-block size-5.5 shrink-0 rounded-full bg-unergy-purple text-center text-xs font-bold leading-5.5 text-card',
  badgeOk: 'rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success',
  badgeErr: 'rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive',
  badgeWarn: 'rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-bold text-warning',
}

// ── Markup del validador (sin <html>/<head>/<body>) ──
const MARKUP = `
  <!-- TABS PRINCIPALES -->
  <div class="${CLS.tabBar}">
    <button class="${CLS.tab}" data-active id="tabAudit" onclick="switchTab('audit')">🔍 Auditoría PDFs</button>
    <button class="${CLS.tab}" id="tabConc"  onclick="switchTab('conc')">⚖️ Conciliación Contable</button>
  </div>

  <!-- ==================== SECCIÓN AUDITORÍA ==================== -->
  <div id="sectionAudit">
    <div class="${CLS.modeBar}">
      <button class="${CLS.modeBtn}" data-active id="btnModeIngresos"    onclick="setMode('ingresos')">INGRESOS (Exige **)</button>
      <button class="${CLS.modeBtn}"        id="btnModeCostos"       onclick="setMode('costos')">COSTOS (Sin **)</button>
      <button class="${CLS.modeBtn}"        id="btnModeAutoconsumo"  onclick="setMode('autoconsumo')">AUTOCONSUMO (Exige **)</button>
    </div>

    <div class="${CLS.dropZone} p-8" id="dzAudit" onclick="document.getElementById('fileInput').click()">
      <input type="file" id="fileInput" accept=".pdf" multiple class="hidden" onchange="updateAuditUI()">
      <div class="${CLS.dzIcon} mb-1.5 text-3xl">📄</div>
      <div id="dropText">Cargar PDFs para Auditoría Masiva</div>
    </div>

    <button class="${CLS.btnPrimary} mb-4 w-full" id="btnRun" disabled onclick="startAudit()">Iniciar Validación</button>

    <div class="${CLS.stats} hidden" id="statsBar">
      <div class="${CLS.stat}"><span class="${CLS.statVal}" id="sTotal">0</span><small>PROCESADOS</small></div>
      <div class="${CLS.stat} text-success"><span class="${CLS.statVal}" id="sOk">0</span><small>PASAN</small></div>
      <div class="${CLS.stat} text-destructive"><span class="${CLS.statVal}" id="sErr">0</span><small>RECHAZADOS</small></div>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3" id="results"></div>

    <div id="reportContainer" class="${CLS.panel} hidden">
      <h3 class="${CLS.h3} mt-0">Hallazgos y Rechazos</h3>
      <table class="${CLS.table}">
        <thead><tr><th class="${CLS.th}">Archivo / CMU</th><th class="${CLS.th}">Doc ($)</th><th class="${CLS.th}">Cálculo ($)</th><th class="${CLS.th}">Motivo</th></tr></thead>
        <tbody id="reportContent"></tbody>
      </table>
    </div>
  </div>

  <!-- ==================== SECCIÓN CONCILIACIÓN ==================== -->
  <div id="sectionConc" class="hidden">

    <div class="${CLS.panel}">
      <h3 class="${CLS.h3} mb-1">Conciliación: Contabilidad vs. Mandatos PDF</h3>
      <p class="mb-4.5 text-sm text-muted-foreground">
        Carga el soporte contable (exportación Odoo en <b>.xlsx</b>) y luego los PDFs del lote.
        El sistema cruza el <b>Valor a Pagar</b> de cada mandato contra la sumatoria contable por inversionista + planta.
      </p>

      <!-- Sub-tipo -->
      <div class="${CLS.modeBar} mb-4.5">
        <button class="${CLS.modeBtn}" data-active id="cTabIngresos"    onclick="setConcMode('ingresos')">INGRESOS (**)</button>
        <button class="${CLS.modeBtn}"        id="cTabCostos"       onclick="setConcMode('costos')">COSTOS</button>
        <button class="${CLS.modeBtn}"        id="cTabAutoconsumo"  onclick="setConcMode('autoconsumo')">AUTOCONSUMO (**)</button>
      </div>

      <!-- PASO 1: Excel -->
      <div class="mb-3.5 flex items-start">
        <span class="${CLS.step}">1</span>
        <div class="flex-1">
          <div class="mb-1.5 text-sm font-semibold">Soporte contable (exportación Odoo .xlsx)</div>
          <div class="${CLS.dropZone} p-5" id="dzExcel" onclick="document.getElementById('xlsxInput').click()">
            <input type="file" id="xlsxInput" accept=".xlsx,.xls" class="hidden" onchange="loadExcel(this)">
            <div class="${CLS.dzIcon} mb-1 text-2xl">📊</div>
            <div id="xlsxLabel" class="text-sm text-muted-foreground">Clic para cargar el <b>.xlsx</b> exportado de Odoo</div>
          </div>
          <div id="xlsxStatus" class="-mt-2 mb-1 text-xs text-muted-foreground"></div>
        </div>
      </div>

      <!-- PASO 2: PDFs -->
      <div class="mb-3.5 flex items-start">
        <span class="${CLS.step}">2</span>
        <div class="flex-1">
          <div class="mb-1.5 text-sm font-semibold">Mandatos PDFs del mismo lote</div>
          <div class="${CLS.dropZone} p-5" id="dzPdfs" onclick="document.getElementById('concFileInput').click()">
            <input type="file" id="concFileInput" accept=".pdf" multiple class="hidden" onchange="updateConcUI()">
            <div class="${CLS.dzIcon} mb-1 text-2xl">📁</div>
            <div id="concDropText" class="text-sm text-muted-foreground">Clic para cargar los PDFs del lote</div>
          </div>
        </div>
      </div>

      <!-- PASO 3: Ejecutar -->
      <div class="mt-1 flex gap-2.5">
        <button class="${CLS.btnPrimary} flex-1" id="btnConc" disabled onclick="startConciliation()">
          ⚖️ Ejecutar Conciliación
        </button>
        <button class="${CLS.btnSecondary}" id="btnExportCSV" disabled onclick="exportConcCSV()">
          ⬇ Exportar CSV
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="${CLS.stats} hidden" id="concStatsBar">
      <div class="${CLS.stat}"><span class="${CLS.statVal}" id="csTotal">0</span><small>PDFs</small></div>
      <div class="${CLS.stat} text-success"><span class="${CLS.statVal}" id="csMatch">0</span><small>COINCIDEN</small></div>
      <div class="${CLS.stat} text-destructive"><span class="${CLS.statVal}" id="csDiff">0</span><small>DIFERENCIAS</small></div>
      <div class="${CLS.stat} text-warning"><span class="${CLS.statVal}" id="csNoCont">0</span><small>SIN CONTAB.</small></div>
      <div class="${CLS.stat} cursor-pointer text-primary" title="Clic para ubicar el registro" onclick="focusSinPdfOrEtiqueta()"><span class="${CLS.statVal}" id="csNoPdf">0</span><small id="csNoPdfLabel">SIN PDF</small></div>
    </div>

    <!-- Tabla resultados -->
    <div id="concTableContainer" class="${CLS.panel} hidden">
      <div class="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <h3 class="${CLS.h3} m-0">Resultado de Conciliación</h3>
        <div class="mb-3.5 flex flex-wrap items-center gap-2.5">
          <label class="${CLS.toggle}">
            <input type="checkbox" id="filterDiffOnly" onchange="renderConcTable()"> Solo diferencias/alertas
          </label>
          <div class="flex items-center gap-1.5 text-sm">
            <span class="text-muted-foreground">Tolerancia:</span>
            <input type="number" class="${CLS.tol}" id="toleranceInput" value="200" min="0" step="100" onchange="renderConcTable()">
            <span class="text-muted-foreground">$</span>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="${CLS.table}">
          <thead>
            <tr>
              <th class="${CLS.th}">CMU</th>
              <th class="${CLS.th}">Inversionista</th>
              <th class="${CLS.th}">Planta</th>
              <th class="${CLS.thR}">Valor PDF</th>
              <th class="${CLS.thR}">Valor Contab.</th>
              <th class="${CLS.thR}">Diferencia</th>
              <th class="${CLS.th}">Estado</th>
              <th class="${CLS.th}">Detalle</th>
            </tr>
          </thead>
          <tbody id="concTableBody"></tbody>
        </table>
      </div>
      <!-- Registros contables sin PDF -->
      <div id="sinPdfSection" class="mt-5 hidden">
        <h4 class="mb-2.5 text-base font-semibold text-warning">⚠️ Registros contables sin PDF correspondiente</h4>
        <table class="${CLS.table}">
          <thead><tr><th class="${CLS.th}">Inversionista (Contabilidad)</th><th class="${CLS.th}">Planta</th><th class="${CLS.thR}">Valor Contab.</th></tr></thead>
          <tbody id="sinPdfBody"></tbody>
        </table>
      </div>
    </div>

    <!-- Resultado DETALLADO por concepto (modo COSTOS) -->
    <div id="concCostosContainer" class="${CLS.panel} hidden">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <h3 class="${CLS.h3} m-0">Conciliación detallada por concepto · Costos</h3>
        <label class="${CLS.toggle}">
          <input type="checkbox" id="costosOnlyProblem" onchange="renderConcTable()"> Solo con hallazgos
        </label>
      </div>
      <p class="mb-3.5 text-xs text-muted-foreground">
        Empareja por <b>palabra completa</b> del mandante + etiqueta analítica, y valida concepto por concepto
        (mantenimiento, IVA, internet, arriendo), conceptos faltantes/sobrantes y montos en cuenta equivocada.
      </p>
      <div id="concCostosBody"></div>
    </div>

  </div><!-- /sectionConc -->
`

// ── Lógica del validador (idéntica al HTML original) ──
// Recibe `el` = contenedor raíz para acotar las búsquedas por id al componente.
function initValidador(el) {
  const pdfjsLib = window.pdfjsLib
  // XLSX viene del paquete npm (import arriba), ya no del CDN
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

  // getElementById acotado al contenedor del componente (evita colisiones globales)
  const $ = (id) => el.querySelector('#' + id)

  /** Muestra u oculta un elemento alternando `hidden` con su display real.
   *  @param {HTMLElement} nodo
   *  @param {boolean} visible
   *  @param {Display} display */
  function mostrar(nodo, visible, display) {
    nodo.classList.toggle('hidden', !visible)
    nodo.classList.toggle(display, visible)
  }

  // ====== ESTADO GLOBAL ======
  let currentMode     = 'ingresos'
  let currentConcMode = 'ingresos'
  let contabilidadData = []   // [{asociado, planta, valor_contabilidad}]  cargado desde xlsx (modo total)
  let contabPorConcepto = []  // [{asociado, planta, conceptos:{clave:neto}}]  desglose por concepto (ingresos)
  // El xlsx crudo se conserva para poder reparsearlo al cambiar de sub-pestaña:
  // cada modo lee cuentas distintas del MISMO archivo.
  let matrizCruda = null
  let nombreXlsx  = ''
  let periodoXlsx = ''
  let concResults      = []   // resultados del cruce (modos ingresos/autoconsumo)

  // --- Modo COSTOS: conciliación detallada por concepto ---
  let asientosDetalle = []    // detalle línea-a-línea del xlsx (parseAsientos)
  let tagsAnaliticos  = []    // etiquetas analíticas (proyectos) del xlsx
  let costosResults   = []    // [{mandato, tag, status, flags, sums, candidates, fileName}]
  const TAGMAP_KEY = 'conc_costos_tagmap'
  const loadTagMap = () => { try { return JSON.parse(localStorage.getItem(TAGMAP_KEY) || '{}') } catch { return {} } }
  const saveTagMap = (m) => { try { localStorage.setItem(TAGMAP_KEY, JSON.stringify(m)) } catch { /* noop */ } }
  let savedTagMap = loadTagMap()

  // ====== TABS ======
  function switchTab(tab) {
    mostrar($('sectionAudit'), tab === 'audit', 'block')
    mostrar($('sectionConc'), tab === 'conc', 'block')
    $('tabAudit').toggleAttribute('data-active', tab === 'audit')
    $('tabConc').toggleAttribute('data-active', tab === 'conc')
  }

  // ====== AUDITORÍA: modo ======
  function setMode(m) {
    currentMode = m
    ;['Ingresos','Costos','Autoconsumo'].forEach(x =>
      $('btnMode'+x).toggleAttribute('data-active', m === x.toLowerCase()))
  }

  function updateAuditUI() {
    const n = $('fileInput').files.length
    $('btnRun').disabled = n === 0
    $('dropText').innerHTML = `<b>${n} PDF${n!==1?'s':''} cargados</b>`
    $('dzAudit').toggleAttribute('data-loaded', n > 0)
  }

  // ====== CARGA XLSX (SheetJS — todo en cliente) ======

  /** Las cuentas del soporte según el modo. Autoconsumo NO comparte ninguna con
   *  ingresos: leerlo con las de ingresos daba 0 grupos y dejaba el botón
   *  «Ejecutar Conciliación» deshabilitado para siempre. */
  function cuentasDelModo() {
    return currentConcMode === 'autoconsumo' ? AUTOCONSUMO_ACC_PREFIXES : INGRESO_ACC_PREFIX
  }

  /** Autoconsumo se agrupa distinto: su contrapartida vive en la misma cuenta,
   *  así que no se fusiona y se toma el lado por pagar. Ver OPCIONES_AUTOCONSUMO. */
  function opcionesDelModo() {
    return currentConcMode === 'autoconsumo' ? OPCIONES_AUTOCONSUMO : {}
  }

  function etiquetaCuentas() {
    const c = cuentasDelModo()
    return Array.isArray(c) ? `Cuentas ${c.join(' + ')}` : `Cuenta ${c}`
  }

  /** Reparsea el xlsx ya cargado. Se llama al cargarlo y al cambiar de
   *  sub-pestaña: si no, el archivo queda leído con las cuentas del modo
   *  anterior y el botón no se habilita aunque el archivo sí sirva. */
  function procesarMatriz() {
    if (!matrizCruda) return
    const cuentas = cuentasDelModo()
    const opciones = opcionesDelModo()
    contabilidadData = parseIngresos(matrizCruda, cuentas, opciones)
    try { contabPorConcepto = parseIngresosPorConcepto(matrizCruda, cuentas, opciones) } catch { contabPorConcepto = [] }
    try {
      const pa = parseAsientos(matrizCruda)
      asientosDetalle = pa.details
      tagsAnaliticos  = pa.tags
    } catch { asientosDetalle = []; tagsAnaliticos = [] }

    const esCostos = currentConcMode === 'costos'
    const cuenta = esCostos ? asientosDetalle.length : contabilidadData.length
    $('xlsxLabel').innerHTML = `<b class="text-success">✅ ${nombreXlsx}</b> — <span class="text-muted-foreground">${cuenta} ${esCostos ? 'líneas de detalle' : 'grupos inversionista+planta'} cargados</span>`
    $('dzExcel').toggleAttribute('data-loaded', true)
    $('xlsxStatus').textContent = esCostos
      ? `Periodo: ${periodoXlsx} · ${asientosDetalle.length} líneas · ${tagsAnaliticos.length} proyectos (etiquetas analíticas)`
      : `Periodo: ${periodoXlsx} · ${etiquetaCuentas()} (neto inversionista) · ${contabilidadData.length} grupos (inversionista + planta)`
    updateConcBtn()
  }

  function loadExcel(input) {
    const file = input.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {type:'array'})
        const ws = wb.Sheets[wb.SheetNames[0]]
        // Matriz (con cabecera) para los motores de conciliacionMandatos:
        //  - INGRESOS/AUTOCONSUMO: parseIngresos agrupa (asociado, planta) sumando
        //    el neto de sus cuentas (mismo enfoque robusto de detección de columnas).
        //  - COSTOS: parseAsientos arma el detalle línea-a-línea (motor existente).
        matrizCruda = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        nombreXlsx  = file.name
        periodoXlsx = detectPeriodo(XLSX.utils.sheet_to_json(ws, {defval:''}))
        procesarMatriz()
      } catch(err) {
        $('xlsxLabel').innerHTML = `<span class="text-destructive">❌ Error leyendo el archivo: ${err.message}</span>`
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function detectPeriodo(rows) {
    for (const r of rows) {
      const v = r['Asiento contable'] || r['asiento contable'] || ''
      if (v) return v
    }
    return 'desconocido'
  }

  // Normaliza para comparaciones de planta en la tabla de detalle.
  function norm(s) {
    return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
            .replace(/[.\-,]/g,' ').replace(/\s+/g,' ').trim()
  }

  // ====== CONCILIACIÓN: controles ======
  function setConcMode(m) {
    currentConcMode = m
    ;['Ingresos','Costos','Autoconsumo'].forEach(x =>
      $('cTab'+x).toggleAttribute('data-active', m === x.toLowerCase()))
    // Ocultar resultados previos de otro modo para no mezclar vistas
    mostrar($('concTableContainer'), false, 'block')
    mostrar($('concCostosContainer'), false, 'block')
    mostrar($('concStatsBar'), false, 'flex')
    // En COSTOS esta métrica cuenta mandatos SIN ETIQUETA ANALÍTICA asignada
    // (no un registro contable sin PDF, que es lo que mide en INGRESOS).
    $('csNoPdfLabel').textContent = m === 'costos' ? 'SIN ETIQUETA' : 'SIN PDF'
    // Reparsear: cada modo lee cuentas distintas del mismo archivo. Sin esto,
    // cargar el xlsx en un modo y cambiarse a otro dejaba los datos del modo
    // anterior (y el botón deshabilitado con un archivo perfectamente válido).
    procesarMatriz()
    updateConcBtn()
  }

  function updateConcUI() {
    const n = $('concFileInput').files.length
    $('concDropText').innerHTML = n
      ? `<b class="text-success">✅ ${n} PDF${n!==1?'s':''} cargados</b>`
      : 'Clic para cargar los PDFs del lote'
    $('dzPdfs').toggleAttribute('data-loaded', n > 0)
    updateConcBtn()
  }

  function updateConcBtn() {
    const hasPdfs  = $('concFileInput').files.length > 0
    const hasXlsx  = currentConcMode === 'costos'
      ? asientosDetalle.length > 0
      : contabilidadData.length > 0
    $('btnConc').disabled = !(hasPdfs && hasXlsx)
  }

  // ====== EXTRACCIÓN PDF para conciliación ======
  async function extractConcData(file, mode) {
    try {
      const data = await file.arrayBuffer()
      const pdf  = await pdfjsLib.getDocument({data}).promise
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i)
        const content = await page.getTextContent()
        fullText += content.items.map(it => it.str).join('  ') + ' \n '
      }
      const text = fullText.toUpperCase()

      // CMU
      const cmuM = text.match(/CMU(\d+)/i)
      const cmu  = cmuM ? 'CMU' + cmuM[1]
                 : (file.name.match(/CMU\d+/i) || [''])[0].toUpperCase()

      // Inversionista: bloque "Señores" hasta NIT o ciudad
      let inversionista = ''
      const senM = fullText.match(/Se[ñn]ores\s*\r?\n?\s*([\w\s\.\-,]+?)(?=\s*NIT|\s*Medell|\s*Bogot|\s*Cali|\s*Buca|\s*Barran|\s*Monter|\s*\n\n)/is)
      if (senM) inversionista = senM[1].replace(/\s+/g,' ').trim()
      // Fallback: "mandante, relacionado con" → nombre antes de ", con NIT"
      if (!inversionista) {
        const mM = fullText.match(/mandante,?\s+relacionado.*?suscrito.*?y\s+([^,]+),\s+con\s+NIT/is)
        if (mM) inversionista = mM[1].replace(/\s+/g,' ').trim()
      }

      // Planta: "proyecto [nombre]" — & para Sol&Cielo, guión para PSF
      let planta = ''
      const pM = fullText.match(/proyecto\s+([\w\s\-#&À-ž]+?)[\.,\r\n]/i)
      if (pM) planta = pM[1].replace(/\s+/g,' ').trim()
      // Fallback: extraer desde el asunto del mandato
      if (!planta) {
        const asM = fullText.match(/Proyecto\s+([\w\s\-#&À-ž]+?)\s*\./i)
        if (asM) planta = asM[1].replace(/\s+/g,' ').trim()
      }

      // Valor a Pagar
      let valorPagar = 0
      if (mode === 'autoconsumo') {
        const nums = [...text.matchAll(/\b([\d]{1,3}(?:,[\d]{3})+|[\d]{5,})\b/g)]
          .map(m => ({ val: normalizarCifra(m[1]), idx: m.index }))
          .filter(m => m.val >= 1000)
        const ti = text.indexOf('VALOR A PAGAR')
        if (ti > -1) {
          const cl = nums.find(v => v.idx > ti && v.idx - ti < 600)
          if (cl) valorPagar = cl.val
        }
      } else {
        const nums = [...text.matchAll(/\$\s*([\d\.,]+)/g)]
          .map(m => ({ val: normalizarCifra(m[1]), idx: m.index }))
        const ti = text.indexOf('VALOR A PAGAR')
        if (ti > -1) {
          const cl = nums.find(v => v.idx > ti && v.idx - ti < 500)
          if (cl) valorPagar = cl.val
        }
      }

      // Mandante + proyecto + CONCEPTOS leídos del CUERPO del PDF (extractMandate,
      // motor de costos) — más robustos que inversionista/planta para EMPAREJAR.
      // OJO: se usa el texto RECONSTRUIDO POR LÍNEAS (extractPdfLines), no fullText
      // (items unidos con espacios): extractMandate parsea los conceptos con
      // split('\n') (una línea = un concepto), así que sin saltos de línea reales
      // vals sale vacío y no se puede conciliar por concepto.
      const mand = extractMandate(await extractPdfLines(file), file.name)

      return {
        cmu, fileName: file.name, valorPagar,
        inversionista, planta,                       // para mostrar en la tabla
        mandante: mand.mandante || inversionista,    // para el match (palabra completa)
        projName: mand.projName || planta,           // para el match (tokens de planta)
        conceptosPdf: mand.vals || {},               // desglose por concepto (para conciliación detallada)
      }
    } catch(e) {
      return { cmu:'', inversionista:'', planta:'', mandante:'', projName:'', valorPagar:0, fileName:file.name, error:true }
    }
  }

  // ====== CONCILIACIÓN DETALLADA (modo COSTOS) ======

  // Extrae texto preservando líneas (agrupa items del PDF por coordenada Y),
  // necesario para leer "ETIQUETA ... $ valor" línea por línea.
  async function extractPdfLines(file) {
    const data = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data }).promise
    let out = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const byLine = new Map()
      content.items.forEach(it => {
        const y = Math.round(it.transform[5])
        if (!byLine.has(y)) byLine.set(y, [])
        byLine.get(y).push({ x: it.transform[4], s: it.str })
      })
      ;[...byLine.keys()].sort((a, b) => b - a).forEach(y => {
        out += byLine.get(y).sort((a, b) => a.x - b.x).map(o => o.s).join(' ') + '\n'
      })
    }
    return out
  }

  function recalcCostosStats() {
    $('csTotal').textContent  = costosResults.length
    $('csMatch').textContent  = costosResults.filter(r => r.status === 'ok').length
    $('csDiff').textContent   = costosResults.filter(r => r.status === 'bad').length
    $('csNoCont').textContent = costosResults.filter(r => r.status === 'warn').length
    $('csNoPdf').textContent  = costosResults.filter(r => !r.tag).length
  }

  async function startConciliationCostos() {
    const files = [...$('concFileInput').files]
    costosResults = []
    mostrar($('concStatsBar'), true, 'flex')
    mostrar($('concTableContainer'), false, 'block')
    mostrar($('concCostosContainer'), false, 'block')
    $('btnExportCSV').disabled = true

    for (const file of files) {
      let mandato
      try {
        const text = await extractPdfLines(file)
        mandato = extractMandate(text, file.name)
      } catch (e) {
        mandato = { cmu: '', projName: '', mandante: '', nit: '', vals: {}, total: null }
      }
      const sug = suggestTag(mandato.projName, tagsAnaliticos, savedTagMap)
      const rec = reconciliar(mandato, asientosDetalle, sug.tag)
      costosResults.push({ mandato, fileName: file.name, tag: sug.tag, sugStatus: sug.status, candidates: sug.candidates, ...rec })
    }

    recalcCostosStats()
    mostrar($('concCostosContainer'), true, 'block')
    $('btnExportCSV').disabled = false
    renderConcCostos()
  }

  function renderConcCostos() {
    const body = $('concCostosBody')
    if (!body) return
    const onlyProb = $('costosOnlyProblem') && $('costosOnlyProblem').checked
    const stBadge = s => s === 'ok'
      ? `<span class="${CLS.badgeOk}">✅ OK</span>`
      : s === 'warn'
        ? `<span class="${CLS.badgeWarn}">⚠️ Revisar</span>`
        : `<span class="${CLS.badgeErr}">❌ Hallazgos</span>`
    const visible = onlyProb ? costosResults.filter(r => r.status !== 'ok') : costosResults
    if (!visible.length) { body.innerHTML = '<div class="p-5 text-center text-muted-foreground">Sin registros</div>'; return }
    body.innerHTML = visible.map(r => {
      const idx = costosResults.indexOf(r)
      let tagControl
      if (r.tag && (r.sugStatus === 'recordado' || r.sugStatus === 'auto')) {
        tagControl = `<span class="text-xs text-muted-foreground">Etiqueta analítica: <b>${r.tag}</b> <small>(${r.sugStatus})</small></span>`
      } else {
        const opts = ['<option value="">— elegir etiqueta —</option>']
          .concat(tagsAnaliticos.map(t => `<option value="${t}" ${t === r.tag ? 'selected' : ''}>${t}</option>`)).join('')
        tagControl = `<span class="text-xs text-muted-foreground">Etiqueta analítica: </span><select class="${CLS.tol} w-auto min-w-55" onchange="setCostoTag(${idx}, this.value)">${opts}</select>`
      }
      const flagsHtml = r.flags.map(f => `<li class="my-0.5 text-xs ${TEXTO_NIVEL[f.lvl]}">${f.txt}</li>`).join('')
      return `<div id="costoRow${idx}" class="mb-2.5 rounded-xl border border-border p-3">
        <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div><b class="text-unergy-purple">${r.mandato.cmu || '-'}</b>
            <span class="ml-2 text-xs">${r.mandato.mandante || '<span class="text-warning">mandante no detectado</span>'}</span></div>
          ${stBadge(r.status)}
        </div>
        <div class="mb-1.5">${tagControl}</div>
        <ul class="m-0 pl-4.5">${flagsHtml || '<li class="text-xs text-muted-foreground">Sin detalle</li>'}</ul>
      </div>`
    }).join('')
  }

  // Ubica visualmente el/los registro(s) detrás de la métrica "SIN PDF"/"SIN
  // ETIQUETA": en COSTOS son mandatos sin etiqueta analítica asignada (no se
  // pudo verificar), en INGRESOS/AUTOCONSUMO son registros contables sin PDF.
  function focusSinPdfOrEtiqueta() {
    if (currentConcMode === 'costos') {
      const idx = costosResults.findIndex(r => !r.tag)
      if (idx === -1) return
      if ($('costosOnlyProblem')) $('costosOnlyProblem').checked = false
      renderConcCostos()
      requestAnimationFrame(() => {
        const row = document.getElementById('costoRow' + idx)
        if (!row) return
        row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        row.classList.add('flash-highlight')
        setTimeout(() => row.classList.remove('flash-highlight'), 2000)
      })
    } else {
      const sec = $('sinPdfSection')
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function setCostoTag(idx, tag) {
    const r = costosResults[idx]
    if (!r) return
    r.tag = tag
    if (tag && r.mandato.projName) { savedTagMap[normNombre(r.mandato.projName)] = tag; saveTagMap(savedTagMap) }
    Object.assign(r, reconciliar(r.mandato, asientosDetalle, tag))
    r.sugStatus = tag ? 'recordado' : r.sugStatus
    recalcCostosStats()
    renderConcCostos()
  }

  function exportConcCostosCSV() {
    if (!costosResults.length) return
    let csv = '﻿CMU,Mandante,Etiqueta,Estado,Nivel,Codigo,Detalle,Archivo\n'
    for (const r of costosResults) {
      const base = [r.mandato.cmu || '', `"${(r.mandato.mandante || '').replace(/"/g, '""')}"`, `"${r.tag || ''}"`, r.status]
      if (r.flags.length) {
        for (const f of r.flags) csv += base.concat([f.lvl, f.code, `"${f.txt.replace(/"/g, '""')}"`, `"${r.fileName}"`]).join(',') + '\n'
      } else {
        csv += base.concat(['', '', '', `"${r.fileName}"`]).join(',') + '\n'
      }
    }
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
      download: `conciliacion_costos_${new Date().toISOString().slice(0, 10)}.csv`,
    })
    a.click()
  }

  // ====== EJECUTAR CONCILIACIÓN ======
  async function startConciliation() {
    if (currentConcMode === 'costos') return startConciliationCostos()
    const files = [...$('concFileInput').files]
    concResults  = []
    mostrar($('concStatsBar'), true, 'flex')
    mostrar($('concTableContainer'), false, 'block')
    $('btnExportCSV').disabled = true

    // Marcar todos como no-encontrados inicialmente
    const contMatched = new Set()

    let matchN=0, diffN=0, noContN=0

    for (const file of files) {
      const d = await extractConcData(file, currentConcMode)
      // Match con el motor de tokens (mismo criterio que costos): asociado por
      // palabra completa + planta por tokens (incluye números). Ver matchIngresoContab.
      const rec = (d.mandante || d.projName)
                ? matchIngresoContab({ mandante: d.mandante, projName: d.projName }, contabilidadData) : null
      const contVal   = rec ? Math.abs(rec.valor_contabilidad) : null
      const diferencia= contVal !== null ? Math.round(d.valorPagar - contVal) : null
      const tol       = parseInt($('toleranceInput').value) || 200
      let estado
      if (d.error)        estado = 'ERROR_PDF'
      else if (!contVal)  { estado = 'SIN_CONTAB'; noContN++ }
      else if (Math.abs(diferencia) <= tol) { estado = 'OK'; matchN++ }
      else                { estado = 'DIFERENCIA'; diffN++ }

      if (rec) contMatched.add(rec.asociado + '|||' + rec.planta)
      // Desglose por concepto: cruza los conceptos del PDF contra los del asiento
      // emparejado (mismo asociado+planta). Vacío si no hubo match o no hay conceptos.
      let conceptos = []
      if (rec) {
        const gc = contabPorConcepto.find(g => g.asociado === rec.asociado && g.planta === rec.planta)
        conceptos = matchIngresoConceptos(d.conceptosPdf || {}, gc ? gc.conceptos : {}, tol)
      }
      concResults.push({ ...d, contVal, diferencia, estado, conceptos, recKey: rec ? rec.asociado+'|||'+rec.planta : null })
    }

    // Registros contables sin PDF
    const sinPdf = contabilidadData.filter(r =>
      !contMatched.has(r.asociado+'|||'+r.planta) && r.valor_contabilidad < 0
    )

    $('csTotal').textContent  = files.length
    $('csMatch').textContent  = matchN
    $('csDiff').textContent   = diffN
    $('csNoCont').textContent = noContN
    $('csNoPdf').textContent  = sinPdf.length

    mostrar($('concTableContainer'), true, 'block')
    $('btnExportCSV').disabled = false
    renderConcTable(sinPdf)
  }

  function renderConcTable(sinPdfOverride) {
    if (currentConcMode === 'costos') return renderConcCostos()
    const tol     = parseInt($('toleranceInput').value) || 200
    const onlyDiff= $('filterDiffOnly').checked
    const tbody   = $('concTableBody')
    tbody.innerHTML = ''

    let m=0, d=0, nc=0
    const rows = concResults.map((r, i) => {
      let estado = r.estado
      if (r.contVal !== null && r.diferencia !== null) {
        estado = Math.abs(r.diferencia) <= tol ? 'OK' : 'DIFERENCIA'
      }
      if (estado==='OK') m++; else if (estado==='SIN_CONTAB'||estado==='ERROR_PDF') nc++; else d++
      return {...r, estado, _idx: i}
    })
    $('csMatch').textContent  = m
    $('csDiff').textContent   = d
    $('csNoCont').textContent = nc

    const visible = onlyDiff ? rows.filter(r => r.estado !== 'OK') : rows
    if (!visible.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="p-5 text-center text-muted-foreground">Sin registros</td></tr>'
    } else {
      for (const r of visible) {
        const color = TEXTO_ESTADO[r.estado]
        const badge = r.estado === 'OK'
          ? `<span class="${CLS.badgeOk}">✅ OK</span>`
          : r.estado === 'DIFERENCIA'
          ? `<span class="${CLS.badgeErr}">❌ Diferencia</span>`
          : `<span class="${CLS.badgeWarn}">⚠️ ${r.estado}</span>`

        const difStr = r.diferencia !== null
          ? `<span class="font-bold ${color}">${r.diferencia>=0?'+':''}${r.diferencia.toLocaleString('es-CO')}</span>`
          : '—'

        // Detalle de diferencia: qué concepto falta o sobra
        let detalle = ''
        if (r.estado === 'DIFERENCIA' && r.diferencia !== null) {
          const dAbs = Math.abs(r.diferencia)
          // Buscar en contabilidadData si hay entradas relacionadas con misma planta
          const np = norm(r.planta || '')
          const relRows = contabilidadData.filter(cr => {
            const rp = norm(cr.planta)
            return (rp.includes(np) || np.includes(rp)) && Math.abs(cr.valor_contabilidad) > 1
          })
          if (relRows.length > 1) {
            detalle = relRows.map(cr =>
              `<div class="whitespace-nowrap text-xs text-muted-foreground">${cr.planta.replace(/^(MINIGRANJA SOLAR |GD )/,'')}: <b>$${Math.round(Math.abs(cr.valor_contabilidad)).toLocaleString('es-CO')}</b></div>`
            ).join('')
          } else {
            // Intentar identificar si es diferencia de redondeo, comercialización, etc.
            const pctDif = r.contVal ? (dAbs / r.contVal * 100) : 0
            if (pctDif < 1) detalle = '<span class="text-xs text-muted-foreground">Posible redondeo</span>'
            else detalle = `<span class="text-xs text-destructive">Dif: $${dAbs.toLocaleString('es-CO')}</span>`
          }
        } else if (r.estado === 'SIN_CONTAB') {
          detalle = `<span class="text-xs text-warning">Planta: "${r.planta||'?'}"</span>`
        }

        const idx = r._idx
        const conc = r.conceptos || []
        const hasConc = conc.length > 0
        const caret = hasConc
          ? `<span id="concCaret-${idx}" class="inline-block w-3 text-unergy-purple">▶</span> `
          : '<span class="inline-block w-3"></span> '
        const rowCls = hasConc ? 'group cursor-pointer' : 'group'
        const onclickAttr = hasConc ? ` onclick="toggleConcRow(${idx})"` : ''
        tbody.innerHTML += `<tr class="${rowCls}"${onclickAttr}>
          <td class="${CLS.td} font-mono font-semibold text-unergy-purple">${caret}${r.cmu||'-'}</td>
          <td class="${CLS.td} max-w-45 break-words text-xs">${r.inversionista||'<span class="text-warning">No detectado</span>'}</td>
          <td class="${CLS.td} max-w-40 break-words text-xs">${r.planta||'<span class="text-warning">No detectado</span>'}</td>
          <td class="${CLS.td} text-right font-mono">$${Math.round(r.valorPagar).toLocaleString('es-CO')}</td>
          <td class="${CLS.td} text-right font-mono">${r.contVal!==null?'$'+Math.round(r.contVal).toLocaleString('es-CO'):'<span class="text-warning">—</span>'}</td>
          <td class="${CLS.td} text-right font-mono">${difStr}</td>
          <td class="${CLS.td}">${badge}</td>
          <td class="${CLS.td} min-w-30 text-xs">${detalle}</td>
        </tr>`
        if (hasConc) {
          const cLabel = { OK:'✅ OK', DIFERENCIA:'❌ Diferencia', FALTA_CONTAB:'⚠️ Falta en contab.', SOBRA_CONTAB:'⚠️ Sobra en contab.' }
          const filasConc = conc.map(c => `<tr>
            <td class="px-2.5 py-0.5">${c.concepto} <span class="text-muted-foreground">(${c.rol})</span></td>
            <td class="px-2.5 py-0.5 text-right font-mono">${c.pdf!==null?'$'+Math.round(c.pdf).toLocaleString('es-CO'):'—'}</td>
            <td class="px-2.5 py-0.5 text-right font-mono">${c.contab!==null?'$'+Math.round(c.contab).toLocaleString('es-CO'):'—'}</td>
            <td class="px-2.5 py-0.5 text-right font-mono font-semibold ${TEXTO_CONCEPTO[c.estado]}">${c.dif!==null?(c.dif>=0?'+':'')+c.dif.toLocaleString('es-CO'):'—'}</td>
            <td class="px-2.5 py-0.5 text-xs ${TEXTO_CONCEPTO[c.estado]}">${cLabel[c.estado]}</td>
          </tr>`).join('')
          tbody.innerHTML += `<tr id="concDetail-${idx}" class="hidden"><td colspan="8" class="bg-muted/50 px-4 py-2">
            <div class="mb-1 text-xs text-muted-foreground">Conciliación por concepto (cuenta 28150505)</div>
            <table class="w-full border-collapse text-xs">
              <thead><tr class="border-b border-border text-left text-muted-foreground">
                <th class="px-2.5 py-0.5">Concepto</th>
                <th class="px-2.5 py-0.5 text-right">Valor PDF</th>
                <th class="px-2.5 py-0.5 text-right">Valor Contab.</th>
                <th class="px-2.5 py-0.5 text-right">Diferencia</th>
                <th class="px-2.5 py-0.5">Estado</th></tr></thead>
              <tbody>${filasConc}</tbody>
            </table></td></tr>`
        }
      }
    }

    // Sin PDF
    const sinPdf = sinPdfOverride || contabilidadData.filter(r =>
      !concResults.find(cr => cr.recKey === r.asociado+'|||'+r.planta) && r.valor_contabilidad < 0
    )
    const sinPdfSection = $('sinPdfSection')
    const sinPdfBody    = $('sinPdfBody')
    $('csNoPdf').textContent = sinPdf.length
    if (sinPdf.length && !onlyDiff) {
      mostrar(sinPdfSection, true, 'block')
      sinPdfBody.innerHTML = sinPdf.map(r => `<tr class="group">
        <td class="${CLS.td} text-xs">${r.asociado}</td>
        <td class="${CLS.td} text-xs">${r.planta}</td>
        <td class="${CLS.td} text-right font-mono text-warning">$${Math.round(Math.abs(r.valor_contabilidad)).toLocaleString('es-CO')}</td>
      </tr>`).join('')
    } else {
      mostrar(sinPdfSection, false, 'block')
    }
  }

  // Despliega/oculta el desglose por concepto de una fila de ingresos.
  function toggleConcRow(idx) {
    const row = $('concDetail-' + idx); const caret = $('concCaret-' + idx)
    if (!row) return
    const abrir = row.classList.contains('hidden')
    mostrar(row, abrir, 'table-row')
    if (caret) caret.textContent = abrir ? '▼' : '▶'
  }

  function exportConcCSV() {
    if (currentConcMode === 'costos') return exportConcCostosCSV()
    if (!concResults.length) return
    const tol = parseInt($('toleranceInput').value) || 200
    let csv = '﻿'
    csv += 'CMU,Inversionista,Planta,Valor PDF,Valor Contabilidad,Diferencia,Estado,Archivo\n'
    for (const r of concResults) {
      const estado = r.contVal!==null
        ? (Math.abs(r.diferencia)<=tol ? 'OK' : 'DIFERENCIA') : r.estado
      csv += [
        r.cmu,
        `"${r.inversionista}"`,
        `"${r.planta}"`,
        Math.round(r.valorPagar),
        r.contVal!==null ? Math.round(r.contVal) : '',
        r.diferencia!==null ? r.diferencia : '',
        estado,
        `"${r.fileName}"`
      ].join(',') + '\n'
    }
    // Registros sin PDF
    const sinPdf = contabilidadData.filter(r =>
      !concResults.find(cr => cr.recKey === r.asociado+'|||'+r.planta) && r.valor_contabilidad < 0)
    for (const r of sinPdf) {
      csv += ['',`"${r.asociado}"`,`"${r.planta}"`, '', Math.round(Math.abs(r.valor_contabilidad)), '', 'SIN_PDF', ''].join(',') + '\n'
    }
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})),
      download: `conciliacion_mandatos_${new Date().toISOString().slice(0,10)}.csv`
    })
    a.click()
  }

  // ====== AUDITORÍA (lógica original intacta) ======
  async function startAudit() {
    const files = [...$('fileInput').files]
    const container    = $('results')
    const reportBody   = $('reportContent')
    const reportContainer = $('reportContainer')
    container.innerHTML = ''
    reportBody.innerHTML = ''
    mostrar(reportContainer, false, 'block')
    mostrar($('statsBar'), true, 'flex')
    const processedCmuIds = new Set()
    let ok=0, err=0

    for (const file of files) {
      const card = document.createElement('div')
      card.className = 'relative rounded-lg border border-border bg-card p-4'
      card.innerHTML = `<b class="text-xs">${file.name}</b><div class="mt-2 inline-block size-4.5 animate-spin rounded-full border-3 border-muted border-t-unergy-purple"></div>`
      container.appendChild(card)

      const res = await processPdf(file)
      const cmuInName = (file.name.match(/CMU\d+/i)||[''])[0].toUpperCase()

      if (res.approved) {
        if (!cmuInName) { res.approved=false; res.msg='Nombre sin CMU' }
        else if (res.cmuInText && cmuInName !== res.cmuInText) { res.approved=false; res.msg=`Conflicto: archivo ${cmuInName} vs PDF ${res.cmuInText}` }
        else if (processedCmuIds.has(cmuInName)) { res.approved=false; res.msg=`CMU ${cmuInName} duplicado` }
      }
      if (cmuInName) processedCmuIds.add(cmuInName)

      if (res.approved) ok++
      else {
        err++
        mostrar(reportContainer, true, 'block')
        reportBody.innerHTML += `<tr class="group">
          <td class="${CLS.td}">${cmuInName||'S/N'}<br><small class="text-xs text-muted-foreground">${file.name}</small></td>
          <td class="${CLS.td} font-mono">$${res.reported.toLocaleString()}</td>
          <td class="${CLS.td} font-mono">$${res.expected.toLocaleString()}</td>
          <td class="${CLS.td} font-semibold text-destructive">${res.msg}</td>
        </tr>`
      }

      card.innerHTML = `
        <span class="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase ${res.approved?'bg-success/15 text-success':'bg-destructive/10 text-destructive'}">${res.approved?'CUMPLE':'RECHAZADO'}</span>
        <b class="mr-16 block text-xs text-unergy-purple">${cmuInName||'Sin CMU'}</b>
        <div class="mt-1 truncate text-xs text-muted-foreground">${file.name}</div>
        <div class="mt-2.5 grid grid-cols-2 border-t border-muted pt-2 text-xs">
          <div>Matemática: ${res.mathOk?'✅':'❌'}</div>
          ${(currentMode==='ingresos'||currentMode==='autoconsumo')?`<div>Marca (**): ${res.starOk?'✅':'❌'}</div>`:'<div></div>'}
          <div class="col-span-2 mt-1.5 font-mono font-bold">Total: $${res.reported.toLocaleString()}</div>
        </div>`

      $('sTotal').textContent = files.length
      $('sOk').textContent    = ok
      $('sErr').textContent   = err
    }
  }

  async function processPdf(file) {
    if (currentMode === 'autoconsumo') return processPdfAutoconsumo(file)
    try {
      const data = await file.arrayBuffer()
      const pdf  = await pdfjsLib.getDocument({data}).promise
      let fullText=''
      for (let i=1; i<=pdf.numPages; i++) {
        const p = await pdf.getPage(i)
        fullText += (await p.getTextContent()).items.map(it=>it.str).join('  ') + ' \n '
      }
      const text = fullText.toUpperCase()
      const cmuM = text.match(/CMU\d+/i)
      const cmuInText = cmuM ? cmuM[0].toUpperCase() : null
      const money = [...text.matchAll(/\$\s*([\d\.,]+)/g)].map(m=>({
        val: normalizarCifra(m[1]), index:m.index}))
      const labels=[]
      ;[{type:'SUMA',re:/SUMA/g},{type:'RESTA',re:/RESTA/g},{type:'TOTAL',re:/VALOR\s+A\s+PAGAR/g}].forEach(p=>{
        let m; const r=new RegExp(p.re.source,'g')
        while((m=r.exec(text))!==null) labels.push({type:p.type,index:m.index})
      })
      labels.sort((a,b)=>a.index-b.index)
      let calc=0,reported=0,totalFound=false
      labels.forEach(l=>{
        const v=money.find(v=>v.index>l.index && v.index-l.index<500)
        if(v){if(l.type==='SUMA')calc+=v.val;else if(l.type==='RESTA')calc-=v.val;else{reported=v.val;totalFound=true;}}
      })
      const diff=Math.abs(reported-calc)
      const mathOk=diff<150&&reported>0
      const starOk=currentMode==='ingresos'?fullText.includes('**'):true
      let msg='OK'
      if(!totalFound) msg="No se halló 'Valor a Pagar'"
      else if(reported===0) msg='Valor a Pagar = $0'
      else if(!mathOk) msg=`Error cálculo (Dif: $${Math.round(diff)})`
      else if(!starOk) msg='Faltan asteriscos (**)'
      return {approved:mathOk&&starOk&&totalFound,mathOk,starOk,diff,reported,expected:calc,msg,cmuInText}
    } catch(e){return{approved:false,reported:0,expected:0,msg:'Error lectura PDF'}}
  }

  async function processPdfAutoconsumo(file) {
    try {
      const data = await file.arrayBuffer()
      const pdf  = await pdfjsLib.getDocument({data}).promise
      let fullText=''
      for (let i=1; i<=pdf.numPages; i++) {
        const p = await pdf.getPage(i)
        fullText += (await p.getTextContent()).items.map(it=>it.str).join('  ') + ' \n '
      }
      const text = fullText.toUpperCase()
      const cmuM = text.match(/CMU\d+/i)
      const cmuInText = cmuM ? cmuM[0].toUpperCase() : null
      const money=[...text.matchAll(/\b([\d]{1,3}(?:,[\d]{3})+|[\d]{4,})\b/g)]
        .map(m=>({val:normalizarCifra(m[1]),index:m.index})).filter(m=>m.val>=100)
      const labels=[]
      ;[{type:'SUMA',re:/\bSUMA\b/g},{type:'RESTA',re:/\bRESTA\b/g},{type:'TOTAL',re:/VALOR\s+A\s+PAGAR/g}].forEach(p=>{
        let m; const r=new RegExp(p.re.source,'g')
        while((m=r.exec(text))!==null) labels.push({type:p.type,index:m.index})
      })
      labels.sort((a,b)=>a.index-b.index)
      let calc=0,reported=0,totalFound=false
      labels.forEach(l=>{
        const v=money.find(v=>v.index>l.index && v.index-l.index<600)
        if(v){if(l.type==='SUMA')calc+=v.val;else if(l.type==='RESTA')calc-=v.val;else{reported=v.val;totalFound=true;}}
      })
      const diff=Math.abs(reported-calc)
      const mathOk=totalFound&&diff<150&&reported>0
      const starOk=fullText.includes('**')
      let msg='OK'
      if(!totalFound) msg="No se halló 'Valor a Pagar'"
      else if(reported===0) msg='Valor a Pagar = $0'
      else if(!mathOk) msg=`Error cálculo (Dif: $${Math.round(diff)})`
      else if(!starOk) msg='Faltan asteriscos (**)'
      return{approved:mathOk&&starOk&&totalFound,mathOk,starOk,diff,reported,expected:calc,msg,cmuInText}
    } catch(e){return{approved:false,reported:0,expected:0,msg:'Error lectura PDF',cmuInText:null}}
  }

  // Exponer las funciones que el markup invoca vía onclick/onchange
  window.switchTab = switchTab
  window.setMode = setMode
  window.updateAuditUI = updateAuditUI
  window.loadExcel = loadExcel
  window.setConcMode = setConcMode
  window.updateConcUI = updateConcUI
  window.startConciliation = startConciliation
  window.renderConcTable = renderConcTable
  window.toggleConcRow = toggleConcRow
  window.exportConcCSV = exportConcCSV
  window.startAudit = startAudit
  window.setCostoTag = setCostoTag
  window.focusSinPdfOrEtiqueta = focusSinPdfOrEtiqueta
}

onMounted(async () => {
  // pdf.js sigue desde CDN; XLSX ahora es el paquete npm importado
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
  root.value.innerHTML = MARKUP
  initValidador(root.value)
})

onBeforeUnmount(() => {
  GLOBAL_FNS.forEach(fn => { delete window[fn] })
})
</script>

<style scoped>
/* Único CSS imposible con utilidades: el @keyframes del resaltado. La clase se aplica
   por JS a un nodo del HTML inyectado, de ahí el :deep. */
.vm-root :deep(.flash-highlight) { animation: vm-flash 2s ease-out; }
@keyframes vm-flash {
  0%, 40% { background-color: color-mix(in oklab, var(--color-unergy-purple) 15%, transparent); border-color: var(--color-unergy-purple); }
  100% { background-color: transparent; }
}
</style>
