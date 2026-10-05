<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- ══ TAB BAR ══ -->
    <GTabs v-model="tab">
      <GTabsList variant="outline">
        <GTabsTrigger value="live" variant="outline">
          <ZapIcon class="size-4" /> Tiempo Real
        </GTabsTrigger>
        <GTabsTrigger value="hist" variant="outline">
          <ChartLineIcon class="size-4" /> Histórico
        </GTabsTrigger>
      </GTabsList>
    </GTabs>

    <!-- ══ LIVE TAB ══ -->
    <div v-if="tab === 'live'" class="flex flex-1 flex-col gap-5 overflow-y-auto">
      <!-- ══ HEADER ══ -->
      <div class="flex flex-col gap-3">
        <div>
          <h1 class="text-lg font-extrabold text-foreground">Generación Solar</h1>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Potencia en tiempo real por proyecto
            <!-- Es la hora en que se PREGUNTO, no la del dato. Decirlo evita que
               se lea como frescura: media flota puede estar horas atrasada y
               este numero seguiria diciendo la hora actual. -->
            <span v-if="lastUpdated" class="text-muted-foreground/70"
              >· consultado {{ lastUpdated }}</span
            >
          </p>
        </div>

        <!-- ── Barra de acciones ── -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Filtro por proyecto: escribir filtra la lista, el clic elige.
               Mismo selector que la pestaña Histórico (GeneracionView). -->
          <div class="flex min-w-48 flex-1 items-center gap-1 sm:max-w-xs">
            <Combobox
              v-model="seleccion"
              multiple
              open-on-click
              open-on-focus
              class="min-w-0 flex-1"
            >
              <ComboboxAnchor>
                <ComboboxInput
                  :display-value="
                    (v) =>
                      Array.isArray(v) && v.length
                        ? `${v.length} proyecto${v.length > 1 ? 's' : ''} seleccionado${v.length > 1 ? 's' : ''}`
                        : ''
                  "
                  placeholder="Buscar proyecto..."
                />
              </ComboboxAnchor>
              <ComboboxList>
                <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                <ComboboxViewport>
                  <ComboboxItem
                    v-for="p in opcionesProyectos"
                    :key="p.proyecto_id"
                    :value="p.proyecto_id"
                    :text-value="p.nombre"
                  >
                    <span
                      class="size-2 shrink-0 rounded-full bg-(--status-color)"
                      :style="{ '--status-color': colorComunicacion(p.comunicacion) }"
                      :title="detalleComunicacion(p.comunicacion)"
                      aria-hidden="true"
                    />
                    <TruncatedText :text="p.nombre" class="min-w-0 flex-1" />
                    <ComboboxItemIndicator>
                      <CheckIcon />
                    </ComboboxItemIndicator>
                  </ComboboxItem>
                </ComboboxViewport>
              </ComboboxList>
            </Combobox>
            <Button
              v-if="seleccion.length"
              variant="ghost"
              size="icon-sm"
              aria-label="Quitar filtro de proyectos"
              title="Quitar filtro de proyectos"
              @click="seleccion = []"
            >
              <XIcon />
            </Button>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <!-- Interruptor general del ON/OFF de reconectadores: solo admin -->
            <div
              v-if="interruptor && can('reconectadores:interruptor')"
              class="flex items-center gap-2 rounded-md border border-border px-2.5 py-1"
              :title="tituloInterruptor()"
            >
              <PowerIcon class="size-4 text-muted-foreground" />
              <span class="text-xs font-semibold text-muted-foreground">Comandos ON/OFF</span>
              <GSwitch
                :model-value="interruptor.habilitado"
                :disabled="interruptor.forzado_por_servidor || cambiandoInterruptor"
                @update:model-value="pedirCambioInterruptor"
              />
            </div>
            <!-- Toggle columnas -->
            <ButtonGroup>
              <Button
                v-for="c in OPCIONES_COLUMNAS"
                :key="c.value"
                type="button"
                :variant="cols === c.value ? 'secondary' : 'outline'"
                size="sm"
                :title="`${c.value} columna${c.value > 1 ? 's' : ''}`"
                @click="cols = c.value"
              >
                <component :is="c.icon" class="size-4" />
              </Button>
            </ButtonGroup>
            <!-- Botón actualizar + auto-refresh -->
            <ButtonGroup>
              <Button variant="outline" size="sm" :disabled="loading" @click="cargar">
                <LoaderCircleIcon v-if="loading" class="animate-spin" />
                <RefreshCwIcon v-else />
                Actualizar
              </Button>
              <Select
                :model-value="String(autoInterval)"
                @update:model-value="(v) => setAuto(Number(v))"
              >
                <SelectTrigger size="sm">
                  <ClockIcon />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="0">Desactivado</SelectItem>
                  <SelectItem v-for="opt in autoOptions" :key="opt.ms" :value="String(opt.ms)">
                    Cada {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </ButtonGroup>
          </div>
        </div>
      </div>

      <!-- ══ AVISO: un servicio no respondió ══ -->
      <p v-for="aviso in avisos" :key="aviso" class="text-sm font-medium text-warning">
        {{ aviso }}
      </p>

      <!-- ══ RESUMEN DE COMUNICACIÓN ══ -->
      <!-- Un chip por fuente: un clic filtra, otro lo quita. Naranja (`warning`),
           no rojo: es un aviso para revisar, no una falla confirmada. -->
      <div v-if="proyectos.length" class="flex flex-wrap items-center gap-2">
        <GBadge
          v-for="r in resumenComunicacion"
          :key="r.fuente"
          as="button"
          type="button"
          color="warning"
          :variant="filtroComunicacion === r.fuente ? 'default' : 'outline'"
          class="cursor-pointer gap-1"
          :aria-pressed="filtroComunicacion === r.fuente"
          :title="filtroComunicacion === r.fuente ? 'Quitar filtro' : `Ver solo: ${r.label}`"
          @click="filtroComunicacion = filtroComunicacion === r.fuente ? null : r.fuente"
        >
          {{ r.label }} · {{ r.count }}
          <XIcon v-if="filtroComunicacion === r.fuente" class="size-3" />
        </GBadge>

        <!-- Reconectadores: un clic filtra las tarjetas, otro clic lo quita -->
        <template v-if="resumenReconectadores.length">
          <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <GBadge
            v-for="r in resumenReconectadores"
            :key="r.key"
            as="button"
            type="button"
            :color="r.color"
            :variant="filtroRcn === r.key ? 'default' : 'outline'"
            class="cursor-pointer gap-1"
            :aria-pressed="filtroRcn === r.key"
            :title="filtroRcn === r.key ? 'Quitar filtro' : `Ver solo: ${r.label}`"
            @click="filtroRcn = filtroRcn === r.key ? null : r.key"
          >
            <PowerIcon class="size-3" /> {{ r.label }} · {{ r.count }}
            <XIcon v-if="filtroRcn === r.key" class="size-3" />
          </GBadge>
        </template>
      </div>

      <!-- ══ LOADING inicial ══ -->
      <div
        v-if="loading && !proyectos.length"
        class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
      >
        <LoaderCircleIcon class="size-7 animate-spin text-primary" />
        <span class="text-sm">Cargando proyectos...</span>
      </div>

      <!-- ══ EMPTY ══ -->
      <div
        v-else-if="!loading && !proyectos.length"
        class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
      >
        <SunIcon class="size-8 text-muted-foreground/40" />
        <p class="text-sm">Sin proyectos disponibles</p>
      </div>

      <!-- ══ SIN COINCIDENCIAS ══ -->
      <div
        v-else-if="sinCoincidencias"
        class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
      >
        <SearchIcon class="size-8 text-muted-foreground/40" />
        <p class="text-sm">Ningún proyecto cumple todos los filtros a la vez</p>
        <Button variant="outline" size="sm" @click="quitarFiltros">Quitar filtros</Button>
      </div>

      <!-- ══ PROYECTOS (drag & drop) ══ -->
      <draggable
        v-else
        v-model="proyectos"
        item-key="proyecto_id"
        handle=".sl-drag-handle"
        class="grid grid-cols-(--cols) gap-4"
        :style="{ '--cols': cols }"
        :disabled="hayFiltro"
        @end="saveOrder"
      >
        <template #item="{ element: proy }">
          <div
            v-show="matchesFiltro(proy)"
            :ref="(el) => observarTarjeta(el as Element | null, proy.proyecto_id)"
            class="min-w-0"
          >
            <Card size="sm">
              <CardContent class="flex flex-col gap-3">
                <!-- Nombre + estado -->
                <div class="flex items-center gap-2 text-sm font-extrabold text-foreground">
                  <MenuIcon
                    class="sl-drag-handle size-4 shrink-0 cursor-grab text-muted-foreground/50 hover:text-primary active:cursor-grabbing"
                    title="Arrastrar para reorganizar"
                  />
                  <span
                    class="size-2 shrink-0 rounded-full bg-(--status-color)"
                    :style="{ '--status-color': colorComunicacion(proy.comunicacion) }"
                    :title="detalleComunicacion(proy.comunicacion)"
                  />
                  <TruncatedText :text="proy.nombre" class="min-w-0 flex-1" />
                  <span
                    v-if="etiquetaComunicacion(proy.comunicacion)"
                    class="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    :title="detalleComunicacion(proy.comunicacion)"
                  >
                    {{ etiquetaComunicacion(proy.comunicacion) }}
                  </span>
                </div>

                <!-- Cargando detalle -->
                <div
                  v-if="!detailMap[proy.proyecto_id]"
                  class="flex items-center gap-2 py-2 text-xs text-muted-foreground"
                >
                  <LoaderCircleIcon class="size-3.5 animate-spin" />
                  <span>Cargando datos...</span>
                </div>

                <template v-else>
                  <!-- % diferencia inversores vs medidores (mejor nodo) -->
                  <div
                    v-if="getDiffPct(proy.proyecto_id) !== null"
                    class="flex items-center gap-2 text-xs"
                  >
                    <span class="text-muted-foreground">Inversores vs medidor</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-bold"
                      :class="
                        Math.abs(getDiffPct(proy.proyecto_id)!) > 5
                          ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success'
                      "
                    >
                      {{ getDiffPct(proy.proyecto_id)! > 0 ? '+' : ''
                      }}{{ getDiffPct(proy.proyecto_id) }}%
                    </span>
                  </div>

                  <!-- Gráficas -->
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <!-- Inversores -->
                    <div
                      class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <div
                        class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        <span class="size-2 shrink-0 rounded-full bg-primary" />
                        Inversores
                        <span
                          v-if="irradianciaMap[proy.proyecto_id]"
                          class="ml-auto flex items-center gap-1 font-medium tracking-normal normal-case"
                          title="Irradiancia POA de la estación (eje derecho, W/m²)"
                        >
                          <span class="h-0.5 w-3 rounded-full bg-chart-4" />
                          Irradiancia POA
                        </span>
                      </div>
                      <!-- Mismo tratamiento que Medidores: el acumulado del dia en
                     grande, con hasta que hora cubre. Son horas sumadas, no una
                     lectura del ultimo instante. -->
                      <div class="flex items-baseline gap-2">
                        <span
                          class="text-xl font-bold tabular-nums"
                          :class="
                            acumuladoInversores(detailMap[proy.proyecto_id]) === null
                              ? 'text-muted-foreground'
                              : 'text-foreground'
                          "
                        >
                          {{ fmtKwh(acumuladoInversores(detailMap[proy.proyecto_id])) }}
                        </span>
                        <span
                          v-if="hastaInversores(detailMap[proy.proyecto_id])"
                          class="text-xs text-muted-foreground"
                        >
                          hasta {{ hastaInversores(detailMap[proy.proyecto_id]) }}
                          <template v-if="haceCuanto(hastaInversores(detailMap[proy.proyecto_id]))">
                            · {{ haceCuanto(hastaInversores(detailMap[proy.proyecto_id])) }}
                          </template>
                        </span>
                      </div>
                      <div
                        v-if="getInversorData(proy.proyecto_id).labels.length"
                        class="relative h-45"
                      >
                        <Line
                          :key="'inv-' + proy.proyecto_id"
                          :data="getInversorData(proy.proyecto_id)"
                          :options="chartOptionsInv(proy.proyecto_id)"
                          :plugins="[crosshairPlugin]"
                        />
                      </div>
                      <div
                        v-else
                        class="flex h-45 items-center justify-center text-sm text-muted-foreground"
                      >
                        Sin datos
                      </div>
                    </div>

                    <!-- Medidores -- el backend ya eligio cual mostrar -->
                    <div
                      class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <template v-if="panelesMedidor[proy.proyecto_id]">
                        <div
                          class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"
                        >
                          <span class="size-2 shrink-0 rounded-full bg-warning" />
                          Medidores
                          <Badge v-if="panelesMedidor[proy.proyecto_id]!.tipo" variant="outline">{{
                            panelesMedidor[proy.proyecto_id]!.tipo
                          }}</Badge>
                          <span
                            v-if="irradianciaMap[proy.proyecto_id]"
                            class="ml-auto flex items-center gap-1 font-medium tracking-normal normal-case"
                            title="Irradiancia POA de la estación (eje derecho, W/m²)"
                          >
                            <span class="h-0.5 w-3 rounded-full bg-chart-4" />
                            Irradiancia POA
                          </span>
                        </div>
                        <!-- El numero grande es la generacion del dia: es lo que alguien
                       quiere saber de un vistazo, y no se cae a cero de noche como
                       la potencia instantanea. Sale del contador, con su hora. -->
                        <div class="flex items-baseline gap-2">
                          <span
                            class="text-xl font-bold tabular-nums"
                            :class="
                              panelesMedidor[proy.proyecto_id]!.energiaKwh === null
                                ? 'text-muted-foreground'
                                : 'text-foreground'
                            "
                          >
                            {{ fmtKwh(panelesMedidor[proy.proyecto_id]!.energiaKwh) }}
                          </span>
                          <span
                            v-if="panelesMedidor[proy.proyecto_id]!.energiaHasta"
                            class="text-xs text-muted-foreground"
                          >
                            hasta {{ panelesMedidor[proy.proyecto_id]!.energiaHasta }}
                            <template
                              v-if="haceCuanto(panelesMedidor[proy.proyecto_id]!.energiaHasta)"
                            >
                              · {{ haceCuanto(panelesMedidor[proy.proyecto_id]!.energiaHasta) }}
                            </template>
                          </span>
                        </div>
                        <div v-if="panelesMedidor[proy.proyecto_id]!.chart" class="relative h-45">
                          <Line
                            :key="'med-' + proy.proyecto_id"
                            :data="panelesMedidor[proy.proyecto_id]!.chart!"
                            :options="chartOptionsMed(proy.proyecto_id)"
                            :plugins="[crosshairPlugin]"
                          />
                        </div>
                        <div
                          v-else
                          class="flex h-45 items-center justify-center text-sm text-muted-foreground"
                        >
                          Sin datos
                        </div>
                      </template>
                      <div
                        v-else
                        class="flex h-45 items-center justify-center text-sm text-muted-foreground"
                      >
                        Sin medidor
                      </div>
                    </div>
                  </div>

                  <!-- Reconectador: estado + telemetría en vivo (SolarView) -->
                  <ReconectadorPanel
                    v-if="rcnMap[proy.proyecto_id]"
                    :relay="rcnMap[proy.proyecto_id]!"
                    :puede-reconectar="can('reconectadores:command')"
                    :recargando="recargandoEstados"
                    :pendiente="!!pendientes[proy.proyecto_id]"
                    @reconectar="abrirReconectar(proy)"
                    @refrescar="cargarEstados"
                  />

                  <!-- ── Generación de hoy ── -->
                  <div class="flex flex-col gap-2 border-t border-border pt-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span
                        class="flex items-center gap-1.5 text-xs font-bold tracking-wide text-warning uppercase"
                      >
                        <SunIcon class="size-3" />
                        Generación de hoy
                      </span>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span
                          class="text-xs font-bold"
                          :class="
                            getGenHoy(proy.proyecto_id).pct === null
                              ? 'text-muted-foreground'
                              : getGenHoy(proy.proyecto_id).pct! >= 100
                                ? 'text-success'
                                : getGenHoy(proy.proyecto_id).pct! >= 75
                                  ? 'text-warning'
                                  : 'text-destructive'
                          "
                        >
                          {{ getGenHoy(proy.proyecto_id).real.toLocaleString('es-CO') }} kWh
                        </span>
                        <span class="text-xs text-muted-foreground">/</span>
                        <span class="text-xs text-muted-foreground">
                          {{ getGenHoy(proy.proyecto_id).p90.toLocaleString('es-CO') }} kWh P90
                        </span>
                        <span
                          v-if="getGenHoy(proy.proyecto_id).pct !== null"
                          class="text-xs font-bold"
                          :class="
                            getGenHoy(proy.proyecto_id).pct! >= 100
                              ? 'text-success'
                              : getGenHoy(proy.proyecto_id).pct! >= 75
                                ? 'text-warning'
                                : 'text-destructive'
                          "
                        >
                          {{ getGenHoy(proy.proyecto_id).pct }}%
                        </span>
                        <Badge
                          v-if="getGenHoy(proy.proyecto_id).fuente === 'inversor'"
                          variant="secondary"
                          title="Dato de inversores"
                          >INV</Badge
                        >
                        <Badge
                          v-else-if="getGenHoy(proy.proyecto_id).fuente === 'medidor'"
                          variant="secondary"
                          title="Dato de medidor de frontera"
                          >MED</Badge
                        >
                        <Badge v-else variant="outline" title="Sin dato disponible">S/D</Badge>
                      </div>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        class="h-full w-(--bar-w) rounded-full transition-all duration-500"
                        :class="
                          getGenHoy(proy.proyecto_id).pct! >= 100
                            ? 'bg-success'
                            : getGenHoy(proy.proyecto_id).real > 0
                              ? 'bg-primary/40'
                              : 'bg-muted'
                        "
                        :style="{
                          '--bar-w':
                            getGenHoy(proy.proyecto_id).p90 > 0
                              ? Math.min(
                                  100,
                                  (getGenHoy(proy.proyecto_id).real /
                                    getGenHoy(proy.proyecto_id).p90) *
                                    100,
                                ) + '%'
                              : '0%',
                        }"
                      />
                    </div>
                  </div>
                </template>
              </CardContent>
            </Card>
          </div>
        </template>
      </draggable>
    </div>
    <!-- /live tab -->

    <!-- ══ HISTORIC TAB ══ -->
    <div v-else class="flex-1 overflow-y-auto">
      <GeneracionView />
    </div>

    <ReconectarDialog
      v-model:open="reconectarOpen"
      :proyecto-id="reconectarTarget?.proyecto_id ?? null"
      :nombre="reconectarTarget?.nombre || ''"
      :active="(reconectarTarget && rcnMap[reconectarTarget.proyecto_id]?.active) ?? null"
      @done="onReconectado"
    />
  </div>
  <!-- /root -->
