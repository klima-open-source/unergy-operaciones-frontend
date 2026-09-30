<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-muted font-sans text-foreground">
    <!-- TOP BAR -->
    <header
      class="mf-topbar flex shrink-0 items-center gap-2.5 bg-foreground px-3.5 pb-2.5 text-background"
    >
      <span class="flex flex-1 items-center gap-1.5 text-base font-bold"
        ><WrenchIcon class="size-4 text-highlight" /> Fallas</span
      >
      <button
        class="relative size-9 rounded-lg bg-white/10 text-white"
        @click="notifOpen = true"
        title="Notificaciones"
      >
        <BellIcon class="size-4" />
        <span
          v-if="unreadCount > 0"
          class="absolute top-px right-px flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-foreground bg-destructive px-1 text-xs leading-none font-extrabold text-white"
          >{{ unreadCount > 9 ? '9+' : unreadCount }}</span
        >
      </button>
      <button
        class="relative size-9 rounded-lg bg-primary text-primary-foreground"
        @click="createOpen = true"
        title="Registrar falla"
      >
        <PlusIcon class="size-4" />
      </button>
    </header>

    <!-- FILTROS -->
    <div class="shrink-0 border-b border-border bg-card px-3.5 py-3">
      <div class="flex items-center gap-2 rounded-xl bg-muted px-3.5 py-3">
        <SearchIcon class="size-4 text-muted-foreground" />
        <input
          v-model="search"
          class="flex-1 border-none bg-transparent text-base text-foreground outline-none"
          placeholder="Buscar código, descripción, proyecto…"
        />
        <XIcon class="size-4 text-muted-foreground" v-if="search" @click="search = ''" />
      </div>
      <div class="mt-3 flex gap-2 overflow-x-auto pb-0.5">
        <button
          :class="[FCHIP, filtro === 'activas' ? FCHIP_ON : FCHIP_OFF]"
          @click="filtro = 'activas'"
        >
          Activas
        </button>
        <button
          :class="[FCHIP, filtro === 'programadas' ? FCHIP_ON : FCHIP_OFF]"
          @click="filtro = 'programadas'"
        >
          Programadas
        </button>
        <button :class="[FCHIP, filtro === null ? FCHIP_ON : FCHIP_OFF]" @click="filtro = null">
          Todas
        </button>
        <button
          v-for="e in catalogos.estados"
          :key="e.id"
          :class="[FCHIP, filtro === e.id ? 'border-(--c) bg-(--c) text-white' : FCHIP_OFF]"
          :style="{ '--c': colorEstado(e.codigo) }"
          @click="filtro = e.id"
        >
          {{ e.etiqueta }}
        </button>
      </div>
    </div>

    <!-- LISTA -->
    <main class="flex-1 overflow-y-auto px-3.5 py-3">
      <div v-if="loading" :class="STATE">
        <LoaderCircleIcon class="size-6 animate-spin text-primary" /> Cargando fallas…
      </div>
      <div v-else-if="!filtradas.length" :class="STATE">
        <CircleCheckIcon class="size-8 text-success" />
        <span>{{
          fallas.length ? 'Sin resultados con estos filtros' : 'No hay fallas registradas'
        }}</span>
        <button
          class="mt-1.5 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground"
          @click="createOpen = true"
        >
          <PlusIcon class="size-4" /> Registrar falla
        </button>
      </div>
      <template v-else>
        <button
          v-for="f in filtradas"
          :key="f.id"
          class="mb-3 flex w-full overflow-hidden rounded-2xl border border-border bg-card text-left"
          @click="openDetail(f)"
        >
          <span
            class="w-1 shrink-0 bg-(--c)"
            :style="{ '--c': colorPrioridad(f.prioridad?.codigo, '#9ca3af') }"
          />
          <div class="min-w-0 flex-1 px-4 py-3">
            <div class="mb-1 flex items-center justify-between gap-2">
              <code class="rounded-md bg-primary/10 px-2 py-px font-mono text-xs text-primary">{{
                f.codigo_interno
              }}</code>
              <span
                class="rounded-md bg-(--c)/15 px-2 py-0.5 text-xs font-extrabold text-(--c)"
                :style="{ '--c': colorEstado(f.estado?.codigo) }"
                >{{ f.estado?.etiqueta }}</span
              >
            </div>
            <div class="text-sm leading-tight font-bold text-foreground">
              {{ f.tipo?.etiqueta || 'Falla' }}
            </div>
            <div class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ZapIcon class="size-3 text-primary" />
              {{ f.proyecto?.nombre_comercial || '—' }}
            </div>
            <div class="mt-2 flex items-center gap-2.5">
              <span
                class="text-xs font-bold text-(--c)"
                :style="{ '--c': colorPrioridad(f.prioridad?.codigo, '#6b5a8a') }"
                >{{ f.prioridad?.etiqueta }}</span
              >
              <span class="text-xs text-muted-foreground">{{
                relativeTime(f.fecha_identificacion)
              }}</span>
            </div>
          </div>
        </button>
      </template>
    </main>

    <MobileTabBar />

    <FallaDetailSheet
      :open="detailOpen"
      :falla="detailFalla"
      :catalogos="catalogos"
      @close="detailOpen = false"
      @updated="onUpdated"
    />
    <FallaCreateSheet
      :open="createOpen"
      :catalogos="catalogos"
      :proyectos="proyectos"
      @close="createOpen = false"
      @created="onCreated"
    />
    <NotificationsSheet :open="notifOpen" @close="notifOpen = false" @changed="fetchUnread" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  BellIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import type { CatalogosFalla, Falla } from '~/features/fallas/types'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { FallasService } from '~/features/fallas/services/fallas'
