<template>
  <!-- ══ Botón flotante ═══════════════════════════════════════════════════ -->
  <button
    class="fz-fab"
    type="button"
    v-tooltip.left="'Generar diagrama fasorial'"
    @click="abrir">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" opacity="0.35" />
      <line x1="12" y1="12" x2="12" y2="4" />
      <line x1="12" y1="12" x2="19" y2="15" />
      <line x1="12" y1="12" x2="6" y2="18" />
    </svg>
  </button>

  <!-- ══ Modal ════════════════════════════════════════════════════════════ -->
  <Dialog v-model:visible="visible" modal :dismissableMask="!loading" :closable="!loading"
    class="fz-dialog" :style="{ width: '840px', maxWidth: '96vw' }"
    header="Diagrama fasorial">

    <!-- ── Formulario de generación ──────────────────────────────────────── -->
    <div class="fz-form">
      <div class="fz-field">
        <label class="fz-label">Proyecto</label>
        <Select
          v-model="proyectoSel"
          :options="proyectos"
          optionLabel="nombre"
          dataKey="proyecto_id"
          :loading="loadingProyectos"
          filter
          :filterPlaceholder="'Buscar proyecto…'"
          placeholder="Selecciona un proyecto"
          class="w-full"
          @change="onProyectoChange" />
      </div>

      <div class="fz-field fz-field--medidor">
        <label class="fz-label">Medidor</label>
        <SelectButton v-model="medidorSel" :options="MEDIDOR_OPCIONES"
          optionLabel="label" optionValue="value" :allowEmpty="false"
          @change="onMedidorChange" />
      </div>

      <div class="fz-field">
        <label class="fz-label">Título</label>
        <InputText v-model="titulo" class="w-full" placeholder="Título del diagrama" />
      </div>

      <div class="fz-actions">
        <Button label="Generar" :disabled="!proyectoSel || loading" :loading="loading" @click="generar">
          <template #icon><ZapIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <!-- ── Avisos ────────────────────────────────────────────────────────── -->
    <div v-if="stale != null" class="fz-note fz-note--warn">
      <ClockIcon class="size-[1em]" />
      <span>Lectura desactualizada (hace {{ stale }} min). Se genera de todas formas.</span>
    </div>
    <div v-if="sinCarga" class="fz-note fz-note--info">
      <MoonIcon class="size-[1em]" />
      <span>Ángulos no evaluables con la planta en vacío — generar en horas de sol.</span>
    </div>
    <div v-if="errorMsg" class="fz-note fz-note--error">
      <TriangleAlertIcon class="size-[1em]" />
      <span>{{ errorMsg }}</span>
      <Button v-if="lastProyId" label="Reintentar" text size="small" class="ml-auto" @click="generar" />
    </div>

    <!-- ── Loading ───────────────────────────────────────────────────────── -->
    <div v-if="loading" class="fz-loading">
      <ProgressSpinner style="width:42px;height:42px" strokeWidth="4" />
      <span>Consultando la última lectura del medidor…</span>
    </div>

    <!-- ── Diagrama + descargas ──────────────────────────────────────────── -->
    <div v-show="rendered && !loading" class="fz-result">
      <div ref="diagramRef" class="fz-diagram" />

      <div class="fz-downloads">
        <Button label="Descargar SVG" outlined size="small" @click="descargarSVG">
          <template #icon><DownloadIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Descargar PNG" outlined size="small" @click="descargarPNG">
          <template #icon><ImageIcon class="size-[1em]" /></template>
        </Button>
        <Button label="Actualizar lectura" text size="small" class="ml-auto" :loading="loading" @click="generar">
          <template #icon><RefreshCwIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { renderFasorial } from '~/features/fallas/utils/fasorial'
