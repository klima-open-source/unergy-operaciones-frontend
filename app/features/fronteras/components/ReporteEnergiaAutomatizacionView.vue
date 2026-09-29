<template>
  <div class="space-y-5">
    <!-- Barra de acciones (el título ya lo pone el wrapper ReporteEnergiaView) -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="shrink-0">
        <DatePicker v-model="fecha" :max-value="maxFecha" />
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="ejecutando" @click="ejecutarClasificacion">
          <LoaderCircleIcon v-if="ejecutando" class="animate-spin" />
          <PlayIcon v-else />
          Ejecutar clasificación
        </Button>
        <Button
          v-if="ejecutando"
          variant="destructive"
          :disabled="deteniendo"
          @click="detenerClasificacion"
        >
          <LoaderCircleIcon v-if="deteniendo" class="animate-spin" />
          <CircleStopIcon v-else />
          Detener
        </Button>
        <Button variant="outline" :disabled="generandoExcel" @click="generarExcel">
          <LoaderCircleIcon v-if="generandoExcel" class="animate-spin" />
          <FileSpreadsheetIcon v-else />
          Generar Excel
        </Button>
        <GTooltip>
          <GTooltipTrigger as-child>
            <Button
              :disabled="!resumen || !resumen.puede_enviar || enviando"
              @click="enviarReporte"
            >
              <LoaderCircleIcon v-if="enviando" class="animate-spin" />
              <SendIcon v-else />
              Enviar reporte
            </Button>
          </GTooltipTrigger>
          <GTooltipContent v-if="!resumen?.puede_enviar"
            >Quedan fronteras con horas sin fuente por revisar</GTooltipContent
          >
        </GTooltip>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="flex flex-wrap gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex h-20 min-w-36 flex-1 cursor-pointer flex-col justify-center rounded-xl border bg-card p-4 shadow-sm"
        @click="filtroSemaforo = stat.filtro"
      >
        <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {{ stat.label }}
        </p>
        <p class="mt-1 text-2xl font-bold" :class="stat.color">{{ stat.value }}</p>
      </div>
    </div>

    <!-- Estado en Quoia: ¿XM ya resolvió los reportes ENVIADOS ese día?
         Distinto de "Enviar reporte" (que solo dice si el POST llegó bien
         a Quoia) -- esto vuelve a consultar Quoia para saber si XM lo
         aprobó ("Exitoso") o lo rechazó ("Error"), o sigue sin resolver
         ("En espera"). Solo aparece si hay algo enviado ese día; el
         polling se detiene solo en cuanto nadie queda en_espera. -->
    <div v-if="estadoQuoia" class="rounded-xl border bg-card p-4 shadow-sm">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-bold text-foreground">Estado en Quoia</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ estadoQuoia.total }} fronteras enviadas
            <span v-if="estadoQuoiaPolling"> · revisando cada 2 min</span>
          </p>
        </div>
        <span
          v-if="estadoQuoiaPolling"
          class="flex items-center gap-1.5 text-xs font-semibold text-primary"
        >
          <span class="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
          En vivo
        </span>
      </div>
      <div class="mb-1 grid grid-cols-4 gap-2.5">
        <div class="rounded-lg bg-muted py-2.5 text-center">
          <p class="text-xl font-extrabold text-muted-foreground">{{ estadoQuoia.en_espera }}</p>
          <p class="mt-0.5 text-xs font-semibold text-muted-foreground">En espera</p>
        </div>
        <div class="rounded-lg bg-success/15 py-2.5 text-center">
          <p class="text-xl font-extrabold text-success">{{ estadoQuoia.exitoso }}</p>
          <p class="mt-0.5 text-xs font-semibold text-success">Exitoso</p>
        </div>
        <div class="rounded-lg bg-warning/15 py-2.5 text-center">
          <p class="text-xl font-extrabold text-warning">{{ estadoQuoia.exitoso_con_alerta }}</p>
          <p class="mt-0.5 text-xs font-semibold text-warning">Con alerta</p>
        </div>
        <div class="rounded-lg bg-destructive/10 py-2.5 text-center">
          <p class="text-xl font-extrabold text-destructive">{{ estadoQuoia.error }}</p>
          <p class="mt-0.5 text-xs font-semibold text-destructive">Error</p>
        </div>
      </div>
      <div v-if="estadoQuoia.fallidas.length" class="mt-3 border-t pt-3">
        <p class="mb-2 text-xs font-bold text-destructive">
          ⚠ {{ estadoQuoia.fallidas.length }} con error
        </p>
        <div
          v-for="f in estadoQuoia.fallidas"
          :key="f.frontera_id + f.tipo"
          class="mb-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs"
        >
          <span class="font-semibold text-foreground"
            >{{ f.nombre_proyecto }} —
            {{ f.tipo === 'generacion' ? 'Generación' : 'Consumo' }}</span
          >
        </div>
      </div>
      <p
        v-else-if="!estadoQuoiaPolling && estadoQuoia.en_espera === 0"
        class="mt-3 border-t pt-3 text-xs font-semibold text-success"
      >
        ✓ Todas las fronteras ya tienen respuesta de XM — nada pendiente
      </p>
    </div>

    <GTabs :model-value="String(activeTab)" @update:model-value="(v) => (activeTab = Number(v))">
      <GTabsList>
        <GTabsTrigger value="0">Revisión de hoy</GTabsTrigger>
        <GTabsTrigger value="1">Historial</GTabsTrigger>
        <GTabsTrigger value="2">Resumen</GTabsTrigger>
      </GTabsList>

      <GTabsContent value="0" class="pt-1">
        <div v-if="loadingLista" class="flex items-center justify-center py-12">
          <LoaderCircleIcon class="size-8 animate-spin text-primary" />
        </div>
        <div v-else-if="!filas.length" class="py-12 text-center text-muted-foreground">
          <p class="mb-3">Todavía no se ha corrido la clasificación para este día.</p>
          <Button :disabled="ejecutando" @click="ejecutarClasificacion">
            <LoaderCircleIcon v-if="ejecutando" class="animate-spin" />
            <PlayIcon v-else />
            Ejecutar clasificación
          </Button>
        </div>
        <div v-else class="grid items-start gap-4 md:grid-cols-[minmax(18rem,22rem)_1fr]">
          <ReporteEnergiaLista
            :filas="filasFiltradas"
            :seleccionada="seleccion?.frontera_id"
            @seleccionar="(f) => seleccionar(f, 'hoy')"
          />
          <div class="min-h-80 rounded-xl border bg-card p-5">
            <p v-if="!seleccion" class="py-16 text-center text-sm text-muted-foreground">
              Elige una frontera de la lista para ver su detalle.
            </p>
            <ReporteEnergiaDetalleTab
              v-else
              :key="`${seleccion.frontera_id}-${fechaISO}`"
              :frontera-id="seleccion.frontera_id"
              :fecha="fechaISO"
              @actualizado="onActualizadoHoy"
            />
          </div>
        </div>
      </GTabsContent>

      <GTabsContent value="1" class="pt-1">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <span class="text-sm text-muted-foreground">Ver el reporte de otro día:</span>
          <div class="shrink-0">
            <DatePicker v-model="fechaHistorial" :max-value="maxFecha" />
          </div>
          <Button size="sm" @click="cargarHistorial()">Ver</Button>
        </div>
        <div v-if="loadingHistorial" class="flex items-center justify-center py-12">
          <LoaderCircleIcon class="size-8 animate-spin text-primary" />
        </div>
        <div
          v-else-if="filasHistorial.length"
          class="grid items-start gap-4 md:grid-cols-[minmax(18rem,22rem)_1fr]"
        >
          <ReporteEnergiaLista
            :filas="filasFiltradas"
            :seleccionada="seleccionHistorial?.frontera_id"
            @seleccionar="(f) => seleccionar(f, 'historial')"
          />
          <div class="min-h-80 rounded-xl border bg-card p-5">
            <p v-if="!seleccionHistorial" class="py-16 text-center text-sm text-muted-foreground">
              Elige una frontera de la lista para ver su detalle.
            </p>
            <ReporteEnergiaDetalleTab
              v-else
              :key="`${seleccionHistorial.frontera_id}-${fechaHistorialISO}`"
              :frontera-id="seleccionHistorial.frontera_id"
              :fecha="fechaHistorialISO"
              @actualizado="cargarHistorial(true)"
            />
          </div>
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          Elige una fecha y pulsa "Ver" para revisar ese día.
        </p>
      </GTabsContent>

      <GTabsContent value="2" class="pt-1">
        <div class="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-muted-foreground">Desde</label>
            <DatePicker v-model="resumenDesde" :max-value="resumenHasta" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-muted-foreground">Hasta</label>
            <DatePicker v-model="resumenHasta" :min-value="resumenDesde" :max-value="maxFecha" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-muted-foreground">Frontera</label>
            <ComboBox
              v-model="fronteraResumenStr"
              :options="opcionesFronterasResumen"
              placeholder="Todas"
              :disabled="!fronterasDelResumen.length"
            />
          </div>
          <Button :disabled="loadingResumenHistorico" @click="cargarResumenHistorico">
            <LoaderCircleIcon v-if="loadingResumenHistorico" class="animate-spin" />
            Buscar
          </Button>
        </div>

        <div v-if="loadingResumenHistorico" class="flex items-center justify-center py-12">
          <LoaderCircleIcon class="size-8 animate-spin text-primary" />
        </div>

        <template v-else-if="resumenHistorico">
          <!-- Fuente usada — Generación -->
          <section class="mb-6">
            <p class="text-sm font-bold text-foreground">Fuente usada — Generación</p>
            <p class="mb-3 text-xs text-muted-foreground">
              {{ totalDias(kpiGen) }} días-frontera reportados en el rango · clic en una barra para
              ver el detalle por frontera
            </p>
            <div v-if="kpiGen.length" class="h-55 rounded-xl border bg-card p-3">
              <Bar :data="chartGen" :options="chartOptionsGen" :plugins="[dataLabelPlugin]" />
            </div>
            <p v-else class="py-8 text-center text-xs text-muted-foreground">
              Sin datos en este rango.
            </p>

            <div v-if="grupoSeleccionadoGen" class="mt-4">
              <div class="mb-2 flex items-center justify-between">
                <p class="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <span
                    class="inline-block size-2 rounded-full bg-(--c)"
                    :style="{ '--c': grupoColor(grupoSeleccionadoGen).texto }"
                  />
                  Detalle — {{ grupoSeleccionadoGen }}
                </p>
                <span
                  class="cursor-pointer text-xs text-muted-foreground"
                  @click="grupoSeleccionadoGen = null"
                  >Cerrar ✕</span
                >
              </div>
              <DataTable
                :columns="columnasDetalle(grupoSeleccionadoGen)"
                :rows="detalleFiltrado('gen') as unknown as DataTableRow[]"
                @row-click="(row) => irAFronteraHistorial(asDetalleFuente(row).frontera_id)"
              >
                <template #cell="{ row: rawRow, column }">
                  <template v-if="column.key === 'pct'">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full w-(--w) rounded-full bg-(--c)"
                          :style="{
                            '--w':
                              pctDe(
                                asDetalleFuente(rawRow).dias_grupo,
                                asDetalleFuente(rawRow).dias_totales,
                              ) + '%',
                            '--c': severidadColor(
                              pctDe(
                                asDetalleFuente(rawRow).dias_grupo,
                                asDetalleFuente(rawRow).dias_totales,
                              ),
                            ),
                          }"
                        />
                      </div>
                      <span class="text-right text-xs font-bold"
                        >{{
                          pctDe(
                            asDetalleFuente(rawRow).dias_grupo,
                            asDetalleFuente(rawRow).dias_totales,
                          )
                        }}%</span
                      >
                    </div>
                  </template>
                  <template v-else-if="column.key === 'fuentes'">
                    <span
                      v-for="d in asDetalleFuente(rawRow).desglose"
                      :key="d.etiqueta"
                      class="mr-1 mb-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                      >{{ d.etiqueta }} × {{ d.dias }}</span
                    >
                  </template>
                  <template v-else>{{ rawRow[column.key] }}</template>
                </template>
              </DataTable>
            </div>
          </section>

          <!-- Fuente usada — Consumo -->
          <section class="mb-6">
            <p class="text-sm font-bold text-foreground">Fuente usada — Consumo</p>
            <p class="mb-3 text-xs text-muted-foreground">
              {{ totalDias(kpiCon) }} días-frontera reportados en el rango · Consumo no usa
              inversores · clic en una barra para ver el detalle
            </p>
            <div v-if="kpiCon.length" class="h-55 rounded-xl border bg-card p-3">
              <Bar :data="chartCon" :options="chartOptionsCon" :plugins="[dataLabelPlugin]" />
            </div>
            <p v-else class="py-8 text-center text-xs text-muted-foreground">
              Sin datos en este rango.
            </p>

            <div v-if="grupoSeleccionadoCon" class="mt-4">
              <div class="mb-2 flex items-center justify-between">
                <p class="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <span
                    class="inline-block size-2 rounded-full bg-(--c)"
                    :style="{ '--c': grupoColor(grupoSeleccionadoCon).texto }"
                  />
                  Detalle — {{ grupoSeleccionadoCon }}
                </p>
                <span
                  class="cursor-pointer text-xs text-muted-foreground"
                  @click="grupoSeleccionadoCon = null"
                  >Cerrar ✕</span
                >
              </div>
              <DataTable
                :columns="columnasDetalle(grupoSeleccionadoCon)"
                :rows="detalleFiltrado('con') as unknown as DataTableRow[]"
                @row-click="(row) => irAFronteraHistorial(asDetalleFuente(row).frontera_id)"
              >
                <template #cell="{ row: rawRow, column }">
                  <template v-if="column.key === 'pct'">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full w-(--w) rounded-full bg-(--c)"
                          :style="{
                            '--w':
                              pctDe(
                                asDetalleFuente(rawRow).dias_grupo,
                                asDetalleFuente(rawRow).dias_totales,
                              ) + '%',
                            '--c': severidadColor(
                              pctDe(
                                asDetalleFuente(rawRow).dias_grupo,
                                asDetalleFuente(rawRow).dias_totales,
                              ),
                            ),
                          }"
                        />
                      </div>
                      <span class="text-right text-xs font-bold"
                        >{{
                          pctDe(
                            asDetalleFuente(rawRow).dias_grupo,
                            asDetalleFuente(rawRow).dias_totales,
                          )
                        }}%</span
                      >
                    </div>
                  </template>
                  <template v-else-if="column.key === 'fuentes'">
                    <span
                      v-for="d in asDetalleFuente(rawRow).desglose"
                      :key="d.etiqueta"
                      class="mr-1 mb-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                      >{{ d.etiqueta }} × {{ d.dias }}</span
                    >
                  </template>
                  <template v-else>{{ rawRow[column.key] }}</template>
                </template>
              </DataTable>
            </div>
          </section>

          <!-- Reportes automáticos (CGM) -->
          <section class="mb-6">
            <p class="text-sm font-bold text-foreground">Reportes automáticos</p>
            <p v-if="auto.dias_excluidos" class="mb-3 text-xs text-muted-foreground">
              {{ auto.dias_contados }} de {{ auto.dias.length }} días ·
              {{ auto.dias_excluidos }} excluidos por fallas del clasificador
            </p>
            <div v-if="kpiAuto.length" class="h-55 rounded-xl border bg-card p-3">
              <Bar :data="chartAuto" :options="chartOptionsAuto" :plugins="[dataLabelPlugin]" />
            </div>
            <p v-else class="py-8 text-center text-xs text-muted-foreground">
              Sin datos en este rango.
            </p>

            <div v-if="auto.por_frontera?.length" class="mt-4">
              <p class="mb-2 text-sm font-bold text-foreground">Por frontera</p>
              <DataTable
                :columns="columnasAutomatico"
                :rows="auto.por_frontera as unknown as DataTableRow[]"
                @row-click="(row) => irAFronteraHistorial(asPorFrontera(row).frontera_id)"
              >
                <template #cell="{ row: rawRow, column }">
                  <template v-if="column.key === 'pct'">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full w-(--w) rounded-full bg-(--c)"
                          :style="{
                            '--w': asPorFrontera(rawRow).tasa + '%',
                            '--c': grupoColor('Automático (CGM)').texto,
                          }"
                        />
                      </div>
                      <span class="text-right text-xs font-bold"
                        >{{ Math.round(asPorFrontera(rawRow).tasa) }}%</span
                      >
                    </div>
                  </template>
                  <template v-else>{{ rawRow[column.key] }}</template>
                </template>
              </DataTable>
            </div>
          </section>
        </template>

        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          Elige un rango de fechas y pulsa "Buscar".
        </p>
      </GTabsContent>
    </GTabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { ChartData, ChartOptions, Plugin, TooltipItem } from 'chart.js'
