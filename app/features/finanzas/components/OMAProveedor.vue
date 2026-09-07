<template>
  <div class="space-y-4 pt-3">

    <div class="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 border" style="border-color:#ECE7F2">
      <button type="button" @click="cambiarMes(-1)"
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
        <ChevronLeftIcon class="text-xs text-gray-500 size-[1em]" />
      </button>
      <span class="text-sm font-semibold" style="color:var(--color-unergy-deep); min-width:100px; text-align:center">
        {{ periodoLabel }}
      </span>
      <button type="button" @click="cambiarMes(1)"
        class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
        <ChevronRightIcon class="text-xs text-gray-500 size-[1em]" />
      </button>
      <GBadge color="default" class="text-xs font-mono">{{ periodoActual }}</GBadge>
    </div>

    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-10 flex justify-center border" style="border-color:#ECE7F2">
      <LoaderCircleIcon class="text-2xl text-gray-400 size-[1em] animate-spin" />
    </div>
    <div v-else-if="!filas.length"
      class="bg-white rounded-xl shadow-sm p-10 text-center border" style="border-color:#ECE7F2">
      <InboxIcon class="text-2xl mb-2 block size-[1em]" style="color:#c4b5fd" />
      <p class="text-sm text-gray-500">No hay proyectos guardados para este período.</p>
      <p class="text-xs text-gray-400 mt-1">Operaciones aún no guardó la selección del mes.</p>
    </div>
    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden border" style="border-color:#ECE7F2">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse" style="min-width:700px">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Proyecto</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Periodo a facturar</th>
              <th class="px-4 py-2.5 text-right font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Valor a Facturar</th>
              <th class="px-4 py-2.5 text-left font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Indexación aplicada</th>
              <th class="px-4 py-2.5 text-center font-medium text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in filas" :key="fila.contrato_id"
              class="border-t border-gray-100 hover:bg-gray-50/70 transition-colors duration-100">
              <td class="px-4 py-2.5 font-medium" style="color:var(--color-unergy-deep)">{{ fila.nombre_proyecto }}</td>
              <td class="px-4 py-2.5 text-xs text-gray-500">{{ fila.mes_año }}</td>
              <td class="px-4 py-2.5 text-right font-semibold tabular-nums" style="color:#7c3aed">
                {{ formatCOP(fila.valor_a_facturar) }}
              </td>
              <td class="px-4 py-2.5 text-xs text-gray-400"
                style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                :title="fila.historial_indexaciones">
                {{ fila.historial_indexaciones }}
              </td>
              <td class="px-4 py-2.5 text-center">
                <button v-if="!fila.facturado" type="button"
                  class="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors hover:bg-green-50"
                  style="border-color:#15803d;color:#15803d"
                  :disabled="toggling[fila.contrato_id]"
                  @click="toggleFacturado(fila)">
                  Marcar facturado
                </button>
                <span v-else
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80"
                  style="background:#dcfce7;color:#166534"
                  @click="toggleFacturado(fila)">
                  <CheckIcon class="text-[10px] size-[1em]" />FACTURADO
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Factura consolidada del mes ───────────────────────────────── -->
    <div class="rounded-xl border bg-white shadow-sm overflow-hidden" style="border-color:#ECE7F2">
      <div class="flex items-center justify-between px-4 py-2.5 border-b" style="border-color:#F3F0FA;background:#FDFCFF">
        <div class="flex items-center gap-2">
          <FileTextIcon class="text-xs size-[1em]" style="color:var(--color-unergy-purple)" />
          <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Factura consolidada del mes</span>
          <GBadge color="default" class="text-xs font-mono">{{ periodoLabel }}</GBadge>
        </div>
        <!-- indicador de estado -->
        <span v-if="factura.nombre_archivo"
          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style="background:#dcfce7;color:#166534">
          <CheckIcon class="text-[10px] size-[1em]" />Subida
        </span>
        <span v-else class="text-xs text-gray-400">Pendiente</span>
      </div>

      <div class="px-4 py-3 space-y-3">
        <!-- Si ya existe factura: mostrar y opción de reemplazar -->
        <div v-if="factura.nombre_archivo"
          class="flex items-center gap-3 p-2.5 rounded-lg" style="background:#f0fdf4;border:1px solid #bbf7d0">
          <FileTextIcon class="text-sm flex-shrink-0 size-[1em]" style="color:#16a34a" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold truncate" style="color:#15803d">{{ factura.nombre_archivo }}</p>
            <p v-if="factura.subido_en" class="text-[10px] text-gray-400 mt-0.5">
              Subida: {{ fmtFecha(factura.subido_en) }}
            </p>
          </div>
          <!-- Descargar si es archivo local -->
          <button v-if="factura.tiene_archivo" type="button"
            @click="descargarFacturaConsolidada"
            class="flex items-center gap-1 text-xs font-medium hover:underline flex-shrink-0"
            style="color:#15803d;background:none;border:none;padding:0;cursor:pointer">
            <DownloadIcon class="text-xs size-[1em]" />Descargar
          </button>
          <!-- Abrir link externo -->
          <a v-else-if="factura.enlace_pdf"
            :href="factura.enlace_pdf" target="_blank" rel="noopener"
            class="flex items-center gap-1 text-xs font-medium hover:underline flex-shrink-0"
            style="color:var(--color-unergy-purple)">
            <ExternalLinkIcon class="text-xs size-[1em]" />Ver
          </a>
        </div>

        <!-- Formulario de subida -->
        <div class="space-y-2">
          <p class="text-xs text-gray-500">
            {{ factura.nombre_archivo ? 'Reemplazar factura:' : 'Subir archivo PDF:' }}
          </p>

          <!-- Opción A: subir archivo -->
          <label class="flex items-center gap-2 text-xs border border-dashed rounded-lg px-3 py-2 cursor-pointer hover:border-purple-400 transition-colors"
            :class="archivoSeleccionado ? 'border-purple-400 bg-purple-50' : 'border-gray-300'">
            <PaperclipIcon class="text-xs size-[1em]" :style="archivoSeleccionado ? 'color:var(--color-unergy-purple)' : 'color:#9ca3af'" />
            <span :style="archivoSeleccionado ? 'color:#7c3aed' : 'color:#9ca3af'" class="truncate">
              {{ archivoSeleccionado ? archivoSeleccionado.name : 'Seleccionar PDF…' }}
            </span>
            <input type="file" accept=".pdf,.PDF" class="hidden" @change="onFacturaChange" />
          </label>

          <!-- Opción B: link externo -->
          <div class="flex items-center gap-1.5">
            <div class="h-px flex-1" style="background:#e5e7eb"/>
            <span class="text-[10px] text-gray-400">o pega un link</span>
            <div class="h-px flex-1" style="background:#e5e7eb"/>
          </div>
          <input type="url" v-model="linkExterno"
            placeholder="https://drive.google.com/…"
            class="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-200"/>

          <button type="button"
            :disabled="!puedeSubir || subiendoFactura"
            class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style="background:var(--color-unergy-purple);color:#fff;border:none"
            :style="!puedeSubir || subiendoFactura ? 'opacity:0.4;cursor:not-allowed' : 'cursor:pointer'"
            @click="subirFactura">
            <LoaderCircleIcon v-if="subiendoFactura" class="text-xs size-[1em] animate-spin" />
            <CloudUploadIcon v-else class="text-xs size-[1em]" />
            {{ subiendoFactura ? 'Subiendo…' : (factura.nombre_archivo ? 'Reemplazar' : 'Subir factura') }}
          </button>
        </div>
      </div>

      <!-- Resultado división PDF (transitorio — solo hasta cambiar de período o cerrar) -->
      <div v-if="splitResult" class="mx-4 mb-3 rounded-lg border px-3 py-2.5 space-y-2"
        :style="splitResult.error
          ? 'background:#fef2f2;border-color:#fca5a5'
          : 'background:#f0fdf4;border-color:#bbf7d0'">

        <!-- Error de sistema -->
        <div v-if="splitResult.error" class="flex items-start gap-1.5">
          <CircleXIcon class="text-xs mt-0.5 flex-shrink-0 size-[1em]" style="color:#dc2626" />
          <p class="text-xs text-red-700">Error al procesar el PDF: {{ splitResult.error }}</p>
        </div>

        <!-- Proyectos asociados correctamente -->
        <div v-else>
          <p class="text-xs font-semibold mb-1" style="color:#166534">
            <CircleCheckIcon class="mr-1 size-[1em]" />
            {{ splitResult.procesados }} {{ splitResult.procesados === 1 ? 'proyecto asociado' : 'proyectos asociados' }} correctamente
          </p>
          <div v-if="splitResult.detalle?.length" class="space-y-0.5 pl-3">
            <div v-for="(item, i) in splitResult.detalle" :key="i"
              class="flex items-center gap-2 text-[10px] text-gray-600">
              <FileTextIcon class="text-[9px] flex-shrink-0 size-[1em]" style="color:#16a34a" />
              <span class="font-medium truncate" style="max-width:160px" :title="item.nombre">{{ item.nombre }}</span>
              <span v-if="item.numero_factura" class="font-mono text-gray-400">{{ item.numero_factura }}</span>
              <span v-if="item.total_pagar" class="ml-auto font-semibold tabular-nums" style="color:#7c3aed">
                {{ formatCOP(item.total_pagar) }}
              </span>
            </div>
          </div>
        </div>

        <button type="button" class="text-[10px] text-gray-400 hover:text-gray-600 mt-1"
          @click="splitResult = null">
          Cerrar
        </button>
      </div>

      <!-- Páginas sin match pendientes de asignar — persistente entre recargas -->
      <div v-if="sinMatchPendientes.length" class="mx-4 mb-3 rounded-lg border px-3 py-2.5 space-y-2"
        style="background:#fffbeb;border-color:#fcd34d40">
        <p class="text-xs font-semibold" style="color:#92400e">
          <TriangleAlertIcon class="mr-1 size-[1em]" />
          {{ sinMatchPendientes.length }} {{ sinMatchPendientes.length === 1 ? 'página pendiente de asignar' : 'páginas pendientes de asignar' }}
        </p>
        <div v-for="item in sinMatchPendientes" :key="item.id"
          class="pl-3 py-1.5 rounded space-y-1" style="background:#fef3c740">
          <p class="text-[10px] font-semibold text-amber-800">
            Pág. {{ item.pagina }}
            <span v-if="item.numero_factura" class="font-mono font-normal text-gray-500"> · {{ item.numero_factura }}</span>
            <span v-if="item.origen === 'backfill'"
              class="ml-1 text-[9px] px-1 py-0.5 rounded-full font-medium" style="background:#e5e7eb;color:#4b5563">
              histórico
            </span>
          </p>
          <p v-if="item.nombre_extraido" class="text-[10px] text-gray-700">
            Nombre extraído: <span class="font-medium">"{{ item.nombre_extraido }}"</span>
          </p>
          <p class="text-[10px] text-gray-500">{{ item.razon }}</p>
          <div class="flex items-center gap-1.5 pt-0.5">
            <select v-model.number="asignacionSeleccionada[item.id]"
              class="text-[11px] border border-gray-200 rounded px-1.5 py-1 flex-1 max-w-[220px]">
              <option :value="null" disabled>Asignar a proyecto…</option>
              <option v-for="p in proyectosOM" :key="p.contrato_id" :value="p.contrato_id">
                {{ p.nombre_proyecto }}
              </option>
            </select>
            <button type="button"
              :disabled="!asignacionSeleccionada[item.id] || asignando[item.id]"
              class="text-[11px] font-semibold px-2 py-1 rounded"
              style="background:var(--color-unergy-purple);color:#fff;border:none"
              :style="!asignacionSeleccionada[item.id] || asignando[item.id] ? 'opacity:0.4' : 'cursor:pointer'"
              @click="asignarSinMatch(item)">
              {{ asignando[item.id] ? 'Asignando…' : 'Asignar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { OmService } from '~/features/finanzas/services/om'
import { formatCOP } from '~/utils/currency'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, CircleXIcon, CloudUploadIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, InboxIcon, LoaderCircleIcon, PaperclipIcon, TriangleAlertIcon } from '@lucide/vue'


const hoy = new Date()
const periodoOffset = ref(0)

const periodoActual = computed(() => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + periodoOffset.value, 1)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
})

