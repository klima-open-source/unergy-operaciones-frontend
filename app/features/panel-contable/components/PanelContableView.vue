<script setup lang="ts">
/**
 * Panel Contable: arma y liquida el estado de resultados por período y
 * proyecto. La API es la fuente de verdad — el Excel del ER queda solo para
 * NEU y Nitro, cuyo dato en la API está malo.
 */
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  SearchIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { logger } from '~/core/logger'
import CargarErDialog from '~/features/panel-contable/components/CargarErDialog.vue'
import ClasificacionTab from '~/features/panel-contable/components/ClasificacionTab.vue'
import DetalleProyecto from '~/features/panel-contable/components/DetalleProyecto.vue'
import DiferenciaTab from '~/features/panel-contable/components/DiferenciaTab.vue'
import PanelFiltros from '~/features/panel-contable/components/PanelFiltros.vue'
import SeleccionTab from '~/features/panel-contable/components/SeleccionTab.vue'
import {
  DOCUMENTO_DE_GRUPO,
  GRUPOS_DE_DOCUMENTO,
  MESES,
  TABS,
} from '~/features/panel-contable/constants'
import { PanelContableService } from '~/features/panel-contable/services/panel-contable'
import {
  type DocumentoContable,
  type LineaPanel,
  type PanelContable,
  type RechazoEr,
  type RespuestaArmarPeriodo,
  type RespuestaCargarEr,
  type RespuestaConsecutivosUsados,
  type RespuestaContraste,
  FiltroEstadoLiquidacion,
  FiltroMarcador,
  GrupoLinea,
  TabPanelContable,
  TipoLiquidacion,
  TipoPanel,
} from '~/features/panel-contable/types'
import { fmt, parseCeldaOrigen } from '~/features/panel-contable/utils/formatters'

const panelContableService = new PanelContableService()

// ── Período: arranca en el MES ANTERIOR (el panel es de mes vencido, el mes en
// curso suele estar vacío). Se navega con las flechas ‹ › (mismo patrón que Facturación). ──
function mesPanelISO(delta = 0): string {
  const n = new Date()
  const d = new Date(n.getFullYear(), n.getMonth() + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const periodo = ref(mesPanelISO(-1))
const esMesActual = computed(() => periodo.value === mesPanelISO(0))
const periodoLabel = computed(() => {
  const [y, m] = periodo.value.split('-')
  return `${MESES[Number(m) - 1] || ''} ${y}`
})
function stepMes(delta: number) {
  const [y = 0, m = 1] = periodo.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const siguiente = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (delta > 0 && siguiente > mesPanelISO(0)) return
  periodo.value = siguiente
}

// ── Pestañas. En "Selección" se gestionan los flags de un tipo (preliq/oficial)
// con `selTipo`; en las pestañas de detalle el tipo es la propia pestaña. ──
const tab = ref<TabPanelContable>(TabPanelContable.PRELIQUIDACION)
const selTipo = ref<TipoPanel>(TipoPanel.OFICIAL)
const tipoDatos = computed<TipoPanel>(() => {
  if (tab.value === TabPanelContable.SELECCION) return selTipo.value
  return tab.value === TabPanelContable.OFICIAL ? TipoPanel.OFICIAL : TipoPanel.PRELIQUIDACION
})
const mostrarPaneles = computed(() =>
  (
    [
      TabPanelContable.PRELIQUIDACION,
      TabPanelContable.OFICIAL,
      TabPanelContable.SELECCION,
    ] as TabPanelContable[]
  ).includes(tab.value),
)

// ── Armar desde la API y contrastar: el Panel se arma desde `income_statement_data`. ──
const armando = ref(false)
const contrastando = ref(false)
const resultado = ref<RespuestaArmarPeriodo | null>(null)
const contraste = ref<RespuestaContraste | null>(null)
const proyectosConDiferencias = computed(
  () => contraste.value?.proyectos.filter((p) => p.diferencias?.length) || [],
)

async function armarPeriodo() {
  armando.value = true
  resultado.value = null
  try {
    const data = await panelContableService.armarPeriodo({
      periodo: periodo.value,
      tipo: tipoDatos.value,
    })
    resultado.value = data
    toast.success(`${data.armados} paneles armados`, {
      description: data.omitidos.length
        ? `${data.omitidos.length} omitidos (NEU/Nitro): siguen con su Excel.`
        : 'Todos los proyectos del período.',
      duration: 7000,
    })
    await cargarPaneles()
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo armar el período', {
      description: normalizeError(err).message,
      duration: 8000,
    })
  } finally {
    armando.value = false
  }
}

