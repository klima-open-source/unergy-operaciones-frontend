<template>
  <div class="mand-root">
    <!-- B. Navegador de período -->
    <div class="mand-periodo-bar">
      <CalendarIcon class="text-sm size-[1em]" style="color:#6D4AE8" />
      <button class="mand-nav-btn" @click="cambiarMes(-1)"><ChevronLeftIcon class="size-[1em]" /></button>
      <span class="mand-periodo-label">{{ periodoLargo }}</span>
      <button class="mand-nav-btn" @click="cambiarMes(1)"><ChevronRightIcon class="size-[1em]" /></button>
      <span class="mand-periodo-code">{{ periodo }}</span>
      <span v-if="badgeMes === 'correcciones' || badgeMes === 'cerrado'" class="mand-badge-mes" :class="`mand-badge-mes--${badgeMes}`">
        {{ badgeMes === 'correcciones' ? 'Correcciones pendientes' : 'Mes cerrado' }}
      </span>
      <span class="mand-sync">Gmail no conectado</span>
    </div>

    <div v-if="cargando" class="flex justify-center py-10">
      <LoaderCircleIcon class="size-[1em] animate-spin" style="font-size:1.5rem; color:#6D4AE8;" />
    </div>

    <div v-else>
      <!-- C. Banner de correcciones -->
      <div v-if="hayBanner" class="mand-banner">
        <MailIcon class="size-[1em]" />
        <div class="mand-banner-txt">
          <strong>Vanessa (revisoría)</strong> reportó {{ correcciones.length }} mandato(s) con novedad.
          <span class="mand-banner-obs">{{ obsBanner }}</span>
        </div>
        <button class="mand-banner-btn" disabled title="Disponible al conectar Gmail (Fase B)">Ver correo</button>
      </div>

      <!-- E. Tarjetas de métricas -->
      <div class="mand-metricas">
        <div class="mand-metrica"><span class="mand-metrica-num">{{ resumen.total }}</span><span class="mand-metrica-lbl">Total</span></div>
        <div class="mand-metrica mand-metrica--amb"><span class="mand-metrica-num">{{ resumen.correcciones }}</span><span class="mand-metrica-lbl">Correcciones</span></div>
        <div class="mand-metrica mand-metrica--ver"><span class="mand-metrica-num">{{ resumen.firmados }}</span><span class="mand-metrica-lbl">Firmados</span></div>
        <div class="mand-metrica mand-metrica--mor"><span class="mand-metrica-num">{{ resumen.enviados_inversionista }}</span><span class="mand-metrica-lbl">Enviados inv.</span></div>
        <div class="mand-metrica"><span class="mand-metrica-num">{{ resumen.pendientes }}</span><span class="mand-metrica-lbl">Pendientes</span></div>
      </div>

      <!-- D. Sub-tabs -->
      <div class="mand-subtabs">
        <button v-for="t in SUBTABS" :key="t.value" class="mand-subtab"
          :class="{ 'mand-subtab--active': subTab === t.value }" @click="subTab = t.value">
          {{ t.label }}<span v-if="t.value === 'correcciones'" class="mand-subtab-count">{{ correccionesTabCount }}</span>
        </button>
      </div>

      <!-- F. Filtros -->
      <div class="mand-filtros">
        <Select v-model="filtroEstado" :options="ESTADOS_OPCIONES" optionLabel="label" optionValue="value"
          placeholder="Estado" showClear class="mand-filtro-sel" />
        <Select v-model="filtroTercero" :options="tercerosOpciones" placeholder="Tercero / inversionista"
          showClear filter class="mand-filtro-sel" />
        <span class="mand-buscar"><SearchIcon class="size-[1em]" /><input v-model="buscarCmu" type="text" placeholder="Buscar CMU…" /></span>
      </div>

      <!-- G. Tabla principal -->
      <div class="mand-tabla-wrap">
        <table class="mand-tabla">
          <thead>
            <tr>
              <th>Certificado</th><th>Tercero / proyecto</th><th>Período</th><th>Estado</th>
              <th>Observación</th><th>Doc. firmado</th><th>Enviado inv.</th><th>Adj.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mandatosFiltrados" :key="m.id" :class="{ 'mand-fila-resalt': filaResaltada(m.estado) }">
              <td class="mand-cmu">{{ m.cmu }}</td>
              <td>
                <div class="mand-tercero">{{ m.tercero || '—' }}</div>
                <div class="mand-proyecto">{{ m.proyecto || '' }}</div>
              </td>
              <td>{{ m.periodo }}</td>
              <td><span class="mand-badge" :class="`mand-badge--${estadoMeta(m.estado).cls}`">
                <TriangleAlertIcon class="size-[1em]" v-if="estadoMeta(m.estado).cls === 'neutro-alerta'" style="font-size:10px" />
                {{ estadoMeta(m.estado).label }}</span></td>
              <td class="mand-obs">{{ m.observacion || '—' }}</td>
              <td><span v-if="m.tiene_pdf" class="mand-doc-ok">Disponible</span><span v-else class="mand-guion">—</span></td>
              <td>
                <span v-if="m.fecha_envio_inversionista" class="mand-badge mand-badge--morado">{{ m.fecha_envio_inversionista }}</span>
                <span v-else-if="m.estado === 'firmado'" class="mand-pend-envio">Pendiente envío</span>
                <span v-else-if="m.estado === 'sin_inversionista'" class="mand-sin-inv">Sin inversionista</span>
                <span v-else class="mand-guion">—</span>
              </td>
              <td>
                <button v-if="m.tiene_pdf_zip || m.tiene_pdf" class="mand-clip-btn" title="Ver PDF" @click="descargarPdf(m)">
                  <PaperclipIcon class="size-[1em]" style="color:#185FA5" />
                </button>
                <PaperclipIcon class="size-[1em]" v-else style="color:#C9C2D6" />
              </td>
            </tr>
            <tr v-if="mandatosFiltrados.length === 0">
              <td colspan="8" class="mand-vacio">No hay mandatos para este filtro.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- H. Barra de acciones -->
      <div class="mand-acciones">
        <button class="mand-btn mand-btn--sec" @click="exportarCsv"><DownloadIcon class="size-[1em]" /> Exportar</button>
        <button class="mand-btn mand-btn--sec" disabled title="Acción interna (Fase B)"><SendIcon class="size-[1em]" /> Correo a revisoría</button>
        <span class="mand-acciones-sep" />
        <label class="mand-btn mand-btn--pri">
          <LoaderCircleIcon v-if="subiendoPdf" class="size-[1em] animate-spin" />
          <UploadIcon v-else class="size-[1em]" /> Subir firmados
          <input type="file" accept=".pdf" class="hidden" @change="onSubirFirmado" />
        </label>
        <label class="mand-btn mand-btn--pri">
          <LoaderCircleIcon v-if="subiendoZip" class="size-[1em] animate-spin" />
          <FileInputIcon v-else class="size-[1em]" /> Cargar ZIP de mandatos
          <input type="file" accept=".zip" class="hidden" @change="abrirDialogoZip" />
        </label>
        <button class="mand-btn mand-btn--pri" disabled title="Acción interna (Fase B)"><Share2Icon class="size-[1em]" /> Enviar a inversionistas</button>
      </div>
    </div>

    <!-- Diálogo selector de período del ZIP -->
    <div v-if="mostrarDialogoZip" class="mand-modal-overlay" @click.self="mostrarDialogoZip = false">
      <div class="mand-modal">
        <h3 class="mand-modal-titulo">¿A qué período corresponde este ZIP?</h3>
        <p class="mand-modal-sub">{{ archivoZip?.name }}</p>
        <input type="month" v-model="periodoZip" class="mand-modal-month" />
        <div class="mand-modal-acciones">
          <button class="mand-btn mand-btn--sec" @click="mostrarDialogoZip = false">Cancelar</button>
          <button class="mand-btn mand-btn--pri" :disabled="subiendoZip || !periodoZip" @click="confirmarCargaZip">
            <LoaderCircleIcon v-if="subiendoZip" class="size-[1em] animate-spin" />
            <CheckIcon v-else class="size-[1em]" /> Confirmar
          </button>
        </div>
      </div>
    </div>

    <!-- Panel de resumen de la carga -->
    <div v-if="resumenZip" class="mand-resumen">
      <div class="mand-resumen-head">
        <span><CircleCheckIcon class="size-[1em]" style="color:#3B6D11" /> {{ resumenZip.detectados }} mandatos detectados</span>
        <span><CircleCheckIcon class="size-[1em]" style="color:#3B6D11" /> {{ resumenZip.identificados_auto }} inversionistas identificados</span>
        <span v-if="resumenZip.sin_inversionista"><TriangleAlertIcon class="size-[1em]" style="color:#854F0B" /> {{ resumenZip.sin_inversionista }} sin inversionista</span>
        <span v-if="resumenZip.omitidos">· {{ resumenZip.omitidos }} omitidos (ya existían)</span>
        <button class="mand-resumen-x" @click="resumenZip = null"><XIcon class="size-[1em]" /></button>
      </div>
      <div v-if="resumenZip.sugerencias?.length" class="mand-sugerencias">
        <p class="mand-sug-titulo">Sugerencias de inversionista (confirma cada una):</p>
        <div v-for="s in resumenZip.sugerencias" :key="s.mandato_id" class="mand-sug-fila">
          <span class="mand-sug-cmu">{{ s.cmu }}</span>
          <span class="mand-sug-txt">"{{ s.nombre_extraido }}" → <strong>{{ s.sugerido_nombre }}</strong> ({{ Math.round(s.score * 100) }}%)</span>
          <button class="mand-btn mand-btn--sec mand-sug-btn" @click="asignarSugerencia(s)">Asignar</button>
        </div>
      </div>
      <p v-if="resumenZip.no_parseables?.length" class="mand-noparse">
        {{ resumenZip.no_parseables.length }} archivo(s) no reconocido(s): {{ resumenZip.no_parseables.join(', ') }}
      </p>
      <p class="mand-resumen-nota">El cruce con Gmail se activará al conectar la cuenta (Fase B).</p>
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

