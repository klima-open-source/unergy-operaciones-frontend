<template>
  <div class="p-4 sm:p-5 space-y-4">
    <ProgressSpinner v-if="loading" class="block mx-auto my-10" />

    <template v-else>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="text-sm font-bold" style="color:var(--color-unergy-deep)">Preliquidación vs Oficial · {{ formatPeriodo(periodo) }}</span>
        <span class="text-[11px]" style="color:#9b8fb0">La diferencia (oficial − preliquidación) es lo que se liquida oficialmente</span>
      </div>

      <div v-if="!diff.tiene_oficial" class="rounded-lg px-3 py-3 text-xs text-center"
        style="background:#faf7ff; border:1px solid #e3d5f5; color:#6b5a8a">
        <ClockIcon class="size-[1em]" style="font-size:20px; display:block; margin-bottom:6px; color:var(--color-unergy-purple)" />
        Aún no hay liquidación <b>oficial</b> para comparar en {{ formatPeriodo(periodo) }}.<br />
        Carga el ER oficial en Panel Contable (pestaña Oficial).
      </div>

      <template v-else>
        <!-- Resumen global -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div v-for="k in kpis" :key="k.label" class="bg-white rounded-xl shadow-sm p-4 border" style="border-color:#e8e0f0">
            <p class="text-[11px] uppercase tracking-wide font-semibold" style="color:#6b5a8a">{{ k.label }}</p>
            <p class="text-xl font-bold mt-1" :style="{ color: k.color }">{{ arrow(k.arrowVal) }}{{ fmtCompact(k.value) }}</p>
          </div>
        </div>

        <!-- Por proyecto (desplegable) -->
        <div v-for="proy in diff.proyectos" :key="proy.proyecto_id" class="bg-white rounded-xl shadow-sm border overflow-hidden" style="border-color:#e8e0f0">
          <!-- Encabezado clickeable -->
          <div class="px-4 py-2.5 flex items-center gap-2 border-b cursor-pointer select-none hover:bg-gray-50"
            style="border-color:#f0ebf6" @click="toggle(proy.proyecto_id)">
            <ChevronDownIcon v-if="abiertos.has(proy.proyecto_id)" class="text-xs size-[1em]" style="color:#9b8fb0" />
            <ChevronRightIcon v-else class="text-xs size-[1em]" style="color:#9b8fb0" />
            <h3 class="text-sm font-bold" style="color:var(--color-unergy-deep)">{{ proy.proyecto_nombre }}</h3>
            <span class="ml-auto text-xs font-mono">
              <span style="color:#9b8fb0">Preliq</span> {{ fmtCompact(proy.utilidad_pre) }}
              <span style="color:#9b8fb0" class="ml-2">Oficial</span> {{ proy.tiene_oficial ? fmtCompact(proy.utilidad_oficial) : '—' }}
              <span class="ml-2 font-semibold" :style="{ color: colorDif(proy.utilidad_dif) }">{{ arrow(proy.utilidad_dif) }}{{ fmtCompact(proy.utilidad_dif) }}</span>
            </span>
          </div>

          <div v-if="abiertos.has(proy.proyecto_id)" class="px-3 py-2">
            <!-- Toggle 100% | Por inversionista -->
            <div class="flex justify-end mb-2">
              <div class="dif-toggle">
                <button class="dif-toggle-btn" :class="{ on: vista(proy.proyecto_id) === '100' }" @click="setVista(proy.proyecto_id, '100')">100%</button>
                <button class="dif-toggle-btn" :class="{ on: vista(proy.proyecto_id) === 'inv' }" @click="setVista(proy.proyecto_id, 'inv')">Por inversionista</button>
              </div>
            </div>

            <!-- Vista 100% (total del proyecto, sumando inversionistas) -->
            <div v-if="vista(proy.proyecto_id) === '100'">
              <DiffTabla :grupos="GRUPOS" :lineas="lineas100(proy)"
                :utilidad="{ pre: proy.utilidad_pre, ofi: proy.utilidad_oficial, dif: proy.utilidad_dif }" />
            </div>

            <!-- Vista por inversionista -->
            <div v-else>
              <div v-for="inv in proy.inversionistas" :key="inv.proyecto_inversionista_id || inv.nombre" class="mb-3">
                <p class="text-[11px] font-semibold mb-1" style="color:#6b5a8a">{{ inv.nombre }} · {{ (inv.porcentaje ?? 0).toFixed(2) }}%</p>
                <DiffTabla :grupos="GRUPOS" :lineas="inv.lineas || []"
                  :utilidad="{ pre: inv.utilidad_pre, ofi: inv.utilidad_oficial, dif: inv.utilidad_dif }" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, h } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import { fmtCOP, fmtCompact, formatPeriodo } from '~/features/liquidaciones/utils/liquidaciones'