</template>

<script setup lang="ts">
import type { Chart, ChartOptions, Plugin } from 'chart.js'
import type { Component } from 'vue'
import { ref, reactive, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import draggable from 'vuedraggable'
import { toast } from 'vue-sonner'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { useReconectadores } from '~/features/mobile/useReconectadores'
import ReconectadorPanel from '~/features/solar/components/components/ReconectadorPanel.vue'
import ReconectarDialog from '~/features/solar/components/components/ReconectarDialog.vue'
// Los datos y las DECISIONES que esta vista comparte con la app movil. Vive
// aparte porque las dos ya se separaron dos veces leyendo el mismo endpoint --
// ver el docstring del modulo.
import {
  TIME_LABELS,
  acumuladoInversores,
  acumuladoMedidor,
  fmtKwh,
  haceCuanto,
  hastaInversores,
  hastaMedidor,
  inverterSeries,
  irradianceSeries,
  meterSeries,
} from '~/features/solar/serieSolar'
import type {
  DetalleMonitoreoSolar,
  ProyectoMonitoreoSolar,
  RespuestaMonitoreoSolar,
} from '~/features/solar/types'
import {
  COLOR_NIVEL,
  FUENTES,
  avisosConsultas,
  detalleComunicacion,
  fuentesSinComunicacion,
  nivelComunicacion,
  sinComunicacion,
  type ComunicacionPlanta,
  type Fuente,
} from '~/features/solar/comunicacion'
import {
  ChartLineIcon,
  CheckIcon,
  ClockIcon,
  Columns2Icon,
  Columns4Icon,
  LayoutListIcon,
  LoaderCircleIcon,
  MenuIcon,
  PowerIcon,
  RefreshCwIcon,
  SearchIcon,
  SunIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'

// Carga perezosa: solo se necesita al entrar a la tab Histórico, y esto evita
// un ciclo de módulos que en el build de producción rompía con
// "Cannot access 'cn' before initialization" (una variable interna de la
// reactividad de Vue que el minificador nombra igual por coincidencia en un
// chunk compartido, no la `cn` de `~/lib/utils`).
const GeneracionView = defineAsyncComponent(
  () => import('~/features/operaciones/components/GeneracionView.vue'),
)

const generacionSolarService = new GeneracionSolarService()
const {
  rcnMap,
  pendientes,
  recargando: recargandoEstados,
  cargarEstados,
  marcarEnviado,
  interruptor,
  cambiandoInterruptor,
  cargarInterruptor,
  pedirCambioInterruptor,
  tituloInterruptor,
} = useReconectadores()
const { can } = useAuth()

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const STORAGE_KEY = 'solar_project_order'

// ── Tab ────────────────────────────────────────────────────────────────────
const tab = ref<'live' | 'hist'>('live')

// ── Columnas del grid ──────────────────────────────────────────────────────
type ColumnasGrid = 1 | 2 | 4
interface OpcionColumnas {
  value: ColumnasGrid
  icon: Component
}
const OPCIONES_COLUMNAS: OpcionColumnas[] = [
  { value: 1, icon: LayoutListIcon },
  { value: 2, icon: Columns2Icon },
  { value: 4, icon: Columns4Icon },
]

// ── Estado ─────────────────────────────────────────────────────────────────
const loading = ref(false)
const proyectos = ref<ProyectoMonitoreoSolar[]>([])
const detailMap = reactive<Record<number, DetalleMonitoreoSolar>>({})
const lastUpdated = ref('')
const cols = ref<ColumnasGrid>(1)
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ── Filtro por proyecto ────────────────────────────────────────────────────
// Los ids elegidos en el selector. Vacío = se ven todos.
const seleccion = ref<number[]>([])

/** Las opciones del selector: los proyectos de esta pantalla, por nombre. */
const opcionesProyectos = computed(() =>
  [...proyectos.value].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
)

// ── Filtro por comunicación ────────────────────────────────────────────────
// Un chip por fuente (ver `comunicacion.ts`): un clic deja solo las plantas
// que no comunican por esa fuente, otro clic lo quita.
const filtroComunicacion = ref<Fuente | null>(null)

const resumenComunicacion = computed(() =>
  (Object.keys(FUENTES) as Fuente[]).map((fuente) => ({
    fuente,
    label: FUENTES[fuente].label,
    count: proyectos.value.filter((p) => sinComunicacion(p.comunicacion, fuente)).length,
  })),
)

// Si la última consulta a SolarView o a Quoia falló, los estados pueden estar viejos.
const consultas = ref<RespuestaMonitoreoSolar['consultas']>({})
const avisos = computed(() => avisosConsultas(consultas.value))

// ── Filtro por estado del reconectador ─────────────────────────────────────
// Solo cuentan las plantas de esta pantalla que tienen reconectador: las demás
// no salen en ningún grupo, porque "sin reconectador" no es un estado del relay.
type FiltroReconectador = 'on' | 'off' | 'sin_dato'
const filtroRcn = ref<FiltroReconectador | null>(null)

function estadoRcn(proy: ProyectoMonitoreoSolar): FiltroReconectador | null {
  const r = rcnMap[proy.proyecto_id]
  if (!r) return null
  return r.active === true ? 'on' : r.active === false ? 'off' : 'sin_dato'
}

const RCN_META: Record<FiltroReconectador, { label: string; color: string }> = {
  on: { label: 'Reconectador activo', color: 'success' },
  off: { label: 'Reconectador inactivo', color: 'destructive' },
  sin_dato: { label: 'Reconectador sin dato', color: 'default' },
}

const resumenReconectadores = computed(() => {
  const counts: Partial<Record<FiltroReconectador, number>> = {}
  for (const p of proyectos.value) {
    const e = estadoRcn(p)
    if (e) counts[e] = (counts[e] || 0) + 1
  }
  // Activo e inactivo siempre (aunque sea 0, para que se sepa que hay cero
  // apagados); "sin dato" solo si hay alguno.
  if (!Object.keys(counts).length) return []
  return (['on', 'off', 'sin_dato'] as const)
    .filter((key) => key !== 'sin_dato' || counts[key])
    .map((key) => ({ key, count: counts[key] ?? 0, ...RCN_META[key] }))
})

function matchesFiltro(proy: ProyectoMonitoreoSolar): boolean {
  if (filtroRcn.value && estadoRcn(proy) !== filtroRcn.value) return false
  if (filtroComunicacion.value && !sinComunicacion(proy.comunicacion, filtroComunicacion.value))
    return false
  return !seleccion.value.length || seleccion.value.includes(proy.proyecto_id)
}

/** Con cualquier filtro puesto no se reordena: arrastrar entre tarjetas ocultas desordena. */
const hayFiltro = computed(
  () => !!seleccion.value.length || !!filtroRcn.value || !!filtroComunicacion.value,
)

const sinCoincidencias = computed(() => hayFiltro.value && !proyectos.value.some(matchesFiltro))

function quitarFiltros(): void {
  seleccion.value = []
  filtroRcn.value = null
  filtroComunicacion.value = null
}

// ── Generación de hoy ──────────────────────────────────────────────────────
// El P90 del dia lo manda /monitoring en cada proyecto (`p90_diario_kwh`).
//
// Antes se calculaba aca, y para eso esta vista se traia el listado COMPLETO de
// proyectos (~188, con las cinco relaciones anidadas del serializer de
// /proyectos) para leer un array de 12 numeros de las ~47 plantas que muestra.
// Era la peticion mas pesada de la pantalla y existia solo para eso.
function dailyP90(proyectoId: number): number {
  const p = proyectos.value.find((x) => x.proyecto_id === proyectoId)
  return p?.p90_diario_kwh ?? 0
}

/**
 * Lo generado hoy y contra que meta, para la barra inferior de cada tarjeta.
 *
 * Sale del DETALLE que esta misma vista ya cargo, no de `/generacion-hoy`.
 * Ese endpoint devolvia el mismo numero por otro camino --vuelve a preguntarle
 * a SolarView planta por planta, una o dos llamadas externas cada una-- asi que
 * la pantalla pedia dos veces lo mismo. Y al ser dos caminos distintos podian
 * no coincidir entre si: la tarjeta mostraba un numero arriba y otro abajo.
 *
 * El criterio de la fuente es el mismo que usaba el backend: mandan los
 * inversores y el medidor es el respaldo cuando dan cero.
 */
type FuenteGenHoy = 'inversor' | 'medidor' | 'sin_dato'
interface GeneracionHoyResultado {
  real: number
  p90: number
  fuente: FuenteGenHoy
  pct: number | null
}

function getGenHoy(id: number): GeneracionHoyResultado {
  const d = detailMap[id]
  const inv = acumuladoInversores(d)
  const med = acumuladoMedidor(d)

  let real = 0
  let fuente: FuenteGenHoy = 'sin_dato'
  if (inv != null && inv > 0) {
    real = inv
    fuente = 'inversor'
  } else if (med != null && med > 0) {
    real = med
    fuente = 'medidor'
  }

  real = +Number(real).toFixed(1)
  const p90 = dailyP90(id)
  const pct = p90 > 0 ? Math.round((real / p90) * 100) : null
  return { real, p90, fuente, pct }
}

// ── Auto-refresh ───────────────────────────────────────────────────────────
const AUTO_KEY = 'solar_auto_refresh'
interface OpcionAutoRefresh {
  ms: number
  label: string
}
const autoOptions: OpcionAutoRefresh[] = [
  { ms: 60000, label: '1 min' },
  { ms: 300000, label: '5 min' },
  { ms: 900000, label: '15 min' },
  { ms: 1800000, label: '30 min' },
]
const autoInterval = ref<number>(parseInt(localStorage.getItem(AUTO_KEY) || '0'))

function setAuto(ms: number): void {
  autoInterval.value = ms
  localStorage.setItem(AUTO_KEY, String(ms))
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = ms ? setInterval(cargar, ms) : null
}

const { color } = useThemeColors()

/** Punto de la tarjeta: verde comunica, ámbar falla una fuente, rojo todas, gris sin evaluar. */
function colorComunicacion(c: ComunicacionPlanta | null | undefined): string {
  const nivel = nivelComunicacion(c)
  return color(COLOR_NIVEL[nivel], nivel === 'evaluando' ? 0.4 : 1)
}

/** Lo que dice la esquina de la tarjeta: las fuentes caídas, o nada si comunica. */
function etiquetaComunicacion(c: ComunicacionPlanta | null | undefined): string {
  if (nivelComunicacion(c) === 'evaluando') return 'Evaluando…'
  return fuentesSinComunicacion(c)
    .map((f) => FUENTES[f].label)
    .join(' · ')
}

// ── Orden persistido ───────────────────────────────────────────────────────
function saveOrder(): void {
  const order = proyectos.value.map((p) => p.proyecto_id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

function applyOrder(list: ProyectoMonitoreoSolar[]): ProyectoMonitoreoSolar[] {
  try {
    const order: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!order.length) return list
    const map = Object.fromEntries(list.map((p) => [p.proyecto_id, p]))
    const sorted = order.map((id) => map[id]).filter((p): p is ProyectoMonitoreoSolar => !!p)
    const rest = list.filter((p) => !order.includes(p.proyecto_id))
    return [...sorted, ...rest]
  } catch {
    return list
  }
}

// ── Crosshair plugin ───────────────────────────────────────────────────────
const crosshairPlugin: Plugin<'line'> = {
  id: 'crosshair',
  afterDraw(chart: Chart) {
    // `_active` es interno de Chart.js (no está en el tipo público `TooltipModel`),
    // pero es el único lugar donde vive qué punto está activo bajo el cursor.
    const tooltip = chart.tooltip as unknown as
      { _active?: { element: { x: number } }[] } | undefined
    if (!tooltip?._active?.length) return
    const x = tooltip._active[0]!.element.x
    const {
      ctx,
      chartArea: { top, bottom },
    } = chart
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = color('foreground', 0.18)
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.restore()
  },
}

// ── Datos de gráficas ─────────────────────────────────────────────────────
// La SERIE la arma serieSolar (igual que la grafica del movil); aca solo va la
// configuracion de Chart.js, que si es propia del escritorio. Antes esta funcion
// repetia el bucketeo literalmente -- el mismo copiar-pegar que hizo divergir
// las dos vistas dos veces esta semana.
interface CurvaChartDataset {
  label: string
  data: (number | null)[]
  borderColor: string
  backgroundColor: string
  fill: boolean
  tension: number
  pointRadius: number
  borderWidth: number
  spanGaps: boolean
  yAxisID?: string
}
interface CurvaChartData {
  labels: string[]
  datasets: CurvaChartDataset[]
}

// ── Irradiancia POA ───────────────────────────────────────────────────────
// Va como segunda línea en las dos gráficas, con su propio eje a la derecha
// (W/m²). Solo en las plantas cuya estación mide POA; en las demás las gráficas
// quedan como estaban. Siempre es el dataset [1]: el [0] es la potencia.
const irradianciaMap = reactive<Record<number, (number | null)[] | null>>({})

function datasetIrradiancia(id: number): CurvaChartDataset[] {
  const data = irradianciaMap[id]
  if (!data) return []
  return [
    {
      label: 'Irradiancia POA (W/m²)',
      data,
      borderColor: color('chart-4'),
      backgroundColor: color('chart-4', 0.1),
      fill: false,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 1.5,
      spanGaps: true,
      yAxisID: 'y1',
    },
  ]
}

async function cargarIrradiancia(id: number): Promise<void> {
  try {
    irradianciaMap[id] = irradianceSeries(await generacionSolarService.obtenerIrradiancia(id))
  } catch {
    // Sin la estación la gráfica sigue igual que antes: solo potencia.
    if (!(id in irradianciaMap)) irradianciaMap[id] = null
  }
}

function getInversorData(id: number): CurvaChartData {
  const data = inverterSeries(detailMap[id])
  if (!data) return { labels: [], datasets: [] }
  return {
    labels: TIME_LABELS,
    datasets: [
      {
        label: 'Inversores (kW)',
        data,
        borderColor: color('primary'),
        backgroundColor: color('primary', 0.18),
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: true,
      },
      ...datasetIrradiancia(id),
    ],
  }
}

// ── Selección del mejor snapshot de medidor ───────────────────────────────
// Todo lo que el panel de Medidores necesita, en un solo lugar. El backend ya
// entrega el medidor elegido y resuelto en `medidor` (potencia de ahora,
// energia del dia, curva sin rellenar y frescura), asi que aca no se decide
// nada: se formatea. Antes esto eran seis funciones sueltas y una septima que
// re-elegia el medidor con un criterio duplicado del backend (2026-09-03).
// Se calcula una vez por proyecto y no en cada interpolacion del template.
interface PanelMedidor {
  tipo: string | null
  energiaKwh: number | null
  energiaHasta: string | null
  chart: CurvaChartData | null
}

const panelesMedidor = computed<Record<number, PanelMedidor | null>>(() =>
  Object.fromEntries(
    (proyectos.value ?? []).map((p) => [p.proyecto_id, medidorPanel(p.proyecto_id)]),
  ),
)

function medidorPanel(id: number): PanelMedidor | null {
  const d = detailMap[id]
  const m = d?.medidor
  if (!m) return null
  const data = meterSeries(d)
  return {
    // 'P'/'R' solo si hay dos medidores; con uno solo la etiqueta sobra.
    tipo: d.medidor_respaldo ? (m.node_id === d.medidor_principal?.node_id ? 'P' : 'R') : null,
    energiaKwh: acumuladoMedidor(d),
    energiaHasta: hastaMedidor(d),
    // Sin relleno: si la telemetria de potencia se cayo, el hueco se ve.
    chart: data
      ? {
          labels: TIME_LABELS,
          datasets: [
            {
              label: 'Medidores (kW)',
              data,
              borderColor: color('warning'),
              backgroundColor: color('warning', 0.15),
              fill: true,
              tension: 0.35,
              pointRadius: 0,
              borderWidth: 2,
              spanGaps: true,
            },
            ...datasetIrradiancia(id),
          ],
        }
      : null,
  }
}

// Potencia de AHORA y su frescura: los dos ya llegaban en la respuesta y la
// vista los descartaba, en una pestana cuyo proposito es el tiempo real.

// ── % diferencia ─────────────────────────────────────────────────────────
function getDiffPct(id: number): number | null {
  const inv = acumuladoInversores(detailMap[id])
  const med = medidorPanel(id)?.energiaKwh ?? null
  if (inv == null || med == null || med === 0) return null
  return +(((inv - med) / med) * 100).toFixed(1)
}

// ── Chart options ─────────────────────────────────────────────────────────
function makeOptions(maxY: number | undefined, conIrradiancia = false): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      // La leyenda de la irradiancia va en el título del panel, en HTML: el
      // plugin Legend de Chart.js no está registrado en esta vista, y
      // registrarlo es global (aparecería en otras gráficas de la app).
      legend: { display: false },
      tooltip: {
        backgroundColor: color('card'),
        titleColor: color('foreground'),
        bodyColor: color('muted-foreground'),
        borderColor: color('border'),
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label: (ctx) => {
            const esIrr = ctx.dataset.yAxisID === 'y1'
            const v = ctx.parsed.y
            const txt =
              v != null
                ? v.toLocaleString('es-CO', {
                    minimumFractionDigits: esIrr ? 0 : 2,
                    maximumFractionDigits: esIrr ? 0 : 2,
                  })
                : '—'
            return esIrr ? `${txt} W/m²` : `${txt} kW`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 9 }, color: color('muted-foreground'), maxTicksLimit: 9 },
        grid: { color: color('foreground', 0.06) },
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 9 }, color: color('muted-foreground') },
        grid: { color: color('foreground', 0.06) },
        title: { display: true, text: 'kW', font: { size: 9 }, color: color('muted-foreground') },
        ...(maxY ? { max: maxY } : {}),
      },
      ...(conIrradiancia
        ? {
            y1: {
              position: 'right' as const,
              beginAtZero: true,
              // Un poco más que el sol de mediodía, para que las dos curvas
              // queden a una altura comparable.
              suggestedMax: 1200,
              ticks: { font: { size: 9 }, color: color('muted-foreground') },
              grid: { drawOnChartArea: false },
              title: {
                display: true,
                text: 'W/m²',
                font: { size: 9 },
                color: color('muted-foreground'),
              },
            },
          }
        : {}),
    },
  }
}

