<template>
  <div>
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="m-0 text-xl font-semibold text-unergy-deep">Mandatos</h1>
        <div class="mt-0.5 text-xs text-muted-foreground">Estado de firma de mandatos de ingresos y costos · {{ periodoLabel }}</div>
      </div>
      <div class="inline-flex items-center gap-1.5">
        <button :class="CLS_FLECHA" @click="stepMes(-1)" title="Mes anterior"><ChevronLeftIcon class="size-4" /></button>
        <span class="min-w-23 text-center text-sm font-bold text-unergy-deep">{{ periodoLabel }}</span>
        <button :class="CLS_FLECHA" :disabled="esMesActual" @click="stepMes(1)" title="Mes siguiente"><ChevronRightIcon class="size-4" /></button>
      </div>
    </div>

    <div class="mt-4 mb-3.5 flex gap-1 border-b border-border">
      <button v-for="t in TIPOS" :key="t.key" :class="[CLS_TAB, tipo === t.key ? 'border-unergy-purple font-semibold text-unergy-deep' : 'border-transparent text-muted-foreground']" @click="setTipo(t.key)">{{ t.label }}</button>
    </div>

    <div class="mb-3.5 flex flex-wrap gap-2.5">
      <div v-for="c in tarjetas" :key="c.label" class="min-w-30 flex-1 rounded-lg border border-border bg-card px-3.5 py-3">
        <div class="text-2xl font-bold" :class="c.color">{{ c.valor }}</div>
        <div class="mt-0.5 text-xs text-muted-foreground">{{ c.label }}</div>
      </div>
    </div>

    <div class="mb-2.5 flex items-center gap-3">
      <input v-model="q" class="w-70 rounded-lg border border-border px-2.5 py-1.5 text-sm" placeholder="Buscar proyecto / tercero / CMU" />
      <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-unergy-deep"><input type="checkbox" v-model="soloFalta" /> Solo falta firma</label>
      <span class="ml-auto text-xs text-muted-foreground">{{ filtrados.length }} / {{ mandatos.length }}</span>
    </div>

    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th v-for="h in COLUMNAS" :key="h" class="border-b border-border bg-muted px-3 py-2 text-left font-semibold whitespace-nowrap text-muted-foreground">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtrados" :key="m.id">
            <td :class="CLS_TD">{{ m.cmu || '—' }}<span v-if="m.cmu_anterior" class="text-xs text-muted-foreground"> (antes {{ m.cmu_anterior }})</span></td>
            <td :class="CLS_TD">{{ m.proyecto }}</td>
            <td :class="CLS_TD">{{ m.tercero || '—' }}</td>
            <td :class="CLS_TD"><span class="inline-block rounded-md px-2 py-0.5 text-xs font-semibold" :class="BADGE_ESTADO[m.estado]">{{ estadoLabel(m.estado) }}</span></td>
            <td :class="CLS_TD">{{ m.fecha_envio || '—' }}</td>
            <td :class="CLS_TD">{{ m.fecha_firma || '—' }}</td>
            <td :class="[CLS_TD, 'max-w-70 text-muted-foreground']">{{ m.comentario || '' }}</td>
            <td :class="CLS_TD"><a v-if="m.drive_url" :href="m.drive_url" target="_blank" rel="noopener">Ver</a><span v-else>—</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="p-6 text-center text-sm text-muted-foreground">Cargando…</div>
      <div v-else-if="!filtrados.length" class="p-6 text-center text-sm text-muted-foreground">Sin mandatos para este período.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { MandatosFinanzasService } from '~/features/finanzas/services/mandatos-finanzas'
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'

const mandatosFinanzasService = new MandatosFinanzasService()

const TIPOS = [{ key: 'ingreso', label: 'Ingresos' }, { key: 'costo', label: 'Costos' }]
const COLUMNAS = ['CMU', 'Proyecto', 'Tercero', 'Estado', 'Envío', 'Firma', 'Comentario', 'PDF']
const CLS_FLECHA = 'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-unergy-purple hover:not-disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-40'
const CLS_TAB = 'cursor-pointer border-b-2 px-3.5 py-2 text-sm'
const CLS_TD = 'border-b border-border px-3 py-2 align-top text-unergy-deep'
const BADGE_ESTADO = {
  firmado: 'bg-success/15 text-success',
  sin_firma: 'bg-warning/15 text-warning',
  con_comentarios: 'bg-unergy-purple/10 text-unergy-purple'
}

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
const tarjetas = computed(() => [
  { label: 'Total', valor: met.value.total || 0, color: 'text-unergy-deep' },
  { label: 'Firmados', valor: met.value.firmados || 0, color: 'text-success' },
  { label: 'Falta firma', valor: met.value.falta_firma || 0, color: 'text-warning' },
  { label: 'Con comentarios', valor: met.value.con_comentarios || 0, color: 'text-unergy-purple' }
])
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
