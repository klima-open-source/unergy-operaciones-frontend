<template>

  <!-- ══ CARGANDO ════════════════════════════════════════════════════════ -->
  <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
    <ProgressSpinner style="width:40px;height:40px" />
    <span class="text-sm text-gray-500">Cargando falla…</span>
  </div>

  <!-- ══ NO ENCONTRADA ═══════════════════════════════════════════════════ -->
  <div v-else-if="notFound" class="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
    <CircleAlertIcon class="text-4xl text-red-400 size-[1em]" />
    <p class="text-sm font-semibold text-gray-700">Falla no encontrada</p>
    <p class="text-xs">El registro solicitado no existe o fue eliminado.</p>
    <Button label="Volver" outlined size="small" @click="router.back()">
      <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
    </Button>
  </div>

  <!-- ══ VISTA PRINCIPAL ═════════════════════════════════════════════════ -->
  <div v-else-if="falla" class="space-y-4">

    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="flex items-start justify-between flex-wrap gap-3">
      <div class="flex items-start gap-3">
        <Button text rounded @click="router.back()" class="-ml-2 mt-1">
          <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
        </Button>
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <GBadge :color="colorEstado(falla.estado?.codigo)">{{ falla.estado?.etiqueta || '—' }}</GBadge>
            <GBadge :color="prioSeverity(falla.prioridad?.codigo)">{{ falla.prioridad?.etiqueta || '—' }}</GBadge>
            <GBadge v-if="categoria.etiqueta"
              :color="categoria.color || '#915BD8'">{{ categoria.etiqueta }}</GBadge>
          </div>
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
            <code class="text-base font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{{ falla.codigo_interno }}</code>
            <span class="text-gray-400 text-sm">·</span>
            <span class="text-base font-medium text-gray-700">{{ titulo }}</span>
          </h2>
          <p class="text-sm text-gray-600 mt-1 max-w-2xl">{{ falla.descripcion }}</p>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <span v-if="falla.proyecto?.nombre_comercial" class="inline-flex items-center gap-1">
              <BuildingIcon class="size-[1em]" /> {{ falla.proyecto.nombre_comercial }}
            </span>
            <span class="inline-flex items-center gap-1">
              <CalendarIcon class="size-[1em]" /> Identificada el {{ fmtDate(falla.fecha_identificacion) }}
            </span>
            <span v-if="falla.registrado_por?.nombre" class="inline-flex items-center gap-1">
              <UserIcon class="size-[1em]" /> Registrada por {{ falla.registrado_por.nombre }}
            </span>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <Button v-if="!editMode" label="Editar" outlined size="small" @click="editMode = true">
          <template #icon><PencilIcon class="size-[1em]" /></template>
        </Button>
        <Button v-else label="Cancelar edición" outlined size="small" severity="secondary" @click="editMode = false">
          <template #icon><XIcon class="size-[1em]" /></template>
        </Button>
        <Button outlined size="small" severity="danger" @click="confirmDelete" v-tooltip.top="'Eliminar falla'">
          <template #icon><Trash2Icon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <!-- ── Modo edición ──────────────────────────────────────────────── -->
    <div v-if="editMode" class="bg-white rounded-xl shadow-sm p-5">
      <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <PencilIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
        <h3 class="font-semibold text-sm text-gray-700">Editar falla completa</h3>
      </div>
      <FallaForm :initial="falla" :catalogos="catalogos" @save="onUpdate" @cancel="editMode = false" />
    </div>

    <!-- ── Vista normal ──────────────────────────────────────────────── -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4">

      <!-- COLUMNA PRINCIPAL -->
      <div class="lg:col-span-2 space-y-4">

        <!-- Clasificación (metodología estructurada) -->
        <div v-if="clasif" class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <component :is="clasif.icono" class="text-sm size-[1em]" :style="{ color: clasif.categoriaColor }" />
            <h3 class="font-semibold text-sm text-gray-700">Clasificación</h3>
            <GBadge v-if="clasif.pendienteReclasificar"
              color="warning" class="ml-auto text-[11px]">Pendiente de reclasificar</GBadge>
          </div>

          <!-- Sistema + equipo/evento -->
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <GBadge :color="clasif.categoriaColor || '#915BD8'">{{ clasif.categoriaEtiqueta }}</GBadge>
            <span v-if="clasif.subtitulo" class="text-sm font-semibold text-gray-800">{{ clasif.subtitulo }}</span>
          </div>

          <!-- Detalle libre -->
          <p v-if="clasif.detalle" class="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-3">
            {{ clasif.detalle }}
          </p>

          <!-- Frontera: flags -->
          <div v-if="clasif.frontera" class="flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md"
              :class="clasif.frontera.afectaMedicion ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'">
              <CircleXIcon v-if="clasif.frontera.afectaMedicion" class="text-[11px] size-[1em]" />
              <CircleCheckIcon v-else class="text-[11px] size-[1em]" />
              {{ clasif.frontera.afectaMedicion ? 'Afecta la medición' : 'No afecta la medición' }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md"
              :class="clasif.frontera.perdidaComunicacion ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'">
              <WifiIcon v-if="clasif.frontera.perdidaComunicacion" class="text-[11px] size-[1em]" />
              <CircleCheckIcon v-else class="text-[11px] size-[1em]" />
              {{ clasif.frontera.perdidaComunicacion ? 'Pérdida de comunicación' : 'Comunicación OK' }}
            </span>
          </div>

          <!-- Inversores afectados -->
          <div v-if="clasif.inversores.length" class="space-y-2">
            <p class="text-xs text-gray-400 uppercase tracking-wide">Inversores afectados ({{ clasif.inversores.length }})</p>
            <div v-for="(inv, idx) in clasif.inversores" :key="idx"
              class="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div class="flex items-center gap-2 mb-1.5">
                <ServerIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple)" />
                <span class="text-sm font-semibold text-gray-800">{{ inv.nombre }}</span>
                <span v-if="inv.potenciaKw != null" class="text-xs text-gray-500">· {{ inv.potenciaKw }} kW</span>
              </div>
              <div v-if="inv.tipos.length" class="flex flex-wrap gap-1.5">
                <span v-for="(t, ti) in inv.tipos" :key="ti"
                  class="text-[11px] font-semibold px-2 py-0.5 rounded"
                  style="background:#915BD81a;color:var(--color-unergy-purple-dark)">{{ t }}</span>
              </div>
              <p v-else class="text-xs text-gray-400">Sin tipo de falla especificado</p>
            </div>
          </div>
        </div>

        <!-- Información general -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <InfoIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">Información general</h3>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <InfoField label="Proyecto" :value="falla.proyecto?.nombre_comercial" highlight />
            <InfoField label="Equipo / evento" :value="titulo" />
            <InfoField label="Registrado por" :value="falla.registrado_por?.nombre" />
            <InfoField label="Fecha ocurrencia" :value="fmtDatetime(falla.fecha_ocurrencia)" />
            <InfoField label="Fecha identificación" :value="fmtFechaConHora(falla.fecha_identificacion, falla.hora_identificacion)" />
            <div v-if="falla.fecha_resolucion">
              <p class="text-xs text-gray-400 uppercase tracking-wide">Fecha resolución</p>
              <p class="font-semibold mt-0.5 text-emerald-600">{{ fmtDatetime(falla.fecha_resolucion) }}</p>
            </div>
            <div v-if="falla.tiempo_afectacion_horas != null">
              <p class="text-xs text-gray-400 uppercase tracking-wide">Tiempo de afectación</p>
              <p class="font-semibold mt-0.5" style="color:#b45309">{{ fmtDuracion(falla.tiempo_afectacion_horas) }}</p>
            </div>
            <InfoField v-if="falla.resolucion" label="Tipo resolución" :value="falla.resolucion?.etiqueta" />
          </div>
        </div>

        <!-- SLA -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <ClockIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">SLA</h3>
            <GBadge :color="slaSeverity" class="ml-auto">{{ slaTexto }}</GBadge>
          </div>
          <div>
            <div class="flex items-center gap-3 text-xs mb-2">
              <span class="text-gray-500">Límite</span>
              <span class="font-semibold text-gray-800">{{ falla.sla_limite_horas_efectivo }}h</span>
              <span class="text-gray-500 ml-auto">Transcurrido</span>
              <span class="font-semibold" :style="{ color: slaColor }">{{ horasTranscurridas }}h</span>
            </div>
            <div class="bg-gray-100 rounded-full h-2 overflow-hidden">
              <div class="h-full rounded-full transition-all" :style="slaFillStyle" />
            </div>
          </div>
        </div>

        <!-- Análisis -->
        <div v-if="falla.causa_raiz || falla.acciones_correctivas" class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <SearchIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">Análisis</h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-if="falla.causa_raiz">
              <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Causa raíz</p>
              <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{{ falla.causa_raiz }}</p>
            </div>
            <div v-if="falla.acciones_correctivas">
              <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Acciones correctivas</p>
              <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{{ falla.acciones_correctivas }}</p>
            </div>
          </div>
        </div>

        <!-- Adjuntos -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <PaperclipIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">Adjuntos ({{ adjuntos.length }})</h3>
            <label class="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-md border transition-colors"
              :class="uploadingFoto ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
                                    : 'border-purple-200 text-purple-700 hover:bg-purple-50'">
              <LoaderCircleIcon class="text-xs size-[1em] animate-spin" v-if="uploadingFoto" />
              <PlusIcon class="text-xs size-[1em]" v-else />
              {{ uploadingFoto ? 'Subiendo...' : 'Subir' }}
              <input type="file" accept="image/*,.pdf" multiple class="hidden"
                @change="uploadFotos" :disabled="uploadingFoto" />
            </label>
          </div>

          <div v-if="adjuntos.length" class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="(url, idx) in adjuntos" :key="idx"
              class="relative group rounded-lg overflow-hidden border border-gray-100 bg-gray-50 aspect-square">
              <img v-if="isImage(url)" :src="thumbUrl(url)" :alt="filename(url)"
                class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-gray-500">
                <component :is="iconoAdjunto(url).icon" class="size-[1em]" :class="iconoAdjunto(url).color"
                  style="font-size:2rem" />
                <span class="text-[10px] text-center line-clamp-2 w-full px-1">{{ filename(url) }}</span>
              </div>
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <a :href="resolveUrl(url)" target="_blank" rel="noopener"
                  class="w-8 h-8 rounded-full bg-white text-gray-700 flex items-center justify-center hover:bg-purple-100 hover:text-purple-700 transition-colors"
                  v-tooltip.top="'Abrir en Drive'">
                  <ExternalLinkIcon class="text-xs size-[1em]" />
                </a>
                <button class="w-8 h-8 rounded-full bg-white text-red-600 flex items-center justify-center hover:bg-red-50 transition-colors"
                  v-tooltip.top="'Eliminar'" @click="deleteFoto(url)">
                  <Trash2Icon class="text-xs size-[1em]" />
                </button>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400">Sin adjuntos. Sube imágenes o documentos relevantes.</p>
        </div>

        <!-- Seguimientos -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <MessagesSquareIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">Historial de seguimiento ({{ falla.seguimientos?.length || 0 }})</h3>
          </div>

          <!-- Añadir nota -->
          <div class="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Cambiar estado (opcional)</label>
              <Select v-model="nuevaNota.estado_id" :options="catalogos.estados" optionLabel="etiqueta"
                optionValue="id" placeholder="Mantener estado actual" showClear class="w-full md:w-72" />
            </div>
            <Textarea v-model="nuevaNota.nota" rows="2" autoResize
              placeholder="Escribe una actualización, novedad o nota técnica…" class="w-full text-sm" />
            <div class="flex justify-end">
              <Button label="Agregar nota" size="small" :disabled="!nuevaNota.nota.trim() && !nuevaNota.estado_id" :loading="addingSeg" @click="addSeguimiento">
                <template #icon><SendIcon class="size-[1em]" /></template>
              </Button>
            </div>
          </div>

          <!-- Timeline -->
          <div v-if="sortedSeguimientos.length" class="space-y-3">
            <div v-for="seg in sortedSeguimientos" :key="seg.id" class="flex gap-3">
              <div class="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {{ (seg.usuario?.nombre || seg.usuario_nombre || 'S')[0].toUpperCase() }}
              </div>
              <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="text-sm font-semibold text-gray-800">{{ seg.usuario?.nombre || seg.usuario_nombre || 'Sistema' }}</span>
                  <span class="text-xs text-gray-400">{{ fmtDatetime(seg.created_at) }}</span>
                </div>
                <p v-if="seg.nota" class="text-sm text-gray-700 whitespace-pre-line">{{ seg.nota }}</p>
                <div v-if="seg.estado_nuevo" class="mt-1.5 flex items-center gap-1 text-xs">
                  <ArrowRightIcon class="text-[10px] text-gray-400 size-[1em]" />
                  <GBadge :color="colorEstado(seg.estado_nuevo?.codigo)" class="text-[10px]">{{ seg.estado_nuevo?.etiqueta || '' }}</GBadge>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400">Aún no hay notas de seguimiento.</p>
        </div>

      </div>

      <!-- COLUMNA SIDEBAR -->
      <div class="space-y-4">

        <!-- Acción sugerida -->
        <div v-if="falla.tipo?.accion_sugerida" class="rounded-xl p-5 shadow-sm"
          style="background: linear-gradient(135deg, #faf7ff 0%, #f3edff 100%); border: 1px solid #e5d9ff;">
          <div class="flex items-center gap-2 mb-3">
            <LightbulbIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm" style="color:#4a3b6b">Acción sugerida</h3>
          </div>
          <p class="text-sm text-gray-700 leading-relaxed">{{ falla.tipo.accion_sugerida }}</p>
        </div>

        <!-- Actualización rápida -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <ZapIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">Actualización rápida</h3>
          </div>
          <div class="space-y-3">
            <div class="flex flex-col gap-1">
              <label class="field-label">Estado</label>
              <Select v-model="quickEdit.estado_id" :options="catalogos.estados" optionLabel="etiqueta"
                optionValue="id" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Prioridad</label>
              <Select v-model="quickEdit.prioridad_id" :options="catalogos.prioridades" optionLabel="etiqueta"
                optionValue="id" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Energía perdida (kWh)</label>
              <InputNumber v-model="quickEdit.kwh_perdidos_estimado" :minFractionDigits="0" :maxFractionDigits="2"
                :min="0" locale="en-US" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="field-label">Causa raíz</label>
              <Textarea v-model="quickEdit.causa_raiz" rows="2" autoResize
                placeholder="Causa raíz identificada…" class="w-full text-sm" />
            </div>
            <Button label="Guardar cambios" :loading="savingQuick" @click="saveQuickEdit" class="w-full">
              <template #icon><CheckIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>

        <!-- Detalles técnicos -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <SettingsIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
            <h3 class="font-semibold text-sm text-gray-700">Detalles técnicos</h3>
          </div>
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-gray-500">ID interno</span>
              <code class="font-mono text-gray-700">{{ falla.id }}</code>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Código</span>
              <code class="font-mono text-gray-700">{{ falla.codigo_interno }}</code>
            </div>
            <div v-if="falla.kwh_perdidos_estimado != null" class="flex items-center justify-between">
              <span class="text-gray-500">Energía perdida</span>
              <span class="font-semibold text-red-600">{{ falla.kwh_perdidos_estimado.toLocaleString('es-CO') }} kWh</span>
            </div>
            <div v-if="falla.sla_cumplido != null" class="flex items-center justify-between">
              <span class="text-gray-500">SLA</span>
              <GBadge :color="falla.sla_cumplido ? 'success' : 'destructive'">{{ falla.sla_cumplido ? 'Cumplido' : 'Incumplido' }}</GBadge>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

