<template>
  <div class="px-4 pt-3.5 pb-7">
    <!-- B. Navegador de período -->
    <div class="mb-3.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2">
      <CalendarIcon class="size-4 text-primary" />
      <button :class="CLS_NAV_BTN" @click="cambiarMes(-1)"><ChevronLeftIcon class="size-4" /></button>
      <span class="min-w-32 text-center text-sm font-bold text-foreground">{{ periodoLargo }}</span>
      <button :class="CLS_NAV_BTN" @click="cambiarMes(1)"><ChevronRightIcon class="size-4" /></button>
      <span class="text-xs font-semibold text-muted-foreground">{{ periodo }}</span>
      <span v-if="badgeMes === 'correcciones' || badgeMes === 'cerrado'" class="rounded-full px-2.5 py-0.5 text-xs font-bold" :class="BADGE_MES[badgeMes]">
        {{ badgeMes === 'correcciones' ? 'Correcciones pendientes' : 'Mes cerrado' }}
      </span>
      <span class="ml-auto text-xs text-muted-foreground">Gmail no conectado</span>
    </div>

    <div v-if="cargando" class="flex justify-center py-10">
      <LoaderCircleIcon class="size-6 animate-spin text-primary" />
    </div>

    <div v-else>
      <!-- C. Banner de correcciones -->
      <div v-if="hayBanner" class="mb-3.5 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/15 px-3.5 py-2.5 text-warning">
        <MailIcon class="size-4" />
        <div class="flex-1 text-sm">
          <strong>Vanessa (revisoría)</strong> reportó {{ correcciones.length }} mandato(s) con novedad.
          <span class="block text-xs opacity-85">{{ obsBanner }}</span>
        </div>
        <button class="cursor-pointer rounded-lg border border-warning/40 bg-card px-3 py-1 text-xs font-bold text-warning disabled:cursor-not-allowed disabled:opacity-50" disabled title="Disponible al conectar Gmail (Fase B)">Ver correo</button>
      </div>

      <!-- E. Tarjetas de métricas -->
      <div class="mb-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        <div v-for="m in metricas" :key="m.label" class="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-3.5 py-3">
          <span class="text-2xl font-extrabold" :class="m.color">{{ m.valor }}</span>
          <span class="text-xs font-semibold text-muted-foreground">{{ m.label }}</span>
        </div>
      </div>

      <!-- D. Sub-tabs -->
      <div class="mb-3 inline-flex rounded-lg border border-border bg-muted p-0.5">
        <button v-for="t in SUBTABS" :key="t.value" class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1 text-xs font-bold"
          :class="subTab === t.value ? 'bg-primary text-white' : 'text-muted-foreground'" @click="subTab = t.value">
          {{ t.label }}<span v-if="t.value === 'correcciones'" class="rounded-full px-1.5 text-xs"
            :class="subTab === t.value ? 'bg-white/30' : 'bg-primary/15 text-primary'">{{ correccionesTabCount }}</span>
        </button>
      </div>

      <!-- F. Filtros -->
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <Select v-model="filtroEstado" :options="ESTADOS_OPCIONES" optionLabel="label" optionValue="value"
          placeholder="Estado" showClear class="min-w-50" />
        <Select v-model="filtroTercero" :options="tercerosOpciones" placeholder="Tercero / inversionista"
          showClear filter class="min-w-50" />
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5"><SearchIcon class="size-4 text-muted-foreground" /><input v-model="buscarCmu" type="text" placeholder="Buscar CMU…" class="border-0 text-sm outline-none" /></span>
      </div>

      <!-- G. Tabla principal -->
      <div class="rounded-xl border border-border bg-card">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th v-for="h in COLUMNAS" :key="h" class="border-b border-border px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap text-muted-foreground">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mandatosFiltrados" :key="m.id" :class="{ 'bg-warning/5': filaResaltada(m.estado) }">
              <td :class="[CLS_TD, 'font-bold text-foreground']">{{ m.cmu }}</td>
              <td :class="CLS_TD">
                <div class="font-semibold text-foreground">{{ m.tercero || '—' }}</div>
                <div class="text-xs text-muted-foreground">{{ m.proyecto || '' }}</div>
              </td>
              <td :class="CLS_TD">{{ m.periodo }}</td>
              <td :class="CLS_TD"><span :class="[CLS_BADGE, BADGE_ESTADO[estadoMeta(m.estado).cls]]">
                <TriangleAlertIcon class="size-3" v-if="estadoMeta(m.estado).cls === 'neutro-alerta'" />
                {{ estadoMeta(m.estado).label }}</span></td>
              <td :class="[CLS_TD, 'max-w-55 text-muted-foreground']">{{ m.observacion || '—' }}</td>
              <td :class="CLS_TD"><span v-if="m.tiene_pdf" class="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">Disponible</span><span v-else class="text-muted-foreground/60">—</span></td>
              <td :class="CLS_TD">
                <span v-if="m.fecha_envio_inversionista" :class="[CLS_BADGE, BADGE_ESTADO.morado]">{{ m.fecha_envio_inversionista }}</span>
                <span v-else-if="m.estado === 'firmado'" class="text-xs text-muted-foreground">Pendiente envío</span>
                <span v-else-if="m.estado === 'sin_inversionista'" class="text-xs text-muted-foreground">Sin inversionista</span>
                <span v-else class="text-muted-foreground/60">—</span>
              </td>
              <td :class="CLS_TD">
                <button v-if="m.tiene_pdf_zip || m.tiene_pdf" class="cursor-pointer p-0" title="Ver PDF" @click="descargarPdf(m)">
                  <PaperclipIcon class="size-4 text-primary" />
                </button>
                <PaperclipIcon class="size-4 text-muted-foreground" v-else  />
              </td>
            </tr>
            <tr v-if="mandatosFiltrados.length === 0">
              <td colspan="8" class="p-7 text-center text-muted-foreground">No hay mandatos para este filtro.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- H. Barra de acciones -->
      <div class="mt-3.5 flex flex-wrap items-center gap-2.5">
        <button :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_SEC]" @click="exportarCsv"><DownloadIcon class="size-4" /> Exportar</button>
        <button :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_SEC]" disabled title="Acción interna (Fase B)"><SendIcon class="size-4" /> Correo a revisoría</button>
        <span class="flex-1" />
        <label :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_PRI]">
          <LoaderCircleIcon v-if="subiendoPdf" class="size-4 animate-spin" />
          <UploadIcon v-else class="size-4" /> Subir firmados
          <input type="file" accept=".pdf" class="hidden" @change="onSubirFirmado" />
        </label>
        <label :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_PRI]">
          <LoaderCircleIcon v-if="subiendoZip" class="size-4 animate-spin" />
          <FileInputIcon v-else class="size-4" /> Cargar ZIP de mandatos
          <input type="file" accept=".zip" class="hidden" @change="abrirDialogoZip" />
        </label>
        <button :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_PRI]" disabled title="Acción interna (Fase B)"><Share2Icon class="size-4" /> Enviar a inversionistas</button>
      </div>
    </div>

    <!-- Diálogo selector de período del ZIP -->
    <div v-if="mostrarDialogoZip" class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35" @click.self="mostrarDialogoZip = false">
      <div class="w-95 max-w-11/12 rounded-xl bg-card p-5 shadow-lg">
        <h3 class="m-0 mb-1 text-base font-bold text-foreground">¿A qué período corresponde este ZIP?</h3>
        <p class="m-0 mb-3 text-xs break-all text-muted-foreground">{{ archivoZip?.name }}</p>
        <input type="month" v-model="periodoZip" class="mb-3.5 w-full rounded-lg border border-border px-2.5 py-2 text-sm" />
        <div class="flex justify-end gap-2">
          <button :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_SEC]" @click="mostrarDialogoZip = false">Cancelar</button>
          <button :class="[CLS_BTN, CLS_BTN_PAD, CLS_BTN_PRI]" :disabled="subiendoZip || !periodoZip" @click="confirmarCargaZip">
            <LoaderCircleIcon v-if="subiendoZip" class="size-4 animate-spin" />
            <CheckIcon v-else class="size-4" /> Confirmar
          </button>
        </div>
      </div>
    </div>

    <!-- Panel de resumen de la carga -->
    <div v-if="resumenZip" class="mt-3.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <div class="flex flex-wrap items-center gap-3.5 text-sm text-foreground">
        <span><CircleCheckIcon class="size-4 text-success" /> {{ resumenZip.detectados }} mandatos detectados</span>
        <span><CircleCheckIcon class="size-4 text-success" /> {{ resumenZip.identificados_auto }} inversionistas identificados</span>
        <span v-if="resumenZip.sin_inversionista"><TriangleAlertIcon class="size-4 text-warning" /> {{ resumenZip.sin_inversionista }} sin inversionista</span>
        <span v-if="resumenZip.omitidos">· {{ resumenZip.omitidos }} omitidos (ya existían)</span>
        <button class="ml-auto cursor-pointer text-muted-foreground" @click="resumenZip = null"><XIcon class="size-4" /></button>
      </div>
      <div v-if="resumenZip.sugerencias?.length" class="mt-2.5 border-t border-border pt-2.5">
        <p class="m-0 mb-1.5 text-xs font-bold text-warning">Sugerencias de inversionista (confirma cada una):</p>
        <div v-for="s in resumenZip.sugerencias" :key="s.mandato_id" class="flex flex-wrap items-center gap-2.5 py-1 text-xs">
          <span class="font-bold text-foreground">{{ s.cmu }}</span>
          <span class="flex-1 text-muted-foreground">"{{ s.nombre_extraido }}" → <strong>{{ s.sugerido_nombre }}</strong> ({{ Math.round(s.score * 100) }}%)</span>
          <button :class="[CLS_BTN, 'px-2.5 py-1', CLS_BTN_SEC]" @click="asignarSugerencia(s)">Asignar</button>
        </div>
      </div>
      <p v-if="resumenZip.no_parseables?.length" class="m-0 mt-2 text-xs text-muted-foreground">
        {{ resumenZip.no_parseables.length }} archivo(s) no reconocido(s): {{ resumenZip.no_parseables.join(', ') }}
      </p>
      <p class="m-0 mt-2 text-xs italic text-muted-foreground">El cruce con Gmail se activará al conectar la cuenta (Fase B).</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Select from 'primevue/select'
