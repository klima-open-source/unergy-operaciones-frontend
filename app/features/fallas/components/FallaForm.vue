<script setup lang="ts">
/**
 * Alta / edición de una falla: identificación (clasificación jerárquica por
 * sistema afectado), descripción, análisis, resolución, nota inicial y
 * archivos adjuntos.
 *
 * No llama a la API para guardar: emite `save` con el payload y el padre
 * (`MonitoreoView.vue`, `FallaDetailView.vue`, `GestionFallasView.vue`) hace
 * el POST/PATCH — así el mismo formulario sirve para crear (varios proyectos
 * a la vez) y editar (uno solo).
 */
import type {
  CategoriaFalla,
  CatalogosFalla,
  Falla,
  PayloadFallaForm,
} from '~/features/fallas/types'
import type { InversorProyecto, ProyectoConDetalle } from '~/features/proyectos/types'
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import {
  AlignLeftIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  ImageIcon,
  InfoIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  TagIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { iconoCategoriaFalla } from '~/features/fallas/utils/fallaTitulo'
import { getEstructuraFallas } from '~/features/fallas/utils/fallasEstructuraCache'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { ProyectosService } from '~/features/proyectos/services/proyectos'

interface ClasificacionForm {
  categoria: string | null
  subtipo: string | null
  detalle: string
  afecta_medicion: boolean
  perdida_comunicacion: boolean
  inversores_ids: number[]
  inversores_tipos: string[]
}

type InversorConLabel = InversorProyecto & { _label: string }

const proyectosService = new ProyectosService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

const props = withDefaults(
  defineProps<{
    initial?: Falla | null
    catalogos: CatalogosFalla
    /** Pre-seleccionar proyectos al crear. */
    prefillProyectoIds?: number[]
    /** Si el padre ya los tiene cargados, se reusan (evita refetch cada vez que se abre el diálogo). */
    proyectos?: ProyectoConDetalle[]
  }>(),
  { initial: null, prefillProyectoIds: () => [], proyectos: () => [] },
)
const emit = defineEmits<{
  save: [payload: PayloadFallaForm]
  cancel: []
}>()

const proyectos = ref<ProyectoConDetalle[]>(props.proyectos)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
/** Archivos staged en el dropzone — solo al crear/editar, se suben tras guardar. */
const archivosStaged = ref<File[]>([])
const dropOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function iconoArchivo(file: File) {
  const name = file.name || ''
  if (/\.pdf$/i.test(name)) return FileTextIcon
  if (/\.(xls|xlsx|csv)$/i.test(name)) return FileSpreadsheetIcon
  if (/\.(doc|docx)$/i.test(name)) return FileTypeIcon
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name)) return ImageIcon
  return FileIcon
}
function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function addFiles(files: FileList | File[]) {
  for (const f of Array.from(files)) {
    if (!archivosStaged.value.find((x) => x.name === f.name && x.size === f.size)) {
      archivosStaged.value.push(f)
    }
  }
}
function onDrop(e: DragEvent) {
  dropOver.value = false
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}
function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

// Fecha + hora de identificación en un solo campo. Al crear se sugiere el momento actual.
const form = ref({
  proyecto_id: props.initial?.proyecto?.id ?? props.initial?.proyecto_id ?? null,
  proyecto_ids: [...(props.prefillProyectoIds ?? [])] as number[],
  tipo_id: props.initial?.tipo?.id ?? null,
  estado_id: props.initial?.estado?.id ?? null,
  prioridad_id: props.initial?.prioridad?.id ?? null,
  descripcion: props.initial?.descripcion ?? '',
  fecha_identificacion: props.initial
    ? combinaFechaHora(props.initial.fecha_identificacion, props.initial.hora_identificacion)
    : new Date(),
  fecha_ocurrencia: props.initial?.fecha_ocurrencia
    ? new Date(props.initial.fecha_ocurrencia)
    : (null as Date | null),
  fecha_resolucion: props.initial?.fecha_resolucion
    ? new Date(props.initial.fecha_resolucion)
    : (null as Date | null),
  resolucion_id: props.initial?.resolucion_id ?? null,
  sla_limite_horas: props.initial?.sla_limite_horas ?? null,
  causa_raiz: props.initial?.causa_raiz ?? '',
  acciones_correctivas: props.initial?.acciones_correctivas ?? '',
  nota_inicial: '',
  /** Fecha únicamente (sin hora): `blocks/DatePicker` ya trabaja en ISO `yyyy-mm-dd`. */
  fecha_programada: props.initial?.fecha_programada ?? (null as string | null),
  notificacion: false, // siempre OFF por defecto — el usuario lo activa explícitamente
})

// Detectar si el estado seleccionado es "programado"
const esEstadoProgramado = computed(() => {
  if (!form.value.estado_id) return false
  const estado = props.catalogos.estados?.find((e) => e.id === form.value.estado_id)
  return estado?.codigo === 'programado'
})

// Detectar si el estado seleccionado es final (falla cerrada/resuelta)
const esEstadoFinal = computed(() => {
  if (!form.value.estado_id) return false
  const estado = props.catalogos.estados?.find((e) => e.id === form.value.estado_id)
  return !!estado?.es_estado_final
})

