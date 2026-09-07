<template>
  <div class="mf-root">
    <!-- TOP BAR -->
    <header class="mf-topbar">
      <span class="mf-brand"><WrenchIcon class="size-[1em]" /> Fallas</span>
      <button class="mf-icon-btn mf-bell" @click="notifOpen = true" title="Notificaciones">
        <BellIcon class="size-[1em]" />
        <span v-if="unreadCount > 0" class="mf-bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
      <button class="mf-icon-btn mf-add" @click="createOpen = true" title="Registrar falla"><PlusIcon class="size-[1em]" /></button>
    </header>

    <!-- FILTROS -->
    <div class="mf-filters">
      <div class="mf-search">
        <SearchIcon class="size-[1em]" />
        <input v-model="search" placeholder="Buscar código, descripción, proyecto…" />
        <XIcon class="mf-clear size-[1em]" v-if="search" @click="search = ''" />
      </div>
      <div class="mf-chips">
        <button :class="['mf-fchip', filtro === 'activas' && 'mf-fchip--on']" @click="filtro = 'activas'">Activas</button>
        <button :class="['mf-fchip', filtro === 'programadas' && 'mf-fchip--on']" @click="filtro = 'programadas'">Programadas</button>
        <button :class="['mf-fchip', filtro === null && 'mf-fchip--on']" @click="filtro = null">Todas</button>
        <button v-for="e in catalogos.estados" :key="e.id"
          :class="['mf-fchip', filtro === e.id && 'mf-fchip--on']"
          :style="filtro === e.id ? { background: colorEstado(e.codigo), borderColor: colorEstado(e.codigo), color: '#fff' } : {}"
          @click="filtro = e.id">{{ e.etiqueta }}</button>
      </div>
    </div>

    <!-- LISTA -->
    <main class="mf-list">
      <div v-if="loading" class="mf-state"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando fallas…</div>
      <div v-else-if="!filtradas.length" class="mf-state">
        <CircleCheckIcon class="size-[1em]" style="font-size:34px;color:#22c55e" />
        <span>{{ fallas.length ? 'Sin resultados con estos filtros' : 'No hay fallas registradas' }}</span>
        <button class="mf-empty-add" @click="createOpen = true"><PlusIcon class="size-[1em]" /> Registrar falla</button>
      </div>
      <template v-else>
        <button v-for="f in filtradas" :key="f.id" class="mf-card" @click="openDetail(f)">
          <span class="mf-stripe" :style="{ background: colorPrioridad(f.prioridad?.codigo, '#9ca3af') }" />
          <div class="mf-card-main">
            <div class="mf-card-top">
              <code class="mf-card-code">{{ f.codigo_interno }}</code>
              <span class="mf-card-estado" :style="{ background: colorEstado(f.estado?.codigo) + '22', color: colorEstado(f.estado?.codigo) }">{{ f.estado?.etiqueta }}</span>
            </div>
            <div class="mf-card-tipo">{{ f.tipo?.etiqueta || 'Falla' }}</div>
            <div class="mf-card-proj"><ZapIcon class="size-[1em]" /> {{ f.proyecto?.nombre_comercial || '—' }}</div>
            <div class="mf-card-foot">
              <span class="mf-prio" :style="{ color: colorPrioridad(f.prioridad?.codigo, '#6b5a8a') }">{{ f.prioridad?.etiqueta }}</span>
              <span class="mf-time">{{ relativeTime(f.fecha_identificacion) }}</span>
            </div>
          </div>
        </button>
      </template>
    </main>

    <MobileTabBar />

    <FallaDetailSheet :open="detailOpen" :falla="detailFalla" :catalogos="catalogos"
      @close="detailOpen = false" @updated="onUpdated" />
    <FallaCreateSheet :open="createOpen" :catalogos="catalogos" :proyectos="proyectos"
      @close="createOpen = false" @created="onCreated" />
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
const filtro = ref('activas')  // 'activas' | 'programadas' | null (todas) | <estado_id>

const detailOpen = ref(false)
const detailFalla = ref(null)
const createOpen = ref(false)
const notifOpen = ref(false)
const unreadCount = ref(0)