// Escala Y compartida entre Inversores y Medidores del MISMO proyecto -- si
// cada gráfica autoescala su propio máximo, dos curvas con magnitudes muy
// distintas pueden verse "igual de altas" aunque haya una diferencia real
// grande (ej. +44%). Con un máximo compartido, la diferencia se ve a simple
// vista en vez de quedar escondida por el autoescalado independiente.
function getChartMax(id: number): number | undefined {
  const invValores = getInversorData(id).datasets?.[0]?.data ?? []
  const medValores = medidorPanel(id)?.chart?.datasets?.[0]?.data ?? []
  const valores = [...invValores, ...medValores].filter((v): v is number => v != null)
  if (!valores.length) return undefined
  const max = Math.max(...valores)
  // Redondeado al múltiplo de 50 más cercano, +10% de aire para que el pico
  // no toque el borde superior del gráfico.
  return Math.ceil((max * 1.1) / 50) * 50
}

function chartOptionsInv(id: number): ChartOptions<'line'> {
  return makeOptions(getChartMax(id), !!irradianciaMap[id])
}
function chartOptionsMed(id: number): ChartOptions<'line'> {
  return makeOptions(getChartMax(id), !!irradianciaMap[id])
}

// ── Carga perezosa del detalle ──────────────────────────────────────────────
//
// El detalle de UNA tarjeta cuesta cuatro llamadas externas (la curva de
// potencia, la generacion de hoy y los dos medidores). Pedirlo de las ~47
// plantas eran ~188 llamadas por carga, la mayoria de tarjetas que el usuario
// nunca bajaba a ver. Ahora se pide de las que estan en pantalla.
//
// El esqueleto por tarjeta ("Cargando datos...") ya existia, asi que las que
// aun no llegaron no se ven rotas: se ven cargando, que es lo que estan.