import type { LocationQueryValue } from 'vue-router'
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import type {
  EstadoQuoiaReporte,
  FilaReporteEnergia,
  ResumenHistoricoReporteEnergia,
  ResumenReporteEnergiaDia,
} from '~/features/fronteras/types'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { useRoute, useRouter } from 'vue-router'
import { Bar } from 'vue-chartjs'
import { toast } from 'vue-sonner'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de
// `DataTable` (ver `AdminUsuariosView.vue`).
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from '~/components/blocks/DataTable.vue'
// Import explícito: `DatePicker` choca con el `GlobalComponents.DatePicker` que
// declara `primevue/datepicker` (ver `GestionFallasView.vue`) -- sin este
// import, el typecheck resuelve el tag contra el tipo de PrimeVue.
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { ReporteEnergiaService } from '~/features/fronteras/services/reporte-energia'
import ReporteEnergiaDetalleTab from './ReporteEnergiaDetalleTab.vue'
import ReporteEnergiaLista from './ReporteEnergiaLista.vue'
import type { TokenColor } from '~/composables/useThemeColors'
import {
  CircleStopIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PlayIcon,
  SendIcon,
} from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type Semaforo = 'critical' | 'warning' | 'success'

const route = useRoute()
const router = useRouter()
const reporteEnergiaService = new ReporteEnergiaService()

