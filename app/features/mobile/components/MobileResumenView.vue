<template>
  <div class="rs-root">
    <!-- ══ TOP BAR ══ -->
    <header class="rs-topbar">
      <span class="rs-brand"><ChartColumnIcon class="size-[1em]" /> Resumen del día</span>
      <button class="rs-icon-btn" :disabled="loading" @click="cargar(true)" title="Actualizar">
        <LoaderCircleIcon v-if="loading" class="size-[1em] animate-spin" />
        <RefreshCwIcon v-else class="size-[1em]" />
      </button>
    </header>

    <main class="rs-scroll">
      <div class="rs-date">{{ fechaLarga }}</div>

      <!-- Totales del día -->
      <div class="rs-totals">
        <div class="rs-total">
          <span class="rs-total-dot" style="background:#14B8A6" />
          <div class="rs-total-text">
            <span class="rs-total-label">Medidores hoy</span>
            <span class="rs-total-val">{{ fmtKwh(gen.medidor?.total) }}</span>
          </div>
        </div>
        <div class="rs-total">
          <span class="rs-total-dot" style="background:var(--color-unergy-purple)" />
          <div class="rs-total-text">
            <span class="rs-total-label">Inversores hoy</span>
            <span class="rs-total-val">{{ fmtKwh(gen.inversor?.total) }}</span>
          </div>
        </div>
      </div>

      <!-- Top Medidores -->
      <TopCard title="Top generación — Medidores" :icon="GaugeIcon" accent="#14B8A6"
        :items="gen.medidor?.top || []" :loading="loadingGen" :max="maxMedidor" />

      <!-- Top Inversores -->
      <TopCard title="Top generación — Inversores" :icon="ZapIcon" accent="var(--color-unergy-purple)"
        :items="gen.inversor?.top || []" :loading="loadingGen" :max="maxInversor" />

      <!-- Fallas de hoy -->
      <section class="rs-card">
        <div class="rs-card-head">
          <WrenchIcon class="size-[1em]" style="color:#f59e0b" />
          <h3 class="rs-card-title">Fallas de hoy</h3>
        </div>

        <div v-if="loadingFallas" class="rs-loading"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>

        <template v-else>
          <!-- Creadas -->
          <div class="rs-group-label">
            <CirclePlusIcon class="size-[1em]" /> Creadas
            <span class="rs-group-count">{{ fallas.creadas?.length || 0 }}</span>
          </div>
          <div v-if="(fallas.creadas?.length || 0) === 0" class="rs-empty-row">Ninguna creada hoy</div>
          <button v-for="f in (fallas.creadas || [])" :key="'c'+f.id" class="rs-falla" @click="openFalla(f)">
            <span class="rs-falla-estado" :style="estadoStyle(f.estado)">{{ f.estado?.etiqueta || '—' }}</span>
            <span class="rs-falla-main">
              <span class="rs-falla-proj">{{ f.proyecto?.nombre_comercial || '—' }}</span>
              <span class="rs-falla-tipo">{{ f.tipo?.etiqueta || f.tipo_libre || 'Falla' }}</span>
            </span>
            <ChevronRightIcon class="rs-falla-arrow size-[1em]" />
          </button>

          <!-- Cambios de estado -->
          <div class="rs-group-label rs-group-label--mt">
            <RefreshCwIcon class="size-[1em]" /> Cambiaron de estado
            <span class="rs-group-count">{{ fallas.cambios_estado?.length || 0 }}</span>
          </div>
          <div v-if="(fallas.cambios_estado?.length || 0) === 0" class="rs-empty-row">Ningún cambio hoy</div>
          <button v-for="(c, i) in (fallas.cambios_estado || [])" :key="'ch' + (c.falla?.id ?? i) + '_' + (c.hora || i)" class="rs-falla" @click="openFalla(c.falla)">
            <span class="rs-falla-main">
              <span class="rs-falla-proj">{{ c.falla?.proyecto?.nombre_comercial || '—' }}</span>
              <span class="rs-falla-transition">
                <span class="rs-falla-estado rs-sm" :style="estadoStyle(c.estado_anterior)">{{ c.estado_anterior?.etiqueta || '—' }}</span>
                <ArrowRightIcon class="rs-trans-arrow size-[1em]" />
                <span class="rs-falla-estado rs-sm" :style="estadoStyle(c.estado_nuevo)">{{ c.estado_nuevo?.etiqueta || '—' }}</span>
              </span>
            </span>
            <span class="rs-falla-hora">{{ horaCorta(c.hora) }}</span>
            <ChevronRightIcon class="rs-falla-arrow size-[1em]" />
          </button>
        </template>
      </section>

      <div class="rs-bottom-space" />
    </main>

    <MobileTabBar />

    <FallaDetailSheet :open="fallaDetailOpen" :falla="fallaDetail" :catalogos="catalogos"
      @close="fallaDetailOpen = false" @updated="onFallaUpdated" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue'
