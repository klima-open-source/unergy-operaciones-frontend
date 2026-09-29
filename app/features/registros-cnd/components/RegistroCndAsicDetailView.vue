<script setup lang="ts">
/**
 * Proceso CND/ASIC de un proyecto: mapa de etapas, hitos, parámetros CREG 9.3,
 * equipos/documentos de frontera, alertas y borradores de correo.
 *
 * Al montar, `materializar()` crea el registro si el proyecto no tenía uno
 * (todos los hitos en pendiente) o simplemente lo trae si ya existe.
 */
import {
  ArrowLeftIcon,
  BoxIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  FlagIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TriangleAlertIcon,
  Trash2Icon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from '~/components/blocks/DataTable.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import { RegistrosCndService } from '~/features/registros-cnd/services/registros-cnd'
import type {
  CatalogosRegistroCnd,
  CorreoGenerado,
  DocumentoRegistroCnd,
  EquipoRegistroCnd,
  EtapaRegistroCnd,
  HitoRegistroCnd,
  ParametrosCreg93,
  RegistroCnd,
  ValidacionCreg93,
} from '~/features/registros-cnd/types'

const registrosCndService = new RegistrosCndService()
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const proyectoId = String(route.params.proyectoId)

const query = useQuery<RegistroCnd>()
const cat = ref<CatalogosRegistroCnd>({
  transiciones: {},
  tipos_equipo: [],
  tipos_documento: [],
  tipos_visita: [],
})
const params = ref<ParametrosCreg93>({})
const validacion = ref<ValidacionCreg93 | null>(null)
const equipos = ref<EquipoRegistroCnd[]>([])
const documentos = ref<DocumentoRegistroCnd[]>([])
const alertas = ref<RegistroCnd['alertas_pendientes']>([])

const transicionando = ref(false)
const guardandoParams = ref(false)
const guardandoGeneral = ref(false)
const recomputando = ref(false)

type ActiveTab = 'general' | 'hitos' | 'parametros' | 'frontera' | 'alertas' | 'correos'
const activeTab = ref<ActiveTab>('general')
const seleccionada = ref('ETAPA_1_CREG174_AMBITO')

// ── Mapa del proceso: posiciones fijas de cada etapa en el lienzo SVG ───────
interface NodoLayout {
  x: number
  y: number
  num: string
  label: string
}
const NODE_LAYOUT: Record<string, NodoLayout> = {
  ETAPA_1_CREG174_AMBITO: { x: 96, y: 96, num: '1', label: 'CREG 174 / Ámbito' },
  ETAPA_2_CARTAS_9_1_9_7: { x: 250, y: 96, num: '2', label: 'Cartas 9.1 / 9.7' },
  ETAPA_3_MDC: { x: 410, y: 96, num: '3', label: 'Aplicativo MDC' },
  ETAPA_4_MONTAJE_9_2: { x: 560, y: 96, num: '4', label: 'Carta 9.2' },
  ETAPA_5_REQ_9_3: { x: 700, y: 96, num: '5', label: 'Requisito 9.3' },
  ETAPA_8_REQ_9_4: { x: 860, y: 96, num: '8', label: 'Requisito 9.4' },
  ETAPA_6_FRONTERA: { x: 410, y: 250, num: '6', label: 'Equipos frontera' },
  ETAPA_7_REGISTRO_ASIC: { x: 620, y: 250, num: '7', label: 'Registro ASIC · FRT' },
}
const GOAL = { x: 980, y: 172 }

// ── Datos generales (pestaña "General") ─────────────────────────────────────
interface FormGeneral {
  numero_expediente: string
  id_requerimiento_or: string
  numero_solicitud_appweb: string
  fecha_conexion_estimada: string | null
  vigencia_aprobacion_conexion: string | null
  fecha_visita_protecciones: string | null
  tipo_visita_protecciones: string
  exporta: boolean
  comercializador_es_or: boolean
  punto_conexion_texto: string
  notas: string
}
function formGeneralVacio(): FormGeneral {
  return {
    numero_expediente: '',
    id_requerimiento_or: '',
    numero_solicitud_appweb: '',
    fecha_conexion_estimada: null,
    vigencia_aprobacion_conexion: null,
    fecha_visita_protecciones: null,
    tipo_visita_protecciones: '',
    exporta: false,
    comercializador_es_or: false,
    punto_conexion_texto: '',
    notas: '',
  }
}
const general = reactive<FormGeneral>(formGeneralVacio())

// Unión explícita en vez de `keyof ParametrosCreg93`: el índice `[clave: string]: unknown`
// de ese tipo hace que `keyof` colapse a `string` y `params[f.k]` resuelva a `unknown`.
type CampoCreg93 =
  | 'voltaje_max_kv'
  | 'voltaje_nominal_kv'
  | 'voltaje_min_kv'
  | 'in_eq_ka'
  | 'icc_subtrans_pico_kap'
  | 'icc_subtrans_3f_ka'
  | 'icc_subtrans_2f_ka'
  | 'icc_subtrans_1f_ka'
  | 'icc_estado_estable_ka'
  | 'impedancia_equivalente_ohm'
  | 'frecuencia_max_hz'
  | 'frecuencia_min_hz'

const campos93: Array<{ k: CampoCreg93; label: string }> = [
  { k: 'voltaje_max_kv', label: 'V máx (kV)' },
  { k: 'voltaje_nominal_kv', label: 'V nom (kV)' },
  { k: 'voltaje_min_kv', label: 'V mín (kV)' },
  { k: 'in_eq_ka', label: 'In eq (kA)' },
  { k: 'icc_subtrans_pico_kap', label: 'Icc pico (kAp)' },
  { k: 'icc_subtrans_3f_ka', label: 'Icc 3F (kA)' },
  { k: 'icc_subtrans_2f_ka', label: 'Icc 2F (kA)' },
  { k: 'icc_subtrans_1f_ka', label: 'Icc 1F (kA)' },
  { k: 'icc_estado_estable_ka', label: 'Icc EE (kA)' },
  { k: 'impedancia_equivalente_ohm', label: 'Z eq (Ω)' },
  { k: 'frecuencia_max_hz', label: 'Frec máx (Hz)' },
  { k: 'frecuencia_min_hz', label: 'Frec mín (Hz)' },
]

// ── Mapa: estado visual de cada etapa ───────────────────────────────────────
type EtapaStatus = 'completa' | 'progreso' | 'pendiente' | 'bloqueada'

const STATUS_CLASS: Record<EtapaStatus, { circle: string; text: string }> = {
  completa: { circle: 'fill-primary stroke-primary', text: 'fill-primary-foreground' },
  progreso: { circle: 'fill-card stroke-primary', text: 'fill-primary' },
  pendiente: { circle: 'fill-muted stroke-border', text: 'fill-muted-foreground' },
  bloqueada: {
    circle: 'fill-destructive/10 stroke-destructive',
    text: 'fill-destructive',
  },
}

const porEtapaMap = computed<Record<string, EtapaRegistroCnd>>(() => {
  const m: Record<string, EtapaRegistroCnd> = {}
  for (const e of query.data?.por_etapa ?? []) m[e.etapa] = e
  return m
})
const etapaActual = computed(() => query.data?.siguiente_paso?.etapa ?? null)
const etapaSel = computed(() => porEtapaMap.value[seleccionada.value] ?? null)
/** Etapas que el backend marcó como bloqueadas — banner de arriba del mapa. */
const etapasBloqueadas = computed(() => (query.data?.por_etapa ?? []).filter((e) => e.bloqueada))

const mapaNodos = computed(() =>
  Object.entries(NODE_LAYOUT).map(([etapa, pos]) => ({
    etapa,
    ...pos,
    status: statusEtapa(porEtapaMap.value[etapa]),
  })),
)

function statusEtapa(row?: EtapaRegistroCnd): EtapaStatus {
  if (!row) return 'pendiente'
  if (row.bloqueada || row.estado_actual === 'VENCIDO') return 'bloqueada'
  if (row.total_pct > 0 && row.ganado_pct >= row.total_pct) return 'completa'
  if (row.estado_actual && row.estado_actual !== 'NO_INICIADO') return 'progreso'
  return 'pendiente'
}

function estadoLabel(s?: string | null): string {
  if (!s) return '—'
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}
function sevColor(s?: string): GandalfBadgeColor {
  return (
    (
      {
        OK: 'success',
        ERROR: 'destructive',
        ADVERTENCIA: 'warning',
        PENDIENTE: 'default',
      } as Record<string, GandalfBadgeColor>
    )[s ?? ''] ?? 'default'
  )
}
function siguientesEstados(e: EtapaRegistroCnd): string[] {
  return cat.value.transiciones?.[e.etapa]?.[e.estado_actual ?? ''] ?? []
}
function hitosDeEtapa(etapa: string): HitoRegistroCnd[] {
  return (query.data?.hitos ?? []).filter((h) => h.etapa === etapa)
}
function seleccionar(etapa: string) {
  seleccionada.value = etapa
}

// ── Carga ────────────────────────────────────────────────────────────────
function setReg(data: RegistroCnd) {
  query.data = data
  alertas.value = data.alertas_pendientes ?? []
  Object.assign(general, formGeneralVacio(), {
    numero_expediente: data.numero_expediente ?? '',
    id_requerimiento_or: data.id_requerimiento_or ?? '',
    numero_solicitud_appweb: data.numero_solicitud_appweb ?? '',
    fecha_conexion_estimada: data.fecha_conexion_estimada ?? null,
    vigencia_aprobacion_conexion: data.vigencia_aprobacion_conexion ?? null,
    fecha_visita_protecciones: data.fecha_visita_protecciones ?? null,
    tipo_visita_protecciones: data.tipo_visita_protecciones ?? '',
    exporta: !!data.exporta,
    comercializador_es_or: !!data.comercializador_es_or,
    punto_conexion_texto: data.punto_conexion_texto ?? '',
    notas: data.notas ?? '',
  })
  // Por defecto se abre la etapa en curso; si ya había una elegida, se respeta.
  if (etapaActual.value && porEtapaMap.value[etapaActual.value]) {
    seleccionada.value = etapaActual.value
  }
}

async function cargarCatalogos() {
  cat.value = await registrosCndService.obtenerCatalogos()
}
async function cargarParams() {
  params.value = (await registrosCndService.obtenerParametros93(query.data!.id)) || {}
  await cargarValidacion()
}
async function cargarValidacion() {
  validacion.value = await registrosCndService.obtenerValidacion93(query.data!.id)
}
async function cargarEquipos() {
  equipos.value = await registrosCndService.listarEquipos(query.data!.id)
}
async function cargarDocumentos() {
  documentos.value = await registrosCndService.listarDocumentos(query.data!.id)
}

async function cargar() {
  await query.run(async () => {
    const data = await registrosCndService.materializarPorProyecto(proyectoId)
    setReg(data)
    await Promise.all([cargarCatalogos(), cargarParams(), cargarEquipos(), cargarDocumentos()])
    return data
  })
}

async function recargarReg() {
  setReg(await registrosCndService.obtener(query.data!.id))
}

// ── Acciones: datos generales ────────────────────────────────────────────
async function guardarGeneral() {
  guardandoGeneral.value = true
  try {
    const payload: Record<string, unknown> = { ...general }
    for (const [k, v] of Object.entries(payload)) if (v === '') payload[k] = null
    await registrosCndService.actualizar(query.data!.id, payload)
    await recargarReg()
    toast.success('Datos guardados', { duration: 2500 })
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message, duration: 6000 })
  } finally {
    guardandoGeneral.value = false
  }
}

