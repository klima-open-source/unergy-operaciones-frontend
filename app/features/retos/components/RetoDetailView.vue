<template>
  <div class="space-y-4">
    <!-- Miga + cabecera ──────────────────────────────────────────────── -->
    <div>
      <router-link to="/general/retos" class="rq-miga">
        <ChevronLeftIcon class="size-[1em]" />
        <span>Retos Q</span>
      </router-link>

      <PageHeader v-if="reto" :title="titulo" :subtitle="subtitulo">
        <template #lead>
          <div class="rq-tile">Q{{ reto.trimestre }}</div>
        </template>

        <template #actions>
          <template v-if="hayMetricas">
            <Button label="Métrica" size="small" outlined @click="abrirNuevaMetrica">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
            <button type="button" class="rq-cta" @click="abrirSemanaNumero(semanaCta)">
              <FlagIcon class="size-[1em] fill-current" />
              <span>Registrar semana {{ semanaCta }}</span>
            </button>
          </template>

          <!-- Sin métricas la acción útil del header es traerlas de otro Q -->
          <span v-else v-tooltip.bottom="hayOrigenCopiable ? '' : 'No hay otros trimestres con métricas'">
            <Button label="Copiar de otro Q" size="small" outlined severity="secondary" :disabled="!hayOrigenCopiable" @click="copiarVisible = true">
              <template #icon><CopyIcon class="size-[1em]" /></template>
            </Button>
          </span>

          <Button text rounded size="small" aria-label="Más acciones del trimestre" @click="menuHeader.toggle($event)">
            <template #icon><EllipsisIcon class="size-[1em]" /></template>
          </Button>
          <Menu ref="menuHeader" :model="itemsHeader" :popup="true">
            <template #itemicon="{ item }"><component :is="item.icon" class="size-[1em]" /></template>
          </Menu>
        </template>
      </PageHeader>

      <div v-else-if="!errorCarga" class="rq-header-skeleton">
        <Skeleton width="40px" height="40px" borderRadius="12px" />
        <div class="flex-1 min-w-0">
          <Skeleton width="220px" height="18px" />
          <Skeleton width="320px" height="12px" class="mt-2" />
        </div>
      </div>
    </div>

    <!-- Error de carga ───────────────────────────────────────────────── -->
    <Message v-if="errorCarga" severity="error" :closable="false">
      <div class="flex items-center gap-3 flex-wrap">
        <span>{{ errorCarga }}</span>
        <Button label="Reintentar" size="small" text @click="cargar()" />
      </div>
    </Message>

    <!-- Cargando: el layout es conocido, así que esqueleto y no spinner ─ -->
    <template v-else-if="!reto">
      <div class="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Skeleton v-for="i in 3" :key="i" height="150px" borderRadius="12px" />
      </div>
      <Skeleton height="260px" borderRadius="12px" />
    </template>

    <!-- Vacío: primer clic del usuario ───────────────────────────────── -->
    <div v-else-if="!hayMetricas" class="rq-card rq-vacio">
      <div class="rq-vacio-tile"><FlagIcon class="size-[1em]" /></div>
      <h2 class="rq-vacio-titulo">Este trimestre todavía no tiene métricas</h2>
      <p class="rq-vacio-parrafo">
        Define qué vas a medir entre el {{ fechaLarga(reto.fecha_inicio) }}
        y el {{ fechaLarga(reto.fecha_fin) }}.
        Cada métrica se llena una vez por semana y el tablero calcula el consolidado.
      </p>
      <div class="rq-vacio-botones">
        <Button label="Definir la primera métrica" size="small" @click="abrirNuevaMetrica">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
        <span v-tooltip.bottom="hayOrigenCopiable ? '' : 'No hay otros trimestres con métricas'">
          <Button label="Copiar de otro trimestre" size="small" outlined severity="secondary" :disabled="!hayOrigenCopiable" @click="copiarVisible = true">
            <template #icon><CopyIcon class="size-[1em]" /></template>
          </Button>
        </span>
      </div>
      <div class="rq-vacio-sep" />
      <p class="rq-vacio-ejemplos">
        Ejemplos:
        <span class="rq-ejemplo">MWh comercializados</span> (suma) ·
        <span class="rq-ejemplo">Nuevos PPA firmados</span> (suma) ·
        <span class="rq-ejemplo">Disponibilidad de plantas %</span> (promedio) ·
        <span class="rq-ejemplo">Fallas abiertas</span> (último)
      </p>
    </div>

    <!-- Con métricas ─────────────────────────────────────────────────── -->
    <template v-else>
      <div class="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

      <div class="rq-matriz-zona">
        <div v-if="recargando" class="rq-barra-indeterminada" />
        <div :class="{ 'rq-atenuado': recargando }">
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

