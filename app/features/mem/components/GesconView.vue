<script setup lang="ts">
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type {
  BackfillNombreResuelto,
  BackfillTerminacionResuelta,
  ContratoPpa,
  PayloadAsic,
  RegistroAsic,
  RespuestaBackfillAsic,
} from '~/features/contratos/types'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import {
  CheckIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  FlagIcon,
  HistoryIcon,
  InfoIcon,
  LinkIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
  WandSparklesIcon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
// Imports explícitos: el auto-import de Nuxt sintetiza mal los tipos de props de
// `DataTable` y `DatePicker` (mismo problema que en el resto de slices migrados).
import ComboBox from '~/components/blocks/ComboBox.vue'
import DataTable from '~/components/blocks/DataTable.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import { PpaService } from '~/features/contratos/services/ppa'
import GesconModificacionForm from '~/features/mem/components/GesconModificacionForm.vue'
import GesconTerminacionForm from '~/features/mem/components/GesconTerminacionForm.vue'
import { conflictosAtribucion } from '~/features/mem/utils/validacionContratos'

const ppaService = new PpaService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion: ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()
const confirm = useConfirm()

// ── Tabla ─────────────────────────────────────────────────────────────────
const loading = ref(false)
const rows = ref<RegistroAsic[]>([])
const filtroTexto = ref('')
const filtroEstado = ref<'vigentes' | 'todos'>('vigentes')
const filtroTipo = ref('')
const filtroMes = ref('')
const filtroAnio = ref('')
const pagina = ref(1)
const filasPorPagina = 50
const hoy = new Date().toISOString().slice(0, 10)

const opcionesTipo = [
  { label: 'Registro', value: 'registro' },
  { label: 'Modificación', value: 'modificacion' },
  { label: 'Terminación', value: 'terminacion' },
  { label: 'Desistimiento', value: 'desistimiento' },
]

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const opcionesMes = MESES.map((label, i) => ({ label, value: String(i + 1) }))

const opcionesAnio = computed(() => {
  const seen = new Set<number>()
  for (const x of rows.value) {
    if (x.fecha_inicio) seen.add(Number(String(x.fecha_inicio).slice(0, 4)))
    if (x.fecha_fin) seen.add(Number(String(x.fecha_fin).slice(0, 4)))
  }
  return [...seen].sort((a, b) => b - a).map((v) => ({ label: String(v), value: String(v) }))
})

// Fin EFECTIVO de la fila: si un relevo/modificación posterior en su SIC la
// superó, el backend manda fecha_fin_efectiva (< fecha_fin cruda). Una fila
// superada NO está vigente aunque su fecha registrada diga 2039 — caso real:
// SIC 89116, la fila vieja de La Reserva tras la modificación que cambió la
// planta. Fallback a la cruda si el backend aún no manda el campo.
function finEfectivo(x: RegistroAsic): string | null {
  return (x.fecha_fin_efectiva as string | null) || (x.fecha_fin ?? null)
}
function finRecortado(x: RegistroAsic): boolean {
  return !!(
    x.fecha_fin_efectiva &&
    x.fecha_fin &&
    (x.fecha_fin_efectiva as string) < (x.fecha_fin as string)
  )
}

const filtradas = computed(() => {
  let r = rows.value.slice()
  if (filtroEstado.value === 'vigentes')
    r = r.filter((x) => finEfectivo(x) && finEfectivo(x)! >= hoy)
  if (filtroTipo.value) r = r.filter((x) => x.tipo_solicitud === filtroTipo.value)
  if (filtroMes.value || filtroAnio.value) {
    // Vigencia en el mes/año elegido, no fecha_inicio exacta: si solo se
    // elige año, cubre el año completo; si solo se elige mes, usa el año
    // actual. Igual criterio de "vigente" que el filtro Estado (requiere
    // finEfectivo, ver comentario en esa función).
    const anio = filtroAnio.value ? Number(filtroAnio.value) : new Date().getFullYear()
    const mesDesde = filtroMes.value ? Number(filtroMes.value) : 1
    const mesHasta = filtroMes.value ? Number(filtroMes.value) : 12
    const desde = `${anio}-${String(mesDesde).padStart(2, '0')}-01`
    const ultimoDia = new Date(anio, mesHasta, 0).getDate()
    const hasta = `${anio}-${String(mesHasta).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    r = r.filter((x) => {
      const fin = finEfectivo(x)
      return !!fin && (x.fecha_inicio as string) <= hasta && fin >= desde
    })
  }
  const q = filtroTexto.value.trim().toLowerCase()
  if (q) {
    r = r.filter(
      (x) =>
        String(x.codigo_sic_contrato || '')
          .toLowerCase()
          .includes(q) ||
        String(x.contrato_interno || '')
          .toLowerCase()
          .includes(q) ||
        String(x.nombre_interno || '')
          .toLowerCase()
          .includes(q) ||
        String(x.planta_nombre || '')
          .toLowerCase()
          .includes(q) ||
        String(x.requerimiento_asic || '')
          .toLowerCase()
          .includes(q),
    )
  }
  return r
})

const paginadas = computed(() => {
  const inicio = (pagina.value - 1) * filasPorPagina
  return filtradas.value.slice(inicio, inicio + filasPorPagina)
})

watch(filtradas, () => {
  pagina.value = 1
})

async function cargar() {
  loading.value = true
  try {
    rows.value = await ppaService.listarAsic()
  } catch (err) {
    logger.error('mem', err)
    toast.error('No se pudo cargar GESCON', {
      description: normalizeError(err).message,
      duration: 6000,
    })
  } finally {
    loading.value = false
  }
}
function limpiar() {
  filtroTexto.value = ''
  filtroTipo.value = ''
  filtroMes.value = ''
  filtroAnio.value = ''
}

const columns: DataTableColumn[] = [
  { key: 'codigo_sic_contrato', header: 'SIC', class: 'w-24' },
  { key: 'contrato_interno', header: 'Contrato', class: 'min-w-40' },
  { key: 'nombre_interno', header: 'Nombre interno', class: 'min-w-36' },
  { key: 'planta', header: 'Planta', class: 'min-w-40' },
  { key: 'tipo_solicitud', header: 'Tipo', class: 'w-32' },
  { key: 'requerimiento_asic', header: 'Req.', class: 'w-28' },
  { key: 'fecha_inicio', header: 'Inicio', class: 'w-24' },
  { key: 'fecha_fin', header: 'Fin', class: 'w-24' },
  { key: 'estado_solicitud', header: 'Estado', class: 'w-28' },
  { key: 'porcentaje_despacho', header: 'Desp.', class: 'w-16' },
  { key: 'coexiste', header: 'Coex.', class: 'w-12' },
  { key: 'modalidad', header: 'Modalidad', class: 'w-24' },
  { key: 'acciones', header: '', class: 'w-24' },
]

function asRow(row: DataTableRow): RegistroAsic {
  return row as unknown as RegistroAsic
}

// ── Exportar a Excel (identidad de marca Unergy) ────────────────────────────
const exportando = ref(false)
async function descargarGesconExcel() {
  if (exportando.value) return
  if (!rows.value.length) {
    toast.warning('Sin datos', {
      description: 'No hay registros GESCON para exportar.',
      duration: 3000,
    })
    return
  }
  exportando.value = true
  try {
    const XLSX = await import('xlsx-js-style')

    // Paleta de marca Unergy
    const C = {
      morado: '915BD8',
      oscuro: '2C2039',
      lila: 'F4F1FA',
      blanco: 'FFFFFF',
      gris: '6B5A8A',
      borde: 'ECE4F5',
      rojo: 'D64455',
      dorado: '9A6700',
      doradoBg: 'FBF3DB',
      azul: '0369A1',
      azulBg: 'E1F0FA',
    }
    const bf = { style: 'thin' as const, color: { rgb: C.borde } }
    const bAll = { top: bf, bottom: bf, left: bf, right: bf }
    const siNo = (v: unknown) => (v ? 'Sí' : 'No')
    const fechaFmt = (d: unknown) => {
      if (!d) return ''
      const [y, m, day] = String(d).slice(0, 10).split('-')
      return `${day}/${m}/${y}`
    }

    interface ColumnaExcel {
      h: string
      w: number
      get: (r: RegistroAsic) => unknown
      num?: boolean
      pct?: boolean
      align?: 'left' | 'right' | 'center'
      venc?: boolean
      dup?: boolean
    }

    const COLS: ColumnaExcel[] = [
      { h: 'SIC contrato', w: 12, get: (r) => r.codigo_sic_contrato || '' },
      { h: 'Contrato interno', w: 18, get: (r) => r.contrato_interno || '' },
      { h: 'Nombre interno', w: 18, get: (r) => r.nombre_interno || '' },
      { h: 'Planta', w: 24, get: (r) => r.planta_nombre || '' },
      { h: 'Tipo solicitud', w: 14, get: (r) => tipoLabel(r.tipo_solicitud as string) },
      { h: 'Estado', w: 12, get: (r) => estadoLabel(r.estado_solicitud as string) },
      { h: 'SIC vendedor', w: 12, get: (r) => r.codigo_sic_vendedor || '' },
      { h: 'SIC comprador', w: 13, get: (r) => r.codigo_sic_comprador || '' },
      {
        h: 'Prioridad (P.S)',
        w: 13,
        get: (r) => r.prioridad_limitacion,
        num: true,
        align: 'center',
      },
      { h: 'Fecha solicitud', w: 13, get: (r) => fechaFmt(r.fecha_solicitud), align: 'center' },
      { h: 'Fecha inicio', w: 12, get: (r) => fechaFmt(r.fecha_inicio), align: 'center' },
      { h: 'Fecha fin', w: 12, get: (r) => fechaFmt(r.fecha_fin), align: 'center', venc: true },
      { h: 'Tipo mercado', w: 14, get: (r) => r.tipo_mercado || '' },
      { h: 'Tipo asignación', w: 15, get: (r) => r.tipo_asignacion || '' },
      { h: '% FNCER', w: 10, get: (r) => r.porcentaje_fncer, num: true, pct: true, align: 'right' },
      {
        h: '% Despacho',
        w: 11,
        get: (r) => despachoPct(r.porcentaje_despacho as number | null),
        num: true,
        pct: true,
        align: 'right',
      },
      { h: 'Req. ASIC', w: 15, get: (r) => r.requerimiento_asic || '' },
      { h: 'Contacto solicitante', w: 22, get: (r) => r.nombre_contacto_solicitante || '' },
      { h: 'Coexiste', w: 9, get: (r) => siNo(!r.reemplaza_anterior), align: 'center' },
      {
        h: 'Modalidad',
        w: 14,
        get: (r) =>
          r.uso_del_recurso ? 'Uso del recurso' : r.es_duplicado ? 'Compra en bolsa' : 'Normal',
        align: 'center',
        dup: true,
      },
      { h: 'Link archivo', w: 32, get: (r) => r.link_archivo || '' },
      { h: 'Observaciones', w: 40, get: (r) => r.observaciones || '' },
    ]
    const ncols = COLS.length
    const data = rows.value
    const fechaExport = new Date().toLocaleString('es-CO')

    // Filas: 0 título · 1 subtítulo · 2 vacía · 3 encabezados · 4+ datos
    const HEADER_ROW = 3
    const FIRST_DATA = 4
    const aoa = [
      ['UNERGY — GESCON · Contratos ASIC'],
      [`${data.length} registros · Exportado: ${fechaExport}`],
      [],
      COLS.map((c) => c.h),
      ...data.map((r) =>
        COLS.map((c) => {
          const v = c.get(r)
          if (c.num) return v == null || v === '' ? null : Number(v)
          return v
        }),
      ),
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const enc = (r: number, c: number) => XLSX.utils.encode_cell({ r, c })
    const setStyle = (r: number, c: number, s: object) => {
      const ref = enc(r, c)
      if (!ws[ref]) ws[ref] = { t: 's', v: '' }
      ws[ref].s = s
    }

    // Banner + subtítulo
    setStyle(0, 0, {
      font: { bold: true, sz: 14, color: { rgb: C.blanco } },
      fill: { fgColor: { rgb: C.oscuro } },
      alignment: { vertical: 'center' },
    })
    setStyle(1, 0, { font: { sz: 10, color: { rgb: C.gris } } })

    // Encabezados
    COLS.forEach((c, ci) =>
      setStyle(HEADER_ROW, ci, {
        font: { bold: true, sz: 10, color: { rgb: C.blanco } },
        fill: { fgColor: { rgb: C.morado } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: bAll,
      }),
    )

    // Datos (zebra + resaltados semánticos)
    data.forEach((r, ri) => {
      const rowIdx = FIRST_DATA + ri
      const zebra = ri % 2 === 1
      COLS.forEach((c, ci) => {
        const style: Record<string, unknown> = {
          font: { sz: 10, color: { rgb: C.oscuro } },
          alignment: {
            horizontal: c.align || (c.num ? 'right' : 'left'),
            vertical: 'center',
            wrapText: c.h === 'Observaciones',
          },
          border: bAll,
        }
        if (zebra) style.fill = { fgColor: { rgb: C.lila } }
        if (c.pct) style.numFmt = '0.##"%"'
        if (c.venc && r.fecha_fin && String(r.fecha_fin).slice(0, 10) < hoy)
          style.font = { sz: 10, bold: true, color: { rgb: C.rojo } }
        if (c.dup && r.uso_del_recurso) {
          style.font = { sz: 10, bold: true, color: { rgb: C.azul } }
          style.fill = { fgColor: { rgb: C.azulBg } }
        } else if (c.dup && r.es_duplicado) {
          style.font = { sz: 10, bold: true, color: { rgb: C.dorado } }
          style.fill = { fgColor: { rgb: C.doradoBg } }
        }
        setStyle(rowIdx, ci, style)
      })
    })

    // Merges, anchos, alturas, autofiltro
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } },
    ]
    ws['!cols'] = COLS.map((c) => ({ wch: c.w }))
    ws['!rows'] = [{ hpt: 26 }, { hpt: 16 }, { hpt: 6 }, { hpt: 30 }]
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: HEADER_ROW, c: 0 },
        e: { r: FIRST_DATA + data.length - 1, c: ncols - 1 },
      }),
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'GESCON')
    XLSX.writeFile(wb, `GESCON_Contratos_ASIC_${hoy}.xlsx`)
    toast.success('Excel descargado', {
      description: `${data.length} registros exportados`,
      duration: 2500,
    })
  } catch (err) {
    toast.error('No se pudo generar el Excel', {
      description: normalizeError(err).message,
      duration: 4000,
    })
  } finally {
    exportando.value = false
  }
}

function confirmarEliminar(row: RegistroAsic) {
  const label = row.codigo_sic_contrato || row.contrato_interno || `ID ${row.id}`
  const planta = row.planta_nombre ? ` (${row.planta_nombre})` : ''
  confirm({
    title: 'Confirmar eliminación',
    description: `¿Eliminar el registro GESCON "${label}"${planta}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await ppaService.eliminarAsic(row.id)
        rows.value = rows.value.filter((r) => r.id !== row.id)
        toast.success('Registro eliminado', { duration: 2000 })
      } catch (err) {
        toast.error('No se puede eliminar', {
          description: normalizeError(err).message,
          duration: 6000,
        })
      }
    },
  })
}

