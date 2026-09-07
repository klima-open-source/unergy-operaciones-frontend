<template>
  <div class="ms-root">
    <!-- ══ TOP BAR ══ -->
    <header class="ms-topbar">
      <button class="ms-icon-btn" @click="menuOpen = !menuOpen" title="Menú"><MenuIcon class="size-[1em]" /></button>
      <span class="ms-brand"><SunIcon class="size-[1em]" /> Unergy Solar</span>
      <button class="ms-icon-btn ms-bell" @click="notifOpen = true" title="Notificaciones">
        <BellIcon class="size-[1em]" />
        <span v-if="unreadCount > 0" class="ms-bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
      <button class="ms-icon-btn" :disabled="loadingDetail" @click="refrescar" title="Actualizar">
        <LoaderCircleIcon v-if="loadingDetail" class="size-[1em] animate-spin" />
        <RefreshCwIcon v-else class="size-[1em]" />
      </button>

      <div v-if="menuOpen" class="ms-menu" @click.self="menuOpen = false">
        <div class="ms-menu-card">
          <div class="ms-menu-user">
            <UserIcon class="size-[1em]" />
            <div>
              <div class="ms-menu-name">{{ user?.name || 'Usuario' }}</div>
              <div class="ms-menu-email">{{ user?.email }}</div>
            </div>
          </div>
          <button class="ms-menu-item" @click="cerrarSesion"><LogOutIcon class="size-[1em]" /> Cerrar sesión</button>
        </div>
      </div>
    </header>

    <!-- ══ SELECTOR (sin flechas — se cambia con swipe) ══ -->
    <div v-if="proyectos.length" class="ms-selector">
      <button class="ms-current" @click="pickerOpen = !pickerOpen">
        <span class="ms-dot" :style="{ background: statusColor(current?.status) }" />
        <span class="ms-name">{{ current?.nombre || '—' }}</span>
        <ChevronDownIcon class="ms-caret size-[1em]" />
      </button>
      <button class="ms-add-falla" @click="openCreate" title="Reportar falla en esta planta"><PlusIcon class="size-[1em]" /></button>
      <span class="ms-count">{{ idx + 1 }}/{{ proyectos.length }}</span>

      <div v-if="pickerOpen" class="ms-picker" @click.self="pickerOpen = false">
        <div class="ms-picker-card">
          <div class="ms-picker-head">Proyectos</div>
          <button v-for="(p, i) in proyectos" :key="p.proyecto_id"
            :class="['ms-picker-item', i === idx && 'ms-picker-item--active']"
            @click="selectIdx(i)">
            <span class="ms-dot" :style="{ background: statusColor(p.status) }" />
            <span class="ms-picker-name">{{ p.nombre }}</span>
            <ZapIcon class="ms-picker-relay size-[1em]" v-if="rcnMap[p.proyecto_id]" title="Tiene reconectador" />
          </button>
        </div>
      </div>
    </div>

    <!-- ══ DECK SWIPEABLE ══ -->
    <main v-if="proyectos.length" ref="deckRef" class="ms-deck"
      @touchstart.passive="onTouchStart" @touchmove.passive="onTouchMove" @touchend="onTouchEnd">
      <div class="ms-track" :style="trackStyle">
        <section v-for="p in proyectos" :key="p.proyecto_id" class="ms-slide">
          <!-- Chips "ahora" -->
          <div class="ms-now">
            <div class="ms-now-chip">
              <span class="ms-now-dot" style="background:var(--color-unergy-purple)" />
              <div class="ms-now-text">
                <span class="ms-now-label">Inversores</span>
                <span class="ms-now-val">{{ fmtKwh(nowMap[p.proyecto_id]?.inv ?? null) }}</span>
                <span v-if="nowMap[p.proyecto_id]?.invHasta" class="ms-now-hasta">
                  hasta {{ nowMap[p.proyecto_id].invHasta }}<template
                    v-if="haceCuanto(nowMap[p.proyecto_id].invHasta)"> · {{ haceCuanto(nowMap[p.proyecto_id].invHasta) }}</template>
                </span>
              </div>
            </div>
            <div class="ms-now-chip">
              <span class="ms-now-dot" style="background:#14B8A6" />
              <div class="ms-now-text">
                <span class="ms-now-label">Medidor</span>
                <span class="ms-now-val">{{ fmtKwh(nowMap[p.proyecto_id]?.med ?? null) }}</span>
                <span v-if="nowMap[p.proyecto_id]?.medHasta" class="ms-now-hasta">
                  hasta {{ nowMap[p.proyecto_id].medHasta }}<template
                    v-if="haceCuanto(nowMap[p.proyecto_id].medHasta)"> · {{ haceCuanto(nowMap[p.proyecto_id].medHasta) }}</template>
                </span>
              </div>
            </div>
          </div>

          <!-- Gráfica — al tocarla se abre la potencia por inversor -->
          <div class="ms-chart" @click="onChartTap(p)">
            <div v-if="loadingDetail && !detailMap[p.proyecto_id]" class="ms-chart-loading">
              <LoaderCircleIcon class="size-[1em] animate-spin" /> <span>Cargando datos…</span>
            </div>
            <ProjectLiveChart v-else :detail="detailMap[p.proyecto_id]" />
            <span class="ms-chart-expand"><MoveIcon class="size-[1em]" /> Inversores</span>
          </div>

          <!-- Reconectador: estado + telemetría en vivo de Solenium -->
          <ReconnectorPanel v-if="rcnMap[p.proyecto_id]" :relay="rcnMap[p.proyecto_id]" />

          <!-- Falla(s) activa(s) del proyecto -->
          <div v-if="(fallasMap[p.proyecto_id] || []).length" class="ms-fallas">
            <button v-for="f in (fallasMap[p.proyecto_id] || []).slice(0, 2)" :key="f.id"
              class="ms-falla" @click="openFalla(f)">
              <span class="ms-falla-stripe" :style="{ background: colorPrioridad(f.prioridad?.codigo, '#9ca3af') }" />
              <span class="ms-falla-estado" :style="{ background: colorEstado(f.estado?.codigo) + '22', color: colorEstado(f.estado?.codigo) }">{{ f.estado?.etiqueta }}</span>
              <span class="ms-falla-tipo">{{ f.tipo?.etiqueta || 'Falla' }}</span>
              <ChevronRightIcon class="ms-falla-arrow size-[1em]" />
            </button>
            <span v-if="(fallasMap[p.proyecto_id] || []).length > 2" class="ms-falla-more">
              +{{ (fallasMap[p.proyecto_id] || []).length - 2 }} fallas más
            </span>
          </div>

          <!-- Pie -->
          <div class="ms-footer">
            <span class="ms-updated"><ClockIcon class="size-[1em]" /> {{ lastUpdated || '—' }}</span>
            <button v-if="rcnMap[p.proyecto_id]" class="ms-reconnect" @click="openSheet(p)">
              <span :class="['ms-relay-badge', relayBadgeClass(p)]">{{ relayBadgeText(p) }}</span>
              <PowerIcon class="size-[1em]" /> Reconectar
            </button>
          </div>
        </section>
      </div>
    </main>

    <!-- ══ ESTADOS sin proyectos ══ -->
    <div v-else class="ms-state">
      <template v-if="loadingList"><LoaderCircleIcon class="size-[1em] animate-spin" /> <span>Cargando proyectos…</span></template>
      <template v-else>
        <SunIcon class="size-[1em]" style="font-size:34px;color:#cbd5e1" />
        <span>Sin proyectos disponibles</span>
        <button class="ms-retry" @click="cargarLista">Reintentar</button>
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

    <FallaCreateSheet :open="createOpen" :catalogos="catalogos" :proyectos="proyectosFalla"
      :prefill-proyecto-id="createProyectoId" @close="createOpen = false" @created="onFallaCreated" />
    <FallaDetailSheet :open="fallaDetailOpen" :falla="fallaDetail" :catalogos="catalogos"
      @close="fallaDetailOpen = false" @updated="onFallaUpdated" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { FallasService } from '~/features/fallas/services/fallas'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { ReconectadoresService } from '~/features/mobile/services/reconectadores'
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
import { BellIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, LoaderCircleIcon, LogOutIcon, MenuIcon, MoveIcon, PlusIcon, PowerIcon, RefreshCwIcon, SunIcon, UserIcon, ZapIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'

const router = useRouter()
const { user, signOut } = useAuth()
const { register } = usePwa()
const fallasService = new FallasService()
const notificacionesService = new NotificacionesService()
const generacionSolarService = new GeneracionSolarService()
const reconectadoresService = new ReconectadoresService()

const STATUS_COLORS = {
  online: '#16a34a', degradado: '#d97706', caido: '#dc2626',
  sin_comunicacion: '#9ca3af', offline: '#d1d5db',
}
function statusColor(s) { return STATUS_COLORS[s] || '#9ca3af' }

// ── Estado ──────────────────────────────────────────────────────────────────
const proyectos     = ref([])
const idx           = ref(0)
const detailMap     = reactive({})  // proyecto_id → detalle
const nowMap        = reactive({})  // proyecto_id → { inv, med } (potencia "ahora")
const rcnMap        = reactive({})  // proyecto_id → { active, telemetría del relay }
const loadingList   = ref(false)
const loadingDetail = ref(0)  // contador: >0 = cargando (permite cargas paralelas)
const lastUpdated   = ref('')
const menuOpen      = ref(false)
const pickerOpen    = ref(false)
const sheetOpen     = ref(false)
const sheetTarget   = ref(null)
const notifOpen     = ref(false)
const invOpen       = ref(false)
const invTarget     = ref(null)
const unreadCount   = ref(0)
let refreshTimer    = null

// ── Fallas (falla activa por proyecto + reportar) ────────────────────────────
const catalogos       = reactive({ estados: [], prioridades: [], tipos: [], resoluciones: [] })
const fallasMap       = reactive({})   // proyecto_id → [fallas activas]
const createOpen      = ref(false)
const createProyectoId = ref(null)
const fallaDetailOpen = ref(false)
const fallaDetail     = ref(null)

const proyectosFalla = computed(() =>
  proyectos.value.map((p) => ({ id: p.proyecto_id, nombre_comercial: p.nombre })))

async function cargarCatalogos() {
  try {
    const cat = await fallasService.obtenerCatalogos()
    Object.assign(catalogos, cat)
  } catch { /* no crítico — la generación funciona igual */ }
}

async function loadFallas(proyectoId, force = false) {
  if (!proyectoId) return
  if (fallasMap[proyectoId] && !force) return
  try {
    const data = await fallasService.listar({ proyecto_id: proyectoId, size: 100 })
    fallasMap[proyectoId] = (data.items ?? []).filter((f) => !f.estado?.es_estado_final)
  } catch { if (!fallasMap[proyectoId]) fallasMap[proyectoId] = [] }
}

function openCreate() {
  if (!current.value) return
  createProyectoId.value = current.value.proyecto_id
  createOpen.value = true
}
function onFallaCreated() {
  if (createProyectoId.value) loadFallas(createProyectoId.value, true)
}
function openFalla(f) { fallaDetail.value = f; fallaDetailOpen.value = true }
function onFallaUpdated(f) { if (f?.proyecto_id) loadFallas(f.proyecto_id, true) }

async function fetchUnread() {
  try {
    unreadCount.value = await notificacionesService.contarNoLeidas()
  } catch { /* silencioso */ }
}

const current = computed(() => proyectos.value[idx.value] || null)

function relayBadgeText(p)  { const a = rcnMap[p.proyecto_id]?.active; return a === true ? 'ON' : a === false ? 'OFF' : '—' }
function relayBadgeClass(p) { const a = rcnMap[p.proyecto_id]?.active; return a === true ? 'ms-relay-badge--on' : a === false ? 'ms-relay-badge--off' : 'ms-relay-badge--unk' }

// ── Swipe deck ───────────────────────────────────────────────────────────────
const deckRef  = ref(null)
const slideW   = ref(typeof window !== 'undefined' ? window.innerWidth : 360)
const dragX    = ref(0)
const dragging = ref(false)
let startX = 0, startY = 0, horizontal = null
let tapMoved = false   // true si el dedo se movió: entonces no fue un toque

const trackStyle = computed(() => ({
  transform: `translate3d(${-idx.value * slideW.value + dragX.value}px, 0, 0)`,
  transition: dragging.value ? 'none' : 'transform .34s cubic-bezier(.22,.61,.36,1)',
}))

function measure() { slideW.value = deckRef.value?.clientWidth || window.innerWidth }

function onTouchStart(e) {
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  horizontal = null
  tapMoved = false
  dragging.value = true
}
function onTouchMove(e) {
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) tapMoved = true
  if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) horizontal = Math.abs(dx) > Math.abs(dy)
  if (!horizontal) return
  let d = dx
  // resistencia en los extremos
  if ((idx.value === 0 && d > 0) || (idx.value === proyectos.value.length - 1 && d < 0)) d *= 0.35
  dragX.value = d
}
function onTouchEnd() {
  dragging.value = false
  const th = slideW.value * 0.18
  if (dragX.value <= -th && idx.value < proyectos.value.length - 1) {
    idx.value++
    dragX.value += slideW.value
    requestAnimationFrame(() => { dragX.value = 0 })
  } else if (dragX.value >= th && idx.value > 0) {
    idx.value--
    dragX.value -= slideW.value
    requestAnimationFrame(() => { dragX.value = 0 })
  } else {
    dragX.value = 0
  }
  horizontal = null
}