// ── Acciones: transición de etapa ────────────────────────────────────────
async function hacerTransicion(etapa: string, aEstado: string) {
  transicionando.value = true
  try {
    const data = await registrosCndService.transicionar(query.data!.id, etapa, aEstado)
    const prevSel = seleccionada.value
    setReg(data)
    seleccionada.value = prevSel // mantener el foco en la etapa que se estaba tocando
    toast.success('Estado actualizado', { duration: 2500 })
  } catch (err) {
    toast.error('Transición no válida', {
      description: normalizeError(err).message,
      duration: 6000,
    })
  } finally {
    transicionando.value = false
  }
}

// ── Acciones: parámetros CREG 9.3 ────────────────────────────────────────
async function guardarParams() {
  guardandoParams.value = true
  try {
    const payload: ParametrosCreg93 = {}
    for (const f of campos93) {
      const v = params.value[f.k]
      if (v !== undefined && v !== null) payload[f.k] = v
    }
    await registrosCndService.guardarParametros93(query.data!.id, payload)
    await cargarValidacion()
    toast.success('Parámetros guardados', { duration: 2500 })
  } catch (err) {
    toast.error('No se pudo guardar', { description: normalizeError(err).message, duration: 6000 })
  } finally {
    guardandoParams.value = false
  }
}