import { normalizeError } from '~/core/errors'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'
import FallaDetailSheet from '~/features/mobile/components/components/FallaDetailSheet.vue'
import FallaCreateSheet from '~/features/mobile/components/components/FallaCreateSheet.vue'
import NotificationsSheet from '~/features/mobile/components/components/NotificationsSheet.vue'

const FCHIP = 'shrink-0 whitespace-nowrap rounded-full border-2 px-3.5 py-2 text-sm font-semibold'
const FCHIP_ON = 'border-foreground bg-foreground text-background'
const FCHIP_OFF = 'border-border bg-card text-muted-foreground'
const STATE =
  'flex flex-col items-center justify-center gap-3 px-5 py-15 text-center text-base text-muted-foreground'

const fallasService = new FallasService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()
const notificacionesService = new NotificacionesService()
const fallas = ref<Falla[]>([])
const catalogos = reactive<CatalogosFalla>({
  estados: [],
  prioridades: [],
  tipos: [],
  resoluciones: [],
})
const proyectos = ref<ProyectoConDetalle[]>([])
const loading = ref(false)

/** 'activas' | 'programadas' | null (todas) | <estado_id>. */
type FiltroFallas = 'activas' | 'programadas' | null | number
const search = ref('')
const filtro = ref<FiltroFallas>('activas')

const detailOpen = ref(false)
const detailFalla = ref<Falla | null>(null)
const createOpen = ref(false)
const notifOpen = ref(false)
const unreadCount = ref(0)

function esProgramado(f: Falla): boolean {
  return (
    (f.estado?.codigo || '').toLowerCase() === 'programado' ||
    (f.estado?.etiqueta || '').toLowerCase().startsWith('program')
  )
}