</template>

<script setup>
import { ArrowLeftIcon, ArrowRightIcon, BuildingIcon, CalendarIcon, CheckIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon, ClockIcon, ExternalLinkIcon, FileIcon, FileTypeIcon, InfoIcon, LightbulbIcon, LoaderCircleIcon, MessagesSquareIcon, PaperclipIcon, PencilIcon, PlusIcon, SearchIcon, SendIcon, ServerIcon, SettingsIcon, Trash2Icon, UserIcon, WifiIcon, XIcon, ZapIcon } from '@lucide/vue'
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import ProgressSpinner from 'primevue/progressspinner'
import FallaForm from './FallaForm.vue'
import { tituloFalla, categoriaFalla, clasificacionDetalle } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado } from '~/features/fallas/utils/colores'
import { FallasService } from '~/features/fallas/services/fallas'

const fallasService = new FallasService()

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

// ── Estado ──────────────────────────────────────────────────────────────
const falla = ref(null)
const loading = ref(true)
const notFound = ref(false)
const editMode = ref(false)
const addingSeg = ref(false)
const savingQuick = ref(false)
const uploadingFoto = ref(false)

const catalogos = ref({ estados: [], prioridades: [], tipos: [], resoluciones: [] })

const nuevaNota = reactive({ nota: '', estado_id: '' })
const quickEdit = reactive({
  estado_id: null,
  prioridad_id: null,
  kwh_perdidos_estimado: null,
  causa_raiz: '',
})