import { MandatosService } from '~/features/finanzas/services/mandatos'
import { toast } from 'vue-sonner'
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, DownloadIcon, FileInputIcon, LoaderCircleIcon, MailIcon, PaperclipIcon, SearchIcon, SendIcon, Share2Icon, TriangleAlertIcon, UploadIcon, XIcon } from '@lucide/vue'


const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const mandatosService = new MandatosService()

const COLUMNAS = ['Certificado', 'Tercero / proyecto', 'Período', 'Estado', 'Observación', 'Doc. firmado', 'Enviado inv.', 'Adj.']
const CLS_NAV_BTN = 'inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
const CLS_TD = 'border-b border-border px-3 py-2.5 align-top'
const CLS_BADGE = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap'
const CLS_BTN = 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45'
const CLS_BTN_PAD = 'px-3.5 py-2'
const CLS_BTN_SEC = 'border-border bg-card text-muted-foreground'
const CLS_BTN_PRI = 'border-transparent bg-primary text-white'
const BADGE_MES = {
  correcciones: 'bg-warning/15 text-warning',
  cerrado: 'bg-success/15 text-success'
}
const BADGE_ESTADO = {
  ambar: 'bg-warning/15 text-warning',
  'verde-suave': 'bg-chart-2/15 text-chart-2',
  verde: 'bg-success/15 text-success',
  azul: 'bg-chart-3/15 text-chart-3',
  morado: 'bg-primary/10 text-primary',
  neutro: 'bg-muted text-muted-foreground',
  'neutro-alerta': 'bg-muted text-muted-foreground'
}

