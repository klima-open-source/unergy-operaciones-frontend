<template>
  <Teleport to="body">
    <Transition name="fsheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end bg-unergy-deep/45"
        @click.self="close"
      >
        <div
          class="fc-sheet flex max-h-11/12 w-full flex-col rounded-t-3xl bg-card px-4.5 pt-2.5 shadow-lg"
        >
          <div class="mx-auto mt-1 mb-3 h-1 w-10 rounded-full bg-border" />
          <div class="mb-3 flex items-center">
            <span class="flex flex-1 items-center gap-1.5 text-base font-bold text-unergy-deep"
              ><CirclePlusIcon class="size-4 text-unergy-purple" /> Registrar falla</span
            >
            <button class="p-1 text-muted-foreground" @click="close">
              <XIcon class="size-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <!-- Proyecto -->
            <label :class="LABEL"
              >Proyecto <span class="text-destructive">*</span>
              <select v-model="f.proyecto_id" :class="[controlClass(err.proyecto_id), 'pr-10']">
                <option :value="null" disabled>Selecciona un proyecto…</option>
                <option v-for="p in proyectos" :key="p.id" :value="p.id">
                  {{ p.nombre_comercial }}
                </option>
              </select>
            </label>

            <!-- Sistema afectado -->
            <div class="mb-3.5">
              <span class="text-xs font-semibold text-muted-foreground"
                >Sistema afectado <span class="text-destructive">*</span></span
              >
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="c in estructura"
                  :key="c.codigo"
                  type="button"
                  :class="[CHIP, f.categoria === c.codigo ? CHIP_ACTIVO : CHIP_IDLE]"
                  :style="{ '--c': c.color_hex || 'var(--color-unergy-purple)' }"
                  @click="seleccionarCategoria(c.codigo)"
                >
                  <component :is="iconoCategoriaFalla(c.codigo)" class="size-3" />
                  {{ c.etiqueta }}
                </button>
              </div>
              <small v-if="err.categoria" class="mt-1 block text-xs text-destructive"
                >Selecciona el sistema</small
              >
            </div>

            <!-- RED / EVENTOS: opción única -->
            <template v-if="catActual && catActual.tipo === 'opcion'">
              <label :class="LABEL"
                >{{ labelOpciones }} <span class="text-destructive">*</span>
                <select v-model="f.subtipo" :class="[controlClass(err.subtipo), 'pr-10']">
                  <option :value="null" disabled>Selecciona…</option>
                  <option v-for="o in catActual.opciones" :key="o.codigo" :value="o.codigo">
                    {{ o.etiqueta }}
                  </option>
                </select>
              </label>
              <div v-if="opcionActual?.pendiente_reclasificar" :class="[BANNER, BANNER_WARN]">
                Quedará <strong>pendiente de reclasificar</strong> hasta conocer la causa.
              </div>
              <label v-if="opcionActual?.requiere_detalle" :class="LABEL">
                {{ opcionActual.detalle_label || 'Detalle' }}
                <span class="text-destructive">*</span>
                <textarea
                  v-model="f.detalle"
                  rows="2"
                  :class="[controlClass(err.detalle), 'resize-none']"
                  placeholder="Describe el motivo específico…"
                ></textarea>
              </label>
            </template>

            <!-- FRONTERA: equipo + flags -->
            <template v-else-if="catActual && catActual.tipo === 'equipo'">
              <label :class="LABEL"
                >Equipo de frontera <span class="text-destructive">*</span>
                <select v-model="f.subtipo" :class="[controlClass(err.subtipo), 'pr-10']">
                  <option :value="null" disabled>Selecciona equipo…</option>
                  <option v-for="o in catActual.opciones" :key="o.codigo" :value="o.codigo">
                    {{ o.etiqueta }}
                  </option>
                </select>
              </label>
              <label class="mt-2.5 flex items-center gap-2 text-sm text-foreground"
                ><input
                  v-model="f.afecta_medicion"
                  type="checkbox"
                  class="size-4.5 accent-unergy-purple"
                />
                Afecta la medición de la frontera</label
              >
              <label class="mt-2.5 flex items-center gap-2 text-sm text-foreground"
                ><input
                  v-model="f.perdida_comunicacion"
                  type="checkbox"
                  class="size-4.5 accent-unergy-purple"
                />
                Pérdida de comunicación de la frontera</label
              >
              <div v-if="f.perdida_comunicacion" :class="[BANNER, BANNER_INFO]">
                Generará alarma de comunicaciones de frontera.
              </div>
            </template>

            <!-- INVERSORES -->
            <template v-else-if="catActual && catActual.tipo === 'inversores'">
              <div v-if="!f.proyecto_id" :class="[BANNER, BANNER_WARN]">
                Selecciona primero el proyecto.
              </div>
              <template v-else>
                <span class="text-xs font-semibold text-muted-foreground"
                  >Inversores afectados <span class="text-destructive">*</span></span
                >
                <div v-if="cargandoInv" class="my-1.5 text-xs text-muted-foreground">Cargando…</div>
                <div v-else-if="!inversores.length" :class="[BANNER, BANNER_WARN]">
                  Sin inversores configurados.
                  <button
                    type="button"
                    class="ml-1 text-xs font-bold text-unergy-purple"
                    @click="prefillMinigranja"
                  >
                    Crear config típica minigranja
                  </button>
                </div>
                <div v-else class="mt-2 flex flex-wrap gap-2">
                  <button
                    v-for="inv in inversores"
                    :key="inv.id"
                    type="button"
                    :class="[
                      CHIP,
                      f.inversores_ids.includes(inv.id) ? CHIP_ACTIVO_PURPURA : CHIP_IDLE,
                    ]"
                    @click="toggleInv(inv.id)"
                  >
                    {{ inv.nombre || 'Inversor' }} · {{ inv.potencia_nominal_kw || '?' }}kW
                  </button>
                </div>
                <small v-if="err.inversores" class="mt-1 block text-xs text-destructive"
                  >Selecciona al menos un inversor</small
                >

                <!-- mini-agregar inversor -->
                <div v-if="inversores.length" class="mt-2 flex gap-2">
                  <input
                    v-model="nuevoInv.nombre"
                    :class="[CONTROL, CONTROL_OK, 'flex-1']"
                    placeholder="Nuevo inversor"
                  />
                  <input
                    v-model.number="nuevoInv.potencia_nominal_kw"
                    type="number"
                    :class="[CONTROL, CONTROL_OK, 'w-22']"
                    placeholder="kW"
                  />
                  <button
                    type="button"
                    class="w-11.5 shrink-0 rounded-xl bg-unergy-purple text-white"
                    @click="agregarInv"
                  >
                    <PlusIcon class="size-3" />
                  </button>
                </div>
                <small v-if="invError" class="mt-1 block text-xs text-destructive">{{
                  invError
                }}</small>

                <span class="mt-2 block text-xs font-semibold text-muted-foreground"
                  >Tipo(s) de falla <span class="text-destructive">*</span></span
                >
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    v-for="t in catActual.tipos_falla"
                    :key="t.codigo"
                    type="button"
                    :class="[
                      CHIP,
                      f.inversores_tipos.includes(t.codigo) ? CHIP_ACTIVO_PURPURA : CHIP_IDLE,
                    ]"
                    @click="toggleTipo(t.codigo)"
                  >
                    {{ t.etiqueta }}
                  </button>
                </div>
                <small v-if="err.invtipos" class="mt-1 block text-xs text-destructive"
                  >Selecciona al menos un tipo</small
                >
                <div
                  v-if="f.inversores_tipos.includes('perdida_comunicacion')"
                  :class="[BANNER, BANNER_INFO]"
                >
                  Generará alarma de comunicaciones de inversores.
                </div>
              </template>
            </template>

            <!-- Prioridad -->
            <div class="mb-3.5">
              <span class="text-xs font-semibold text-muted-foreground"
                >Prioridad <span class="text-destructive">*</span></span
              >
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="p in catalogos.prioridades"
                  :key="p.id"
                  type="button"
                  :class="[CHIP, f.prioridad_id === p.id ? CHIP_ACTIVO : CHIP_IDLE]"
                  :style="{ '--c': colorPrioridad(p.codigo) }"
                  @click="f.prioridad_id = p.id"
                >
                  {{ p.etiqueta }}
                </button>
              </div>
            </div>

            <!-- Estado -->
            <div class="mb-3.5">
              <span class="text-xs font-semibold text-muted-foreground"
                >Estado <span class="text-destructive">*</span></span
              >
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="e in catalogos.estados"
                  :key="e.id"
                  type="button"
                  :class="[CHIP, f.estado_id === e.id ? CHIP_ACTIVO : CHIP_IDLE]"
                  :style="{ '--c': colorEstado(e.codigo) }"
                  @click="f.estado_id = e.id"
                >
                  {{ e.etiqueta }}
                </button>
              </div>
            </div>

            <!-- Descripción -->
            <label :class="LABEL"
              >Descripción <span class="text-destructive">*</span>
              <textarea
                v-model="f.descripcion"
                rows="3"
                :class="[controlClass(err.descripcion), 'resize-none']"
                placeholder="¿Qué está pasando?"
              ></textarea>
            </label>

            <!-- Fecha -->
            <label :class="LABEL"
              >Fecha de identificación <span class="text-destructive">*</span>
              <input v-model="f.fecha_identificacion" type="date" :class="controlClass()" />
            </label>

            <!-- La hora arranca el reloj del SLA. Sin ella el backend lo ancla a
                 las 00:00 del dia, y una falla critica (SLA 8 h) reportada por la
                 mañana nace vencida. El formulario web siempre la manda; este
                 sheet no la capturaba. Arranca con la hora actual de Colombia. -->
            <label :class="LABEL"
              >Hora de identificación
              <input v-model="f.hora_identificacion" type="time" :class="controlClass()" />
            </label>

            <!-- Nota opcional -->
            <label :class="LABEL"
              >Nota inicial (opcional)
              <textarea
                v-model="f.nota"
                rows="2"
                :class="[controlClass(), 'resize-none']"
                placeholder="Detalle / observación…"
              ></textarea>
            </label>

            <div
              v-if="error"
              class="my-1 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlertIcon class="size-4" /> {{ error }}
            </div>
          </div>

          <button
            class="mt-2.5 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-unergy-purple p-4 text-base font-bold text-white disabled:opacity-50"
            :disabled="saving"
            @click="submit"
          >
            <LoaderCircleIcon class="size-4 animate-spin" v-if="saving" /><CheckIcon
              class="size-4"
              v-else
            />
            {{ saving ? 'Registrando…' : 'Registrar falla' }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  CheckIcon,
  CirclePlusIcon,
  LoaderCircleIcon,
  PlusIcon,
  TriangleAlertIcon,
  XIcon,
} from '@lucide/vue'
import type { CategoriaFalla, CatalogosFalla, Falla, PayloadFalla } from '~/features/fallas/types'
import type { InversorProyecto } from '~/features/proyectos/types'
import { colorEstado, colorPrioridad } from '~/features/fallas/utils/colores'
import { iconoCategoriaFalla } from '~/features/fallas/utils/fallaTitulo'
import { FallasService } from '~/features/fallas/services/fallas'
import { normalizeError } from '~/core/errors'
import { ProyectosService } from '~/features/proyectos/services/proyectos'