// ── Computed ────────────────────────────────────────────────────────────
// Título / categoría / clasificación derivados de lo REALMENTE reportado
// (metodología estructurada), con respaldo al tipo legacy para fallas viejas.
const titulo = computed(() => tituloFalla(falla.value))
const categoria = computed(() => categoriaFalla(falla.value))
const clasif = computed(() => clasificacionDetalle(falla.value))

// El backend ya los manda del mas reciente al mas viejo (`FallaSeguimiento.Meta
// .ordering`, 2026-09-07). Antes se ordenaba aca y el movil no lo hacia, asi que
// la misma falla mostraba su cronologia desordenada en el telefono.
const sortedSeguimientos = computed(() => falla.value?.seguimientos ?? [])

// El backend puede devolver `fotos_lista` como list[str] (URLs, legado) o como
// list[obj] {url, nombre, ...} (formato actual). Normalizamos SIEMPRE a string:
// para los objetos reconstruimos "url#nombre" — el fragment con el nombre real es
// justo lo que leen filename()/isImage() (ver `filename`). Antes se devolvía el
// objeto tal cual y el template llamaba filename(objeto) → objeto.includes(...) →
// "TypeError: a.includes is not a function", que dejaba la página completa en blanco.
const adjuntos = computed(() => {
  const v = falla.value
  if (!v) return []
  const toUrl = (a) => {
    if (typeof a === 'string') return a
    if (!a || !a.url) return null
    return a.nombre ? `${a.url}#${encodeURIComponent(a.nombre)}` : a.url
  }
  if (Array.isArray(v.fotos_lista)) return v.fotos_lista.map(toUrl).filter(Boolean)
  if (Array.isArray(v.attachments)) return v.attachments.map(a => a.url || a.archivo_url || a).filter(Boolean)
  if (Array.isArray(v.fotos)) return v.fotos.map(a => a.url || a.archivo_url || a).filter(Boolean)
  return []
})