// Período inicial: mayo 2025 (donde viven los datos de prueba).
const anio = ref(2025)
const mes = ref(5)   // 1-12

const periodo = computed(() => `${anio.value}-${String(mes.value).padStart(2, '0')}`)
const periodoLargo = computed(() => `${MESES_ES[mes.value - 1]} ${anio.value}`)

const cargando = ref(false)
const mandatos = ref([])
const periodosInfo = ref([])
const resumen = ref({ total: 0, correcciones: 0, firmados: 0, enviados_inversionista: 0, pendientes: 0 })
const inversionistas = ref([])

const metricas = computed(() => [
  { label: 'Total', valor: resumen.value.total, color: 'text-foreground' },
  { label: 'Correcciones', valor: resumen.value.correcciones, color: 'text-warning' },
  { label: 'Firmados', valor: resumen.value.firmados, color: 'text-success' },
  { label: 'Enviados inv.', valor: resumen.value.enviados_inversionista, color: 'text-primary' },
  { label: 'Pendientes', valor: resumen.value.pendientes, color: 'text-foreground' }
])

const subiendoPdf = ref(false)

// ── Carga de ZIP ──
const mostrarDialogoZip = ref(false)
const archivoZip = ref(null)
const periodoZip = ref(periodo.value)          // "YYYY-MM"
const subiendoZip = ref(false)
const resumenZip = ref(null)                    // null | objeto de resumen