<script setup>
/**
 * Vista B del módulo Retos Q — orquestador del trimestre.
 *
 * Todas las llamadas a la API del módulo salen de aquí: la matriz, el drawer y
 * los diálogos son componentes controlados que solo emiten intención. En
 * particular `guardarValor` se pasa como prop a la matriz y al drawer, así el
 * estado (`reto.metricas` y `reto.valores`) tiene una sola fuente de verdad.
 */
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { toast } from 'vue-sonner'
import { RetosService } from '~/features/retos/services/retos'
import MetricaKpiCard from './MetricaKpiCard.vue'
import MetricaDialog from './MetricaDialog.vue'
import CopiarMetricasDialog from './CopiarMetricasDialog.vue'
import EditarTrimestreDialog from './EditarTrimestreDialog.vue'
import { fmtRango, TIPOS_AGREGACION } from './retosUi'
import { ChevronLeftIcon, CopyIcon, EllipsisIcon, FileSpreadsheetIcon, FlagIcon, PencilIcon, PlusIcon } from '@lucide/vue'

// La matriz y el drawer son pesados y no siempre se necesitan (estado vacío):
// se cargan bajo demanda.
const MatrizSemanal = defineAsyncComponent(() => import('./MatrizSemanal.vue'))
const SemanaDrawer = defineAsyncComponent(() => import('./SemanaDrawer.vue'))

const retosService = new RetosService()

const route = useRoute()
const confirm = useConfirm()
const { user } = useAuth()

// ── Estado ──────────────────────────────────────────────────────────────
const reto = ref(null)
const errorCarga = ref('')
const recargando = ref(false)
const retosAnio = ref([])
const anuncio = ref('')

const menuHeader = ref(null)

const metricaVisible = ref(false)
const metricaEditando = ref(null)
const guardandoMetrica = ref(false)

const copiarVisible = ref(false)
const copiando = ref(false)

const editarVisible = ref(false)
const guardandoTrimestre = ref(false)
const errorTrimestre = ref('')

const drawerVisible = ref(false)
const semanaActivaNumero = ref(null)

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
    .filter(m => m.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
)

const nombresDestino = computed(() => metricas.value.map(m => m.nombre))

const otrosRetos = computed(() => retosAnio.value.filter(r => r.id !== reto.value?.id))

