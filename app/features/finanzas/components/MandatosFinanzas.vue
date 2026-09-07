<template>
  <div class="mf-wrap">
    <div class="mf-top">
      <div>
        <h1>Mandatos</h1>
        <div class="mf-sub">Estado de firma de mandatos de ingresos y costos · {{ periodoLabel }}</div>
      </div>
      <div class="mf-period">
        <button class="mf-arrow" @click="stepMes(-1)" title="Mes anterior"><ChevronLeftIcon class="size-[1em]" /></button>
        <span class="mf-perlabel">{{ periodoLabel }}</span>
        <button class="mf-arrow" :disabled="esMesActual" @click="stepMes(1)" title="Mes siguiente"><ChevronRightIcon class="size-[1em]" /></button>
      </div>
    </div>

    <div class="mf-tabs">
      <button :class="['mf-tab', { act: tipo === 'ingreso' }]" @click="setTipo('ingreso')">Ingresos</button>
      <button :class="['mf-tab', { act: tipo === 'costo' }]" @click="setTipo('costo')">Costos</button>
    </div>

    <div class="mf-cards">
      <div class="mf-card"><div class="mf-cn">{{ met.total || 0 }}</div><div class="mf-cl">Total</div></div>
      <div class="mf-card ok"><div class="mf-cn">{{ met.firmados || 0 }}</div><div class="mf-cl">Firmados</div></div>
      <div class="mf-card warn"><div class="mf-cn">{{ met.falta_firma || 0 }}</div><div class="mf-cl">Falta firma</div></div>
      <div class="mf-card com"><div class="mf-cn">{{ met.con_comentarios || 0 }}</div><div class="mf-cl">Con comentarios</div></div>
    </div>

    <div class="mf-filters">
      <input v-model="q" class="mf-search" placeholder="Buscar proyecto / tercero / CMU" />
      <label class="mf-chk"><input type="checkbox" v-model="soloFalta" /> Solo falta firma</label>
      <span class="mf-count">{{ filtrados.length }} / {{ mandatos.length }}</span>
    </div>

    <div class="mf-tablewrap">
      <table class="mf-table">
        <thead>
          <tr>
            <th>CMU</th><th>Proyecto</th><th>Tercero</th><th>Estado</th>
            <th>Envío</th><th>Firma</th><th>Comentario</th><th>PDF</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtrados" :key="m.id">
            <td>{{ m.cmu || '—' }}<span v-if="m.cmu_anterior" class="mf-prev"> (antes {{ m.cmu_anterior }})</span></td>
            <td>{{ m.proyecto }}</td>
            <td>{{ m.tercero || '—' }}</td>
            <td><span :class="['mf-badge', m.estado]">{{ estadoLabel(m.estado) }}</span></td>
            <td>{{ m.fecha_envio || '—' }}</td>
            <td>{{ m.fecha_firma || '—' }}</td>
            <td class="mf-com">{{ m.comentario || '' }}</td>
            <td><a v-if="m.drive_url" :href="m.drive_url" target="_blank" rel="noopener">Ver</a><span v-else>—</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="mf-empty">Cargando…</div>
      <div v-else-if="!filtrados.length" class="mf-empty">Sin mandatos para este período.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { MandatosFinanzasService } from '~/features/finanzas/services/mandatos-finanzas'
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'

const mandatosFinanzasService = new MandatosFinanzasService()

