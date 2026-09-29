<script setup lang="ts">
/**
 * Detalle de una falla: clasificación, SLA, adjuntos, seguimientos y edición
 * completa (`FallaForm`) o rápida (estado/prioridad/energía perdida/causa raíz).
 */
import type {
  AdjuntoFallaLegado,
  CatalogosFalla,
  Falla,
  PayloadFalla,
  PayloadFallaForm,
} from '~/features/fallas/types'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  InfoIcon,
  LightbulbIcon,
  LoaderCircleIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  Trash2Icon,
  UserIcon,
  WifiIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { colorEstado } from '~/features/fallas/utils/colores'
import {
  categoriaFalla,
  clasificacionDetalle,
  tituloFalla,
} from '~/features/fallas/utils/fallaTitulo'
import { FallasService } from '~/features/fallas/services/fallas'
import FallaForm from './FallaForm.vue'

const fallasService = new FallasService()

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const fallaId = computed(() => Number(route.params.id))

// ── Estado ──────────────────────────────────────────────────────────────
const query = useQuery<Falla>()
const editMode = ref(false)
const addingSeg = ref(false)
const savingQuick = ref(false)
const uploadingFoto = ref(false)

const catalogos = ref<CatalogosFalla>({ tipos: [], estados: [], prioridades: [], resoluciones: [] })

const nuevaNota = reactive<{ nota: string; estado_id: string | null }>({
  nota: '',
  estado_id: null,
})
const quickEdit = reactive<{
  estado_id: string | null
  prioridad_id: string | null
  kwh_perdidos_estimado: number | null
  causa_raiz: string
}>({ estado_id: null, prioridad_id: null, kwh_perdidos_estimado: null, causa_raiz: '' })

// ── Computed ────────────────────────────────────────────────────────────
// Título / categoría / clasificación derivados de lo REALMENTE reportado
// (metodología estructurada), con respaldo al tipo legacy para fallas viejas.
const titulo = computed(() => tituloFalla(query.data))
const categoria = computed(() => categoriaFalla(query.data))
const clasif = computed(() => clasificacionDetalle(query.data))

// El backend ya los manda del mas reciente al mas viejo (`FallaSeguimiento.Meta
// .ordering`, 2026-09-07). Antes se ordenaba aca y el movil no lo hacia, asi que
// la misma falla mostraba su cronologia desordenada en el telefono.
const sortedSeguimientos = computed(() => query.data?.seguimientos ?? [])

// El backend puede devolver `fotos_lista` como list[str] (URLs, legado) o como
// list[obj] {url, nombre, ...} (formato actual). Normalizamos SIEMPRE a string:
// para los objetos reconstruimos "url#nombre" — el fragment con el nombre real es
// justo lo que leen filename()/isImage() (ver `filename`).
const adjuntos = computed<string[]>(() => {
  const v = query.data
  if (!v) return []
  const toUrl = (a: string | AdjuntoFallaLegado): string | null => {
    if (typeof a === 'string') return a
    if (!a?.url) return null
    return a.nombre ? `${a.url}#${encodeURIComponent(a.nombre)}` : a.url
  }
  if (Array.isArray(v.fotos_lista)) {
    return v.fotos_lista.map(toUrl).filter((u): u is string => !!u)
  }
  if (Array.isArray(v.attachments)) {
    return v.attachments.map((a) => a.url || a.archivo_url || '').filter(Boolean)
  }
  if (Array.isArray(v.fotos)) {
    return v.fotos.map((a) => a.url || '').filter(Boolean)
  }
  return []
})

// El reloj del SLA lo calcula el backend: `sla_horas_transcurridas` y `sla_pct`
// vienen del serializer de fallas (`dominio.horas_transcurridas_sla` /
// `dominio.sla_pct`). Esta vista solo los LEE.
const horasTranscurridas = computed(() => Math.round(query.data?.sla_horas_transcurridas ?? 0))
const slaPct = computed(() => query.data?.sla_pct ?? null)