import { logger } from '~/core/logger'
import { FallasService } from '~/features/fallas/services/fallas'
import { colorEstado } from '~/features/fallas/utils/colores'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import MobileTabBar from '~/features/mobile/components/components/MobileTabBar.vue'
import FallaDetailSheet from '~/features/mobile/components/components/FallaDetailSheet.vue'
import { ArrowRightIcon, ChartColumnIcon, ChevronRightIcon, CirclePlusIcon, GaugeIcon, LoaderCircleIcon, RefreshCwIcon, WrenchIcon, ZapIcon } from '@lucide/vue'

// ── Tarjeta de "top" reutilizable (medidores / inversores) ───────────────────
const TopCard = {
  props: {
    title: String,
    /** Componente de `@lucide/vue`. */
    icon: { type: [Object, Function], default: null },
    accent: String,
    items: { type: Array, default: () => [] },
    loading: Boolean, max: Number,
  },
  setup(props) {
    const medal = (i) => (i === 0 ? '#F0C040' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : null)
    const fmt = (kwh) => (kwh == null ? '—' : kwh >= 1000 ? (kwh / 1000).toFixed(2) + ' MWh' : kwh.toFixed(1) + ' kWh')
    return () => h('section', { class: 'rs-card' }, [
      h('div', { class: 'rs-card-head' }, [
        h(props.icon, { class: 'size-[1em]', style: { color: props.accent } }),
        h('h3', { class: 'rs-card-title' }, props.title),
      ]),
      props.loading
        ? h('div', { class: 'rs-loading' }, [h(LoaderCircleIcon, { class: 'size-[1em] animate-spin' }), ' Cargando…'])
        : props.items.length === 0
          ? h('div', { class: 'rs-empty-row' }, 'Sin datos de generación hoy')
          : h('div', { class: 'rs-top-list' }, props.items.map((it, i) =>
              h('div', { class: 'rs-top-row', key: it.proyecto_id }, [
                h('span', {
                  class: 'rs-rank',
                  style: medal(i) ? { background: medal(i), color: '#2C2039' } : {},
                }, String(i + 1)),
                h('div', { class: 'rs-top-main' }, [
                  h('span', { class: 'rs-top-name' }, it.nombre || '—'),
                  h('div', { class: 'rs-bar-track' }, [
                    h('div', {
                      class: 'rs-bar-fill',
                      style: {
                        width: (props.max > 0 ? Math.max(3, (it.kwh / props.max) * 100) : 0) + '%',
                        background: props.accent,
                      },
                    }),
                  ]),
                ]),
                h('span', { class: 'rs-top-val' }, fmt(it.kwh)),
              ]),
            )),
    ])
  },
}

const fallasService = new FallasService()
const generacionSolarService = new GeneracionSolarService()

// ── Estado ───────────────────────────────────────────────────────────────────
const gen          = reactive({ medidor: null, inversor: null, fecha: null })
const fallas       = reactive({ creadas: [], cambios_estado: [], fecha: null })
const loadingGen   = ref(false)
const loadingFallas = ref(false)
const loading      = computed(() => loadingGen.value || loadingFallas.value)

const catalogos       = reactive({ estados: [], prioridades: [], tipos: [], resoluciones: [] })
const fallaDetailOpen = ref(false)
const fallaDetail     = ref(null)

const maxMedidor  = computed(() => Math.max(0, ...(gen.medidor?.top || []).map((x) => x.kwh || 0)))
const maxInversor = computed(() => Math.max(0, ...(gen.inversor?.top || []).map((x) => x.kwh || 0)))

const fechaLarga = computed(() => {
  const f = gen.fecha || fallas.fecha
  if (!f) return 'Hoy'
  const d = new Date(f + 'T00:00:00')
  if (isNaN(d.getTime())) return 'Hoy'
  const s = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
})

function fmtKwh(kwh) {
  if (kwh == null) return '—'
  return kwh >= 1000 ? (kwh / 1000).toFixed(2) + ' MWh' : kwh.toFixed(1) + ' kWh'
}
function horaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function estadoStyle(estado) {
  const c = colorEstado(estado?.codigo)
  return { background: c + '22', color: c }
}

// ── Carga ───────────────────────────────────────────────────────────────────
async function cargarGen(force = false) {
  loadingGen.value = true
  try {
    const data = await generacionSolarService.obtenerResumenDia()
    gen.medidor = data.medidor || { total: 0, top: [] }
    gen.inversor = data.inversor || { total: 0, top: [] }
    gen.fecha = data.fecha
  } catch (e) {
    logger.error('mobile', e)
    if (!gen.medidor) gen.medidor = { total: 0, top: [] }
    if (!gen.inversor) gen.inversor = { total: 0, top: [] }
  } finally {
    loadingGen.value = false
  }
}

async function cargarFallas() {
  loadingFallas.value = true
  try {
    const data = await fallasService.obtenerActividadHoy()
    fallas.creadas = data.creadas || []
    fallas.cambios_estado = data.cambios_estado || []
    fallas.fecha = data.fecha
  } catch (e) {
    logger.error('mobile', e)
  } finally {
    loadingFallas.value = false
  }
}