// ── Carga ───────────────────────────────────────────────────────────────────
async function cargarLista() {
  loadingList.value = true
  try {
    const res = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = res.projects ?? []
    if (idx.value >= proyectos.value.length) idx.value = 0
  } catch { /* el estado vacío lo maneja */ } finally {
    loadingList.value = false
  }
  await nextTick(); measure()
  cargarEstados()
  prefetchAround()
}

async function cargarEstados() {
  try {
    const data = await reconectadoresService.obtenerEstados()
    for (const r of data) rcnMap[r.proyecto_id] = r
  } catch { /* silencioso */ }
}

async function loadDetail(id, force = false) {
  if (!id) return
  if (detailMap[id] && !force) return
  loadingDetail.value++
  try {
    const res = await generacionSolarService.obtenerDetalle(id)
    detailMap[id] = res
    // El MISMO numero que el escritorio: energia acumulada del dia en kWh, no
    // la potencia instantanea. Ver el docstring de ~/features/solar/serieSolar.
    nowMap[id] = {
      inv: acumuladoInversores(res), invHasta: hastaInversores(res),
      med: acumuladoMedidor(res), medHasta: hastaMedidor(res),
    }
    lastUpdated.value = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  } catch { if (!detailMap[id]) detailMap[id] = {} } finally {
    loadingDetail.value = Math.max(0, loadingDetail.value - 1)
  }
}