// ── Proyectos ────────────────────────────────────────────────────────────
const proyectos = ref<ProyectoConDetalle[]>([])
async function cargarProyectos() {
  try {
    const data = await catalogoProyectos.cargar()
    proyectos.value = [...data].sort((a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial))
  } catch {
    // silencioso -- el selector queda vacío
  }
}
const proyectosOptions = computed<ComboBoxOption[]>(() =>
  proyectos.value.map((p) => ({ value: String(p.id), label: p.nombre_comercial })),
)

// ── Contratos PPA (fuente del selector que llena código + nombre interno) ──
interface ContratoPpaOpcion extends ContratoPpa {
  _label: string
}
const contratos = ref<ContratoPpaOpcion[]>([])
async function cargarContratos() {
  try {
    const items = await ppaService.listar()
    contratos.value = items.map((c) => ({
      ...c,
      // _label = "código — nombre" pegados, para la búsqueda y la vista cerrada del selector.
      _label: `${c.numero_codigo_contrato || '(sin código)'} — ${c.nombre_interno || '(sin nombre)'}`,
    }))
  } catch {
    // silencioso
  }
}
const contratosOptions = computed<ComboBoxOption[]>(() =>
  contratos.value.map((c) => ({ value: String(c.id), label: c._label })),
)

