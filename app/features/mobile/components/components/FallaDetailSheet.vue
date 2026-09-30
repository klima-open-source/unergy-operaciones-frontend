<template>
  <Teleport to="body">
    <Transition name="fdsheet">
      <div
        v-if="open && fa"
        class="fixed inset-0 z-50 flex items-end bg-foreground/45"
        @click.self="close"
      >
        <div
          class="fd-sheet flex max-h-11/12 w-full flex-col rounded-t-3xl bg-card px-4.5 pt-2.5 shadow-lg"
        >
          <div class="mx-auto mt-1 mb-3 h-1 w-10 rounded-full bg-border" />

          <!-- Header -->
          <div class="mb-2.5 flex items-center gap-2.5">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <code
                class="self-start rounded-md bg-primary/10 px-2 py-px font-mono text-xs text-primary"
                >{{ fa.codigo_interno }}</code
              >
              <span class="text-sm font-bold text-foreground">{{ titulo }}</span>
            </div>
            <span v-if="saving" class="text-primary"
              ><LoaderCircleIcon class="size-4 animate-spin"
            /></span>
            <button class="p-1 text-muted-foreground" @click="close">
              <XIcon class="size-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <p class="mb-4 text-sm leading-snug text-foreground">{{ fa.descripcion }}</p>

            <!-- Clasificación (metodología estructurada) -->
            <div v-if="clasif" class="mb-4 rounded-xl border border-border bg-muted/50 px-3.5 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 rounded-lg bg-(--c)/10 px-2.5 py-1 text-xs font-extrabold text-(--c)"
                  :style="{ '--c': clasif.categoriaColor }"
                >
                  <component :is="clasif.icono" class="size-3" /> {{ clasif.categoriaEtiqueta }}
                </span>
                <span v-if="clasif.subtitulo" class="text-sm font-bold text-foreground">{{
                  clasif.subtitulo
                }}</span>
                <span
                  v-if="clasif.pendienteReclasificar"
                  class="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-extrabold tracking-wide text-warning uppercase"
                  >Pendiente reclasificar</span
                >
              </div>

              <p v-if="clasif.detalle" class="mt-2.5 text-sm leading-snug text-muted-foreground">
                {{ clasif.detalle }}
              </p>

              <!-- Frontera -->
              <div v-if="clasif.frontera" class="mt-3 flex flex-wrap gap-2">
                <span
                  :class="[
                    'rounded-lg px-2.5 py-1 text-xs font-bold',
                    clasif.frontera.afectaMedicion
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-muted text-muted-foreground',
                  ]"
                >
                  {{ clasif.frontera.afectaMedicion ? 'Afecta medición' : 'No afecta medición' }}
                </span>
                <span
                  :class="[
                    'rounded-lg px-2.5 py-1 text-xs font-bold',
                    clasif.frontera.perdidaComunicacion
                      ? 'bg-warning/15 text-warning'
                      : 'bg-muted text-muted-foreground',
                  ]"
                >
                  {{
                    clasif.frontera.perdidaComunicacion
                      ? 'Pérdida de comunicación'
                      : 'Comunicación OK'
                  }}
                </span>
              </div>

              <!-- Inversores afectados -->
              <div v-if="clasif.inversores.length" class="mt-3 flex flex-col gap-2">
                <div
                  v-for="(inv, idx) in clasif.inversores"
                  :key="idx"
                  class="rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <div class="flex items-center gap-2 text-sm text-foreground">
                    <ServerIcon class="size-3 text-primary" />
                    <b>{{ inv.nombre }}</b>
                    <span
                      v-if="inv.potenciaKw != null"
                      class="text-xs font-semibold text-muted-foreground"
                      >{{ inv.potenciaKw }} kW</span
                    >
                  </div>
                  <div v-if="inv.tipos.length" class="mt-2 flex flex-wrap gap-1.5">
                    <span
                      v-for="(t, ti) in inv.tipos"
                      :key="ti"
                      class="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
                      >{{ t }}</span
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Estado -->
            <div class="mb-4">
              <span class="text-xs font-extrabold tracking-wider text-muted-foreground uppercase"
                >Estado</span
              >
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="e in catalogos.estados"
                  :key="e.id"
                  type="button"
                  :class="[CHIP_BASE, fa.estado?.id === e.id ? CHIP_ACTIVO : CHIP_INACTIVO]"
                  :style="{ '--c': colorEstado(e.codigo) }"
                  @click="cambiar({ estado_id: e.id })"
                >
                  {{ e.etiqueta }}
                </button>
              </div>
            </div>

            <!-- Prioridad -->
            <div class="mb-4">
              <span class="text-xs font-extrabold tracking-wider text-muted-foreground uppercase"
                >Prioridad</span
              >
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="p in catalogos.prioridades"
                  :key="p.id"
                  type="button"
                  :class="[CHIP_BASE, fa.prioridad?.id === p.id ? CHIP_ACTIVO : CHIP_INACTIVO]"
                  :style="{ '--c': colorPrioridad(p.codigo) }"
                  @click="cambiar({ prioridad_id: p.id })"
                >
                  {{ p.etiqueta }}
                </button>
              </div>
            </div>

            <!-- Datos -->
            <div class="mb-4 flex flex-col rounded-xl border border-border px-3 py-1">
              <div
                class="flex items-center justify-between gap-2.5 border-b border-border py-2.5 text-sm last:border-b-0"
              >
                <span class="text-muted-foreground">Proyecto</span
                ><b class="text-right text-foreground">{{
                  fa.proyecto?.nombre_comercial || '—'
                }}</b>
              </div>
              <div
                class="flex items-center justify-between gap-2.5 border-b border-border py-2.5 text-sm last:border-b-0"
              >
                <span class="text-muted-foreground">Identificada</span
                ><b class="text-right text-foreground"
                  >{{ fmtFecha(fa.fecha_identificacion)
                  }}<span v-if="fa.hora_identificacion" class="text-muted-foreground">
                    · {{ String(fa.hora_identificacion).slice(0, 5) }}</span
                  ></b
                >
              </div>
              <div
                class="flex items-center justify-between gap-2.5 border-b border-border py-2.5 text-sm last:border-b-0"
              >
                <span class="text-muted-foreground">Registró</span
                ><b class="text-right text-foreground">{{ fa.registrado_por?.nombre || '—' }}</b>
              </div>
              <div
                v-if="fa.fecha_resolucion"
                class="flex items-center justify-between gap-2.5 border-b border-border py-2.5 text-sm last:border-b-0"
              >
                <span class="text-muted-foreground">Resuelta</span
                ><b class="text-right text-foreground">{{
                  fmtFecha(fa.fecha_resolucion?.slice?.(0, 10) || fa.fecha_resolucion)
                }}</b>
              </div>
              <div
                v-if="fa.kwh_perdidos_estimado != null"
                class="flex items-center justify-between gap-2.5 border-b border-border py-2.5 text-sm last:border-b-0"
              >
                <span class="text-muted-foreground">Energía perdida</span
                ><b class="text-right text-foreground"
                  >{{ Number(fa.kwh_perdidos_estimado).toLocaleString('es-CO') }} kWh</b
                >
              </div>
            </div>

            <!-- Causa raíz / acciones -->
            <div v-if="fa.causa_raiz" class="mb-4">
              <span class="text-xs font-extrabold tracking-wider text-muted-foreground uppercase"
                >Causa raíz</span
              >
              <p>{{ fa.causa_raiz }}</p>
            </div>
            <div v-if="fa.acciones_correctivas" class="mb-4">
              <span class="text-xs font-extrabold tracking-wider text-muted-foreground uppercase"
                >Acciones correctivas</span
              >
              <p>{{ fa.acciones_correctivas }}</p>
            </div>

            <!-- Seguimientos -->
            <div class="mb-2">
              <span class="text-xs font-extrabold tracking-wider text-muted-foreground uppercase"
                >Seguimiento ({{ fa.seguimientos?.length || 0 }})</span
              >
              <div class="mt-2 mb-3.5">
                <textarea
                  v-model="nota"
                  rows="2"
                  class="w-full resize-none rounded-xl border-2 border-border px-3.5 py-3 text-base text-foreground focus:border-primary focus:outline-none"
                  placeholder="Agregar nota…"
                ></textarea>
                <div class="mt-2 flex items-stretch gap-2">
                  <select
                    v-model="notaEstadoId"
                    class="fd-select flex-1 appearance-none rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option :value="null">Sin cambiar estado</option>
                    <option v-for="e in catalogos.estados" :key="e.id" :value="e.id">
                      → {{ e.etiqueta }}
                    </option>
                  </select>
                  <button
                    class="shrink-0 rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-40"
                    :disabled="addingSeg || (!nota.trim() && !notaEstadoId)"
                    @click="agregarSeg"
                  >
                    <LoaderCircleIcon class="size-4 animate-spin" v-if="addingSeg" /><SendIcon
                      class="size-4"
                      v-else
                    />
                  </button>
                </div>
              </div>
              <div
                v-for="s in fa.seguimientos || []"
                :key="s.id"
                class="mb-1 border-l-2 border-border pt-1 pb-2.5 pl-3"
              >
                <div class="flex justify-between text-xs">
                  <span class="font-bold text-foreground">{{ s.usuario?.nombre || '—' }}</span>
                  <span class="text-muted-foreground">{{ relativeTime(s.created_at) }}</span>
                </div>
                <p v-if="s.nota" class="mt-1 text-sm leading-snug text-muted-foreground">
                  {{ s.nota }}
                </p>
                <span
                  v-if="s.estado_nuevo"
                  class="mt-1.5 inline-block rounded-md bg-(--c) px-2 py-0.5 text-xs font-bold text-white"
                  :style="{ '--c': colorEstado(s.estado_nuevo.codigo) }"
                  >{{ s.estado_nuevo.etiqueta }}</span
                >
              </div>
            </div>
          </div>

          <!-- Acción principal -->
          <button
            v-if="!fa.estado?.es_estado_final"
            class="mt-2.5 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-success text-base font-bold text-white disabled:opacity-50"
            :disabled="saving"
            @click="resolver"
          >
            <CircleCheckIcon class="size-4" /> Marcar resuelta
          </button>
          <button
            v-else
            class="mt-2.5 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary/10 text-base font-bold text-primary disabled:opacity-50"
            :disabled="saving"
            @click="reabrir"
          >
            <RotateCcwIcon class="size-4" /> Reabrir falla
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  CircleCheckIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  SendIcon,
  ServerIcon,
  XIcon,
} from '@lucide/vue'
import type {
  CatalogosFalla,
  Falla,
  PayloadFalla,
  PayloadSeguimiento,
} from '~/features/fallas/types'
import { clasificacionDetalle, tituloFalla } from '~/features/fallas/utils/fallaTitulo'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { FallasService } from '~/features/fallas/services/fallas'
import { normalizeError } from '~/core/errors'

