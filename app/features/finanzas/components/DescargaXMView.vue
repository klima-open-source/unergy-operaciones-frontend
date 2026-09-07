<template>
  <div class="gf-page">
    <div class="mon-tab-bar">
      <CloudDownloadIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
      <span class="text-base font-bold text-gray-800 whitespace-nowrap mr-2">Descarga de XM</span>
    </div>

    <div class="max-w-3xl mx-auto mt-4 space-y-4">
      <div class="rounded-xl border p-3 flex items-start gap-2" style="background:#F1EAF9;border-color:#E0D3F5">
        <InfoIcon class="text-sm flex-shrink-0 mt-0.5 size-[1em]" style="color:#6D28D9" />
        <p class="text-xs" style="color:#4C1D95">
          Esta pestaña necesita el <strong>agente local</strong> corriendo en tu computador (el FTP de XM
          solo acepta conexiones desde tu máquina, no desde la plataforma). Abre
          <code class="font-mono">iniciar_descarga_xm.bat</code> y déjalo abierto antes de descargar.
        </p>
      </div>

      <div class="rounded-xl border bg-white p-5" style="border-color:#ECE7F2">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Usuario FTP</label>
            <input v-model="form.ftpUsuario" type="text" class="xm-input" autocomplete="off" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Clave FTP</label>
            <input v-model="form.ftpClave" type="password" class="xm-input" autocomplete="off" />
          </div>

          <div class="col-span-2 flex items-center gap-2">
            <Checkbox v-model="recordarCredenciales" binary inputId="xm-recordar" />
            <label for="xm-recordar" class="text-xs text-gray-500">
              Recordar en esta sesión del navegador
            </label>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Tipo de archivo</label>
            <Select v-model="form.tipo" :options="TIPOS" placeholder="Selecciona…" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Extensión</label>
            <Select v-model="form.extension" :options="EXTENSIONES" placeholder="Selecciona…" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Fecha inicio</label>
            <input v-model="form.fechaInicio" type="date" class="xm-input" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Fecha fin</label>
            <input v-model="form.fechaFin" type="date" class="xm-input" />
          </div>

          <div class="col-span-2 flex items-center gap-2" v-if="tipoEsFiltrable">
            <Checkbox v-model="form.enriquecer" binary inputId="xm-enriquecer" />
            <label for="xm-enriquecer" class="text-xs text-gray-500">
              {{ etiquetaFiltro }}
            </label>
          </div>

          <!-- Elegir agente (solo tipos que filtran por agente, ej. tgrl) -->
          <div class="col-span-2 flex items-center gap-2 pl-6" v-if="tipoFiltraPorAgente && form.enriquecer">
            <label class="text-xs font-medium text-gray-500">Agente</label>
            <Select v-model="form.agenteFiltro" :options="AGENTES" class="w-40" />
            <span class="text-xs text-gray-400">UNGG = generador · UNGC = comercializador</span>
          </div>
        </div>

        <div class="mt-4">
          <Button label="Descargar y unificar" :loading="enProceso" :disabled="!formularioValido || enProceso" @click="onDescargar" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
            <template #icon><DownloadIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>

      <div v-if="estado" class="rounded-xl border p-4" style="border-color:#ECE7F2">
        <div v-if="estado.estado === 'descargando'" class="text-sm text-gray-600">
          <LoaderCircleIcon class="mr-2 size-[1em] animate-spin" style="color:var(--color-unergy-purple)" />
          Descargando archivos… {{ estado.archivos_procesados }}/{{ estado.archivos_totales }}
        </div>

        <div v-else-if="estado.estado === 'unificando'" class="text-sm text-gray-600">
          <LoaderCircleIcon class="mr-2 size-[1em] animate-spin" style="color:var(--color-unergy-purple)" />
          Unificando archivos…
        </div>

        <div v-else-if="estado.estado === 'exportando'" class="text-sm text-gray-600">
          <LoaderCircleIcon class="mr-2 size-[1em] animate-spin" style="color:var(--color-unergy-purple)" />
          Generando el archivo final… con rangos grandes puede tardar uno o dos minutos.
        </div>

        <div v-else-if="estado.estado === 'listo'" class="space-y-2">
          <div class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Listo</div>
          <div v-if="estado.archivos_faltantes?.length" class="text-xs text-amber-600">
            {{ estado.archivos_faltantes.length }} archivo(s) no encontrados en el FTP para el rango.
          </div>
          <div v-if="estado.codigos_sin_match?.length" class="text-xs text-amber-600">
            Códigos sin match en fronteras: {{ estado.codigos_sin_match.join(', ') }}
          </div>
          <div class="flex gap-2">
            <Button label="Descargar Excel" size="small" @click="onDescargarArchivo('xlsx')">
              <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
            </Button>
            <Button label="Descargar TXT" size="small" outlined @click="onDescargarArchivo('txt')">
              <template #icon><FileIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>

        <div v-else-if="estado.estado === 'error'" class="text-sm text-red-600">
          <CircleAlertIcon class="mr-2 size-[1em]" />
          {{ estado.error_message || 'Ocurrió un error al procesar la descarga.' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { XmAgenteLocalService } from '~/features/finanzas/services/xm'
import { CircleAlertIcon, CloudDownloadIcon, DownloadIcon, FileIcon, FileSpreadsheetIcon, InfoIcon, LoaderCircleIcon } from '@lucide/vue'

const xm = new XmAgenteLocalService()

const TIPOS = ['dspcttos', 'aenc', 'BalCttos', 'grip', 'arrpas', 'tgrl', 'trsd', 'cxcsb', 'tserv', 'afac']
const EXTENSIONES = ['txf', 'txr', 'tx1', 'tx2', 'tx3', 'tx4', 'tx5', 'tx6', 'tx7', 'tx8']
// Tipos con código SIC de planta: el checkbox filtra a plantas Unergy y agrega nombre + MW.
const TIPOS_ENRIQUECIBLES = ['grip', 'arrpas', 'cxcsb']
// Tipos que listan todos los agentes (ej. tgrl): el checkbox filtra solo las filas del agente UNGG.
const TIPOS_FILTRO_AGENTE = ['tgrl']
const TIPOS_FILTRABLES = [...TIPOS_ENRIQUECIBLES, ...TIPOS_FILTRO_AGENTE]
// Unergy participa como generador (UNGG) y comercializador (UNGC).
const AGENTES = ['UNGG', 'UNGC']
const STORAGE_KEY = 'xm_credenciales_sesion'

const form = ref({
  ftpUsuario: '',
  ftpClave: '',
  tipo: null,
  extension: null,
  fechaInicio: '',
  fechaFin: '',
  enriquecer: false,
  agenteFiltro: 'UNGG',
})
const recordarCredenciales = ref(false)

const guardadas = sessionStorage.getItem(STORAGE_KEY)
if (guardadas) {
  try {
    const { usuario, clave } = JSON.parse(guardadas)
    form.value.ftpUsuario = usuario || ''
    form.value.ftpClave = clave || ''
    recordarCredenciales.value = true
  } catch {
    // ignorar sesión corrupta
  }
}

watch(
  [recordarCredenciales, () => form.value.ftpUsuario, () => form.value.ftpClave],
  () => {
    if (recordarCredenciales.value) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ usuario: form.value.ftpUsuario, clave: form.value.ftpClave })
      )
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }
)

