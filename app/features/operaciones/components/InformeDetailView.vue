<template>
  <div class="inf-detail-wrapper">

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastMsg" :class="['inf-toast', toastError ? 'inf-toast-err' : 'inf-toast-ok']">
        {{ toastMsg }}
      </div>
    </transition>

    <!-- Breadcrumb -->
    <div class="inf-breadcrumb">
      <RouterLink to="/informes" class="inf-back">← Informes</RouterLink>
      <span class="inf-sep">/</span>
      <span class="inf-bc-nombre">{{ informe?.proyecto_nombre || informe?.sub_project || '…' }}</span>
      <span v-if="informe?.periodo_display" class="inf-bc-periodo">· {{ informe.periodo_display }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="inf-estado-carga">
      <div class="spin-ring" />
      <span>Cargando informe…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="inf-estado-error">
      ⚠️ {{ error }}
      <br><small style="color:#6B5F80;font-size:11px">Verifica que el informe exista y tengas permisos.</small>
    </div>

    <template v-else-if="informe">

      <!-- ══ Toolbar ══ -->
      <div class="inf-toolbar">
        <!-- Izq: edición -->
        <div class="inf-toolbar-left">
          <button v-if="!editMode && informe.estado === 'borrador'" class="inf-btn inf-btn-ghost" @click="enterEdit">
            ✏️ Editar informe
          </button>
          <button v-if="editMode" class="inf-btn inf-btn-ghost inf-btn-danger" @click="discardEdit">
            ↩ Descartar cambios
          </button>
          <button v-if="editMode" class="inf-btn inf-btn-ghost inf-btn-success"
                  :disabled="saving" @click="saveEdit">
            {{ saving ? '…' : '💾 Guardar versión' }}
          </button>
        </div>

        <!-- Der: flujo de aprobación -->
        <div class="inf-toolbar-right">
          <span :class="['inf-estado-badge', estadoClass]">{{ estadoLabel }}</span>
          <button v-if="informe.estado === 'borrador'"
                  class="inf-btn inf-btn-ghost inf-btn-blue"
                  :disabled="changingEstado"
                  @click="changeEstado('revisado')">
            👁 Marcar revisado
          </button>
          <button v-if="informe.estado === 'revisado'"
                  class="inf-btn inf-btn-ghost inf-btn-purple"
                  :disabled="changingEstado"
                  @click="changeEstado('aprobado')">
            ✅ Aprobar y enviar
          </button>
          <button v-if="informe.estado === 'revisado'"
                  class="inf-btn inf-btn-ghost"
                  :disabled="changingEstado"
                  @click="changeEstado('borrador')"
                  style="color:#FF5757;border-color:#FF575740">
            ↩ Devolver a borrador
          </button>
          <button class="inf-btn inf-btn-yellow" @click="printInforme">
            🖨 Imprimir / PDF
          </button>
        </div>
      </div>

      <!-- Hint edición -->
      <div v-if="editMode" class="inf-edit-hint">
        ✏️ Haz clic en cualquier texto para editarlo directamente
        &nbsp;·&nbsp; Al terminar haz clic en <b>💾 Guardar versión</b>
      </div>

      <!-- Panel días en rojo (solo en editMode) -->
      <div v-if="editMode && diasDisponibles.length" class="inf-red-panel">
        <span class="inf-red-label">🎨 Días en rojo:</span>
        <select v-if="informe.tipo === 'port'" v-model="subProjectActivo" class="inf-red-select">
          <option v-for="p in proyectosDisponibles" :key="p.sp" :value="p.sp">{{ p.nombre }}</option>
        </select>
        <button v-for="d in diasDisponibles" :key="d.date"
                :class="['inf-day-chip', diasRojosActivos.has(d.date) ? 'inf-day-chip--on' : '']"
                @click="toggleDiaRojo(d.date)">
          {{ d.day }}
        </button>
        <button v-if="diasRojosActivos.size > 0" class="inf-day-clear" @click="limpiarDiasRojos">✕ Limpiar</button>
      </div>

      <!-- ══ Contenido del informe ══ -->
      <div
        ref="contentRef"
        class="inf-report-content"
        :contenteditable="editMode ? 'true' : 'false'"
        v-html="htmlContent"
      />

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { InformesService } from '~/features/operaciones/services/informes'

const informesService = new InformesService()

const route = useRoute()

const informe    = ref(null)
const loading    = ref(false)
const error      = ref(null)
const editMode   = ref(false)
const saving     = ref(false)
const changingEstado = ref(false)
const contentRef = ref(null)
const htmlContent = ref('')
const toastMsg   = ref('')
const toastError = ref(false)
let _toastTimer  = null

// ── Días en rojo ────────────────────────────────────────────────
const subProjectActivo = ref('')
const diasRojosMap = ref({}) // { sub_project: Set<date> }

const proyectosDisponibles = computed(() => {
  if (!contentRef.value) return []
  return [...contentRef.value.querySelectorAll('[data-sub-project]')].map(el => ({
    sp: el.getAttribute('data-sub-project'),
    nombre: el.getAttribute('data-nombre') || el.getAttribute('data-sub-project'),
  }))
})

const diasDisponibles = computed(() => {
  if (!contentRef.value) return []
  let container = contentRef.value
  if (informe.value?.tipo === 'port' && subProjectActivo.value) {
    container = contentRef.value.querySelector(`[data-sub-project="${subProjectActivo.value}"]`) || contentRef.value
  }
  const fechas = new Set()
  container.querySelectorAll('rect[data-date]').forEach(r => fechas.add(r.getAttribute('data-date')))
  return [...fechas].sort().map(d => ({ date: d, day: parseInt(d.split('-')[2]) }))
})

const diasRojosActivos = computed(() => {
  const sp = informe.value?.tipo === 'port' ? subProjectActivo.value : (informe.value?.sub_project || '_')
  return diasRojosMap.value[sp] || new Set()
})

function toggleDiaRojo(fecha) {
  const sp = informe.value?.tipo === 'port' ? subProjectActivo.value : (informe.value?.sub_project || '_')
  const map = { ...diasRojosMap.value }
  const s = new Set(map[sp] || [])
  // Cambiar fill en el DOM directamente
  let container = contentRef.value
  if (informe.value?.tipo === 'port' && subProjectActivo.value) {
    container = contentRef.value.querySelector(`[data-sub-project="${subProjectActivo.value}"]`) || contentRef.value
  }
  if (s.has(fecha)) {
    s.delete(fecha)
    container.querySelectorAll(`rect[data-date="${fecha}"]`).forEach(r => r.setAttribute('fill', '#6B35C0'))
  } else {
    s.add(fecha)
    container.querySelectorAll(`rect[data-date="${fecha}"]`).forEach(r => r.setAttribute('fill', '#DC3232'))
  }
  map[sp] = s
  diasRojosMap.value = map
}

function limpiarDiasRojos() {
  const sp = informe.value?.tipo === 'port' ? subProjectActivo.value : (informe.value?.sub_project || '_')
  const s = diasRojosMap.value[sp] || new Set()
  let container = contentRef.value
  if (informe.value?.tipo === 'port' && subProjectActivo.value) {
    container = contentRef.value.querySelector(`[data-sub-project="${subProjectActivo.value}"]`) || contentRef.value
  }
  s.forEach(fecha => {
    container.querySelectorAll(`rect[data-date="${fecha}"]`).forEach(r => r.setAttribute('fill', '#6B35C0'))
  })
  const map = { ...diasRojosMap.value }
  delete map[sp]
  diasRojosMap.value = map
}

watch(editMode, (val) => {
  if (!val) diasRojosMap.value = {}
})

watch(() => informe.value?.tipo, () => {
  subProjectActivo.value = ''
  nextTick(() => {
    if (proyectosDisponibles.value.length) subProjectActivo.value = proyectosDisponibles.value[0].sp
  })
})

// ── Cargar ───────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  error.value   = null
  try {
    const data = await informesService.obtener(route.params.id)
    informe.value   = data
    htmlContent.value = data.html_content || ''
  } catch (e) {
    error.value = e.data?.detail || e.message
  } finally {
    loading.value = false
  }
}