const fallasService = new FallasService()
const proyectosService = new ProyectosService()

/** El mínimo que necesita este sheet de un proyecto: reusa lo que le llegue de `ProyectoConDetalle` o de un resumen propio. */
interface ProyectoOpcionFalla {
  id: number
  nombre_comercial: string
}

const props = withDefaults(
  defineProps<{
    open?: boolean
    catalogos?: CatalogosFalla
    proyectos?: ProyectoOpcionFalla[]
    prefillProyectoId?: number | string | null
  }>(),
  {
    open: false,
    catalogos: () => ({ estados: [], prioridades: [], tipos: [], resoluciones: [] }),
    proyectos: () => [],
    prefillProyectoId: null,
  },
)
const emit = defineEmits<{ close: []; created: [falla: Falla] }>()

interface FormularioFalla {
  proyecto_id: number | null
  categoria: string | null
  subtipo: string | null
  detalle: string
  afecta_medicion: boolean
  perdida_comunicacion: boolean
  inversores_ids: number[]
  inversores_tipos: string[]
  prioridad_id: number | null
  estado_id: number | null
  descripcion: string
  fecha_identificacion: string
  hora_identificacion: string
  nota: string
}

const f = reactive<FormularioFalla>({
  proyecto_id: null,
  categoria: null,
  subtipo: null,
  detalle: '',
  afecta_medicion: false,
  perdida_comunicacion: false,
  inversores_ids: [],
  inversores_tipos: [],
  prioridad_id: null,
  estado_id: null,
  descripcion: '',
  fecha_identificacion: '',
  hora_identificacion: '',
  nota: '',
})
const err = ref<Record<string, boolean>>({})
const error = ref('')
const saving = ref(false)

