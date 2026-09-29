<script setup lang="ts">
/**
 * Vista B del módulo Retos Q — orquestador del trimestre.
 *
 * Todas las llamadas a la API del módulo salen de aquí: la matriz, el drawer y
 * los diálogos son componentes controlados que solo emiten intención. En
 * particular `guardarValor` se pasa como prop a la matriz y al drawer, así el
 * estado (`reto.metricas` y `reto.valores`) tiene una sola fuente de verdad.
 */
import type {
  MetricaReto,
  PayloadEditarTrimestre,
  PayloadMetricaReto,
  Reto,
  RetoResumen,
  SemanaReto,
} from '~/features/retos/types'
import {
  ChevronLeftIcon,
  CopyIcon,
  EllipsisIcon,
  FileSpreadsheetIcon,
  FlagIcon,
  PencilIcon,
  PlusIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { isFetchError, readDetail } from '~/core/errors'
import { RetosService } from '~/features/retos/services/retos'
import CopiarMetricasDialog from './CopiarMetricasDialog.vue'
import EditarTrimestreDialog from './EditarTrimestreDialog.vue'
import MetricaDialog from './MetricaDialog.vue'
import MetricaKpiCard from './MetricaKpiCard.vue'
import { borrarClave, fmtRango, TIPOS_AGREGACION } from './retosUi'

// La matriz y el drawer son pesados y no siempre se necesitan (estado vacío):
// se cargan bajo demanda.
const MatrizSemanal = defineAsyncComponent(() => import('./MatrizSemanal.vue'))
const SemanaDrawer = defineAsyncComponent(() => import('./SemanaDrawer.vue'))

interface GuardarValorArgs {
  metricaId: number
  semanaInicio: string
  valor: number | null
  nota: string | null
}

const retosService = new RetosService()

const route = useRoute()
const confirm = useConfirm()
const { user } = useAuth()

// ── Estado ──────────────────────────────────────────────────────────────
const reto = ref<Reto | null>(null)
const errorCarga = ref('')
const recargando = ref(false)
const retosAnio = ref<RetoResumen[]>([])
const anuncio = ref('')

const metricaVisible = ref(false)
const metricaEditando = ref<MetricaReto | null>(null)
const guardandoMetrica = ref(false)

const copiarVisible = ref(false)
const copiando = ref(false)

const editarVisible = ref(false)
const guardandoTrimestre = ref(false)
const errorTrimestre = ref('')

const drawerVisible = ref(false)
const semanaActivaNumero = ref<number | null>(null)

// ── Derivados ───────────────────────────────────────────────────────────
const retoId = computed(() => Number(route.params.id))

const titulo = computed(() => {
  const r = reto.value
  if (!r) return 'Retos Q'
  return r.nombre || `Retos Q${r.trimestre} ${r.anio}`
})

const metricas = computed(() => reto.value?.metricas || [])
const hayMetricas = computed(() => metricas.value.length > 0)

const metricasActivas = computed(() =>
  metricas.value
    .filter((m) => m.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
)

const nombresDestino = computed(() => metricas.value.map((m) => m.nombre))

const otrosRetos = computed(() => retosAnio.value.filter((r) => r.id !== reto.value?.id))

const hayOrigenCopiable = computed(() =>
  otrosRetos.value.some((r) => (r.total_metricas ?? (r.metricas || []).length) > 0),
)

const subtitulo = computed(() => {
  const r = reto.value
  if (!r) return ''
  const partes = [fmtRango(r.fecha_inicio, r.fecha_fin)]
  const n = r.total_semanas || 0
  partes.push(`${n} ${n === 1 ? 'semana' : 'semanas'}`)
  if (r.estado_periodo === 'proximo') partes.push('aún no empieza')
  else if (r.estado_periodo === 'cerrado') partes.push('cerrado')
  else if (r.semana_actual) partes.push(`S${r.semana_actual} en curso`)
  const nm = metricas.value.length
  if (nm > 0) partes.push(`${nm} ${nm === 1 ? 'métrica' : 'métricas'}`)
  return partes.join(' · ')
})

/** La semana que abre el CTA: la de hoy, la última si ya cerró, la 1 si no empieza. */
const semanaCta = computed(() => {
  const r = reto.value
  if (!r) return 1
  if (r.semana_actual) return r.semana_actual
  if (r.estado_periodo === 'cerrado') return r.total_semanas || 1
  return 1
})

const semanaActivaObj = computed<SemanaReto | null>(
  () => (reto.value?.semanas || []).find((s) => s.numero === semanaActivaNumero.value) || null,
)

// ── Utilidades ──────────────────────────────────────────────────────────
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function fechaLarga(iso: string | null | undefined) {
  if (!iso) return '—'
  const [, m, d] = String(iso).split('-').map(Number)
  if (!m || !d) return '—'
  return `${d} de ${MESES_LARGOS[m - 1]}`
}

function mensajeError(err: unknown, fallback = 'Ocurrió un error inesperado') {
  if (isFetchError(err)) {
    const detalle = readDetail(err.data)
    if (detalle) return detalle
    if (err.status === 404) return 'El trimestre o la métrica ya no existe.'
    if (err.status === 409) return 'El cambio choca con un registro existente.'
  }
  return fallback
}

// ── Carga ───────────────────────────────────────────────────────────────
async function cargar() {
  errorCarga.value = ''
  try {
    const data = await retosService.obtener(retoId.value)
    reto.value = data
    cargarRetosAnio(data.anio)
  } catch (e) {
    reto.value = null
    errorCarga.value = mensajeError(e, 'No se pudo cargar el trimestre.')
  }
}

/**
 * Los otros Q del mismo año alimentan `CopiarMetricasDialog`. Se pide solo el
 * año del reto: `GET /retos?anio=` autocrea los 4 trimestres de ese año, así
 * que consultar años vecinos crearía filas que nadie pidió.
 */
async function cargarRetosAnio(anio: number) {
  if (!anio) return
  try {
    const data = await retosService.listarPorAnio(anio)
    retosAnio.value = data?.retos || []
  } catch {
    retosAnio.value = []
  }
}

onMounted(cargar)
watch(retoId, () => {
  reto.value = null
  cargar()
})
watch(editarVisible, (v) => {
  if (v) errorTrimestre.value = ''
})

// ── Estado local de valores ─────────────────────────────────────────────
function aplicarMetrica(m: MetricaReto | null | undefined) {
  if (!reto.value || !m) return
  const arr = reto.value.metricas || (reto.value.metricas = [])
  const i = arr.findIndex((x) => x.id === m.id)
  if (i >= 0) arr.splice(i, 1, m)
  else arr.push(m)
  reto.value.total_metricas = arr.length
}

/**
 * El PUT devuelve la MetricaResumen recalculada, no la celda: la entrada de
 * `valores` se compone acá para que la matriz y el drawer vean el cambio.
 */
function aplicarValor(
  metricaId: number,
  semanaInicio: string,
  valor: number | null,
  nota: string | null,
) {
  if (!reto.value) return
  if (!reto.value.valores) reto.value.valores = {}
  const clave = String(metricaId)
  if (!reto.value.valores[clave]) reto.value.valores[clave] = {}
  const mapa = reto.value.valores[clave]!
  const sinValor = valor === null || valor === undefined
  const sinNota = !String(nota ?? '').trim()

  if (sinValor && sinNota) {
    borrarClave(mapa, semanaInicio)
  } else {
    mapa[semanaInicio] = {
      valor: sinValor ? null : Number(valor),
      nota: sinNota ? null : nota,
      actualizado_por: user.value?.name || mapa[semanaInicio]?.actualizado_por || null,
      updated_at: new Date().toISOString(),
    }
  }
  recalcularSemanasConDatos()
}

/** El banner "sin datos todavía" depende de esto; el backend solo lo manda al recargar. */
function recalcularSemanasConDatos() {
  const r = reto.value
  if (!r) return
  const valores = r.valores || {}
  let n = 0
  for (const s of r.semanas || []) {
    const hay = Object.values(valores).some((mapa) => {
      const v = mapa?.[s.inicio]?.valor
      return v !== null && v !== undefined
    })
    if (hay) n += 1
  }
  r.semanas_con_datos = n
}

/**
 * Contrato con `MatrizSemanal` y `SemanaDrawer`: los hijos no llaman a la API,
 * invocan esto y reaccionan a que resuelva o lance.
 */
async function guardarValor({ metricaId, semanaInicio, valor, nota }: GuardarValorArgs) {
  const cuerpo = { valor: valor ?? null, nota: nota || null }
  try {
    const data = await retosService.guardarValorSemanal(metricaId, semanaInicio, cuerpo)
    aplicarMetrica(data)
    aplicarValor(metricaId, semanaInicio, cuerpo.valor, cuerpo.nota)
    anuncio.value = 'Guardado'
    return data
  } catch (e) {
    anuncio.value = 'No se pudo guardar'
    // El hijo pinta la celda o la fila en error con este `detail`.
    throw e
  }
}

// ── Métricas ────────────────────────────────────────────────────────────
function abrirNuevaMetrica() {
  metricaEditando.value = null
  metricaVisible.value = true
}

function abrirEditarMetrica(m: MetricaReto | null) {
  metricaEditando.value = m || null
  metricaVisible.value = true
}

async function submitMetrica(payload: PayloadMetricaReto) {
  if (!reto.value) return
  guardandoMetrica.value = true
  const editando = metricaEditando.value
  try {
    const data = editando
      ? await retosService.actualizarMetrica(editando.id, payload)
      : await retosService.crearMetrica(reto.value.id, payload)
    aplicarMetrica(data)
    metricaVisible.value = false
    toast.success(editando ? 'Métrica actualizada' : 'Métrica creada')
  } catch (e) {
    toast.error(editando ? 'No se pudo actualizar la métrica' : 'No se pudo crear la métrica', {
      description: mensajeError(e),
    })
  } finally {
    guardandoMetrica.value = false
  }
}

async function alternarActiva(m: MetricaReto) {
  try {
    const data = await retosService.alternarActivaMetrica(m.id, { activa: !m.activa })
    aplicarMetrica(data)
    toast.success('Métrica actualizada')
  } catch (e) {
    toast.error('No se pudo actualizar la métrica', { description: mensajeError(e) })
  }
}

function confirmarEliminarMetrica(m: MetricaReto | null) {
  if (!m) return
  const n = m.semanas_con_dato ?? 0
  const cola = n === 0 ? '' : n === 1 ? ' y su valor semanal' : ` y sus ${n} valores semanales`
  confirm({
    title: 'Eliminar métrica',
    description: `Se eliminará "${m.nombre}"${cola}. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => eliminarMetrica(m),
  })
}

async function eliminarMetrica(m: MetricaReto) {
  try {
    await retosService.eliminarMetrica(m.id)
    const arr = reto.value?.metricas || []
    const i = arr.findIndex((x) => x.id === m.id)
    if (i >= 0) arr.splice(i, 1)
    if (reto.value) {
      reto.value.total_metricas = arr.length
      if (reto.value.valores) borrarClave(reto.value.valores, String(m.id))
      recalcularSemanasConDatos()
    }
    toast.success('Métrica eliminada')
  } catch (e) {
    toast.error('No se pudo eliminar la métrica', { description: mensajeError(e) })
  }
}

/** Clic en un KPI: lleva el ojo a la fila correspondiente de la matriz. */
function enfocarMetrica(m: MetricaReto | null) {
  if (!m) return
  nextTick(() => {
    const destino =
      document.querySelector(`[data-metrica-id="${m.id}"]`) ||
      document.getElementById(`rq-fila-${m.id}`)
    if (!destino) return
    destino.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    destino.classList.add('rq-flash')
    window.setTimeout(() => destino.classList.remove('rq-flash'), 1200)
  })
}

// ── Copiar métricas ─────────────────────────────────────────────────────
async function submitCopiar(origenId: number) {
  if (!reto.value || !origenId) return
  copiando.value = true
  // El contrato no fija si la respuesta trae solo las nuevas o todas: el delta
  // de ids contra el estado previo da el conteo correcto en ambos casos.
  const antes = new Set((reto.value.metricas || []).map((m) => m.id))
  const origen = otrosRetos.value.find((r) => r.id === origenId)
  try {
    await retosService.copiarMetricasDesde(reto.value.id, origenId)
    await cargar()
    copiarVisible.value = false
    const nuevas = (reto.value?.metricas || []).filter((m) => !antes.has(m.id)).length
    if (!nuevas) {
      toast.info('No había métricas nuevas por copiar')
    } else {
      const nombre =
        origen?.nombre || `Retos Q${origen?.trimestre ?? ''} ${origen?.anio ?? ''}`.trim()
      toast.success('Métricas copiadas', {
        description: `Se agregaron ${nuevas} ${nuevas === 1 ? 'métrica' : 'métricas'} desde ${nombre}`,
      })
    }
  } catch (e) {
    toast.error('No se pudieron copiar las métricas', { description: mensajeError(e) })
  } finally {
    copiando.value = false
  }
}

// ── Editar trimestre ────────────────────────────────────────────────────
async function submitTrimestre(payload: PayloadEditarTrimestre) {
  if (!reto.value) return
  const cambianFechas =
    payload.fecha_inicio !== reto.value.fecha_inicio || payload.fecha_fin !== reto.value.fecha_fin
  guardandoTrimestre.value = true
  errorTrimestre.value = ''
  if (cambianFechas) recargando.value = true
  try {
    const data = await retosService.actualizarTrimestre(reto.value.id, payload)
    reto.value = data
    editarVisible.value = false
    toast.success('Trimestre actualizado')
  } catch (e) {
    const msg = mensajeError(e, 'No se pudo actualizar el trimestre')
    errorTrimestre.value = msg
    // Los 400 del contrato ya se ven bajo el campo de fecha; el resto sí sorprende.
    if (!isFetchError(e) || e.status !== 400) {
      toast.error('No se pudo actualizar el trimestre', { description: msg })
    }
  } finally {
    guardandoTrimestre.value = false
    recargando.value = false
  }
}

// ── Drawer semanal ──────────────────────────────────────────────────────
function abrirDrawerSemana(semana: SemanaReto | null) {
  if (!semana) return
  semanaActivaNumero.value = semana.numero
  drawerVisible.value = true
}

function abrirSemanaNumero(numero: number) {
  const semanas = reto.value?.semanas || []
  abrirDrawerSemana(semanas.find((s) => s.numero === numero) || semanas[0] || null)
}

function navegarSemana(delta: number) {
  const semanas = reto.value?.semanas || []
  if (!semanas.length) return
  const actual = semanaActivaNumero.value ?? semanas[0]!.numero
  const destino = Math.min(Math.max(actual + Number(delta || 0), 1), semanas.length)
  const s = semanas.find((x) => x.numero === destino)
  if (s) semanaActivaNumero.value = s.numero
}

// ── Exportar a Excel ────────────────────────────────────────────────────
async function exportarExcel() {
  const r = reto.value
  if (!r) return
  try {
    const XLSX = await import('xlsx-js-style')
    const C = {
      morado: '915BD8',
      oscuro: '2C2039',
      lila: 'F7F4FC',
      blanco: 'FFFFFF',
      gris: '6B5A8A',
      borde: 'ECE4F5',
    }

    const semanas = r.semanas || []
    const filas = (r.metricas || []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    const encabezado = [
      'Métrica',
      'Unidad',
      'Agregación',
      'Responsable',
      ...semanas.map((s) => `${s.etiqueta} · ${s.rango_label}`),
      'Consolidado',
      'Meta',
      'Cumplimiento %',
    ]
    const nCols = encabezado.length

    const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

    const aoa = [
      [r.nombre || `Retos Q${r.trimestre} ${r.anio}`],
      [`${fmtRango(r.fecha_inicio, r.fecha_fin)} · ${r.total_semanas || semanas.length} semanas`],
      [],
      encabezado,
      ...filas.map((m) => {
        const mapa = (r.valores || {})[String(m.id)] || {}
        return [
          m.activa === false ? `${m.nombre} (inactiva)` : m.nombre,
          m.unidad || '',
          TIPOS_AGREGACION.find((t) => t.value === m.tipo_agregacion)?.label ||
            m.tipo_agregacion ||
            '',
          m.responsable || '',
          ...semanas.map((s) => num(mapa[s.inicio]?.valor)),
          num(m.consolidado),
          num(m.meta),
          num(m.cumplimiento_pct),
        ]
      }),
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const celda = (fila: number, col: number) => ws[XLSX.utils.encode_cell({ r: fila, c: col })]

    ws['!cols'] = [
      { wch: 32 },
      { wch: 9 },
      { wch: 14 },
      { wch: 16 },
      ...semanas.map(() => ({ wch: 14 })),
      { wch: 14 },
      { wch: 12 },
      { wch: 15 },
    ]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(nCols - 1, 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(nCols - 1, 0) } },
    ]
    ws['!rows'] = [{ hpt: 22 }, { hpt: 15 }, { hpt: 6 }, { hpt: 30 }]

    if (celda(0, 0)) celda(0, 0)!.s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }
    if (celda(1, 0)) celda(1, 0)!.s = { font: { sz: 10, color: { rgb: C.gris } } }

    for (let c = 0; c < nCols; c++) {
      const cell = celda(3, c)
      if (!cell) continue
      cell.s = {
        font: { bold: true, sz: 9, color: { rgb: C.blanco } },
        fill: { fgColor: { rgb: C.morado } },
        alignment: { horizontal: c < 4 ? 'left' : 'center', vertical: 'center', wrapText: true },
      }
    }

    filas.forEach((m, i) => {
      const dec = Math.min(Math.max(Number(m.decimales) || 0, 0), 4)
      const fmtNum = dec > 0 ? `#,##0.${'0'.repeat(dec)}` : '#,##0'
      for (let c = 0; c < nCols; c++) {
        const cell = celda(4 + i, c)
        if (!cell) continue
        const estilo: Record<string, unknown> = {
          font: { sz: 10, color: { rgb: C.oscuro } },
          alignment: { horizontal: c < 4 ? 'left' : 'right' },
          border: { bottom: { style: 'thin', color: { rgb: C.borde } } },
        }
        if (i % 2 === 1) estilo.fill = { fgColor: { rgb: C.lila } }
        cell.s = estilo
        if (c >= 4 && typeof cell.v === 'number') {
          cell.z = c === nCols - 1 ? '#,##0.0"%"' : fmtNum
        }
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Q${r.trimestre} ${r.anio}`)
    XLSX.writeFile(wb, `Retos_Q${r.trimestre}_${r.anio}.xlsx`)
  } catch (e) {
    toast.error('No se pudo exportar', {
      description: mensajeError(e, 'No se pudo generar el archivo de Excel'),
    })
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Miga + cabecera ──────────────────────────────────────────────── -->
    <div>
      <NuxtLink
        to="/general/retos"
        class="mb-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
      >
        <ChevronLeftIcon class="size-3.5" />
        <span>Retos Q</span>
      </NuxtLink>

      <PageHeader v-if="reto" :title="titulo" :subtitle="subtitulo">
        <template #lead>
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary"
          >
            Q{{ reto.trimestre }}
          </div>
        </template>

        <template #actions>
          <template v-if="hayMetricas">
            <Button variant="outline" size="sm" @click="abrirNuevaMetrica">
              <PlusIcon class="size-4" />
              Métrica
            </Button>
            <Button size="sm" @click="abrirSemanaNumero(semanaCta)">
              <FlagIcon class="size-4 fill-current" />
              <span>Registrar semana {{ semanaCta }}</span>
            </Button>
          </template>

          <!-- Sin métricas la acción útil del header es traerlas de otro Q -->
          <GTooltip v-else>
            <GTooltipTrigger as-child>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!hayOrigenCopiable"
                  @click="copiarVisible = true"
                >
                  <CopyIcon class="size-4" />
                  Copiar de otro Q
                </Button>
              </span>
            </GTooltipTrigger>
            <GTooltipContent v-if="!hayOrigenCopiable"
              >No hay otros trimestres con métricas</GTooltipContent
            >
          </GTooltip>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm" aria-label="Más acciones del trimestre">
                <EllipsisIcon class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="editarVisible = true">
                <PencilIcon class="size-4" />
                Editar trimestre
              </DropdownMenuItem>
              <DropdownMenuItem @click="copiarVisible = true">
                <CopyIcon class="size-4" />
                Copiar métricas de otro Q
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="exportarExcel">
                <FileSpreadsheetIcon class="size-4" />
                Exportar a Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </template>
      </PageHeader>

      <div v-else-if="!errorCarga" class="flex items-center gap-2.5">
        <Skeleton class="size-10 rounded-xl" />
        <div class="min-w-0 flex-1">
          <Skeleton class="h-4.5 w-full max-w-56" />
          <Skeleton class="mt-2 h-3 w-full max-w-xs" />
        </div>
      </div>
    </div>

    <!-- Error de carga ───────────────────────────────────────────────── -->
    <Alert v-if="errorCarga" variant="destructive">
      <AlertDescription class="flex flex-wrap items-center gap-3">
        <span>{{ errorCarga }}</span>
        <Button variant="ghost" size="sm" @click="cargar()">Reintentar</Button>
      </AlertDescription>
    </Alert>

    <!-- Cargando: el layout es conocido, así que esqueleto y no spinner ─ -->
    <template v-else-if="!reto">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Skeleton v-for="i in 3" :key="i" class="h-37.5 rounded-xl" />
      </div>
      <Skeleton class="h-65 rounded-xl" />
    </template>

    <!-- Vacío: primer clic del usuario ───────────────────────────────── -->
    <Empty v-else-if="!hayMetricas" class="mx-auto max-w-160">
      <EmptyHeader>
        <EmptyMedia variant="icon" class="bg-primary/10 text-primary">
          <FlagIcon class="size-6" />
        </EmptyMedia>
        <EmptyTitle>Este trimestre todavía no tiene métricas</EmptyTitle>
        <EmptyDescription>
          Define qué vas a medir entre el {{ fechaLarga(reto.fecha_inicio) }} y el
          {{ fechaLarga(reto.fecha_fin) }}. Cada métrica se llena una vez por semana y el tablero
          calcula el consolidado.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div class="flex flex-wrap justify-center gap-2">
          <Button size="sm" @click="abrirNuevaMetrica">
            <PlusIcon class="size-4" />
            Definir la primera métrica
          </Button>
          <GTooltip>
            <GTooltipTrigger as-child>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="!hayOrigenCopiable"
                  @click="copiarVisible = true"
                >
                  <CopyIcon class="size-4" />
                  Copiar de otro trimestre
                </Button>
              </span>
            </GTooltipTrigger>
            <GTooltipContent v-if="!hayOrigenCopiable"
              >No hay otros trimestres con métricas</GTooltipContent
            >
          </GTooltip>
        </div>
        <Separator />
        <p class="text-xs text-muted-foreground">
          Ejemplos:
          <span class="text-foreground">MWh comercializados</span> (suma) ·
          <span class="text-foreground">Nuevos PPA firmados</span> (suma) ·
          <span class="text-foreground">Disponibilidad de plantas %</span> (promedio) ·
          <span class="text-foreground">Fallas abiertas</span> (último)
        </p>
      </EmptyContent>
    </Empty>

    <!-- Con métricas ─────────────────────────────────────────────────── -->
    <template v-else>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <MetricaKpiCard
          v-for="m in metricasActivas"
          :key="m.id"
          :metrica="m"
          :total-semanas="reto.total_semanas || 0"
          @foco="enfocarMetrica"
          @editar="abrirEditarMetrica"
          @alternar-activa="alternarActiva"
          @eliminar="confirmarEliminarMetrica"
        />
      </div>

      <div class="relative">
        <div
          v-if="recargando"
          class="rq-barra-indeterminada absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-xs"
        />
        <div :class="{ 'pointer-events-none opacity-45': recargando }">
          <MatrizSemanal
            :metricas="reto.metricas"
            :semanas="reto.semanas"
            :valores="reto.valores"
            :guardar-valor="guardarValor"
            @abrir-semana="abrirDrawerSemana"
            @editar-metrica="abrirEditarMetrica"
            @eliminar-metrica="confirmarEliminarMetrica"
          />
        </div>
      </div>
    </template>

    <!-- Drawer del ritual semanal ────────────────────────────────────── -->
    <SemanaDrawer
      v-if="reto && hayMetricas"
      v-model:visible="drawerVisible"
      :semana="semanaActivaObj"
      :semanas="reto.semanas"
      :metricas="reto.metricas"
      :valores="reto.valores"
      :guardar-valor="guardarValor"
      @navegar="navegarSemana"
    />

    <!-- Diálogos ─────────────────────────────────────────────────────── -->
    <MetricaDialog
      v-model:visible="metricaVisible"
      :metrica="metricaEditando"
      :total-semanas="reto?.total_semanas || 0"
      :guardando="guardandoMetrica"
      @submit="submitMetrica"
    />
    <CopiarMetricasDialog
      v-model:visible="copiarVisible"
      :retos="otrosRetos"
      :nombres-destino="nombresDestino"
      :guardando="copiando"
      @submit="submitCopiar"
    />
    <EditarTrimestreDialog
      v-model:visible="editarVisible"
      :reto="reto"
      :guardando="guardandoTrimestre"
      :error-api="errorTrimestre"
      @submit="submitTrimestre"
    />

    <!-- Confirmación no visual de cada PUT, para lectores de pantalla -->
    <div aria-live="polite" class="sr-only">{{ anuncio }}</div>
  </div>
</template>

<style scoped>
.rq-barra-indeterminada {
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--primary) 45%,
    var(--primary) 55%,
    transparent 100%
  );
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: rq-indeterminate 1s linear infinite;
}

@keyframes rq-indeterminate {
  0% {
    background-position: -40% 0;
  }
  100% {
    background-position: 140% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rq-barra-indeterminada {
    animation: none;
    background-position: 50% 0;
  }
}
</style>

<style>
/* Sin `scoped`: cae sobre la fila de la matriz que se resalta, teletransportada
   fuera de esta plantilla. */
.rq-flash {
  animation: rq-flash-fila 1.2s ease-out;
}

@keyframes rq-flash-fila {
  0% {
    background-color: color-mix(in oklab, var(--primary) 12%, transparent);
  }
  100% {
    background-color: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rq-flash {
    animation: none;
  }
}
</style>