// ── Edición ──────────────────────────────────────────────────────
function enterEdit() {
  editMode.value = true
  diasRojosMap.value = {}
  nextTick(() => {
    contentRef.value?.focus()
    if (informe.value?.tipo === 'port' && proyectosDisponibles.value.length) {
      subProjectActivo.value = proyectosDisponibles.value[0].sp
    }
  })
}

function discardEdit() {
  editMode.value  = false
  htmlContent.value = informe.value.html_content || ''
}

async function saveEdit() {
  if (!contentRef.value) return
  saving.value = true
  try {
    const newHtml = contentRef.value.innerHTML
    const data = await informesService.guardar({
      tipo: informe.value.tipo,
      sub_project: informe.value.sub_project,
      periodo_desde: informe.value.periodo_desde,
      periodo_hasta: informe.value.periodo_hasta,
      periodo_display: informe.value.periodo_display,
      proyecto_nombre: informe.value.proyecto_nombre,
      html_content: newHtml,
    })
    informe.value   = { ...informe.value, ...data }
    htmlContent.value = newHtml
    editMode.value  = false
    toast('💾 Informe guardado')
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
  } finally {
    saving.value = false
  }
}

// ── Cambiar estado ───────────────────────────────────────────────
async function changeEstado(nuevoEstado) {
  changingEstado.value = true
  try {
    const data = await informesService.cambiarEstado(informe.value.id, nuevoEstado)
    informe.value = { ...informe.value, ...data }
    if (nuevoEstado === 'aprobado') {
      try {
        const envData = await informesService.enviar(informe.value.id)
        toast(`✅ Aprobado y enviado a ${envData.enviado_a}`)
      } catch (err) {
        const msg = err.data?.detail || ''
        toast('✅ Aprobado' + (msg ? ' — ' + msg : ' (correo no enviado)'))
      }
    } else {
      toast(`👁 Estado: ${nuevoEstado}`)
    }
  } catch (e) {
    toast('⚠️ ' + (e.data?.detail || e.message), true)
  } finally {
    changingEstado.value = false
  }
}