const periodoLabel = computed(() => {
  const [yyyy, mm] = periodoActual.value.split('-')
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${MESES[parseInt(mm) - 1]} ${yyyy}`
})

function cambiarMes(delta) { periodoOffset.value += delta }

const loading  = ref(false)
const filas    = ref([])
const toggling = reactive({})

// ── Factura consolidada ───────────────────────────────────────────────────────
const factura          = ref({ nombre_archivo: null, enlace_pdf: null, tiene_archivo: false, subido_en: null })
const archivoSeleccionado = ref(null)
const linkExterno      = ref('')
const subiendoFactura  = ref(false)
const splitResult      = ref(null)

// ── Páginas sin match pendientes de asignación manual ────────────────────────
const sinMatchPendientes    = ref([])
const proyectosOM           = ref([])
const asignacionSeleccionada = reactive({})   // { [sin_match_id]: contrato_id }
const asignando              = reactive({})   // { [sin_match_id]: boolean }

const omService = new OmService()

const puedeSubir = computed(() => !!(archivoSeleccionado.value || linkExterno.value.startsWith('http')))

function onFacturaChange(e) {
  archivoSeleccionado.value = e.target.files?.[0] ?? null
  if (archivoSeleccionado.value) linkExterno.value = ''
}

function fmtFecha(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return '' }
}

async function cargarFactura() {
  const periodoReq = periodoActual.value
  try {
    const data = await omService.obtenerFactura(periodoReq)
    if (periodoReq !== periodoActual.value) return   // respuesta obsoleta
    factura.value = data
    sinMatchPendientes.value = data.sin_match_pendientes ?? []
  } catch { /* silencioso — no hay factura aún */ }
}

async function cargarProyectosOM() {
  try {
    proyectosOM.value = await omService.listarProyectos()
  } catch { /* el selector de asignación queda vacío si falla */ }
}

async function asignarSinMatch(item) {
  const contratoId = asignacionSeleccionada[item.id]
  if (!contratoId) return
  asignando[item.id] = true
  try {
    await omService.asignarSinMatch(periodoActual.value, item.id, contratoId)
    sinMatchPendientes.value = sinMatchPendientes.value.filter(s => s.id !== item.id)
    delete asignacionSeleccionada[item.id]
    toast.success('Página asignada correctamente', { duration: 2500 })
    await cargarDatos()
  } catch {
    toast.error('Error al asignar la página', { duration: 3000 })
  } finally {
    asignando[item.id] = false
  }
}

// Usa OmService (inyecta el Bearer token vía el cliente air compartido) en vez de un
// <a href> directo — VITE_API_URL no está definida en el build de producción, y aunque
// lo estuviera, el endpoint exige Authorization: Bearer, que un <a> no puede enviar.
async function descargarFacturaConsolidada() {
  try {
    const blob = await omService.descargarFacturaArchivo(periodoActual.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = factura.value.nombre_archivo || `factura-${periodoActual.value}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  } catch (e) {
    if (e.status === 404) {
      toast.warning('Archivo no disponible', {
        description: 'La factura de este período ya no está en el servidor. Vuélvela a subir con "Reemplazar".',
        duration: 6000,
      })
    } else {
      toast.error('Error al descargar factura', { duration: 3000 })
    }
  }
}

