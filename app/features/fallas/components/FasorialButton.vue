<script setup lang="ts">
/**
 * Botón flotante que genera el diagrama fasorial de un proyecto solar, a
 * partir del snapshot eléctrico del medidor (`GET
 * /generacion-solar/monitoring/:id?incluir_snapshot=true`).
 */
import {
  ClockIcon,
  DownloadIcon,
  ImageIcon,
  MoonIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  ZapIcon,
} from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { GeneracionSolarService } from '~/features/solar/services/generacion-solar'
import {
  gaiaSnapshotToFasorial,
  validarSnapshot,
} from '~/features/fallas/utils/gaiaSnapshotToFasorial'
import { renderFasorial } from '~/features/fallas/utils/fasorial'
import type { DetalleMonitoreoSolar } from '~/features/solar/types'
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'

interface ProyectoFasorial {
  proyectoId: number
  nombre: string
}

type Medidor = 'auto' | 'principal' | 'respaldo'

const generacionSolarService = new GeneracionSolarService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

// Umbral (min) para considerar una lectura desactualizada
const STALE_MIN = 15

const MEDIDOR_OPCIONES: { label: string; value: Medidor }[] = [
  { label: 'Automático', value: 'auto' },
  { label: 'Principal', value: 'principal' },
  { label: 'Respaldo', value: 'respaldo' },
]

const visible = ref(false)
const proyectos = ref<ProyectoFasorial[]>([])
const loadingProyectos = ref(false)
const proyectoSelId = ref<string | null>(null)
const medidorSel = ref<Medidor>('auto')
const titulo = ref('')

const loading = ref(false)
const rendered = ref(false)
const errorMsg = ref('')
/** Minutos de antigüedad si la lectura supera `STALE_MIN`, si no `null`. */
const stale = ref<number | null>(null)
/** Diagnóstico "en vacío" (planta sin generación evaluable). */
const sinCarga = ref(false)
/** Último proyecto consultado, para reintentar. */
const lastProyId = ref<number | null>(null)
/** Último detalle del backend, para re-dibujar sin reconsultar. */
const lastDetail = ref<DetalleMonitoreoSolar | null>(null)

const diagramRef = ref<HTMLDivElement | null>(null)