// Bogotá (America/Bogota) es UTC-5 fijo, sin horario de verano -- pero
// calcularlo restando 5h al epoch y leyendo el resultado con getters LOCALES
// (getFullYear/getMonth/getDate) solo da la fecha correcta si el navegador
// ya está en UTC. En un navegador configurado en hora de Bogotá (lo normal
// para el equipo), esos getters locales vuelven a restar la offset -- la
// resta se aplicaba dos veces, y entre medianoche y las 5 a.m. eso rodaba
// "hoy" al día anterior (bug real: 2026-08-04, bloqueaba elegir el 3 de
// agosto). Usar Intl con timeZone explícito da el día calendario correcto
// sin importar en qué zona esté el navegador.
function hoyColombiaISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function sumarDiasISO(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}
function ayerColombiaISO(): string {
  // El reporte siempre es del día ANTERIOR (igual que el pipeline original
  // Reporte-Energia: 'ayer = date.today() - timedelta(days=1)', sin importar
  // qué fecha traiga Quoia) -- ni el día por defecto ni el máximo
  // seleccionable deberían ser "hoy".
  return sumarDiasISO(hoyColombiaISO(), -1)
}
// La clasificación solo se dispara desde "Revisión de hoy", que ya limita
// a "ayer" -- así que una fila con fecha = hoy nunca existe. Historial
// comparte el mismo límite, no porque dispare algo, sino porque no hay
// ningún día actual con datos que mostrar.
const maxFecha = ayerColombiaISO()