async function cargarCatalogos() {
  try {
    const cat = await fallasService.obtenerCatalogos()
    Object.assign(catalogos, cat)
  } catch { /* no crítico */ }
}

function cargar(force = false) {
  cargarGen(force)
  cargarFallas()
}

function openFalla(f) {
  if (!f) return
  fallaDetail.value = f
  fallaDetailOpen.value = true
}
function onFallaUpdated() {
  cargarFallas()
}

onMounted(() => {
  cargar()
  cargarCatalogos()
})
</script>

<style scoped>
.rs-root {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh; overflow: hidden;
  background: #f3f4f6; color: var(--color-unergy-deep);
  font-family: system-ui, -apple-system, sans-serif;
}

/* Top bar */
.rs-topbar {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: var(--color-unergy-deep); color: #fff;
}
.rs-brand { flex: 1; font-size: clamp(15px, 4.2vw, 17px); font-weight: 700; letter-spacing: .2px; }
.rs-brand svg { color: var(--color-unergy-yellow); margin-right: 6px; }
.rs-icon-btn {
  width: 36px; height: 36px; border-radius: 10px; border: none;
  background: rgba(255,255,255,0.1); color: #fff; font-size: 15px; flex-shrink: 0;
}
.rs-icon-btn:disabled { opacity: .5; }

/* Scroll body */
.rs-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 13px; }
.rs-date { font-size: 13px; color: #6b5a8a; font-weight: 600; margin: 2px 2px 12px; text-transform: capitalize; }

/* Totales */
.rs-totals { display: flex; gap: 10px; margin-bottom: 14px; }
.rs-total {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
  background: #fff; border: 1px solid #eceaf2; border-radius: 14px; padding: 11px 12px;
}
.rs-total-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.rs-total-text { display: flex; flex-direction: column; min-width: 0; }
.rs-total-label { font-size: clamp(10.5px, 3vw, 12px); color: #6b5a8a; font-weight: 600; }
.rs-total-val { font-size: clamp(16px, 4.8vw, 21px); font-weight: 800; color: var(--color-unergy-deep); line-height: 1.15; letter-spacing: -0.3px; white-space: nowrap; }

/* Tarjeta */
.rs-card {
  background: #fff; border: 1px solid #eceaf2; border-radius: 16px;
  padding: 13px 13px 8px; margin-bottom: 14px;
}
.rs-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.rs-card-head svg { font-size: 16px; }
.rs-card-title { font-size: 14px; font-weight: 800; color: var(--color-unergy-deep); margin: 0; }

.rs-loading { display: flex; align-items: center; gap: 8px; color: #6b5a8a; font-size: 13.5px; padding: 14px 4px; }
.rs-loading svg { color: var(--color-unergy-purple); }
.rs-empty-row { color: #9ca3af; font-size: 13px; padding: 10px 4px; }

/* Lista top */
.rs-top-list { display: flex; flex-direction: column; }
.rs-top-row { display: flex; align-items: center; gap: 11px; padding: 9px 2px; border-top: 1px solid #f5f3f9; }
.rs-top-row:first-child { border-top: none; }
.rs-rank {
  width: 26px; height: 26px; flex-shrink: 0; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: #f3edfb; color: #7a6e8a; font-size: 13px; font-weight: 800;
}
.rs-top-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.rs-top-name { font-size: 13.5px; font-weight: 600; color: var(--color-unergy-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-bar-track { height: 6px; background: #f0eef5; border-radius: 4px; overflow: hidden; }
.rs-bar-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
.rs-top-val { font-size: 13px; font-weight: 800; color: var(--color-unergy-deep); white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums; }

/* Grupos de fallas */
.rs-group-label { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: #6b5a8a; text-transform: uppercase; letter-spacing: .4px; margin: 4px 2px 6px; }
.rs-group-label--mt { margin-top: 14px; }
.rs-group-label svg { font-size: 13px; }
.rs-group-count { margin-left: auto; background: #f3edfb; color: #7a6e8a; font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 9px; text-transform: none; }

.rs-falla {
  display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
  background: #fff; border: 1px solid #f0e9f7; border-radius: 12px; padding: 9px 11px; margin-bottom: 7px;
}
.rs-falla-estado { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 7px; flex-shrink: 0; white-space: nowrap; }
.rs-falla-estado.rs-sm { font-size: 9.5px; padding: 2px 6px; }
.rs-falla-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rs-falla-proj { font-size: 13.5px; font-weight: 700; color: var(--color-unergy-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-falla-tipo { font-size: 12px; color: #6b5a8a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rs-falla-transition { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rs-trans-arrow { font-size: 10px; color: #c4b8d8; }
.rs-falla-hora { font-size: 11px; color: #9ca3af; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
.rs-falla-arrow { font-size: 11px; color: #c4b8d8; flex-shrink: 0; }

.rs-bottom-space { height: 8px; }
</style>