async function verContraste() {
  contrastando.value = true
  try {
    contraste.value = await panelContableService.obtenerContraste({
      periodo: periodo.value,
      tipo: tipoDatos.value,
    })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo contrastar', {
      description: normalizeError(err).message,
      duration: 8000,
    })
  } finally {
    contrastando.value = false
  }
}

// ── Paneles: lista compartida por Preliquidación, Oficial y Selección. ──
const loading = ref(false)
const cargaError = ref(false)
const paneles = ref<PanelContable[]>([])
const clasMap = ref<Record<number, TipoLiquidacion>>({})

async function cargarPaneles() {
  loading.value = true
  cargaError.value = false
  try {
    const data = await panelContableService.listar({
      periodo: periodo.value,
      tipo: tipoDatos.value,
    })
    paneles.value = data.paneles || []
    cargarClasMap()
    // Consecutivos SOLO en oficial (la preliquidación no lleva). Trae los usados
    // globalmente (para avisar/sugerir) y numera solo los faltantes.
    if (tipoDatos.value === TipoPanel.OFICIAL) {
      await cargarConsInfo()
      if (paneles.value.some((p) => p.liquidar_ingresos || p.liquidar_costos)) {
        await reasignar(true)
      }
    }
  } catch (err) {
    cargaError.value = true
    paneles.value = []
    logger.error('panel-contable', err)
    toast.error('Error', { description: 'No se pudieron cargar los paneles', duration: 4000 })
  } finally {
    loading.value = false
  }
}

async function cargarClasMap() {
  try {
    const data = await panelContableService.obtenerClasificacion(periodo.value)
    clasMap.value = Object.fromEntries((data.proyectos || []).map((c) => [c.proyecto_id, c.tipo]))
  } catch {
    /* el filtro por tipo queda inactivo si falla */
  }
}

onMounted(cargarPaneles)
watch([tab, periodo, selTipo], () => {
  if (mostrarPaneles.value) cargarPaneles()
})

// `DetalleProyecto` remapea celdas y gestiona fuentes de ingreso; cuando el
// backend devuelve el panel entero, lo reemplazamos aquí — mutarlo desde el
// hijo sería mutar una prop.
function onActualizarPanel(nuevo: PanelContable) {
  const objetivo = paneles.value.find((p) => p.id === nuevo.id)
  if (objetivo) Object.assign(objetivo, nuevo)
}

// ── Filtros de la lista de proyectos ──
const fProyecto = ref('')
const fTipo = ref<TipoLiquidacion | ''>('')
const fEstado = ref<FiltroEstadoLiquidacion | ''>('')
const fMarcador = ref<FiltroMarcador | ''>('')
const fInv = ref('')
const fBloque = ref<DocumentoContable | ''>('')

const inversionistasLista = computed(() => {
  const s = new Set<string>()
  for (const p of paneles.value)
    for (const inv of p.inversionistas || []) if (inv.nombre) s.add(inv.nombre)
  return [...s].sort((a, b) => a.localeCompare(b))
})

const panelesFiltrados = computed(() =>
  paneles.value.filter((p) => {
    const q = fProyecto.value.trim().toLowerCase()
    if (q && !(p.proyecto || '').toLowerCase().includes(q)) return false
    if (fInv.value && !(p.inversionistas || []).some((i) => (i.nombre || '') === fInv.value))
      return false
    if (fTipo.value && (clasMap.value[p.proyecto_id] || TipoLiquidacion.NORMAL) !== fTipo.value)
      return false
    if (fEstado.value) {
      const liq = p.liquidar_ingresos || p.liquidar_costos
      if (fEstado.value === FiltroEstadoLiquidacion.LIQUIDA && !liq) return false
      if (fEstado.value === FiltroEstadoLiquidacion.NO_LIQUIDA && liq) return false
      if (
        fEstado.value === FiltroEstadoLiquidacion.SOLO_INGRESOS &&
        !(p.liquidar_ingresos && !p.liquidar_costos)
      )
        return false
      if (
        fEstado.value === FiltroEstadoLiquidacion.SOLO_COSTOS &&
        !(!p.liquidar_ingresos && p.liquidar_costos)
      )
        return false
      if (fEstado.value === FiltroEstadoLiquidacion.GENERA_MANDATOS && !p.generar_mandatos)
        return false
    }
    if (fMarcador.value === FiltroMarcador.CON_COSTOS && !p.tiene_costos) return false
    if (fMarcador.value === FiltroMarcador.SIN_COSTOS && p.tiene_costos) return false
    if (fMarcador.value === FiltroMarcador.BOLSA && !p.tiene_bolsa) return false
    return true
  }),
)