import { gaiaSnapshotToFasorial, validarSnapshot } from '~/features/fallas/utils/gaiaSnapshotToFasorial'
import { ClockIcon, DownloadIcon, ImageIcon, MoonIcon, RefreshCwIcon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'

const generacionSolarService = new GeneracionSolarService()
const proyectosService = new ProyectosService()

// Umbral (min) para considerar una lectura desactualizada
const STALE_MIN = 15

// Selector de medidor: automático (el que más exporta), principal o respaldo
const MEDIDOR_OPCIONES = [
  { label: 'Automático', value: 'auto' },
  { label: 'Principal', value: 'principal' },
  { label: 'Respaldo', value: 'respaldo' },
]

const visible = ref(false)
const proyectos = ref([])
const loadingProyectos = ref(false)
const proyectoSel = ref(null)
const medidorSel = ref('auto')
const titulo = ref('')

const loading = ref(false)
const rendered = ref(false)
const errorMsg = ref('')
const stale = ref(null)          // min de antigüedad si supera STALE_MIN, si no null
const sinCarga = ref(false)      // diagnóstico "en vacío"
const lastProyId = ref(null)     // último proyecto consultado (para reintentar)
const lastDetail = ref(null)     // último detalle del backend (para re-dibujar sin reconsultar)

const diagramRef = ref(null)

// ── Abrir modal ───────────────────────────────────────────────────────────
async function abrir() {
  visible.value = true
  if (!proyectos.value.length) await cargarProyectos()
}

// Sólo proyectos con monitoreo solar (los que tienen medidor Gaia)
async function cargarProyectos() {
  loadingProyectos.value = true
  try {
    const data = await generacionSolarService.obtenerMonitoreo()
    proyectos.value = (data?.projects ?? [])
      .map((p) => ({ proyecto_id: p.proyecto_id, nombre: p.nombre }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
  } catch {
    // Fallback: lista general de proyectos
    try {
      const lista = await proyectosService.listar({ size: 500 })
      proyectos.value = lista
        .map((p) => ({ proyecto_id: p.id, nombre: p.nombre_comercial }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
    } catch {
      proyectos.value = []
    }
  } finally {
    loadingProyectos.value = false
  }
}

function onProyectoChange() {
  // Título por defecto: nombre del proyecto en mayúsculas (editable)
  titulo.value = (proyectoSel.value?.nombre || '').toUpperCase()
  // Reiniciar estado del resultado al cambiar de proyecto
  rendered.value = false
  errorMsg.value = ''
  stale.value = null
  sinCarga.value = false
  lastDetail.value = null
}

// Cambiar entre Automático/Principal/Respaldo re-dibuja al instante desde el
// detalle ya consultado (sin volver a llamar al backend). Si aún no se ha
// generado, no hace nada — el usuario dará "Generar".
function onMedidorChange() {
  if (lastDetail.value) renderFromDetail(lastDetail.value)
}

// Selecciona el snapshot y el nodo según el medidor elegido
function pickSnapshot(data) {
  if (medidorSel.value === 'principal') {
    return { snapshot: data?.gaia_snapshot_principal, node: data?.gaia_node_principal, etiqueta: 'principal' }
  }
  if (medidorSel.value === 'respaldo') {
    return { snapshot: data?.gaia_snapshot_respaldo, node: data?.gaia_node_respaldo, etiqueta: 'respaldo' }
  }
  return { snapshot: data?.gaia_snapshot, node: data?.gaia_node_id, etiqueta: 'auto' }
}

// Dibuja el diagrama a partir de un detalle ya cargado (no consulta el backend)
function renderFromDetail(data) {
  errorMsg.value = ''
  stale.value = null
  sinCarga.value = false

  const { snapshot, node } = pickSnapshot(data)
  const val = validarSnapshot(snapshot)
  if (!val.ok) {
    const cual = medidorSel.value === 'respaldo' ? 'de respaldo'
      : medidorSel.value === 'principal' ? 'principal' : ''
    errorMsg.value = snapshot
      ? val.error
      : `El medidor ${cual} no reporta datos para este proyecto.`
    rendered.value = false
    return
  }
  if (val.edadMin != null && val.edadMin > STALE_MIN) stale.value = val.edadMin

  const datos = gaiaSnapshotToFasorial(snapshot, {
    meter: node ?? proyectoSel.value?.proyecto_id,
    nombre: data?.nombre || proyectoSel.value?.nombre,
  })

  rendered.value = true
  nextTick(() => {
    const res = renderFasorial(diagramRef.value, datos, {
      titulo: (titulo.value || '').trim() || (data?.nombre || '').toUpperCase(),
      marca: 'Unergy',
    })
    sinCarga.value = res?.diagnostico?.nivel === 'info'
  })
}

// ── Generar (o actualizar lectura) ──────────────────────────────────────────
async function generar() {
  if (!proyectoSel.value) return
  const proyId = proyectoSel.value.proyecto_id
  lastProyId.value = proyId
  loading.value = true
  errorMsg.value = ''
  stale.value = null
  sinCarga.value = false

  try {
    // true: el fasorial necesita el snapshot electrico completo (voltaje,
    // corriente y potencia por fase), que el detalle solo trae si se pide.
    const data = await generacionSolarService.obtenerDetalle(proyId, true)
    lastDetail.value = data
    renderFromDetail(data)
  } catch (e) {
    const detail = e?.data?.detail
    errorMsg.value = detail || e?.message || 'No se pudo obtener la lectura del medidor.'
    rendered.value = false
    lastDetail.value = null
  } finally {
    loading.value = false
  }
}

// ── Descargas ───────────────────────────────────────────────────────────────
function nombreArchivo(ext) {
  const serial = (proyectoSel.value?.nombre || 'fasorial')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const d = new Date()
  const fecha = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  // Sufijo del medidor para que principal/respaldo no se pisen al descargar
  const suf = medidorSel.value === 'principal' ? '_principal'
    : medidorSel.value === 'respaldo' ? '_respaldo' : ''
  return `fasorial_${serial}_${fecha}${suf}.${ext}`
}

function getSvgEl() {
  return diagramRef.value?.querySelector('svg') || null
}

function serializarSVG(svg) {
  const clone = svg.cloneNode(true)
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

function descargarSVG() {
  const svg = getSvgEl()
  if (!svg) return
  const blob = new Blob([serializarSVG(svg)], { type: 'image/svg+xml;charset=utf-8' })
  disparaDescarga(URL.createObjectURL(blob), nombreArchivo('svg'), true)
}

function descargarPNG() {
  const svg = getSvgEl()
  if (!svg) return
  const vb = svg.viewBox?.baseVal
  const w = (vb?.width || svg.clientWidth || 720)
  const h = (vb?.height || svg.clientHeight || 780)
  const scale = 2
  const data = serializarSVG(svg)
  const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }))

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    // Fondo oscuro para que el PNG no salga transparente
    ctx.fillStyle = '#0b0f1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      if (blob) disparaDescarga(URL.createObjectURL(blob), nombreArchivo('png'), true)
    }, 'image/png')
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}

function disparaDescarga(href, filename, revoke) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4000)
}
</script>