// carga el proyecto actual + sus vecinos (para que el swipe ya tenga datos)
function prefetchAround() {
  const ids = [idx.value, idx.value - 1, idx.value + 1]
    .map((i) => proyectos.value[i]?.proyecto_id).filter(Boolean)
  ids.forEach((id) => { loadDetail(id); loadFallas(id) })
}

function refrescar() {
  if (current.value) { loadDetail(current.value.proyecto_id, true); loadFallas(current.value.proyecto_id, true) }
  cargarEstados()
  fetchUnread()
}

watch(idx, prefetchAround)

// ── Navegación ───────────────────────────────────────────────────────────────
function selectIdx(i) { idx.value = i; pickerOpen.value = false }

// ── Potencia por inversor ────────────────────────────────────────────────────
// Solo abre si fue un toque: un swipe entre proyectos o un scroll vertical
// también terminan en un `click`, y no deben abrir la hoja.
function onChartTap(p) {
  if (tapMoved) return
  invTarget.value = p
  invOpen.value = true
}

// ── Reconexión ───────────────────────────────────────────────────────────────
function openSheet(p) { sheetTarget.value = p; sheetOpen.value = true }
function onReconnectDone({ active }) {
  const p = sheetTarget.value
  if (!p) return
  // Refleja el comando de inmediato; `cargarEstados()` traerá la lectura real.
  rcnMap[p.proyecto_id] = { ...(rcnMap[p.proyecto_id] || {}), active }
  toast.success('Comando enviado', { description: `${p.nombre}: ${active ? 'ON' : 'OFF'}`, duration: 3500 })
  cargarEstados()
}

