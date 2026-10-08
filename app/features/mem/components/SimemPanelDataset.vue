<script setup lang="ts">
/**
 * Panel de consulta a un dataset del SIMEM.
 *
 * Es el panel ÚNICO de las cinco pestañas que consultan datasets (costos, OEF,
 * contratos, arranque y parada, generación). Tenerlas en un solo componente es
 * lo que garantiza que no se desparejen los filtros: antes OEF tenía tecnología
 * y capacidad y las demás no, teniendo los mismos datos.
 *
 * Réplica de la herramienta suelta que se usaba antes: dataset, rango, versión,
 * agente, planta, tecnología y capacidad; KPIs; total diario con su gráfica y
 * su CSV; tabla; y exportación a Excel y a CSV.
 *
 * Las columnas NO se fijan en ninguna parte: cada dataset trae las suyas y el
 * SIMEM las cambia sin avisar, así que se detectan o se pinta lo que venga.
 */
import { DownloadIcon } from '@lucide/vue'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import GraficaTotalDiario from '~/features/mem/components/GraficaTotalDiario.vue'
import SelectorPlantas from '~/features/mem/components/SelectorPlantas.vue'
import type { ProgresoConsulta } from '~/features/mem/services/simem'
import { consultarDataset } from '~/features/mem/services/simem'
import { cargarCatalogo } from '~/features/mem/utils/catalogoPlantas'
import type { PlantaSimem } from '~/features/mem/utils/simemAgentes'
import { TECNOLOGIAS } from '~/features/mem/utils/simemAgentes'
import { columnaDePlanta, enriquecerFilas, filtrarPorPlanta } from '~/features/mem/utils/simemPlantas'
import { DIAS_MAXIMO_PESADO, diasEntre, esPesado } from '~/features/mem/utils/simemRangos'
import {
  columnaDeFecha, columnasNumericas, kpisDe, totalesPorDia, unidadDe,
} from '~/features/mem/utils/simemResumen'
import { exportarExcel } from '~/utils/exportarExcel'

const props = defineProps<{
  datasets: readonly { id: string, label: string }[]
  /** Texto corto que explica de qué son estos datos. */
  ayuda?: string
  /** Agentes del SIMEM (código → razón social), para el desplegable. */
  agentes?: Record<string, { nombre: string }>
}>()

/** Cuántas filas se pintan. El Excel y el CSV las traen todas. */
const MAX_FILAS = 500

/** El nombre de la columna del agente cambia entre datasets: se busca. */
const COLUMNA_AGENTE = /codigosicagente|codigoagente/i

/** Versiones de liquidación de XM, de la más preliminar a la definitiva. */
const VERSIONES = ['TX1', 'TX2', 'TX3', 'TX4', 'TX5', 'TXR', 'TXF']

const hoy = new Date()
const dataset = ref(props.datasets[0]!.id)
const inicio = ref(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 10))
const fin = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().slice(0, 10))
const agente = ref('UNGG')
const version = ref('')