// ── Formulario ───────────────────────────────────────────────────────────
const dialogVisible = ref(false)
const guardando = ref(false)
const errores = ref<Record<string, string>>({})
const editandoId = ref<number | null>(null)

interface FormularioAsic {
  tipo_solicitud: string | null
  estado_solicitud: string
  codigo_sic_contrato: string
  contrato_interno: string
  nombre_interno: string
  contrato_ppa_id: number | null
  codigo_sic_vendedor: string
  codigo_sic_comprador: string
  cedula_agente_vendedor: string
  cedula_agente_comprador: string
  prioridad_limitacion: number | null
  proyecto_id: number | null
  fecha_solicitud: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  tipo_mercado: string
  tipo_asignacion: string
  porcentaje_fncer: number | null
  porcentaje_despacho: number | null
  requerimiento_asic: string
  nombre_contacto_solicitante: string
  link_archivo: string
  observaciones: string
  reemplaza_anterior: boolean
  es_duplicado: boolean
  uso_del_recurso: boolean
  modalidad_pago: string | null
}

function formInicial(): FormularioAsic {
  return {
    tipo_solicitud: null,
    estado_solicitud: 'en_proceso',
    codigo_sic_contrato: '',
    contrato_interno: '',
    nombre_interno: '',
    contrato_ppa_id: null,
    codigo_sic_vendedor: 'UNGG',
    codigo_sic_comprador: '',
    cedula_agente_vendedor: '',
    cedula_agente_comprador: '',
    prioridad_limitacion: null,
    proyecto_id: null,
    fecha_solicitud: null,
    fecha_inicio: null,
    fecha_fin: null,
    tipo_mercado: 'No regulado',
    tipo_asignacion: '',
    porcentaje_fncer: 100,
    porcentaje_despacho: null,
    requerimiento_asic: '',
    nombre_contacto_solicitante: '',
    link_archivo: '',
    observaciones: '',
    reemplaza_anterior: true,
    es_duplicado: false,
    uso_del_recurso: false,
    modalidad_pago: null,
  }
}
const form = ref<FormularioAsic>(formInicial())

// Modalidad de suministro: es_duplicado y uso_del_recurso son mutuamente
// excluyentes (el backend rechaza ambos con 422). Un solo control de 3 estados
// traduce a los dos flags, así es imposible marcarlos juntos por error.
type ModalidadSuministro = 'normal' | 'duplicado' | 'uso_recurso'
const MODALIDADES_SUMINISTRO: { label: string; value: ModalidadSuministro }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Compra en bolsa', value: 'duplicado' },
  { label: 'Uso del recurso', value: 'uso_recurso' },
]
// Modalidad de PAGO del contrato (distinta de la de suministro): marca el par
// PLG/PLC de una planta repartida entre dos contratos. El ToggleGroup no
// maneja null, así que '' hace de "no aplica" y se traduce a null al guardar.
const MODALIDADES_PAGO = [
  { label: 'No aplica', value: '' },
  { label: 'PLG', value: 'plg' },
  { label: 'PLC', value: 'plc' },
]
const modalidadPago = computed<string>({
  get: () => form.value.modalidad_pago || '',
  set: (v) => {
    form.value.modalidad_pago = v || null
  },
})

const modalidadSuministro = computed<ModalidadSuministro>({
  get: () => {
    if (form.value.uso_del_recurso) return 'uso_recurso'
    if (form.value.es_duplicado) return 'duplicado'
    return 'normal'
  },
  set: (v) => {
    form.value.es_duplicado = v === 'duplicado'
    form.value.uso_del_recurso = v === 'uso_recurso'
  },
})

// Una terminación solo necesita: SIC del contrato a terminar, fecha de terminación,
// cédulas de los agentes y el link del archivo. El resto de campos se ocultan.
const esTerminacion = computed(() => form.value.tipo_solicitud === 'terminacion')

// Registrar una modificación NO es capturar un contrato nuevo: es otra versión
// del mismo SIC, y el formulario asistido solo pide lo que cambia. Editar una
// fila ya existente (lápiz) sí usa el formulario completo: ahí se corrigen
// datos de ese registro puntual, no se registra una modificación ante XM.
const modoModificacionAsistida = computed(
  () => form.value.tipo_solicitud === 'modificacion' && !editandoId.value,
)
const modoTerminacionAsistida = computed(
  () => form.value.tipo_solicitud === 'terminacion' && !editandoId.value,
)
const modoAsistido = computed(() => modoModificacionAsistida.value || modoTerminacionAsistida.value)

// Solo las solicitudes publicadas cuentan para la vigencia y para Cumplimiento:
// una guardada "en proceso" no cambiaría nada y el usuario no tendría cómo
// notarlo. Se propone Publicado (el selector queda editable).
watch(modoAsistido, (asistido) => {
  if (asistido && form.value.estado_solicitud === 'en_proceso')
    form.value.estado_solicitud = 'publicado'
})

const tituloDialogo = computed(() => {
  if (editandoId.value) return 'Editar contrato ASIC'
  if (modoModificacionAsistida.value) return 'Registrar modificación'
  if (modoTerminacionAsistida.value) return 'Registrar terminación'
  return 'Registrar contrato ASIC'
})

function onAsistidoGuardado() {
  dialogVisible.value = false
  // Recarga completa: la solicitud puede haber cerrado filas del mismo SIC y
  // recalculado la vigencia efectiva de otras.
  cargar()
}

// ── Validación de solapamiento (integridad de atribución de generación) ──
// Contratos ACTIVOS de la MISMA planta cuya ventana de fechas se cruza con la que
// se está capturando. Si existen y la planta no reemplaza a la anterior ni se marca
// como compra en bolsa, su generación se contaría dos veces en Cumplimiento.
const conflictosSolapamiento = computed(() => {
  if (esTerminacion.value) return []
  return conflictosAtribucion(
    {
      id: editandoId.value,
      proyecto_id: form.value.proyecto_id,
      fecha_inicio: form.value.fecha_inicio,
      fecha_fin: form.value.fecha_fin,
    },
    rows.value,
  )
})
// El cruce queda resuelto si la planta reemplaza a la anterior, se marca como
// compra en bolsa (es_duplicado) o como uso del recurso (uso_del_recurso): en
// las tres la coexistencia es legítima. Si no, es un conflicto bloqueante.
const conflictoNoResuelto = computed(
  () =>
    conflictosSolapamiento.value.length > 0 &&
    !form.value.reemplaza_anterior &&
    !form.value.es_duplicado &&
    !form.value.uso_del_recurso,
)

const opcionesEstadoForm = [
  { label: 'En proceso', value: 'en_proceso' },
  { label: 'Publicado', value: 'publicado' },
  { label: 'Rechazado', value: 'rechazado' },
  { label: 'Desistido', value: 'desistido' },
]

function abrirNuevo() {
  editandoId.value = null
  form.value = formInicial()
  errores.value = {}
  dialogVisible.value = true
}