<style scoped>
/* ── Botón flotante ───────────────────────────────────────────────────── */
.fz-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 900;                 /* sobre la tabla, bajo los modales de PrimeVue */
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--color-unergy-purple);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(145, 91, 216, 0.4);
  transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
}
.fz-fab:hover {
  background: #7d47c4;
  transform: translateY(-2px);
  box-shadow: 0 10px 26px rgba(145, 91, 216, 0.5);
}
.fz-fab:active { transform: translateY(0); }

/* ── Formulario ───────────────────────────────────────────────────────── */
.fz-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}
.fz-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 240px;
  min-width: 0;
}
.fz-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b5a8a;
}
.fz-actions { flex-shrink: 0; }
.fz-field--medidor { flex: 0 0 auto; }
.fz-field--medidor :deep(.p-selectbutton) { display: flex; }
.fz-field--medidor :deep(.p-togglebutton) { font-size: 12px; }

/* ── Avisos ───────────────────────────────────────────────────────────── */
.fz-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}
.fz-note--warn  { background: #fff7ed; color: #b45309; border: 1px solid #fed7aa; }
.fz-note--info  { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.fz-note--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

/* ── Loading ──────────────────────────────────────────────────────────── */
.fz-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #6b7280;
  font-size: 13px;
}

/* ── Resultado ────────────────────────────────────────────────────────── */
.fz-result { margin-top: 16px; }
.fz-diagram { width: 100%; }
.fz-diagram :deep(svg) { width: 100%; height: auto; }
.fz-downloads {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
</style>