function queryString(v: LocationQueryValue | LocationQueryValue[] | undefined): string | null {
  return typeof v === 'string' ? v : null
}

// Restaurar tab/fecha/frontera desde la URL (?tab=&fecha=&frontera_id=) --
// sin esto, entrar al detalle de una Falla desde "Fallas activas del
// proyecto" y volver con el botón "atrás" remontaba esta vista desde cero
// (fecha=ayer, sin frontera elegida), obligando a rebuscarla a mano.
const tabInicial = route.query.tab === 'historial' ? 1 : 0
const activeTab = ref(tabInicial)
const fecha = ref((tabInicial === 0 && queryString(route.query.fecha)) || ayerColombiaISO())
const fechaHistorial = ref(
  (tabInicial === 1 && queryString(route.query.fecha)) || ayerColombiaISO(),
)

const fechaISO = computed(() => fecha.value)
const fechaHistorialISO = computed(() => fechaHistorial.value)

const resumen = ref<ResumenReporteEnergiaDia | null>(null)
const filas = ref<FilaReporteEnergia[]>([])
const loadingLista = ref(true)
const filtroSemaforo = ref<Semaforo | null>(null)

const filasHistorial = ref<FilaReporteEnergia[]>([])
const loadingHistorial = ref(false)

const generandoExcel = ref(false)
const enviando = ref(false)
const ejecutando = ref(false)
const deteniendo = ref(false)

const estadoQuoia = ref<EstadoQuoiaReporte | null>(null)
const estadoQuoiaPolling = ref(false)
let estadoQuoiaTimer: ReturnType<typeof setInterval> | null = null

// ── Resumen histórico (patrones por rango de fechas, no un solo día) ──────
const resumenHasta = ref(ayerColombiaISO())
const resumenDesde = ref(sumarDiasISO(ayerColombiaISO(), -29))
const resumenHistorico = ref<ResumenHistoricoReporteEnergia | null>(null)
const loadingResumenHistorico = ref(false)
const fronteraResumen = ref<number | null>(null)
const fronteraResumenStr = computed<string | null>({
  get: () => (fronteraResumen.value != null ? String(fronteraResumen.value) : null),
  set: (v) => {
    fronteraResumen.value = v ? Number(v) : null
  },
})

interface FronteraDelResumen {
  frontera_id: number
  nombre_proyecto: string
}

// Opciones del selector. Salen de la última consulta SIN filtro: la respuesta
// ya trae todas las fronteras del rango con su nombre, así que no hace falta
// pedir el catálogo aparte. Con el filtro puesto la respuesta trae una sola,
// por eso la lista se conserva en vez de recalcularse en cada carga.
//
// Se arma con los detalles de fuente y no con `por_frontera`, que solo cuenta
// los días que entran en la tasa: una frontera cuyos días quedaron todos
// excluidos no aparece ahí, y es justo una que se querría poder mirar sola.
const fronterasDelResumen = ref<FronteraDelResumen[]>([])
const opcionesFronterasResumen = computed<ComboBoxOption[]>(() =>
  fronterasDelResumen.value.map((f) => ({
    value: String(f.frontera_id),
    label: f.nombre_proyecto,
  })),
)

function fronterasDe(resumen: ResumenHistoricoReporteEnergia | null): FronteraDelResumen[] {
  const porId = new Map<number, FronteraDelResumen>()
  for (const d of [
    ...(resumen?.detalle_fuente_generacion || []),
    ...(resumen?.detalle_fuente_consumo || []),
  ]) {
    if (!porId.has(d.frontera_id)) {
      porId.set(d.frontera_id, {
        frontera_id: d.frontera_id,
        nombre_proyecto: (d.nombre_proyecto as string | undefined) || '',
      })
    }
  }
  return [...porId.values()].sort((a, b) => a.nombre_proyecto.localeCompare(b.nombre_proyecto))
}

const resumenDesdeISO = computed(() => resumenDesde.value)
const resumenHastaISO = computed(() => resumenHasta.value)

async function cargarResumenHistorico() {
  loadingResumenHistorico.value = true
  grupoSeleccionadoGen.value = null
  grupoSeleccionadoCon.value = null
  try {
    resumenHistorico.value = await reporteEnergiaService.obtenerResumenHistorico(
      resumenDesdeISO.value,
      resumenHastaISO.value,
      fronteraResumen.value,
    )
    if (!fronteraResumen.value) {
      fronterasDelResumen.value = fronterasDe(resumenHistorico.value)
    }
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
    resumenHistorico.value = null
  } finally {
    loadingResumenHistorico.value = false
  }
}

// Colores suaves por grupo (decidido con el usuario 2026-08-21) -- mismos
// 3 tonos (verde/ámbar/rosa) se reusan como semáforo de severidad en las
// tablas de abajo, así que "Medidor"/"bajo % de problema" y "Estimación"/
// "% medio" comparten intención visual aunque sean secciones distintas.
const { color } = useThemeColors()