function abrirEditar(row: RegistroAsic) {
  editandoId.value = row.id
  form.value = {
    tipo_solicitud: (row.tipo_solicitud as string) ?? null,
    estado_solicitud: (row.estado_solicitud as string) ?? 'en_proceso',
    codigo_sic_contrato: (row.codigo_sic_contrato as string) || '',
    contrato_interno: (row.contrato_interno as string) || '',
    nombre_interno: (row.nombre_interno as string) || '',
    contrato_ppa_id: (row.contrato_ppa_id as number) ?? null,
    codigo_sic_vendedor: (row.codigo_sic_vendedor as string) || '',
    codigo_sic_comprador: (row.codigo_sic_comprador as string) || '',
    cedula_agente_vendedor: (row.cedula_agente_vendedor as string) || '',
    cedula_agente_comprador: (row.cedula_agente_comprador as string) || '',
    prioridad_limitacion: (row.prioridad_limitacion as number) ?? null,
    proyecto_id: (row.proyecto_id as number) ?? null,
    fecha_solicitud: (row.fecha_solicitud as string) ?? null,
    fecha_inicio: (row.fecha_inicio as string) ?? null,
    fecha_fin: (row.fecha_fin as string) ?? null,
    tipo_mercado: (row.tipo_mercado as string) || '',
    tipo_asignacion: (row.tipo_asignacion as string) || '',
    porcentaje_fncer: (row.porcentaje_fncer as number) ?? null,
    // despacho se almacena como fracción 0-1; el form lo edita en escala 0-100
    porcentaje_despacho:
      row.porcentaje_despacho != null
        ? Number(((row.porcentaje_despacho as number) * 100).toFixed(2))
        : null,
    requerimiento_asic: (row.requerimiento_asic as string) || '',
    nombre_contacto_solicitante: (row.nombre_contacto_solicitante as string) || '',
    link_archivo: (row.link_archivo as string) || '',
    observaciones: (row.observaciones as string) || '',
    reemplaza_anterior: (row.reemplaza_anterior as boolean) ?? true,
    es_duplicado: (row.es_duplicado as boolean) ?? false,
    uso_del_recurso: (row.uso_del_recurso as boolean) ?? false,
    modalidad_pago: (row.modalidad_pago as string) || null,
  }
  errores.value = {}
  dialogVisible.value = true
}

// Al elegir un contrato, llena ambos campos (código interno + nombre interno) de una vez.
function onSelectContrato(id: string | null) {
  form.value.contrato_ppa_id = id ? Number(id) : null
  const c = contratos.value.find((x) => x.id === form.value.contrato_ppa_id)
  if (!c) return // showClear equivalente -> no borra lo ya escrito
  if (c.numero_codigo_contrato) form.value.contrato_interno = c.numero_codigo_contrato
  if (c.nombre_interno) form.value.nombre_interno = c.nombre_interno
}