async function subirFactura() {
  if (!puedeSubir.value) return
  subiendoFactura.value = true
  try {
    if (archivoSeleccionado.value) {
      const data = await omService.subirFactura(periodoActual.value, archivoSeleccionado.value)
      splitResult.value = data.splitting_result ?? null
    } else {
      await omService.guardarFacturaEnlace(periodoActual.value, {
        enlace_pdf: linkExterno.value,
        nombre_archivo: linkExterno.value,
      })
      splitResult.value = null
    }
    archivoSeleccionado.value = null
    linkExterno.value = ''
    await cargarFactura()
    toast.success('Factura subida correctamente', { duration: 2500 })
  } catch {
    toast.error('Error al subir la factura', { duration: 3000 })
  } finally {
    subiendoFactura.value = false
  }
}

async function cargarDatos() {
  const periodoReq = periodoActual.value
  loading.value = true
  try {
    const res = await omService.obtenerCalculo(periodoReq)
    if (periodoReq !== periodoActual.value) return   // respuesta obsoleta: ya se cambió de mes
    filas.value = res.filas.filter(f => f.incluido && f.habilitado)
  } catch {
    if (periodoReq !== periodoActual.value) return
    toast.error('Error al cargar', { duration: 3000 })
  } finally {
    if (periodoReq === periodoActual.value) loading.value = false
  }
}

async function toggleFacturado(fila) {
  toggling[fila.contrato_id] = true
  try {
    await omService.marcarFacturado(periodoActual.value, fila.contrato_id)
    fila.facturado = !fila.facturado
  } catch {
    toast.error('Error al actualizar estado', { duration: 3000 })
  } finally {
    toggling[fila.contrato_id] = false
  }
}

watch(periodoActual, () => { cargarDatos(); cargarFactura(); splitResult.value = null })
onMounted(() => { cargarDatos(); cargarFactura(); cargarProyectosOM() })
</script>