// ── Imprimir ─────────────────────────────────────────────────────
function printInforme() {
  window.print()
}

// ── Toast ────────────────────────────────────────────────────────
function toast(msg, isErr = false) {
  toastMsg.value   = msg
  toastError.value = isErr
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => { toastMsg.value = '' }, 5000)
}

// ── Estado computed ──────────────────────────────────────────────
const estadoClass = computed(() => ({
  borrador: 'badge-borrador',
  revisado: 'badge-revisado',
  aprobado: 'badge-aprobado',
}[informe.value?.estado] || ''))

const estadoLabel = computed(() => ({
  borrador: 'Borrador',
  revisado: 'Revisado',
  aprobado: '✅ Aprobado',
}[informe.value?.estado] || informe.value?.estado || ''))

onMounted(cargar)
</script>

<!-- ══ Estilos interfaz (dark — idéntico al monitoreo) ══ -->
<style scoped>
.inf-detail-wrapper {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 20px 80px;
  font-family: 'Sora', sans-serif;
  color: var(--color-unergy-avena);
  position: relative;
}

/* Toast */
.inf-toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 10px 22px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 6px 24px #00000060;
  pointer-events: none;
}
.inf-toast-ok  { background: #2D8A4E; color: #fff; }
.inf-toast-err { background: #992222; color: #fff; }
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Breadcrumb */
.inf-breadcrumb {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; color: #6B5F80;
  margin-bottom: 16px; flex-wrap: wrap;
}
.inf-back { color: var(--color-unergy-purple); text-decoration: none; font-weight: 700; }
.inf-back:hover { text-decoration: underline; }
.inf-sep { color: #4A3560; }
.inf-bc-nombre { color: #A89EC0; font-weight: 600; }
.inf-bc-periodo { color: #6B5F80; }

/* Estados */
.inf-estado-carga {
  display: flex; flex-direction: column; align-items: center;
  gap: 14px; padding: 80px 20px; color: #A89EC0; font-size: 13px;
}
.inf-estado-error {
  text-align: center; padding: 60px 20px;
  color: #FF5757; font-size: 13px;
}

/* Toolbar */
.inf-toolbar {
  background: #362848; border: 1px solid #4A3560; border-radius: 12px;
  padding: 12px 16px; margin-bottom: 14px;
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px;
}
.inf-toolbar-left, .inf-toolbar-right {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}

/* Hint */
.inf-edit-hint {
  margin-bottom: 12px; padding: 8px 12px;
  background: rgba(145,91,216,0.06); border: 1px solid rgba(145,91,216,0.2);
  border-radius: 8px; font-size: 11px; color: #A89EC0; line-height: 1.5;
}

/* Botones */
.inf-btn {
  border-radius: 8px; padding: 6px 13px; font-size: 11px; font-weight: 700;
  border: none; display: inline-flex; align-items: center; gap: 5px;
  cursor: pointer; transition: all 0.18s;
  font-family: 'Sora', sans-serif; white-space: nowrap;
}
.inf-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.inf-btn-ghost { background: #422D57; color: var(--color-unergy-avena); border: 1px solid #5B4272; }
.inf-btn-ghost:hover:not(:disabled) { border-color: var(--color-unergy-purple); }
.inf-btn-danger  { color: #FF5757 !important; border-color: rgba(255,87,87,0.25) !important; }
.inf-btn-success { color: #2D8A4E !important; border-color: rgba(74,222,128,0.25) !important; }
.inf-btn-blue    { color: #2563EB !important; border-color: rgba(37,99,235,0.25) !important; }
.inf-btn-purple  { color: var(--color-unergy-purple) !important; border-color: rgba(145,91,216,0.25) !important; }
.inf-btn-yellow  { background: var(--color-unergy-yellow); color: #1A0F2E; font-weight: 800; }
.inf-btn-yellow:hover { background: #e8f060; }

/* Badges */
.inf-estado-badge {
  font-size: 10px; font-weight: 800; padding: 3px 10px;
  border-radius: 20px; letter-spacing: 0.5px; white-space: nowrap;
}
.badge-borrador { background: rgba(246,255,114,0.12); color: #B8A800; border: 1px solid rgba(246,255,114,0.25); }
.badge-revisado { background: rgba(37,99,235,0.12);   color: #2563EB; border: 1px solid rgba(37,99,235,0.25); }
.badge-aprobado { background: rgba(74,222,128,0.12);  color: #2D8A4E; border: 1px solid rgba(74,222,128,0.25); }

/* Panel días en rojo */
.inf-red-panel {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding: 8px 14px; margin-bottom: 12px;
  background: rgba(220,50,50,0.06); border: 1px solid rgba(220,50,50,0.2); border-radius: 10px;
}
.inf-red-label { font-size: 11px; font-weight: 700; color: #FF8080; margin-right: 4px; white-space: nowrap; }
.inf-red-select {
  background: #2A1A3A; border: 1px solid rgba(220,50,50,0.3); border-radius: 6px;
  padding: 3px 8px; font-size: 11px; font-weight: 700; color: #FF8080;
  font-family: 'Sora', sans-serif; cursor: pointer; max-width: 200px;
}
.inf-day-chip {
  border: 1px solid #4A3560; background: #2A1A3A; border-radius: 6px;
  padding: 3px 9px; font-size: 11px; font-weight: 700; cursor: pointer;
  color: #A89EC0; font-family: 'Sora', sans-serif; transition: all .12s;
}
.inf-day-chip:hover { border-color: #DC3232; color: #FF8080; }
.inf-day-chip--on { background: #DC3232; border-color: #DC3232; color: #fff; }
.inf-day-clear {
  border: 1px solid rgba(220,50,50,0.3); background: rgba(220,50,50,0.12); border-radius: 6px;
  padding: 3px 9px; font-size: 11px; font-weight: 700; cursor: pointer;
  color: #FF8080; font-family: 'Sora', sans-serif;
}

/* Contenido */
.inf-report-content { outline: none; }
.inf-report-content[contenteditable="true"] { cursor: text; }

/* Spinner */
.spin-ring {
  width: 32px; height: 32px;
  border: 3px solid rgba(145,91,216,0.2); border-top-color: var(--color-unergy-purple);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<!-- ══ CSS del INFORME (no-scoped: aplica al v-html) ══ -->
<style>
/* Páginas del informe */
.rpt-page{background:#fff;color:#1A0F2E;font-family:'Sora',sans-serif;font-size:12px;border-radius:12px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.25);margin-bottom:24px}
.rpt-header{background:#1A0F2E;padding:18px 28px}
.rpt-meta-grid{display:grid;grid-template-columns:repeat(4,1fr);margin-top:14px;border:1px solid #2D1F45;border-radius:8px;overflow:hidden}
.rpt-meta-item{background:#221533;padding:10px 14px;border-right:1px solid #2D1F45}
.rpt-meta-item:last-child{border-right:none}
.rpt-meta-lbl{font-size:9px;font-weight:700;color:#6B5F80;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px}
.rpt-meta-val{font-size:13px;font-weight:700;color:#fff}
.rpt-section{padding:16px 28px;border-bottom:1px solid #EDE8F5}
.rpt-section:last-of-type{border-bottom:none}
.rpt-section-title{font-size:13px;font-weight:800;color:#1A0F2E;margin-bottom:13px;padding-left:10px;border-left:3px solid var(--color-unergy-purple)}
.rpt-kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.rpt-kpi{background:#F7F4FD;border:1px solid #EDE8F5;border-radius:10px;padding:13px 15px}
.rpt-kpi-ico{font-size:17px;margin-bottom:4px}
.rpt-kpi-lbl{font-size:9px;font-weight:700;color:#A89EC0;letter-spacing:.7px;text-transform:uppercase;margin-bottom:3px}
.rpt-kpi-val{font-size:20px;font-weight:800;color:#1A0F2E;font-family:'JetBrains Mono',monospace;line-height:1}
.rpt-table{width:100%;border-collapse:collapse;font-size:11px}
.rpt-table th{background:#1A0F2E;color:var(--color-unergy-yellow);font-size:9px;font-weight:700;letter-spacing:.8px;padding:8px 10px;text-align:left}
.rpt-table td{padding:7px 10px;border-bottom:1px solid #F0EBF8;vertical-align:top;line-height:1.5}
.rpt-table tbody tr:nth-child(even) td{background:#F9F7FD}
.rpt-total-row td{background:#EDE8F5!important;font-weight:700;border-top:2px solid var(--color-unergy-purple)}
.rpt-chart-card{background:#F9F7FD;border:1px solid #EDE8F5;border-radius:10px;padding:14px}
.rpt-obs-title{font-size:9px;font-weight:700;color:#A89EC0;letter-spacing:.8px;text-transform:uppercase;margin-bottom:9px}
.rpt-obs-text{font-size:12px;color:#3D2D5C;line-height:1.8;background:#F7F4FD;border-radius:8px;padding:13px 15px;border-left:3px solid #4ADE80}
.rpt-status-box{background:#F7F4FD;border:1px solid #EDE8F5;border-radius:10px;padding:15px;font-size:12px;color:#3D2D5C}
.rpt-status-row{font-size:11px;color:#6B5F80;margin-top:5px}
.rpt-footer{background:#F7F4FD;border-top:1px solid #EDE8F5;padding:10px 28px;font-size:10px;color:#A89EC0;display:flex;justify-content:space-between}
/* FMO */
.fmo-page{background:#fff;color:#1A0F2E;font-family:'Sora',sans-serif;font-size:12px;border-radius:12px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.25);margin-bottom:24px}
.fmo-header{background:#1A0F2E;padding:18px 28px}
.fmo-section-title{font-size:13px;font-weight:800;color:#1A0F2E;margin-bottom:12px;padding-left:10px;border-left:3px solid var(--color-unergy-purple)}
.fmo-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.fmo-kpi{background:#F7F4FD;border:1px solid #EDE8F5;border-radius:10px;padding:12px 14px}
.fmo-kpi-lbl{font-size:9px;font-weight:700;color:#A89EC0;letter-spacing:.7px;text-transform:uppercase;margin-bottom:3px}
.fmo-kpi-val{font-size:18px;font-weight:800;color:#1A0F2E;font-family:'JetBrains Mono',monospace}
.fmo-ok-box{background:#F0FFF4;border:1px solid rgba(74,222,128,0.25);border-radius:10px;padding:14px 18px;color:#2D5A3D;font-size:12px}
.fmo-multa-box{background:#FFF5F5;border:1px solid rgba(255,87,87,0.25);border-radius:10px;padding:14px 18px;color:#7A1E1E;font-size:12px}
.fmo-inv-table,.fmo-mant-table{width:100%;border-collapse:collapse;font-size:11px}
.fmo-inv-table th,.fmo-mant-table th{background:#1A0F2E;color:var(--color-unergy-yellow);font-size:9px;font-weight:700;letter-spacing:.8px;padding:8px 10px;text-align:left}
.fmo-inv-table td,.fmo-mant-table td{padding:7px 10px;border-bottom:1px solid #F0EBF8;vertical-align:top;line-height:1.5}
/* Print */
@page{margin:6mm 8mm;size:A4 portrait}
@media print {
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .inf-breadcrumb,.inf-toolbar,.inf-edit-hint,.inf-toast{display:none!important}
  body{background:#fff!important}
  .inf-detail-wrapper{padding:0!important;max-width:100%!important}
  /* Cada página ocupa el alto imprimible para anclar el pie abajo, sin partir estructura */
  .rpt-page,.fmo-page{box-shadow:none!important;border-radius:0!important;margin-bottom:0!important;overflow:visible!important;page-break-after:always;break-after:page;display:flex!important;flex-direction:column!important;min-height:calc(297mm - 12mm - 1mm)}
  .rpt-page:last-child,.fmo-page:last-child{page-break-after:auto!important}
  .rpt-footer{margin-top:auto!important}
  .rpt-section,.rpt-kpi-row,.rpt-kpi,.rpt-chart-card,.rpt-status-box,.rpt-obs-text,.fmo-ok-box,.fmo-multa-box{break-inside:avoid;page-break-inside:avoid}
  .rpt-section-title,.fmo-section-title{break-after:avoid;page-break-after:avoid}
  .rpt-table tr,.fmo-inv-table tr,.fmo-mant-table tr{break-inside:avoid;page-break-inside:avoid}
  .rpt-table thead,.fmo-inv-table thead,.fmo-mant-table thead{display:table-header-group}
  .rpt-header,.fmo-header{background:#1A0F2E!important}
  .rpt-meta-item{background:#221533!important}
  .rpt-table th,.fmo-inv-table th,.fmo-mant-table th{background:#1A0F2E!important;color:#E8C840!important}
  .rpt-total-row td{background:#EDE8F5!important}
}
</style>