const tarjetasVisibles = new Set<number>()
const idDeTarjeta = new WeakMap<Element, number>()
const detalleEnVuelo = new Set<number>()
let observador: IntersectionObserver | null = null

/** Un poco antes de que entre: para cuando el usuario llega, ya esta. */
const MARGEN_PRECARGA = '400px'

/**
 * Cuantas tarjetas cargar sin esperar a que el observador diga nada.
 *
 * En la primera carga todavia no hay nada dibujado, asi que el observador no
 * puede saber que se ve. Tres filas cubren la pantalla en cualquiera de los
 * anchos de columna que ofrece el selector, y el observador se encarga del
 * resto apenas se pinta.
 */
function tamanoPrimeraOla(): number {
  return Math.min(12, Math.max(4, cols.value * 3))
}

function observarTarjeta(el: Element | null, id: number): void {
  if (!el) return
  idDeTarjeta.set(el, id)
  observador?.observe(el) // observar dos veces el mismo nodo no hace nada
}

function alCambiarVisibilidad(entradas: IntersectionObserverEntry[]): void {
  for (const entrada of entradas) {
    const id = idDeTarjeta.get(entrada.target)
    if (id == null) continue
    if (entrada.isIntersecting) {
      tarjetasVisibles.add(id)
      loadDetail(id)
    } else {
      tarjetasVisibles.delete(id)
    }
  }
}

