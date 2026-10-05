<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-muted font-sans text-foreground">
    <!-- ══ TOP BAR ══ -->
    <header
      class="ms-topbar relative flex shrink-0 items-center gap-2.5 bg-foreground px-3.5 pb-2.5 text-background"
    >
      <button
        class="size-9 shrink-0 rounded-xl bg-white/10 text-white disabled:opacity-50"
        @click="menuOpen = !menuOpen"
        title="Menú"
      >
        <MenuIcon class="size-4" />
      </button>
      <span class="flex-1 text-center text-base font-bold tracking-wide"
        ><SunIcon class="mr-1 inline size-4 text-highlight" /> Unergy Solar</span
      >
      <button
        class="relative size-9 shrink-0 rounded-xl bg-white/10 text-white disabled:opacity-50"
        @click="notifOpen = true"
        title="Notificaciones"
      >
        <BellIcon class="size-4" />
        <span
          v-if="unreadCount > 0"
          class="absolute top-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-foreground bg-destructive px-1 text-xs font-extrabold text-white"
          >{{ unreadCount > 9 ? '9+' : unreadCount }}</span
        >
      </button>
      <button
        class="size-9 shrink-0 rounded-xl bg-white/10 text-white disabled:opacity-50"
        :disabled="loadingDetail > 0"
        @click="refrescar"
        title="Actualizar"
      >
        <LoaderCircleIcon v-if="loadingDetail" class="size-4 animate-spin" />
        <RefreshCwIcon v-else class="size-4" />
      </button>

      <div v-if="menuOpen" class="fixed inset-0 z-50 bg-black/20" @click.self="menuOpen = false">
        <div class="ms-menu-card absolute left-3 min-w-56 rounded-xl bg-card p-2 shadow-lg">
          <div class="flex items-center gap-2.5 border-b border-border px-2.5 pt-2.5 pb-3">
            <UserIcon class="size-6 text-primary" />
            <div>
              <div class="text-sm font-bold text-foreground">{{ user?.name || 'Usuario' }}</div>
              <div class="text-xs text-muted-foreground">{{ user?.email }}</div>
            </div>
          </div>
          <button
            class="mt-1.5 flex h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold text-destructive"
            @click="cerrarSesion"
          >
            <LogOutIcon class="size-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    </header>

    <!-- ══ SELECTOR (sin flechas — se cambia con swipe) ══ -->
    <div
      v-if="proyectos.length"
      class="relative flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2"
    >
      <button
        class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2"
        @click="pickerOpen = !pickerOpen"
      >
        <span
          class="size-2 shrink-0 rounded-full bg-(--c)"
          :style="{ '--c': colorComunicacion(current?.comunicacion) }"
        />
        <TruncatedText
          :text="current?.nombre || '—'"
          class="min-w-0 flex-1 text-left text-base font-bold"
        />
        <ChevronDownIcon class="size-3 text-muted-foreground" />
      </button>
      <button
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-foreground shadow-md"
        @click="openCreate"
        title="Reportar falla en esta planta"
      >
        <PlusIcon class="size-5" />
      </button>
      <span class="shrink-0 text-xs font-bold whitespace-nowrap text-muted-foreground"
        >{{ idx + 1 }}/{{ proyectos.length }}</span
      >

      <div
        v-if="pickerOpen"
        class="fixed inset-0 z-50 bg-black/25"
        @click.self="pickerOpen = false"
      >
        <div
          class="absolute inset-x-0 top-0 max-h-4/5 overflow-y-auto rounded-b-2xl bg-card p-2 shadow-lg"
        >
          <div
            class="px-3 pt-3 pb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >
            Proyectos
          </div>
          <button
            v-for="(p, i) in proyectos"
            :key="p.proyecto_id"
            :class="[
              'flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left text-base text-foreground',
              i === idx && 'bg-primary/10 font-bold',
            ]"
            @click="selectIdx(i)"
          >
            <span
              class="size-2 shrink-0 rounded-full bg-(--c)"
              :style="{ '--c': colorComunicacion(p.comunicacion) }"
            />
            <TruncatedText :text="p.nombre" class="min-w-0 flex-1" />
            <ZapIcon
              class="size-4 text-warning"
              v-if="rcnMap[p.proyecto_id]"
              title="Tiene reconectador"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- ══ DECK SWIPEABLE ══ -->
    <main
      v-if="proyectos.length"
      ref="deckRef"
      class="flex-1 touch-pan-y overflow-hidden"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div
        class="flex h-full translate-x-(--x) will-change-transform"
        :class="dragging ? 'transition-none' : 'transition-transform duration-300 ease-out'"
        :style="{ '--x': -idx * slideW + dragX + 'px' }"
      >
        <section
          v-for="p in proyectos"
          :key="p.proyecto_id"
          class="flex h-full w-full shrink-0 basis-full flex-col overflow-y-auto px-3 pt-3 pb-3"
        >
          <!-- Chips "ahora" -->
          <div class="mb-2 flex shrink-0 gap-2">
            <div
              class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5"
            >
              <span class="size-2 shrink-0 rounded-full bg-primary" />
              <div class="flex min-w-0 flex-col">
                <span class="text-xs font-medium text-muted-foreground">Inversores</span>
                <span
                  class="text-base leading-tight font-bold tracking-tight whitespace-nowrap text-foreground"
                  >{{ fmtKwh(nowMap[p.proyecto_id]?.inv ?? null) }}</span
                >
                <span
                  v-if="nowMap[p.proyecto_id]?.invHasta"
                  class="truncate text-xs leading-tight font-normal text-muted-foreground"
                >
                  hasta {{ nowMap[p.proyecto_id]?.invHasta
                  }}<template v-if="haceCuanto(nowMap[p.proyecto_id]?.invHasta)">
                    · {{ haceCuanto(nowMap[p.proyecto_id]?.invHasta) }}</template
                  >
                </span>
              </div>
            </div>
            <div
              class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5"
            >
              <span class="size-2 shrink-0 rounded-full bg-chart-2" />
              <div class="flex min-w-0 flex-col">
                <span class="text-xs font-medium text-muted-foreground">Medidor</span>
                <span
                  class="text-base leading-tight font-bold tracking-tight whitespace-nowrap text-foreground"
                  >{{ fmtKwh(nowMap[p.proyecto_id]?.med ?? null) }}</span
                >
                <span
                  v-if="nowMap[p.proyecto_id]?.medHasta"
                  class="truncate text-xs leading-tight font-normal text-muted-foreground"
                >
                  hasta {{ nowMap[p.proyecto_id]?.medHasta
                  }}<template v-if="haceCuanto(nowMap[p.proyecto_id]?.medHasta)">
                    · {{ haceCuanto(nowMap[p.proyecto_id]?.medHasta) }}</template
                  >
                </span>
              </div>
            </div>
          </div>

          <!-- Gráfica — al tocarla se abre la potencia por inversor -->
          <div
            class="ms-chart relative min-h-37 flex-1 rounded-2xl border border-border bg-card px-2.5 pt-3 pb-1.5"
            @click="onChartTap(p)"
          >
            <div
              v-if="loadingDetail && !detailMap[p.proyecto_id]"
              class="absolute inset-0 flex items-center justify-center gap-2.5 text-sm text-muted-foreground"
            >
              <LoaderCircleIcon class="size-6 animate-spin text-primary" />
              <span>Cargando datos…</span>
            </div>
            <ProjectLiveChart v-else :detail="detailMap[p.proyecto_id]" />
            <span
              class="pointer-events-none absolute top-2 right-2.5 flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold tracking-wide text-primary"
              ><MoveIcon class="size-3" /> Inversores</span
            >
          </div>

          <!-- Reconectador: estado + telemetría en vivo de Solenium -->
          <ReconnectorPanel
            v-if="rcnMap[p.proyecto_id]"
            :relay="rcnMap[p.proyecto_id]!"
            :pendiente="!!pendientes[p.proyecto_id]"
          />

          <!-- Falla(s) activa(s) del proyecto -->
          <div
            v-if="(fallasMap[p.proyecto_id] || []).length"
            class="mt-2.5 flex shrink-0 flex-col gap-1.5"
          >
            <button
              v-for="f in (fallasMap[p.proyecto_id] || []).slice(0, 2)"
              :key="f.id"
              class="flex w-full items-center gap-2 rounded-xl border border-l-3 border-border border-l-warning bg-card px-2.5 py-2 text-left"
              @click="openFalla(f)"
            >
              <span
                class="hidden bg-(--c)"
                :style="{ '--c': colorPrioridad(f.prioridad?.codigo, 'var(--muted-foreground)') }"
              />
              <span
                class="shrink-0 rounded-md bg-(--c)/15 px-2 py-0.5 text-xs font-extrabold text-(--c)"
                :style="{ '--c': colorEstado(f.estado?.codigo) }"
                >{{ f.estado?.etiqueta }}</span
              >
              <TruncatedText
                :text="f.tipo?.etiqueta || 'Falla'"
                class="min-w-0 flex-1 text-xs font-semibold text-foreground"
              />
              <ChevronRightIcon class="size-3 shrink-0 text-muted-foreground" />
            </button>
            <span
              v-if="(fallasMap[p.proyecto_id] || []).length > 2"
              class="text-center text-xs text-muted-foreground"
            >
              +{{ (fallasMap[p.proyecto_id] || []).length - 2 }} fallas más
            </span>
          </div>

          <!-- Pie -->
          <div class="mt-2.5 flex shrink-0 items-center gap-2.5">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground"
              ><ClockIcon class="size-3" /> {{ lastUpdated || '—' }}</span
            >
            <button
              v-if="rcnMap[p.proyecto_id] && can('reconectadores:command')"
              class="ml-auto flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-60"
              :disabled="!!pendientes[p.proyecto_id]"
              @click="openSheet(p)"
            >
              <span
                :class="['rounded-md px-2 py-0.5 text-xs font-extrabold', relayBadgeClass(p)]"
                >{{ relayBadgeText(p) }}</span
              >
              <template v-if="pendientes[p.proyecto_id]">
                <LoaderCircleIcon class="size-4 animate-spin" /> Aplicando…
              </template>
              <template v-else><PowerIcon class="size-4" /> Reconectar</template>
            </button>
          </div>
        </section>
      </div>
    </main>

    <!-- ══ ESTADOS sin proyectos ══ -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <template v-if="loadingList"
        ><LoaderCircleIcon class="size-6 animate-spin text-primary" />
        <span>Cargando proyectos…</span></template
      >
      <template v-else>
        <SunIcon class="size-8 text-muted-foreground" />
        <span>Sin proyectos disponibles</span>
        <button
          class="mt-1 h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          @click="cargarLista"
        >
          Reintentar
        </button>
      </template>
    </div>

    <MobileTabBar />

    <ReconnectSheet
      :open="sheetOpen"
      :proyecto-id="sheetTarget?.proyecto_id"
      :nombre="sheetTarget?.nombre || ''"
      :active="(sheetTarget && rcnMap[sheetTarget.proyecto_id]?.active) ?? null"
      @close="sheetOpen = false"
      @done="onReconnectDone"
    />

    <InvertersSheet
      :open="invOpen"
      :proyecto-id="invTarget?.proyecto_id"
      :nombre="invTarget?.nombre || ''"
      @close="invOpen = false"
    />

    <NotificationsSheet :open="notifOpen" @close="notifOpen = false" @changed="fetchUnread" />

    <FallaCreateSheet
      :open="createOpen"
      :catalogos="catalogos"
      :proyectos="proyectosFalla"
      :prefill-proyecto-id="createProyectoId"
      @close="createOpen = false"
      @created="onFallaCreated"
    />
    <FallaDetailSheet
      :open="fallaDetailOpen"
      :falla="fallaDetail"
      :catalogos="catalogos"
      @close="fallaDetailOpen = false"
      @updated="onFallaUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  BellIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MenuIcon,
  MoveIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  SunIcon,
  UserIcon,
  ZapIcon,
} from '@lucide/vue'
import type { CatalogosFalla, Falla } from '~/features/fallas/types'
import type { DetalleMonitoreoSolar, ProyectoMonitoreoSolar } from '~/features/solar/types'
import {
  COLOR_NIVEL,
  nivelComunicacion,
  type ComunicacionPlanta,
} from '~/features/solar/comunicacion'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { FallasService } from '~/features/fallas/services/fallas'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { useReconectadores } from '~/features/mobile/useReconectadores'
import { usePwa } from '~/features/mobile/components/usePwa'
import {
  acumuladoInversores,
  acumuladoMedidor,
  fmtKwh,
  haceCuanto,
  hastaInversores,
  hastaMedidor,
} from '~/features/solar/serieSolar'
import ProjectLiveChart from '~/features/mobile/components/components/ProjectLiveChart.vue'
import ReconnectSheet from '~/features/mobile/components/components/ReconnectSheet.vue'
import ReconnectorPanel from '~/features/mobile/components/components/ReconnectorPanel.vue'
import InvertersSheet from '~/features/mobile/components/components/InvertersSheet.vue'
import NotificationsSheet from '~/features/mobile/components/components/NotificationsSheet.vue'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'
import FallaCreateSheet from '~/features/mobile/components/components/FallaCreateSheet.vue'
import FallaDetailSheet from '~/features/mobile/components/components/FallaDetailSheet.vue'

