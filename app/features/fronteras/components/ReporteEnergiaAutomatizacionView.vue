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
        <ReporteEnergiaResumenTab
          :referencia="maxFecha"
          @abrir="({ fronteraId, fecha: dia }) => irAFronteraHistorial(fronteraId, dia)"
        />
      </GTabsContent>
    </GTabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { LocationQueryValue } from 'vue-router'
import type {
  EstadoQuoiaReporte,
  FilaReporteEnergia,
  ResumenReporteEnergiaDia,
} from '~/features/fronteras/types'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
// Import explícito: `DatePicker` choca con el `GlobalComponents.DatePicker` que
// declara `primevue/datepicker` (ver `GestionFallasView.vue`) -- sin este
// import, el typecheck resuelve el tag contra el tipo de PrimeVue.
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { ReporteEnergiaService } from '~/features/fronteras/services/reporte-energia'
import ReporteEnergiaDetalleTab from './ReporteEnergiaDetalleTab.vue'
import ReporteEnergiaResumenTab from './ReporteEnergiaResumenTab.vue'
import ReporteEnergiaLista from './ReporteEnergiaLista.vue'
import {
  CircleStopIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PlayIcon,
  SendIcon,
} from '@lucide/vue'

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

// Salta a "Historial" en esa fecha y selecciona esa frontera -- si esa fecha
// no tiene fila para ella (pudo no generar/reportar justo ese día), se avisa en
// vez de fallar en silencio.
async function irAFronteraHistorial(frontera_id: number, dia: string) {
  activeTab.value = 1
  fechaHistorial.value = dia
  await cargarHistorial()
  const f = filasHistorial.value.find((x) => x.frontera_id === frontera_id)
  if (f) {
    seleccionHistorial.value = f
  } else {
    toast.info('Sin fila en esa fecha', {
      description:
        'Esta frontera no tiene reporte en esa fecha -- prueba con otra fecha en Historial.',
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

// El envío corre en un hilo del backend (ver envio.enviar_background): con ~100
// fronteras pasa del timeout del servidor, y cuando era una sola petición el
// servidor la cortaba a media lista -- Generación salía, Consumo no, y no quedaba
// registro. POST /enviar responde de inmediato y acá se sondea /enviar/estado
// hasta que deja de estar en curso.
let envioTimer: ReturnType<typeof setInterval> | null = null

function detenerSondeoEnvio() {
  if (envioTimer) clearInterval(envioTimer)
  envioTimer = null
}
onUnmounted(detenerSondeoEnvio)

async function enviarReporte() {
  enviando.value = true
  const fechaEnviada = fechaISO.value
  try {
    const inicio = await reporteEnergiaService.enviarReporte(fechaEnviada)
    if (inicio.bloqueado) {
      toast.warning('Envío bloqueado', { description: inicio.motivo_bloqueo, duration: 5000 })
      enviando.value = false
      return
    }
    toast.info('Enviando reporte', {
      description: 'Puede tardar unos minutos. Te aviso cuando termine.',
      duration: 4000,
    })
    detenerSondeoEnvio()
    envioTimer = setInterval(() => revisarEnvio(fechaEnviada), 5000)
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
    enviando.value = false
  }
}

async function revisarEnvio(fechaEnviada: string) {
  let data
  try {
    data = await reporteEnergiaService.obtenerEstadoEnvio(fechaEnviada)
  } catch {
    return // silencioso -- se reintenta en el próximo tick
  }
  if (data.en_curso) return
  detenerSondeoEnvio()
  enviando.value = false
  if (data.error_general) {
    toast.error('Envío interrumpido', { description: data.error_general, duration: 8000 })
  } else if (data.fallidos.length) {
    toast.warning('Reporte enviado con fallos', {
      description: `${data.enviados ?? 0} fronteras enviadas, ${data.fallidos.length} fallidas — ${data.fallidos.join('; ')}`,
      duration: 8000,
    })
  } else {
    toast.success('Reporte enviado', {
      description: `${data.enviados ?? 0} fronteras enviadas`,
      duration: 3000,
    })
  }
  // El estado de XM es de la fecha enviada: si la persona cambió de día
  // mientras tanto, no se pisa el panel del día que está viendo.
  if (fechaISO.value !== fechaEnviada) return
  // Primero lo ya guardado (GET, sin golpear Quoia): el panel aparece en el
  // acto y, si hay algo en espera, arranca el polling. Antes se esperaba a la
  // revisión en vivo, y cuando esa pasaba del timeout del servidor el error se
  // tragaba en silencio y el panel nunca salía (2026-09-30). La revisión en
  // vivo va por tandas (ver estado_quoia_revisar): la primera sale ya, el
  // polling sigue con las que falten.
  await cargarEstadoQuoiaActual()
  if (estadoQuoiaPolling.value) void revisarEstadoQuoia()
}
</script>