// ── Sesión ─────────────────────────────────────────────────────────────────
function cerrarSesion() { signOut(); router.replace('/m/login') }

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
.ms-root {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh; overflow: hidden;
  background: #f3f4f6; color: var(--color-unergy-deep);
  font-family: system-ui, -apple-system, sans-serif;
}

/* Top bar */
.ms-topbar {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: var(--color-unergy-deep); color: #fff; position: relative;
}
.ms-brand { flex: 1; text-align: center; font-size: clamp(14px, 3.9vw, 16px); font-weight: 700; letter-spacing: .2px; }
.ms-brand svg { color: var(--color-unergy-yellow); margin-right: 5px; }
.ms-icon-btn {
  width: 36px; height: 36px; border-radius: 10px; border: none;
  background: rgba(255,255,255,0.1); color: #fff; font-size: 15px; flex-shrink: 0;
}
.ms-icon-btn:disabled { opacity: .5; }
.ms-bell { position: relative; }
.ms-bell-badge {
  position: absolute; top: 1px; right: 1px; min-width: 17px; height: 17px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  background: #dc2626; color: #fff; font-size: 10px; font-weight: 800;
  border-radius: 9px; border: 2px solid var(--color-unergy-deep);
}

.ms-menu { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.2); }
.ms-menu-card {
  position: absolute; top: calc(56px + env(safe-area-inset-top)); left: 12px;
  background: #fff; border-radius: 14px; padding: 8px; min-width: 230px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.25);
}
.ms-menu-user { display: flex; align-items: center; gap: 10px; padding: 10px 10px 12px; border-bottom: 1px solid #f0ebf7; }
.ms-menu-user svg { font-size: 22px; color: var(--color-unergy-purple); }
.ms-menu-name { font-size: 15px; font-weight: 700; color: var(--color-unergy-deep); }
.ms-menu-email { font-size: 12.5px; color: #9ca3af; }
.ms-menu-item {
  display: flex; align-items: center; gap: 9px; width: 100%; margin-top: 6px;
  padding: 12px 10px; border: none; background: none; border-radius: 9px;
  font-size: 15px; color: #b91c1c; font-weight: 600; text-align: left;
}

/* Selector */
.ms-selector {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  padding: 9px 12px; background: #fff; border-bottom: 1px solid #eceaf2; position: relative;
}
.ms-current {
  flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0;
  padding: 9px 12px; border: 1px solid #eceaf2; border-radius: 12px; background: #faf8fd;
}
.ms-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.ms-name { flex: 1; min-width: 0; font-size: clamp(14px, 4vw, 16px); font-weight: 700; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-caret { font-size: 11px; color: #9ca3af; }
.ms-count { font-size: 12px; color: #9ca3af; font-weight: 700; flex-shrink: 0; white-space: nowrap; }
.ms-add-falla {
  width: 38px; height: 38px; flex-shrink: 0; border: none; border-radius: 11px;
  background: var(--color-unergy-yellow); color: var(--color-unergy-deep); font-size: 17px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 10px rgba(246,255,114,0.5);
}

.ms-picker { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.25); }
.ms-picker-card {
  position: absolute; top: 0; left: 0; right: 0; max-height: 78vh; overflow-y: auto;
  background: #fff; border-radius: 0 0 18px 18px; padding: 8px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.25);
}
.ms-picker-head { font-size: 12px; font-weight: 700; color: #9ca3af; padding: 12px 12px 8px; text-transform: uppercase; letter-spacing: .5px; }
.ms-picker-item {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 14px 12px; border: none; background: none; border-radius: 10px;
  font-size: 15.5px; color: var(--color-unergy-deep); text-align: left;
}
.ms-picker-item--active { background: #f3edfb; font-weight: 700; }
.ms-picker-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-picker-relay { color: #EAB308; font-size: 14px; }

/* Deck swipeable */
.ms-deck { flex: 1; overflow: hidden; touch-action: pan-y; }
.ms-track { display: flex; height: 100%; will-change: transform; }
.ms-slide {
  flex: 0 0 100%; width: 100%; height: 100%;
  display: flex; flex-direction: column; padding: 11px 13px 12px;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
}

.ms-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: #6b5a8a; font-size: 15px;
}
.ms-state svg { font-size: 26px; color: var(--color-unergy-purple); }
.ms-retry { margin-top: 4px; padding: 10px 20px; border: none; border-radius: 11px; background: var(--color-unergy-purple); color: #fff; font-weight: 600; font-size: 15px; }

/* Chips "ahora" */
.ms-now { display: flex; gap: 8px; margin-bottom: 8px; flex-shrink: 0; }
.ms-now-chip {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px;
  background: #fff; border: 1px solid #eceaf2; border-radius: 11px; padding: 6px 10px;
}
.ms-now-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ms-now-text { display: flex; flex-direction: column; min-width: 0; }
.ms-now-label { font-size: clamp(9.5px, 2.6vw, 10.5px); color: #787774; font-weight: 500; }
.ms-now-hasta { font-size: clamp(8.5px, 2.3vw, 9.5px); color: #9b89b5; font-weight: 400; line-height: 1.2; white-space: nowrap; }
.ms-now-val { font-size: clamp(13px, 3.8vw, 16px); font-weight: 700; color: var(--color-unergy-deep); line-height: 1.15; letter-spacing: -0.2px; white-space: nowrap; }

.ms-chart {
  flex: 1; min-height: 0; position: relative;
  /* tope de alto ≈ 52% del ancho: panorámica pero con más presencia que las chips */
  max-height: min(52vw, 38vh); min-height: 148px;
  background: #fff; border: 1px solid #eceaf2; border-radius: 16px; padding: 12px 10px 6px;
}

/* Franja de fallas activas */
.ms-fallas { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; flex-shrink: 0; }
.ms-falla {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  background: #fff; border: 1px solid #f0e4e4; border-left: 3px solid #f59e0b;
  border-radius: 11px; padding: 8px 10px;
}
.ms-falla-stripe { display: none; }
.ms-falla-estado { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; flex-shrink: 0; }
.ms-falla-tipo { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--color-unergy-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-falla-arrow { font-size: 11px; color: #c4b8d8; flex-shrink: 0; }
.ms-falla-more { font-size: 11px; color: #9ca3af; text-align: center; }
.ms-chart-expand {
  position: absolute; top: 9px; right: 10px;
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 8px;
  background: #f6f2fc; color: var(--color-unergy-purple);
  font-size: 10px; font-weight: 700; letter-spacing: .2px;
  pointer-events: none;   /* el toque lo recibe la gráfica */
}
.ms-chart-expand svg { font-size: 9px; }

.ms-chart-loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  gap: 10px; color: #6b5a8a; font-size: 14px;
}
.ms-chart-loading svg { font-size: 22px; color: var(--color-unergy-purple); }

.ms-footer { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-shrink: 0; }
.ms-updated { font-size: 12px; color: #9ca3af; display: flex; align-items: center; gap: 6px; }
.ms-reconnect {
  margin-left: auto; display: flex; align-items: center; gap: 8px;
  padding: 11px 16px; border: none; border-radius: 12px;
  background: var(--color-unergy-purple); color: #fff; font-size: clamp(13px, 3.6vw, 14.5px); font-weight: 700;
  box-shadow: 0 5px 14px rgba(145,91,216,0.32);
}
.ms-relay-badge { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; }
.ms-relay-badge--on  { background: #dcfce7; color: #15803d; }
.ms-relay-badge--off { background: #fee2e2; color: #b91c1c; }
.ms-relay-badge--unk { background: rgba(255,255,255,0.2); color: #fff; }
</style>