function abrirDialogoZip(e) {
  const f = e.target.files?.[0]
  if (!f) return
  archivoZip.value = f
  periodoZip.value = periodo.value
  mostrarDialogoZip.value = true
  e.target.value = ''
}

async function confirmarCargaZip() {
  if (!archivoZip.value || !periodoZip.value) return
  subiendoZip.value = true
  try {
    const data = await mandatosService.subirZip(periodoZip.value, archivoZip.value)
    resumenZip.value = data
    mostrarDialogoZip.value = false
    const [y, m] = periodoZip.value.split('-')
    anio.value = Number(y); mes.value = Number(m)
    await cargar()
    toast.success(`ZIP cargado: ${data.creados} creados`, { duration: 4000 })
  } catch (err) {
    toast.error('No se pudo cargar el ZIP', { description: err.data?.detail || '', duration: 4000 })
  } finally {
    subiendoZip.value = false
    archivoZip.value = null
  }
}

async function asignarSugerencia(s) {
  try {
    await mandatosService.asignarInversionista(s.mandato_id, { inversionista_id: s.sugerido_id, estado: 'pendiente_envio' })
    resumenZip.value.sugerencias = resumenZip.value.sugerencias.filter(x => x.mandato_id !== s.mandato_id)
    await cargar()
    toast.success(`${s.cmu} → ${s.sugerido_nombre}`, { duration: 2500 })
  } catch {
    toast.error('No se pudo asignar', { duration: 3000 })
  }
}

async function descargarPdf(m) {
  try {
    const data = await mandatosService.descargarPdf(m.id)
    const url = URL.createObjectURL(data)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    toast.error('No se pudo abrir el PDF', { duration: 3000 })
  }
}

const correcciones = computed(() => mandatos.value.filter(m => m.estado === 'con_correcciones'))
const hayBanner = computed(() => correcciones.value.length > 0)
const obsBanner = computed(() => correcciones.value[0]?.observacion || '')
const correccionesTabCount = computed(() =>
  mandatos.value.filter(m => m.estado === 'con_correcciones' || m.estado === 'corregido').length)

async function onSubirFirmado(e) {
  const archivo = e.target.files?.[0]
  if (!archivo) return
  subiendoPdf.value = true
  try {
    const data = await mandatosService.subirFirmado(periodo.value, archivo)
    if (data.asociado) {
      toast.success(`PDF asociado a ${data.mandato.cmu}`, { duration: 3000 })
    } else {
      toast.warning('PDF subido', { description: data.mensaje, duration: 5000 })
    }
    await cargar()
  } catch {
    toast.error('No se pudo subir el PDF', { duration: 3000 })
  } finally {
    subiendoPdf.value = false
    e.target.value = ''
  }
}