const hayOrigenCopiable = computed(() =>
  otrosRetos.value.some(r => (r.total_metricas ?? (r.metricas || []).length) > 0),
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

const semanaActivaObj = computed(
  () => (reto.value?.semanas || []).find(s => s.numero === semanaActivaNumero.value) || null,
)

const itemsHeader = computed(() => [
  { label: 'Editar trimestre', icon: PencilIcon, command: () => { editarVisible.value = true } },
  { label: 'Copiar métricas de otro Q', icon: CopyIcon, command: () => { copiarVisible.value = true } },
  { separator: true },
  { label: 'Exportar a Excel', icon: FileSpreadsheetIcon, command: exportarExcel },
])

// ── Utilidades ──────────────────────────────────────────────────────────
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga(iso) {
  if (!iso) return '—'
  const [, m, d] = String(iso).split('-').map(Number)
  if (!m || !d) return '—'
  return `${d} de ${MESES_LARGOS[m - 1]}`
}

/** Normaliza el `detail` del backend (string, lista de pydantic u objeto). */
function mensajeError(err, fallback = 'Ocurrió un error inesperado') {
  const det = err?.data?.detail
  if (typeof det === 'string' && det.trim()) return det
  if (Array.isArray(det)) {
    const msg = det.map(e => e?.msg).filter(Boolean).join('; ')
    if (msg) return msg
  }
  if (det && typeof det === 'object') {
    const m = det.mensaje ?? det.msg ?? det.detail
    if (typeof m === 'string' && m.trim()) return m
  }
  if (err?.status === 404) return 'El trimestre o la métrica ya no existe.'
  if (err?.status === 409) return 'El cambio choca con un registro existente.'
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
async function cargarRetosAnio(anio) {
  if (!anio) return
  try {
    const data = await retosService.listarPorAnio(anio)
    retosAnio.value = data?.retos || []
  } catch {
    retosAnio.value = []
  }
}

onMounted(cargar)
watch(retoId, () => { reto.value = null; cargar() })
watch(editarVisible, (v) => { if (v) errorTrimestre.value = '' })

// ── Estado local de valores ─────────────────────────────────────────────
function aplicarMetrica(m) {
  if (!reto.value || !m) return
  const arr = reto.value.metricas || (reto.value.metricas = [])
  const i = arr.findIndex(x => x.id === m.id)
  if (i >= 0) arr.splice(i, 1, m)
  else arr.push(m)
  reto.value.total_metricas = arr.length
}

/**
 * El PUT devuelve la MetricaResumen recalculada, no la celda: la entrada de
 * `valores` se compone aquí para que la matriz y el drawer vean el cambio.
 */
function aplicarValor(metricaId, semanaInicio, valor, nota) {
  if (!reto.value) return
  if (!reto.value.valores) reto.value.valores = {}
  const clave = String(metricaId)
  if (!reto.value.valores[clave]) reto.value.valores[clave] = {}
  const mapa = reto.value.valores[clave]
  const sinValor = valor === null || valor === undefined
  const sinNota = !String(nota ?? '').trim()

  if (sinValor && sinNota) delete mapa[semanaInicio]
  else {
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
async function guardarValor({ metricaId, semanaInicio, valor, nota }) {
  const cuerpo = {
    valor: valor === undefined || valor === '' ? null : valor,
    nota: nota === undefined || nota === '' ? null : nota,
  }
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

function abrirEditarMetrica(m) {
  metricaEditando.value = m || null
  metricaVisible.value = true
}

async function submitMetrica(payload) {
  if (!reto.value) return
  guardandoMetrica.value = true
  const editando = metricaEditando.value
  try {
    const data = editando
      ? await retosService.actualizarMetrica(editando.id, payload)
      : await retosService.crearMetrica(reto.value.id, payload)
    aplicarMetrica(data)
    metricaVisible.value = false
    toast.success(editando ? 'Métrica actualizada' : 'Métrica creada', { duration: 2500 })
  } catch (e) {
    toast.error(editando ? 'No se pudo actualizar la métrica' : 'No se pudo crear la métrica', {
      description: mensajeError(e),
      duration: 5000,
    })
  } finally {
    guardandoMetrica.value = false
  }
}

async function alternarActiva(m) {
  try {
    const data = await retosService.alternarActivaMetrica(m.id, { activa: !m.activa })
    aplicarMetrica(data)
    toast.success('Métrica actualizada', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo actualizar la métrica', { description: mensajeError(e), duration: 5000 })
  }
}

function confirmarEliminarMetrica(m) {
  if (!m) return
  const n = m.semanas_con_dato ?? 0
  const cola = n === 0 ? '' : n === 1 ? ' y su valor semanal' : ` y sus ${n} valores semanales`
  confirm({
    title: 'Eliminar métrica',
    description: `Se eliminará “${m.nombre}”${cola}. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: () => eliminarMetrica(m),
  })
}

async function eliminarMetrica(m) {
  try {
    await retosService.eliminarMetrica(m.id)
    const arr = reto.value?.metricas || []
    const i = arr.findIndex(x => x.id === m.id)
    if (i >= 0) arr.splice(i, 1)
    if (reto.value) {
      reto.value.total_metricas = arr.length
      if (reto.value.valores) delete reto.value.valores[String(m.id)]
      recalcularSemanasConDatos()
    }
    toast.success('Métrica eliminada', { duration: 2500 })
  } catch (e) {
    toast.error('No se pudo eliminar la métrica', { description: mensajeError(e), duration: 5000 })
  }
}

/** Clic en un KPI: lleva el ojo a la fila correspondiente de la matriz. */
function enfocarMetrica(m) {
  if (!m) return
  nextTick(() => {
    const destino = document.querySelector(`[data-metrica-id="${m.id}"]`)
      || document.getElementById(`rq-fila-${m.id}`)
    if (!destino) return
    destino.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    destino.classList.add('rq-flash')
    window.setTimeout(() => destino.classList.remove('rq-flash'), 1200)
  })
}

// ── Copiar métricas ─────────────────────────────────────────────────────
async function submitCopiar(origenId) {
  if (!reto.value || !origenId) return
  copiando.value = true
  // El contrato no fija si la respuesta trae solo las nuevas o todas: el delta
  // de ids contra el estado previo da el conteo correcto en ambos casos.
  const antes = new Set((reto.value.metricas || []).map(m => m.id))
  const origen = otrosRetos.value.find(r => r.id === origenId)
  try {
    await retosService.copiarMetricasDesde(reto.value.id, origenId)
    await cargar()
    copiarVisible.value = false
    const nuevas = (reto.value?.metricas || []).filter(m => !antes.has(m.id)).length
    if (!nuevas) {
      toast.info('No había métricas nuevas por copiar', { duration: 3500 })
    } else {
      const nombre = origen?.nombre || `Retos Q${origen?.trimestre ?? ''} ${origen?.anio ?? ''}`.trim()
      toast.success('Métricas copiadas', {
        description: `Se agregaron ${nuevas} ${nuevas === 1 ? 'métrica' : 'métricas'} desde ${nombre}`,
        duration: 4000,
      })
    }
  } catch (e) {
    toast.error('No se pudieron copiar las métricas', { description: mensajeError(e), duration: 5000 })
  } finally {
    copiando.value = false
  }
}

// ── Editar trimestre ────────────────────────────────────────────────────
async function submitTrimestre(payload) {
  if (!reto.value) return
  const cambianFechas = payload.fecha_inicio !== reto.value.fecha_inicio
    || payload.fecha_fin !== reto.value.fecha_fin
  guardandoTrimestre.value = true
  errorTrimestre.value = ''
  if (cambianFechas) recargando.value = true
  try {
    const data = await retosService.actualizarTrimestre(reto.value.id, payload)
    reto.value = data
    editarVisible.value = false
    toast.success('Trimestre actualizado', { duration: 2500 })
  } catch (e) {
    const msg = mensajeError(e, 'No se pudo actualizar el trimestre')
    errorTrimestre.value = msg
    // Los 400 del contrato ya se ven bajo el campo de fecha; el resto sí sorprende.
    if (e?.status !== 400) {
      toast.error('No se pudo actualizar el trimestre', { description: msg, duration: 5000 })
    }
  } finally {
    guardandoTrimestre.value = false
    recargando.value = false
  }
}

// ── Drawer semanal ──────────────────────────────────────────────────────
function abrirDrawerSemana(semana) {
  if (!semana) return
  semanaActivaNumero.value = semana.numero
  drawerVisible.value = true
}

function abrirSemanaNumero(numero) {
  const semanas = reto.value?.semanas || []
  abrirDrawerSemana(semanas.find(s => s.numero === numero) || semanas[0])
}

function navegarSemana(delta) {
  const semanas = reto.value?.semanas || []
  if (!semanas.length) return
  const actual = semanaActivaNumero.value ?? semanas[0].numero
  const destino = Math.min(Math.max(actual + Number(delta || 0), 1), semanas.length)
  const s = semanas.find(x => x.numero === destino)
  if (s) semanaActivaNumero.value = s.numero
}

// ── Exportar a Excel ────────────────────────────────────────────────────
async function exportarExcel() {
  const r = reto.value
  if (!r) return
  try {
    const XLSX = await import('xlsx-js-style')
    const C = { morado: '915BD8', oscuro: '2C2039', lila: 'F7F4FC', blanco: 'FFFFFF', gris: '6B5A8A', borde: 'ECE4F5' }

    const semanas = r.semanas || []
    const filas = (r.metricas || []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    const encabezado = [
      'Métrica', 'Unidad', 'Agregación', 'Responsable',
      ...semanas.map(s => `${s.etiqueta} · ${s.rango_label}`),
      'Consolidado', 'Meta', 'Cumplimiento %',
    ]
    const nCols = encabezado.length

    const num = v => (v === null || v === undefined || v === '' ? null : Number(v))

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
          TIPOS_AGREGACION.find(t => t.value === m.tipo_agregacion)?.label || m.tipo_agregacion || '',
          m.responsable || '',
          ...semanas.map(s => num(mapa[s.inicio]?.valor)),
          num(m.consolidado), num(m.meta), num(m.cumplimiento_pct),
        ]
      }),
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const celda = (fila, col) => ws[XLSX.utils.encode_cell({ r: fila, c: col })]

    ws['!cols'] = [
      { wch: 32 }, { wch: 9 }, { wch: 14 }, { wch: 16 },
      ...semanas.map(() => ({ wch: 14 })),
      { wch: 14 }, { wch: 12 }, { wch: 15 },
    ]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(nCols - 1, 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(nCols - 1, 0) } },
    ]
    ws['!rows'] = [{ hpt: 22 }, { hpt: 15 }, { hpt: 6 }, { hpt: 30 }]

    if (celda(0, 0)) celda(0, 0).s = { font: { bold: true, sz: 14, color: { rgb: C.oscuro } } }
    if (celda(1, 0)) celda(1, 0).s = { font: { sz: 10, color: { rgb: C.gris } } }

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
        const estilo = {
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
      duration: 5000,
    })
  }
}
</script>

<style scoped>
.rq-card {
  background: #fff;
  border: 1px solid #e8e0f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(44, 32, 57, .04);
}

/* ── Miga y cabecera ─────────────────────────────────────────────────── */
.rq-miga {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 2px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-unergy-purple);
  margin-bottom: 4px;
}
.rq-miga:hover { text-decoration: underline; }
.rq-miga svg { font-size: 9px; }

.rq-tile {
  width: 40px; height: 40px; flex: none;
  border-radius: 12px;
  background: rgba(145, 91, 216, 0.12);
  color: var(--color-unergy-purple);
  font-size: 14px; font-weight: 800;
  display: grid; place-items: center;
}

.rq-header-skeleton { display: flex; align-items: center; gap: 10px; }

/* Único CTA amarillo de la vista */
.rq-cta {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 14px;
  border: 0; border-radius: 9px;
  background: var(--color-unergy-yellow); color: var(--color-unergy-deep);
  font-size: 12.5px; font-weight: 800; cursor: pointer;
  box-shadow: 0 1px 0 rgba(44, 32, 57, .05);
  transition: filter .12s, box-shadow .12s;
}
.rq-cta:hover { filter: brightness(.97); box-shadow: 0 3px 12px rgba(246, 255, 114, .55); }
.rq-cta:focus-visible { outline: 2px solid var(--color-unergy-deep); outline-offset: 2px; }
.rq-cta svg { font-size: 12px; }

@media (max-width: 640px) {
  .rq-cta { flex: 1; justify-content: center; }
}

/* ── Estado vacío ────────────────────────────────────────────────────── */
.rq-vacio {
  padding: 48px 24px;
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}
.rq-vacio-tile {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: rgba(145, 91, 216, 0.10);
  display: grid; place-items: center;
  margin: 0 auto 16px;
}
.rq-vacio-tile svg { font-size: 24px; color: var(--color-unergy-purple); }

.rq-vacio-titulo { font-size: 15px; font-weight: 800; color: var(--color-unergy-deep); }

.rq-vacio-parrafo {
  font-size: 12.5px; font-weight: 400; color: #6b5a8a;
  line-height: 1.55; max-width: 440px; margin: 8px auto 0;
}

.rq-vacio-botones {
  margin-top: 20px;
  display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
}

.rq-vacio-sep { height: 1px; background: #ECE7F2; margin: 24px 0 12px; }

.rq-vacio-ejemplos { font-size: 11px; font-weight: 400; color: #9b8fb0; line-height: 1.6; }
.rq-ejemplo { color: #6b5a8a; }

/* ── Zona de la matriz ───────────────────────────────────────────────── */
.rq-matriz-zona { position: relative; }

.rq-atenuado { opacity: .45; pointer-events: none; }

.rq-barra-indeterminada {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  z-index: 5; border-radius: 2px; overflow: hidden;
  background: linear-gradient(90deg, transparent 0%, var(--color-unergy-purple) 45%, var(--color-unergy-purple) 55%, transparent 100%);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: rq-indeterminate 1s linear infinite;
}

@keyframes rq-indeterminate {
  0%   { background-position: -40% 0; }
  100% { background-position: 140% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .rq-barra-indeterminada { animation: none; background-position: 50% 0; }
  .rq-cta { transition: none; }
}
</style>

<style>
/* Sin `scoped`: estas reglas caen sobre nodos que no son de esta plantilla —
   el popup teleportado del Menu y la fila de la matriz que se resalta. */
.rq-menu-danger .p-menu-item-link,
.rq-menu-danger .p-menu-item-content,
.rq-menu-danger .p-menu-item-icon,
.rq-menu-danger .p-menu-item-label { color: #B0364A; }

.rq-flash { animation: rq-flash-fila 1.2s ease-out; }

@keyframes rq-flash-fila {
  0%   { background-color: rgba(145, 91, 216, .12); }
  100% { background-color: transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .rq-flash { animation: none; }
}
</style>