// ── Reconectadores ───────────────────────────────────────────────────────
// El estado, el "Aplicando…" tras un comando y el interruptor general viven en
// `useReconectadores`, compartido con la app móvil (ver `rcn` arriba).
const reconectarOpen = ref(false)
const reconectarTarget = ref<ProyectoMonitoreoSolar | null>(null)

function abrirReconectar(p: ProyectoMonitoreoSolar): void {
  reconectarTarget.value = p
  reconectarOpen.value = true
}

function onReconectado({ active }: { active: boolean }): void {
  const p = reconectarTarget.value
  if (!p) return
  marcarEnviado(p.proyecto_id, active)
  toast.success('Comando enviado', {
    description: `${p.nombre}: ${active ? 'ON' : 'OFF'}`,
    duration: 3500,
  })
}

// ── Carga ─────────────────────────────────────────────────────────────────
async function cargar(): Promise<void> {
  loading.value = true
  // En paralelo con la lista: no depende de ella.
  void cargarEstados()
  void cargarInterruptor()
  try {
    const res = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = applyOrder(res.projects ?? [])
    consultas.value = res.consultas ?? {}
    lastUpdated.value = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // El boton sigue en "cargando" hasta que lleguen tambien los detalles de lo
    // que se ve. Antes `loading` se apagaba apenas respondia /monitoring, que
    // solo trae la lista y el estado: las tarjetas -- que son lo que de verdad
    // cambia en pantalla -- seguian llegando despues, asi que el boton decia
    // "listo" varios segundos antes de que los numeros se movieran.
    //
    // En el refresco automatico se refrescan las que estan en pantalla. Las que
    // quedaron arriba o abajo no se vuelven a pedir hasta que se vuelvan a ver:
    // nadie las esta mirando, y volver a pedirlas era el grueso del gasto de un
    // refresco cada minuto.
    const ids = proyectos.value.map((p) => p.proyecto_id)
    const aCargar = tarjetasVisibles.size
      ? ids.filter((id) => tarjetasVisibles.has(id))
      : ids.slice(0, tamanoPrimeraOla())

    const BATCH = 10
    for (let i = 0; i < aCargar.length; i += BATCH) {
      await Promise.all(aCargar.slice(i, i + BATCH).map((id) => loadDetail(id, true)))
    }
  } catch {
    /* silencioso */
  } finally {
    loading.value = false
  }
}