function exportarCsv() {
  const filas = mandatosFiltrados.value
  const cabecera = ['CMU', 'Tercero', 'Proyecto', 'Periodo', 'Estado', 'Observacion', 'Enviado inversionista']
  const lineas = filas.map(m => [m.cmu, m.tercero || '', m.proyecto || '', m.periodo, m.estado,
    (m.observacion || '').replace(/[\r\n;]/g, ' '), m.fecha_envio_inversionista || ''].join(';'))
  const csv = [cabecera.join(';'), ...lineas].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mandatos_${periodo.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Sub-tabs: todos | correcciones | firmados | enviados_inv
const subTab = ref('todos')
const filtroEstado = ref(null)
const filtroTercero = ref(null)
const buscarCmu = ref('')

const ESTADOS_OPCIONES = [
  { label: 'Pendiente envío', value: 'pendiente_envio' },
  { label: 'Enviado revisoría', value: 'enviado_revisoria' },
  { label: 'Con correcciones', value: 'con_correcciones' },
  { label: 'Corregido', value: 'corregido' },
  { label: 'Firmado', value: 'firmado' },
  { label: 'Enviado inversionista', value: 'enviado_inversionista' },
  { label: 'Sin inversionista', value: 'sin_inversionista' },
]

const SUBTABS = [
  { label: 'Todos', value: 'todos' },
  { label: 'Correcciones', value: 'correcciones' },
  { label: 'Firmados', value: 'firmados' },
  { label: 'Enviados a inv.', value: 'enviados_inv' },
]

const tercerosOpciones = computed(() => {
  const set = new Set(mandatos.value.map(m => m.tercero).filter(Boolean))
  return Array.from(set).sort()
})

const mandatosFiltrados = computed(() => {
  let lista = mandatos.value
  if (subTab.value === 'correcciones') lista = lista.filter(m => m.estado === 'con_correcciones' || m.estado === 'corregido')
  else if (subTab.value === 'firmados') lista = lista.filter(m => m.estado === 'firmado')
  else if (subTab.value === 'enviados_inv') lista = lista.filter(m => m.estado === 'enviado_inversionista')
  if (filtroEstado.value) lista = lista.filter(m => m.estado === filtroEstado.value)
  if (filtroTercero.value) lista = lista.filter(m => m.tercero === filtroTercero.value)
  if (buscarCmu.value.trim()) {
    const q = buscarCmu.value.trim().toUpperCase()
    lista = lista.filter(m => (m.cmu || '').toUpperCase().includes(q))
  }
  return lista
})

const ESTADO_META = {
  pendiente_envio:       { label: 'Pendiente envío',       cls: 'neutro' },
  enviado_revisoria:     { label: 'Enviado revisoría',     cls: 'azul' },
  con_correcciones:      { label: 'Con correcciones',      cls: 'ambar' },
  corregido:             { label: 'Corregido',             cls: 'verde-suave' },
  firmado:               { label: 'Firmado',               cls: 'verde' },
  enviado_inversionista: { label: 'Enviado inversionista', cls: 'morado' },
  sin_inversionista:     { label: 'Sin inversionista',     cls: 'neutro-alerta' },
}
function estadoMeta(e) { return ESTADO_META[e] || { label: e, cls: 'neutro' } }
function filaResaltada(e) { return e === 'con_correcciones' || e === 'corregido' }

const badgeMes = computed(() => {
  const info = periodosInfo.value.find(p => p.periodo === periodo.value)
  return info ? info.badge : null
})

function cambiarMes(delta) {
  let m = mes.value + delta
  let y = anio.value
  if (m < 1) { m = 12; y -= 1 }
  if (m > 12) { m = 1; y += 1 }
  mes.value = m
  anio.value = y
  cargar()
}

async function cargar() {
  cargando.value = true
  try {
    const [r1, r2, r3, r4] = await Promise.allSettled([
      mandatosService.listar(periodo.value),
      mandatosService.listarPeriodos(),
      mandatosService.obtenerResumen(periodo.value),
      mandatosService.listarInversionistas(),
    ])
    mandatos.value = r1.status === 'fulfilled' ? r1.value : []
    periodosInfo.value = r2.status === 'fulfilled' ? r2.value : []
    resumen.value = r3.status === 'fulfilled' ? r3.value : resumen.value
    inversionistas.value = r4.status === 'fulfilled' ? r4.value : []
  } catch {
    mandatos.value = []
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
defineExpose({ cargar })
</script>