// El reloj del SLA lo calcula el backend: `sla_horas_transcurridas` y `sla_pct`
// vienen del serializer de fallas (`dominio.horas_transcurridas_sla` /
// `dominio.sla_pct`). Esta vista solo los LEE.
//
// Antes las tres pantallas de fallas tenian cada una su copia de este calculo, y
// las tres anclaban a `fecha_identificacion + 'T00:00:00'`: para una critica
// (SLA 8 h) identificada a las 9 a.m. la barra marcaba "Excedido" desde que se
// creaba. Y contaban desde `fecha_ocurrencia` mientras el limite se calculaba
// desde la identificacion, asi que el porcentaje no correspondia con el badge de
// la misma pantalla.
const horasTranscurridas = computed(() => Math.round(falla.value?.sla_horas_transcurridas ?? 0))

const slaPct = computed(() => falla.value?.sla_pct ?? null)

const slaColor = computed(() => {
  const p = slaPct.value
  if (p == null) return '#a094b8'
  if (p >= 100) return '#dc2626'
  if (p >= 70) return '#d97706'
  return '#16a34a'
})

const slaSeverity = computed(() => {
  if (falla.value?.sla_cumplido === true) return 'success'
  if (falla.value?.sla_cumplido === false) return 'destructive'
  const p = slaPct.value
  if (p == null) return 'default'
  if (p >= 100) return 'destructive'
  if (p >= 70) return 'warning'
  return 'success'
})