const router = useRouter()
const { user, signOut, can } = useAuth()
const { register } = usePwa()
const fallasService = new FallasService()
const notificacionesService = new NotificacionesService()
const generacionSolarService = new GeneracionSolarService()
// Estado de los relays y "Aplicando…" tras un comando: el mismo módulo que usa
// Generación Solar en escritorio. El interruptor general NO va en el móvil.
const { rcnMap, pendientes, cargarEstados, marcarEnviado } = useReconectadores()

// El punto de cada planta: el mismo criterio que escritorio (`comunicacion.ts`).
function colorComunicacion(c: ComunicacionPlanta | null | undefined): string {
  return `var(--${COLOR_NIVEL[nivelComunicacion(c)]})`
}

interface PotenciaAhora {
  inv: number | null
  invHasta: string | null
  med: number | null
  medHasta: string | null
}

// ── Estado ──────────────────────────────────────────────────────────────────
const proyectos = ref<ProyectoMonitoreoSolar[]>([])
const idx = ref(0)
const detailMap = reactive<Record<number, DetalleMonitoreoSolar>>({}) // proyecto_id → detalle
const nowMap = reactive<Record<number, PotenciaAhora>>({}) // proyecto_id → { inv, med } (potencia "ahora")
const loadingList = ref(false)
const loadingDetail = ref(0) // contador: >0 = cargando (permite cargas paralelas)
const lastUpdated = ref('')
const menuOpen = ref(false)
const pickerOpen = ref(false)
const sheetOpen = ref(false)
const sheetTarget = ref<ProyectoMonitoreoSolar | null>(null)
const notifOpen = ref(false)
const invOpen = ref(false)
const invTarget = ref<ProyectoMonitoreoSolar | null>(null)
const unreadCount = ref(0)
let refreshTimer: ReturnType<typeof setInterval> | null = null