// ── Acciones: alertas ─────────────────────────────────────────────────────
async function recomputar() {
  recomputando.value = true
  try {
    const data = await registrosCndService.recomputarAlertas(query.data!.id)
    alertas.value = data.alertas
    toast.success(`Alertas: ${data.alertas.length} (${data.creadas} nuevas)`, { duration: 3000 })
  } catch (err) {
    toast.error('Error al recomputar', { description: normalizeError(err).message, duration: 5000 })
  } finally {
    recomputando.value = false
  }
}

// ── Equipos de frontera ───────────────────────────────────────────────────
interface FormEquipo {
  tipo: string
  marca: string
  modelo: string
  serial: string
  fecha_vencimiento_calibracion: string | null
  fecha_solicitud_solenium: string | null
  fecha_envio_or: string | null
}
function formEquipoVacio(): FormEquipo {
  return {
    tipo: '',
    marca: '',
    modelo: '',
    serial: '',
    fecha_vencimiento_calibracion: null,
    fecha_solicitud_solenium: null,
    fecha_envio_or: null,
  }
}
const equipoDialog = ref(false)
const equipoForm = reactive<FormEquipo>(formEquipoVacio())

function abrirEquipo() {
  Object.assign(equipoForm, formEquipoVacio())
  equipoDialog.value = true
}
async function crearEquipo() {
  try {
    const payload = Object.fromEntries(
      Object.entries(equipoForm).filter(([, v]) => v !== '' && v != null),
    )
    await registrosCndService.crearEquipo(query.data!.id, payload)
    equipoDialog.value = false
    await cargarEquipos()
    toast.success('Equipo agregado', { duration: 2500 })
  } catch (err) {
    toast.error('No se pudo agregar', { description: normalizeError(err).message, duration: 5000 })
  }
}
function confirmarBorrarEquipo(row: EquipoRegistroCnd) {
  confirm({
    title: 'Eliminar equipo',
    description: `¿Eliminar el equipo "${row.tipo}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await registrosCndService.eliminarEquipo(query.data!.id, row.id)
        await cargarEquipos()
        toast.success('Equipo eliminado', { duration: 2500 })
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
      }
    },
  })
}
function asEquipo(row: DataTableRow): EquipoRegistroCnd {
  return row as unknown as EquipoRegistroCnd
}

// ── Documentos ────────────────────────────────────────────────────────────
interface FormDocumento {
  tipo: string
  radicado: string
  firmado_por: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  url_drive: string
  estado: string
}
function formDocumentoVacio(): FormDocumento {
  return {
    tipo: '',
    radicado: '',
    firmado_por: '',
    fecha_emision: null,
    fecha_vencimiento: null,
    url_drive: '',
    estado: 'BORRADOR',
  }
}
const docDialog = ref(false)
const docForm = reactive<FormDocumento>(formDocumentoVacio())
const docTipoOpciones = computed<ComboBoxOption[]>(() =>
  cat.value.tipos_documento.map((t) => ({ label: t, value: t })),
)

function abrirDoc() {
  Object.assign(docForm, formDocumentoVacio())
  docDialog.value = true
}
async function crearDoc() {
  try {
    const payload = Object.fromEntries(
      Object.entries(docForm).filter(([, v]) => v !== '' && v != null),
    )
    await registrosCndService.crearDocumento(query.data!.id, payload)
    docDialog.value = false
    await cargarDocumentos()
    toast.success('Documento agregado', { duration: 2500 })
  } catch (err) {
    toast.error('No se pudo agregar', { description: normalizeError(err).message, duration: 5000 })
  }
}
function confirmarBorrarDoc(row: DocumentoRegistroCnd) {
  confirm({
    title: 'Eliminar documento',
    description: `¿Eliminar el documento "${row.tipo}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await registrosCndService.eliminarDocumento(query.data!.id, row.id)
        await cargarDocumentos()
        toast.success('Documento eliminado', { duration: 2500 })
      } catch (err) {
        toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
      }
    },
  })
}
function asDocumento(row: DataTableRow): DocumentoRegistroCnd {
  return row as unknown as DocumentoRegistroCnd
}