// ── Selección: flags en lote y consecutivos ──
type FlagPanel = 'liquidar_ingresos' | 'liquidar_costos' | 'generar_mandatos'

// Aplica un cambio de flags en lote con rollback: si algún PATCH falla, revierte
// SOLO esos paneles a su valor previo y avisa.
function aplicarLoteFlags(campos: FlagPanel[], val: boolean, trasReasignar = true) {
  const prev = paneles.value.map((p) => ({
    p,
    viejo: Object.fromEntries(campos.map((c) => [c, p[c]])),
  }))
  paneles.value.forEach((p) =>
    campos.forEach((c) => {
      p[c] = val
    }),
  )
  Promise.all(
    paneles.value.map((p) => {
      const payload = Object.fromEntries(campos.map((c) => [c, p[c]]))
      return panelContableService
        .actualizarPanel(p.id, payload)
        .then(() => null)
        .catch(() => p.id)
    }),
  ).then((resultados) => {
    const fallidos = new Set(resultados.filter((id): id is number => id !== null))
    if (fallidos.size) {
      prev.forEach(({ p, viejo }) => {
        if (fallidos.has(p.id)) Object.assign(p, viejo)
      })
      toast.warning('Algunos no se guardaron', {
        description: `${fallidos.size} panel(es) revertido(s)`,
        duration: 3500,
      })
    }
    if (trasReasignar) reasignar()
  })
}
function selAll(campo: FlagPanel, val: boolean) {
  // El usuario decide qué liquidar; 'liquidar_costos' ya no se ata a si el ER trajo costos.
  aplicarLoteFlags([campo], val, campo !== 'generar_mandatos')
}
function selNinguno() {
  aplicarLoteFlags(['liquidar_ingresos', 'liquidar_costos'], false, true)
}
async function onFlag(p: PanelContable) {
  // v-model ya aplicó el cambio en `p`; si el PATCH falla, resincronizamos desde
  // el backend (autoritativo) para que el control refleje lo realmente guardado.
  try {
    await panelContableService.actualizarPanel(p.id, {
      liquidar_ingresos: p.liquidar_ingresos,
      liquidar_costos: p.liquidar_costos,
      generar_mandatos: p.generar_mandatos,
    })
    reasignar()
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se guardó', { description: 'Recargando estado…', duration: 3000 })
    cargarPaneles()
  }
}

const consIngIni = ref(793)
const consCosIni = ref(850)
const consInfo = ref<RespuestaConsecutivosUsados | null>(null)

async function cargarConsInfo() {
  try {
    consInfo.value = await panelContableService.obtenerConsecutivosUsados()
  } catch {
    consInfo.value = null
  }
}
const reasignarTodo = () => reasignar(false)
function onCambiarConsecutivo(cadena: 'ing' | 'cos', valor: number) {
  if (cadena === 'ing') consIngIni.value = valor
  else consCosIni.value = valor
  reasignarTodo()
}
function onUsarSiguiente(cadena: 'ing' | 'cos') {
  if (!consInfo.value) return
  if (cadena === 'ing') consIngIni.value = consInfo.value.ingresos.siguiente
  else consCosIni.value = consInfo.value.costos.siguiente
  reasignarTodo()
}
// soloFaltantes=true (default): rellena los consecutivos en null preservando los
// ya asignados/editados. false: renumera todo desde el valor inicial.
async function reasignar(soloFaltantes = true) {
  try {
    const data = await panelContableService.reasignarConsecutivos({
      periodo: periodo.value,
      tipo: tipoDatos.value,
      consecutivo_ingresos_inicial: Number(consIngIni.value) || 0,
      consecutivo_costos_inicial: Number(consCosIni.value) || 0,
      solo_faltantes: soloFaltantes,
    })
    const map = new Map(data.asignados.map((a) => [a.panel_id, a]))
    paneles.value.forEach((p) => {
      const fresh = map.get(p.id)
      if (fresh) {
        p.consecutivo_ingresos = fresh.consecutivo_ingresos ?? null
        p.consecutivo_costos = fresh.consecutivo_costos ?? null
      }
    })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.warning('Consecutivos', {
      description: 'No se pudieron reasignar los consecutivos',
      duration: 3500,
    })
  }
}