const slaColor = computed(() => {
  const p = slaPct.value
  if (p == null) return 'var(--muted-foreground)'
  if (p >= 100) return 'var(--destructive)'
  if (p >= 70) return 'var(--warning)'
  return 'var(--success)'
})

const slaSeverity = computed(() => {
  if (query.data?.sla_cumplido === true) return 'success'
  if (query.data?.sla_cumplido === false) return 'destructive'
  const p = slaPct.value
  if (p == null) return 'default'
  if (p >= 100) return 'destructive'
  if (p >= 70) return 'warning'
  return 'success'
})

const slaTexto = computed(() => {
  if (query.data?.sla_cumplido === true) return 'Cumplido'
  if (query.data?.sla_cumplido === false) return 'Excedido'
  const p = slaPct.value
  if (p == null) return 'Sin SLA'
  if (p >= 100) return `Excedido ${p}%`
  return `${p}% del límite`
})

const slaFillPct = computed(() => Math.min(slaPct.value ?? 0, 100))

// ── Helpers ─────────────────────────────────────────────────────────────
const PRIO_SEVERITY: Record<string, string> = {
  critica: 'destructive',
  grave: 'warning',
  media: 'information',
  leve: 'default',
}
/**
 * Códigos reales del catálogo (`fallas_cat_prioridades`): critica/grave/media/leve
 * -- "alta"/"baja" nunca calzaban con nada real, "grave" y "leve" caían siempre
 * al 'default' (bug encontrado al consolidar los colores de fallas, 2026-09-02).
 */