// ── Fallas (falla activa por proyecto + reportar) ────────────────────────────
const catalogos = reactive<CatalogosFalla>({
  estados: [],
  prioridades: [],
  tipos: [],
  resoluciones: [],
})
const fallasMap = reactive<Record<number, Falla[]>>({}) // proyecto_id → [fallas activas]
const createOpen = ref(false)
const createProyectoId = ref<number | null>(null)
const fallaDetailOpen = ref(false)
const fallaDetail = ref<Falla | null>(null)

const proyectosFalla = computed(() =>
  proyectos.value.map((p) => ({ id: p.proyecto_id, nombre_comercial: p.nombre || '' })),
)

async function cargarCatalogos(): Promise<void> {
  try {
    const cat = await fallasService.obtenerCatalogos()
    Object.assign(catalogos, cat)
  } catch {
    /* no crítico — la generación funciona igual */
  }
}

async function loadFallas(proyectoId: number | null | undefined, force = false): Promise<void> {
  if (!proyectoId) return
  if (fallasMap[proyectoId] && !force) return
  try {
    const data = await fallasService.listar({ proyecto_id: proyectoId, size: 100 })
    fallasMap[proyectoId] = (data.items ?? []).filter((f) => !f.estado?.es_estado_final)
  } catch {
    if (!fallasMap[proyectoId]) fallasMap[proyectoId] = []
  }
}

