<script setup lang="ts">
import type { DetalleMonitoreoSolar, ProyectoMonitoreoSolar } from '~/features/solar/types'
import { ChartLineIcon, LoaderCircleIcon, SearchIcon, SunIcon, ZapIcon } from '@lucide/vue'
import draggable from 'vuedraggable'
import GeneracionView from '~/features/operaciones/components/GeneracionView.vue'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'

const generacionSolarService = new GeneracionSolarService()

const COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
}

// ── Tab ────────────────────────────────────────────────────────────────────
const tab = ref<'live' | 'hist'>('live')

// ── Estado ─────────────────────────────────────────────────────────────────
const loading = ref(false)
const proyectos = ref<ProyectoMonitoreoSolar[]>([])
const detailMap = reactive<Record<number, DetalleMonitoreoSolar>>({})
const lastUpdated = ref('')
const cols = ref(1)
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ── Filtro por proyecto ────────────────────────────────────────────────────
const filtro = ref('')

function matchesFiltro(proy: ProyectoMonitoreoSolar): boolean {
  const q = filtro.value.trim().toLowerCase()
  if (!q) return true
  return (proy.nombre || '').toLowerCase().includes(q)
}

const sinCoincidencias = computed(
  () => !!filtro.value.trim() && !proyectos.value.some(matchesFiltro),
)

// ── Auto-refresh ───────────────────────────────────────────────────────────
const AUTO_KEY = 'solar_auto_refresh'
const autoInterval = ref(Number.parseInt(localStorage.getItem(AUTO_KEY) || '0'))

watch(autoInterval, (ms) => {
  localStorage.setItem(AUTO_KEY, String(ms))
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = ms ? setInterval(cargar, ms) : null
})

// ── Orden persistido ───────────────────────────────────────────────────────
const STORAGE_KEY = 'solar_project_order'

function saveOrder() {
  const order = proyectos.value.map((p) => p.proyecto_id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

function applyOrder(list: ProyectoMonitoreoSolar[]): ProyectoMonitoreoSolar[] {
  try {
    const order: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!order.length) return list
    const map = Object.fromEntries(list.map((p) => [p.proyecto_id, p]))
    const sorted = order.map((id) => map[id]).filter((p): p is ProyectoMonitoreoSolar => Boolean(p))
    const rest = list.filter((p) => !order.includes(p.proyecto_id))
    return [...sorted, ...rest]
  } catch {
    return list
  }
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
function tamanoPrimeraOla() {
  return Math.min(12, Math.max(4, cols.value * 3))
}

function observarTarjeta(el: Element | null, id: number) {
  if (!el) return
  idDeTarjeta.set(el, id)
  observador?.observe(el) // observar dos veces el mismo nodo no hace nada
}

function alCambiarVisibilidad(entradas: IntersectionObserverEntry[]) {
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

// ── Carga ─────────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  try {
    const res = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = applyOrder(res.projects ?? [])
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
async function loadDetail(id: number, refrescar = false) {
  if (!refrescar && detailMap[id] !== undefined) return
  if (detalleEnVuelo.has(id)) return
  detalleEnVuelo.add(id)
  try {
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

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <GTabs v-model="tab" class="min-h-0 flex-1">
      <GTabsList variant="outline">
        <GTabsTrigger value="live" variant="outline">
          <ZapIcon class="size-4" />
          Tiempo Real
        </GTabsTrigger>
        <GTabsTrigger value="hist" variant="outline">
          <ChartLineIcon class="size-4" />
          Histórico
        </GTabsTrigger>
      </GTabsList>

      <GTabsContent value="live" class="min-h-0 overflow-y-auto">
        <div class="flex flex-col gap-5 p-4 sm:p-6">
          <!-- Encabezado -->
          <div class="flex flex-wrap items-start justify-between gap-3">
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
            <SolarLiveToolbar
              v-model:filtro="filtro"
              v-model:cols="cols"
              v-model:auto-interval="autoInterval"
              :loading="loading"
              @refresh="cargar"
            />
          </div>

          <!-- Loading inicial -->
          <div
            v-if="loading && !proyectos.length"
            class="flex flex-col items-center gap-3 py-16 text-muted-foreground"
          >
            <LoaderCircleIcon class="size-7 animate-spin text-primary" />
            <span class="text-sm">Cargando proyectos...</span>
          </div>

          <!-- Sin proyectos -->
          <div
            v-else-if="!loading && !proyectos.length"
            class="flex flex-col items-center gap-3 py-16 text-muted-foreground"
          >
            <SunIcon class="size-8 text-muted-foreground/40" />
            <p class="text-sm">Sin proyectos disponibles</p>
          </div>

          <!-- Sin coincidencias -->
          <div
            v-else-if="sinCoincidencias"
            class="flex flex-col items-center gap-3 py-16 text-muted-foreground"
          >
            <SearchIcon class="size-8 text-muted-foreground/40" />
            <p class="text-sm">Ningún proyecto coincide con «{{ filtro }}»</p>
          </div>

          <!-- Proyectos (drag & drop) -->
          <draggable
            v-else
            v-model="proyectos"
            item-key="proyecto_id"
            handle=".drag-handle"
            class="grid gap-4"
            :class="COLS_CLASS[cols]"
            :disabled="!!filtro.trim()"
            @end="saveOrder"
          >
            <template #item="{ element: proy }: { element: ProyectoMonitoreoSolar }">
              <div
                v-show="matchesFiltro(proy)"
                :ref="(el) => observarTarjeta(el as Element | null, proy.proyecto_id)"
              >
                <SolarProjectCard :proyecto="proy" :detalle="detailMap[proy.proyecto_id]" />
              </div>
            </template>
          </draggable>
        </div>
      </GTabsContent>

      <GTabsContent value="hist" class="min-h-0 overflow-y-auto">
        <GeneracionView />
      </GTabsContent>
    </GTabs>
  </div>
</template>