async function guardar() {
  errores.value = {}
  if (!form.value.tipo_solicitud) {
    errores.value.tipo_solicitud = 'Requerido'
    return
  }
  if (!form.value.estado_solicitud) {
    errores.value.estado_solicitud = 'Requerido'
    return
  }
  // En una terminación, el SIC del contrato a terminar y la fecha de terminación son
  // obligatorios: con ellos el sistema cierra el contrato en esa fecha.
  if (esTerminacion.value) {
    if (!form.value.codigo_sic_contrato) {
      errores.value.codigo_sic_contrato = 'Requerido'
      return
    }
    if (!form.value.fecha_fin) {
      errores.value.fecha_fin = 'Requerido'
      return
    }
  }

  // Solapamiento de generación sin resolver: bloquea el guardado para no duplicar
  // el aporte de la planta en Cumplimiento.
  if (conflictoNoResuelto.value) {
    toast.warning('Solapamiento sin resolver', {
      description:
        'Otra planta igual tiene fechas que se cruzan. Marca "Reemplaza anterior" si la sustituye, o define la modalidad ("Compra en bolsa" o "Uso del recurso") si coexiste.',
      duration: 6000,
    })
    return
  }

  guardando.value = true
  try {
    const payload: PayloadAsic = {
      ...form.value,
      codigo_sic_contrato: form.value.codigo_sic_contrato || null,
      codigo_sic_vendedor: form.value.codigo_sic_vendedor || null,
      codigo_sic_comprador: form.value.codigo_sic_comprador || null,
      cedula_agente_vendedor: form.value.cedula_agente_vendedor || null,
      cedula_agente_comprador: form.value.cedula_agente_comprador || null,
      contrato_interno: form.value.contrato_interno || null,
      nombre_interno: form.value.nombre_interno || null,
      requerimiento_asic: form.value.requerimiento_asic || null,
      nombre_contacto_solicitante: form.value.nombre_contacto_solicitante || null,
      tipo_asignacion: form.value.tipo_asignacion || null,
      link_archivo: form.value.link_archivo || null,
      observaciones: form.value.observaciones || null,
      modalidad_pago: form.value.modalidad_pago || null,
      // despacho: el form usa escala 0-100 pero la BD/cumplimiento usa fracción 0-1
      porcentaje_despacho:
        form.value.porcentaje_despacho != null
          ? Number((form.value.porcentaje_despacho / 100).toFixed(4))
          : null,
    }

    // Invariantes de una terminación (las mismas que aplica POST /asic/terminacion):
    // sin planta —con proyecto_id, Cumplimiento borra la planta del mes de la
    // terminación en vez de prorratearla hasta la fecha— y sin porcentajes, que
    // no aplican a una fila que no aporta energía.
    // La identidad del contrato (contrato interno, nombre interno, vendedor,
    // comprador, prioridad, PPA) SÍ se conserva: antes se borraba aquí y por eso
    // las terminaciones salían en blanco en la tabla y en el Excel.
    if (esTerminacion.value) {
      Object.assign(payload, {
        proyecto_id: null,
        fecha_inicio: null,
        porcentaje_fncer: null,
        porcentaje_despacho: null,
        reemplaza_anterior: true,
        es_duplicado: false,
        uso_del_recurso: false,
      })
    }

    if (editandoId.value) {
      const data = await ppaService.actualizarAsic(editandoId.value, payload)
      const idx = rows.value.findIndex((r) => r.id === editandoId.value)
      if (idx !== -1) rows.value.splice(idx, 1, data)
      else rows.value = [data, ...rows.value]
      rows.value = [...rows.value]
      toast.success('Actualizado', { description: 'Contrato ASIC actualizado', duration: 3000 })
    } else {
      const data = await ppaService.crearAsic(payload)
      rows.value = [data, ...rows.value]
      toast.success('Guardado', { description: 'Contrato ASIC registrado', duration: 3000 })
    }
    dialogVisible.value = false
  } catch (err) {
    toast.error('Error', { description: normalizeError(err).message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function fmt(d: unknown): string {
  if (!d) return '—'
  const [y = '', m = '', day = ''] = String(d).split('-')
  return `${day}/${m}/${y.slice(2)}`
}
function esVencido(d: unknown): boolean {
  return !!d && String(d) < hoy
}

// porcentaje_despacho se almacena como fracción 0-1 (1 = 100%); el backend de
// cumplimiento lo usa como multiplicador directo (gen × pct_despacho). Para mostrar
// se multiplica ×100, igual que en CumplimientoV2View.
function despachoPct(v: number | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v) * 100
  if (Number.isNaN(n)) return null
  return Number.isInteger(n) ? n : Number(n.toFixed(2))
}
// Valor fuera de la escala canónica 0-1 (p.ej. un 100 guardado por el formulario
// antiguo). Se resalta para que se corrija: rompe el cálculo de cumplimiento.
function despachoAnomalo(v: unknown): boolean {
  return v != null && v !== '' && Number(v) > 1
}

const TIPO_LABELS: Record<string, string> = {
  registro: 'Registro',
  modificacion: 'Modificación',
  terminacion: 'Terminación',
  desistimiento: 'Desistimiento',
}
const TIPO_SEV: Record<string, string> = {
  registro: 'success',
  modificacion: 'information',
  terminacion: 'warning',
  desistimiento: 'default',
}
function tipoLabel(v: string | null | undefined): string {
  return (v && TIPO_LABELS[v]) || v || '—'
}
function tipoSeverity(v: string | null | undefined): string {
  return (v && TIPO_SEV[v]) || 'default'
}

const ESTADO_LABELS: Record<string, string> = {
  publicado: 'Publicado',
  en_proceso: 'En proceso',
  rechazado: 'Rechazado',
  desistido: 'Desistido',
  terminado: 'Terminado',
}
const ESTADO_SEV: Record<string, string> = {
  publicado: 'success',
  en_proceso: 'information',
  rechazado: 'destructive',
  desistido: 'default',
  terminado: 'warning',
}
function estadoLabel(v: string | null | undefined): string {
  return (v && ESTADO_LABELS[v]) || v || '—'
}
function estadoSeverity(v: string | null | undefined): string {
  return (v && ESTADO_SEV[v]) || 'default'
}

// ── Backfill de nombres internos faltantes ─────────────────────────────────
const backfillDialog = ref(false)
const backfillReport = ref<RespuestaBackfillAsic | null>(null)
const backfillLoading = ref(false)
const backfillExecuting = ref(false)

async function previewBackfill() {
  backfillLoading.value = true
  try {
    backfillReport.value = await ppaService.backfillNombreInterno(true)
    backfillDialog.value = true
  } catch (err) {
    toast.error('No se pudo previsualizar', {
      description: normalizeError(err).message,
      duration: 5000,
    })
  } finally {
    backfillLoading.value = false
  }
}

async function applyBackfill() {
  backfillExecuting.value = true
  try {
    const data = await ppaService.backfillNombreInterno(false)
    toast.success('Nombres internos completados', {
      description: `${data.a_actualizar} registro(s) actualizados.`,
      duration: 4000,
    })
    backfillDialog.value = false
    backfillReport.value = null
    await cargar() // recarga la tabla ya con los nombres completos
  } catch (err) {
    toast.error('El backfill falló (se revirtió)', {
      description: normalizeError(err).message,
      duration: 7000,
    })
  } finally {
    backfillExecuting.value = false
  }
}

// ── Backfill de la identidad de las terminaciones viejas ────────────────────
const backfillTermDialog = ref(false)
const backfillTermReport = ref<RespuestaBackfillAsic | null>(null)
const backfillTermLoading = ref(false)
const backfillTermExecuting = ref(false)

// Hay algo que aplicar si faltan datos de identidad O fechas por estampar.
const backfillTermPendiente = computed(
  () =>
    !!backfillTermReport.value &&
    (backfillTermReport.value.a_actualizar || 0) + (backfillTermReport.value.a_recortar || 0) > 0,
)

async function previewBackfillTerm() {
  backfillTermLoading.value = true
  try {
    backfillTermReport.value = await ppaService.backfillTerminaciones(true)
    backfillTermDialog.value = true
  } catch (err) {
    toast.error('No se pudo previsualizar', {
      description: normalizeError(err).message,
      duration: 5000,
    })
  } finally {
    backfillTermLoading.value = false
  }
}

function asNombreResuelto(
  r: BackfillNombreResuelto | BackfillTerminacionResuelta,
): BackfillNombreResuelto {
  return r as BackfillNombreResuelto
}
function asTerminacionResuelta(
  r: BackfillNombreResuelto | BackfillTerminacionResuelta,
): BackfillTerminacionResuelta {
  return r as BackfillTerminacionResuelta
}

async function applyBackfillTerm() {
  backfillTermExecuting.value = true
  try {
    const data = await ppaService.backfillTerminaciones(false)
    toast.success('Terminaciones completadas', {
      description: `${data.a_actualizar} terminación(es) con datos completados · ${data.a_recortar || 0} registro(s) con la fecha estampada.`,
      duration: 5000,
    })
    backfillTermDialog.value = false
    backfillTermReport.value = null
    await cargar()
  } catch (err) {
    toast.error('El backfill falló (se revirtió)', {
      description: normalizeError(err).message,
      duration: 7000,
    })
  } finally {
    backfillTermExecuting.value = false
  }
}

onMounted(() => {
  cargar()
  cargarProyectos()
  cargarContratos()
})
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="`GESCON — Contratos ASIC`" :subtitle="`${filtradas.length} registros`">
      <template #actions>
        <GTooltip>
          <GTooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :disabled="backfillLoading"
              @click="previewBackfill"
            >
              <LoaderCircleIcon v-if="backfillLoading" class="animate-spin" />
              <WandSparklesIcon v-else />
              Completar nombres internos
            </Button>
          </GTooltipTrigger>
          <GTooltipContent
            >Rellena el nombre interno de los registros que lo tengan vacío, tomándolo del contrato
            PPA</GTooltipContent
          >
        </GTooltip>
        <GTooltip>
          <GTooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :disabled="backfillTermLoading"
              @click="previewBackfillTerm"
            >
              <LoaderCircleIcon v-if="backfillTermLoading" class="animate-spin" />
              <FlagIcon v-else />
              Completar terminaciones
            </Button>
          </GTooltipTrigger>
          <GTooltipContent
            >Rellena contrato, nombre interno y demás datos de las terminaciones registradas antes,
            tomándolos de los registros del mismo código SIC</GTooltipContent
          >
        </GTooltip>
        <Button variant="outline" size="sm" :disabled="exportando" @click="descargarGesconExcel">
          <LoaderCircleIcon v-if="exportando" class="animate-spin" />
          <FileSpreadsheetIcon v-else />
          Descargar Excel
        </Button>
        <Button size="sm" @click="abrirNuevo">
          <PlusIcon />
          Registrar
        </Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div
      class="flex flex-nowrap items-center gap-3 overflow-x-auto rounded-xl border bg-card px-4 py-3"
    >
      <InputGroup class="min-w-52 flex-1">
        <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
        <InputGroupInput v-model="filtroTexto" placeholder="Buscar SIC, contrato, planta…" />
      </InputGroup>

      <ToggleGroup v-model="filtroEstado" type="single" variant="outline" class="shrink-0">
        <ToggleGroupItem value="vigentes">Vigentes</ToggleGroupItem>
        <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
      </ToggleGroup>

      <Select v-model="filtroTipo">
        <SelectTrigger class="w-40 shrink-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos</SelectItem>
          <SelectItem v-for="op in opcionesTipo" :key="op.value" :value="op.value">{{
            op.label
          }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="filtroMes">
        <SelectTrigger class="w-40 shrink-0"
          ><SelectValue placeholder="Mes (vigencia)"
        /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Mes</SelectItem>
          <SelectItem v-for="op in opcionesMes" :key="op.value" :value="op.value">{{
            op.label
          }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="filtroAnio">
        <SelectTrigger class="w-28 shrink-0"
          ><SelectValue placeholder="Año (vigencia)"
        /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Año</SelectItem>
          <SelectItem v-for="op in opcionesAnio" :key="op.value" :value="op.value">{{
            op.label
          }}</SelectItem>
        </SelectContent>
      </Select>

      <Button
        v-if="filtroTexto || filtroTipo || filtroMes || filtroAnio"
        variant="secondary"
        size="sm"
        class="shrink-0"
        @click="limpiar"
      >
        <XIcon />
        Limpiar
      </Button>
    </div>

    <!-- Tabla -->
    <div class="overflow-hidden rounded-xl border bg-card">
      <DataTable
        v-if="!loading"
        :columns="columns"
        :rows="paginadas as unknown as DataTableRow[]"
        row-key="id"
        :page="pagina"
        :page-size="filasPorPagina"
        :total="filtradas.length"
        @update:page="(p) => (pagina = p)"
      >
        <template #empty>
          <div class="py-12 text-center text-sm text-muted-foreground">
            No hay contratos con los filtros actuales.
          </div>
        </template>

        <template #cell="{ row, column }">
          <span
            v-if="column.key === 'codigo_sic_contrato'"
            class="font-mono text-xs text-primary"
            >{{ asRow(row).codigo_sic_contrato || '—' }}</span
          >
          <span
            v-else-if="column.key === 'contrato_interno'"
            class="text-xs font-medium text-foreground"
            >{{ asRow(row).contrato_interno || '—' }}</span
          >
          <span v-else-if="column.key === 'nombre_interno'" class="text-xs text-muted-foreground">{{
            asRow(row).nombre_interno || '—'
          }}</span>
          <span v-else-if="column.key === 'planta'" class="text-xs font-medium text-foreground">{{
            asRow(row).planta_nombre || '—'
          }}</span>
          <GBadge
            v-else-if="column.key === 'tipo_solicitud'"
            :color="tipoSeverity(asRow(row).tipo_solicitud as string)"
            >{{ tipoLabel(asRow(row).tipo_solicitud as string) }}</GBadge
          >
          <span
            v-else-if="column.key === 'requerimiento_asic'"
            class="font-mono text-xs text-muted-foreground"
            >{{ asRow(row).requerimiento_asic || '—' }}</span
          >
          <span v-else-if="column.key === 'fecha_inicio'" class="text-xs text-muted-foreground">{{
            fmt(asRow(row).fecha_inicio)
          }}</span>

          <template v-else-if="column.key === 'fecha_fin'">
            <GTooltip v-if="finRecortado(asRow(row))">
              <GTooltipTrigger as-child>
                <span
                  class="inline-flex items-center gap-1 text-xs"
                  :class="
                    esVencido(finEfectivo(asRow(row)))
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  "
                >
                  {{ fmt(finEfectivo(asRow(row))) }}
                  <HistoryIcon class="size-3 text-warning" />
                </span>
              </GTooltipTrigger>
              <GTooltipContent
                >Vigencia recortada: un relevo o modificación posterior en este SIC superó esta
                fila. Fecha registrada: {{ fmt(asRow(row).fecha_fin) }}</GTooltipContent
              >
            </GTooltip>
            <span
              v-else
              class="text-xs"
              :class="
                esVencido(asRow(row).fecha_fin) ? 'text-destructive' : 'text-muted-foreground'
              "
              >{{ fmt(asRow(row).fecha_fin) }}</span
            >
          </template>

          <GBadge
            v-else-if="column.key === 'estado_solicitud'"
            :color="estadoSeverity(asRow(row).estado_solicitud as string)"
            >{{ estadoLabel(asRow(row).estado_solicitud as string) }}</GBadge
          >

          <template v-else-if="column.key === 'porcentaje_despacho'">
            <GTooltip v-if="despachoAnomalo(asRow(row).porcentaje_despacho)">
              <GTooltipTrigger as-child>
                <span class="text-xs text-destructive"
                  >{{ despachoPct(asRow(row).porcentaje_despacho as number) }}%</span
                >
              </GTooltipTrigger>
              <GTooltipContent
                >Valor fuera de escala canónica (0-1). Revisar: rompe el cálculo de
                cumplimiento.</GTooltipContent
              >
            </GTooltip>
            <span v-else class="text-xs text-muted-foreground">{{
              asRow(row).porcentaje_despacho != null
                ? `${despachoPct(asRow(row).porcentaje_despacho as number)}%`
                : '—'
            }}</span>
          </template>

          <template v-else-if="column.key === 'coexiste'">
            <GTooltip v-if="!asRow(row).reemplaza_anterior">
              <GTooltipTrigger as-child><LinkIcon class="size-3.5 text-warning" /></GTooltipTrigger>
              <GTooltipContent>Coexiste con otras plantas en este SIC</GTooltipContent>
            </GTooltip>
          </template>

          <template v-else-if="column.key === 'modalidad'">
            <GTooltip v-if="asRow(row).uso_del_recurso">
              <GTooltipTrigger as-child>
                <span
                  class="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary"
                >
                  <RefreshCwIcon class="size-2.5" />Uso recurso
                </span>
              </GTooltipTrigger>
              <GTooltipContent
                >Uso del recurso — planta en bolsa; se le paga al cliente a precio bolsa. No genera
                garantías.</GTooltipContent
              >
            </GTooltip>
            <GTooltip v-else-if="asRow(row).es_duplicado">
              <GTooltipTrigger as-child>
                <span
                  class="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-xs font-semibold text-warning"
                >
                  <ShoppingCartIcon class="size-2.5" />Bolsa
                </span>
              </GTooltipTrigger>
              <GTooltipContent
                >Compra en bolsa (duplicado) — cuenta para el contrato, origen bolsa. Genera
                garantías.</GTooltipContent
              >
            </GTooltip>
          </template>

          <div v-else-if="column.key === 'acciones'" class="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" @click.stop="abrirEditar(asRow(row))"
              ><PencilIcon
            /></Button>
            <Button v-if="asRow(row).link_archivo" variant="ghost" size="icon-sm" as-child>
              <a :href="asRow(row).link_archivo as string" target="_blank" rel="noopener"
                ><ExternalLinkIcon
              /></a>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-destructive"
              @click.stop="confirmarEliminar(asRow(row))"
              ><Trash2Icon
            /></Button>
          </div>
        </template>
      </DataTable>
      <div v-else class="flex items-center justify-center py-12">
        <LoaderCircleIcon class="size-8 animate-spin text-primary" />
      </div>
    </div>

    <!-- ── Dialog Registro ─────────────────────────────────────────────── -->
    <Dialog v-model:open="dialogVisible">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ tituloDialogo }}</DialogTitle>
        </DialogHeader>

        <div class="space-y-5 pt-1">
          <!-- Fila 1: Tipo + Estado (comunes a todos los modos) -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <GLabel required>Tipo solicitud</GLabel>
              <Select
                :model-value="form.tipo_solicitud ?? undefined"
                @update:model-value="(v) => (form.tipo_solicitud = v as string)"
              >
                <SelectTrigger class="w-full"
                  ><SelectValue placeholder="Seleccionar"
                /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in opcionesTipo" :key="op.value" :value="op.value">{{
                    op.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="errores.tipo_solicitud" class="text-xs text-destructive">
                {{ errores.tipo_solicitud }}
              </p>
            </div>
            <div class="flex flex-col gap-1.5">
              <GLabel required>Estado</GLabel>
              <Select v-model="form.estado_solicitud">
                <SelectTrigger class="w-full"
                  ><SelectValue placeholder="Seleccionar"
                /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in opcionesEstadoForm" :key="op.value" :value="op.value">{{
                    op.label
                  }}</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="errores.estado_solicitud" class="text-xs text-destructive">
                {{ errores.estado_solicitud }}
              </p>
            </div>
          </div>

          <!-- Modificación: formulario asistido. Solo pide lo que cambia (fecha
               de fin, planta, % y modalidad) + la fecha en que entra en vigencia;
               el resto lo hereda el backend de la versión vigente del SIC. -->
          <GesconModificacionForm
            v-if="modoModificacionAsistida"
            :rows="rows"
            :proyectos="proyectos"
            :estado="form.estado_solicitud"
            @cancelar="dialogVisible = false"
            @guardado="onAsistidoGuardado"
          />

          <!-- Terminación: misma dinámica. Hereda la identidad del contrato en vez
               de guardarla vacía, que era lo que pasaba antes. -->
          <GesconTerminacionForm
            v-else-if="modoTerminacionAsistida"
            :rows="rows"
            :estado="form.estado_solicitud"
            @cancelar="dialogVisible = false"
            @guardado="onAsistidoGuardado"
          />

          <form v-else class="space-y-5" @submit.prevent="guardar">
            <!-- ── Terminación: solo los datos que XM exige ─────────────── -->
            <template v-if="esTerminacion">
              <div
                class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-foreground"
              >
                <InfoIcon class="mt-0.5 size-3 text-warning" />
                <span
                  >Al publicar, el contrato con este código SIC terminará en la fecha indicada:
                  dejará de aportar energía en Cumplimiento después de esa fecha (el histórico
                  previo se conserva).</span
                >
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel required>Código SIC del contrato a terminar</GLabel>
                  <Input v-model="form.codigo_sic_contrato" placeholder="87552" />
                  <p v-if="errores.codigo_sic_contrato" class="text-xs text-destructive">
                    {{ errores.codigo_sic_contrato }}
                  </p>
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel required>Fecha de terminación</GLabel>
                  <DatePicker v-model="form.fecha_fin" clearable />
                  <p v-if="errores.fecha_fin" class="text-xs text-destructive">
                    {{ errores.fecha_fin }}
                  </p>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <GLabel>N° Requerimiento ASIC</GLabel>
                <Input v-model="form.requerimiento_asic" placeholder="20260419002" />
                <p class="text-xs text-muted-foreground">
                  El SIC puede repetir el del registro, pero el requerimiento de la terminación es
                  distinto.
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel>Cédula agente vendedor</GLabel>
                  <Input v-model="form.cedula_agente_vendedor" placeholder="1037625350" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Cédula agente comprador</GLabel>
                  <Input v-model="form.cedula_agente_comprador" placeholder="1107047209" />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <GLabel>Link archivo</GLabel>
                <Input v-model="form.link_archivo" placeholder="https://..." />
              </div>
            </template>

            <!-- ── Campos completos (registro / modificación / desistimiento) ── -->
            <template v-if="!esTerminacion">
              <!-- Selector de contrato: al elegir, llena código interno + nombre interno de una vez -->
              <div class="flex flex-col gap-1.5">
                <GLabel
                  >Contrato
                  <span class="font-normal text-muted-foreground"
                    >— elígelo y se llenan código + nombre interno</span
                  ></GLabel
                >
                <ComboBox
                  :model-value="form.contrato_ppa_id != null ? String(form.contrato_ppa_id) : null"
                  :options="contratosOptions"
                  placeholder="Buscar contrato por código o nombre…"
                  @update:model-value="onSelectContrato"
                />
              </div>

              <!-- Fila 2: SIC Contrato + Contrato interno + Nombre interno -->
              <div class="grid grid-cols-3 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel>Código SIC contrato</GLabel>
                  <Input v-model="form.codigo_sic_contrato" placeholder="88806" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Contrato interno</GLabel>
                  <Input v-model="form.contrato_interno" placeholder="UNERGY 001-2024" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Nombre interno</GLabel>
                  <Input v-model="form.nombre_interno" placeholder="Terpel 1" />
                </div>
              </div>

              <!-- Fila 3: Vendedor + Comprador + P.S -->
              <div class="grid grid-cols-3 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel>SIC Vendedor</GLabel>
                  <Input v-model="form.codigo_sic_vendedor" placeholder="UNGG" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>SIC Comprador</GLabel>
                  <Input v-model="form.codigo_sic_comprador" placeholder="BIAC" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Prioridad (P.S)</GLabel>
                  <NumberField v-model="form.prioridad_limitacion" :min="0" :max="999">
                    <NumberFieldContent><NumberFieldInput placeholder="83" /></NumberFieldContent>
                  </NumberField>
                </div>
              </div>

              <!-- Fila 4: Proyecto + coexistencia + duplicado -->
              <div class="flex items-end gap-4">
                <div class="flex flex-1 flex-col gap-1.5">
                  <GLabel>Planta / Proyecto</GLabel>
                  <ComboBox
                    :model-value="form.proyecto_id != null ? String(form.proyecto_id) : null"
                    :options="proyectosOptions"
                    placeholder="Seleccionar proyecto (opcional)"
                    @update:model-value="(v) => (form.proyecto_id = v ? Number(v) : null)"
                  />
                </div>
                <label
                  class="flex items-center gap-2 pb-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Checkbox v-model="form.reemplaza_anterior" />
                  Reemplaza anterior
                  <GTooltip>
                    <GTooltipTrigger as-child
                      ><InfoIcon class="size-3.5 cursor-help"
                    /></GTooltipTrigger>
                    <GTooltipContent
                      >Activado: esta planta reemplaza la anterior en este SIC. Desactivado:
                      coexiste con las demás plantas del mismo SIC.</GTooltipContent
                    >
                  </GTooltip>
                </label>
                <div class="flex flex-col gap-1.5 pb-1.5">
                  <GLabel class="inline-flex items-center gap-1.5">
                    Modalidad de suministro
                    <GTooltip>
                      <GTooltipTrigger as-child
                        ><InfoIcon class="size-3.5 cursor-help text-muted-foreground"
                      /></GTooltipTrigger>
                      <GTooltipContent
                        >Normal: suministro propio de la planta. Compra en bolsa (duplicado): la
                        planta ya está comprometida en otro contrato; aquí su aporte cuenta pero se
                        compra en bolsa (genera garantías). Uso del recurso: la planta está en bolsa
                        y se mete al contrato pagándole al cliente su generación a precio bolsa (sin
                        garantías).</GTooltipContent
                      >
                    </GTooltip>
                  </GLabel>
                  <ToggleGroup v-model="modalidadSuministro" type="single" variant="outline">
                    <ToggleGroupItem
                      v-for="op in MODALIDADES_SUMINISTRO"
                      :key="op.value"
                      :value="op.value"
                      >{{ op.label }}</ToggleGroupItem
                    >
                  </ToggleGroup>
                  <span v-if="modalidadSuministro === 'uso_recurso'" class="text-xs text-primary">
                    Uso del recurso: se le paga al cliente su generación a precio bolsa. No genera
                    compra en bolsa ni garantías.
                  </span>
                  <span
                    v-else-if="modalidadSuministro === 'duplicado'"
                    class="text-xs text-warning"
                  >
                    Compra en bolsa: la planta ya está en otro contrato; su aporte aquí se cubre
                    comprando en bolsa (genera garantías).
                  </span>
                </div>
              </div>

              <!-- Fila 5: Fechas -->
              <div class="grid grid-cols-3 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel>Fecha solicitud</GLabel>
                  <DatePicker v-model="form.fecha_solicitud" clearable />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Fecha inicio</GLabel>
                  <DatePicker v-model="form.fecha_inicio" clearable />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Fecha fin</GLabel>
                  <DatePicker v-model="form.fecha_fin" clearable />
                </div>
              </div>

              <!-- Aviso en tiempo real: solapamiento de fechas de la misma planta ─── -->
              <div
                v-if="conflictosSolapamiento.length"
                class="rounded-lg border px-3 py-2 text-xs"
                :class="
                  conflictoNoResuelto
                    ? 'border-destructive/30 bg-destructive/5 text-destructive'
                    : 'border-warning/30 bg-warning/5 text-foreground'
                "
              >
                <div class="flex items-start gap-2">
                  <TriangleAlertIcon class="mt-0.5 size-3" />
                  <div class="flex-1">
                    <p class="font-medium">
                      Se detectó {{ conflictosSolapamiento.length }} contrato{{
                        conflictosSolapamiento.length > 1 ? 's' : ''
                      }}
                      activo{{ conflictosSolapamiento.length > 1 ? 's' : '' }} de esta planta con
                      fechas que se cruzan.
                    </p>
                    <ul class="mt-1 list-disc pl-4">
                      <li v-for="c in conflictosSolapamiento" :key="c.id ?? undefined">
                        {{ c.codigo_sic_contrato || c.contrato_interno || `ID ${c.id}` }} ·
                        {{ fmt(c.fecha_inicio) }} → {{ fmt(c.fecha_fin) }}
                      </li>
                    </ul>
                    <p v-if="conflictoNoResuelto" class="mt-1.5">
                      Para no duplicar la generación en Cumplimiento: marca
                      <b>Reemplaza anterior</b> si sustituye al registro previo, o define la
                      <b>Modalidad de suministro</b> (Compra en bolsa / Uso del recurso) si
                      coexiste.
                    </p>
                    <p v-else class="mt-1.5">
                      Resuelto —
                      {{
                        form.reemplaza_anterior
                          ? 'reemplaza al registro anterior en este SIC.'
                          : form.uso_del_recurso
                            ? 'marcado como uso del recurso.'
                            : 'marcado como compra en bolsa.'
                      }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Fila 6: Tipo mercado + Tipo asignación + % FNCER + % Despacho -->
              <div class="grid grid-cols-4 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel>Tipo mercado</GLabel>
                  <Input v-model="form.tipo_mercado" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Tipo asignación</GLabel>
                  <Input v-model="form.tipo_asignacion" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>% FNCER</GLabel>
                  <div class="flex items-center gap-2">
                    <NumberField v-model="form.porcentaje_fncer" :min="0" :max="100" class="flex-1">
                      <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                    </NumberField>
                    <span class="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>% Despacho</GLabel>
                  <div class="flex items-center gap-2">
                    <NumberField
                      v-model="form.porcentaje_despacho"
                      :min="0"
                      :max="100"
                      class="flex-1"
                    >
                      <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                    </NumberField>
                    <span class="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <!-- Modalidad de pago: marca el par PLG/PLC de una planta repartida -->
              <div class="flex flex-col gap-1.5">
                <GLabel class="inline-flex items-center gap-1.5">
                  Modalidad de pago del contrato
                  <GTooltip>
                    <GTooltipTrigger as-child
                      ><InfoIcon class="size-3.5 cursor-help text-muted-foreground"
                    /></GTooltipTrigger>
                    <GTooltipContent
                      >Cuando una planta se reparte entre dos contratos, uno PLG y otro PLC, entre
                      los dos cubren su 100%: marcarlos evita que se reporte como duplicada. Déjalo
                      en “No aplica” si el contrato no es de ese par.</GTooltipContent
                    >
                  </GTooltip>
                </GLabel>
                <ToggleGroup v-model="modalidadPago" type="single" variant="outline">
                  <ToggleGroupItem
                    v-for="op in MODALIDADES_PAGO"
                    :key="op.value"
                    :value="op.value"
                    >{{ op.label }}</ToggleGroupItem
                  >
                </ToggleGroup>
              </div>

              <!-- Fila 7: Requerimiento + Contacto -->
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <GLabel>N° Requerimiento ASIC</GLabel>
                  <Input v-model="form.requerimiento_asic" placeholder="20260419002" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <GLabel>Nombre contacto solicitante</GLabel>
                  <Input v-model="form.nombre_contacto_solicitante" />
                </div>
              </div>

              <!-- Fila 8: Link archivo -->
              <div class="flex flex-col gap-1.5">
                <GLabel>Link archivo</GLabel>
                <Input v-model="form.link_archivo" placeholder="https://..." />
              </div>

              <!-- Observaciones -->
              <div class="flex flex-col gap-1.5">
                <GLabel>Observaciones</GLabel>
                <Textarea v-model="form.observaciones" rows="2" />
              </div>
            </template>

            <DialogFooter>
              <Button type="button" variant="secondary" @click="dialogVisible = false"
                >Cancelar</Button
              >
              <GTooltip v-if="conflictoNoResuelto">
                <GTooltipTrigger as-child>
                  <span
                    ><Button type="submit" disabled>{{
                      editandoId ? 'Actualizar' : 'Guardar'
                    }}</Button></span
                  >
                </GTooltipTrigger>
                <GTooltipContent
                  >Resuelve el solapamiento de fechas antes de guardar</GTooltipContent
                >
              </GTooltip>
              <Button v-else type="submit" :disabled="guardando">
                <LoaderCircleIcon v-if="guardando" class="animate-spin" />
                <CheckIcon v-else />
                {{ editandoId ? 'Actualizar' : 'Guardar' }}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Diálogo: completar la identidad de las terminaciones viejas -->
    <Dialog v-model:open="backfillTermDialog">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Completar terminaciones</DialogTitle>
        </DialogHeader>
        <div v-if="backfillTermReport" class="space-y-3 text-sm">
          <p class="text-muted-foreground">
            Las terminaciones registradas antes se guardaban solo con el código SIC y la fecha, sin
            contrato ni nombre interno. Esto los rellena tomándolos de los registros del
            <b>mismo código SIC</b>, y de paso estampa la fecha de terminación en los registros que
            quedaron sin recortar. No se les asigna planta: una terminación se guarda sin planta a
            propósito.
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <span
              ><b>{{ backfillTermReport.a_actualizar }}</b> con datos por completar</span
            >
            <span v-if="backfillTermReport.a_recortar" class="text-destructive">
              <b>{{ backfillTermReport.a_recortar }}</b> registro(s) con fecha por recortar
            </span>
            <span v-if="backfillTermReport.sin_resolver" class="text-warning"
              ><b>{{ backfillTermReport.sin_resolver }}</b> sin resolver</span
            >
            <span v-if="backfillTermReport.total_terminaciones" class="text-muted-foreground"
              >{{ backfillTermReport.total_terminaciones }} terminaciones en total</span
            >
          </div>

          <!-- Registros que una terminación publicada debió cerrar y no cerró -->
          <div
            v-if="backfillTermReport.sin_recortar?.length"
            class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
          >
            <p class="text-xs text-destructive">
              Estas terminaciones no alcanzaron a estampar su fecha en los registros de su SIC. El
              cálculo de Cumplimiento <b>ya sale bien igual</b> —la vigencia efectiva se resuelve
              sola—, pero la fecha que se ve en la tabla y en el Excel sigue diciendo la vieja.
            </p>
            <ul class="mt-1.5 list-disc pl-4 text-xs text-destructive/90">
              <li v-for="s in backfillTermReport.sin_recortar" :key="s.id">
                SIC <b>{{ s.codigo_sic_contrato }}</b>
                <span v-if="s.requerimiento_asic"> · req. {{ s.requerimiento_asic }}</span>
                — termina {{ fmt(s.termina) }}:
                {{ s.registros.map((r) => `${r.planta} (${fmt(r.fecha_fin_actual)})`).join(', ') }}
              </li>
            </ul>
          </div>

          <div
            v-if="backfillTermReport.resueltos?.length"
            class="max-h-60 overflow-y-auto rounded-lg border"
          >
            <table class="w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/50">
                  <th class="p-1.5 text-left">SIC</th>
                  <th class="p-1.5 text-left">Termina</th>
                  <th class="p-1.5 text-left">Datos a completar</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in backfillTermReport.resueltos" :key="r.id" class="border-t">
                  <td class="p-1.5 font-mono">
                    {{ asTerminacionResuelta(r).codigo_sic_contrato }}
                  </td>
                  <td class="p-1.5">{{ fmt(asTerminacionResuelta(r).fecha_fin) }}</td>
                  <td class="p-1.5 text-muted-foreground">
                    {{ Object.values(asTerminacionResuelta(r).cambios).join(' · ') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <details v-if="backfillTermReport.no_resueltos?.length" class="text-xs">
            <summary class="cursor-pointer text-warning">
              {{ backfillTermReport.no_resueltos.length }} sin resolver (ver)
            </summary>
            <ul class="mt-1 list-disc pl-4 text-muted-foreground">
              <li v-for="r in backfillTermReport.no_resueltos" :key="r.id">
                SIC {{ r.codigo_sic_contrato }} — {{ r.motivo }}
              </li>
            </ul>
          </details>

          <p v-if="!backfillTermPendiente" class="text-xs text-muted-foreground">
            No hay nada para completar.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            :disabled="backfillTermExecuting"
            @click="backfillTermDialog = false"
            >Cancelar</Button
          >
          <Button
            :disabled="backfillTermExecuting || !backfillTermPendiente"
            @click="applyBackfillTerm"
          >
            <LoaderCircleIcon v-if="backfillTermExecuting" class="animate-spin" />
            <CheckIcon v-else />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Diálogo: completar nombres internos faltantes (backfill) -->
    <Dialog v-model:open="backfillDialog">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Completar nombres internos</DialogTitle>
        </DialogHeader>
        <div v-if="backfillReport" class="space-y-3 text-sm">
          <p class="text-muted-foreground">
            Se rellenará el <b>nombre interno</b> de los registros que lo tengan vacío, tomándolo
            del contrato PPA correspondiente. No se inventan nombres: los que no tengan un PPA con
            nombre se listan sin tocar.
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <span
              ><b>{{ backfillReport.a_actualizar }}</b> se completarán</span
            >
            <span v-if="backfillReport.sin_resolver" class="text-warning"
              ><b>{{ backfillReport.sin_resolver }}</b> sin resolver</span
            >
            <span v-if="backfillReport.total_sin_nombre" class="text-muted-foreground"
              >{{ backfillReport.total_sin_nombre }} sin nombre en total</span
            >
          </div>

          <div
            v-if="backfillReport.resueltos?.length"
            class="max-h-60 overflow-y-auto rounded-lg border"
          >
            <table class="w-full border-collapse text-xs">
              <thead>
                <tr class="bg-muted/50">
                  <th class="p-1.5 text-left">Contrato</th>
                  <th class="p-1.5 text-left">Nombre interno a aplicar</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in backfillReport.resueltos" :key="r.id" class="border-t">
                  <td class="p-1.5 font-mono">{{ asNombreResuelto(r).contrato_interno || '—' }}</td>
                  <td class="p-1.5">{{ asNombreResuelto(r).nombre_propuesto }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <details v-if="backfillReport.no_resueltos?.length" class="text-xs">
            <summary class="cursor-pointer text-warning">
              {{ backfillReport.no_resueltos.length }} sin resolver (ver)
            </summary>
            <ul class="mt-1 list-disc pl-4 text-muted-foreground">
              <li v-for="r in backfillReport.no_resueltos" :key="r.id">
                {{ r.contrato_interno || `ID ${r.id}` }} — {{ r.motivo }}
              </li>
            </ul>
          </details>

          <p v-if="!backfillReport.a_actualizar" class="text-xs text-muted-foreground">
            No hay nada para completar.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" :disabled="backfillExecuting" @click="backfillDialog = false"
            >Cancelar</Button
          >
          <Button
            :disabled="backfillExecuting || !backfillReport?.a_actualizar"
            @click="applyBackfill"
          >
            <LoaderCircleIcon v-if="backfillExecuting" class="animate-spin" />
            <CheckIcon v-else />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