function prioSeverity(codigo: string | null | undefined): string {
  return (codigo && PRIO_SEVERITY[codigo]) || 'default'
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
function fmtDatetime(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function fmtFechaConHora(d: string | null | undefined, hora: string | null | undefined): string {
  if (!d) return '—'
  const base = fmtDate(d)
  return hora ? `${base} · ${String(hora).slice(0, 5)}` : base
}
function fmtDuracion(horas: number | null | undefined): string {
  if (horas == null || horas < 0) return '—'
  const totalMin = Math.round(horas * 60)
  if (totalMin === 0) return '0 min'
  const dias = Math.floor(totalMin / 1440)
  const hrs = Math.floor((totalMin % 1440) / 60)
  const min = totalMin % 60
  const parts: string[] = []
  if (dias) parts.push(`${dias} d`)
  if (hrs) parts.push(`${hrs} h`)
  if (min) parts.push(`${min} min`)
  return parts.join(' ')
}
function driveFileId(url: string): string | null {
  const m = /\/file\/d\/([^/?#]+)/.exec(url || '')
  return m ? (m[1] ?? null) : null
}
function filename(url: string | null | undefined): string {
  if (!url) return 'archivo'
  // Fragment after # contains original filename for Drive URLs
  const hash = url.includes('#') ? url.split('#').pop() : null
  if (hash) return decodeURIComponent(hash)
  return decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'archivo')
}
function isImage(url: string | null | undefined): boolean {
  const name = filename(url)
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
}

/** Icono y color del adjunto según su extensión. */
function iconoAdjunto(url: string) {
  const name = filename(url)
  if (/\.pdf$/i.test(name)) return { icon: FileTextIcon, color: 'text-destructive/70' }
  if (/\.(xls|xlsx|csv)$/i.test(name)) return { icon: FileSpreadsheetIcon, color: 'text-success' }
  if (/\.(doc|docx)$/i.test(name)) return { icon: FileTypeIcon, color: 'text-primary' }
  return { icon: FileIcon, color: 'text-muted-foreground' }
}
function resolveUrl(url: string): string {
  if (!url) return ''
  // Strip fragment for the actual link
  return url.split('#')[0] ?? ''
}
function thumbUrl(url: string): string {
  const id = driveFileId(url)
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w400`
  return resolveUrl(url)
}

// ── Carga ───────────────────────────────────────────────────────────────
async function load() {
  await query.run(() => fallasService.obtener(fallaId.value))
  const data = query.data
  if (data) {
    quickEdit.estado_id = data.estado?.id != null ? String(data.estado.id) : null
    quickEdit.prioridad_id = data.prioridad?.id != null ? String(data.prioridad.id) : null
    quickEdit.kwh_perdidos_estimado = data.kwh_perdidos_estimado ?? null
    quickEdit.causa_raiz = data.causa_raiz ?? ''
  }
}

async function loadCatalogos() {
  try {
    catalogos.value = await fallasService.obtenerCatalogos()
  } catch {
    /* no crítico */
  }
}

// ── Acciones ────────────────────────────────────────────────────────────
async function onUpdate(payload: PayloadFallaForm) {
  if (!query.data) return
  const id = query.data.id
  const { _archivos, ...rest } = payload
  try {
    await fallasService.actualizar(id, rest)
    if (_archivos?.length) {
      await Promise.all(_archivos.map((file) => fallasService.subirArchivo(id, file)))
    }
    toast.success('Falla actualizada', { duration: 3000 })
    editMode.value = false
    await load()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  }
}

async function saveQuickEdit() {
  if (!query.data) return
  savingQuick.value = true
  try {
    const payload: PayloadFalla = {}
    if (quickEdit.estado_id) payload.estado_id = Number(quickEdit.estado_id)
    if (quickEdit.prioridad_id) payload.prioridad_id = Number(quickEdit.prioridad_id)
    if (quickEdit.causa_raiz.trim()) payload.causa_raiz = quickEdit.causa_raiz.trim()
    if (quickEdit.kwh_perdidos_estimado != null) {
      payload.kwh_perdidos_estimado = quickEdit.kwh_perdidos_estimado
    }
    await fallasService.actualizar(query.data.id, payload)
    toast.success('Cambios guardados', { duration: 2500 })
    await load()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    savingQuick.value = false
  }
}

async function addSeguimiento() {
  if (!query.data) return
  if (!nuevaNota.nota.trim() && !nuevaNota.estado_id) return
  addingSeg.value = true
  try {
    const payload: { nota?: string; estado_nuevo_id?: number } = {}
    if (nuevaNota.nota.trim()) payload.nota = nuevaNota.nota.trim()
    if (nuevaNota.estado_id) payload.estado_nuevo_id = Number(nuevaNota.estado_id)
    await fallasService.crearSeguimiento(query.data.id, payload)
    nuevaNota.nota = ''
    nuevaNota.estado_id = null
    toast.success('Seguimiento agregado', { duration: 2500 })
    await load()
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    addingSeg.value = false
  }
}

async function uploadFotos(event: Event) {
  if (!query.data) return
  const id = query.data.id
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  uploadingFoto.value = true
  let okCount = 0
  try {
    for (const file of files) {
      try {
        await fallasService.subirAdjunto(id, file)
        okCount++
      } catch (err) {
        toast.warning('Archivo rechazado', {
          description: normalizeError(err).message || `No se pudo subir ${file.name}`,
          duration: 4000,
        })
      }
    }
    if (okCount) {
      await load()
      toast.success(`${okCount} archivo(s) subido(s)`, { duration: 2500 })
    }
  } finally {
    uploadingFoto.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

function deleteFoto(url: string) {
  confirm({
    title: 'Eliminar adjunto',
    description: '¿Eliminar este adjunto? Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      if (!query.data) return
      try {
        // No hay endpoint DELETE en backend. Actualizamos fotos_urls vía PATCH excluyendo la URL.
        const nuevaLista = adjuntos.value.filter((u) => u !== url)
        await fallasService.actualizar(query.data.id, { fotos_urls: nuevaLista })
        await load()
        toast.success('Adjunto eliminado', { duration: 2500 })
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message, duration: 3000 })
      }
    },
  })
}

function confirmDelete() {
  if (!query.data) return
  const codigo = query.data.codigo_interno
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Eliminar la falla ${codigo}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      if (!query.data) return
      try {
        await fallasService.eliminar(query.data.id)
        toast.success('Falla eliminada', { duration: 3000 })
        router.back()
      } catch (err) {
        toast.error(normalizeError(err).message || 'Error al eliminar', { duration: 3000 })
      }
    },
  })
}

onMounted(() => {
  loadCatalogos()
  load()
})
</script>

<template>
  <AsyncView :query="query">
    <template #error="{ error }">
      <div
        v-if="error.code === 'NOT_FOUND'"
        class="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground"
      >
        <CircleAlertIcon class="size-10 text-destructive/70" />
        <p class="text-sm font-semibold text-foreground">Falla no encontrada</p>
        <p class="text-xs">El registro solicitado no existe o fue eliminado.</p>
        <Button variant="outline" size="sm" @click="router.back()">
          <ArrowLeftIcon class="size-4" /> Volver
        </Button>
      </div>
      <div v-else class="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <CircleAlertIcon class="size-10 text-destructive" />
        <p class="text-sm font-medium text-destructive">No se pudo cargar la falla</p>
        <p class="text-sm text-muted-foreground">{{ error.message }}</p>
        <Button variant="outline" size="sm" @click="load">Reintentar</Button>
      </div>
    </template>

    <template #default="{ data: falla }">
      <div class="space-y-4">
        <!-- ── Header ────────────────────────────────────────────────────── -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <Button variant="ghost" size="icon" class="mt-1 -ml-2" @click="router.back()">
              <ArrowLeftIcon class="size-4" />
            </Button>
            <div>
              <div class="mb-1.5 flex items-center gap-2">
                <GBadge :color="colorEstado(falla.estado?.codigo)">{{
                  falla.estado?.etiqueta || '—'
                }}</GBadge>
                <GBadge :color="prioSeverity(falla.prioridad?.codigo)">{{
                  falla.prioridad?.etiqueta || '—'
                }}</GBadge>
                <GBadge v-if="categoria.etiqueta" :color="categoria.color || 'var(--primary)'">{{
                  categoria.etiqueta
                }}</GBadge>
              </div>
              <h2 class="flex flex-wrap items-center gap-2 text-xl font-bold text-foreground">
                <code class="rounded bg-primary/10 px-2 py-0.5 font-mono text-base text-primary">{{
                  falla.codigo_interno
                }}</code>
                <span class="text-sm text-muted-foreground">·</span>
                <span class="text-base font-medium text-foreground">{{ titulo }}</span>
              </h2>
              <p class="mt-1 max-w-2xl text-sm text-muted-foreground">{{ falla.descripcion }}</p>
              <div
                class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
              >
                <span
                  v-if="falla.proyecto?.nombre_comercial"
                  class="inline-flex items-center gap-1"
                >
                  <BuildingIcon class="size-3.5" /> {{ falla.proyecto.nombre_comercial }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <CalendarIcon class="size-3.5" /> Identificada el
                  {{ fmtDate(falla.fecha_identificacion) }}
                </span>
                <span v-if="falla.registrado_por?.nombre" class="inline-flex items-center gap-1">
                  <UserIcon class="size-3.5" /> Registrada por {{ falla.registrado_por.nombre }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <Button v-if="!editMode" variant="outline" size="sm" @click="editMode = true">
              <PencilIcon class="size-4" /> Editar
            </Button>
            <Button v-else variant="outline" size="sm" @click="editMode = false">
              <XIcon class="size-4" /> Cancelar edición
            </Button>
            <GTooltip>
              <GTooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon"
                  class="text-destructive"
                  @click="confirmDelete"
                >
                  <Trash2Icon class="size-4" />
                </Button>
              </GTooltipTrigger>
              <GTooltipContent>Eliminar falla</GTooltipContent>
            </GTooltip>
          </div>
        </div>

        <!-- ── Modo edición ──────────────────────────────────────────────── -->
        <div v-if="editMode" class="rounded-xl border bg-card p-5">
          <div class="mb-4 flex items-center gap-2 border-b pb-3">
            <PencilIcon class="size-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Editar falla completa</h3>
          </div>
          <FallaForm
            :initial="falla"
            :catalogos="catalogos"
            @save="onUpdate"
            @cancel="editMode = false"
          />
        </div>

        <!-- ── Vista normal ──────────────────────────────────────────────── -->
        <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <!-- COLUMNA PRINCIPAL -->
          <div class="space-y-4 lg:col-span-2">
            <!-- Clasificación (metodología estructurada) -->
            <div v-if="clasif" class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <component
                  :is="clasif.icono"
                  class="size-4 text-(--c)"
                  :style="{ '--c': clasif.categoriaColor }"
                />
                <h3 class="text-sm font-semibold text-foreground">Clasificación</h3>
                <GBadge v-if="clasif.pendienteReclasificar" color="warning" class="ml-auto text-xs"
                  >Pendiente de reclasificar</GBadge
                >
              </div>

              <!-- Sistema + equipo/evento -->
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <GBadge :color="clasif.categoriaColor || 'var(--primary)'">{{
                  clasif.categoriaEtiqueta
                }}</GBadge>
                <span v-if="clasif.subtitulo" class="text-sm font-semibold text-foreground">{{
                  clasif.subtitulo
                }}</span>
              </div>

              <!-- Detalle libre -->
              <p v-if="clasif.detalle" class="mb-3 text-sm whitespace-pre-line text-foreground">
                {{ clasif.detalle }}
              </p>

              <!-- Frontera: flags -->
              <div v-if="clasif.frontera" class="flex flex-wrap gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
                  :class="
                    clasif.frontera.afectaMedicion
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  <CircleXIcon v-if="clasif.frontera.afectaMedicion" class="size-3" />
                  <CircleCheckIcon v-else class="size-3" />
                  {{
                    clasif.frontera.afectaMedicion ? 'Afecta la medición' : 'No afecta la medición'
                  }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
                  :class="
                    clasif.frontera.perdidaComunicacion
                      ? 'bg-warning/10 text-warning'
                      : 'bg-muted text-muted-foreground'
                  "
                >
                  <WifiIcon v-if="clasif.frontera.perdidaComunicacion" class="size-3" />
                  <CircleCheckIcon v-else class="size-3" />
                  {{
                    clasif.frontera.perdidaComunicacion
                      ? 'Pérdida de comunicación'
                      : 'Comunicación OK'
                  }}
                </span>
              </div>

              <!-- Inversores afectados -->
              <div v-if="clasif.inversores.length" class="space-y-2">
                <p class="text-xs text-muted-foreground uppercase">
                  Inversores afectados ({{ clasif.inversores.length }})
                </p>
                <div
                  v-for="(inv, idx) in clasif.inversores"
                  :key="idx"
                  class="rounded-lg border bg-muted/40 p-3"
                >
                  <div class="mb-1.5 flex items-center gap-2">
                    <ServerIcon class="size-3.5 text-primary" />
                    <span class="text-sm font-semibold text-foreground">{{ inv.nombre }}</span>
                    <span v-if="inv.potenciaKw != null" class="text-xs text-muted-foreground"
                      >· {{ inv.potenciaKw }} kW</span
                    >
                  </div>
                  <div v-if="inv.tipos.length" class="flex flex-wrap gap-1.5">
                    <span
                      v-for="(t, ti) in inv.tipos"
                      :key="ti"
                      class="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                      >{{ t }}</span
                    >
                  </div>
                  <p v-else class="text-xs text-muted-foreground">Sin tipo de falla especificado</p>
                </div>
              </div>
            </div>

            <!-- Información general -->
            <div class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <InfoIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">Información general</h3>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <InfoField label="Proyecto" :value="falla.proyecto?.nombre_comercial" highlight />
                <InfoField label="Equipo / evento" :value="titulo" />
                <InfoField label="Registrado por" :value="falla.registrado_por?.nombre" />
                <InfoField label="Fecha ocurrencia" :value="fmtDatetime(falla.fecha_ocurrencia)" />
                <InfoField
                  label="Fecha identificación"
                  :value="fmtFechaConHora(falla.fecha_identificacion, falla.hora_identificacion)"
                />
                <div v-if="falla.fecha_resolucion">
                  <p class="text-xs text-muted-foreground uppercase">Fecha resolución</p>
                  <p class="mt-0.5 font-semibold text-success">
                    {{ fmtDatetime(falla.fecha_resolucion) }}
                  </p>
                </div>
                <div v-if="falla.tiempo_afectacion_horas != null">
                  <p class="text-xs text-muted-foreground uppercase">Tiempo de afectación</p>
                  <p class="mt-0.5 font-semibold text-warning">
                    {{ fmtDuracion(falla.tiempo_afectacion_horas) }}
                  </p>
                </div>
                <InfoField
                  v-if="falla.resolucion"
                  label="Tipo resolución"
                  :value="falla.resolucion?.etiqueta"
                />
              </div>
            </div>

            <!-- SLA -->
            <div class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <ClockIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">SLA</h3>
                <GBadge :color="slaSeverity" class="ml-auto">{{ slaTexto }}</GBadge>
              </div>
              <div>
                <div class="mb-2 flex items-center gap-3 text-xs">
                  <span class="text-muted-foreground">Límite</span>
                  <span class="font-semibold text-foreground"
                    >{{ falla.sla_limite_horas_efectivo }}h</span
                  >
                  <span class="ml-auto text-muted-foreground">Transcurrido</span>
                  <span class="font-semibold text-(--c)" :style="{ '--c': slaColor }"
                    >{{ horasTranscurridas }}h</span
                  >
                </div>
                <Progress
                  :model-value="slaFillPct"
                  class="h-2 *:bg-(--c)"
                  :style="{ '--c': slaColor }"
                />
              </div>
            </div>

            <!-- Análisis -->
            <div
              v-if="falla.causa_raiz || falla.acciones_correctivas"
              class="rounded-xl border bg-card p-5"
            >
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <SearchIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">Análisis</h3>
              </div>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div v-if="falla.causa_raiz">
                  <p class="mb-1 text-xs text-muted-foreground uppercase">Causa raíz</p>
                  <p class="text-sm leading-relaxed whitespace-pre-line text-foreground">
                    {{ falla.causa_raiz }}
                  </p>
                </div>
                <div v-if="falla.acciones_correctivas">
                  <p class="mb-1 text-xs text-muted-foreground uppercase">Acciones correctivas</p>
                  <p class="text-sm leading-relaxed whitespace-pre-line text-foreground">
                    {{ falla.acciones_correctivas }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Adjuntos -->
            <div class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <PaperclipIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">
                  Adjuntos ({{ adjuntos.length }})
                </h3>
                <label
                  class="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="
                    uploadingFoto
                      ? 'cursor-wait border-border text-muted-foreground'
                      : 'border-primary/30 text-primary hover:bg-primary/5'
                  "
                >
                  <LoaderCircleIcon v-if="uploadingFoto" class="size-3.5 animate-spin" />
                  <PlusIcon v-else class="size-3.5" />
                  {{ uploadingFoto ? 'Subiendo...' : 'Subir' }}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    class="hidden"
                    :disabled="uploadingFoto"
                    @change="uploadFotos"
                  />
                </label>
              </div>

              <div v-if="adjuntos.length" class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div
                  v-for="(url, idx) in adjuntos"
                  :key="idx"
                  class="group relative aspect-square overflow-hidden rounded-lg border bg-muted/40"
                >
                  <img
                    v-if="isImage(url)"
                    :src="thumbUrl(url)"
                    :alt="filename(url)"
                    class="size-full object-cover"
                  />
                  <div v-else class="flex size-full flex-col items-center justify-center gap-2 p-3">
                    <component
                      :is="iconoAdjunto(url).icon"
                      class="size-8"
                      :class="iconoAdjunto(url).color"
                    />
                    <span
                      class="line-clamp-2 w-full px-1 text-center text-xs text-muted-foreground"
                      >{{ filename(url) }}</span
                    >
                  </div>
                  <div
                    class="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-colors group-hover:bg-black/40 group-hover:opacity-100"
                  >
                    <a
                      :href="resolveUrl(url)"
                      target="_blank"
                      rel="noopener"
                      class="flex size-8 items-center justify-center rounded-full bg-background text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Abrir en Drive"
                    >
                      <ExternalLinkIcon class="size-3.5" />
                    </a>
                    <button
                      type="button"
                      class="flex size-8 items-center justify-center rounded-full bg-background text-destructive transition-colors hover:bg-destructive/10"
                      title="Eliminar"
                      @click="deleteFoto(url)"
                    >
                      <Trash2Icon class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-muted-foreground">
                Sin adjuntos. Sube imágenes o documentos relevantes.
              </p>
            </div>

            <!-- Seguimientos -->
            <div class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <MessagesSquareIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">
                  Historial de seguimiento ({{ falla.seguimientos?.length || 0 }})
                </h3>
              </div>

              <!-- Añadir nota -->
              <div class="mb-4 space-y-3 rounded-lg bg-muted/40 p-3">
                <div class="flex flex-col gap-1">
                  <GLabel>Cambiar estado (opcional)</GLabel>
                  <ButtonGroup class="w-full md:w-72">
                    <Select v-model="nuevaNota.estado_id">
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="Mantener estado actual" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="e in catalogos.estados"
                          :key="e.id"
                          :value="String(e.id)"
                          >{{ e.etiqueta }}</SelectItem
                        >
                      </SelectContent>
                    </Select>
                    <Button
                      v-if="nuevaNota.estado_id"
                      variant="outline"
                      @click="nuevaNota.estado_id = null"
                    >
                      <XIcon class="size-4" />
                    </Button>
                  </ButtonGroup>
                </div>
                <Textarea
                  v-model="nuevaNota.nota"
                  rows="2"
                  placeholder="Escribe una actualización, novedad o nota técnica…"
                  class="text-sm"
                />
                <div class="flex justify-end">
                  <Button
                    size="sm"
                    :disabled="!nuevaNota.nota.trim() && !nuevaNota.estado_id"
                    @click="addSeguimiento"
                  >
                    <LoaderCircleIcon v-if="addingSeg" class="size-4 animate-spin" />
                    <SendIcon v-else class="size-4" />
                    Agregar nota
                  </Button>
                </div>
              </div>

              <!-- Timeline -->
              <div v-if="sortedSeguimientos.length" class="space-y-3">
                <div v-for="seg in sortedSeguimientos" :key="seg.id" class="flex gap-3">
                  <div
                    class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  >
                    {{ (seg.usuario?.nombre || seg.usuario_nombre || 'S')[0]?.toUpperCase() }}
                  </div>
                  <div class="flex-1 rounded-lg bg-muted/40 px-3 py-2">
                    <div class="mb-1 flex items-center justify-between gap-2">
                      <span class="text-sm font-semibold text-foreground">{{
                        seg.usuario?.nombre || seg.usuario_nombre || 'Sistema'
                      }}</span>
                      <span class="text-xs text-muted-foreground">{{
                        fmtDatetime(seg.created_at)
                      }}</span>
                    </div>
                    <p v-if="seg.nota" class="text-sm whitespace-pre-line text-foreground">
                      {{ seg.nota }}
                    </p>
                    <div v-if="seg.estado_nuevo" class="mt-1.5 flex items-center gap-1 text-xs">
                      <ArrowRightIcon class="size-2.5 text-muted-foreground" />
                      <GBadge :color="colorEstado(seg.estado_nuevo?.codigo)" class="text-xs">{{
                        seg.estado_nuevo?.etiqueta || ''
                      }}</GBadge>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-muted-foreground">Aún no hay notas de seguimiento.</p>
            </div>
          </div>

          <!-- COLUMNA SIDEBAR -->
          <div class="space-y-4">
            <!-- Acción sugerida -->
            <div
              v-if="falla.tipo?.accion_sugerida"
              class="rounded-xl border border-primary/15 bg-primary/5 p-5"
            >
              <div class="mb-3 flex items-center gap-2">
                <LightbulbIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">Acción sugerida</h3>
              </div>
              <p class="text-sm leading-relaxed text-foreground">
                {{ falla.tipo.accion_sugerida }}
              </p>
            </div>

            <!-- Actualización rápida -->
            <div class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <ZapIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">Actualización rápida</h3>
              </div>
              <div class="space-y-3">
                <div class="flex flex-col gap-1">
                  <GLabel>Estado</GLabel>
                  <Select v-model="quickEdit.estado_id">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="e in catalogos.estados"
                        :key="e.id"
                        :value="String(e.id)"
                        >{{ e.etiqueta }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-1">
                  <GLabel>Prioridad</GLabel>
                  <Select v-model="quickEdit.prioridad_id">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="p in catalogos.prioridades"
                        :key="p.id"
                        :value="String(p.id)"
                        >{{ p.etiqueta }}</SelectItem
                      >
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-1">
                  <GLabel>Energía perdida (kWh)</GLabel>
                  <NumberField
                    v-model="quickEdit.kwh_perdidos_estimado"
                    :min="0"
                    :format-options="{ maximumFractionDigits: 2 }"
                  >
                    <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                  </NumberField>
                </div>
                <div class="flex flex-col gap-1">
                  <GLabel>Causa raíz</GLabel>
                  <Textarea
                    v-model="quickEdit.causa_raiz"
                    rows="2"
                    placeholder="Causa raíz identificada…"
                    class="text-sm"
                  />
                </div>
                <Button class="w-full" :disabled="savingQuick" @click="saveQuickEdit">
                  <LoaderCircleIcon v-if="savingQuick" class="size-4 animate-spin" />
                  <CheckIcon v-else class="size-4" />
                  Guardar cambios
                </Button>
              </div>
            </div>

            <!-- Detalles técnicos -->
            <div class="rounded-xl border bg-card p-5">
              <div class="mb-4 flex items-center gap-2 border-b pb-3">
                <SettingsIcon class="size-4 text-primary" />
                <h3 class="text-sm font-semibold text-foreground">Detalles técnicos</h3>
              </div>
              <div class="space-y-2 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">ID interno</span>
                  <code class="font-mono text-foreground">{{ falla.id }}</code>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Código</span>
                  <code class="font-mono text-foreground">{{ falla.codigo_interno }}</code>
                </div>
                <div
                  v-if="falla.kwh_perdidos_estimado != null"
                  class="flex items-center justify-between"
                >
                  <span class="text-muted-foreground">Energía perdida</span>
                  <span class="font-semibold text-destructive"
                    >{{ falla.kwh_perdidos_estimado.toLocaleString('es-CO') }} kWh</span
                  >
                </div>
                <div v-if="falla.sla_cumplido != null" class="flex items-center justify-between">
                  <span class="text-muted-foreground">SLA</span>
                  <GBadge :color="falla.sla_cumplido ? 'success' : 'destructive'">{{
                    falla.sla_cumplido ? 'Cumplido' : 'Incumplido'
                  }}</GBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AsyncView>
</template>