function openCreate(): void {
  if (!current.value) return
  createProyectoId.value = current.value.proyecto_id
  createOpen.value = true
}
function onFallaCreated(): void {
  if (createProyectoId.value) loadFallas(createProyectoId.value, true)
}
function openFalla(f: Falla): void {
  fallaDetail.value = f
  fallaDetailOpen.value = true
}
function onFallaUpdated(f: Falla): void {
  if (f?.proyecto_id) loadFallas(f.proyecto_id, true)
}

async function fetchUnread(): Promise<void> {
  try {
    unreadCount.value = await notificacionesService.contarNoLeidas()
  } catch {
    /* silencioso */
  }
}

const current = computed(() => proyectos.value[idx.value] || null)

function relayBadgeText(p: ProyectoMonitoreoSolar): string {
  const a = rcnMap[p.proyecto_id]?.active
  return a === true ? 'ON' : a === false ? 'OFF' : '—'
}
function relayBadgeClass(p: ProyectoMonitoreoSolar): string {
  const a = rcnMap[p.proyecto_id]?.active
  return a === true
    ? 'bg-success/15 text-success'
    : a === false
      ? 'bg-destructive/15 text-destructive'
      : 'bg-white/20 text-white'
}

// ── Swipe deck ───────────────────────────────────────────────────────────────
const deckRef = ref<HTMLElement | null>(null)
const slideW = ref(typeof window !== 'undefined' ? window.innerWidth : 360)
const dragX = ref(0)
const dragging = ref(false)
let startX = 0
let startY = 0
let horizontal: boolean | null = null
let tapMoved = false // true si el dedo se movió: entonces no fue un toque