const slaTexto = computed(() => {
  if (falla.value?.sla_cumplido === true) return 'Cumplido'
  if (falla.value?.sla_cumplido === false) return 'Excedido'
  const p = slaPct.value
  if (p == null) return 'Sin SLA'
  if (p >= 100) return `Excedido ${p}%`
  return `${p}% del límite`
})

const slaFillStyle = computed(() => {
  const p = Math.min(slaPct.value ?? 0, 100)
  return { width: `${p}%`, background: slaColor.value }
})

// ── Helpers ─────────────────────────────────────────────────────────────
function prioSeverity(codigo) {
  // Códigos reales del catálogo (fallas_cat_prioridades): critica/grave/media/leve
  // -- "alta"/"baja" nunca calzaban con nada real, "grave" y "leve" caían siempre
  // al 'default' (bug encontrado al consolidar los colores de fallas, 2026-09-02).
  return { critica: 'destructive', grave: 'warning', media: 'information', leve: 'default' }[codigo] || 'default'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO',
    { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDatetime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-CO',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtFechaConHora(d, hora) {
  if (!d) return '—'
  const base = fmtDate(d)
  return hora ? `${base} · ${String(hora).slice(0, 5)}` : base
}
function fmtDuracion(horas) {
  if (horas == null || horas < 0) return '—'
  const totalMin = Math.round(horas * 60)
  if (totalMin === 0) return '0 min'
  const dias = Math.floor(totalMin / 1440)
  const hrs = Math.floor((totalMin % 1440) / 60)
  const min = totalMin % 60
  const parts = []
  if (dias) parts.push(`${dias} d`)
  if (hrs) parts.push(`${hrs} h`)
  if (min) parts.push(`${min} min`)
  return parts.join(' ')
}
function driveFileId(url) {
  const m = (url || '').match(/\/file\/d\/([^/?#]+)/)
  return m ? m[1] : null
}
function filename(url) {
  if (!url) return 'archivo'
  // Fragment after # contains original filename for Drive URLs
  const hash = url.includes('#') ? url.split('#').pop() : null
  if (hash) return decodeURIComponent(hash)
  return decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'archivo')
}
function isImage(url) {
  const name = filename(url)
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
}

/** Icono y color del adjunto según su extensión. */
function iconoAdjunto(url) {
  const name = filename(url)
  if (/\.pdf$/i.test(name)) return { icon: FileTextIcon, color: 'text-red-400' }
  if (/\.(xls|xlsx|csv)$/i.test(name)) return { icon: FileSpreadsheetIcon, color: 'text-green-500' }
  if (/\.(doc|docx)$/i.test(name)) return { icon: FileTypeIcon, color: 'text-blue-500' }
  return { icon: FileIcon, color: 'text-gray-400' }
}
function resolveUrl(url) {
  if (!url) return ''
  // Strip fragment for the actual link
  return url.split('#')[0]
}
function thumbUrl(url) {
  const id = driveFileId(url)
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w400`
  return resolveUrl(url)
}

// ── Carga ───────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const data = await fallasService.obtener(route.params.id)
    falla.value = data
    quickEdit.estado_id = data.estado?.id ?? null
    quickEdit.prioridad_id = data.prioridad?.id ?? null
    quickEdit.kwh_perdidos_estimado = data.kwh_perdidos_estimado ?? null
    quickEdit.causa_raiz = data.causa_raiz ?? ''
  } catch (err) {
    if (err?.status === 404) notFound.value = true
  } finally {
    loading.value = false
  }
}

async function loadCatalogos() {
  try {
    catalogos.value = await fallasService.obtenerCatalogos()
  } catch { /* no crítico */ }
}

// ── Acciones ────────────────────────────────────────────────────────────
async function onUpdate(payload) {
  try {
    await fallasService.actualizar(falla.value.id, payload)
    toast.success('Falla actualizada', { duration: 3000 })
    editMode.value = false
    await load()
  } catch (err) {
    const msg = err?.data?.detail ?? 'Error al actualizar'
    toast.error('Error', { description: msg, duration: 4000 })
  }
}

async function saveQuickEdit() {
  savingQuick.value = true
  try {
    const payload = {}
    if (quickEdit.estado_id) payload.estado_id = quickEdit.estado_id
    if (quickEdit.prioridad_id) payload.prioridad_id = quickEdit.prioridad_id
    if (quickEdit.causa_raiz?.trim()) payload.causa_raiz = quickEdit.causa_raiz.trim()
    if (quickEdit.kwh_perdidos_estimado != null) payload.kwh_perdidos_estimado = quickEdit.kwh_perdidos_estimado
    await fallasService.actualizar(falla.value.id, payload)
    toast.success('Cambios guardados', { duration: 2500 })
    await load()
  } catch (err) {
    const msg = err?.data?.detail ?? 'Error al guardar'
    toast.error('Error', { description: msg, duration: 4000 })
  } finally {
    savingQuick.value = false
  }
}

async function addSeguimiento() {
  if (!nuevaNota.nota.trim() && !nuevaNota.estado_id) return
  addingSeg.value = true
  try {
    const payload = {}
    if (nuevaNota.nota.trim()) payload.nota = nuevaNota.nota.trim()
    if (nuevaNota.estado_id) payload.estado_nuevo_id = nuevaNota.estado_id
    await fallasService.crearSeguimiento(falla.value.id, payload)
    nuevaNota.nota = ''
    nuevaNota.estado_id = ''
    toast.success('Seguimiento agregado', { duration: 2500 })
    await load()
  } catch (err) {
    const msg = err?.data?.detail ?? 'Error al agregar'
    toast.error('Error', { description: msg, duration: 4000 })
  } finally {
    addingSeg.value = false
  }
}

async function uploadFotos(event) {
  const files = Array.from(event.target.files)
  if (!files.length) return
  uploadingFoto.value = true
  let okCount = 0
  try {
    for (const file of files) {
      try {
        await fallasService.subirAdjunto(falla.value.id, file)
        okCount++
      } catch (err) {
        const msg = err?.data?.detail ?? `No se pudo subir ${file.name}`
        toast.warning('Archivo rechazado', { description: msg, duration: 4000 })
      }
    }
    if (okCount) {
      await load()
      toast.success(`${okCount} archivo(s) subido(s)`, { duration: 2500 })
    }
  } finally {
    uploadingFoto.value = false
    event.target.value = ''
  }
}

function deleteFoto(url) {
  confirm({
    title: 'Eliminar adjunto',
    description: '¿Eliminar este adjunto? Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        // No hay endpoint DELETE en backend. Actualizamos fotos_urls vía PATCH excluyendo la URL.
        const nuevaLista = adjuntos.value.filter(u => u !== url)
        await fallasService.actualizar(falla.value.id, { fotos_urls: nuevaLista })
        await load()
        toast.success('Adjunto eliminado', { duration: 2500 })
      } catch (err) {
        const msg = err?.data?.detail ?? 'No se pudo eliminar'
        toast.error('Error', { description: msg, duration: 3000 })
      }
    },
  })
}

function confirmDelete() {
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Eliminar la falla ${falla.value.codigo_interno}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await fallasService.eliminar(falla.value.id)
        toast.success('Falla eliminada', { duration: 3000 })
        router.back()
      } catch {
        toast.error('Error al eliminar', { duration: 3000 })
      }
    },
  })
}

onMounted(() => {
  loadCatalogos()
  load()
})
</script>

<script>
// Componente auxiliar local (Composition API).
const InfoField = {
  props: { label: String, value: [String, Number, Boolean], highlight: Boolean },
  setup(props) {
    return { props }
  },
  template: `
    <div>
      <p class="text-xs text-gray-400 uppercase tracking-wide">{{ props.label }}</p>
      <p class="mt-0.5" :class="props.highlight ? 'font-bold text-gray-800' : 'font-medium text-gray-700'">{{ props.value || '—' }}</p>
    </div>
  `,
}
export default { components: { InfoField } }
</script>

<style scoped>
.field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #6b5a8a;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
</style>
