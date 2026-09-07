<template>
  <div v-if="loading" class="flex items-center justify-center py-16">
    <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color:var(--color-unergy-purple);" />
  </div>

  <div v-else-if="panel" class="space-y-5">
    <!-- KPIs -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="kpi-card">
        <p class="kpi-valor">{{ panel.kpis.num_plantas }}</p>
        <p class="kpi-label">Plantas con nosotros</p>
      </div>
      <div class="kpi-card">
        <p class="kpi-valor">{{ panel.kpis.contratos_activos }}</p>
        <p class="kpi-label">Contratos activos</p>
      </div>
      <div class="kpi-card">
        <p class="kpi-valor">{{ panel.kpis.servicios.length }}</p>
        <p class="kpi-label">Servicios</p>
      </div>
      <div class="kpi-card">
        <p class="kpi-valor text-base pt-1.5">{{ fmtFecha(panel.kpis.proximo_vencimiento) }}</p>
        <p class="kpi-label">Próximo vencimiento</p>
      </div>
    </div>

    <!-- Plantas contratadas -->
    <section class="seccion">
      <header class="seccion-head">
        <SunIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple);" />
        <span>Plantas contratadas</span>
        <span class="badge">{{ panel.plantas.length }}</span>
      </header>
      <div class="p-4">
        <p v-if="!panel.plantas.length" class="text-sm text-center py-4" style="color:#9b89b5;">
          Sin plantas vinculadas.
        </p>
        <div v-else class="space-y-2">
          <div v-for="p in panel.plantas" :key="p.proyecto_id"
            class="rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
            :style="{ border: '1px solid #ece7f2', background: p.semaforo && p.semaforo !== 'vigente' ? SEMAFORO[p.semaforo].bg : 'white' }">
            <div class="min-w-0">
              <p class="text-sm font-semibold truncate" style="color:var(--color-unergy-deep);">{{ p.nombre }}</p>
              <p class="text-xs" style="color:#6b5a8a;">
                {{ p.potencia_kwp !== null ? p.potencia_kwp + ' kWp' : '—' }} ·
                fin contrato: {{ fmtFecha(p.fecha_fin_contrato) }}
                <span v-if="p.participacion_actual !== null"> · participación {{ p.participacion_actual }}%</span>
              </p>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span v-for="s in p.servicios" :key="s" class="chip">{{ servicioLabel(s) }}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                :style="renovStyle(p.renovacion_automatica)">
                {{ renovLabel(p.renovacion_automatica) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Condiciones económicas + histórico participación -->
    <section class="seccion">
      <header class="seccion-head">
        <DollarSignIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple);" />
        <span>Condiciones económicas</span>
        <span class="badge">{{ panel.condiciones.length }}</span>
      </header>
      <div class="p-4 space-y-4">
        <p v-if="!panel.condiciones.length" class="text-sm text-center py-2" style="color:#9b89b5;">
          Sin condiciones registradas.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[10px] uppercase tracking-wide" style="color:#9b89b5;">
                <th class="py-1.5 pr-3">Proyecto</th>
                <th class="py-1.5 pr-3">Servicio</th>
                <th class="py-1.5 pr-3 text-right">Tarifa repr.</th>
                <th class="py-1.5 pr-3 text-right">Tarifa CGM</th>
                <th class="py-1.5 pr-3">Índice</th>
                <th class="py-1.5">Indexación</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in panel.condiciones" :key="c.contrato_id" class="border-t" style="border-color:#f3eefa;">
                <td class="py-2 pr-3 font-medium" style="color:var(--color-unergy-deep);">{{ fmt(c.proyecto_nombre) }}</td>
                <td class="py-2 pr-3">{{ servicioLabel(c.servicio) }}</td>
                <td class="py-2 pr-3 text-right tabular-nums">{{ fmt(c.tarifa_representacion) }}</td>
                <td class="py-2 pr-3 text-right tabular-nums">{{ fmt(c.tarifa_cgm) }}</td>
                <td class="py-2 pr-3">{{ fmt(c.indice_indexacion) }}</td>
                <td class="py-2">{{ fmtFecha(c.fecha_indexacion) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="historicoPorProyecto.length" class="space-y-1.5">
          <p class="dato-label mb-2">Histórico % de participación</p>
          <details v-for="g in historicoPorProyecto" :key="g.proyecto_id"
            class="rounded-lg px-3 py-2" style="border:1px solid #ece7f2;">
            <summary class="flex items-center justify-between cursor-pointer list-none">
              <span class="text-sm font-medium" style="color:var(--color-unergy-deep);">{{ fmt(g.nombre) }}</span>
              <span class="flex items-center gap-3">
                <ParticipacionSparkline :puntos="g.filas.map(f => ({ fecha: f.fecha_inicio, porcentaje: f.porcentaje }))" />
                <span class="text-sm font-bold tabular-nums" style="color:var(--color-unergy-purple);">{{ fmt(g.actual) }}<template v-if="g.actual !== '—'">%</template></span>
              </span>
            </summary>
            <table class="w-full text-xs mt-2">
              <tbody>
                <tr v-for="(f, i) in g.filas" :key="i" class="border-t" style="border-color:#f3eefa;">
                  <td class="py-1.5">{{ fmtFecha(f.fecha_inicio) }} → {{ f.fecha_fin ? fmtFecha(f.fecha_fin) : 'vigente' }}</td>
                  <td class="py-1.5 text-right tabular-nums font-medium">{{ fmt(f.porcentaje) }}%</td>
                </tr>
              </tbody>
            </table>
          </details>
        </div>
      </div>
    </section>

    <!-- Contratos y documentos -->
    <section class="seccion">
      <header class="seccion-head">
        <FileIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple);" />
        <span>Contratos y documentos</span>
        <span class="badge">{{ panel.contratos.length }}</span>
      </header>
      <div class="p-4">
        <p v-if="!panel.contratos.length" class="text-sm text-center py-4" style="color:#9b89b5;">
          Sin contratos registrados.
        </p>
        <div v-else class="space-y-2">
          <div v-for="c in panel.contratos" :key="`${c.fuente}-${c.id}`"
            class="rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
            style="border:1px solid #ece7f2;">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                  :style="c.fuente === 'ppa' ? 'background:#e0f2fe;color:#0369a1' : 'background:#f0ebfd;color:var(--color-unergy-purple)'">
                  {{ c.fuente === 'ppa' ? 'PPA' : servicioLabel(c.tipo) }}
                </span>
                <span class="text-sm font-semibold truncate" style="color:var(--color-unergy-deep);">{{ fmt(c.numero) }}</span>
                <span v-if="c.semaforo" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  :style="{ color: SEMAFORO[c.semaforo].color, background: SEMAFORO[c.semaforo].bg }">
                  {{ SEMAFORO[c.semaforo].label }}
                </span>
              </div>
              <p class="text-xs mt-0.5" style="color:#6b5a8a;">
                {{ c.proyectos.join(', ') || '—' }} · {{ fmtFecha(c.fecha_inicio) }} → {{ fmtFecha(c.fecha_fin) }}
                <span v-if="c.renovacion_automatica === true"> · renueva auto</span>
                <span v-else-if="c.renovacion_automatica === false"> · no renueva</span>
              </p>
            </div>
            <a v-if="c.link" :href="c.link" target="_blank" rel="noopener"
              class="text-xs font-semibold flex items-center gap-1 hover:underline shrink-0" style="color:var(--color-unergy-purple);">
              <ExternalLinkIcon class="text-xs size-[1em]" /> Abrir contrato
            </a>
            <span v-else class="text-xs italic shrink-0" style="color:#bba8d4;">Sin link</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ClientesService } from '~/features/clientes/services/clientes'
import ParticipacionSparkline from './ParticipacionSparkline.vue'
import { SEMAFORO, servicioLabel, fmt, fmtFecha } from './clientesUi'
import { DollarSignIcon, ExternalLinkIcon, FileIcon, LoaderCircleIcon, SunIcon } from '@lucide/vue'

const clientesService = new ClientesService()

const props = defineProps({ clienteId: { type: [Number, String], required: true } })
const panel = ref(null)
const loading = ref(false)

const historicoPorProyecto = computed(() => {
  if (!panel.value) return []
  const grupos = {}
  for (const f of panel.value.participaciones_historico) {
    const key = f.proyecto_id
    if (!grupos[key]) grupos[key] = { proyecto_id: key, nombre: f.proyecto_nombre, filas: [] }
    grupos[key].filas.push(f)
  }
  return Object.values(grupos).map(g => {
    const vigente = g.filas.find(f => !f.fecha_fin)
    return { ...g, actual: vigente?.porcentaje ?? g.filas[g.filas.length - 1]?.porcentaje ?? '—' }
  })
})

function renovLabel(v) {
  return v === true ? 'Renueva auto' : v === false ? 'No renueva' : 'Renovación —'
}
function renovStyle(v) {
  return v === true ? 'background:#e8f5e9;color:#16a34a'
    : v === false ? 'background:#f3f4f6;color:#6b7280'
    : 'background:#f8f5fd;color:#bba8d4'
}

async function cargar() {
  if (!props.clienteId) return
  loading.value = true
  try {
    panel.value = await clientesService.obtenerPanel(props.clienteId)
  } finally {
    loading.value = false
  }
}

watch(() => props.clienteId, cargar, { immediate: true })
defineExpose({ recargar: cargar })
</script>

<style scoped>
.kpi-card { border: 1.5px solid #e8e0f0; border-radius: 0.75rem; padding: 0.7rem 0.9rem; }
.kpi-valor { font-size: 1.5rem; font-weight: 800; color: var(--color-unergy-deep); line-height: 1.15; }
.kpi-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #9b89b5; margin-top: 0.15rem; }
.seccion { border: 1.5px solid #e8e0f0; border-radius: 0.75rem; overflow: hidden; }
.seccion-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1rem; background: #faf8fd; font-size: 0.875rem; font-weight: 700; color: var(--color-unergy-deep); }
.badge { font-size: 0.625rem; font-weight: 700; padding: 0.05rem 0.4rem; border-radius: 9999px; background: #f0ebfd; color: var(--color-unergy-purple); }
.chip { font-size: 0.625rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 9999px; background: #f0ebfd; color: var(--color-unergy-purple); }
.dato-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #9b89b5; }
</style>
