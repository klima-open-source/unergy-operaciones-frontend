<script setup lang="ts">
/**
 * Panel genérico de consulta a un dataset del SIMEM.
 *
 * Dataset + rango de fechas + filtro por agente → tabla y Excel. Lo usan las
 * pestañas que no necesitan nada más (Costos CND/ASIC, Contratos/Índice MC);
 * OEF tiene el suyo porque además cruza con el catálogo de plantas.
 *
 * Las columnas NO se fijan: cada dataset trae las suyas y el SIMEM las cambia
 * sin avisar, así que se pinta lo que venga.
 */
import { DownloadIcon } from '@lucide/vue'
import { computed, ref } from 'vue'
import { normalizeError } from '~/core/errors'
import type { ProgresoConsulta } from '~/features/mem/services/simem'
import { consultarDataset } from '~/features/mem/services/simem'
import { exportarExcel } from '~/utils/exportarExcel'

const props = defineProps<{
  datasets: readonly { id: string, label: string }[]
  /** Texto corto que explica de qué son estos datos. */
  ayuda?: string
}>()

/** Cuántas filas se pintan. El Excel las trae todas. */
const MAX_FILAS = 500

/** El nombre de la columna del agente cambia entre datasets: se busca. */
const COLUMNA_AGENTE = /codigosicagente|codigoagente/i

const hoy = new Date()
const dataset = ref(props.datasets[0]!.id)
const inicio = ref(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 10))
const fin = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().slice(0, 10))
const agente = ref('UNGG')

const filas = ref<Record<string, unknown>[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const progreso = ref<ProgresoConsulta | null>(null)
const consultado = ref(false)

const columnas = computed(() => filas.value.length ? Object.keys(filas.value[0]!) : [])

const filtradas = computed(() => {
  const q = agente.value.trim().toUpperCase()
  const col = columnas.value.find((c) => COLUMNA_AGENTE.test(c))
  // Sin columna de agente el filtro no aplica: se muestran todas en vez de
  // dejar la tabla vacía, que se leería como «no hay datos».
  if (!q || !col) return filas.value
  return filas.value.filter((f) => String(f[col] ?? '').toUpperCase() === q)
})

const sinColumnaAgente = computed(() =>
  consultado.value && !!agente.value.trim() && !columnas.value.some((c) => COLUMNA_AGENTE.test(c)),
)

async function consultar() {
  cargando.value = true
  error.value = null
  progreso.value = null
  try {
    filas.value = await consultarDataset(dataset.value, inicio.value, fin.value, {
      alAvanzar: (p) => { progreso.value = p.total > 1 ? p : null },
    })
    consultado.value = true
  } catch (e) {
    error.value = normalizeError(e).message
    filas.value = []
  } finally {
    cargando.value = false
    progreso.value = null
  }
}

async function exportar() {
  if (!filtradas.value.length) return
  const nombre = props.datasets.find((d) => d.id === dataset.value)?.label ?? dataset.value
  await exportarExcel(
    filtradas.value,
    columnas.value.map((c) => ({ header: c, value: (f: Record<string, unknown>) => f[c] ?? '' })),
    `SIMEM_${nombre.replace(/[^\w]+/g, '_')}_${inicio.value}_${fin.value}.xlsx`,
    'Datos',
  )
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Dataset</label>
        <select v-model="dataset" class="h-9 rounded-md border bg-background px-2 text-sm">
          <option v-for="d in datasets" :key="d.id" :value="d.id">{{ d.label }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Desde</label>
        <Input v-model="inicio" type="date" class="w-40" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Hasta</label>
        <Input v-model="fin" type="date" class="w-40" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Agente</label>
        <Input v-model="agente" class="w-28 uppercase" placeholder="UNGG" />
      </div>
      <Button size="sm" :disabled="cargando" @click="consultar">Consultar</Button>
      <Button size="sm" variant="outline" :disabled="cargando || !filtradas.length" @click="exportar">
        <DownloadIcon class="size-3" />
        Exportar
      </Button>
    </div>

    <p v-if="ayuda" class="text-xs text-muted-foreground">{{ ayuda }}</p>

    <!-- Un rango largo se parte en bloques y tarda: hay que decir por dónde va. -->
    <p v-if="progreso" class="text-xs text-muted-foreground">
      Consultando bloque {{ progreso.bloque }} de {{ progreso.total }}
      ({{ progreso.inicio }} → {{ progreso.fin }})…
    </p>

    <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      {{ error }}
    </div>

    <Spinner v-else-if="cargando" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <template v-else-if="consultado">
      <p class="text-sm text-muted-foreground">
        <b class="text-foreground">{{ filtradas.length.toLocaleString('es-CO') }}</b> filas
        <span v-if="filtradas.length !== filas.length">
          (de {{ filas.length.toLocaleString('es-CO') }} sin filtrar por agente)
        </span>
        <!-- Decirlo evita creer que el filtro se aplicó y no encontró nada. -->
        <span v-if="sinColumnaAgente" class="text-amber-700">
          · este dataset no trae agente, el filtro no aplica
        </span>
      </p>

      <div v-if="!filtradas.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Sin resultados para ese rango y agente.
      </div>

      <div v-else class="max-h-[32rem] overflow-auto rounded-md border">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-muted">
            <tr class="border-b">
              <th
                v-for="c in columnas" :key="c"
                class="px-2 py-2 text-left font-medium whitespace-nowrap text-muted-foreground"
              >
                {{ c }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(f, i) in filtradas.slice(0, MAX_FILAS)" :key="i" class="border-t hover:bg-muted/40">
              <td v-for="c in columnas" :key="c" class="px-2 py-1.5 whitespace-nowrap">{{ f[c] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="filtradas.length > MAX_FILAS" class="text-xs text-muted-foreground">
        Se muestran las primeras {{ MAX_FILAS }} filas. El Excel las trae todas.
      </p>
    </template>

    <div v-else class="rounded-md border p-8 text-center text-sm text-muted-foreground">
      Elige un rango y consulta.
    </div>
  </div>
</template>
