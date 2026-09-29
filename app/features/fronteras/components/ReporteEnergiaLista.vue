<template>
  <div class="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
    <div class="space-y-2 border-b p-3">
      <InputGroup>
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput v-model="search" placeholder="Buscar proyecto..." />
      </InputGroup>
      <div class="flex gap-2">
        <button
          class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold"
          :class="genOn ? PILL_ON : PILL_OFF"
          @click="genOn = !genOn"
        >
          Generación
        </button>
        <button
          class="cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold"
          :class="conOn ? PILL_ON : PILL_OFF"
          @click="conOn = !conOn"
        >
          Consumo
        </button>
      </div>
      <Select v-model="filtroFuente">
        <SelectTrigger size="sm" class="w-full"
          ><SelectValue placeholder="Todas las fuentes"
        /></SelectTrigger>
        <SelectContent>
          <SelectItem :value="TODAS_LAS_FUENTES">Todas las fuentes</SelectItem>
          <SelectItem v-for="op in opcionesFuente" :key="op.value" :value="op.value">{{
            op.label
          }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <ul class="max-h-128 flex-1 overflow-y-auto">
      <li v-for="f in filtradas" :key="f.frontera_id">
        <button
          class="block w-full cursor-pointer border-b border-l-3 py-2.5 pr-3.5 pl-3 text-left hover:bg-muted/50"
          :class="[semaforoBorde(f), f.frontera_id === seleccionada ? 'bg-accent' : '']"
          @click="$emit('seleccionar', f)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium text-unergy-deep">{{
              f.nombre_proyecto
            }}</span>
            <span class="flex-none font-mono text-xs text-muted-foreground">{{
              fmtKwh(f.energia_final_kwh)
            }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span
              class="flex-none rounded border px-1.5 py-px text-xs font-bold uppercase"
              :class="f.tipo === 'generacion' ? 'text-success' : 'text-primary'"
            >
              {{ f.tipo === 'generacion' ? 'Gen' : 'Con' }}
            </span>
            <span class="truncate text-xs text-muted-foreground">{{ etiquetaFuente(f) }}</span>
          </div>
        </button>
      </li>
      <li v-if="!filtradas.length" class="py-8 text-center text-sm text-muted-foreground">
        Sin resultados con estos filtros.
      </li>
    </ul>
    <div class="border-t px-3 py-2 text-xs text-muted-foreground">
      Mostrando {{ filtradas.length }} de {{ filas.length }} fronteras
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilaReporteEnergia } from '~/features/fronteras/types'
import { SearchIcon } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    filas?: FilaReporteEnergia[]
    seleccionada?: number | null
  }>(),
  { filas: () => [], seleccionada: null },
)
defineEmits<{ seleccionar: [fila: FilaReporteEnergia] }>()

const search = ref('')
const genOn = ref(true)
const conOn = ref(true)
// Reka UI no admite `value=""` en un SelectItem (reservado para limpiar la
// selección), así que "todas" necesita un valor propio que no filtra.
const TODAS_LAS_FUENTES = '__todas__'
const filtroFuente = ref(TODAS_LAS_FUENTES)

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
  const conteo = new Map<string, number>()
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
    list = list.filter((f) => (f.tipo === 'generacion') === genOn.value)
  }
  if (filtroFuente.value !== TODAS_LAS_FUENTES) {
    list = list.filter((f) => etiquetaFuente(f) === filtroFuente.value)
  }
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter((f) => (f.nombre_proyecto || '').toLowerCase().includes(s))
  }
  return list
})

type Semaforo = 'critical' | 'warning' | 'success'

function semaforo(f: FilaReporteEnergia): Semaforo {
  if (f.revisar_manualmente) return 'critical'
  if (['1', 'CGM'].includes(String(f.caso))) return 'success'
  return 'warning'
}
function semaforoBorde(f: FilaReporteEnergia): string {
  const map: Record<Semaforo, string> = {
    critical: 'border-l-destructive',
    warning: 'border-l-warning',
    success: 'border-l-success',
  }
  return map[semaforo(f)]
}

const PILL_ON = 'border-unergy-purple bg-accent text-unergy-purple-dark'
const PILL_OFF = 'bg-card text-muted-foreground'

const ETIQUETAS_FUENTE: Record<string, string> = {
  cgm: 'CGM',
  principal: 'Medidor principal',
  respaldo: 'Medidor respaldo',
  inversores: 'Inversores × FP',
  crudos: 'Datos crudos',
  crudos_parcial: 'Datos crudos (parcial)',
  reconectador: 'Reconectador',
  solenium_power: 'Solenium (power)',
  ninguno: 'Apagado',
  revisar: 'Sin fuente',
  relleno_horario: 'Relleno horario',
  externo: 'Reporta otra empresa',
  historico: 'Histórico propio',
  historico_vecino: 'Histórico (vecino de predio)',
  principal_sin_historico: 'Medidor principal',
  respaldo_sin_historico: 'Medidor respaldo',
  principal_sin_cgm: 'Medidor principal',
  respaldo_sin_cgm: 'Medidor respaldo',
  excluida: 'Excluida',
  excel_terceros: 'Excel de terceros',
  editado_manualmente: 'Editado manualmente',
}
function etiquetaFuente(f: FilaReporteEnergia): string {
  const clave = typeof f.medidor_usado === 'string' ? f.medidor_usado : null
  return (clave && ETIQUETAS_FUENTE[clave]) || clave || '—'
}
function fmtKwh(v: unknown): string {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kWh'
}
</script>