const estructura = ref<CategoriaFalla[]>([])
const inversores = ref<InversorProyecto[]>([])
const cargandoInv = ref(false)
const nuevoInv = reactive<{ nombre: string; potencia_nominal_kw: number | null }>({
  nombre: '',
  potencia_nominal_kw: null,
})
const invError = ref('')

const catActual = computed(() => estructura.value.find((c) => c.codigo === f.categoria) || null)
const opcionActual = computed(() => {
  if (!catActual.value || !f.subtipo) return null
  return (catActual.value.opciones ?? []).find((o) => o.codigo === f.subtipo) || null
})
// La estructura puede nombrar su propio selector (`opciones_label`) cuando las
// opciones no son "eventos" (p.ej. verificación en sitio).
const labelOpciones = computed(
  () =>
    catActual.value?.opciones_label ||
    (catActual.value?.codigo === 'red' ? 'Evento de red' : 'Evento'),
)

// Chip activo: el color llega por la variable `--c` del propio botón.
const CHIP = 'flex items-center gap-1 rounded-xl border-2 px-3.5 py-2 text-sm font-semibold'
const CHIP_IDLE = 'border-border bg-card text-muted-foreground'
const CHIP_ACTIVO = 'border-(--c) bg-(--c) text-white'
const CHIP_ACTIVO_PURPURA = 'border-unergy-purple bg-unergy-purple text-white'