interface GrupoTono {
  token: TokenColor
  alpha?: number
}
const GRUPO_COLOR: Record<string, GrupoTono> = {
  // CGM en verde oscuro y Medidor en verde medio: son la misma familia --dato
  // medido-- y el tono mas fuerte es el de mayor respaldo. Separados desde el
  // 2026-09-14; antes iban los dos en la misma barra.
  CGM: { token: 'success' },
  Medidor: { token: 'success', alpha: 0.65 },
  Inversor: { token: 'primary' },
  // Morado y no otro verde: un Excel de un tercero o el dato de otra empresa
  // NO son una medicion nuestra, y el color no debe sugerir que si.
  'Reportado por terceros': { token: 'unergy-purple' },
  Estimación: { token: 'warning' },
  // Las dos barras del grafico de automatizacion. El verde del CGM es el mismo
  // de su barra en los otros dos graficos: es el mismo dato, visto de otra forma.
  'Automático (CGM)': { token: 'success' },
  'Otra fuente': { token: 'muted-foreground' },
  // "Apagado" es un estado confirmado (el proyecto no genera), no una
  // estimación de dato faltante -- tono neutro propio, distinto de
  // Estimación (pedido 2026-08-21).
  Apagado: { token: 'muted-foreground' },
  'Sin fuente': { token: 'destructive' },
  Otro: { token: 'foreground', alpha: 0.7 },
}
const GRUPO_OTRO: GrupoTono = { token: 'foreground', alpha: 0.7 }
function tono(t: GrupoTono): string {
  return color(t.token, t.alpha)
}
function grupoColor(etiqueta: string): { texto: string } {
  return { texto: tono(GRUPO_COLOR[etiqueta] ?? GRUPO_OTRO) }
}

interface ConteoGrupo {
  etiqueta: string
  total: number
}
interface ConteoGrupoPct extends ConteoGrupo {
  pct: number
}

function pctDe(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0
}
function totalDias(items: ConteoGrupo[]): number {
  return items.reduce((s, i) => s + i.total, 0)
}
function conPct(items: ConteoGrupo[]): ConteoGrupoPct[] {
  const total = totalDias(items)
  return items.map((i) => ({ ...i, pct: total ? Math.round((i.total / total) * 100) : 0 }))
}
const kpiGen = computed(() => conPct(resumenHistorico.value?.distribucion_fuente_generacion || []))
const kpiCon = computed(() => conPct(resumenHistorico.value?.distribucion_fuente_consumo || []))

/**
 * Cuanto del reporte salio automatico por CGM.
 *
 * Pregunta distinta de la de los otros dos graficos: esos dicen DE DONDE salio
 * el dato, este dice CUANTO salio solo. Es la metrica para saber si la
 * automatizacion avanza.
 *
 * Generacion y consumo van juntos --el backend ya los suma-- porque lo que se
 * mide es el reporte entero, no una de sus mitades. Los dias EXCLUIDOS no
 * entran en ninguno de los dos lados: no se reportaron a proposito, asi que no
 * son ni un exito ni un fallo de la automatizacion.
 */
type SerieAutomatico = ResumenHistoricoReporteEnergia['serie_automatico']
const SERIE_AUTOMATICO_VACIA: SerieAutomatico = {
  dias: [],
  dias_contados: 0,
  dias_excluidos: 0,
  automaticas: 0,
  fronteras: 0,
  tasa: 0,
  por_frontera: [],
}
const auto = computed<SerieAutomatico>(
  () => resumenHistorico.value?.serie_automatico || SERIE_AUTOMATICO_VACIA,
)

/**
 * Las dos barras, sobre las fronteras que DEBIAN reportar.
 *
 * El denominador ya no son "las que reportaron" sino las registradas en ASIC:
 * registrada, una frontera tiene que reportar todos los dias asi sea una
 * matriz de ceros, y antes una que no reportaba nada salia de los dos lados de
 * la division -- el peor caso posible, invisible.
 */
const kpiAuto = computed<ConteoGrupoPct[]>(() => {
  const a = auto.value
  if (!a.fronteras) return []
  return conPct([
    { etiqueta: 'Automático (CGM)', total: a.automaticas },
    { etiqueta: 'Otra fuente', total: a.fronteras - a.automaticas },
  ])
})

// Barras separadas (no apiladas) -- comparar el tamaño de cada grupo es
// más preciso con una escala común en 0 que con segmentos de un stacked
// bar (decidido con el usuario 2026-08-21). El % exacto se dibuja encima
// de cada barra con un plugin liviano en vez de agregar chartjs-plugin-
// datalabels como dependencia nueva solo para esto.
const dataLabelPlugin: Plugin<'bar'> = {
  id: 'pctLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    chart.data.datasets.forEach((dataset, i) => {
      chart.getDatasetMeta(i).data.forEach((bar, index) => {
        ctx.save()
        ctx.fillStyle = color('foreground')
        ctx.font = '700 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${dataset.data[index]}%`, bar.x, bar.y - 8)
        ctx.restore()
      })
    })
  },
}
function chartDeGrupos(items: ConteoGrupoPct[]): ChartData<'bar'> {
  return {
    labels: items.map((i) => i.etiqueta),
    datasets: [
      {
        data: items.map((i) => i.pct),
        backgroundColor: items.map((i) => grupoColor(i.etiqueta).texto),
        borderRadius: 6,
        maxBarThickness: 70,
      },
    ],
  }
}
/**
 * Opciones del grafico de barras.
 *
 * `tipo` null = sin desglose por grupo: no se arma el `onClick` ni se cambia el
 * cursor. Un grafico que invita a hacer clic y no hace nada es peor que uno
 * que no invita.
 */