/**
 * El detalle de una tarjeta. `refrescar` lo vuelve a pedir aunque ya este.
 *
 * Sin `refrescar`, una tarjeta ya cargada no se vuelve a pedir: el observador
 * dispara cada vez que entra y sale de pantalla, y sin esta guarda scrollear
 * arriba y abajo pedia lo mismo una y otra vez.
 */
async function loadDetail(id: number, refrescar = false): Promise<void> {
  if (!refrescar && detailMap[id] !== undefined) return
  if (detalleEnVuelo.has(id)) return
  detalleEnVuelo.add(id)
  try {
    // La irradiancia va en paralelo y por su cuenta: si la estación tarda o
    // falla, la tarjeta no la espera.
    void cargarIrradiancia(id)
    detailMap[id] = await generacionSolarService.obtenerDetalle(id)
  } catch {
    // `{}` y no dejarlo sin definir: sin esto la tarjeta se queda con el
    // esqueleto girando para siempre en vez de mostrar que no hay datos.
    detailMap[id] = {}
  } finally {
    detalleEnVuelo.delete(id)
  }
}

onMounted(() => {
  // Sin IntersectionObserver (navegador viejo) no se rompe nada: `observador`
  // queda en null, `observarTarjeta` no hace nada y cada carga trae la primera
  // ola, igual que antes pero mas corta.
  if (typeof IntersectionObserver !== 'undefined') {
    observador = new IntersectionObserver(alCambiarVisibilidad, { rootMargin: MARGEN_PRECARGA })
  }
  cargar()
  if (autoInterval.value) refreshTimer = setInterval(cargar, autoInterval.value)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  observador?.disconnect()
  observador = null
  tarjetasVisibles.clear()
})
</script>