const filas = ref<Record<string, unknown>[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const progreso = ref<ProgresoConsulta | null>(null)
const consultado = ref(false)
const exportando = ref(false)

const plantas = ref(new Set<string>())
const tecnologia = ref('')
const capMin = ref('')
const capMax = ref('')
const catalogo = ref<Record<string, PlantaSimem>>({})
const columnaValor = ref<string | null>(null)

const columnas = computed(() => filas.value.length ? Object.keys(filas.value[0]!) : [])
const columnaAgente = computed(() => columnas.value.find((c) => COLUMNA_AGENTE.test(c)))
const columnaPlanta = computed(() => columnaDePlanta(columnas.value))
const tienePlanta = computed(() => !!columnaPlanta.value)
const tieneVersion = computed(() => columnas.value.includes('Version'))

/**
 * Los datasets de generación traen ~47.000 filas por día. Se traen igual —el
 * troceado hace una llamada por día— pero con un tope de rango, que es el mismo
 * que anunciaba la herramienta anterior.
 */
const pesado = computed(() => esPesado(dataset.value))
const diasPedidos = computed(() => diasEntre(inicio.value, fin.value) + 1)
const excedeTope = computed(() => pesado.value && diasPedidos.value > DIAS_MAXIMO_PESADO)

/** La versión la filtra el cliente: el SIMEM devuelve todas en la misma consulta. */
const porVersion = computed(() => {
  if (!version.value || !tieneVersion.value) return filas.value
  return filas.value.filter((f) => String(f.Version ?? '').toUpperCase() === version.value)
})

const porAgente = computed(() => {
  const q = agente.value.trim().toUpperCase()
  const col = columnaAgente.value
  // Sin columna de agente no se filtra acá: más abajo se intenta por el agente
  // DUEÑO de la planta, que varios de estos datasets sí permiten.
  if (!q || !col) return porVersion.value
  return porVersion.value.filter((f) => String(f[col] ?? '').toUpperCase() === q)
})

const enriquecidas = computed(() =>
  tienePlanta.value ? enriquecerFilas(porAgente.value, catalogo.value) : [],
)

const opcionesPlanta = computed(() => {
  const vistas = new Map<string, string>()
  for (const f of enriquecidas.value) {
    if (f.planta) vistas.set(f.planta.codigo, f.planta.nombre)
    else if (f.codigo) vistas.set(f.codigo, f.codigo)
  }
  return [...vistas].map(([codigo, nombre]) => ({ codigo, nombre }))
})

const numeroOrNull = (v: string) => v.trim() === '' ? undefined : Number(v)

/** Las filas ya filtradas, con su planta resuelta cuando el dataset la trae. */
const resultado = computed(() => {
  if (!tienePlanta.value) {
    return porAgente.value.map((fila) => ({ fila, planta: null, codigo: null }))
  }
  return filtrarPorPlanta(enriquecidas.value, {
    // Solo cuando la fila no trae el agente: si lo trae, ya se filtró arriba.
    agente: columnaAgente.value ? undefined : (agente.value.trim() || undefined),
    tecnologia: tecnologia.value || undefined,
    capMin: numeroOrNull(capMin.value),
    capMax: numeroOrNull(capMax.value),
    codigos: plantas.value.size ? plantas.value : undefined,
  })
})

const soloFilas = computed(() => resultado.value.map((r) => r.fila))

const tecnologias = computed(() =>
  [...new Set(enriquecidas.value.map((f) => f.planta?.tecnologia).filter(Boolean))].sort() as string[],
)
const sinCatalogo = computed(() => enriquecidas.value.filter((f) => !f.planta).length)

const sinColumnaAgente = computed(() =>
  consultado.value && !!agente.value.trim() && !columnaAgente.value && !tienePlanta.value,
)

// ── Resumen: KPIs y total diario ───────────────────────────────────────────
const opcionesValor = computed(() => columnasNumericas(filas.value))
const valorElegido = computed(() => columnaValor.value ?? opcionesValor.value[0] ?? null)
const unidad = computed(() => unidadDe(soloFilas.value))
const kpis = computed(() => kpisDe(soloFilas.value, valorElegido.value, columnaPlanta.value))
const serieDiaria = computed(() =>
  totalesPorDia(soloFilas.value, columnaDeFecha(columnas.value), valorElegido.value),
)

const fmtNum = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: 2 })

/** Lista de agentes para el desplegable, con su razón social. */
const opcionesAgente = computed(() =>
  Object.entries(props.agentes ?? {})
    .map(([codigo, a]) => ({ codigo, label: `${codigo} — ${a.nombre}` }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo)),
)

async function consultar() {
  if (excedeTope.value) return
  cargando.value = true
  error.value = null
  progreso.value = null
  try {
    filas.value = await consultarDataset(dataset.value, inicio.value, fin.value, {
      alAvanzar: (p) => { progreso.value = p.total > 1 ? p : null },
    })
    consultado.value = true
    // Los filtros locales se limpian: son de lo consultado antes.
    plantas.value = new Set()
    tecnologia.value = ''
    capMin.value = ''
    capMax.value = ''
    columnaValor.value = null
    if (tienePlanta.value && !Object.keys(catalogo.value).length) {
      catalogo.value = (await cargarCatalogo()).plantas
    }
  } catch (e) {
    error.value = normalizeError(e).message
    filas.value = []
  } finally {
    cargando.value = false
    progreso.value = null
  }
}

const nombreDataset = computed(() =>
  props.datasets.find((d) => d.id === dataset.value)?.label ?? dataset.value,
)
const nombreArchivo = computed(() =>
  `SIMEM_${nombreDataset.value.replace(/[^\w]+/g, '_')}_${inicio.value}_${fin.value}`,
)

type Fila = typeof resultado.value[number]

/** Las columnas del SIMEM tal cual, y al final lo que agrega el catálogo. */
const columnasExport = computed(() => [
  ...columnas.value.map((c) => ({ header: c, value: (r: Fila) => r.fila[c] ?? '' })),
  ...(tienePlanta.value
    ? [
        { header: 'Planta', value: (r: Fila) => r.planta?.nombre ?? '' },
        { header: 'Tecnología', value: (r: Fila) =>
          r.planta ? (TECNOLOGIAS[r.planta.tecnologia] ?? r.planta.tecnologia) : '' },
        { header: 'Capacidad (kW)', value: (r: Fila) => r.planta?.capacidadKw ?? '' },
        { header: 'Uns (SIMEM)', value: (r: Fila) => r.planta?.unidades.join(', ') ?? '' },
        { header: 'Pls (SRC)', value: (r: Fila) => r.planta?.pls ?? '' },
      ]
    : []),
])