const tipoEsFiltrable = computed(() => TIPOS_FILTRABLES.includes(form.value.tipo))
const tipoFiltraPorAgente = computed(() => TIPOS_FILTRO_AGENTE.includes(form.value.tipo))
const etiquetaFiltro = computed(() =>
  tipoFiltraPorAgente.value
    ? 'Filtrar solo las filas del agente Unergy'
    : 'Filtrar solo plantas Unergy y agregar nombre + MW'
)
watch(
  () => form.value.tipo,
  () => {
    if (!tipoEsFiltrable.value) form.value.enriquecer = false
  }
)

const formularioValido = computed(
  () =>
    form.value.ftpUsuario &&
    form.value.ftpClave &&
    form.value.tipo &&
    form.value.extension &&
    form.value.fechaInicio &&
    form.value.fechaFin
)

const jobId = ref(null)
const estado = ref(null)
const enProceso = computed(() => estado.value && ['descargando', 'unificando', 'exportando'].includes(estado.value.estado))
let polling = null

async function onDescargar() {
  estado.value = null
  const payload = {
    ftp_usuario: form.value.ftpUsuario,
    ftp_clave: form.value.ftpClave,
    tipo: form.value.tipo,
    extension: form.value.extension,
    fecha_inicio: form.value.fechaInicio,
    fecha_fin: form.value.fechaFin,
    enriquecer: form.value.enriquecer,
    agente_filtro: form.value.agenteFiltro,
  }
  try {
    const { job_id: id } = await xm.iniciarDescarga(payload)
    jobId.value = id
    estado.value = { estado: 'descargando', archivos_procesados: 0, archivos_totales: 0 }
    iniciarPolling()
  } catch (e) {
    estado.value = { estado: 'error', error_message: mensajeError(e, 'No se pudo iniciar la descarga.') }
  }
}