import { ChevronDownIcon, ChevronRightIcon, ClockIcon } from '@lucide/vue'

const props = defineProps({ periodo: { type: String, required: true } })

const panelContableService = new PanelContableService()

const loading = ref(false)
const diff = ref({ proyectos: [], resumen: {}, tiene_oficial: false })
const abiertos = reactive(new Set())
const vistas = reactive({})   // proyecto_id → '100' | 'inv'

const GRUPOS = [
  { key: 'ingresos', keys: ['ingresos'], label: 'Ingresos' },
  { key: 'comercializacion', keys: ['comercializacion'], label: 'Comercialización XM' },
  { key: 'costos', keys: ['costos', 'facturas'], label: 'Costos operativos' },
]

function toggle (pid) { abiertos.has(pid) ? abiertos.delete(pid) : abiertos.add(pid) }
const vista = (pid) => vistas[pid] || '100'
function setVista (pid, v) { vistas[pid] = v }

const arrow = (v) => (v == null || v === 0 ? '' : (v > 0 ? '▲ ' : '▼ '))
const colorDif = (v) => (!v ? '#6b5a8a' : (v > 0 ? '#10B981' : '#D64455'))

// Suma las líneas de todos los inversionistas por (grupo, concepto) → vista 100%.
function lineas100 (proy) {
  const map = new Map()   // 'grupo|concepto' → linea agregada
  for (const inv of (proy.inversionistas || [])) {
    for (const ln of (inv.lineas || [])) {
      const k = ln.grupo + '|' + ln.concepto
      let row = map.get(k)
      if (!row) { row = { grupo: ln.grupo, concepto: ln.concepto, preliquidacion: null, oficial: null }; map.set(k, row) }
      if (ln.preliquidacion != null) row.preliquidacion = (row.preliquidacion || 0) + ln.preliquidacion
      if (ln.oficial != null) row.oficial = (row.oficial || 0) + ln.oficial
    }
  }
  return [...map.values()].map(r => {
    const dif = (r.preliquidacion != null && r.oficial != null) ? r.oficial - r.preliquidacion : null
    const pct = (dif != null && r.preliquidacion) ? dif / Math.abs(r.preliquidacion) * 100 : null
    return { ...r, diferencia: dif, pct_variacion: pct }
  })
}

const kpis = computed(() => {
  const r = diff.value.resumen || {}
  return [
    { label: 'Utilidad estimada (preliq.)', value: r.utilidad_estimada || 0, color: '#2C2039', arrowVal: 0 },
    { label: 'Utilidad real (oficial)', value: r.utilidad_real || 0, color: '#2C2039', arrowVal: 0 },
    { label: 'Diferencia (se liquida)', value: r.diferencia || 0, color: colorDif(r.diferencia || 0), arrowVal: r.diferencia || 0 },
  ]
})

async function load () {
  const per = (props.periodo || '').slice(0, 7)
  if (!per) return
  loading.value = true
  try {
    const data = await panelContableService.obtenerDiferencia(per)
    diff.value = data || { proyectos: [], resumen: {}, tiene_oficial: false }
    // Abrir el primero por comodidad.
    abiertos.clear()
    if (diff.value.proyectos?.[0]) abiertos.add(diff.value.proyectos[0].proyecto_id)
  } catch {
    diff.value = { proyectos: [], resumen: {}, tiene_oficial: false }
  } finally {
    loading.value = false
  }
}