async function onCeldaCambiada(panel: PanelContable, linea: LineaPanel, texto: string) {
  const celda = parseCeldaOrigen(texto)
  if (!celda) {
    toast.warning('Formato inválido', {
      description: 'Usa hoja!celda, ej. Sheet1!H35',
      duration: 3500,
    })
    return
  }
  try {
    const data = await panelContableService.mapearCelda({
      proyecto_id: panel.proyecto_id,
      periodo: periodo.value,
      tipo: tipoDatos.value,
      concepto: linea.concepto,
      hoja: celda.hoja,
      celda: celda.celda,
    })
    Object.assign(panel, data)
    toast.success('Celda actualizada', {
      description: `${linea.concepto} ← ${celda.hoja}!${celda.celda}`,
      duration: 2500,
    })
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('No se pudo remapear la celda', {
      description: normalizeError(err).message,
      duration: 4500,
    })
  }
}

// ── Flujo de carga: confirmar período en diálogo → abrir selector de archivos.
// El Excel quedó SOLO para NEU y Nitro: su dato en la API está malo. ──
const showPeriodoDialog = ref(false)
const tipoCarga = ref<TipoPanel>(TipoPanel.PRELIQUIDACION)
const tipoCargaConfirm = ref<TipoLiquidacion>(TipoLiquidacion.NORMAL)
const rechazados = ref<RechazoEr[]>([])
const resultadoCarga = ref<RespuestaCargarEr | null>(null)
const uploading = ref(0)
const erInput = ref<HTMLInputElement | null>(null)

function onConfirmarCarga(payload: {
  periodo: string
  tipo: TipoPanel
  tipoCarga: TipoLiquidacion
}) {
  periodo.value = payload.periodo
  tipoCarga.value = payload.tipo
  tipoCargaConfirm.value = payload.tipoCarga
  tab.value =
    payload.tipo === TipoPanel.OFICIAL ? TabPanelContable.OFICIAL : TabPanelContable.PRELIQUIDACION
  nextTick(() => erInput.value?.click())
}

async function onErSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  const tipoSubida = tipoCarga.value
  uploading.value = files.length
  resultadoCarga.value = null
  rechazados.value = []
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  fd.append('periodo', periodo.value)
  fd.append('tipo', tipoSubida)
  fd.append('tipo_carga', tipoCargaConfirm.value)
  try {
    const data = await panelContableService.cargarEr(fd)
    resultadoCarga.value = data
    rechazados.value = data.rechazados || []
    toast.success('ER procesados', {
      description: `${data.cargados?.length || 0} proyecto(s)`,
      duration: 3500,
    })
    // Tras cargar la OFICIAL, ir a Diferencia para mostrar la comparación al instante.
    if (tipoSubida === TipoPanel.OFICIAL) tab.value = TabPanelContable.DIFERENCIA
    else await cargarPaneles()
  } catch (err) {
    logger.error('panel-contable', err)
    toast.error('Error', { description: normalizeError(err).message, duration: 5000 })
  } finally {
    uploading.value = 0
    input.value = ''
  }
}