function chartOptionsPara(
  tipo: 'gen' | 'con' | null,
  items: ConteoGrupoPct[],
  unidad = 'días',
): ChartOptions<'bar'> {
  const opciones: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => `${items[ctx.dataIndex]!.total} ${unidad}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 11, weight: 600 }, color: color('muted-foreground') },
        grid: { display: false },
      },
      y: { display: false, beginAtZero: true, max: 100 },
    },
  }
  if (tipo) {
    opciones.onClick = (_evt, elements) => {
      if (!elements.length) return
      toggleGrupo(tipo, items[elements[0]!.index]!.etiqueta)
    }
    opciones.onHover = (evt, elements) => {
      if (evt.native?.target instanceof HTMLElement) {
        evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'
      }
    }
  }
  return opciones
}
const chartGen = computed(() => chartDeGrupos(kpiGen.value))
const chartCon = computed(() => chartDeGrupos(kpiCon.value))
const chartOptionsGen = computed(() => chartOptionsPara('gen', kpiGen.value))
const chartOptionsCon = computed(() => chartOptionsPara('con', kpiCon.value))
const chartAuto = computed(() => chartDeGrupos(kpiAuto.value))
// Sin `onClick`: este grafico ya no tiene desglose por grupo -- la tabla de
// abajo muestra TODAS las fronteras siempre. Dejar el clic vivo seria un
// gesto que no hace nada.
const chartOptionsAuto = computed(() => chartOptionsPara(null, kpiAuto.value, 'reportes'))

// Semáforo de severidad del drill-down por fuente: acá un % más alto es
// PEOR, al revés que en las tarjetas KPI, por eso tiene su propia escala en
// vez de invertir un solo número.
function severidadColor(pct: number): string {
  return pct > 30
    ? tono(GRUPO_COLOR['Sin fuente']!)
    : pct > 10
      ? tono(GRUPO_COLOR['Estimación']!)
      : tono(GRUPO_COLOR['Medidor']!)
}
// Solo lo crítico (rojo) lleva píldora de color -- pintar también lo que
// está bien generaba demasiado ruido visual, 30 píldoras de colores
// compitiendo por atención en una sola tabla (pedido 2026-08-21). Lo que
// no es crítico se muestra en texto plano gris, sin fondo.
/**
 * Como se muestra que una fuente (medidor principal/respaldo, inversores) llego
 * incompleta en el rango.
 *
 * Antes decia siempre `N de M · P%`, y el porcentaje se leia como "que TAN
 * incompleta llego" cuando en realidad es "en que PROPORCION DE SUS DIAS llego
 * incompleta". Un 100% podia ser una sola hora faltante cada dia.
 *
 * Peor: cuando la frontera tiene un solo dia con dato --el caso normal al mirar
 * una fecha puntual, que es como se usa esta pantalla-- el porcentaje solo puede
 * dar 0% o 100%. No aporta nada y confunde. Ahi va un simbolo y ya.
 *
 * Con varios dias el numero SI sirve, porque distingue "fallo un dia" de "fallo
 * todos" -- que es lo que permite priorizar. Se muestra como fraccion y sin
 * porcentaje: `3 de 30 dias` dice la proporcion sin poder leerse mal.
 *
 * `dias` es dias_con_fila de ESA frontera, no el largo del rango: una frontera
 * con un solo dia de datos dentro de un rango de 30 tiene el mismo problema.
 */

interface DetalleFuenteRow {
  grupo: string
  frontera_id: number
  nombre_proyecto: string
  dias_totales: number
  dias_grupo: number
  desglose?: { etiqueta: string; dias: number }[]
}
function asDetalleFuente(row: DataTableRow): DetalleFuenteRow {
  return row as unknown as DetalleFuenteRow
}
interface PorFronteraRow {
  frontera_id: number
  nombre_proyecto: string
  dias: number
  automaticos: number
  tasa: number
}
function asPorFrontera(row: DataTableRow): PorFronteraRow {
  return row as unknown as PorFronteraRow
}
function columnasDetalle(grupo: string | null): DataTableColumn[] {
  return [
    { key: 'nombre_proyecto', header: 'Proyecto / frontera' },
    { key: 'dias_totales', header: 'Días totales' },
    { key: 'dias_grupo', header: `Días en ${(grupo || '').toLowerCase()}` },
    { key: 'pct', header: '% del tiempo' },
    { key: 'fuentes', header: 'Fuente(s) usadas' },
  ]
}
const columnasAutomatico: DataTableColumn[] = [
  { key: 'nombre_proyecto', header: 'Proyecto / frontera' },
  { key: 'dias', header: 'Días' },
  { key: 'automaticos', header: 'Automáticos' },
  { key: 'pct', header: '% automático' },
]

// Drill-down por frontera al hacer clic en una tarjeta KPI -- independiente
// para Generación/Consumo, ya que son secciones separadas en la misma vista.
const grupoSeleccionadoGen = ref<string | null>(null)
const grupoSeleccionadoCon = ref<string | null>(null)

const SELECCION_POR_TIPO = {
  gen: grupoSeleccionadoGen,
  con: grupoSeleccionadoCon,
}

function toggleGrupo(tipo: 'gen' | 'con', etiqueta: string) {
  const actual = SELECCION_POR_TIPO[tipo]
  actual.value = actual.value === etiqueta ? null : etiqueta
}
const DETALLE_POR_TIPO = {
  gen: 'detalle_fuente_generacion',
  con: 'detalle_fuente_consumo',
} as const

function detalleFiltrado(tipo: 'gen' | 'con'): DetalleFuenteRow[] {
  const grupo = SELECCION_POR_TIPO[tipo].value
  const detalle = resumenHistorico.value?.[DETALLE_POR_TIPO[tipo]] as DetalleFuenteRow[] | undefined
  if (!grupo || !detalle) return []
  return detalle.filter((d) => d.grupo === grupo).sort((a, b) => b.dias_grupo - a.dias_grupo)
}

// Salta a "Historial" en la fecha 'hasta' del rango consultado y selecciona
// esa frontera -- si esa fecha puntual no tiene fila para ella (pudo no
// generar/reportar justo ese día), se avisa en vez de fallar en silencio.
async function irAFronteraHistorial(frontera_id: number) {
  activeTab.value = 1
  fechaHistorial.value = resumenHasta.value
  await cargarHistorial()
  const f = filasHistorial.value.find((x) => x.frontera_id === frontera_id)
  if (f) {
    seleccionHistorial.value = f
  } else {
    toast.info('Sin fila en esa fecha', {
      description:
        'Esta frontera no tiene reporte en la fecha "hasta" del rango -- prueba con otra fecha en Historial.',
      duration: 5000,
    })
  }
}

async function cargarResumen() {
  try {
    resumen.value = await reporteEnergiaService.obtenerResumen(fechaISO.value)
  } catch {
    resumen.value = null
  }
}

async function cargarLista(silent = false) {
  if (!silent) loadingLista.value = true
  try {
    filas.value = await reporteEnergiaService.listarFronteras(fechaISO.value)
  } catch {
    if (!silent) {
      toast.error('Error', {
        description: 'No se pudo cargar el reporte de ese día.',
        duration: 4000,
      })
      filas.value = []
    }
  } finally {
    if (!silent) loadingLista.value = false
  }
}

/** `@actualizado` de "Revisión de hoy": refresca en silencio, ver `cargarLista()`. */
function onActualizadoHoy() {
  cargarLista(true)
  cargarResumen()
}

// `silent` existe por la misma razón que en cargarLista(): refrescar la lista
// tras guardar/validar NO debe pasar por el spinner. El `.workspace` del
// Historial es el `v-else-if` de la cadena que abre `loadingHistorial`, así
// que ponerlo en true destruye ese subárbol -- y con él el detalle, que al
// recrearse vuelve a montar y relanza cargar()/cargarExclusiones()/
// cargarCurvaTipicaPreview(). El efecto era que validar una frontera desde
// Historial recargaba el panel entero y perdía el scroll, mientras que la
// misma acción en 'Revisión de hoy' no lo hacía: ese handler sí llamaba
// cargarLista(true). El botón "Ver" lo sigue llamando sin argumento, donde el
// spinner sí corresponde: ahí se está cambiando de día.
//
// El `catch` también respeta `silent`: vaciar filasHistorial en un refresco de
// fondo tumbaría el panel por un fallo de red pasajero (`v-else-if` de arriba),
// justo cuando la persona acaba de guardar algo.
async function cargarHistorial(silent = false) {
  if (!silent) loadingHistorial.value = true
  try {
    filasHistorial.value = await reporteEnergiaService.listarFronteras(fechaHistorialISO.value)
  } catch {
    if (!silent) filasHistorial.value = []
  } finally {
    if (!silent) loadingHistorial.value = false
  }
}

// Estado en Quoia (aprobación de XM sobre lo YA enviado) -- GET liviano
// para mostrar lo que ya se sabe (sin golpear Quoia) al entrar o cambiar
// de fecha; si hay algo todavía 'en_espera' de un envío anterior, retoma
// el polling solo. detenerPollingEstadoQuoia() no borra estadoQuoia -- el
// panel se queda visible con el último estado conocido, solo deja de
// refrescarse (pedido 2026-08-21).
async function cargarEstadoQuoiaActual() {
  try {
    const data = await reporteEnergiaService.obtenerEstadoQuoia(fechaISO.value)
    estadoQuoia.value = data.total > 0 ? data : null
    if (estadoQuoia.value && estadoQuoia.value.en_espera > 0) iniciarPollingEstadoQuoia()
  } catch {
    estadoQuoia.value = null
  }
}

async function revisarEstadoQuoia() {
  try {
    const data = await reporteEnergiaService.revisarEstadoQuoia(fechaISO.value)
    estadoQuoia.value = data
    if (data.en_espera === 0) detenerPollingEstadoQuoia()
  } catch {
    // silencioso -- se reintenta en el próximo tick del polling
  }
}

function iniciarPollingEstadoQuoia() {
  if (estadoQuoiaTimer) return
  estadoQuoiaPolling.value = true
  estadoQuoiaTimer = setInterval(revisarEstadoQuoia, 2 * 60 * 1000)
}
function detenerPollingEstadoQuoia() {
  estadoQuoiaPolling.value = false
  if (estadoQuoiaTimer) {
    clearInterval(estadoQuoiaTimer)
    estadoQuoiaTimer = null
  }
}
onUnmounted(() => detenerPollingEstadoQuoia())

watch(fecha, () => {
  seleccion.value = null
  cargarResumen()
  cargarLista()
  detenerPollingEstadoQuoia()
  cargarEstadoQuoiaActual()
})

// Busca en la lista ya cargada (de la fecha/tab correctos) la fila que
// coincide con ?frontera_id= de la URL, y la selecciona -- mismo objeto
// `fila` completo que ya usa seleccionar(). Es una function declaration
// (hoisted) y su CUERPO solo corre dentro de onMounted, después de que
// seleccion/seleccionHistorial (declaradas más abajo) ya existen -- así que
// referenciarlas acá adentro es seguro aunque la declaración esté después.
function restaurarSeleccionDesdeQuery() {
  const raw = queryString(route.query.frontera_id)
  const fid = raw ? Number(raw) : null
  if (!fid) return
  if (activeTab.value === 1) {
    const f = filasHistorial.value.find((x) => x.frontera_id === fid)
    if (f) seleccionHistorial.value = f
  } else {
    const f = filas.value.find((x) => x.frontera_id === fid)
    if (f) seleccion.value = f
  }
}

onMounted(async () => {
  await Promise.all([cargarResumen(), cargarLista(), cargarEstadoQuoiaActual()])
  if (activeTab.value === 1) await cargarHistorial()
  restaurarSeleccionDesdeQuery()
})

function semaforo(f: FilaReporteEnergia): Semaforo {
  if (f.revisar_manualmente) return 'critical'
  if (['1', 'CGM'].includes(String(f.caso))) return 'success'
  return 'warning'
}

// Mismo criterio que `stats`: el filtro de las tarjetas tiene que aplicar
// sobre la lista que se está viendo, no siempre sobre 'hoy' -- si no, un
// click en una tarjeta mientras se está en Historial no hacía nada (la
// lista de Historial leía `filasHistorial` sin pasar por este filtro).
const filasFiltradas = computed(() => {
  const base = activeTab.value === 1 ? filasHistorial.value : filas.value
  if (!filtroSemaforo.value) return base
  return base.filter((f) => semaforo(f) === filtroSemaforo.value)
})

interface Stat {
  label: string
  value: number
  color: string
  filtro: Semaforo | null
}

const stats = computed<Stat[]>(() => {
  // Las tarjetas deben reflejar el día que se está viendo -- 'Revisión de
  // hoy' usa `filas` (fecha), 'Historial' usa `filasHistorial`
  // (fechaHistorial). Antes siempre mostraban `filas`, así que al cambiar
  // de día en Historial las tarjetas se quedaban con el conteo de 'hoy'.
  const all = activeTab.value === 1 ? filasHistorial.value : filas.value
  return [
    { label: 'Total', value: all.length, color: 'text-foreground', filtro: null },
    {
      label: 'Revisar',
      value: all.filter((f) => f.revisar_manualmente).length,
      color: 'text-destructive',
      filtro: 'critical',
    },
    {
      label: 'Corregido automático',
      value: all.filter((f) => semaforo(f) === 'warning').length,
      color: 'text-warning',
      filtro: 'warning',
    },
    {
      label: 'Reporte válido',
      value: all.filter((f) => semaforo(f) === 'success').length,
      color: 'text-success',
      filtro: 'success',
    },
  ]
})

// ── Selección (vista dividida: lista + detalle) ───────────────────────────
const seleccion = ref<FilaReporteEnergia | null>(null)
const seleccionHistorial = ref<FilaReporteEnergia | null>(null)

function seleccionar(fila: FilaReporteEnergia, origen: 'hoy' | 'historial') {
  if (origen === 'historial') seleccionHistorial.value = fila
  else seleccion.value = fila
}

// Refleja tab/fecha/frontera elegidos en la URL (router.replace, no push --
// mismo patrón que los filtros de Fronteras/GESCON: no ensucia el historial
// con cada clic, solo deja la URL reconstruible si se navega afuera y se
// vuelve). IMPORTANTE: este watch() arma su arreglo de fuentes con
// `seleccion`/`seleccionHistorial` en el momento en que esta línea se
// ejecuta -- por eso va DESPUÉS de sus `const` (a diferencia de una función,
// un array-literal de argumentos no es diferido). Ponerlo antes de esas
// declaraciones tiró la vista entera con "Cannot access before
// initialization" (2026-08-18).
watch([activeTab, seleccion, seleccionHistorial, fecha, fechaHistorial], () => {
  const query: Record<string, string | number> = {
    tab: activeTab.value === 1 ? 'historial' : 'hoy',
  }
  if (activeTab.value === 1) {
    query.fecha = fechaHistorialISO.value
    if (seleccionHistorial.value) query.frontera_id = seleccionHistorial.value.frontera_id
  } else {
    query.fecha = fechaISO.value
    if (seleccion.value) query.frontera_id = seleccion.value.frontera_id
  }
  router.replace({ query })
})

// ── Acciones globales ──────────────────────────────────────────────────
async function ejecutarClasificacion() {
  ejecutando.value = true
  try {
    await reporteEnergiaService.ejecutarClasificacion(fechaISO.value)
    toast.info('Clasificación iniciada', {
      description:
        'Corre en segundo plano -- puede tardar varios minutos si hay medidores incompletos. La tabla se va a ir actualizando sola.',
      duration: 6000,
    })
    sondearResultado()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
    ejecutando.value = false
  }
}

// Cooperativo, no inmediato: el backend revisa esta señal entre frontera y
// frontera (ver orquestador._CANCELAR), nunca corta a media frontera. El
// sondeo ya en curso (sondearResultado) es el que detecta cuándo realmente
// paró y apaga el spinner.
async function detenerClasificacion() {
  deteniendo.value = true
  try {
    await reporteEnergiaService.cancelarClasificacion(fechaISO.value)
    toast.info('Deteniendo…', {
      description: 'Se detiene después de terminar la frontera en curso, no de inmediato.',
      duration: 5000,
    })
  } catch {
    toast.error('Error', { description: 'No se pudo pedir la detención.', duration: 4000 })
  } finally {
    deteniendo.value = false
  }
}

// La corrida real vive en un hilo del backend (ver orquestador.ejecutar_dia_background)
// y guarda avance parcial cada 5 fronteras -- con ~100+ fronteras puede tardar bastante
// más de lo que un límite fijo de intentos alcanzaría a cubrir. En vez de un tope de
// tiempo, se sigue sondeando MIENTRAS el conteo de filas siga creciendo; solo se
// rinde si pasan varios ciclos seguidos sin ver ninguna fila nueva (terminó o se colgó).
function sondearResultado() {
  const fechaSondeada = fechaISO.value
  let totalAntes = filas.value.length
  let ciclosSinCambio = 0
  const MAX_CICLOS_SIN_CAMBIO = 12 // ~2 minutos sin avance -- ahí sí se rinde

  const intervalo = setInterval(async () => {
    if (fechaISO.value !== fechaSondeada) {
      clearInterval(intervalo)
      ejecutando.value = false
      return
    }
    await cargarResumen()
    await cargarLista(true)
    if (filas.value.length > totalAntes) {
      totalAntes = filas.value.length
      ciclosSinCambio = 0
    } else {
      ciclosSinCambio += 1
    }
    if (ciclosSinCambio >= MAX_CICLOS_SIN_CAMBIO) {
      clearInterval(intervalo)
      ejecutando.value = false
      avisarSiHuboFallidas(fechaSondeada)
    }
  }, 10000)
}

// Una vez el sondeo se rinde (dejó de crecer el conteo de filas), se asume
// que la corrida terminó -- se consulta el resultado real guardado por
// ejecutar_dia_background (ver GET /ejecutar/estado) para avisar si alguna
// frontera falló, en vez del silencio actual donde eso solo queda en los
// logs de Railway.
async function avisarSiHuboFallidas(fechaSondeada: string) {
  try {
    const data = await reporteEnergiaService.obtenerEstadoEjecucion(fechaSondeada)
    if (data.error_general) {
      toast.error('Clasificación interrumpida', { description: data.error_general, duration: 8000 })
    } else if (data.cancelado) {
      toast.warning('Clasificación detenida', {
        description: data.fallidas.length
          ? `Se detuvo manualmente. Además, ${data.fallidas.length} fronteras fallaron antes de detenerse: ${data.fallidas.join(', ')}`
          : 'Se detuvo manualmente antes de terminar todas las fronteras.',
        duration: 8000,
      })
    } else if (data.fallidas.length) {
      toast.warning('Clasificación terminada con errores', {
        description: `${data.fallidas.length} fronteras fallaron y quedaron marcadas para revisar: ${data.fallidas.join(', ')}`,
        duration: 8000,
      })
    }
  } catch {
    // silencioso -- esto es un aviso adicional, no debe interrumpir el flujo normal
  }
}

async function generarExcel() {
  generandoExcel.value = true
  try {
    const blob = await reporteEnergiaService.descargarExcel(fechaISO.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-energia-${fechaISO.value}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('Error', { description: 'No se pudo generar el Excel.', duration: 4000 })
  } finally {
    generandoExcel.value = false
  }
}

async function enviarReporte() {
  enviando.value = true
  try {
    const data = await reporteEnergiaService.enviarReporte(fechaISO.value)
    if (data.bloqueado) {
      toast.warning('Envío bloqueado', { description: data.motivo_bloqueo, duration: 5000 })
    } else if (data.fallidos.length) {
      toast.warning('Reporte enviado con fallos', {
        description: `${data.enviados} fronteras enviadas, ${data.fallidos.length} fallidas — ${data.fallidos.join('; ')}`,
        duration: 8000,
      })
    } else {
      toast.success('Reporte enviado', {
        description: `${data.enviados} fronteras enviadas`,
        duration: 3000,
      })
    }
    if (!data.bloqueado) {
      await revisarEstadoQuoia()
      if (estadoQuoia.value && estadoQuoia.value.en_espera > 0) iniciarPollingEstadoQuoia()
    }
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    enviando.value = false
  }
}
</script>
