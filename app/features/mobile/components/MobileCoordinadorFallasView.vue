<template>
  <div class="cf-root">
    <!-- TOP BAR -->
    <header class="cf-topbar">
      <div class="cf-topbar-left">
        <span class="cf-role-badge">Coordinador</span>
        <span class="cf-brand"><WrenchIcon class="size-[1em]" /> Fallas</span>
      </div>
      <button class="cf-icon-btn cf-bell" @click="notifOpen = true" title="Notificaciones">
        <BellIcon class="size-[1em]" />
        <span v-if="unreadCount > 0" class="cf-bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
      <button class="cf-icon-btn cf-add" @click="createOpen = true" title="Registrar falla">
        <PlusIcon class="size-[1em]" />
      </button>
    </header>

    <!-- FILTROS -->
    <div class="cf-filters">
      <div class="cf-search">
        <SearchIcon class="size-[1em]" />
        <input v-model="search" placeholder="Código, descripción, proyecto…" />
        <XIcon class="cf-clear size-[1em]" v-if="search" @click="search = ''" />
      </div>
      <div class="cf-chips">
        <button :class="['cf-fchip', filtro === 'activas' && 'cf-fchip--on']" @click="filtro = 'activas'">Activas</button>
        <button :class="['cf-fchip', filtro === null && 'cf-fchip--on']" @click="filtro = null">Todas</button>
        <button v-for="e in catalogos.estados" :key="e.id"
          :class="['cf-fchip', filtro === e.id && 'cf-fchip--on']"
          :style="filtro === e.id ? chipStyle(colorEstado(e.codigo)) : {}"
          @click="filtro = e.id">{{ e.etiqueta }}</button>
      </div>
    </div>

    <!-- CONTADORES -->
    <div class="cf-stats">
      <div class="cf-stat">
        <span class="cf-stat-n">{{ activas }}</span>
        <span class="cf-stat-l">Activas</span>
      </div>
      <div class="cf-stat cf-stat--ok">
        <span class="cf-stat-n">{{ resueltas }}</span>
        <span class="cf-stat-l">Resueltas</span>
      </div>
    </div>

    <!-- LISTA -->
    <main class="cf-list">
      <div v-if="loading" class="cf-state"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>
      <div v-else-if="!filtradas.length" class="cf-state">
        <CircleCheckIcon class="size-[1em]" style="font-size:32px;color:#22c55e" />
        <span>{{ fallas.length ? 'Sin resultados con estos filtros' : 'No hay fallas registradas' }}</span>
        <button class="cf-empty-add" @click="createOpen = true"><PlusIcon class="size-[1em]" /> Registrar falla</button>
      </div>
      <template v-else>
        <button v-for="f in filtradas" :key="f.id" class="cf-card" @click="openDetail(f)">
          <span class="cf-stripe" :style="{ background: colorPrioridad(f.prioridad?.codigo, '#9ca3af') }" />
          <div class="cf-card-main">
            <div class="cf-card-top">
              <code class="cf-card-code">{{ f.codigo_interno }}</code>
              <span class="cf-card-estado" :style="estadoStyle(f.estado)">{{ f.estado?.etiqueta }}</span>
            </div>
            <div class="cf-card-tipo">{{ f.tipo?.etiqueta || 'Falla' }}</div>
            <div class="cf-card-proj"><ZapIcon class="size-[1em]" /> {{ f.proyecto?.nombre_comercial || '—' }}</div>
            <div class="cf-card-foot">
              <span class="cf-prio" :style="{ color: colorPrioridad(f.prioridad?.codigo, '#6b5a8a') }">{{ f.prioridad?.etiqueta }}</span>
              <span class="cf-time">{{ relativeTime(f.fecha_identificacion) }}</span>
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

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { FallasService } from '~/features/fallas/services/fallas'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'
import FallaDetailSheet from '~/features/mobile/components/components/FallaDetailSheet.vue'
import FallaCreateSheet from '~/features/mobile/components/components/FallaCreateSheet.vue'
import NotificationsSheet from '~/features/mobile/components/components/NotificationsSheet.vue'
import { BellIcon, CircleCheckIcon, LoaderCircleIcon, PlusIcon, SearchIcon, WrenchIcon, XIcon, ZapIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'

const fallasService = new FallasService()
const proyectosService = new ProyectosService()
const notificacionesService = new NotificacionesService()
const fallas = ref([])
const catalogos = reactive({ estados: [], prioridades: [], tipos: [], resoluciones: [] })
const proyectos = ref([])
const loading = ref(false)

const search = ref('')
const filtro = ref('activas')

const detailOpen = ref(false)
const detailFalla = ref(null)
const createOpen = ref(false)
const notifOpen = ref(false)
const unreadCount = ref(0)

const activas    = computed(() => fallas.value.filter((f) => !f.estado?.es_estado_final).length)
const resueltas  = computed(() => fallas.value.filter((f) =>  f.estado?.es_estado_final).length)

const filtradas = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = fallas.value
  if (filtro.value === 'activas') {
    list = list.filter((f) => !f.estado?.es_estado_final)
  } else if (typeof filtro.value === 'number') {
    list = list.filter((f) => f.estado?.id === filtro.value)
  }
  if (q) {
    list = list.filter((f) =>
      (f.codigo_interno || '').toLowerCase().includes(q)
      || (f.descripcion || '').toLowerCase().includes(q)
      || (f.proyecto?.nombre_comercial || '').toLowerCase().includes(q))
  }
  return [...list].sort((a, b) => {
    const af = a.estado?.es_estado_final ? 1 : 0
    const bf = b.estado?.es_estado_final ? 1 : 0
    if (af !== bf) return af - bf
    return (b.fecha_identificacion || '').localeCompare(a.fecha_identificacion || '')
  })
})