const props = withDefaults(
  defineProps<{
    open?: boolean
    falla?: Falla | null
    catalogos?: CatalogosFalla
  }>(),
  {
    open: false,
    falla: null,
    catalogos: () => ({ estados: [], prioridades: [], tipos: [], resoluciones: [] }),
  },
)
const emit = defineEmits<{ close: []; updated: [falla: Falla] }>()

const fallasService = new FallasService()
const fa = ref<Falla | null>(null)
const saving = ref(false)
const addingSeg = ref(false)
const nota = ref('')
const notaEstadoId = ref<number | null>(null)

// Título y clasificación derivados de lo realmente reportado (metodología nueva),
// con respaldo al tipo legacy para fallas viejas.
const titulo = computed(() => tituloFalla(fa.value))
const clasif = computed(() => clasificacionDetalle(fa.value))

watch(
  () => props.open,
  (o) => {
    if (o && props.falla) {
      fa.value = props.falla
      nota.value = ''
      notaEstadoId.value = null
      refrescar()
    }
  },
)

// Chip de estado/prioridad: el color activo llega por la variable `--c` del propio botón.
const CHIP_BASE = 'rounded-xl border-2 px-3.5 py-2.5 text-sm font-semibold'
const CHIP_ACTIVO = 'border-(--c) bg-(--c) text-white'
const CHIP_INACTIVO = 'border-border bg-card text-muted-foreground'
function fmtFecha(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}
function relativeTime(s: string | null | undefined): string {
  if (!s) return ''
  const min = Math.floor((Date.now() - new Date(s).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function close(): void {
  emit('close')
}

async function refrescar(): Promise<void> {
  if (!fa.value) return
  try {
    fa.value = await fallasService.obtener(fa.value.id)
  } catch {
    /* mantiene la copia del listado */
  }
}

async function cambiar(payload: PayloadFalla): Promise<void> {
  if (!fa.value) return
  saving.value = true
  try {
    const data = await fallasService.actualizar(fa.value.id, payload)
    fa.value = data
    emit('updated', data)
  } catch (e) {
    toast.error('No se pudo guardar', { description: normalizeError(e).message, duration: 3000 })
  } finally {
    saving.value = false
  }
}

async function agregarSeg(): Promise<void> {
  if (!fa.value || (!nota.value.trim() && !notaEstadoId.value)) return
  addingSeg.value = true
  try {
    const payload: PayloadSeguimiento = {}
    if (nota.value.trim()) payload.nota = nota.value.trim()
    if (notaEstadoId.value) payload.estado_nuevo_id = notaEstadoId.value
    await fallasService.crearSeguimiento(fa.value.id, payload)
    nota.value = ''
    notaEstadoId.value = null
    await refrescar()
    if (fa.value) emit('updated', fa.value)
    toast.success('Seguimiento agregado', { duration: 2000 })
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message, duration: 3000 })
  } finally {
    addingSeg.value = false
  }
}

async function resolver(): Promise<void> {
  const final = (props.catalogos.estados || []).find((e) => e.es_estado_final)
  if (!final) {
    toast.warning('Sin estado final configurado', { duration: 3000 })
    return
  }
  await cambiar({ estado_id: final.id, fecha_resolucion: new Date().toISOString() })
  toast.success('Falla resuelta', { duration: 2500 })
}

async function reabrir(): Promise<void> {
  const abierta =
    (props.catalogos.estados || []).find((e) => e.codigo === 'abierta') ||
    (props.catalogos.estados || []).find((e) => !e.es_estado_final)
  if (!abierta) return
  await cambiar({ estado_id: abierta.id, fecha_resolucion: null })
}
</script>

<style scoped>
/* safe-area inferior de la hoja */
.fd-sheet {
  padding-bottom: calc(0.875rem + env(safe-area-inset-bottom));
}

/* flecha del <select> nativo (appearance: none) */
.fd-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.875rem center;
}

/* transición de entrada/salida de la hoja */
.fdsheet-enter-active,
.fdsheet-leave-active {
  transition: opacity 0.2s ease;
}
.fdsheet-enter-active .fd-sheet,
.fdsheet-leave-active .fd-sheet {
  transition: transform 0.25s ease;
}
.fdsheet-enter-from,
.fdsheet-leave-to {
  opacity: 0;
}
.fdsheet-enter-from .fd-sheet,
.fdsheet-leave-to .fd-sheet {
  transform: translateY(100%);
}
</style>