<style scoped>
.mand-root { padding: 14px 16px 28px; }
.mand-periodo-bar {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 1px solid #ECE7F2; border-radius: 12px;
  padding: 8px 14px; margin-bottom: 14px; flex-wrap: wrap;
}
.mand-nav-btn {
  background: #F4F1FA; border: 1px solid #E5E2EC; border-radius: 8px;
  width: 28px; height: 28px; cursor: pointer; color: #6B5A8A;
  display: inline-flex; align-items: center; justify-content: center;
}
.mand-nav-btn:hover { background: rgba(109,74,232,.1); color: #6D4AE8; }
.mand-periodo-label { font-size: 14px; font-weight: 700; color: var(--color-unergy-deep); min-width: 130px; text-align: center; }
.mand-periodo-code { font-size: 12px; color: #8B7BA8; font-weight: 600; }
.mand-badge-mes { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.mand-badge-mes--correcciones { background: #FAEEDA; color: #854F0B; }
.mand-badge-mes--cerrado { background: #EAF3DE; color: #3B6D11; }
.mand-sync { margin-left: auto; font-size: 11px; color: #B0A8C0; }
.mand-tabla-wrap { background: #fff; border: 1px solid #ECE7F2; border-radius: 12px; }
.mand-metricas { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
.mand-metrica { background: #fff; border: 1px solid #ECE7F2; border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
.mand-metrica-num { font-size: 22px; font-weight: 800; color: var(--color-unergy-deep); }
.mand-metrica-lbl { font-size: 11px; color: #8B7BA8; font-weight: 600; }
.mand-metrica--amb .mand-metrica-num { color: #854F0B; }
.mand-metrica--ver .mand-metrica-num { color: #3B6D11; }
.mand-metrica--mor .mand-metrica-num { color: #534AB7; }
.mand-subtabs { display: inline-flex; background: #F4F1FA; border: 1px solid #E5E2EC; border-radius: 8px; padding: 2px; margin-bottom: 12px; }
.mand-subtab { background: transparent; border: none; padding: 5px 14px; font-size: 12px; font-weight: 700; color: #6B5A8A; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.mand-subtab--active { background: #6D4AE8; color: #fff; }
.mand-subtab-count { background: rgba(255,255,255,.3); border-radius: 999px; padding: 0 6px; font-size: 10px; }
.mand-subtab:not(.mand-subtab--active) .mand-subtab-count { background: #E1D7F5; color: #6D4AE8; }
.mand-filtros { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.mand-filtro-sel { min-width: 200px; }
.mand-buscar { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #E5E2EC; border-radius: 8px; padding: 6px 10px; }
.mand-buscar input { border: none; outline: none; font-size: 13px; }
.mand-buscar svg { color: #B0A8C0; font-size: 12px; }
@media (max-width: 720px) { .mand-metricas { grid-template-columns: repeat(2, 1fr); } }
.mand-tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
.mand-tabla thead th { text-align: left; font-size: 11px; font-weight: 700; color: #8B7BA8; padding: 10px 12px; border-bottom: 1px solid #ECE7F2; white-space: nowrap; }
.mand-tabla tbody td { padding: 10px 12px; border-bottom: 0.5px solid #F1EEF7; vertical-align: top; }
.mand-fila-resalt { background: #FFFBF4; }
.mand-cmu { font-weight: 700; color: var(--color-unergy-deep); }
.mand-tercero { font-weight: 600; color: var(--color-unergy-deep); }
.mand-proyecto { font-size: 11px; color: #8B7BA8; }
.mand-obs { max-width: 220px; color: #5A5468; }
.mand-guion { color: #C9C2D6; }
.mand-doc-ok { font-size: 11px; font-weight: 700; color: #3B6D11; background: #EAF3DE; padding: 2px 8px; border-radius: 999px; }
.mand-pend-envio { font-size: 11px; color: #8B7BA8; }
.mand-sin-inv { font-size: 11px; color: #8B7BA8; }
.mand-vacio { text-align: center; color: #B0A8C0; padding: 28px; }
.mand-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.mand-badge--ambar { background: #FAEEDA; color: #854F0B; }
.mand-badge--verde-suave { background: #E1F5EE; color: #0F6E56; }
.mand-badge--verde { background: #EAF3DE; color: #3B6D11; }
.mand-badge--azul { background: #E6F1FB; color: #185FA5; }
.mand-badge--morado { background: #EEEDFE; color: #534AB7; }
.mand-badge--neutro { background: #F0EEF4; color: #8B7BA8; }
.mand-badge--neutro-alerta { background: #F0EEF4; color: #8B7BA8; }
.mand-banner { display: flex; align-items: center; gap: 12px; background: #FAEEDA; border: 1px solid #F0DDB8; border-radius: 12px; padding: 10px 14px; margin-bottom: 14px; color: #854F0B; }
.mand-banner > svg { font-size: 16px; }
.mand-banner-txt { font-size: 13px; flex: 1; }
.mand-banner-obs { display: block; font-size: 12px; opacity: .85; }
.mand-banner-btn { background: #fff; border: 1px solid #E6CF9E; color: #854F0B; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 8px; cursor: pointer; }
.mand-banner-btn:disabled { opacity: .5; cursor: not-allowed; }
.mand-acciones { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.mand-acciones-sep { flex: 1; }
.mand-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 7px 14px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.mand-btn--sec { background: #fff; border-color: #E5E2EC; color: #6B5A8A; }
.mand-btn--pri { background: #6D4AE8; color: #fff; }
.mand-btn:disabled { opacity: .45; cursor: not-allowed; }
.hidden { display: none; }
.mand-clip-btn { background: none; border: none; cursor: pointer; padding: 0; }
.mand-modal-overlay { position: fixed; inset: 0; background: rgba(28,18,50,.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
.mand-modal { background: #fff; border-radius: 12px; padding: 20px; width: 380px; max-width: 92vw; box-shadow: 0 8px 30px rgba(28,18,50,.2); }
.mand-modal-titulo { font-size: 15px; font-weight: 700; color: var(--color-unergy-deep); margin: 0 0 4px; }
.mand-modal-sub { font-size: 12px; color: #8B7BA8; margin: 0 0 12px; word-break: break-all; }
.mand-modal-month { width: 100%; font-size: 14px; border: 1px solid #E5E2EC; border-radius: 8px; padding: 8px 10px; margin-bottom: 14px; }
.mand-modal-acciones { display: flex; justify-content: flex-end; gap: 8px; }
.mand-resumen { background: #fff; border: 1px solid #ECE7F2; border-radius: 12px; padding: 12px 14px; margin-top: 14px; }
.mand-resumen-head { display: flex; align-items: center; gap: 14px; font-size: 13px; color: var(--color-unergy-deep); flex-wrap: wrap; }
.mand-resumen-x { margin-left: auto; background: none; border: none; cursor: pointer; color: #B0A8C0; }
.mand-sugerencias { margin-top: 10px; border-top: 1px solid #F1EEF7; padding-top: 10px; }
.mand-sug-titulo { font-size: 12px; font-weight: 700; color: #854F0B; margin: 0 0 6px; }
.mand-sug-fila { display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 12px; flex-wrap: wrap; }
.mand-sug-cmu { font-weight: 700; color: var(--color-unergy-deep); }
.mand-sug-txt { color: #5A5468; flex: 1; }
.mand-sug-btn { padding: 3px 10px; }
.mand-noparse { font-size: 12px; color: #8B7BA8; margin: 8px 0 0; }
.mand-resumen-nota { font-size: 11px; color: #B0A8C0; margin: 8px 0 0; font-style: italic; }
</style>