const filtradas = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = fallas.value
  if (filtro.value === 'activas') {
    list = list.filter((f) => !f.estado?.es_estado_final && !esProgramado(f))
  } else if (filtro.value === 'programadas') {
    list = list.filter((f) => esProgramado(f))
  } else if (typeof filtro.value === 'number') {
    list = list.filter((f) => f.estado?.id === filtro.value)
  }
  if (q) {
    list = list.filter(
      (f) =>
        (f.codigo_interno || '').toLowerCase().includes(q) ||
        (f.descripcion || '').toLowerCase().includes(q) ||
        (f.proyecto?.nombre_comercial || '').toLowerCase().includes(q) ||
        (f.tipo?.etiqueta || '').toLowerCase().includes(q),
    )
  }
  // abiertas primero, luego por fecha desc
  return [...list].sort((a, b) => {
    const af = a.estado?.es_estado_final ? 1 : 0
    const bf = b.estado?.es_estado_final ? 1 : 0
    if (af !== bf) return af - bf
    return (b.fecha_identificacion || '').localeCompare(a.fecha_identificacion || '')
  })
})

function relativeTime(s: string | null | undefined): string {
  if (!s) return ''
  const dias = Math.floor((Date.now() - new Date(s + 'T00:00:00').getTime()) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} d`
  return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

async function cargar(): Promise<void> {
  loading.value = true
  try {
    const [cat, proy] = await Promise.all([
      fallasService.obtenerCatalogos(),
      // Este listado solo alimenta el formulario de crear falla, asi que
      // van solo las plantas que pueden tener una.
      catalogoProyectos.cargarOperativos(),
    ])
    Object.assign(catalogos, cat)
    proyectos.value = proy ?? []
    await cargarFallas()
  } catch (e) {
    toast.error('Error al cargar', { description: normalizeError(e).message, duration: 3000 })
  } finally {
    loading.value = false
  }
}

/**
 * Cuanto historial de fallas CERRADAS se trae.
 *
 * Mas corto que en escritorio (90 dias): esta vista se usa en campo para
 * atender lo que esta abierto, no para revisar el historico, y cada fila es el
 * serializer completo de la lista de fallas.
 */
const DIAS_HISTORIAL = 30

function desdeISO(dias: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - dias)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  // Partes locales y no `toISOString()`, que pasa por UTC y puede caer un dia
  // antes segun la zona del telefono.
  return `${d.getFullYear()}-${mes}-${dia}`
}

async function cargarFallas(): Promise<void> {
  // Dos peticiones, no 33.
  //
  // Antes se traia el historial COMPLETO: el bucle pedia paginas de 500 y el
  // servidor las sirve de 100 (TOPE_FILAS en api/pagination.py), asi que cada
  // pagina se solapaba con la anterior --filas duplicadas-- y la lista se
  // cortaba antes de tiempo. Y de todas las fallas vivas la gran mayoria estan
  // CERRADAS: se traian miles para mostrar las abiertas, que es a lo que se
  // entra aca.
  const [abiertas, cerradas] = await Promise.all([
    fallasService.listar({ solo_activas: true, size: 500 }),
    fallasService.listar({ fecha_identificacion_desde: desdeISO(DIAS_HISTORIAL), size: 500 }),
  ])
  // Se solapan --una falla abierta identificada dentro de la ventana llega en
  // las dos-- asi que se unen por id.
  const porId = new Map<number, Falla>()
  for (const f of [...(abiertas.items ?? []), ...(cerradas.items ?? [])]) {
    porId.set(f.id, f)
  }
  fallas.value = [...porId.values()]
}

function openDetail(f: Falla): void {
  detailFalla.value = f
  detailOpen.value = true
}

function onUpdated(falla: Falla): void {
  const idx = fallas.value.findIndex((x) => x.id === falla.id)
  if (idx >= 0) fallas.value[idx] = falla
}
function onCreated(): void {
  cargarFallas()
}

async function fetchUnread(): Promise<void> {
  try {
    unreadCount.value = await notificacionesService.contarNoLeidas()
  } catch {
    /* silencioso */
  }
}

onMounted(() => {
  cargar()
  fetchUnread()
})
</script>

<style scoped>
/* safe-area del dispositivo: env() no tiene utilidad */
.mf-topbar {
  padding-top: calc(0.625rem + env(safe-area-inset-top));
}
</style>