function measure(): void {
  slideW.value = deckRef.value?.clientWidth || window.innerWidth
}

function onTouchStart(e: TouchEvent): void {
  startX = e.touches[0]!.clientX
  startY = e.touches[0]!.clientY
  horizontal = null
  tapMoved = false
  dragging.value = true
}
function onTouchMove(e: TouchEvent): void {
  const dx = e.touches[0]!.clientX - startX
  const dy = e.touches[0]!.clientY - startY
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) tapMoved = true
  if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
    horizontal = Math.abs(dx) > Math.abs(dy)
  }
  if (!horizontal) return
  let d = dx
  // resistencia en los extremos
  if ((idx.value === 0 && d > 0) || (idx.value === proyectos.value.length - 1 && d < 0)) d *= 0.35
  dragX.value = d
}
function onTouchEnd(): void {
  dragging.value = false
  const th = slideW.value * 0.18
  if (dragX.value <= -th && idx.value < proyectos.value.length - 1) {
    idx.value++
    dragX.value += slideW.value
    requestAnimationFrame(() => {
      dragX.value = 0
    })
  } else if (dragX.value >= th && idx.value > 0) {
    idx.value--
    dragX.value -= slideW.value
    requestAnimationFrame(() => {
      dragX.value = 0
    })
  } else {
    dragX.value = 0
  }
  horizontal = null
}

