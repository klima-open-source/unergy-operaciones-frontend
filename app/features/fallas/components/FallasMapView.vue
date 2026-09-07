<template>
  <div class="fmv-wrap">

    <!-- ── Header ─────────────────────────────────────────── -->
    <div class="fmv-header">
      <div class="fmv-header-left">
        <MapIcon class="size-[1em]" style="color:var(--color-unergy-purple);font-size:14px" />
        <span class="font-bold text-sm text-gray-800">Mapa de fallas</span>
        <span class="text-xs text-gray-400 hidden sm:inline">· Proyectos con fallas activas</span>
      </div>
      <div class="fmv-controls">
        <!-- Selector de operador -->
        <Select
          v-model="operadorSel"
          :options="operadores"
          optionLabel="name"
          optionValue="code"
          placeholder="Operador de red"
          class="fmv-or-select"
          :loading="loadingOps"
          showClear
          @change="cargar"
        />
        <button class="fmv-btn-icon" @click="cargar" :disabled="loading" title="Recargar">
          <LoaderCircleIcon v-if="loading" class="size-[1em] animate-spin" />
          <RefreshCwIcon v-else class="size-[1em]" />
        </button>
      </div>
    </div>

    <!-- ── Leyenda ─────────────────────────────────────────── -->
    <div class="fmv-legend">
      <span class="fmv-legend-item"><span class="fmv-dot" style="background:#16a34a"></span> Sin fallas</span>
      <span class="fmv-legend-item"><span class="fmv-dot" style="background:#d97706"></span> 1–2 fallas</span>
      <span class="fmv-legend-item"><span class="fmv-dot" style="background:#dc2626"></span> 3+ fallas</span>
      <span class="fmv-legend-item" v-if="operadorSel">
        <span class="fmv-dot" style="background:#3b82f6;border-radius:2px"></span> Circuitos
      </span>
      <span class="fmv-legend-item" v-if="operadorSel">
        <span class="fmv-dot" style="background:#7c3aed;border-radius:2px"></span> Subestaciones
      </span>
      <span class="fmv-legend-item fmv-legend-item--muted" v-if="sinCoordenadas > 0">
        <TriangleAlertIcon class="text-yellow-500 size-[1em]" style="font-size:10px" />
        {{ sinCoordenadas }} sin coordenadas
      </span>
    </div>

    <!-- ── Error ───────────────────────────────────────────── -->
    <div v-if="error" class="fmv-empty">
      <CircleAlertIcon class="text-3xl text-red-400 size-[1em]" />
      <p class="text-sm text-red-500 mt-2">{{ error }}</p>
      <button class="fmv-retry" @click="cargar">Reintentar</button>
    </div>

    <!-- ── Loading inicial ─────────────────────────────────── -->
    <div v-else-if="loading && !mapListo" class="fmv-empty">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color:var(--color-unergy-purple)" />
      <p class="text-sm text-gray-500 mt-3">Cargando mapa…</p>
    </div>

    <!-- ── Contenedor del mapa ─────────────────────────────── -->
    <div v-show="!error" ref="mapContainer" class="fmv-map" />

    <!-- ── Panel lateral ──────────────────────────────────── -->
    <transition name="fmv-slide">
      <div v-if="proyectoSel" class="fmv-panel">
        <div class="fmv-panel-header">
          <span class="font-bold text-sm text-gray-800 truncate flex-1">{{ proyectoSel.nombre_comercial }}</span>
          <button class="fmv-close" @click="proyectoSel = null"><XIcon class="text-xs size-[1em]" /></button>
        </div>
        <div class="fmv-panel-body">

          <!-- KPI -->
          <div class="fmv-stat">
            <span class="fmv-stat-num" :style="{ color: colorPorN(fallasPorId[proyectoSel.id] || 0) }">
              {{ fallasPorId[proyectoSel.id] || 0 }}
            </span>
            <span class="fmv-stat-lbl">falla{{ (fallasPorId[proyectoSel.id] || 0) !== 1 ? 's' : '' }} activa{{ (fallasPorId[proyectoSel.id] || 0) !== 1 ? 's' : '' }}</span>
          </div>

          <!-- Info proyecto -->
          <div class="fmv-info-row" v-if="proyectoSel.municipio">
            <MapPinIcon class="size-[1em]" /> {{ proyectoSel.municipio }}{{ proyectoSel.departamento ? ', ' + proyectoSel.departamento : '' }}
          </div>
          <div class="fmv-info-row" v-if="proyectoSel.potencia_instalada_kwp">
            <SunIcon class="size-[1em]" /> {{ Number(proyectoSel.potencia_instalada_kwp).toLocaleString('es-CO') }} kW AC
          </div>
          <div class="fmv-info-row" v-if="proyectoSel.operador_red">
            <ZapIcon class="size-[1em]" /> OR: {{ proyectoSel.operador_red }}
          </div>

          <!-- Lista fallas activas -->
          <template v-if="fallasDel(proyectoSel.id).length">
            <div class="fmv-fallas-title">Fallas activas</div>
            <div v-for="f in fallasDel(proyectoSel.id)" :key="f.id" class="fmv-falla-row">
              <span class="fmv-falla-dot" :style="{ background: prioColor(f.prioridad?.codigo) }" />
              <div class="fmv-falla-info">
                <code class="fmv-falla-code">{{ f.codigo_interno }}</code>
                <span class="fmv-falla-tipo">{{ f.tipo?.etiqueta || f.descripcion }}</span>
              </div>
              <span class="fmv-falla-dias" :class="diasClass(f)">{{ f.dias_abierta ?? '?' }}d</span>
            </div>
          </template>
          <p v-else class="fmv-ok"><CircleCheckIcon class="size-[1em]" /> Sin fallas activas</p>

        </div>
      </div>
    </transition>

    <!-- ── Panel subestación ──────────────────────────────── -->
    <transition name="fmv-slide">
      <div v-if="subSel" class="fmv-panel fmv-panel--sub">
        <div class="fmv-panel-header">
          <BuildingIcon class="size-[1em]" style="color:#7c3aed;font-size:12px" />
          <span class="font-bold text-sm text-gray-800 truncate flex-1">{{ subSel.name }}</span>
          <button class="fmv-close" @click="subSel = null"><XIcon class="text-xs size-[1em]" /></button>
        </div>
        <div class="fmv-panel-body">
          <div class="fmv-info-row" v-if="subSel.capacity138">
            <ZapIcon class="size-[1em]" /> 138 kV: {{ subSel.capacity138 }} MVA
          </div>
          <div class="fmv-info-row" v-if="subSel.capacity345">
            <ZapIcon class="size-[1em]" /> 345 kV: {{ subSel.capacity345 }} MVA
          </div>
          <div class="fmv-info-row">
            <Share2Icon class="size-[1em]" /> {{ subSel.circuit_count }} circuito{{ subSel.circuit_count !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import Select from 'primevue/select'
import { FallasService } from '~/features/fallas/services/fallas'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { BuildingIcon, CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon, MapIcon, MapPinIcon, RefreshCwIcon, Share2Icon, SunIcon, TriangleAlertIcon, XIcon, ZapIcon } from '@lucide/vue'
import { colorPrioridad } from '~/features/fallas/utils/colores'

const fallasService = new FallasService()
const proyectosService = new ProyectosService()

const props = defineProps({
  fallas: { type: Array, default: () => [] },
})

const mapContainer = ref(null)
const proyectos    = ref([])
const operadores   = ref([])
const operadorSel  = ref(null)
const loading      = ref(false)
const loadingOps   = ref(false)
const error        = ref(null)
const mapListo     = ref(false)
const proyectoSel  = ref(null)
const subSel       = ref(null)

let map     = null
let markers = []
let subMarkers = []

// ── Fallas activas agrupadas por proyecto ───────────────────
const fallasPorId = computed(() => {
  const m = {}
  for (const f of props.fallas) {
    if (f.estado?.es_estado_final) continue
    const id = f.proyecto?.id
    if (!id) continue
    m[id] = (m[id] || 0) + 1
  }
  return m
})

const sinCoordenadas = computed(() =>
  proyectos.value.filter(p => !p.latitud || !p.longitud).length
)

function fallasDel(id) {
  return props.fallas.filter(f => !f.estado?.es_estado_final && f.proyecto?.id === id)
}

// ── Helpers visuales ────────────────────────────────────────
function colorPorN(n) {
  if (n === 0) return '#16a34a'
  if (n <= 2)  return '#d97706'
  return '#dc2626'
}

function prioColor(c) { return colorPrioridad(c, '#9ca3af') }
function diasClass(f) {
  const d = f.dias_abierta ?? 0
  if (d >= 7) return 'dias-red'
  if (d >= 3) return 'dias-yellow'
  return 'dias-green'
}

// ── Carga operadores ────────────────────────────────────────
async function cargarOperadores() {
  loadingOps.value = true
  try {
    operadores.value = await fallasService.listarOperadoresMapa()
  } catch { /* no crítico */ } finally {
    loadingOps.value = false
  }
}

// ── Carga proyectos + OR data y renderiza ───────────────────
async function cargar() {
  loading.value  = true
  error.value    = null
  proyectoSel.value = null
  subSel.value   = null
  try {
    const [proyRes, mapaRes] = await Promise.allSettled([
      proyectosService.listar({ size: 500 }),
      operadorSel.value ? fallasService.obtenerMapa(operadorSel.value) : Promise.resolve(null),
    ])

    proyectos.value = proyRes.status === 'fulfilled'
      ? (proyRes.value ?? []).filter(p => p.latitud && p.longitud)
      : []

    const mapaData = mapaRes.status === 'fulfilled' && mapaRes.value
      ? mapaRes.value
      : null

    await nextTick()
    renderMapa(mapaData)
  } catch (e) {
    error.value = 'Error al cargar: ' + (e.message || 'Sin conexión')
  } finally {
    loading.value = false
  }
}

function renderMapa(mapaData) {
  if (!mapContainer.value) return

  if (map) { map.remove(); map = null }
  markers.forEach(m => m.remove()); markers = []
  subMarkers.forEach(m => m.remove()); subMarkers = []

  const conCoords = proyectos.value
  const center = conCoords.length
    ? [
        conCoords.reduce((s, p) => s + Number(p.longitud), 0) / conCoords.length,
        conCoords.reduce((s, p) => s + Number(p.latitud),  0) / conCoords.length,
      ]
    : [-74.297, 4.571]

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center,
    zoom: conCoords.length ? 8 : 5,
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

  map.on('load', () => {
    mapListo.value = true
    if (mapaData) agregarCapasOR(mapaData)
    agregarMarcadores()
    if (mapaData?.substations) agregarSubestaciones(mapaData.substations)
  })
}

// ── Capas GeoJSON: circuitos ─────────────────────────────────
function agregarCapasOR(mapaData) {
  const lines = (mapaData.circuitLines ?? []).filter(c => c.geojson)
  if (!lines.length) return

  const features = lines.map(c => ({
    type: 'Feature',
    properties: {
      circuit_id:    c.circuit_id,
      circuit_name:  c.circuit_name,
      tension_level: c.tension_level,
      substation_name: c.substation_name,
    },
    geometry: JSON.parse(c.geojson),
  }))

  map.addSource('circuits', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  })

  // Halo (stroke más ancho y transparente)
  map.addLayer({
    id: 'circuits-halo',
    type: 'line',
    source: 'circuits',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#fff',
      'line-width': 4,
      'line-opacity': 0.5,
    },
  })

  // Línea coloreada por tensión
  map.addLayer({
    id: 'circuits-line',
    type: 'line',
    source: 'circuits',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': [
        'interpolate', ['linear'], ['get', 'tension_level'],
        13.2,  '#3b82f6',
        34.5,  '#22c55e',
        115,   '#f59e0b',
        220,   '#ef4444',
      ],
      'line-width': [
        'interpolate', ['linear'], ['get', 'tension_level'],
        13.2, 1.5,
        115,  2.5,
      ],
    },
  })

  // Tooltip al pasar el mouse sobre un circuito
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
  map.on('mouseenter', 'circuits-line', (e) => {
    map.getCanvas().style.cursor = 'pointer'
    const p = e.features[0].properties
    popup.setLngLat(e.lngLat)
      .setHTML(`<div style="font-size:12px;font-weight:600">${p.circuit_name}</div><div style="font-size:11px;color:#6b5a8a">${p.tension_level} kV · ${p.substation_name || ''}</div>`)
      .addTo(map)
  })
  map.on('mouseleave', 'circuits-line', () => {
    map.getCanvas().style.cursor = ''
    popup.remove()
  })
}