// Auto-populate description when tipo changes (only if description is empty or matches a previous auto-fill)
let lastAutoDesc = ''
watch(
  () => form.value.tipo_id,
  (newId) => {
    if (!newId) return
    const tipo = (props.catalogos.tipos ?? []).find((t) => t.id === newId)
    if (!tipo?.descripcion) return
    // Only auto-fill if description is empty or was previously auto-filled
    const current = form.value.descripcion?.trim() ?? ''
    if (!current || current === lastAutoDesc) {
      form.value.descripcion = tipo.descripcion
      lastAutoDesc = tipo.descripcion
    }
  },
)

const tiposAgrupados = computed(() => {
  const groups: Record<string, { categoria: string; items: CatalogosFalla['tipos'] }> = {}
  for (const t of props.catalogos.tipos ?? []) {
    const cat = t.categoria?.etiqueta ?? 'General'
    if (!groups[cat]) groups[cat] = { categoria: cat, items: [] }
    groups[cat].items.push(t)
  }
  return Object.values(groups)
})

// ── Reporte estructurado (jerárquico por sistema) ───────────────────────────
const estructura = ref<CategoriaFalla[]>([]) // categorías canónicas desde GET /fallas/estructura
const cls = ref<ClasificacionForm>({
  categoria: props.initial?.categoria_codigo ?? null,
  subtipo: props.initial?.subtipo_codigo ?? null,
  detalle: props.initial?.subtipo_detalle ?? '',
  afecta_medicion: props.initial?.frontera_afecta_medicion ?? false,
  perdida_comunicacion: props.initial?.frontera_perdida_comunicacion ?? false,
  inversores_ids: (props.initial?.inversores_afectados ?? [])
    .map((i) => i.proyecto_inversor_id)
    .filter((id): id is number => id != null),
  inversores_tipos: [
    ...new Set((props.initial?.inversores_afectados ?? []).flatMap((i) => i.tipos ?? [])),
  ],
})

// Editar una falla legacy (sin categoría) usa el form viejo; crear o editar
// una falla estructurada usa la jerarquía nueva.
const usarEstructura = computed(() => !props.initial || !!props.initial?.categoria_codigo)
const catActual = computed(
  () => estructura.value.find((c) => c.codigo === cls.value.categoria) || null,
)
const opcionActual = computed(() => {
  if (!catActual.value || !cls.value.subtipo) return null
  return (catActual.value.opciones ?? []).find((o) => o.codigo === cls.value.subtipo) || null
})
const proyectoUnicoId = computed(() => {
  if (props.initial) return form.value.proyecto_id
  return form.value.proyecto_ids?.length === 1 ? (form.value.proyecto_ids[0] ?? null) : null
})
// Etiqueta del selector de opciones: la define la propia estructura
// (`opciones_label`) para categorías cuyas opciones no son "eventos"
// (p.ej. la verificación en sitio de "generando pero sin datos").
const labelOpciones = computed(
  () =>
    catActual.value?.opciones_label ||
    (catActual.value?.codigo === 'red' ? 'Evento de red' : 'Evento'),
)

function seleccionarCategoria(codigo: string) {
  if (cls.value.categoria === codigo) return
  cls.value.categoria = codigo
  cls.value.subtipo = null
  cls.value.detalle = ''
  cls.value.afecta_medicion = false
  cls.value.perdida_comunicacion = false
  cls.value.inversores_ids = []
  cls.value.inversores_tipos = []
}

// ── Opciones para los selectores buscables ──────────────────────────────────
const proyectoOpcionesUnico = computed<ComboBoxOption[]>(() =>
  proyectos.value.map((p) => ({ label: p.nombre_comercial, value: String(p.id) })),
)
const proyectoOpcionesMultiple = computed<ComboBoxOption[]>(() => proyectoOpcionesUnico.value)
const inversorTipoOpciones = computed<ComboBoxOption[]>(
  () =>
    catActual.value?.tipos_falla?.map((t) => ({
      label: t.etiqueta ?? t.codigo,
      value: t.codigo,
    })) ?? [],
)

/** `MultiComboBox` trabaja en `string[]`; `proyecto_ids`/`inversores_ids` son numéricos. */
const proyectoIdsStr = computed<string[]>({
  get: () => form.value.proyecto_ids.map(String),
  set: (v) => {
    form.value.proyecto_ids = v.map(Number)
  },
})
const inversoresIdsStr = computed<string[]>({
  get: () => cls.value.inversores_ids.map(String),
  set: (v) => {
    cls.value.inversores_ids = v.map(Number)
  },
})

// ── Inversores del proyecto (parametrizable) ────────────────────────────────
const inversoresProyecto = ref<InversorConLabel[]>([])
const cargandoInv = ref(false)
const gestionInversores = ref(false)
const nuevoInv = ref<{ nombre: string; potencia_nominal_kw: number | null }>({
  nombre: '',
  potencia_nominal_kw: null,
})
const invError = ref('')
const potenciaAc = ref<number | null>(null)

function labelInversor(inv: InversorProyecto): string {
  const kw = inv.potencia_nominal_kw != null ? `${inv.potencia_nominal_kw} kW` : 's/d'
  return `${inv.nombre || 'Inversor'} · ${kw}`
}
const inversorOpciones = computed<ComboBoxOption[]>(() =>
  inversoresProyecto.value.map((i) => ({ label: i._label, value: String(i.id) })),
)
const sumaInversores = computed(() =>
  inversoresProyecto.value.reduce((s, i) => s + (Number(i.potencia_nominal_kw) || 0), 0),
)
const sumaExcede = computed(
  () => potenciaAc.value != null && sumaInversores.value > potenciaAc.value + 0.001,
)