function mesISO (delta = 0) {
  const n = new Date()
  const d = new Date(n.getFullYear(), n.getMonth() + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const periodo = ref(mesISO(-1))
const tipo = ref('ingreso')
const mandatos = ref([])
const resumen = ref({ ingreso: {}, costo: {} })
const loading = ref(false)
const q = ref('')
const soloFalta = ref(false)

const periodoLabel = computed(() => {
  const [y, m] = periodo.value.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
})
const esMesActual = computed(() => periodo.value === mesISO(0))
const met = computed(() => resumen.value[tipo.value] || { total: 0, firmados: 0, falta_firma: 0, con_comentarios: 0 })
const filtrados = computed(() => {
  const s = q.value.trim().toLowerCase()
  return mandatos.value.filter((m) => {
    if (soloFalta.value && m.estado !== 'sin_firma') return false
    if (s && !`${m.cmu || ''} ${m.proyecto || ''} ${m.tercero || ''}`.toLowerCase().includes(s)) return false
    return true
  })
})
const estadoLabel = (e) => ({ sin_firma: 'Falta firma', firmado: 'Firmado', con_comentarios: 'Con comentarios' }[e] || e)

function stepMes (d) {
  const [y, m] = periodo.value.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  const next = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
  if (d > 0 && next > mesISO(0)) return
  periodo.value = next
  cargar()
}
function setTipo (t) { tipo.value = t; cargarLista() }

async function cargarLista () {
  loading.value = true
  try {
    const data = await mandatosFinanzasService.listar({ periodo: periodo.value, tipo: tipo.value })
    mandatos.value = data.mandatos || []
  } finally {
    loading.value = false
  }
}
async function cargarResumen () {
  resumen.value = await mandatosFinanzasService.obtenerResumen(periodo.value)
}
async function cargar () { await Promise.all([cargarLista(), cargarResumen()]) }
onMounted(cargar)
</script>

<style scoped>
.mf-wrap { padding: 4px 2px; }
.mf-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.mf-top h1 { font-size: 20px; font-weight: 600; color: var(--color-unergy-deep); margin: 0; }
.mf-sub { font-size: 12.5px; color: #6b6478; margin-top: 2px; }
.mf-period { display: inline-flex; align-items: center; gap: 6px; }
.mf-arrow { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid #ddd6e8; background: #fff; color: var(--color-unergy-purple); cursor: pointer; }
.mf-arrow:hover:not(:disabled) { background: #f5f2fa; }
.mf-arrow:disabled { opacity: .4; cursor: not-allowed; }
.mf-perlabel { font-size: 13px; font-weight: 700; color: var(--color-unergy-deep); min-width: 92px; text-align: center; }
.mf-tabs { display: flex; gap: 4px; margin: 16px 0 14px; border-bottom: 1px solid #ddd6e8; }
.mf-tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 14px; font-size: 13px; color: #6b6478; cursor: pointer; }
.mf-tab.act { color: var(--color-unergy-deep); border-bottom-color: var(--color-unergy-purple); font-weight: 600; }
.mf-cards { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.mf-card { flex: 1; min-width: 120px; background: #fff; border: 1px solid #ece7f2; border-radius: 10px; padding: 12px 14px; }
.mf-card .mf-cn { font-size: 22px; font-weight: 700; color: var(--color-unergy-deep); }
.mf-card .mf-cl { font-size: 11.5px; color: #6b6478; margin-top: 2px; }
.mf-card.ok .mf-cn { color: #10B981; }
.mf-card.warn .mf-cn { color: #d35400; }
.mf-card.com .mf-cn { color: var(--color-unergy-purple); }
.mf-filters { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.mf-search { font-size: 13px; padding: 7px 10px; border: 1px solid #ddd6e8; border-radius: 8px; width: 280px; }
.mf-chk { font-size: 12.5px; color: var(--color-unergy-deep); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.mf-count { font-size: 12px; color: #9a93a8; margin-left: auto; }
.mf-tablewrap { overflow-x: auto; border: 1px solid #ece7f2; border-radius: 10px; }
.mf-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.mf-table th { text-align: left; background: #faf7ff; color: #6b6478; font-weight: 600; padding: 9px 12px; border-bottom: 1px solid #ece7f2; white-space: nowrap; }
.mf-table td { padding: 8px 12px; border-bottom: 1px solid #f4f1fa; color: var(--color-unergy-deep); vertical-align: top; }
.mf-com { max-width: 280px; color: #6b6478; }
.mf-prev { color: #9a93a8; font-size: 11px; }
.mf-badge { display: inline-block; padding: 2px 8px; border-radius: 7px; font-size: 11px; font-weight: 600; }
.mf-badge.firmado { background: #e7f8f1; color: #10B981; }
.mf-badge.sin_firma { background: #fdf1e7; color: #d35400; }
.mf-badge.con_comentarios { background: #eee7fb; color: var(--color-unergy-purple); }
.mf-empty { padding: 24px; text-align: center; color: #9a93a8; font-size: 13px; }
</style>