function esProgramado(f) {
  return (f.estado?.codigo || '').toLowerCase() === 'programado'
    || (f.estado?.etiqueta || '').toLowerCase().startsWith('program')
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
    list = list.filter((f) =>
      (f.codigo_interno || '').toLowerCase().includes(q)
      || (f.descripcion || '').toLowerCase().includes(q)
      || (f.proyecto?.nombre_comercial || '').toLowerCase().includes(q)
      || (f.tipo?.etiqueta || '').toLowerCase().includes(q))
  }
  // abiertas primero, luego por fecha desc
  return [...list].sort((a, b) => {
    const af = a.estado?.es_estado_final ? 1 : 0
    const bf = b.estado?.es_estado_final ? 1 : 0
    if (af !== bf) return af - bf
    return (b.fecha_identificacion || '').localeCompare(a.fecha_identificacion || '')
  })
})

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
      fallasService.obtenerCatalogos(),
      proyectosService.listar({ size: 500 }),
    ])
    Object.assign(catalogos, cat)
    proyectos.value = proy ?? []
    await cargarFallas()
  } catch (e) {
    toast.error('Error al cargar', { description: e.data?.detail, duration: 3000 })
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
.mf-root {
  display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden;
  background: #f3f4f6; color: var(--color-unergy-deep); font-family: system-ui, -apple-system, sans-serif;
}

/* Top bar */
.mf-topbar {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: var(--color-unergy-deep); color: #fff;
}
.mf-brand { flex: 1; font-size: clamp(15px, 4vw, 17px); font-weight: 700; }
.mf-brand svg { color: var(--color-unergy-yellow); margin-right: 6px; }
.mf-icon-btn { width: 36px; height: 36px; border-radius: 10px; border: none; background: rgba(255,255,255,0.1); color: #fff; font-size: 15px; position: relative; }
.mf-add { background: var(--color-unergy-purple); }
.mf-bell-badge {
  position: absolute; top: 1px; right: 1px; min-width: 17px; height: 17px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; border-radius: 9px; border: 2px solid var(--color-unergy-deep);
}

/* Filtros */
.mf-filters { flex-shrink: 0; background: #fff; padding: 12px 14px; border-bottom: 1px solid #eceaf2; }
.mf-search { display: flex; align-items: center; gap: 9px; background: #f5f3fa; border-radius: 12px; padding: 11px 14px; }
.mf-search svg { color: #9ca3af; font-size: 15px; }
.mf-search input { flex: 1; border: none; background: none; outline: none; font-size: 16px; color: var(--color-unergy-deep); }
.mf-clear { color: #9ca3af; }
.mf-chips { display: flex; gap: 8px; margin-top: 11px; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
.mf-fchip { white-space: nowrap; padding: 7px 14px; border-radius: 20px; border: 1.5px solid #e5e7eb; background: #fff; font-size: 13.5px; font-weight: 600; color: #6b5a8a; flex-shrink: 0; }
.mf-fchip--on { background: var(--color-unergy-deep); border-color: var(--color-unergy-deep); color: #fff; }

/* Lista */
.mf-list { flex: 1; overflow-y: auto; padding: 12px 14px; -webkit-overflow-scrolling: touch; }
.mf-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: #6b5a8a; font-size: 15px; text-align: center; }
.mf-state svg { font-size: 26px; color: var(--color-unergy-purple); }
.mf-empty-add { margin-top: 6px; display: flex; align-items: center; gap: 8px; padding: 11px 20px; border: none; border-radius: 12px; background: var(--color-unergy-purple); color: #fff; font-weight: 700; font-size: 15px; }

.mf-card {
  width: 100%; display: flex; gap: 0; text-align: left; margin-bottom: 11px;
  background: #fff; border: 1px solid #eceaf2; border-radius: 15px; overflow: hidden;
}
.mf-stripe { width: 5px; flex-shrink: 0; }
.mf-card-main { flex: 1; min-width: 0; padding: 13px 15px; }
.mf-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.mf-card-code { font-family: ui-monospace, monospace; font-size: 12px; color: var(--color-unergy-purple-dark); background: #f3edfb; padding: 1px 7px; border-radius: 6px; }
.mf-card-estado { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 7px; }
.mf-card-tipo { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); line-height: 1.25; }
.mf-card-proj { font-size: 12.5px; color: #6b5a8a; margin-top: 3px; display: flex; align-items: center; gap: 5px; }
.mf-card-proj svg { font-size: 11px; color: var(--color-unergy-purple); }
.mf-card-foot { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
.mf-prio { font-size: 12.5px; font-weight: 700; }
.mf-time { font-size: 12px; color: #9ca3af; }
</style>