// ── Tabla de diferencia (render inline con h para no crear otro archivo) ──────────
const DiffTabla = {
  props: { grupos: Array, lineas: Array, utilidad: Object },
  setup (p) {
    const lineasDe = (g) => (p.lineas || []).filter(l => g.keys.includes(l.grupo))
    const cell = (v) => v != null ? fmtCOP(v) : '—'
    const th = (t, extra = {}) => h('th', { class: 'px-2 py-1 font-medium', style: { color: '#9b8fb0', ...extra } }, t)
    return () => {
      const rows = []
      for (const g of p.grupos) {
        const ls = lineasDe(g)
        if (!ls.length) continue
        rows.push(h('tr', {}, [h('td', { colspan: 5, class: 'px-2 pt-2 pb-0.5 font-bold uppercase tracking-wide', style: { color: '#6E3FB8', fontSize: '10px' } }, g.label)]))
        for (const ln of ls) {
          rows.push(h('tr', { class: 'border-t', style: { borderColor: '#f7f3fc' } }, [
            h('td', { class: 'px-2 py-1', style: { color: '#5b5470' } }, ln.concepto),
            h('td', { class: 'px-2 py-1 text-right font-mono', style: { color: '#6b5a8a' } }, cell(ln.preliquidacion)),
            h('td', { class: 'px-2 py-1 text-right font-mono', style: { color: '#6b5a8a' } }, cell(ln.oficial)),
            h('td', { class: 'px-2 py-1 text-right font-mono font-semibold', style: { color: colorDif(ln.diferencia) } }, arrow(ln.diferencia) + cell(ln.diferencia)),
            h('td', { class: 'px-2 py-1 text-right font-mono', style: { color: colorDif(ln.diferencia) } }, ln.pct_variacion != null ? ln.pct_variacion.toFixed(1) + '%' : '—'),
          ]))
        }
      }
      const u = p.utilidad || {}
      rows.push(h('tr', { class: 'border-t-2', style: { borderColor: '#915BD8', background: 'rgba(145,91,216,0.06)' } }, [
        h('td', { class: 'px-2 py-1.5 font-extrabold', style: { color: '#2C2039' } }, 'Valor a pagar (utilidad)'),
        h('td', { class: 'px-2 py-1.5 text-right font-mono font-bold', style: { color: '#2C2039' } }, cell(u.pre)),
        h('td', { class: 'px-2 py-1.5 text-right font-mono font-bold', style: { color: '#2C2039' } }, cell(u.ofi)),
        h('td', { class: 'px-2 py-1.5 text-right font-mono font-extrabold', style: { color: colorDif(u.dif) } }, arrow(u.dif) + cell(u.dif)),
        h('td', {}),
      ]))
      return h('div', { class: 'overflow-x-auto' }, [
        h('table', { class: 'w-full text-xs' }, [
          h('thead', {}, [h('tr', { class: 'text-left', style: { background: '#faf7ff' } }, [
            th('Concepto'), th('Preliquidación', { textAlign: 'right' }), th('Oficial', { textAlign: 'right' }),
            th('Diferencia', { textAlign: 'right' }), th('%', { textAlign: 'right' }),
          ])]),
          h('tbody', {}, rows),
        ]),
      ])
    }
  },
}

watch(() => props.periodo, load)
onMounted(load)
</script>

<style scoped>
.dif-toggle { display:inline-flex; background:#F4F1FA; border:1px solid #E5E2EC; border-radius:8px; padding:2px; }
.dif-toggle-btn { background:transparent; border:none; padding:4px 10px; font-size:11px; font-weight:700; color:#6B5A8A; border-radius:6px; cursor:pointer; }
.dif-toggle-btn.on { background:var(--color-unergy-purple); color:var(--color-unergy-avena); }
</style>