// ── Carga ───────────────────────────────────────────────────────────────────
async function cargarLista(): Promise<void> {
  loadingList.value = true
  try {
    const res = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = res.projects ?? []
    if (idx.value >= proyectos.value.length) idx.value = 0
  } catch {
    /* el estado vacío lo maneja */
  } finally {
    loadingList.value = false
  }
  await nextTick()
  measure()
  cargarEstados()
  prefetchAround()
}

async function loadDetail(id: number | null | undefined, force = false): Promise<void> {
  if (!id) return
  if (detailMap[id] && !force) return
  loadingDetail.value++
  try {
    const res = await generacionSolarService.obtenerDetalle(id)
    detailMap[id] = res
    // El MISMO numero que el escritorio: energia acumulada del dia en kWh, no
    // la potencia instantanea. Ver el docstring de ~/features/solar/serieSolar.
    nowMap[id] = {
      inv: acumuladoInversores(res),
      invHasta: hastaInversores(res),
      med: acumuladoMedidor(res),
      medHasta: hastaMedidor(res),
    }
    lastUpdated.value = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    if (!detailMap[id]) detailMap[id] = {}
  } finally {
    loadingDetail.value = Math.max(0, loadingDetail.value - 1)
  }
}

// carga el proyecto actual + sus vecinos (para que el swipe ya tenga datos)
function prefetchAround(): void {
  const ids = [idx.value, idx.value - 1, idx.value + 1]
    .map((i) => proyectos.value[i]?.proyecto_id)
    .filter((id): id is number => Boolean(id))
  ids.forEach((id) => {
    loadDetail(id)
    loadFallas(id)
  })
}

function refrescar(): void {
  if (current.value) {
    loadDetail(current.value.proyecto_id, true)
    loadFallas(current.value.proyecto_id, true)
  }
  cargarEstados()
  fetchUnread()
}

watch(idx, prefetchAround)

// ── Navegación ───────────────────────────────────────────────────────────────
function selectIdx(i: number): void {
  idx.value = i
  pickerOpen.value = false
}

// ── Potencia por inversor ────────────────────────────────────────────────────
// Solo abre si fue un toque: un swipe entre proyectos o un scroll vertical
// también terminan en un `click`, y no deben abrir la hoja.
function onChartTap(p: ProyectoMonitoreoSolar): void {
  if (tapMoved) return
  invTarget.value = p
  invOpen.value = true
}

// ── Reconexión ───────────────────────────────────────────────────────────────
function openSheet(p: ProyectoMonitoreoSolar): void {
  sheetTarget.value = p
  sheetOpen.value = true
}
function onReconnectDone({ active }: { active: boolean }): void {
  const p = sheetTarget.value
  if (!p) return
  // Lo sostiene como "Aplicando…" hasta que SolarView confirme.
  marcarEnviado(p.proyecto_id, active)
  toast.success('Comando enviado', {
    description: `${p.nombre}: ${active ? 'ON' : 'OFF'}`,
    duration: 3500,
  })
}

// ── Sesión ─────────────────────────────────────────────────────────────────
function cerrarSesion(): void {
  signOut()
  router.replace('/m/login')
}

// ── Ciclo de vida ─────────────────────────────────────────────────────────
onMounted(() => {
  register()
  cargarLista()
  cargarCatalogos()
  fetchUnread()
  refreshTimer = setInterval(refrescar, 60000)
  window.addEventListener('resize', measure)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
/* safe-area: notch superior en la PWA */
.ms-topbar {
  padding-top: calc(0.625rem + env(safe-area-inset-top));
}
.ms-menu-card {
  top: calc(3.5rem + env(safe-area-inset-top));
}
/* tope de alto ≈ 52% del ancho: panorámica pero con más presencia que las chips */
.ms-chart {
  max-height: min(52vw, 38vh);
}
</style>