const LABEL = 'mb-3.5 block text-xs font-semibold text-muted-foreground'
const CONTROL =
  'w-full rounded-xl border-2 bg-card px-3.5 py-3 text-base text-unergy-deep focus:outline-none'
const CONTROL_OK = 'border-border focus:border-unergy-purple'
const CONTROL_ERR = 'border-destructive'
const BANNER = 'mt-2.5 rounded-lg border px-2.5 py-2 text-xs'
const BANNER_WARN = 'border-warning/30 bg-warning/10 text-warning'
const BANNER_INFO = 'border-chart-2/30 bg-chart-2/10 text-chart-3'

function controlClass(invalid = false): string[] {
  return ['mt-1.5', CONTROL, invalid ? CONTROL_ERR : CONTROL_OK]
}

function seleccionarCategoria(codigo: string): void {
  f.categoria = codigo
  f.subtipo = null
  f.detalle = ''
  f.afecta_medicion = false
  f.perdida_comunicacion = false
  f.inversores_ids = []
  f.inversores_tipos = []
  if (codigo === 'inversores' && f.proyecto_id) cargarInversores()
}
function toggleInv(id: number): void {
  const i = f.inversores_ids.indexOf(id)
  if (i >= 0) f.inversores_ids.splice(i, 1)
  else f.inversores_ids.push(id)
}
function toggleTipo(codigo: string): void {
  const i = f.inversores_tipos.indexOf(codigo)
  if (i >= 0) f.inversores_tipos.splice(i, 1)
  else f.inversores_tipos.push(codigo)
}

async function cargarInversores(): Promise<void> {
  if (!f.proyecto_id) {
    inversores.value = []
    return
  }
  cargandoInv.value = true
  try {
    const data = await proyectosService.listarInversores(f.proyecto_id)
    inversores.value = data ?? []
  } catch {
    inversores.value = []
  } finally {
    cargandoInv.value = false
  }
}
async function agregarInv(): Promise<void> {
  invError.value = ''
  if (!f.proyecto_id || (!nuevoInv.nombre && nuevoInv.potencia_nominal_kw == null)) return
  try {
    await proyectosService.crearInversor(f.proyecto_id, {
      nombre: nuevoInv.nombre || null,
      potencia_nominal_kw: nuevoInv.potencia_nominal_kw,
      orden: inversores.value.length,
    })
    nuevoInv.nombre = ''
    nuevoInv.potencia_nominal_kw = null
    await cargarInversores()
  } catch (e) {
    invError.value = normalizeError(e).message || 'No se pudo agregar'
  }
}
async function prefillMinigranja(): Promise<void> {
  invError.value = ''
  if (!f.proyecto_id) return
  const tipica: [string, number][] = [
    ['Inversor 1', 300],
    ['Inversor 2', 300],
    ['Inversor 3', 300],
    ['Inversor 4', 50],
    ['Inversor 5', 40],
  ]
  for (let i = 0; i < tipica.length; i++) {
    try {
      await proyectosService.crearInversor(f.proyecto_id, {
        nombre: tipica[i]![0],
        potencia_nominal_kw: tipica[i]![1],
        orden: i,
      })
    } catch (e) {
      invError.value = normalizeError(e).message || 'Error creando inversores'
      break
    }
  }
  await cargarInversores()
}

// recargar inversores al cambiar de proyecto si la categoría es inversores
watch(
  () => f.proyecto_id,
  () => {
    if (f.categoria === 'inversores') cargarInversores()
  },
)