const proyectoOpciones = computed<ComboBoxOption[]>(() =>
  proyectos.value.map((p) => ({ label: p.nombre, value: String(p.proyectoId) })),
)
const proyectoSel = computed<ProyectoFasorial | null>(
  () => proyectos.value.find((p) => String(p.proyectoId) === proyectoSelId.value) ?? null,
)

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
      .map((p) => ({ proyectoId: p.proyecto_id, nombre: p.nombre ?? '' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  } catch (err) {
    logger.error('fallas.fasorial', err)
    // Fallback: lista general de proyectos
    try {
      const lista = await catalogoProyectos.cargar()
      proyectos.value = lista
        .map((p) => ({ proyectoId: p.id, nombre: p.nombre_comercial ?? '' }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    } catch (err2) {
      logger.error('fallas.fasorial', err2)
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
watch(proyectoSelId, onProyectoChange)

// Cambiar entre Automático/Principal/Respaldo re-dibuja al instante desde el
// detalle ya consultado (sin volver a llamar al backend). Si aún no se ha
// generado, no hace nada — el usuario dará "Generar".
function onMedidorChange() {
  if (lastDetail.value) renderFromDetail(lastDetail.value)
}
watch(medidorSel, onMedidorChange)

// Selecciona el snapshot y el nodo según el medidor elegido
function pickSnapshot(data: DetalleMonitoreoSolar) {
  if (medidorSel.value === 'principal') {
    return { snapshot: data.gaia_snapshot_principal, node: data.gaia_node_principal }
  }
  if (medidorSel.value === 'respaldo') {
    return { snapshot: data.gaia_snapshot_respaldo, node: data.gaia_node_respaldo }
  }
  return { snapshot: data.gaia_snapshot, node: data.gaia_node_id }
}

// Dibuja el diagrama a partir de un detalle ya cargado (no consulta el backend)
function renderFromDetail(data: DetalleMonitoreoSolar) {
  errorMsg.value = ''
  stale.value = null
  sinCarga.value = false

  const { snapshot, node } = pickSnapshot(data)
  const val = validarSnapshot(snapshot)
  if (!val.ok) {
    const cual =
      medidorSel.value === 'respaldo'
        ? 'de respaldo'
        : medidorSel.value === 'principal'
          ? 'principal'
          : ''
    errorMsg.value = snapshot
      ? (val.error ?? 'El medidor no reporta datos suficientes.')
      : `El medidor ${cual} no reporta datos para este proyecto.`
    rendered.value = false
    return
  }
  if (val.edadMin != null && val.edadMin > STALE_MIN) stale.value = val.edadMin

  const datos = gaiaSnapshotToFasorial(snapshot, {
    meter: node ?? proyectoSel.value?.proyectoId,
    nombre: data.nombre || proyectoSel.value?.nombre,
  })

  rendered.value = true
  nextTick(() => {
    if (!diagramRef.value) return
    const res = renderFasorial(diagramRef.value, datos, {
      titulo: (titulo.value || '').trim() || (data.nombre || '').toUpperCase(),
      marca: 'Unergy',
    })
    sinCarga.value = res?.diagnostico?.nivel === 'info'
  })
}

// ── Generar (o actualizar lectura) ──────────────────────────────────────────
async function generar() {
  if (!proyectoSel.value) return
  const proyId = proyectoSel.value.proyectoId
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
  } catch (err) {
    errorMsg.value = normalizeError(err).message
    rendered.value = false
    lastDetail.value = null
  } finally {
    loading.value = false
  }
}

// ── Descargas ───────────────────────────────────────────────────────────────
function nombreArchivo(ext: string): string {
  const serial = (proyectoSel.value?.nombre || 'fasorial')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const d = new Date()
  const fecha = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  // Sufijo del medidor para que principal/respaldo no se pisen al descargar
  const suf =
    medidorSel.value === 'principal'
      ? '_principal'
      : medidorSel.value === 'respaldo'
        ? '_respaldo'
        : ''
  return `fasorial_${serial}_${fecha}${suf}.${ext}`
}

function getSvgEl(): SVGSVGElement | null {
  return diagramRef.value?.querySelector('svg') ?? null
}

function serializarSVG(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

function disparaDescarga(href: string, filename: string, revoke: boolean) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4000)
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
  const w = vb?.width || svg.clientWidth || 720
  const h = vb?.height || svg.clientHeight || 780
  const scale = 2
  const data = serializarSVG(svg)
  const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }))

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
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
</script>

<template>
  <GTooltip>
    <GTooltipTrigger as-child>
      <Button
        size="icon"
        class="fixed right-6 bottom-6 z-40 size-13 rounded-full shadow-lg"
        @click="abrir"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" opacity="0.35" />
          <line x1="12" y1="12" x2="12" y2="4" />
          <line x1="12" y1="12" x2="19" y2="15" />
          <line x1="12" y1="12" x2="6" y2="18" />
        </svg>
      </Button>
    </GTooltipTrigger>
    <GTooltipContent side="left">Generar diagrama fasorial</GTooltipContent>
  </GTooltip>

  <Dialog v-model:open="visible">
    <DialogContent
      class="sm:max-w-4xl"
      :show-close-button="!loading"
      @escape-key-down="(e) => loading && e.preventDefault()"
      @pointer-down-outside="(e) => loading && e.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>Diagrama fasorial</DialogTitle>
      </DialogHeader>

      <!-- ── Formulario de generación ──────────────────────────────────────── -->
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-60 flex-1 space-y-1.5">
          <GLabel>Proyecto</GLabel>
          <ComboBox
            v-model="proyectoSelId"
            :options="proyectoOpciones"
            :disabled="loadingProyectos"
            placeholder="Selecciona un proyecto"
          />
        </div>

        <div class="shrink-0 space-y-1.5">
          <GLabel>Medidor</GLabel>
          <ToggleGroup v-model="medidorSel" type="single" variant="outline">
            <ToggleGroupItem
              v-for="m in MEDIDOR_OPCIONES"
              :key="m.value"
              :value="m.value"
              class="text-xs"
            >
              {{ m.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div class="min-w-48 flex-1 space-y-1.5">
          <GLabel>Título</GLabel>
          <Input v-model="titulo" placeholder="Título del diagrama" />
        </div>

        <Button :disabled="!proyectoSel || loading" @click="generar">
          <ZapIcon class="size-4" />
          Generar
        </Button>
      </div>

      <!-- ── Avisos ────────────────────────────────────────────────────────── -->
      <div
        v-if="stale != null"
        class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm text-warning"
      >
        <ClockIcon class="size-4 shrink-0" />
        <span>Lectura desactualizada (hace {{ stale }} min). Se genera de todas formas.</span>
      </div>
      <div
        v-if="sinCarga"
        class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-sm text-muted-foreground"
      >
        <MoonIcon class="size-4 shrink-0 text-primary/60" />
        <span>Ángulos no evaluables con la planta en vacío — generar en horas de sol.</span>
      </div>
      <div
        v-if="errorMsg"
        class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive"
      >
        <TriangleAlertIcon class="size-4 shrink-0" />
        <span>{{ errorMsg }}</span>
        <Button v-if="lastProyId" variant="ghost" size="sm" class="ml-auto" @click="generar">
          Reintentar
        </Button>
      </div>

      <!-- ── Loading ───────────────────────────────────────────────────────── -->
      <div
        v-if="loading"
        class="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground"
      >
        <Spinner class="size-8" />
        <span>Consultando la última lectura del medidor…</span>
      </div>

      <!-- ── Diagrama + descargas ──────────────────────────────────────────── -->
      <div v-show="rendered && !loading" class="mt-2">
        <div ref="diagramRef" class="w-full [&_svg]:h-auto [&_svg]:w-full" />

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" @click="descargarSVG">
            <DownloadIcon class="size-4" />
            Descargar SVG
          </Button>
          <Button variant="outline" size="sm" @click="descargarPNG">
            <ImageIcon class="size-4" />
            Descargar PNG
          </Button>
          <Button variant="ghost" size="sm" class="ml-auto" :disabled="loading" @click="generar">
            <RefreshCwIcon class="size-4" />
            Actualizar lectura
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
