<script setup lang="ts">
import {
  ChartColumnIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  FolderIcon,
  LoaderCircleIcon,
  MoveHorizontalIcon,
  UsersIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { LiquidacionesService } from '~/features/liquidaciones/services/liquidaciones'
import { formatPeriodo, mesActualISO } from '~/features/liquidaciones/utils/liquidaciones'
import ResumenPanel from './panels/ResumenPanel.vue'
import LiquidacionesListView from './LiquidacionesListView.vue'
import LiquidacionesPorInversionistaView from './LiquidacionesPorInversionistaView.vue'
import DiferenciaPanel from './panels/DiferenciaPanel.vue'
import FacturacionPanel from './panels/FacturacionPanel.vue'

const TABS = [
  { key: 'resumen', label: 'Resumen', icon: ChartColumnIcon },
  { key: 'proyectos', label: 'Proyectos', icon: FolderIcon },
  { key: 'inversionistas', label: 'Inversionistas', icon: UsersIcon },
  { key: 'diferencia', label: 'Diferencia', icon: MoveHorizontalIcon },
  { key: 'facturacion', label: 'Facturación', icon: ZapIcon },
] as const
type TabKey = (typeof TABS)[number]['key']
const VALID: readonly string[] = TABS.map((t) => t.key)

const route = useRoute()
const router = useRouter()
const liquidacionesService = new LiquidacionesService()

function tabInicial(): TabKey {
  const tab = route.query.tab
  if (typeof tab === 'string' && VALID.includes(tab)) return tab as TabKey
  if (route.query.tipo) return 'proyectos' // sidebar: /liquidaciones?tipo=...
  return 'resumen'
}
const tab = ref<TabKey>(tabInicial())
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
watch(
  () => route.query,
  (q) => {
    if (q.tipo && tab.value !== 'proyectos') tab.value = 'proyectos'
    else if (typeof q.tab === 'string' && VALID.includes(q.tab) && q.tab !== tab.value)
      tab.value = q.tab as TabKey
  },
)

// Período + tipo compartidos por los tabs (todos son espejo del Panel Contable).
// Arranca en el MES ANTERIOR: la liquidación/facturación es mes vencido, así que el
// mes actual casi siempre está vacío. El usuario puede avanzar con la flecha.
function mesAnteriorISO(): string {
  const [y, m] = mesActualISO().split('-').map(Number)
  const d = new Date(y!, m! - 2, 1) // m es 1-indexado → m-2 = mes anterior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const periodo = ref(mesAnteriorISO())
const tipo = ref<'preliquidacion' | 'oficial'>('preliquidacion')
const esMesActual = computed(() => periodo.value === mesActualISO())
function stepMes(delta: number) {
  const [y, m] = periodo.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + delta, 1)
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
    if (!proyectos.length) {
      toast.warning('Sin datos', { description: 'No hay paneles en el período', duration: 3000 })
      return
    }
    const XLSX = await import('xlsx-js-style')
    const C = {
      morado: '915BD8',
      oscuro: '2C2039',
      lila: 'F4F1FA',
      blanco: 'FFFFFF',
      gris: '6B5A8A',
      borde: 'ECE4F5',
      neto: 'EAE0FB',
    }
    const COP = '"$"#,##0'
    const rows: (string | number | null)[][] = [
      [
        `UNERGY — Liquidaciones ${tipo.value === 'oficial' ? 'Oficial' : 'Preliquidación'}`,
        '',
        '',
        '',
        '',
        '',
      ],
      [`Período ${formatPeriodo(periodo.value)}`, '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Proyecto', 'Inversionista', '%', 'Ingresos', 'Costos', 'Valor a pagar'],
    ]
    for (const p of proyectos) {
      const invs = p.inversionistas || []
      if (!invs.length) {
        rows.push([
          p.proyecto ?? '',
          '—',
          null,
          p.ingresos_cop || 0,
          p.costos_cop || 0,
          p.valor_a_pagar_total || 0,
        ])
        continue
      }
      // Ingresos/costos DIVIDIDOS por inversionista (desde grupos_totales), no solo
      // en la primera fila. costos = comercializacion + costos + facturas (con signo).
      invs.forEach((inv, i) => {
        const g = inv.grupos_totales || {}
        const ingInv = g.ingresos || 0
        const cosInv = (g.comercializacion || 0) + (g.costos || 0) + (g.facturas || 0)
        rows.push([
          i === 0 ? (p.proyecto ?? '') : '',
          inv.cliente_nombre || inv.nombre || '—',
          inv.porcentaje != null ? inv.porcentaje / 100 : null,
          ingInv,
          cosInv,
          inv.valor_a_pagar || 0,
        ])
      })
    }
    const totRow = rows.length
    const r = data.resumen || {}
    rows.push([
      'TOTAL',
      '',
      null,
      r.ingresos_total_cop || 0,
      r.costos_total_cop || 0,
      r.valor_a_pagar_total || 0,
    ])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const enc = (rr: number, c: number) => XLSX.utils.encode_cell({ r: rr, c })
    const setS = (rr: number, c: number, s: Record<string, unknown>) => {
      const ref = enc(rr, c)
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = s
    }
    const bf = { style: 'thin' as const, color: { rgb: C.borde } }
    const bAll = { top: bf, bottom: bf, left: bf, right: bf }
    setS(0, 0, {
      font: { bold: true, sz: 14, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.oscuro } },
    })
    setS(1, 0, { font: { sz: 10, color: { rgb: C.gris } } })
    for (let c = 0; c < 6; c++)
      setS(3, c, {
        font: { bold: true, sz: 10, color: { rgb: C.blanco } },
        fill: { fgColor: { rgb: C.morado } },
        alignment: { horizontal: c >= 2 ? 'right' : 'left' },
        border: bAll,
      })
    for (let rr = 4; rr < totRow; rr++) {
      for (let c = 0; c < 6; c++) {
        const st: Record<string, unknown> = { border: bAll, font: { color: { rgb: C.oscuro } } }
        if (c === 2) st.numFmt = '0.00%'
        if (c >= 3) {
          st.numFmt = COP
          st.alignment = { horizontal: 'right' }
        }
        setS(rr, c, st)
      }
    }
    for (let c = 0; c < 6; c++)
      setS(totRow, c, {
        font: { bold: true, color: { rgb: C.oscuro } },
        fill: { fgColor: { rgb: C.neto } },
        numFmt: c >= 3 ? COP : undefined,
        alignment: { horizontal: c >= 2 ? 'right' : 'left' },
        border: bAll,
      })
    ws['!cols'] = [{ wch: 26 }, { wch: 40 }, { wch: 9 }, { wch: 16 }, { wch: 16 }, { wch: 18 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones')
    XLSX.writeFile(wb, `Liquidaciones_${tipo.value}_${per}.xlsx`)
  } catch (e) {
    toast.error('Error', {
      description: normalizeError(e).message || 'No se pudo exportar',
      duration: 3000,
    })
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <div class="min-h-full bg-muted/10">
    <!-- Topbar compacto con tabs -->
    <div
      class="sticky top-0 z-20 flex min-h-11 flex-wrap items-center gap-3 border-b bg-card px-3.5 py-1.5 shadow-sm"
    >
      <div class="flex shrink-0 items-center gap-2">
        <ZapIcon class="size-4 text-primary" />
        <h2 class="text-base font-bold text-foreground">Liquidaciones</h2>
        <span class="hidden text-xs text-muted-foreground xl:inline"
          >· Estado financiero por proyecto y período</span
        >
      </div>

      <GTabs :model-value="tab" @update:model-value="(v) => (tab = v as TabKey)">
        <GTabsList>
          <GTabsTrigger v-for="t in TABS" :key="t.key" :value="t.key" class="gap-1.5">
            <component :is="t.icon" class="size-3.5" />
            {{ t.label }}
          </GTabsTrigger>
        </GTabsList>
      </GTabs>

      <div class="flex-1" />

      <!-- Tipo (preliquidación / oficial) — no aplica a Diferencia ni Facturación -->
      <ToggleGroup
        v-if="tab !== 'diferencia' && tab !== 'facturacion'"
        v-model="tipo"
        type="single"
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="preliquidacion">Preliq.</ToggleGroupItem>
        <ToggleGroupItem value="oficial">Oficial</ToggleGroupItem>
      </ToggleGroup>

      <!-- Exportar a Excel el resumen del período (#7) -->
      <Button
        v-if="tab !== 'diferencia' && tab !== 'facturacion'"
        variant="outline"
        size="sm"
        :disabled="exportando"
        @click="exportarExcel"
      >
        <LoaderCircleIcon v-if="exportando" class="size-4 animate-spin" />
        <FileSpreadsheetIcon v-else class="size-4" />
        Excel
      </Button>

      <!-- Selector de período — aplica a todos los tabs (todos son espejo del Panel) -->
      <div class="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          class="size-7"
          title="Mes anterior"
          @click="stepMes(-1)"
        >
          <ChevronLeftIcon class="size-3.5" />
        </Button>
        <span class="min-w-19.5 text-center text-sm font-bold text-foreground">{{
          formatPeriodo(periodo)
        }}</span>
        <Button
          variant="outline"
          size="icon"
          class="size-7"
          :disabled="esMesActual"
          title="Mes siguiente"
          @click="stepMes(1)"
        >
          <ChevronRightIcon class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- Contenido por tab — todos leen del Panel Contable del período -->
    <ResumenPanel v-if="tab === 'resumen'" :periodo="periodo" :tipo="tipo" />
    <LiquidacionesListView
      v-else-if="tab === 'proyectos'"
      embedded
      :periodo="periodo"
      :tipo="tipo"
    />
    <LiquidacionesPorInversionistaView
      v-else-if="tab === 'inversionistas'"
      embedded
      :periodo="periodo"
      :tipo="tipo"
    />
    <DiferenciaPanel v-else-if="tab === 'diferencia'" :periodo="periodo" />
    <FacturacionPanel v-else-if="tab === 'facturacion'" :periodo="periodo" />
  </div>
</template>