// ── Correos ───────────────────────────────────────────────────────────────
const correoDialog = ref(false)
const correo = ref<CorreoGenerado | null>(null)
async function generarCorreo(tipo: string) {
  try {
    correo.value = await registrosCndService.generarCorreo(query.data!.id, tipo)
    correoDialog.value = true
  } catch (err) {
    toast.error('No se pudo generar', { description: normalizeError(err).message, duration: 5000 })
  }
}
async function copiarCorreo() {
  if (correo.value?.cuerpo) await navigator.clipboard?.writeText(correo.value.cuerpo)
  toast.success('Cuerpo copiado', { duration: 2000 })
}

// ── Tabla de hitos ────────────────────────────────────────────────────────
const columnasHitos: DataTableColumn[] = [
  { key: 'codigo', header: 'Hito', class: 'w-24' },
  { key: 'descripcion', header: 'Descripción' },
  { key: 'peso_pct', header: 'Peso', class: 'w-20' },
  { key: 'estado', header: 'Estado', class: 'w-32' },
]
function asHito(row: DataTableRow): HitoRegistroCnd {
  return row as unknown as HitoRegistroCnd
}

const columnasEquipos: DataTableColumn[] = [
  { key: 'tipo', header: 'Tipo' },
  { key: 'marca', header: 'Marca' },
  { key: 'modelo', header: 'Modelo' },
  { key: 'serial', header: 'Serial' },
  { key: 'fecha_vencimiento_calibracion', header: 'Venc. calibración' },
  { key: 'acciones', header: '', class: 'w-12' },
]
const columnasDocumentos: DataTableColumn[] = [
  { key: 'tipo', header: 'Tipo' },
  { key: 'radicado', header: 'Radicado' },
  { key: 'estado', header: 'Estado' },
  { key: 'firmado_por', header: 'Firmado por' },
  { key: 'acciones', header: '', class: 'w-20' },
]

onMounted(cargar)
</script>

