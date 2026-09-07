<template>
  <div class="liq-page">

    <!-- ══ Topbar compacto con tabs (patrón TSF) ═══════════════════ -->
    <div class="liq-topbar">
      <div class="liq-topbar-title">
        <DollarSignIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
        <h2 class="text-base font-bold text-gray-800 whitespace-nowrap">Liquidaciones</h2>
        <span class="hidden xl:inline text-xs text-gray-500">· Estado financiero por proyecto y período</span>
      </div>

      <div class="liq-tabs">
        <button v-for="t in TABS" :key="t.key" class="liq-tab"
          :class="{ 'liq-tab--on': tab === t.key }" @click="tab = t.key">
          <component :is="t.icon" class="size-[1em]" /><span>{{ t.label }}</span>
        </button>
      </div>

      <div class="liq-topbar-spacer" />

      <!-- Tipo (preliquidación / oficial) — no aplica a Diferencia ni Facturación -->
      <div v-if="tab !== 'diferencia' && tab !== 'facturacion'" class="liq-tipo-toggle">
        <button class="liq-tipo-btn" :class="{ 'liq-tipo-btn--on': tipo === 'preliquidacion' }"
          @click="tipo = 'preliquidacion'">Preliq.</button>
        <button class="liq-tipo-btn" :class="{ 'liq-tipo-btn--on': tipo === 'oficial' }"
          @click="tipo = 'oficial'">Oficial</button>
      </div>

      <!-- Exportar a Excel el resumen del período (#7) -->
      <button v-if="tab !== 'diferencia' && tab !== 'facturacion'" class="liq-export" :disabled="exportando" @click="exportarExcel"
        v-tooltip.bottom="'Exportar el resumen del período a Excel'">
        <LoaderCircleIcon v-if="exportando" class="text-xs size-[1em] animate-spin" />
        <FileSpreadsheetIcon v-else class="text-xs size-[1em]" />
        <span>Excel</span>
      </button>

      <!-- Selector de período — aplica a todos los tabs (todos son espejo del Panel) -->
      <div class="liq-period">
        <button class="liq-period-btn" @click="stepMes(-1)" v-tooltip.bottom="'Mes anterior'">
          <ChevronLeftIcon class="text-xs size-[1em]" />
        </button>
        <span class="liq-period-label">{{ formatPeriodo(periodo) }}</span>
        <button class="liq-period-btn" :disabled="esMesActual" @click="stepMes(1)" v-tooltip.bottom="'Mes siguiente'">
          <ChevronRightIcon class="text-xs size-[1em]" />
        </button>
      </div>
    </div>

    <!-- ══ Contenido por tab — todos leen del Panel Contable del período ═══════ -->
    <ResumenPanel v-if="tab === 'resumen'" :periodo="periodo" :tipo="tipo" />
    <LiquidacionesListView v-else-if="tab === 'proyectos'" embedded :periodo="periodo" :tipo="tipo" />
    <LiquidacionesPorInversionistaView v-else-if="tab === 'inversionistas'" embedded :periodo="periodo" :tipo="tipo" />
    <DiferenciaPanel v-else-if="tab === 'diferencia'" :periodo="periodo" />
    <FacturacionPanel v-else-if="tab === 'facturacion'" :periodo="periodo" />

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ResumenPanel from './panels/ResumenPanel.vue'
import LiquidacionesListView from './LiquidacionesListView.vue'
import LiquidacionesPorInversionistaView from './LiquidacionesPorInversionistaView.vue'
import DiferenciaPanel from './panels/DiferenciaPanel.vue'
import FacturacionPanel from './panels/FacturacionPanel.vue'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { formatPeriodo, mesActualISO } from '~/features/liquidaciones/utils/liquidaciones'
import { ChartColumnIcon, ChevronLeftIcon, ChevronRightIcon, DollarSignIcon, FileSpreadsheetIcon, FolderIcon, LoaderCircleIcon, MoveHorizontalIcon, UsersIcon, ZapIcon } from '@lucide/vue'

const TABS = [
  { key: 'resumen', label: 'Resumen', icon: ChartColumnIcon },
  { key: 'proyectos', label: 'Proyectos', icon: FolderIcon },
  { key: 'inversionistas', label: 'Inversionistas', icon: UsersIcon },
  { key: 'diferencia', label: 'Diferencia', icon: MoveHorizontalIcon },
  { key: 'facturacion', label: 'Facturación', icon: ZapIcon },
]
const VALID = TABS.map(t => t.key)

const route = useRoute()
const router = useRouter()
const liquidacionesService = new LiquidacionesService()

function tabInicial() {
  if (VALID.includes(route.query.tab)) return route.query.tab
  if (route.query.tipo) return 'proyectos'   // sidebar: /liquidaciones?tipo=...
  return 'resumen'
}
const tab = ref(tabInicial())
watch(tab, (val) => {
  const q = { ...route.query }
  if (val === 'resumen') delete q.tab
  else q.tab = val
  // `tipo` (minigranja/autoconsumo) es un filtro SOLO de Proyectos. Si se deja en la
  // query al cambiar a otro tab, el watcher de route.query fuerza el tab de vuelta a
  // 'proyectos' y no deja abrir Resumen/Inversionistas/Diferencia. Se quita aquí.
  if (val !== 'proyectos') delete q.tipo
  router.replace({ query: q })
})

// Navegación desde el sidebar (?tipo= o ?tab=) estando ya montada la vista
watch(() => route.query, (q) => {
  if (q.tipo && tab.value !== 'proyectos') tab.value = 'proyectos'
  else if (VALID.includes(q.tab) && q.tab !== tab.value) tab.value = q.tab
})

// Período + tipo compartidos por los tabs (todos son espejo del Panel Contable).
// Arranca en el MES ANTERIOR: la liquidación/facturación es mes vencido, así que el
// mes actual casi siempre está vacío. El usuario puede avanzar con la flecha.
function mesAnteriorISO() {
  const [y, m] = mesActualISO().split('-').map(Number)
  const d = new Date(y, m - 2, 1)   // m es 1-indexado → m-2 = mes anterior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const periodo = ref(mesAnteriorISO())
const tipo = ref('preliquidacion')
const esMesActual = computed(() => periodo.value === mesActualISO())
function stepMes(delta) {
  const [y, m] = periodo.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  if (delta > 0 && next > mesActualISO()) return
  periodo.value = next
}

// ── Exportar Excel del resumen del período (#7) ─────────────────────────────────
const exportando = ref(false)
async function exportarExcel() {
  exportando.value = true
  try {
    const per = periodo.value.slice(0, 7)
    const data = await liquidacionesService.obtenerResumenPanel({ periodo: per, tipo: tipo.value })
    const proyectos = data.proyectos || []
    if (!proyectos.length) { toast.warning('Sin datos', { description: 'No hay paneles en el período', duration: 3000 }); return }
    const XLSX = await import('xlsx-js-style')
    const C = { morado: '915BD8', oscuro: '2C2039', lila: 'F4F1FA', blanco: 'FFFFFF', gris: '6B5A8A', borde: 'ECE4F5', neto: 'EAE0FB' }
    const COP = '"$"#,##0'
    const rows = [
      [`UNERGY — Liquidaciones ${tipo.value === 'oficial' ? 'Oficial' : 'Preliquidación'}`, '', '', '', '', ''],
      [`Período ${formatPeriodo(periodo.value)}`, '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Proyecto', 'Inversionista', '%', 'Ingresos', 'Costos', 'Valor a pagar'],
    ]
    for (const p of proyectos) {
      const invs = p.inversionistas || []
      if (!invs.length) { rows.push([p.proyecto, '—', null, p.ingresos_cop || 0, p.costos_cop || 0, p.valor_a_pagar_total || 0]); continue }
      // Ingresos/costos DIVIDIDOS por inversionista (desde grupos_totales), no solo
      // en la primera fila. costos = comercializacion + costos + facturas (con signo).
      invs.forEach((inv, i) => {
        const g = inv.grupos_totales || {}
        const ingInv = g.ingresos || 0
        const cosInv = (g.comercializacion || 0) + (g.costos || 0) + (g.facturas || 0)
        rows.push([
          i === 0 ? p.proyecto : '', inv.cliente_nombre || inv.nombre || '—',
          inv.porcentaje != null ? inv.porcentaje / 100 : null,
          ingInv, cosInv, inv.valor_a_pagar || 0,
        ])
      })
    }
    const totRow = rows.length
    const r = data.resumen || {}
    rows.push(['TOTAL', '', null, r.ingresos_total_cop || 0, r.costos_total_cop || 0, r.valor_a_pagar_total || 0])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const enc = (rr, c) => XLSX.utils.encode_cell({ r: rr, c })
    const setS = (rr, c, s) => { const ref = enc(rr, c); if (!ws[ref]) ws[ref] = { t: 's', v: '' }; ws[ref].s = s }
    const bf = { style: 'thin', color: { rgb: C.borde } }; const bAll = { top: bf, bottom: bf, left: bf, right: bf }
    setS(0, 0, { font: { bold: true, sz: 14, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.oscuro } } })
    setS(1, 0, { font: { sz: 10, color: { rgb: C.gris } } })
    for (let c = 0; c < 6; c++) setS(3, c, { font: { bold: true, sz: 10, color: { rgb: C.blanco } }, fill: { fgColor: { rgb: C.morado } }, alignment: { horizontal: c >= 2 ? 'right' : 'left' }, border: bAll })
    for (let rr = 4; rr < totRow; rr++) {
      for (let c = 0; c < 6; c++) {
        const st = { border: bAll, font: { color: { rgb: C.oscuro } } }
        if (c === 2) st.numFmt = '0.00%'
        if (c >= 3) { st.numFmt = COP; st.alignment = { horizontal: 'right' } }
        setS(rr, c, st)
      }
    }
    for (let c = 0; c < 6; c++) setS(totRow, c, { font: { bold: true, color: { rgb: C.oscuro } }, fill: { fgColor: { rgb: C.neto } }, numFmt: c >= 3 ? COP : undefined, alignment: { horizontal: c >= 2 ? 'right' : 'left' }, border: bAll })
    ws['!cols'] = [{ wch: 26 }, { wch: 40 }, { wch: 9 }, { wch: 16 }, { wch: 16 }, { wch: 18 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones')
    XLSX.writeFile(wb, `Liquidaciones_${tipo.value}_${per}.xlsx`)
  } catch (e) {
    toast.error('Error', { description: 'No se pudo exportar', duration: 3000 })
  } finally {
    exportando.value = false
  }
}

</script>

<style scoped>
.liq-page {
  min-height: 100%;
  background: var(--color-unergy-avena);
}
.liq-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 6px 14px;
  background: #fff;
  border-bottom: 1px solid #ECE7F2;
  box-shadow: 0 1px 3px rgba(28, 18, 50, 0.04);
  min-height: 44px;
  position: sticky;
  top: 0;
  z-index: 20;
}
.liq-topbar-title { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.liq-topbar-spacer { flex: 1; }

.liq-tabs {
  display: inline-flex;
  background: #F4F1FA;
  border: 1px solid #E5E2EC;
  border-radius: 8px;
  padding: 2px;
}
.liq-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #6B5A8A;
  border-radius: 6px;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.liq-tab svg { font-size: 12px; }
.liq-tab:hover:not(.liq-tab--on) { color: var(--color-unergy-deep); background: rgba(145,91,216,.08); }
.liq-tab--on { background: var(--color-unergy-purple); color: var(--color-unergy-avena); box-shadow: 0 1px 4px rgba(145,91,216,.3); }

.liq-tipo-toggle {
  display: inline-flex;
  background: #F4F1FA;
  border: 1px solid #E5E2EC;
  border-radius: 8px;
  padding: 2px;
}
.liq-tipo-btn {
  background: transparent; border: none;
  padding: 4px 10px; font-size: 11px; font-weight: 700;
  color: #6B5A8A; border-radius: 6px; cursor: pointer; transition: all .15s;
}
.liq-tipo-btn:hover:not(.liq-tipo-btn--on) { color: var(--color-unergy-deep); background: rgba(145,91,216,.08); }
.liq-tipo-btn--on { background: var(--color-unergy-purple); color: var(--color-unergy-avena); box-shadow: 0 1px 4px rgba(145,91,216,.3); }

.liq-export {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; font-size: 12px; font-weight: 700;
  border: 1px solid #1D6F42; background: #1D6F42; color: #fff;
  border-radius: 8px; cursor: pointer; transition: opacity .15s;
}
.liq-export:hover:not(:disabled) { opacity: .88; }
.liq-export:disabled { opacity: .5; cursor: default; }

.liq-period { display: inline-flex; align-items: center; gap: 6px; }
.liq-period-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid #E5E2EC; background: #fff; color: var(--color-unergy-purple-dark); cursor: pointer;
  transition: all .15s;
}
.liq-period-btn:hover:not(:disabled) { background: #F4F1FA; }
.liq-period-btn:disabled { opacity: .4; cursor: not-allowed; }
.liq-period-label { font-size: 13px; font-weight: 700; color: var(--color-unergy-deep); min-width: 78px; text-align: center; }
</style>