async function cargarInversores(pid: number | null) {
  if (!pid) {
    inversoresProyecto.value = []
    return
  }
  cargandoInv.value = true
  try {
    const data = await proyectosService.listarInversores(pid)
    inversoresProyecto.value = (data ?? []).map((i) => ({ ...i, _label: labelInversor(i) }))
    // potencia AC nominal del proyecto (para feedback de la regla de suma)
    try {
      const p = await proyectosService.obtener(pid)
      potenciaAc.value =
        p?.info_tecnica?.potencia_ac_kw != null ? Number(p.info_tecnica.potencia_ac_kw) : null
    } catch {
      potenciaAc.value = null
    }
  } catch (err) {
    logger.error('fallas.form', err)
    inversoresProyecto.value = []
  } finally {
    cargandoInv.value = false
  }
}

async function guardarInv(inv: InversorConLabel) {
  invError.value = ''
  if (!proyectoUnicoId.value) return
  try {
    const data = await proyectosService.actualizarInversor(proyectoUnicoId.value, inv.id, {
      nombre: inv.nombre,
      potencia_nominal_kw: inv.potencia_nominal_kw,
    })
    Object.assign(inv, data, { _label: labelInversor(data) })
  } catch (err) {
    invError.value = normalizeError(err).message || 'No se pudo guardar el inversor'
    await cargarInversores(proyectoUnicoId.value)
  }
}
async function agregarInv() {
  invError.value = ''
  if (!proyectoUnicoId.value) return
  if (!nuevoInv.value.nombre && nuevoInv.value.potencia_nominal_kw == null) return
  try {
    await proyectosService.crearInversor(proyectoUnicoId.value, {
      nombre: nuevoInv.value.nombre || null,
      potencia_nominal_kw: nuevoInv.value.potencia_nominal_kw,
      orden: inversoresProyecto.value.length,
    })
    nuevoInv.value = { nombre: '', potencia_nominal_kw: null }
    await cargarInversores(proyectoUnicoId.value)
  } catch (err) {
    invError.value = normalizeError(err).message || 'No se pudo agregar el inversor'
  }
}
async function eliminarInv(inv: InversorConLabel) {
  invError.value = ''
  if (!proyectoUnicoId.value) return
  try {
    await proyectosService.eliminarInversor(proyectoUnicoId.value, inv.id)
    cls.value.inversores_ids = cls.value.inversores_ids.filter((id) => id !== inv.id)
    await cargarInversores(proyectoUnicoId.value)
  } catch (err) {
    invError.value = normalizeError(err).message || 'No se pudo eliminar el inversor'
  }
}
// Config típica de minigranja (Baraya/San Pedro son excepciones → se ajustan a mano)
async function prefillMinigranja() {
  if (!proyectoUnicoId.value) return
  const tipica = [
    { nombre: 'Inversor 1', potencia_nominal_kw: 300 },
    { nombre: 'Inversor 2', potencia_nominal_kw: 300 },
    { nombre: 'Inversor 3', potencia_nominal_kw: 300 },
    { nombre: 'Inversor 4', potencia_nominal_kw: 50 },
    { nombre: 'Inversor 5', potencia_nominal_kw: 40 },
  ]
  invError.value = ''
  for (let i = 0; i < tipica.length; i++) {
    try {
      await proyectosService.crearInversor(proyectoUnicoId.value, { ...tipica[i], orden: i })
    } catch (err) {
      invError.value = normalizeError(err).message || 'No se pudieron crear todos los inversores'
      break
    }
  }
  await cargarInversores(proyectoUnicoId.value)
}