// Al abrir: limpiar + defaults + cargar estructura
watch(
  () => props.open,
  async (o) => {
    if (!o) return
    // Un solo corrimiento a UTC-5 para las dos: Colombia no tiene horario de verano.
    const ahoraCol = new Date(Date.now() - 5 * 3600 * 1000).toISOString()
    const today = ahoraCol.slice(0, 10)
    const horaCol = ahoraCol.slice(11, 16)
    Object.assign(f, {
      proyecto_id: props.prefillProyectoId != null ? Number(props.prefillProyectoId) : null,
      categoria: null,
      subtipo: null,
      detalle: '',
      afecta_medicion: false,
      perdida_comunicacion: false,
      inversores_ids: [],
      inversores_tipos: [],
      prioridad_id: null,
      estado_id: null,
      descripcion: '',
      fecha_identificacion: today,
      hora_identificacion: horaCol,
      nota: '',
    })
    err.value = {}
    error.value = ''
    invError.value = ''
    inversores.value = []
    const abierta =
      (props.catalogos.estados || []).find((e) => e.codigo === 'abierta') ||
      (props.catalogos.estados || []).find((e) => !e.es_estado_final)
    if (abierta) f.estado_id = abierta.id
    const media = (props.catalogos.prioridades || []).find((p) => p.codigo === 'media')
    if (media) f.prioridad_id = media.id
    if (!estructura.value.length) {
      try {
        estructura.value = await fallasService.obtenerEstructura()
      } catch {
        /* */
      }
    }
  },
)

function validate(): boolean {
  const errores: Record<string, boolean> = {}
  if (!f.proyecto_id) errores.proyecto_id = true
  if (!f.categoria) errores.categoria = true
  else if (catActual.value?.tipo === 'inversores') {
    if (!f.inversores_ids.length) errores.inversores = true
    if (!f.inversores_tipos.length) errores.invtipos = true
  } else {
    if (!f.subtipo) errores.subtipo = true
    if (opcionActual.value?.requiere_detalle && !f.detalle.trim()) errores.detalle = true
  }
  if (!f.prioridad_id) errores.prioridad = true
  if (!f.estado_id) errores.estado = true
  if (!f.descripcion.trim()) errores.descripcion = true
  err.value = errores
  return Object.keys(errores).length === 0
}

function close(): void {
  emit('close')
}

async function submit(): Promise<void> {
  error.value = ''
  if (!validate()) {
    error.value = 'Completa los campos obligatorios (*)'
    return
  }
  saving.value = true
  try {
    // `hora_identificacion` acepta explícitamente `null` (no solo `undefined`):
    // el backend cae a las 00:00 solo si el campo llega así, no con ''.
    const payload: PayloadFalla & { hora_identificacion?: string | null } = {
      proyecto_id: f.proyecto_id!,
      estado_id: f.estado_id,
      prioridad_id: f.prioridad_id,
      descripcion: f.descripcion.trim(),
      fecha_identificacion: f.fecha_identificacion,
      hora_identificacion: f.hora_identificacion || null,
      categoria_codigo: f.categoria,
      notificacion: false,
    }
    const cat = catActual.value
    if (cat?.tipo === 'inversores') {
      const tipos = [...f.inversores_tipos]
      payload.inversores = f.inversores_ids.map((id) => {
        const inv = inversores.value.find((x) => x.id === id)
        return {
          proyecto_inversor_id: id,
          nombre: inv?.nombre ?? null,
          potencia_kw: inv?.potencia_nominal_kw ?? null,
          tipos,
        }
      })
    } else {
      payload.subtipo_codigo = f.subtipo
      if (f.detalle.trim()) payload.subtipo_detalle = f.detalle.trim()
      if (cat?.tipo === 'equipo') {
        payload.frontera_afecta_medicion = !!f.afecta_medicion
        payload.frontera_perdida_comunicacion = !!f.perdida_comunicacion
      }
    }

    const nueva = await fallasService.crear(payload)
    if (f.nota.trim()) {
      try {
        await fallasService.crearSeguimiento(nueva.id, { nota: f.nota.trim() })
      } catch {
        /* no crítico */
      }
    }
    emit('created', nueva)
    emit('close')
  } catch (e) {
    error.value = normalizeError(e).message || 'No se pudo registrar la falla'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* safe-area del dispositivo: env() no tiene utilidad */
.fc-sheet {
  padding-bottom: calc(0.875rem + env(safe-area-inset-bottom));
}

.fsheet-enter-active,
.fsheet-leave-active {
  transition: opacity 0.2s ease;
}
.fsheet-enter-active .fc-sheet,
.fsheet-leave-active .fc-sheet {
  transition: transform 0.25s ease;
}
.fsheet-enter-from,
.fsheet-leave-to {
  opacity: 0;
}
.fsheet-enter-from .fc-sheet,
.fsheet-leave-to .fc-sheet {
  transform: translateY(100%);
}
</style>