<template>
  <AsyncView :query="query">
    <template #default="{ data: reg }">
      <div class="space-y-4">
        <!-- ── Header ──────────────────────────────────────────────────── -->
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" class="-ml-2" @click="router.back()">
            <ArrowLeftIcon class="size-4" />
          </Button>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-lg font-bold text-foreground">{{ reg.nombre_comercial }}</h1>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{
                [reg.codigo_cnd, reg.clasificacion_regulatoria, reg.tecnologia, reg.operador_red]
                  .filter(Boolean)
                  .join(' · ') || '—'
              }}
            </p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-primary">{{ reg.avance_pct }}%</div>
            <div class="text-xs text-muted-foreground">avance</div>
          </div>
        </div>

        <Progress :model-value="Math.min(100, reg.avance_pct)" class="h-2.5" />

        <!-- ── Mapa del proceso ──────────────────────────────────────────── -->
        <div class="rounded-xl border bg-card p-3.5 pb-4.5">
          <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-bold text-foreground">Mapa del proceso de conexión</span>
            <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1"
                ><i class="size-3 rounded-full bg-primary" />Completada</span
              >
              <span class="inline-flex items-center gap-1"
                ><i class="size-3 rounded-full border-2 border-primary bg-card" />En progreso</span
              >
              <span class="inline-flex items-center gap-1"
                ><i class="size-3 rounded-full border-2 border-border bg-muted" />Pendiente</span
              >
              <span class="inline-flex items-center gap-1"
                ><i
                  class="size-3 rounded-full border-2 border-destructive bg-destructive/10"
                />Bloqueada</span
              >
            </div>
          </div>

          <div class="overflow-x-auto">
            <svg
              viewBox="0 0 1040 320"
              class="block h-auto w-full min-w-220"
              preserveAspectRatio="xMidYMid meet"
            >
              <!-- lanes -->
              <text x="16" y="46" class="fill-muted-foreground text-xs font-bold tracking-widest">
                PROCESO PRINCIPAL
              </text>
              <text x="16" y="300" class="fill-success text-xs font-bold tracking-widest">
                FRONTERA · línea paralela
              </text>

              <!-- senderos (dibujados primero, los nodos los tapan) -->
              <g
                fill="none"
                class="stroke-primary/40"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray="1 12"
              >
                <path d="M96,96 L250,96 L410,96 L560,96 L700,96 L860,96" />
                <path d="M860,96 C925,96 955,135 980,164" />
                <path d="M96,120 C110,215 245,250 384,250" class="stroke-success/50" />
                <path d="M410,250 L620,250" class="stroke-success/50" />
                <path d="M646,250 C800,250 915,215 976,178" class="stroke-success/50" />
              </g>

              <text x="150" y="185" class="fill-success text-xs italic">
                se puede iniciar desde CREG 174 / 9.1
              </text>

              <!-- nodos de etapa -->
              <g
                v-for="n in mapaNodos"
                :key="n.etapa"
                class="cursor-pointer"
                @click="seleccionar(n.etapa)"
              >
                <circle
                  v-if="n.etapa === seleccionada"
                  :cx="n.x"
                  :cy="n.y"
                  r="34"
                  fill="none"
                  class="stroke-warning"
                  stroke-width="4"
                />
                <circle
                  v-if="n.etapa === etapaActual"
                  :cx="n.x"
                  :cy="n.y"
                  r="33"
                  fill="none"
                  class="animate-pulse stroke-primary"
                  stroke-width="3"
                />
                <circle
                  :cx="n.x"
                  :cy="n.y"
                  r="26"
                  :class="STATUS_CLASS[n.status].circle"
                  stroke-width="3"
                />
                <text
                  :x="n.x"
                  :y="n.y + 6"
                  text-anchor="middle"
                  class="text-lg font-extrabold"
                  :class="STATUS_CLASS[n.status].text"
                >
                  {{ n.num }}
                </text>
                <template v-if="n.status === 'completa'">
                  <circle
                    :cx="n.x + 18"
                    :cy="n.y - 18"
                    r="9"
                    class="fill-success"
                    stroke="var(--card)"
                    stroke-width="2"
                  />
                  <CheckIcon
                    :x="n.x + 18 - 6"
                    :y="n.y - 18 - 6"
                    :size="12"
                    class="stroke-white"
                    stroke-width="3"
                  />
                </template>
                <SunIcon
                  v-if="n.etapa === etapaActual"
                  :x="n.x - 9"
                  :y="n.y - 52"
                  :size="18"
                  class="fill-warning/20 stroke-warning"
                />
                <text
                  :x="n.x"
                  :y="n.y + (n.y > 150 ? 46 : -38)"
                  text-anchor="middle"
                  class="fill-muted-foreground text-xs font-semibold"
                >
                  {{ n.label }}
                </text>
              </g>

              <!-- meta: energización -->
              <g>
                <circle :cx="GOAL.x" :cy="GOAL.y" r="24" class="fill-foreground" />
                <FlagIcon :x="GOAL.x - 10" :y="GOAL.y - 10" :size="20" class="stroke-background" />
                <text
                  :x="GOAL.x"
                  :y="GOAL.y + 46"
                  text-anchor="middle"
                  class="fill-foreground text-xs font-bold"
                >
                  Energización
                </text>
              </g>
            </svg>
          </div>

          <!-- Panel de la etapa seleccionada -->
          <div v-if="etapaSel" class="mt-3.5 rounded-xl border bg-background p-3.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="text-sm font-bold text-foreground">{{ etapaSel.etiqueta }}</div>
                <div class="text-xs text-muted-foreground">
                  Estado:
                  <span class="font-semibold text-primary">{{
                    estadoLabel(etapaSel.estado_actual)
                  }}</span>
                  <span v-if="etapaSel.responsable_actual">
                    · resp: {{ etapaSel.responsable_actual }}</span
                  >
                  · {{ etapaSel.ganado_pct }}/{{ etapaSel.total_pct }}%
                </div>
              </div>
              <div class="flex gap-2">
                <Button
                  v-if="seleccionada === 'ETAPA_5_REQ_9_3'"
                  variant="ghost"
                  size="sm"
                  @click="activeTab = 'parametros'"
                >
                  <SlidersHorizontalIcon /> Editar parámetros 9.3
                </Button>
                <Button
                  v-if="
                    seleccionada === 'ETAPA_6_FRONTERA' || seleccionada === 'ETAPA_7_REGISTRO_ASIC'
                  "
                  variant="ghost"
                  size="sm"
                  @click="activeTab = 'frontera'"
                >
                  <BoxIcon /> Equipos y documentos
                </Button>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <span class="text-xs text-muted-foreground">Avanzar a:</span>
              <button
                v-for="s in siguientesEstados(etapaSel)"
                :key="s"
                type="button"
                class="rounded-full border px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-default disabled:opacity-50"
                :disabled="transicionando"
                @click="hacerTransicion(etapaSel.etapa, s)"
              >
                {{ estadoLabel(s) }}
              </button>
              <span
                v-if="!siguientesEstados(etapaSel).length"
                class="text-xs text-muted-foreground"
              >
                — sin transiciones disponibles
              </span>
            </div>

            <div class="mt-3">
              <div class="mb-1 text-xs font-semibold text-foreground">Hitos de esta etapa</div>
              <div
                v-for="h in hitosDeEtapa(seleccionada)"
                :key="h.hito"
                class="flex items-center gap-2 py-0.5 text-xs"
              >
                <span
                  class="font-mono font-semibold"
                  :class="h.completado ? 'text-success' : 'text-muted-foreground'"
                >
                  {{ h.completado ? '✓' : '○' }} {{ h.codigo }}
                </span>
                <span class="flex-1 text-foreground">{{ h.descripcion }}</span>
                <span class="font-semibold text-primary">{{ h.peso_pct }}%</span>
              </div>
              <div v-if="!hitosDeEtapa(seleccionada).length" class="text-xs text-muted-foreground">
                Sin hitos ponderados en esta etapa.
              </div>
            </div>
          </div>

          <Alert v-if="etapasBloqueadas.length" variant="destructive" class="mt-3">
            <TriangleAlertIcon />
            <AlertTitle>Etapas bloqueadas</AlertTitle>
            <AlertDescription>
              <span v-for="e in etapasBloqueadas" :key="e.etapa"
                >{{ e.etiqueta || e.etapa }};
              </span>
            </AlertDescription>
          </Alert>
        </div>

        <!-- ── Datos del proyecto ────────────────────────────────────────── -->
        <div class="rounded-xl border bg-card p-3.5">
          <GTabs :model-value="activeTab" @update:model-value="(v) => (activeTab = v as ActiveTab)">
            <GTabsList>
              <GTabsTrigger value="general">General</GTabsTrigger>
              <GTabsTrigger value="hitos">Hitos</GTabsTrigger>
              <GTabsTrigger value="parametros">Parámetros 9.3</GTabsTrigger>
              <GTabsTrigger value="frontera">Frontera y documentos</GTabsTrigger>
              <GTabsTrigger value="alertas">Alertas</GTabsTrigger>
              <GTabsTrigger value="correos">Correos</GTabsTrigger>
            </GTabsList>

            <!-- General -->
            <GTabsContent value="general" class="space-y-3 pt-1">
              <div class="grid gap-3 md:grid-cols-3">
                <div class="space-y-1.5">
                  <GLabel>N° expediente</GLabel>
                  <Input v-model="general.numero_expediente" />
                </div>
                <div class="space-y-1.5">
                  <GLabel>ID requerimiento OR</GLabel>
                  <Input v-model="general.id_requerimiento_or" />
                </div>
                <div class="space-y-1.5">
                  <GLabel>N° solicitud appweb</GLabel>
                  <Input v-model="general.numero_solicitud_appweb" />
                </div>
                <div class="space-y-1.5">
                  <GLabel>Fecha conexión estimada</GLabel>
                  <DatePicker v-model="general.fecha_conexion_estimada" clearable class="w-full" />
                </div>
                <div class="space-y-1.5">
                  <GLabel>Vigencia CREG 174 / ámbito</GLabel>
                  <DatePicker
                    v-model="general.vigencia_aprobacion_conexion"
                    clearable
                    class="w-full"
                  />
                </div>
                <div class="space-y-1.5">
                  <GLabel>Fecha visita protecciones</GLabel>
                  <DatePicker
                    v-model="general.fecha_visita_protecciones"
                    clearable
                    class="w-full"
                  />
                </div>
                <div class="space-y-1.5">
                  <GLabel>Tipo visita protecciones</GLabel>
                  <Select v-model="general.tipo_visita_protecciones">
                    <SelectTrigger class="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      <SelectItem v-for="t in cat.tipos_visita" :key="t" :value="t">{{
                        t
                      }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-1.5 md:col-span-2">
                  <GLabel>Punto de conexión (texto)</GLabel>
                  <Input v-model="general.punto_conexion_texto" />
                </div>
                <div class="space-y-1.5 md:col-span-3">
                  <GLabel>Notas</GLabel>
                  <Textarea v-model="general.notas" rows="2" />
                </div>
                <div class="flex gap-4 md:col-span-3">
                  <label class="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox v-model="general.exporta" /> Exporta energía
                  </label>
                  <label class="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox v-model="general.comercializador_es_or" /> Comercializador es el OR
                  </label>
                </div>
              </div>
              <Button size="sm" :disabled="guardandoGeneral" @click="guardarGeneral">
                <LoaderCircleIcon v-if="guardandoGeneral" class="animate-spin" />
                <SaveIcon v-else />
                Guardar datos generales
              </Button>
            </GTabsContent>

            <!-- Hitos -->
            <GTabsContent value="hitos" class="pt-1">
              <DataTable
                :columns="columnasHitos"
                :rows="reg.hitos as unknown as DataTableRow[]"
                row-key="hito"
              >
                <template #cell="{ row, column }">
                  <span
                    v-if="column.key === 'codigo'"
                    class="font-mono font-semibold text-foreground"
                  >
                    {{ asHito(row).completado ? '✓ ' : '' }}{{ asHito(row).codigo }}
                  </span>
                  <span v-else-if="column.key === 'descripcion'" class="text-foreground">{{
                    asHito(row).descripcion
                  }}</span>
                  <span v-else-if="column.key === 'peso_pct'">{{ asHito(row).peso_pct }}%</span>
                  <GBadge
                    v-else-if="column.key === 'estado'"
                    :color="asHito(row).completado ? 'success' : 'default'"
                  >
                    {{ asHito(row).completado ? 'Completado' : 'Pendiente' }}
                  </GBadge>
                </template>
              </DataTable>
            </GTabsContent>

            <!-- Parámetros 9.3 -->
            <GTabsContent value="parametros" class="pt-1">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <div class="mb-2 text-sm font-semibold text-foreground">Parámetros técnicos</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div v-for="f in campos93" :key="f.k" class="space-y-1">
                      <GLabel class="text-xs">{{ f.label }}</GLabel>
                      <NumberField v-model="params[f.k]">
                        <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                      </NumberField>
                    </div>
                  </div>
                  <Button size="sm" class="mt-3" :disabled="guardandoParams" @click="guardarParams">
                    <LoaderCircleIcon v-if="guardandoParams" class="animate-spin" />
                    <SaveIcon v-else />
                    Guardar parámetros
                  </Button>
                </div>
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <div class="text-sm font-semibold text-foreground">Validación</div>
                    <GBadge
                      v-if="validacion"
                      :color="
                        validacion.sin_parametros
                          ? 'default'
                          : validacion.valido
                            ? 'success'
                            : 'destructive'
                      "
                    >
                      {{
                        validacion.sin_parametros
                          ? 'sin datos'
                          : validacion.valido
                            ? 'sin errores'
                            : 'con errores'
                      }}
                    </GBadge>
                  </div>
                  <div v-if="validacion && validacion.resultados.length" class="space-y-1">
                    <div
                      v-for="(r, i) in validacion.resultados"
                      :key="i"
                      class="flex items-center justify-between rounded-lg bg-muted px-2 py-1 text-xs"
                    >
                      <span class="text-foreground">{{ r.regla }}</span>
                      <GBadge :color="sevColor(r.severidad)" :title="r.mensaje">{{
                        r.severidad
                      }}</GBadge>
                    </div>
                  </div>
                  <p v-else class="text-xs text-muted-foreground">
                    Guarda parámetros para ver la validación.
                  </p>
                </div>
              </div>
            </GTabsContent>

            <!-- Frontera y documentos -->
            <GTabsContent value="frontera" class="space-y-5 pt-1">
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <div class="text-sm font-semibold text-foreground">Equipos de frontera</div>
                  <Button variant="ghost" size="sm" @click="abrirEquipo">
                    <PlusIcon /> Agregar equipo
                  </Button>
                </div>
                <DataTable
                  :columns="columnasEquipos"
                  :rows="equipos as unknown as DataTableRow[]"
                  row-key="id"
                >
                  <template #empty>
                    <div class="py-4 text-center text-xs text-muted-foreground">Sin equipos.</div>
                  </template>
                  <template #cell="{ row, column }">
                    <span v-if="column.key !== 'acciones'">{{
                      (asEquipo(row)[column.key] as string | undefined) ?? '—'
                    }}</span>
                    <Button
                      v-else
                      variant="ghost"
                      size="icon-sm"
                      class="text-destructive hover:text-destructive"
                      @click="confirmarBorrarEquipo(asEquipo(row))"
                    >
                      <Trash2Icon />
                    </Button>
                  </template>
                </DataTable>
              </div>
              <div>
                <div class="mb-2 flex items-center justify-between">
                  <div class="text-sm font-semibold text-foreground">Documentos</div>
                  <Button variant="ghost" size="sm" @click="abrirDoc">
                    <PlusIcon /> Agregar documento
                  </Button>
                </div>
                <DataTable
                  :columns="columnasDocumentos"
                  :rows="documentos as unknown as DataTableRow[]"
                  row-key="id"
                >
                  <template #empty>
                    <div class="py-4 text-center text-xs text-muted-foreground">
                      Sin documentos.
                    </div>
                  </template>
                  <template #cell="{ row, column }">
                    <span v-if="column.key === 'tipo'">{{ asDocumento(row).tipo }}</span>
                    <span v-else-if="column.key === 'radicado'">{{
                      asDocumento(row).radicado ?? '—'
                    }}</span>
                    <span v-else-if="column.key === 'estado'">{{ asDocumento(row).estado }}</span>
                    <span v-else-if="column.key === 'firmado_por'">{{
                      asDocumento(row).firmado_por ?? '—'
                    }}</span>
                    <div v-else class="flex items-center justify-end gap-1">
                      <a
                        v-if="asDocumento(row).url_drive"
                        :href="asDocumento(row).url_drive"
                        target="_blank"
                        rel="noopener"
                      >
                        <ExternalLinkIcon class="size-4 text-primary" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-destructive hover:text-destructive"
                        @click="confirmarBorrarDoc(asDocumento(row))"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </template>
                </DataTable>
              </div>
            </GTabsContent>

            <!-- Alertas -->
            <GTabsContent value="alertas" class="pt-1">
              <div class="mb-2 flex items-center justify-between">
                <div class="text-sm font-semibold text-foreground">Alertas</div>
                <Button variant="outline" size="sm" :disabled="recomputando" @click="recomputar">
                  <LoaderCircleIcon v-if="recomputando" class="animate-spin" />
                  <RefreshCwIcon v-else />
                  Recomputar
                </Button>
              </div>
              <div v-if="alertas?.length" class="space-y-2">
                <div
                  v-for="(a, i) in alertas"
                  :key="i"
                  class="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3"
                >
                  <TriangleAlertIcon class="mt-0.5 size-4 shrink-0 text-warning" />
                  <div>
                    <p class="text-xs font-bold text-warning uppercase">{{ a.tipo }}</p>
                    <p class="text-sm text-foreground">{{ a.mensaje }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-muted-foreground">
                Sin alertas. Usa «Recomputar» para recalcular con las fechas actuales.
              </p>
            </GTabsContent>

            <!-- Correos -->
            <GTabsContent value="correos" class="space-y-2 pt-1">
              <div class="text-sm text-foreground">
                Genera un borrador de correo tipo (se rellena con los datos del proyecto):
              </div>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" @click="generarCorreo('SOLICITUD_FIRMAS_OR')">
                  Firmas al OR (9.1/9.7)
                </Button>
                <Button variant="outline" size="sm" @click="generarCorreo('CREACION_MDC_XM')">
                  Creación en MDC (XM)
                </Button>
                <Button variant="outline" size="sm" @click="generarCorreo('DOC_FRONTERA_SOLENIUM')">
                  Documentación (Solenium)
                </Button>
              </div>
            </GTabsContent>
          </GTabs>
        </div>
      </div>

      <!-- Dialogo equipo -->
      <Dialog v-model:open="equipoDialog">
        <DialogContent class="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo equipo de frontera</DialogTitle>
          </DialogHeader>
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2 space-y-1.5">
              <GLabel required>Tipo</GLabel>
              <Select v-model="equipoForm.tipo">
                <SelectTrigger class="w-full"><SelectValue placeholder="Tipo…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in cat.tipos_equipo" :key="t" :value="t">{{ t }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <GLabel>Marca</GLabel>
              <Input v-model="equipoForm.marca" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Modelo</GLabel>
              <Input v-model="equipoForm.modelo" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Serial</GLabel>
              <Input v-model="equipoForm.serial" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Venc. calibración</GLabel>
              <DatePicker
                v-model="equipoForm.fecha_vencimiento_calibracion"
                clearable
                class="w-full"
              />
            </div>
            <div class="space-y-1.5">
              <GLabel>Solicitud Solenium</GLabel>
              <DatePicker v-model="equipoForm.fecha_solicitud_solenium" clearable class="w-full" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Envío al OR</GLabel>
              <DatePicker v-model="equipoForm.fecha_envio_or" clearable class="w-full" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" @click="equipoDialog = false">Cancelar</Button>
            <Button :disabled="!equipoForm.tipo" @click="crearEquipo">Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Dialogo documento -->
      <Dialog v-model:open="docDialog">
        <DialogContent class="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo documento</DialogTitle>
          </DialogHeader>
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2 space-y-1.5">
              <GLabel required>Tipo</GLabel>
              <ComboBox v-model="docForm.tipo" :options="docTipoOpciones" placeholder="Tipo…" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Radicado</GLabel>
              <Input v-model="docForm.radicado" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Firmado por</GLabel>
              <Input v-model="docForm.firmado_por" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Emisión</GLabel>
              <DatePicker v-model="docForm.fecha_emision" clearable class="w-full" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Vencimiento</GLabel>
              <DatePicker v-model="docForm.fecha_vencimiento" clearable class="w-full" />
            </div>
            <div class="col-span-2 space-y-1.5">
              <GLabel>Enlace Drive</GLabel>
              <Input v-model="docForm.url_drive" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" @click="docDialog = false">Cancelar</Button>
            <Button :disabled="!docForm.tipo" @click="crearDoc">Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Dialogo correo -->
      <Dialog v-model:open="correoDialog">
        <DialogContent class="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Borrador de correo</DialogTitle>
          </DialogHeader>
          <div v-if="correo" class="space-y-2 text-sm">
            <div>
              <span class="text-xs font-semibold text-muted-foreground">Para:</span>
              {{ (correo.para ?? []).join(', ') || '—' }}
            </div>
            <div>
              <span class="text-xs font-semibold text-muted-foreground">CC:</span>
              {{ (correo.cc ?? []).join(', ') }}
            </div>
            <div>
              <span class="text-xs font-semibold text-muted-foreground">Asunto:</span>
              {{ correo.asunto }}
            </div>
            <div v-if="correo.adjuntos?.length">
              <span class="text-xs font-semibold text-muted-foreground">Adjuntos:</span>
              {{ correo.adjuntos.join('; ') }}
            </div>
            <Textarea :model-value="correo.cuerpo" rows="12" readonly />
          </div>
          <DialogFooter>
            <Button variant="ghost" @click="copiarCorreo"><CopyIcon /> Copiar cuerpo</Button>
            <Button @click="correoDialog = false">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </AsyncView>
</template>