// ── Marcadores: subestaciones ────────────────────────────────
function agregarSubestaciones(substations) {
  subMarkers.forEach(m => m.remove()); subMarkers = []

  for (const s of substations) {
    const el = document.createElement('div')
    el.style.cssText = `
      width:16px; height:16px;
      background:#7c3aed;
      border:2px solid #fff;
      border-radius:3px;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      cursor:pointer;
      display:flex; align-items:center; justify-content:center;
    `
    el.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8"><polygon points="4,0 8,8 0,8" fill="#fff"/></svg>'

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([s.lng, s.lat])
      .addTo(map)

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      subSel.value = s
      proyectoSel.value = null
      map.flyTo({ center: [s.lng, s.lat], zoom: 12, duration: 700 })
    })

    subMarkers.push(marker)
  }
}

// ── Marcadores: proyectos ────────────────────────────────────
function agregarMarcadores() {
  markers.forEach(m => m.remove()); markers = []

  for (const p of proyectos.value) {
    const n     = fallasPorId.value[p.id] || 0
    const color = colorPorN(n)
    const size  = n > 0 ? 22 : 14

    const el = document.createElement('div')
    el.style.cssText = `
      width:${size}px; height:${size}px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      font-size:9px; font-weight:900; color:#fff;
      transition:transform .12s, box-shadow .12s;
      position:relative; z-index:1;
    `
    if (n > 0) el.textContent = n

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([Number(p.longitud), Number(p.latitud)])
      .addTo(map)

    el.addEventListener('click', () => {
      proyectoSel.value = p
      subSel.value = null
      map.flyTo({ center: [Number(p.longitud), Number(p.latitud)], zoom: 12, duration: 800 })
    })
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.3)'
      el.style.boxShadow = '0 4px 14px rgba(0,0,0,.4)'
    })
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)'
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,.3)'
    })

    markers.push(marker)
  }
}