function mensajeError(e, generico) {
  if (XmAgenteLocalService.noDisponible(e)) {
    return 'No se pudo conectar con el agente local. Abre "iniciar_descarga_xm.bat" en tu computador y déjalo abierto, luego intenta de nuevo.'
  }
  return e.data?.detail || generico
}

const MAX_FALLOS_CONSECUTIVOS = 5 // ~10s de sondeos fallidos seguidos antes de darla por perdida
let fallosConsecutivos = 0

function iniciarPolling() {
  detenerPolling()
  fallosConsecutivos = 0
  polling = setInterval(async () => {
    try {
      const data = await xm.consultarEstado(jobId.value)
      fallosConsecutivos = 0
      estado.value = data
      if (data.estado === 'listo' || data.estado === 'error') detenerPolling()
    } catch (e) {
      // Un solo sondeo fallido no significa que la descarga se haya perdido —
      // el agente puede tardar un momento en responder mientras procesa un
      // archivo grande. Solo se da por perdida tras varios fallos seguidos.
      fallosConsecutivos += 1
      if (fallosConsecutivos >= MAX_FALLOS_CONSECUTIVOS) {
        estado.value = { estado: 'error', error_message: mensajeError(e, 'Se perdió la conexión con el agente local.') }
        detenerPolling()
      }
    }
  }, 2000)
}

function detenerPolling() {
  if (polling) {
    clearInterval(polling)
    polling = null
  }
}

function onDescargarArchivo(formato) {
  // Navegar directo a la URL del archivo (en vez de fetch + blob + click
  // simulado) — así el navegador maneja la descarga nativamente, sin
  // pasar por JavaScript. Esto es intencional y evita dos problemas
  // reales: (1) un .click() disparado después de un `await` deja de
  // contar como gesto directo del usuario en algunos navegadores, que
  // entonces bloquean la descarga sin avisar; (2) evita cargar el
  // archivo completo en memoria como Blob antes de guardarlo, lo cual
  // pesa para archivos grandes (ej. ~25 MB de grip).
  const url = `http://127.0.0.1:8420/descargas/${jobId.value}/archivo?formato=${formato}`
  const a = document.createElement('a')
  a.href = url
  a.download = formato === 'xlsx' ? `${form.value.tipo}.xlsx` : `${form.value.tipo}.${form.value.extension}`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

onBeforeUnmount(detenerPolling)
</script>

<style scoped>
.xm-input {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
}
.xm-input:focus {
  outline: none;
  border-color: var(--color-unergy-purple);
  box-shadow: 0 0 0 2px rgba(145, 91, 216, 0.15);
}
</style>