async function exportar() {
  if (!resultado.value.length) return
  exportando.value = true
  try {
    await exportarExcel(resultado.value, columnasExport.value, `${nombreArchivo.value}.xlsx`, 'Datos')
  } catch (e) {
    toast.error('No se pudo exportar', { description: normalizeError(e).message, duration: 6000 })
  } finally {
    exportando.value = false
  }
}

/** Un campo con `;` o comillas rompería el CSV si no se entrecomilla. */
function celdaCsv(v: unknown): string {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function aCsv(cols: { header: string, value: (r: Fila) => unknown }[], filasCsv: Fila[]): string {
  return [
    cols.map((c) => celdaCsv(c.header)).join(';'),
    ...filasCsv.map((r) => cols.map((c) => celdaCsv(c.value(r))).join(';')),
  ].join('\n')
}

/** Excel abre el CSV en la codificación del sistema salvo que lleve BOM. */
const BOM = String.fromCharCode(0xFEFF)

function descargar(texto: string, nombre: string) {
  const blob = new Blob([`${BOM}${texto}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

function exportarCsv() {
  if (!resultado.value.length) return
  descargar(aCsv(columnasExport.value, resultado.value), `${nombreArchivo.value}.csv`)
}

async function copiarCsv() {
  if (!resultado.value.length) return
  try {
    await navigator.clipboard.writeText(aCsv(columnasExport.value, resultado.value))
    toast.success('CSV copiado', { description: 'Pégalo directamente en Excel.', duration: 4000 })
  } catch {
    exportarCsv()
    toast.info('El navegador no dejó copiar: se descargó el CSV', { duration: 5000 })
  }
}

function exportarCsvDiario() {
  if (!serieDiaria.value.length) return
  const texto = [
    `Fecha;${valorElegido.value ?? 'Valor'}`,
    ...serieDiaria.value.map((p) => `${p.dia};${p.valor}`),
  ].join('\n')
  descargar(texto, `${nombreArchivo.value}_diario.csv`)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Filtros de la consulta -->
    <div class="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Dataset</label>
        <select v-model="dataset" class="h-9 w-64 rounded-md border bg-background px-2 text-sm">
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
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Agente SIC</label>
        <!-- Desplegable con razón social cuando el registro está cargado; si no,
             texto libre, que siempre funciona. -->
        <select
          v-if="opcionesAgente.length" v-model="agente"
          class="h-9 w-64 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Todos los agentes</option>
          <option v-for="a in opcionesAgente" :key="a.codigo" :value="a.codigo">{{ a.label }}</option>
        </select>
        <Input v-else v-model="agente" class="w-28 uppercase" placeholder="UNGG" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Versión</label>
        <select v-model="version" class="h-9 w-28 rounded-md border bg-background px-2 text-sm">
          <option value="">Todas</option>
          <option v-for="v in VERSIONES" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
      <Button size="sm" :disabled="cargando || excedeTope" @click="consultar">Consultar</Button>
    </div>

    <div
      v-if="excedeTope"
      class="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      Son <b>{{ diasPedidos }} días</b> y el tope de este dataset es {{ DIAS_MAXIMO_PESADO }}.
      Acorta el rango.
    </div>
    <p v-else-if="pesado && !cargando" class="text-xs text-muted-foreground">
      Dataset pesado: se trae día por día —unas 47.000 filas por cada uno—, así que
      {{ diasPedidos }} día(s) tardan un rato.
    </p>

    <p v-if="ayuda" class="text-xs text-muted-foreground">{{ ayuda }}</p>

    <p v-if="progreso" class="text-xs text-muted-foreground">
      Consultando bloque {{ progreso.bloque }} de {{ progreso.total }}
      ({{ progreso.inicio }} → {{ progreso.fin }})…
    </p>

    <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      {{ error }}
    </div>

    <Spinner v-else-if="cargando" class="mx-auto my-10 block size-6 text-muted-foreground" />

    <template v-else-if="consultado">
      <!-- Filtros locales, los que dependen del catálogo de plantas -->
      <div v-if="tienePlanta" class="flex flex-wrap items-end gap-3 border-t pt-3">
        <SelectorPlantas v-model="plantas" :opciones="opcionesPlanta" />
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Tecnología</label>
          <select v-model="tecnologia" class="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Todas</option>
            <option v-for="t in tecnologias" :key="t" :value="t">{{ TECNOLOGIAS[t] ?? t }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Cap. mín (kW)</label>
          <Input v-model="capMin" type="number" class="w-28" placeholder="0" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold tracking-wider text-primary uppercase">Cap. máx (kW)</label>
          <Input v-model="capMax" type="number" class="w-28" placeholder="∞" />
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-md border px-4 py-3">
          <div class="text-xs tracking-wide text-muted-foreground uppercase">Registros</div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ kpis.registros.toLocaleString('es-CO') }}
          </div>
          <div class="text-[11px] text-muted-foreground">
            <span v-if="kpis.registros !== filas.length">
              de {{ filas.length.toLocaleString('es-CO') }} traídos
            </span>
          </div>
        </div>
        <div class="rounded-md border px-4 py-3">
          <div class="text-xs tracking-wide text-muted-foreground uppercase">
            Total {{ valorElegido ?? '' }}
          </div>
          <div class="text-2xl font-semibold tabular-nums">{{ fmtNum(kpis.total) }}</div>
          <div class="text-[11px] text-muted-foreground">{{ unidad ?? 'unidades mezcladas' }}</div>
        </div>
        <div v-if="kpis.plantas != null" class="rounded-md border px-4 py-3">
          <div class="text-xs tracking-wide text-muted-foreground uppercase">Plantas con valor</div>
          <div class="text-2xl font-semibold tabular-nums">{{ kpis.conValor }}</div>
          <div class="text-[11px] text-muted-foreground">
            de {{ kpis.plantas }} · {{ kpis.enCero }} en cero
            <span v-if="sinCatalogo" class="text-amber-700">
              · {{ sinCatalogo }} fila(s) sin planta en el catálogo
            </span>
          </div>
        </div>
      </div>

      <!-- Total diario -->
      <div v-if="serieDiaria.length" class="rounded-md border p-3">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-medium tracking-wide uppercase">
            Total diario — {{ valorElegido }}
          </span>
          <div class="flex items-center gap-2">
            <select
              v-if="opcionesValor.length > 1"
              :value="valorElegido" class="h-8 rounded-md border bg-background px-2 text-xs"
              @change="columnaValor = ($event.target as HTMLSelectElement).value"
            >
              <option v-for="c in opcionesValor" :key="c" :value="c">{{ c }}</option>
            </select>
            <Button size="sm" variant="outline" @click="exportarCsvDiario">CSV diario</Button>
          </div>
        </div>
        <GraficaTotalDiario
          :puntos="serieDiaria" :titulo="`Total diario de ${valorElegido}`"
          :unidad="unidad ?? undefined"
        />
      </div>

      <!-- Acciones sobre el resultado -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted-foreground">
          <b class="text-foreground">{{ resultado.length.toLocaleString('es-CO') }}</b> filas
          <span v-if="sinColumnaAgente" class="text-amber-700">
            · este dataset no trae agente, el filtro no aplica
          </span>
        </span>
        <div class="ml-auto flex gap-2">
          <Button size="sm" variant="outline" :disabled="!resultado.length" @click="copiarCsv">
            Copiar CSV
          </Button>
          <Button size="sm" variant="outline" :disabled="!resultado.length" @click="exportarCsv">
            CSV
          </Button>
          <Button size="sm" variant="outline" :disabled="exportando || !resultado.length" @click="exportar">
            <DownloadIcon class="size-3" />
            Excel
          </Button>
        </div>
      </div>

      <div v-if="!resultado.length" class="rounded-md border p-8 text-center text-sm text-muted-foreground">
        Sin resultados con esos filtros.
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
              <template v-if="tienePlanta">
                <th class="px-2 py-2 text-left font-medium whitespace-nowrap text-primary">Planta</th>
                <th class="px-2 py-2 text-left font-medium whitespace-nowrap text-primary">Tecnología</th>
                <th class="px-2 py-2 text-right font-medium whitespace-nowrap text-primary">Cap. (kW)</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in resultado.slice(0, MAX_FILAS)" :key="i" class="border-t hover:bg-muted/40">
              <td v-for="c in columnas" :key="c" class="px-2 py-1.5 whitespace-nowrap">{{ r.fila[c] }}</td>
              <template v-if="tienePlanta">
                <td class="px-2 py-1.5 whitespace-nowrap" :class="{ 'text-muted-foreground': !r.planta }">
                  {{ r.planta?.nombre ?? '—' }}
                </td>
                <td class="px-2 py-1.5 whitespace-nowrap">
                  {{ r.planta ? (TECNOLOGIAS[r.planta.tecnologia] ?? r.planta.tecnologia) : '—' }}
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums">
                  {{ r.planta?.capacidadKw?.toLocaleString('es-CO') ?? '—' }}
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="resultado.length > MAX_FILAS" class="text-xs text-muted-foreground">
        Se muestran las primeras {{ MAX_FILAS }} filas. El Excel y el CSV las traen todas.
      </p>
    </template>

    <div v-else class="rounded-md border p-8 text-center text-sm text-muted-foreground">
      Elige un rango y consulta.
    </div>
  </div>
</template>