// Refresca marcadores al cambiar fallas (sin reiniciar el mapa)
watch(() => props.fallas, () => {
  if (map && mapListo.value) agregarMarcadores()
}, { deep: true })

onMounted(async () => {
  await cargarOperadores()
  await cargar()
})
onBeforeUnmount(() => {
  if (map) map.remove()
  markers.forEach(m => m.remove())
  subMarkers.forEach(m => m.remove())
})
</script>

<style scoped>
.fmv-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f8f7fa;
  position: relative;
}

/* Header */
.fmv-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #ECE7F2;
  flex-shrink: 0;
}
.fmv-header-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.fmv-controls    { display: flex; align-items: center; gap: 8px; }

.fmv-or-select {
  font-size: 12px;
  height: 32px;
}
:deep(.fmv-or-select .p-select) {
  height: 32px;
  font-size: 12px;
  min-width: 180px;
}

.fmv-btn-icon {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: #f4f1fa; border: 1px solid #e5e0f0;
  border-radius: 8px; cursor: pointer; color: #6b5a8a;
  font-size: 13px; transition: background .12s;
}
.fmv-btn-icon:hover:not(:disabled) { background: #e9e0f5; }
.fmv-btn-icon:disabled { opacity: .4; cursor: not-allowed; }

/* Leyenda */
.fmv-legend {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 5px 16px; background: #fff;
  border-bottom: 1px solid #f0eaf8; flex-shrink: 0;
}
.fmv-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #6b5a8a; }
.fmv-legend-item--muted { color: #9ca3af; }
.fmv-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* Mapa */
.fmv-map { flex: 1; min-height: 0; }

/* Estado vacío / loading */
.fmv-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 60px 20px;
}
.fmv-retry {
  margin-top: 12px; padding: 6px 16px;
  background: var(--color-unergy-purple); color: #fff; border: none;
  border-radius: 8px; font-size: 12px; cursor: pointer;
}

/* Panel lateral */
.fmv-panel {
  position: absolute; top: 108px; right: 12px;
  width: 250px; background: #fff; border-radius: 12px;
  border: 1px solid #ece8f4;
  box-shadow: 0 8px 24px rgba(28,18,50,.14); z-index: 10; overflow: hidden;
}
.fmv-panel--sub { border-color: #ede9fe; }
.fmv-panel-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-bottom: 1px solid #f0eaf8; background: #faf7ff;
}
.fmv-close {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: #f0eaf8; border: none; border-radius: 6px;
  cursor: pointer; color: #6b5a8a; flex-shrink: 0;
}
.fmv-panel-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }

.fmv-stat { display: flex; align-items: baseline; gap: 6px; }
.fmv-stat-num { font-size: 32px; font-weight: 900; line-height: 1; }
.fmv-stat-lbl { font-size: 12px; color: #6b5a8a; }

.fmv-info-row { font-size: 11.5px; color: #6b5a8a; display: flex; align-items: center; gap: 5px; }
.fmv-info-row svg { font-size: 10px; }

.fmv-fallas-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: #a094b8; margin-top: 8px; margin-bottom: 4px;
}
.fmv-falla-row {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 0; border-bottom: 1px solid #f0eaf8;
}
.fmv-falla-row:last-child { border-bottom: none; }
.fmv-falla-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.fmv-falla-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.fmv-falla-code { font-size: 10px; font-weight: 700; color: #6b5a8a; }
.fmv-falla-tipo { font-size: 11px; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fmv-falla-dias { font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
.dias-green  { background: #f0fdf4; color: #16a34a; }
.dias-yellow { background: #fefce8; color: #a16207; }
.dias-red    { background: #fef2f2; color: #dc2626; }

.fmv-ok { font-size: 12px; color: #16a34a; font-weight: 600; margin-top: 8px; }

/* Transición panel */
.fmv-slide-enter-active, .fmv-slide-leave-active { transition: all .2s; }
.fmv-slide-enter-from, .fmv-slide-leave-to { opacity: 0; transform: translateX(20px); }
</style>
