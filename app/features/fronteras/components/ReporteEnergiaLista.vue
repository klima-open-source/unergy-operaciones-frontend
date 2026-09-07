<template>
  <div class="list-pane bg-white rounded-xl shadow-sm overflow-hidden flex flex-col" style="border: 1px solid #e8e0f0;">
    <div class="p-3 space-y-2" style="border-bottom: 1px solid #f1ecf7;">
      <span class="p-input-icon-left w-full">
        <SearchIcon class="size-[1em]" />
        <InputText v-model="search" placeholder="Buscar proyecto..." class="w-full" />
      </span>
      <div class="flex gap-2">
        <button class="filter-pill" :class="{ on: genOn }" @click="genOn = !genOn">Generación</button>
        <button class="filter-pill" :class="{ on: conOn }" @click="conOn = !conOn">Consumo</button>
      </div>
      <Select
        v-model="filtroFuente"
        :options="opcionesFuente"
        optionLabel="label"
        optionValue="value"
        placeholder="Todas las fuentes"
        showClear
        class="w-full"
        size="small"
      />
    </div>
    <ul class="list-scroll flex-1 overflow-y-auto" style="list-style: none; margin: 0; padding: 0;">
      <li v-for="f in filtradas" :key="f.frontera_id">
        <button
          class="row w-full text-left"
          :class="{ 'row-selected': f.frontera_id === seleccionada }"
          :style="{ borderLeftColor: semaforoColor(f) }"
          @click="$emit('seleccionar', f)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-sm truncate" style="color: var(--color-unergy-deep);">{{ f.nombre_proyecto }}</span>
            <span class="font-mono text-xs flex-none" style="color: #6b5a8a;">{{ fmtKwh(f.energia_final_kwh) }}</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="tipo-tag" :style="{ color: f.tipo === 'generacion' ? '#10B981' : '#3B82F6', borderColor: f.tipo === 'generacion' ? '#10B981' : '#3B82F6' }">
              {{ f.tipo === 'generacion' ? 'Gen' : 'Con' }}
            </span>
            <span class="text-xs truncate" style="color: #9b89b5;">{{ etiquetaFuente(f) }}</span>
          </div>
        </button>
      </li>
      <li v-if="!filtradas.length" class="text-sm text-center py-8" style="color: #9b89b5;">
        Sin resultados con estos filtros.
      </li>
    </ul>
    <div class="text-xs px-3 py-2" style="border-top: 1px solid #f1ecf7; color: #9b89b5;">
      Mostrando {{ filtradas.length }} de {{ filas.length }} fronteras
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { SearchIcon } from '@lucide/vue'

const props = defineProps({
  filas: { type: Array, default: () => [] },
  seleccionada: { type: Number, default: null },
})
defineEmits(['seleccionar'])

const search = ref('')
const genOn = ref(true)
const conOn = ref(true)
const filtroFuente = ref(null)

// Solo las fuentes que de verdad aparecen ese día, con su conteo: el catálogo
// completo (ETIQUETAS_FUENTE) tiene ~20 entradas y la mayoría no aplica en un
// día cualquiera, así que ofrecerlas todas sería un desplegable lleno de
// opciones que no filtran nada. Ordenadas por conteo, de mayor a menor.
//
// Se agrupa por ETIQUETA, no por `medidor_usado`: varias claves internas
// comparten etiqueta a propósito ('principal', 'principal_sin_cgm' y
// 'principal_sin_historico' se muestran las tres como "Medidor principal",
// ver ETIQUETAS_FUENTE). Agrupando por clave salían opciones repetidas con el
// mismo nombre y conteos partidos, que es justo lo que no sirve para filtrar.
const opcionesFuente = computed(() => {
  const conteo = new Map()
  for (const f of props.filas) {
    const etiqueta = etiquetaFuente(f)
    conteo.set(etiqueta, (conteo.get(etiqueta) || 0) + 1)
  }
  return [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([etiqueta, n]) => ({ value: etiqueta, label: `${etiqueta} (${n})` }))
})

const filtradas = computed(() => {
  let list = props.filas
  // Si se apagan las dos (o están las dos prendidas), no filtra por tipo --
  // apagar ambas por error nunca debería dejar la lista vacía.
  if (genOn.value !== conOn.value) {
    list = list.filter(f => (f.tipo === 'generacion') === genOn.value)
  }
  if (filtroFuente.value) {
    list = list.filter(f => etiquetaFuente(f) === filtroFuente.value)
  }
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(f => (f.nombre_proyecto || '').toLowerCase().includes(s))
  }
  return list
})

function semaforo(f) {
  if (f.revisar_manualmente) return 'critical'
  if (['1', 'CGM'].includes(String(f.caso))) return 'success'
  return 'warning'
}
function semaforoColor(f) {
  const map = { critical: '#D64455', warning: '#F0C040', success: '#10B981' }
  return map[semaforo(f)]
}

const ETIQUETAS_FUENTE = {
  cgm: 'CGM', principal: 'Medidor principal', respaldo: 'Medidor respaldo',
  inversores: 'Inversores × FP', crudos: 'Datos crudos', crudos_parcial: 'Datos crudos (parcial)',
  reconectador: 'Reconectador', solenium_power: 'Solenium (power)', ninguno: 'Apagado',
  revisar: 'Sin fuente', relleno_horario: 'Relleno horario',
  externo: 'Reporta otra empresa', historico: 'Histórico propio',
  historico_vecino: 'Histórico (vecino de predio)',
  principal_sin_historico: 'Medidor principal', respaldo_sin_historico: 'Medidor respaldo',
  principal_sin_cgm: 'Medidor principal', respaldo_sin_cgm: 'Medidor respaldo',
  excluida: 'Excluida', excel_terceros: 'Excel de terceros', editado_manualmente: 'Editado manualmente',
}
function etiquetaFuente(f) {
  return ETIQUETAS_FUENTE[f.medidor_usado] || f.medidor_usado || '—'
}
function fmtKwh(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kWh'
}
</script>

<style scoped>
.list-scroll { max-height: 32rem; }
.row {
  display: block;
  width: 100%;
  padding: 10px 14px 10px 12px;
  border: none;
  background: none;
  border-bottom: 1px solid #f5f1fa;
  border-left: 3px solid transparent;
  cursor: pointer;
}
.row:hover { background: #faf8fd; }
.row-selected { background: #f5eefc; }
.filter-pill {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid #e8e0f0;
  background: white;
  color: #9b89b5;
  cursor: pointer;
}
.filter-pill.on { background: #f5eefc; border-color: var(--color-unergy-purple); color: var(--color-unergy-purple-dark); }
.tipo-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid;
  flex: none;
}
</style>