// Cargar inversores cuando se elige la categoría inversores y hay un único proyecto.
watch(
  [() => cls.value.categoria, proyectoUnicoId],
  ([cat, pid]) => {
    if (cat === 'inversores' && pid) cargarInversores(pid)
  },
  { immediate: true },
)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (props.initial) {
    if (!form.value.proyecto_id) e.proyecto_id = 'Requerido'
  } else {
    if (!form.value.proyecto_ids?.length) e.proyecto_ids = 'Selecciona al menos un proyecto'
  }
  if (usarEstructura.value) {
    // Clasificación jerárquica por sistema
    if (!cls.value.categoria) {
      e.categoria = 'Selecciona el sistema afectado'
    } else if (catActual.value?.tipo === 'inversores') {
      if (!props.initial && form.value.proyecto_ids?.length !== 1) {
        e.proyecto_ids = 'Para inversores selecciona un solo proyecto'
      }
      if (!cls.value.inversores_ids.length) e.inversores = 'Selecciona al menos un inversor'
      if (!cls.value.inversores_tipos.length) e.invtipos = 'Selecciona al menos un tipo de falla'
    } else {
      if (!cls.value.subtipo) e.subtipo = 'Requerido'
      if (opcionActual.value?.requiere_detalle && !cls.value.detalle?.trim())
        e.detalle = 'Requerido'
    }
  } else if (!form.value.tipo_id) {
    e.tipo_id = 'Requerido'
  }
  if (!form.value.estado_id) e.estado_id = 'Requerido'
  if (!form.value.prioridad_id) e.prioridad_id = 'Requerido'
  if (!form.value.descripcion?.trim()) e.descripcion = 'Requerido'
  if (!form.value.fecha_identificacion) e.fecha_identificacion = 'Requerido'
  if (esEstadoProgramado.value && !form.value.fecha_programada) {
    e.fecha_programada = 'Requerido cuando el estado es Programado'
  }
  if (esEstadoFinal.value && !form.value.fecha_resolucion) {
    e.fecha_resolucion = 'Obligatoria al cerrar la falla (fecha y hora)'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

// Date → "YYYY-MM-DD" usando componentes locales (no UTC, evita corrimiento de día).
function formatFechaLocal(d: Date | string | null): string | null {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Date (timeOnly) → "HH:MM" para enviar al backend
function formatHora(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Combina una fecha "YYYY-MM-DD" y una hora "HH:MM[:SS]" en un Date local.
// Se construye con componentes locales para no desfasar el día por zona horaria.
function combinaFechaHora(fecha: string | null | undefined, hora: string | null | undefined): Date {
  if (!fecha) return new Date()
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  let hh = 0
  let mm = 0
  if (hora) {
    const p = String(hora).split(':')
    hh = Number(p[0]) || 0
    mm = Number(p[1]) || 0
  }
  return new Date(y ?? 1970, (m || 1) - 1, d || 1, hh, mm, 0, 0)
}

// Formato local para <input type="datetime-local">: YYYY-MM-DDTHH:mm en hora del navegador.
function toDatetimeLocalValue(d: Date | null): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convierte horas decimales a un texto legible: "3 h 30 min", "1 d 4 h", "45 min"
function fmtDuracion(horas: number): string | null {
  if (horas == null || horas < 0) return null
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

// Tiempo de afectación calculado automáticamente: solución − ocurrencia.
// Si no se registró fecha de ocurrencia, usa la fecha/hora de identificación.
const tiempoAfectacionTexto = computed(() => {
  const fin = form.value.fecha_resolucion
  if (!fin) return null
  const inicio = form.value.fecha_ocurrencia || form.value.fecha_identificacion
  if (!inicio) return null
  const horas = (fin.getTime() - inicio.getTime()) / 3_600_000
  if (!Number.isFinite(horas) || horas < 0) return null
  return fmtDuracion(horas)
})

async function submit() {
  if (!validate()) return
  saving.value = true
  try {
    const base: PayloadFallaForm = {
      tipo_id: form.value.tipo_id,
      estado_id: form.value.estado_id,
      prioridad_id: form.value.prioridad_id,
      descripcion: form.value.descripcion,
      fecha_identificacion: formatFechaLocal(form.value.fecha_identificacion),
      // La hora se deriva del mismo campo combinado de identificación.
      hora_identificacion: formatHora(form.value.fecha_identificacion),
    }
    // Al editar se manda explícito (incluso null, para poder quitar una personalización
    // ya guardada) -- al crear el campo ni se muestra, así que no hay nada que mandar.
    if (props.initial) base.sla_limite_horas = form.value.sla_limite_horas || null
    if (form.value.fecha_ocurrencia)
      base.fecha_ocurrencia = form.value.fecha_ocurrencia.toISOString()
    // La fecha de solución solo aplica cuando el estado es final (cerrada).
    if (esEstadoFinal.value && form.value.fecha_resolucion) {
      base.fecha_resolucion = form.value.fecha_resolucion.toISOString()
    }
    if (esEstadoFinal.value && form.value.resolucion_id)
      base.resolucion_id = form.value.resolucion_id
    if (form.value.causa_raiz?.trim()) base.causa_raiz = form.value.causa_raiz.trim()
    if (form.value.acciones_correctivas?.trim())
      base.acciones_correctivas = form.value.acciones_correctivas.trim()
    if (form.value.nota_inicial?.trim()) base.nota_inicial = form.value.nota_inicial.trim()
    if (form.value.fecha_programada) base.fecha_programada = form.value.fecha_programada
    base.notificacion = !!form.value.notificacion

    // ── Clasificación estructurada ─────────────────────────────────────────
    let forzarProyectoUnico: number | null = null
    if (usarEstructura.value && cls.value.categoria) {
      base.categoria_codigo = cls.value.categoria
      const cat = catActual.value
      if (cat?.tipo === 'inversores') {
        // tipos compartidos aplicados a cada inversor seleccionado
        const tipos = [...cls.value.inversores_tipos]
        base.inversores = cls.value.inversores_ids.map((id) => {
          const inv = inversoresProyecto.value.find((x) => x.id === id)
          return {
            proyecto_inversor_id: id,
            nombre: inv?.nombre ?? null,
            potencia_kw: inv?.potencia_nominal_kw ?? null,
            tipos,
          }
        })
        base.tipo_id = null // el backend deriva el tipo
        forzarProyectoUnico = proyectoUnicoId.value
      } else {
        base.subtipo_codigo = cls.value.subtipo
        if (cls.value.detalle?.trim()) base.subtipo_detalle = cls.value.detalle.trim()
        if (cat?.tipo === 'equipo') {
          base.frontera_afecta_medicion = !!cls.value.afecta_medicion
          base.frontera_perdida_comunicacion = !!cls.value.perdida_comunicacion
        }
        base.tipo_id = null // el backend mapea subtipo → tipo
      }
    }

    if (props.initial) {
      emit('save', {
        ...base,
        proyecto_id: form.value.proyecto_id ?? undefined,
        _archivos: archivosStaged.value,
      })
    } else {
      // Para inversores se fuerza un único proyecto (los inversores le pertenecen).
      const ids = forzarProyectoUnico ? [forzarProyectoUnico] : form.value.proyecto_ids
      emit('save', { ...base, proyecto_ids: ids, _archivos: archivosStaged.value })
    }
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  // Si el padre ya cargó proyectos (ej. GestionFallasView), se reusan --
  // solo se pide aparte si no llegaron (uso del form fuera de esa vista).
  if (!proyectos.value.length) {
    try {
      // Solo las que pueden tener una falla: ver `cargarOperativos`.
      proyectos.value = await catalogoProyectos.cargarOperativos()
    } catch (err) {
      logger.error('fallas.form', err)
    }
  }
  estructura.value = await getEstructuraFallas()
})
</script>

<template>
  <form class="flex flex-col" @submit.prevent="submit">
    <!-- ── SECCIÓN: Identificación ──────────────────────────── -->
    <div class="border-b py-3.5 first:pt-0">
      <div
        class="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase"
      >
        <TagIcon class="size-3.5" /> Identificación
      </div>
      <div class="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <!-- Al crear: selección múltiple (varios proyectos → una falla por cada uno) -->
        <div v-if="!initial" class="col-span-2 flex flex-col gap-1">
          <GLabel required
            >Proyecto(s)
            <span class="font-normal text-muted-foreground"
              >(selecciona varios para crear una falla por cada uno)</span
            ></GLabel
          >
          <MultiComboBox
            v-model="proyectoIdsStr"
            :options="proyectoOpcionesMultiple"
            placeholder="Seleccionar proyecto(s)"
          />
          <p v-if="errors.proyecto_ids" class="text-xs text-destructive">
            {{ errors.proyecto_ids }}
          </p>
        </div>
        <!-- Al editar: selección simple -->
        <div v-else class="col-span-2 flex flex-col gap-1">
          <GLabel required>Proyecto</GLabel>
          <ComboBox
            :model-value="form.proyecto_id != null ? String(form.proyecto_id) : null"
            :options="proyectoOpcionesUnico"
            placeholder="Seleccionar proyecto"
            @update:model-value="(v) => (form.proyecto_id = v ? Number(v) : null)"
          />
          <p v-if="errors.proyecto_id" class="text-xs text-destructive">{{ errors.proyecto_id }}</p>
        </div>

        <!-- ── Clasificación jerárquica por sistema afectado (fallas nuevas) ── -->
        <div v-if="usarEstructura" class="col-span-2 rounded-xl border bg-muted/30 p-3">
          <GLabel required>Sistema afectado</GLabel>
          <div class="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="c in estructura"
              :key="c.codigo"
              type="button"
              class="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-1.5 py-3 text-xs font-semibold text-foreground transition-all hover:border-primary/40"
              :class="
                cls.categoria === c.codigo && 'border-primary bg-primary/5 ring-2 ring-primary/20'
              "
              @click="seleccionarCategoria(c.codigo)"
            >
              <component
                :is="iconoCategoriaFalla(c.codigo)"
                class="size-4.5 text-(--c)"
                :style="{ '--c': c.color_hex }"
              />
              <span>{{ c.etiqueta }}</span>
            </button>
          </div>
          <p v-if="errors.categoria" class="mt-1 text-xs text-destructive">
            {{ errors.categoria }}
          </p>

          <!-- RED / EVENTOS ADVERSOS: opción única -->
          <div v-if="catActual && catActual.tipo === 'opcion'" class="mt-3">
            <GLabel required>{{ labelOpciones }}</GLabel>
            <Select v-model="cls.subtipo">
              <SelectTrigger class="mt-1 w-full"
                ><SelectValue placeholder="Seleccionar…"
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="o in catActual.opciones" :key="o.codigo" :value="o.codigo">{{
                  o.etiqueta
                }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.subtipo" class="mt-1 text-xs text-destructive">{{ errors.subtipo }}</p>
            <div
              v-if="opcionActual?.pendiente_reclasificar"
              class="mt-2.5 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning"
            >
              <ClockIcon class="size-3.5 shrink-0" /> Quedará
              <strong>pendiente de reclasificar</strong> hasta conocer la causa definitiva.
            </div>
            <div v-if="opcionActual?.requiere_detalle" class="mt-2.5 flex flex-col gap-1">
              <GLabel required>{{ opcionActual.detalle_label || 'Detalle' }}</GLabel>
              <Textarea
                v-model="cls.detalle"
                rows="2"
                placeholder="Describe el motivo específico…"
              />
              <p v-if="errors.detalle" class="text-xs text-destructive">{{ errors.detalle }}</p>
            </div>
          </div>

          <!-- FRONTERA: equipo + flags -->
          <div v-else-if="catActual && catActual.tipo === 'equipo'" class="mt-3">
            <GLabel required>Equipo de frontera</GLabel>
            <Select v-model="cls.subtipo">
              <SelectTrigger class="mt-1 w-full"
                ><SelectValue placeholder="Seleccionar equipo…"
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="o in catActual.opciones" :key="o.codigo" :value="o.codigo">{{
                  o.etiqueta
                }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.subtipo" class="mt-1 text-xs text-destructive">{{ errors.subtipo }}</p>
            <div class="mt-2.5 flex flex-col gap-2">
              <label class="flex items-center gap-2 text-xs text-foreground">
                <Checkbox v-model="cls.afecta_medicion" /> Afecta la medición de la frontera
              </label>
              <label class="flex items-center gap-2 text-xs text-foreground">
                <Checkbox v-model="cls.perdida_comunicacion" /> Pérdida de comunicación (datos) de
                la frontera
              </label>
            </div>
            <div
              v-if="cls.perdida_comunicacion"
              class="mt-2.5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground"
            >
              <BellIcon class="size-3.5 shrink-0 text-primary/60" /> Generará una alarma de
              comunicaciones de frontera.
            </div>
          </div>

          <!-- INVERSORES: selección múltiple + tipos + gestión parametrizable -->
          <div v-else-if="catActual && catActual.tipo === 'inversores'" class="mt-3">
            <div
              v-if="!proyectoUnicoId"
              class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning"
            >
              <InfoIcon class="size-3.5 shrink-0" /> Para reportar inversores selecciona
              <strong>un solo proyecto</strong> arriba.
            </div>
            <template v-else>
              <div class="flex items-center justify-between">
                <GLabel required>Inversores afectados</GLabel>
                <button
                  type="button"
                  class="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  @click="gestionInversores = !gestionInversores"
                >
                  <SettingsIcon class="size-3.5" />
                  {{ gestionInversores ? 'Cerrar gestión' : 'Gestionar inversores' }}
                </button>
              </div>
              <p v-if="cargandoInv" class="text-xs text-muted-foreground">Cargando inversores…</p>
              <div
                v-else-if="!inversoresProyecto.length && !gestionInversores"
                class="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning"
              >
                Este proyecto no tiene inversores configurados.
                <button
                  type="button"
                  class="font-semibold underline"
                  @click="gestionInversores = true"
                >
                  Configurar
                </button>
              </div>
              <MultiComboBox
                v-else-if="inversoresProyecto.length"
                v-model="inversoresIdsStr"
                :options="inversorOpciones"
                placeholder="Seleccionar inversor(es)"
              />
              <p v-if="errors.inversores" class="text-xs text-destructive">
                {{ errors.inversores }}
              </p>

              <!-- gestión parametrizable de inversores del proyecto -->
              <div v-if="gestionInversores" class="mt-2.5 rounded-lg border bg-card p-2.5">
                <div
                  class="mb-2 flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    >Potencia AC:
                    <strong>{{ potenciaAc != null ? `${potenciaAc} kW` : 'sin definir' }}</strong> ·
                    Suma inversores:
                    <strong :class="sumaExcede && 'text-destructive'"
                      >{{ sumaInversores }} kW</strong
                    ></span
                  >
                  <button
                    v-if="!inversoresProyecto.length"
                    type="button"
                    class="font-semibold text-primary hover:underline"
                    @click="prefillMinigranja"
                  >
                    Usar config típica minigranja
                  </button>
                </div>
                <div
                  v-for="inv in inversoresProyecto"
                  :key="inv.id"
                  class="mb-1.5 flex items-center gap-2"
                >
                  <Input
                    v-model="inv.nombre"
                    placeholder="Nombre"
                    class="flex-1"
                    @blur="guardarInv(inv)"
                  />
                  <NumberField v-model="inv.potencia_nominal_kw" :min="0" class="w-28">
                    <NumberFieldContent
                      ><NumberFieldInput placeholder="kW" @blur="guardarInv(inv)"
                    /></NumberFieldContent>
                  </NumberField>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-destructive"
                    @click="eliminarInv(inv)"
                  >
                    <Trash2Icon class="size-4" />
                  </Button>
                </div>
                <div class="mt-1.5 flex items-center gap-2 border-t border-dashed pt-2">
                  <Input
                    v-model="nuevoInv.nombre"
                    placeholder="Nombre nuevo inversor"
                    class="flex-1"
                  />
                  <NumberField v-model="nuevoInv.potencia_nominal_kw" :min="0" class="w-28">
                    <NumberFieldContent><NumberFieldInput placeholder="kW" /></NumberFieldContent>
                  </NumberField>
                  <Button variant="outline" size="icon-sm" @click="agregarInv">
                    <PlusIcon class="size-4" />
                  </Button>
                </div>
                <p v-if="invError" class="mt-1 text-xs text-destructive">{{ invError }}</p>
              </div>

              <div class="mt-2.5 flex flex-col gap-1">
                <GLabel required>Tipo(s) de falla</GLabel>
                <MultiComboBox
                  v-model="cls.inversores_tipos"
                  :options="inversorTipoOpciones"
                  placeholder="Seleccionar tipo(s)"
                />
                <p v-if="errors.invtipos" class="text-xs text-destructive">{{ errors.invtipos }}</p>
                <div
                  v-if="cls.inversores_tipos.includes('perdida_comunicacion')"
                  class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground"
                >
                  <BellIcon class="size-3.5 shrink-0 text-primary/60" /> Generará una alarma de
                  comunicaciones de inversores.
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Tipo de falla LEGACY (solo edición de fallas viejas sin categoría) -->
        <div v-else class="flex flex-col gap-1">
          <GLabel required>Tipo de falla</GLabel>
          <Select
            :model-value="form.tipo_id != null ? String(form.tipo_id) : undefined"
            @update:model-value="(v) => (form.tipo_id = v ? Number(v) : null)"
          >
            <SelectTrigger class="w-full"
              ><SelectValue placeholder="Seleccionar tipo"
            /></SelectTrigger>
            <SelectContent>
              <SelectGroup v-for="grupo in tiposAgrupados" :key="grupo.categoria">
                <SelectLabel>{{ grupo.categoria }}</SelectLabel>
                <SelectItem v-for="t in grupo.items" :key="t.id" :value="String(t.id)">{{
                  t.etiqueta
                }}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p v-if="errors.tipo_id" class="text-xs text-destructive">{{ errors.tipo_id }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <GLabel required>Prioridad</GLabel>
          <Select
            :model-value="form.prioridad_id != null ? String(form.prioridad_id) : undefined"
            @update:model-value="(v) => (form.prioridad_id = v ? Number(v) : null)"
          >
            <SelectTrigger class="w-full"
              ><SelectValue placeholder="Seleccionar prioridad"
            /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in catalogos.prioridades" :key="p.id" :value="String(p.id)">{{
                p.etiqueta
              }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.prioridad_id" class="text-xs text-destructive">
            {{ errors.prioridad_id }}
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <GLabel required>Estado</GLabel>
          <Select
            :model-value="form.estado_id != null ? String(form.estado_id) : undefined"
            @update:model-value="(v) => (form.estado_id = v ? Number(v) : null)"
          >
            <SelectTrigger class="w-full"
              ><SelectValue placeholder="Seleccionar estado"
            /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="e in catalogos.estados" :key="e.id" :value="String(e.id)">{{
                e.etiqueta
              }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.estado_id" class="text-xs text-destructive">{{ errors.estado_id }}</p>
        </div>

        <!-- Límite SLA personalizado — solo al editar, caso puntual que se sale del default de su prioridad -->
        <div v-if="initial" class="col-span-2 flex flex-col gap-1">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <GLabel
              >Límite SLA personalizado
              <span class="font-normal text-muted-foreground">(horas)</span></GLabel
            >
            <span v-if="!form.sla_limite_horas" class="text-xs text-muted-foreground">
              Por defecto para esta prioridad:
              <strong class="text-foreground">{{ initial?.sla_limite_horas_efectivo }}h</strong>
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <NumberField v-model="form.sla_limite_horas" :min="1" :max="999" class="flex-1">
              <NumberFieldContent
                ><NumberFieldInput placeholder="Sin personalizar"
              /></NumberFieldContent>
            </NumberField>
            <Button
              v-if="form.sla_limite_horas"
              variant="outline"
              size="icon"
              title="Quitar personalización"
              @click="form.sla_limite_horas = null"
            >
              <XIcon class="size-4" />
            </Button>
          </div>
          <span class="text-xs text-muted-foreground">
            Opcional. Déjalo vacío para usar el límite automático de la prioridad — solo llénalo si
            este caso puntual necesita más o menos tiempo.
          </span>
        </div>

        <div class="flex flex-col gap-1">
          <GLabel required
            >Fecha y hora de identificación
            <span class="font-normal text-muted-foreground"
              >(sugerida: momento actual)</span
            ></GLabel
          >
          <Input
            type="datetime-local"
            :model-value="toDatetimeLocalValue(form.fecha_identificacion)"
            @update:model-value="
              (v) => (form.fecha_identificacion = v ? new Date(String(v)) : new Date())
            "
          />
          <p v-if="errors.fecha_identificacion" class="text-xs text-destructive">
            {{ errors.fecha_identificacion }}
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <GLabel
            >Fecha y hora ocurrencia
            <span class="font-normal text-muted-foreground"
              >(inicio de la afectación; si difiere de la identificación)</span
            ></GLabel
          >
          <Input
            type="datetime-local"
            :model-value="toDatetimeLocalValue(form.fecha_ocurrencia)"
            @update:model-value="(v) => (form.fecha_ocurrencia = v ? new Date(String(v)) : null)"
          />
        </div>

        <!-- Fecha programada — solo visible cuando el estado es "programado" -->
        <div
          v-if="esEstadoProgramado"
          class="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-2.5"
        >
          <GLabel required>
            <CalendarIcon class="size-3.5 text-primary" /> Fecha programada
            <span class="font-normal text-muted-foreground"
              >(fecha de intervención planificada)</span
            >
          </GLabel>
          <DatePicker v-model="form.fecha_programada" />
          <p v-if="errors.fecha_programada" class="text-xs text-destructive">
            {{ errors.fecha_programada }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── SECCIÓN: Descripción ─────────────────────────────── -->
    <div class="border-b py-3.5">
      <div
        class="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase"
      >
        <AlignLeftIcon class="size-3.5" /> Descripción del evento
      </div>
      <div class="flex flex-col gap-1">
        <GLabel required>Descripción</GLabel>
        <Textarea
          v-model="form.descripcion"
          rows="3"
          placeholder="Describe la falla, síntomas observados, impacto en la operación..."
        />
        <p v-if="errors.descripcion" class="text-xs text-destructive">{{ errors.descripcion }}</p>
      </div>
    </div>

    <!-- ── SECCIÓN: Análisis ────────────────────────────────── -->
    <div class="border-b py-3.5">
      <div
        class="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase"
      >
        <SearchIcon class="size-3.5" /> Análisis
      </div>
      <div class="grid grid-cols-1 gap-2.5">
        <div class="flex flex-col gap-1">
          <GLabel>Causa raíz</GLabel>
          <Textarea
            v-model="form.causa_raiz"
            rows="2"
            placeholder="Descripción de la causa raíz identificada..."
          />
        </div>
        <div class="flex flex-col gap-1">
          <GLabel>Acciones correctivas</GLabel>
          <Textarea
            v-model="form.acciones_correctivas"
            rows="2"
            placeholder="Acciones correctivas tomadas o planeadas..."
          />
        </div>
      </div>
    </div>

    <!-- ── SECCIÓN: Resolución (solo cuando el estado es final/cerrada) ── -->
    <div
      v-if="esEstadoFinal"
      class="mb-1 rounded-lg border border-success/30 bg-success/5 px-3.5 py-3"
    >
      <div
        class="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase"
      >
        <CircleCheckIcon class="size-3.5 text-success" /> Resolución
        <span class="font-normal text-destructive normal-case"
          >(obligatoria al cerrar la falla)</span
        >
      </div>
      <div class="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <div class="flex flex-col gap-1">
          <GLabel required
            >Fecha y hora de solución
            <span class="font-normal text-muted-foreground">(fin de la afectación)</span></GLabel
          >
          <Input
            type="datetime-local"
            :model-value="toDatetimeLocalValue(form.fecha_resolucion)"
            @update:model-value="(v) => (form.fecha_resolucion = v ? new Date(String(v)) : null)"
          />
          <p v-if="errors.fecha_resolucion" class="text-xs text-destructive">
            {{ errors.fecha_resolucion }}
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <GLabel>Tipo de solución</GLabel>
          <ButtonGroup>
            <Select
              :model-value="form.resolucion_id != null ? String(form.resolucion_id) : undefined"
              @update:model-value="(v) => (form.resolucion_id = v ? Number(v) : null)"
            >
              <SelectTrigger class="w-full"
                ><SelectValue placeholder="Seleccionar tipo"
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="r in catalogos.resoluciones" :key="r.id" :value="String(r.id)">{{
                  r.etiqueta
                }}</SelectItem>
              </SelectContent>
            </Select>
            <Button v-if="form.resolucion_id" variant="outline" @click="form.resolucion_id = null">
              <XIcon class="size-4" />
            </Button>
          </ButtonGroup>
        </div>

        <!-- Tiempo de afectación calculado automáticamente -->
        <div
          v-if="tiempoAfectacionTexto"
          class="col-span-2 flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success"
        >
          <ClockIcon class="size-3.5" />
          <span
            >Tiempo de afectación: <strong>{{ tiempoAfectacionTexto }}</strong></span
          >
          <span class="text-muted-foreground">(solución − ocurrencia, automático)</span>
        </div>
      </div>
    </div>

    <!-- ── SECCIÓN: Nota inicial (solo al crear) ────────────── -->
    <div v-if="!initial" class="border-b py-3.5">
      <div
        class="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase"
      >
        <MessageSquareIcon class="size-3.5" /> Nota inicial
      </div>
      <div class="flex flex-col gap-1">
        <GLabel
          >Nota
          <span class="font-normal text-muted-foreground"
            >(crea el primer seguimiento automáticamente)</span
          ></GLabel
        >
        <Textarea
          v-model="form.nota_inicial"
          rows="2"
          placeholder="Ej: Se identificó durante monitoreo remoto..."
        />
      </div>
    </div>

    <!-- ── SECCIÓN: Archivos adjuntos ─────── -->
    <div class="border-b py-3.5">
      <div
        class="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-muted-foreground uppercase"
      >
        <PaperclipIcon class="size-3.5" /> Archivos adjuntos
      </div>
      <div
        class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-primary/25 p-4 text-center transition-colors hover:border-primary hover:bg-primary/5"
        :class="dropOver && 'border-primary bg-primary/5'"
        @dragover.prevent="dropOver = true"
        @dragleave.prevent="dropOver = false"
        @drop.prevent="onDrop"
        @click="fileInputRef?.click()"
      >
        <UploadIcon class="size-4.5 text-primary/60" />
        <span class="text-xs text-foreground"
          >Arrastra archivos aquí o <span class="font-semibold text-primary">haz clic</span></span
        >
        <span class="text-xs text-muted-foreground">Imágenes, PDF, Excel, Word, CSV</span>
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          accept="*"
          multiple
          @change="onFileInputChange"
        />
      </div>
      <div v-if="archivosStaged.length" class="mt-2 flex flex-col gap-1">
        <div
          v-for="(f, i) in archivosStaged"
          :key="i"
          class="flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1 text-xs"
        >
          <component :is="iconoArchivo(f)" class="size-3.5 text-primary" />
          <span class="min-w-0 flex-1 truncate text-foreground">{{ f.name }}</span>
          <span class="whitespace-nowrap text-muted-foreground">{{ formatSize(f.size) }}</span>
          <button
            type="button"
            class="px-0.5 text-destructive opacity-70 hover:opacity-100"
            @click="archivosStaged.splice(i, 1)"
          >
            <XIcon class="size-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Notificación por correo ── -->
    <div class="mt-1 flex flex-col gap-1 rounded-lg border bg-muted/30 px-3.5 py-2.5">
      <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
        <Checkbox v-model="form.notificacion" />
        <SendIcon class="size-3.5 text-primary" />
        <span>Enviar notificación por correo a los contactos operacionales del proyecto</span>
      </label>
      <span v-if="form.notificacion" class="ml-6 text-xs leading-relaxed text-muted-foreground">
        Se enviará a los contactos tipo "Operacional" del cliente (o del proyecto, si tiene uno
        propio) — configúralos en la ficha del Cliente o del Proyecto, tab Contactos.
      </span>
    </div>

    <div class="mt-1 flex justify-end gap-2 border-t pt-3">
      <Button type="button" variant="secondary" @click="emit('cancel')">Cancelar</Button>
      <Button type="submit" :disabled="saving">
        <CheckIcon class="size-4" />
        {{ initial ? 'Guardar cambios' : 'Registrar falla' }}
      </Button>
    </div>
  </form>
</template>