function chipStyle(color) {
  const c = color || '#915BD8'
  return { background: c, borderColor: c, color: '#fff' }
}
function estadoStyle(estado) {
  const c = colorEstado(estado?.codigo)
  return { background: c + '22', color: c }
}
function relativeTime(s) {
  if (!s) return ''
  const dias = Math.floor((Date.now() - new Date(s + 'T00:00:00').getTime()) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} d`
  return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

async function cargar() {
  loading.value = true
  try {
    const [cat, proy] = await Promise.all([
      fallasService.obtenerCatalogos().catch(() => ({ estados: [], prioridades: [], tipos: [], resoluciones: [] })),
      proyectosService.listar({ size: 500 }).catch(() => []),
    ])
    Object.assign(catalogos, cat)
    proyectos.value = proy ?? []
    await cargarFallas()
  } catch (e) {
    toast.error('Error al cargar fallas', {
      description: e.data?.detail || e.message,
      duration: 4000,
    })
  } finally {
    loading.value = false
  }
}

async function cargarFallas() {
  const primera = await fallasService.listar({ page: 1, size: 500 })
  let items = primera.items ?? []
  const total = primera.total ?? items.length
  const pages = Math.ceil(total / 500)
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => fallasService.listar({ page: i + 2, size: 500 })))
    for (const r of rest) items = items.concat(r.items ?? [])
  }
  fallas.value = items
}

function openDetail(f) { detailFalla.value = f; detailOpen.value = true }
function onUpdated(falla) {
  const idx = fallas.value.findIndex((x) => x.id === falla.id)
  if (idx >= 0) fallas.value[idx] = falla
}
function onCreated() { cargarFallas() }

async function fetchUnread() {
  try { unreadCount.value = await notificacionesService.contarNoLeidas() }
  catch { /* silencioso */ }
}

onMounted(() => { cargar(); fetchUnread() })
</script>

<style scoped>
.cf-root {
  display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden;
  background: #f3f4f6; color: var(--color-unergy-deep); font-family: system-ui, -apple-system, sans-serif;
}

/* Top bar */
.cf-topbar {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: #1e3a5f; color: #fff;
}
.cf-topbar-left { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.cf-role-badge {
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .8px;
  color: #93c5fd; background: rgba(147,197,253,.15); padding: 1px 7px; border-radius: 5px;
  align-self: flex-start;
}
.cf-brand { font-size: clamp(14px, 4vw, 16px); font-weight: 700; }
.cf-brand svg { color: #fbbf24; margin-right: 5px; }
.cf-icon-btn {
  width: 38px; height: 38px; border-radius: 10px; border: none;
  background: rgba(255,255,255,0.12); color: #fff; font-size: 15px; position: relative;
}
.cf-add { background: #2563eb; }
.cf-bell-badge {
  position: absolute; top: 1px; right: 1px; min-width: 17px; height: 17px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; border-radius: 9px; border: 2px solid #1e3a5f;
}

/* Filtros */
.cf-filters { flex-shrink: 0; background: #fff; padding: 12px 14px; border-bottom: 1px solid #eceaf2; }
.cf-search { display: flex; align-items: center; gap: 9px; background: #f1f5f9; border-radius: 12px; padding: 11px 14px; }
.cf-search svg { color: #9ca3af; font-size: 15px; }
.cf-search input { flex: 1; border: none; background: none; outline: none; font-size: 16px; color: var(--color-unergy-deep); }
.cf-clear { color: #9ca3af; }
.cf-chips { display: flex; gap: 8px; margin-top: 11px; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
.cf-fchip {
  white-space: nowrap; padding: 7px 14px; border-radius: 20px; border: 1.5px solid #e5e7eb;
  background: #fff; font-size: 13px; font-weight: 600; color: #374151; flex-shrink: 0;
  display: flex; align-items: center; gap: 5px;
}
.cf-fchip--on { background: #1e3a5f; border-color: #1e3a5f; color: #fff; }

/* Stats */
.cf-stats {
  display: flex; flex-shrink: 0; background: #fff; border-bottom: 1px solid #eceaf2;
  padding: 10px 14px; gap: 0;
}
.cf-stat {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px;
  border-right: 1px solid #eceaf2;
}
.cf-stat:last-child { border-right: none; }
.cf-stat-n { font-size: 22px; font-weight: 800; color: #1e3a5f; }
.cf-stat--ok .cf-stat-n { color: #16a34a; }
.cf-stat-l { font-size: 11px; color: #9b8db5; font-weight: 600; }

/* Lista */
.cf-list { flex: 1; overflow-y: auto; padding: 12px 14px; -webkit-overflow-scrolling: touch; }
.cf-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: #6b5a8a; font-size: 15px; text-align: center; }
.cf-state svg { font-size: 26px; color: #2563eb; }
.cf-empty-add { margin-top: 6px; display: flex; align-items: center; gap: 8px; padding: 11px 20px; border: none; border-radius: 12px; background: #2563eb; color: #fff; font-weight: 700; font-size: 15px; }

.cf-card {
  width: 100%; display: flex; text-align: left; margin-bottom: 11px;
  background: #fff; border: 1px solid #eceaf2; border-radius: 15px; overflow: hidden;
}
.cf-stripe { width: 5px; flex-shrink: 0; }
.cf-card-main { flex: 1; min-width: 0; padding: 13px 15px; }
.cf-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.cf-card-code { font-family: ui-monospace, monospace; font-size: 12px; color: #1e40af; background: #eff6ff; padding: 1px 7px; border-radius: 6px; }
.cf-card-estado { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 7px; }
.cf-card-tipo { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); line-height: 1.25; }
.cf-card-proj { font-size: 12.5px; color: #6b5a8a; margin-top: 3px; display: flex; align-items: center; gap: 5px; }
.cf-card-proj svg { font-size: 11px; color: #2563eb; }
.cf-card-foot { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
.cf-prio { font-size: 12.5px; font-weight: 700; }
.cf-time { font-size: 12px; color: #9ca3af; }
</style>