// ── Exportar a Excel (tabla plana, formato del Excel maestro "Ajustes") ──
// Una fila por (proyecto, inversionista, documento contable, concepto).
async function exportarExcel() {
  const XLSX = await import('xlsx-js-style')
  const gruposBloque = fBloque.value ? GRUPOS_DE_DOCUMENTO[fBloque.value] : null
  interface FilaExcel {
    Proyecto: string
    Inversionista: string
    'Documento contable': string
    Contrato: string
    Concepto: string
    Total: number
    'Referencia Factura': string
    Consecutivo: number | string
    Comprobante: string
  }
  const rows: FilaExcel[] = []
  for (const p of panelesFiltrados.value) {
    for (const inv of p.inversionistas || []) {
      if (fInv.value && inv.nombre !== fInv.value) continue
      for (const l of inv.lineas || []) {
        if (gruposBloque && !gruposBloque.includes(l.grupo)) continue
        const esMandato = l.grupo === GrupoLinea.INGRESOS || l.grupo === GrupoLinea.COMERCIALIZACION
        rows.push({
          Proyecto: p.proyecto,
          Inversionista: inv.nombre || '',
          'Documento contable': DOCUMENTO_DE_GRUPO[l.grupo] || l.grupo,
          Contrato: '',
          Concepto: l.concepto,
          Total: Math.round(Number(l.valor_cop) || 0),
          'Referencia Factura': '',
          Consecutivo: esMandato
            ? (p.consecutivo_ingresos ?? '')
            : l.grupo === GrupoLinea.COSTOS
              ? (p.consecutivo_costos ?? '')
              : '',
          Comprobante: l.comprobante_contable || '',
        })
      }
    }
  }
  if (!rows.length) {
    toast.warning('Nada que exportar', {
      description: 'No hay filas con los filtros actuales',
      duration: 3000,
    })
    return
  }
  const headers: (keyof FilaExcel)[] = [
    'Proyecto',
    'Inversionista',
    'Documento contable',
    'Contrato',
    'Concepto',
    'Total',
    'Referencia Factura',
    'Consecutivo',
    'Comprobante',
  ]
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h]))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Estilos de celda: la librería del Excel solo acepta RGB literal, no tokens Tailwind.
  const borde = { style: 'thin', color: { rgb: 'E5E2EC' } }
  const bordes = { top: borde, bottom: borde, left: borde, right: borde }
  const tinteDoc: Record<string, { fill: string; text: string }> = {
    Mandato: { fill: 'E6F1FB', text: '0C447C' },
    Costos: { fill: 'FAEEDA', text: '854F0B' },
    Factura: { fill: 'EEEDFE', text: '3C3489' },
  }
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c })
    ws[ref].s = {
      fill: { fgColor: { rgb: '915BD8' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: bordes,
    }
  })
  rows.forEach((r, i) => {
    const rr = i + 1
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: rr, c })
      if (!ws[ref]) continue
      ws[ref].s = { border: bordes, alignment: { vertical: 'center' } }
    }
    const tinte = tinteDoc[r['Documento contable']]
    if (tinte) {
      const ref = XLSX.utils.encode_cell({ r: rr, c: 2 })
      ws[ref].s = {
        ...ws[ref].s,
        fill: { fgColor: { rgb: tinte.fill } },
        font: { color: { rgb: tinte.text }, bold: true },
      }
    }
    const tref = XLSX.utils.encode_cell({ r: rr, c: 5 })
    ws[tref].s = {
      ...ws[tref].s,
      alignment: { horizontal: 'right' },
      font: { color: { rgb: r.Total < 0 ? 'C0392B' : '2C2039' } },
    }
    ws[tref].z = '#,##0'
  })
  ws['!cols'] = [
    { wch: 26 },
    { wch: 26 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
  ]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Panel')
  const mes = (periodoLabel.value || periodo.value).replace(/\s+/g, '_')
  XLSX.writeFile(wb, `Panel_${mes}_${tipoDatos.value}.xlsx`)
  toast.success('Excel exportado', { description: `${rows.length} filas`, duration: 2500 })
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Panel Contable">
      <template #subtitle>
        <span class="flex flex-wrap items-center gap-1.5">
          <GBadge color="information">{{ periodoLabel }}</GBadge>
          <span
            >división por % del backend (inversionistas activos del período) · IVA automático sobre
            costos</span
          >
        </span>
      </template>
      <template #actions>
        <div class="flex items-center gap-1">
          <GTooltip>
            <GTooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Mes anterior"
                @click="stepMes(-1)"
              >
                <ChevronLeftIcon />
              </Button>
            </GTooltipTrigger>
            <GTooltipContent side="bottom">Mes anterior</GTooltipContent>
          </GTooltip>
          <span class="min-w-24 text-center text-sm font-semibold text-foreground">{{
            periodoLabel
          }}</span>
          <GTooltip>
            <GTooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Mes siguiente"
                :disabled="esMesActual"
                @click="stepMes(1)"
              >
                <ChevronRightIcon />
              </Button>
            </GTooltipTrigger>
            <GTooltipContent side="bottom">Mes siguiente</GTooltipContent>
          </GTooltip>
        </div>

        <Button
          v-if="tab === TabPanelContable.PRELIQUIDACION || tab === TabPanelContable.OFICIAL"
          variant="outline"
          :disabled="loading || !paneles.length"
          @click="exportarExcel"
        >
          <FileSpreadsheetIcon />
          Exportar Excel
        </Button>

        <GTooltip v-if="mostrarPaneles">
          <GTooltipTrigger as-child>
            <Button variant="outline" :disabled="loading || contrastando" @click="verContraste">
              <LoaderCircleIcon v-if="contrastando" class="animate-spin" />
              <SearchIcon v-else />
              Contrastar
            </Button>
          </GTooltipTrigger>
          <GTooltipContent side="bottom"
            >Compara lo que daría la API contra lo que hay hoy. No guarda nada.</GTooltipContent
          >
        </GTooltip>

        <GTooltip v-if="mostrarPaneles">
          <GTooltipTrigger as-child>
            <Button :disabled="loading || armando" @click="armarPeriodo">
              <LoaderCircleIcon v-if="armando" class="animate-spin" />
              <ZapIcon v-else />
              Armar desde API
            </Button>
          </GTooltipTrigger>
          <GTooltipContent side="bottom"
            >Arma los paneles del período desde la API. NEU y Nitro siguen con su
            Excel.</GTooltipContent
          >
        </GTooltip>

        <!-- El Excel quedó SOLO para NEU y Nitro: su dato en la API está malo. -->
        <GTooltip v-if="mostrarPaneles">
          <GTooltipTrigger as-child>
            <Button variant="outline" :disabled="loading" @click="showPeriodoDialog = true">
              <UploadIcon />
              Cargar ER
              <GBadge size="sm" color="information">NEU/Nitro</GBadge>
            </Button>
          </GTooltipTrigger>
          <GTooltipContent side="bottom"
            >Solo para NEU y Nitro. El resto se arma desde la API.</GTooltipContent
          >
        </GTooltip>
        <input
          ref="erInput"
          type="file"
          accept=".xlsx,.xls"
          multiple
          class="hidden"
          @change="onErSelected"
        />
      </template>
    </PageHeader>

    <!-- Resultado de armar el período. Los omitidos se muestran siempre: sin eso
         parecería que el período quedó completo. -->
    <div
      v-if="resultado"
      class="space-y-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-foreground"
    >
      <div class="flex items-center gap-2 font-semibold">
        <CircleCheckIcon class="size-4" />
        <b>{{ resultado.armados }}</b> paneles armados desde la API
        <Button
          variant="ghost"
          size="icon-xs"
          class="ml-auto text-foreground/60 hover:text-foreground"
          @click="resultado = null"
        >
          <XIcon class="size-4" />
        </Button>
      </div>
      <div v-if="resultado.omitidos.length">
        <b>{{ resultado.omitidos.length }} omitidos</b> — siguen cargando su Excel:
        <span
          v-for="(o, i) in resultado.omitidos"
          :key="i"
          class="ml-1 inline-block rounded-md border border-success/30 bg-card px-1.5 py-0.5"
        >
          {{ o.proyecto }}
          <em class="font-bold text-success uppercase not-italic">{{ o.motivo }}</em>
        </span>
      </div>
      <div v-if="resultado.sin_cruce.length">
        <b>{{ resultado.sin_cruce.length }} sin cruce</b> — están en la API pero no en esta base:
        <span class="font-mono">{{ resultado.sin_cruce.join(', ') }}</span>
      </div>
      <div v-if="resultado.avisos.length" class="text-warning">
        <b>{{ resultado.avisos.length }} con avisos</b> de la API (cifras incompletas):
        <div v-for="(a, i) in resultado.avisos" :key="i" class="ml-3 text-xs">
          <b>{{ a.proyecto }}</b> — {{ a.avisos[0] }}
        </div>
      </div>
    </div>

    <!-- Contraste: qué se diferencia de lo que hay hoy. No guarda nada. -->
    <div v-if="contraste" class="space-y-2 rounded-xl border bg-card p-3 text-xs">
      <div class="flex items-center gap-2 font-semibold text-foreground">
        <SearchIcon class="size-4" />
        Contraste de {{ contraste.periodo }}: <b>{{ contraste.cuadran_exacto }}</b> de
        {{ contraste.paneles }} cuadran exacto
        <Button
          variant="ghost"
          size="icon-xs"
          class="ml-auto text-muted-foreground hover:text-foreground"
          @click="contraste = null"
        >
          <XIcon class="size-4" />
        </Button>
      </div>
      <div v-for="(p, i) in proyectosConDiferencias" :key="i">
        <div class="mb-1 font-semibold text-foreground">{{ p.proyecto }}</div>
        <table class="w-full text-xs">
          <tr v-for="(d, j) in p.diferencias" :key="j" class="border-t">
            <td class="py-0.5 pr-2 font-mono text-muted-foreground">{{ d.grupo }}</td>
            <td class="py-0.5 pr-2">{{ d.concepto }}</td>
            <td class="py-0.5 pr-2 text-right tabular-nums">
              {{ d.excel === null ? '—' : fmt(d.excel) }}
            </td>
            <td class="py-0.5 pr-2 text-right tabular-nums">
              {{ d.api === null ? '—' : fmt(d.api) }}
            </td>
            <td
              class="py-0.5 text-right tabular-nums"
              :class="d.diferencia < 0 ? 'text-destructive' : 'text-success'"
            >
              {{ fmt(d.diferencia) }}
            </td>
          </tr>
        </table>
      </div>
      <div v-if="!proyectosConDiferencias.length" class="text-muted-foreground">
        Ninguna diferencia: la API produce lo mismo que hay hoy.
      </div>
    </div>

    <GTabs v-model="tab">
      <GTabsList>
        <GTabsTrigger v-for="t in TABS" :key="t.value" :value="t.value">{{ t.label }}</GTabsTrigger>
      </GTabsList>

      <div
        v-if="uploading"
        class="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground"
      >
        <LoaderCircleIcon class="size-4 animate-spin" />
        Procesando ER ({{ uploading }})…
      </div>

      <div
        v-if="resultadoCarga"
        class="rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground"
      >
        <span v-if="resultadoCarga.cargados?.length"
          >{{ resultadoCarga.cargados.length }} cargados</span
        >
        <span v-if="resultadoCarga.sin_match?.length" class="text-destructive">
          · {{ resultadoCarga.sin_match.length }} sin match:
          {{ resultadoCarga.sin_match.join(', ') }}
        </span>
        <span v-if="resultadoCarga.rechazados?.length" class="text-warning">
          · {{ resultadoCarga.rechazados.length }} rechazados por clasificación
        </span>
        <span v-if="resultadoCarga.errores?.length" class="text-destructive">
          · {{ resultadoCarga.errores.length }} con error
        </span>
      </div>

      <!-- ER rechazados por clasificación cruzada -->
      <div
        v-if="rechazados.length"
        class="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning"
      >
        <div class="flex items-center gap-2 font-semibold">
          <TriangleAlertIcon class="size-4" />
          {{ rechazados.length }} ER no se cargaron — clasificación distinta a la sección elegida
        </div>
        <ul class="mt-2 ml-6 list-disc space-y-0.5">
          <li v-for="(r, i) in rechazados" :key="i">{{ r.mensaje }}</li>
        </ul>
      </div>

      <!-- ── PRELIQUIDACIÓN ── -->
      <GTabsContent :value="TabPanelContable.PRELIQUIDACION" class="space-y-3">
        <div v-if="loading" class="flex justify-center p-10">
          <Spinner class="size-6 text-muted-foreground" />
        </div>
        <template v-else>
          <PanelFiltros
            v-if="paneles.length"
            v-model:proyecto="fProyecto"
            v-model:tipo="fTipo"
            v-model:estado="fEstado"
            v-model:marcador="fMarcador"
            v-model:inversionista="fInv"
            v-model:bloque="fBloque"
            :inversionistas="inversionistasLista"
            :total="paneles.length"
            :mostrando="panelesFiltrados.length"
          />
          <div
            v-if="!panelesFiltrados.length"
            class="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground"
          >
            Ningún proyecto coincide con los filtros.
          </div>
          <div class="space-y-3">
            <DetalleProyecto
              v-for="(p, i) in panelesFiltrados"
              :key="p.id"
              :panel="p"
              :periodo="periodo"
              :tab="tipoDatos"
              :default-open="i === 0 && !!(p.liquidar_ingresos || p.liquidar_costos)"
              :bloque-filtro="fBloque"
              @actualizar-panel="onActualizarPanel"
            />
          </div>
        </template>
      </GTabsContent>

      <!-- ── OFICIAL ── -->
      <GTabsContent :value="TabPanelContable.OFICIAL" class="space-y-3">
        <div v-if="loading" class="flex justify-center p-10">
          <Spinner class="size-6 text-muted-foreground" />
        </div>
        <template v-else>
          <PanelFiltros
            v-if="paneles.length"
            v-model:proyecto="fProyecto"
            v-model:tipo="fTipo"
            v-model:estado="fEstado"
            v-model:marcador="fMarcador"
            v-model:inversionista="fInv"
            v-model:bloque="fBloque"
            :inversionistas="inversionistasLista"
            :total="paneles.length"
            :mostrando="panelesFiltrados.length"
          />
          <div
            v-if="!panelesFiltrados.length"
            class="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground"
          >
            Ningún proyecto coincide con los filtros.
          </div>
          <div class="space-y-3">
            <DetalleProyecto
              v-for="(p, i) in panelesFiltrados"
              :key="p.id"
              :panel="p"
              :periodo="periodo"
              :tab="tipoDatos"
              :default-open="i === 0 && !!(p.liquidar_ingresos || p.liquidar_costos)"
              :bloque-filtro="fBloque"
              @actualizar-panel="onActualizarPanel"
            />
          </div>
        </template>
      </GTabsContent>

      <!-- ── SELECCIÓN ── -->
      <GTabsContent :value="TabPanelContable.SELECCION" class="space-y-3">
        <div v-if="loading" class="flex justify-center p-10">
          <Spinner class="size-6 text-muted-foreground" />
        </div>
        <template v-else>
          <PanelFiltros
            v-if="paneles.length"
            v-model:proyecto="fProyecto"
            v-model:tipo="fTipo"
            v-model:estado="fEstado"
            v-model:marcador="fMarcador"
            v-model:inversionista="fInv"
            v-model:bloque="fBloque"
            :inversionistas="inversionistasLista"
            :total="paneles.length"
            :mostrando="panelesFiltrados.length"
          />
          <SeleccionTab
            v-model:tipo="selTipo"
            :paneles="paneles"
            :paneles-filtrados="panelesFiltrados"
            :cons-info="consInfo"
            :cons-ing-ini="consIngIni"
            :cons-cos-ini="consCosIni"
            :carga-error="cargaError"
            :periodo-label="periodoLabel"
            @reintentar="cargarPaneles"
            @sel-all="selAll"
            @sel-ninguno="selNinguno"
            @flag-changed="onFlag"
            @cambiar-consecutivo="onCambiarConsecutivo"
            @usar-siguiente="onUsarSiguiente"
            @celda-cambiada="onCeldaCambiada"
          />
        </template>
      </GTabsContent>

      <!-- ── DIFERENCIA ── -->
      <GTabsContent :value="TabPanelContable.DIFERENCIA">
        <DiferenciaTab :periodo="periodo" :periodo-label="periodoLabel" />
      </GTabsContent>

      <!-- ── CLASIFICACIÓN ── -->
      <GTabsContent :value="TabPanelContable.CLASIFICACION">
        <ClasificacionTab :periodo="periodo" :periodo-label="periodoLabel" />
      </GTabsContent>
    </GTabs>

    <CargarErDialog
      v-model:open="showPeriodoDialog"
      :tab-activa="tab"
      :periodo-actual="periodo"
      @confirmar="onConfirmarCarga"
    />
  </div>
</template>
