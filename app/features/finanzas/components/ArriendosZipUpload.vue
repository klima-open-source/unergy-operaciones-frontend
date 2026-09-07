<template>
  <!-- Botón trigger -->
  <div class="inline-block">
    <input ref="zipInputRef" type="file" accept=".zip" class="hidden" @change="onZipSelected" />
    <Button label="Cargar ZIP" size="small" outlined :loading="procesando" @click="zipInputRef.click()" style="border-color:var(--color-unergy-purple);color:var(--color-unergy-purple)">
      <template #icon><UploadIcon class="size-[1em]" /></template>
    </Button>
  </div>

  <!-- ── Dialog preview ──────────────────────────────────────────────────── -->
  <Dialog v-model:visible="showDialog" modal
    header="Vista previa — Predios por documento"
    :style="{ width: '1120px', maxWidth: '98vw' }"
    :closable="!guardando">

    <div class="space-y-4 pt-1">

      <!-- Período detectado del ZIP -->
      <div v-if="periodoZip && periodoZip !== periodo"
        class="rounded-xl border p-3 flex items-center gap-3"
        style="background:#eff6ff;border-color:#bfdbfe">
        <InfoIcon class="text-sm flex-shrink-0 size-[1em]" style="color:#2563eb" />
        <p class="text-xs" style="color:#1e40af">
          El ZIP corresponde al período <strong>{{ periodoZip }}</strong>.
          Los documentos se guardarán en ese período.
        </p>
      </div>

      <!-- Advertencia de documentos ya existentes -->
      <div v-if="hayDuplicados"
        class="rounded-xl border p-3 flex items-start gap-3"
        style="background:#fef3c7;border-color:#f59e0b40">
        <TriangleAlertIcon class="text-sm flex-shrink-0 mt-0.5 size-[1em]" style="color:#d97706" />
        <div class="flex-1 text-xs" style="color:#92400e">
          <p class="font-semibold mb-1">
            Ya existe documento para {{ predioscDuplicados.length }} predio(s) en este período
          </p>
          <p>Si confirmas, se <strong>reemplazarán</strong> los documentos existentes de esos predios.</p>
        </div>
      </div>

      <!-- Predios sin match -->
      <div v-if="prediosSinMatch.length"
        class="rounded-xl border p-3 flex items-start gap-3"
        style="background:#fef2f2;border-color:#fca5a540">
        <CircleAlertIcon class="text-sm flex-shrink-0 mt-0.5 size-[1em]" style="color:#dc2626" />
        <div class="flex-1 text-xs" style="color:#991b1b">
          <p class="font-semibold mb-1">{{ prediosSinMatch.length }} predio(s) sin proyecto en BD</p>
          <p class="font-mono text-[11px]">{{ prediosSinMatch.map(p => p.codigoPredio).join(', ') }}</p>
          <p class="mt-0.5">Se guardarán como <span class="font-mono">…_SIN-MATCH.pdf</span> para revisión manual.</p>
        </div>
      </div>

      <!-- Tabla de preview agrupada por carpeta/documento -->
      <div class="rounded-xl border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto" style="max-height:58vh">
          <table class="w-full text-sm border-collapse" style="min-width:1000px">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100">
                <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Código predio</th>
                <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Proyecto identificado</th>
                <th class="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-32">Valor (COP)</th>
                <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Archivo resultante</th>
                <th class="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-20">Match</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="grupo in gruposPreview" :key="grupo.uid">
                <!-- Encabezado de grupo -->
                <tr class="bg-purple-50/40 border-b border-purple-100">
                  <td colspan="5" class="px-3 py-2">
                    <div class="flex items-center gap-2 flex-wrap text-[11px]">
                      <span class="font-mono text-gray-500">{{ grupo.carpeta }}</span>
                      <span class="text-gray-300">·</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        :style="formatoStyle(grupo.formato)">Formato {{ grupo.formato }}</span>
                      <span v-if="grupo.numeroCuentaCobro" class="text-gray-300">·</span>
                      <span v-if="grupo.numeroCuentaCobro" class="font-semibold" style="color:#6d28d9">
                        {{ grupo.numeroCuentaCobro }}
                      </span>
                      <span class="text-gray-300">·</span>
                      <span class="text-gray-500">Arrendatario:</span>
                      <input v-model="grupo.nombreArrendatario" type="text"
                        placeholder="(vacío)"
                        class="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300"
                        style="min-width:200px" />
                      <span class="ml-auto text-gray-400">{{ grupo.predios.length }} predio(s)</span>
                    </div>
                  </td>
                </tr>
                <!-- Filas de predios -->
                <tr v-for="predio in grupo.predios" :key="predio.uid"
                  class="border-b border-gray-50 hover:bg-gray-50/50"
                  :class="!predio.proyectoId ? 'bg-red-50/40' : (predio.yaExiste ? 'bg-amber-50/40' : '')">
                  <td class="px-3 py-2 font-mono text-xs text-gray-600">
                    {{ predio.codigoPredio }}
                    <RefreshCwIcon class="text-[9px] ml-1 size-[1em]" v-if="predio.yaExiste" style="color:#d97706" title="Ya existe — se reemplazará" />
                  </td>
                  <td class="px-3 py-2">
                    <div v-if="predio.proyectoId" class="text-xs font-medium" style="color:var(--color-unergy-deep)">
                      {{ predio.proyectoNombre }}
                    </div>
                    <select v-else
                      v-model="predio.proyectoId"
                      class="text-xs border border-red-300 rounded px-2 py-1 w-full bg-white"
                      @change="onProyectoSeleccionado(predio)">
                      <option :value="null">— Sin match (SIN-MATCH) —</option>
                      <option v-for="p in props.proyectos" :key="p.id" :value="p.id">
                        {{ p.proyecto }}{{ p.codigo ? ` (${p.codigo})` : '' }}
                      </option>
                    </select>
                    <!-- Selector de arrendador: solo cuando el proyecto tiene MÁS DE UNO -->
                    <select v-if="predio.arrendadorOpciones && predio.arrendadorOpciones.length > 1"
                      v-model="predio.arrArrendadorId"
                      class="text-[11px] border border-purple-200 rounded px-1.5 py-0.5 mt-1 w-full bg-white"
                      title="Este proyecto tiene varios arrendadores: elige a cuál corresponde esta cuenta de cobro">
                      <option v-for="a in predio.arrendadorOpciones" :key="a.id" :value="a.id">
                        {{ a.nombre }}
                      </option>
                    </select>
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-xs text-gray-600">
                    {{ predio.valor != null ? formatCOP(predio.valor) : '—' }}
                  </td>
                  <td class="px-3 py-2 text-[11px] font-mono" style="color:#7c3aed;max-width:320px">
                    <span class="truncate block" :title="nombrePredio(grupo, predio)">
                      {{ nombrePredio(grupo, predio) }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <span v-if="predio.proyectoId"
                      class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style="background:#dcfce7;color:#166534">
                      <CheckIcon class="text-[10px] size-[1em]" />OK
                    </span>
                    <span v-else
                      class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style="background:#fee2e2;color:#991b1b">
                      <XIcon class="text-[10px] size-[1em]" />Sin match
                    </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Acciones -->
      <div class="flex items-center justify-between pt-1">
        <span class="text-xs text-gray-400">
          {{ totalPredios }} predio(s) en {{ gruposPreview.length }} documento(s) ·
          {{ prediosListos }} con match
        </span>
        <div class="flex gap-2">
          <Button label="Cancelar" size="small" outlined severity="secondary"
            :disabled="guardando" @click="showDialog = false" />
          <Button :label="hayDuplicados ? 'Reemplazar y guardar' : 'Confirmar y guardar'" size="small" :loading="guardando" :disabled="totalPredios === 0" @click="confirmar" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>

    </div>
  </Dialog>

  <!-- ── Dialog resumen post-guardado ────────────────────────────────────── -->
  <Dialog v-model:visible="showResumen" modal header="Resultado del procesamiento" :style="{ width: '580px' }">
    <div class="space-y-3 pt-1 text-sm">
      <!-- Asociados -->
      <div class="rounded-lg border p-3 space-y-1.5" style="background:#f0fdf4;border-color:#bbf7d0">
        <p class="text-xs font-semibold" style="color:#166534">
          <CircleCheckIcon class="mr-1 size-[1em]" />
          {{ resumen.asociados.length }} predio(s) asociados correctamente
        </p>
        <div v-for="(item, idx) in resumen.asociados" :key="idx"
          class="flex items-center gap-2 text-[11px] text-gray-600 pl-3">
          <FileTextIcon class="text-[9px] size-[1em]" style="color:#16a34a" />
          <span class="font-mono text-gray-400">{{ item.codigo }}</span>
          <ArrowRightIcon class="text-[9px] text-gray-300 size-[1em]" />
          <span>{{ item.proyecto }}</span>
        </div>
      </div>

      <!-- Sin match -->
      <div v-if="resumen.sinMatch.length" class="rounded-lg border p-3 space-y-1.5" style="background:#fffbeb;border-color:#fcd34d40">
        <p class="text-xs font-semibold" style="color:#92400e">
          <TriangleAlertIcon class="mr-1 size-[1em]" />
          {{ resumen.sinMatch.length }} predio(s) sin match — revisión manual
        </p>
        <div v-for="(item, idx) in resumen.sinMatch" :key="idx"
          class="flex items-center gap-2 text-[11px] pl-3">
          <span class="font-mono font-semibold text-amber-700">{{ item.codigo }}</span>
          <span class="text-gray-400">—</span>
          <span class="text-gray-500">{{ item.carpeta }}</span>
        </div>
      </div>

      <!-- Totales -->
      <div class="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t">
        <span><CopyIcon class="mr-1 size-[1em]" />{{ resumen.copiasGeneradas }} copias generadas</span>
        <span><FolderIcon class="mr-1 size-[1em]" />{{ resumen.carpetasProcesadas }} carpetas procesadas</span>
      </div>
    </div>
    <template #footer>
      <Button label="Cerrar" size="small" @click="cerrarResumen" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { toast } from 'vue-sonner'
import { logger } from '~/core/logger'
import JSZip from 'jszip'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
const { uploadCuentaCobro, fetchDocsPeriodo } = useArriendosDocs()
import { validateZipEntries, getSafeFilePath } from '~/utils/zipSecurityValidator'
import { ArrowRightIcon, CheckIcon, CircleAlertIcon, CircleCheckIcon, CopyIcon, FileTextIcon, FolderIcon, InfoIcon, RefreshCwIcon, TriangleAlertIcon, UploadIcon, XIcon } from '@lucide/vue'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Extensiones que estos ZIP de cuentas de cobro contienen legítimamente
// (PDF/JPG que se procesan + XML/PNG de facturas electrónicas que se acompañan).
// El resto — en especial ejecutables — hace que se rechace todo el ZIP.
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'xml']


const props = defineProps({
  // [{ id (arr_arrendador_id, o sintético -proyecto_id si no tiene contrato),
  //   proyectoId (id real de Proyecto), proyecto, codigo, nombreArrendador, estadoContrato }]
  proyectos:    { type: Array,  required: true },
  periodo:      { type: String, required: true },   // 'YYYY-MM'
  periodoLabel: { type: String, required: true },
})
const emit = defineEmits(['docs-actualizados'])

const zipInputRef   = ref(null)
const procesando    = ref(false)
const guardando     = ref(false)
const showDialog    = ref(false)
const showResumen   = ref(false)
const gruposPreview = ref([])
const periodoZip    = ref(null)

const resumen = ref({ asociados: [], sinMatch: [], copiasGeneradas: 0, carpetasProcesadas: 0 })

let uidCounter = 0
const uid = () => `n_${++uidCounter}`

const todosPredios    = computed(() => gruposPreview.value.flatMap(g => g.predios))
const totalPredios    = computed(() => todosPredios.value.length)
const prediosListos   = computed(() => todosPredios.value.filter(p => p.proyectoId).length)
const prediosSinMatch = computed(() => todosPredios.value.filter(p => !p.proyectoId))
const predioscDuplicados = computed(() => todosPredios.value.filter(p => p.yaExiste))
const hayDuplicados   = computed(() => predioscDuplicados.value.length > 0)

// ── Formato COP ────────────────────────────────────────────────────────────────
function formatCOP(v) {
  if (v == null) return '—'
  return '$ ' + Math.round(v).toLocaleString('es-CO')
}

function formatoStyle(f) {
  return {
    A: 'background:#dcfce7;color:#166534',
    B: 'background:#dbeafe;color:#1e40af',
    C: 'background:#fef3c7;color:#92400e',
    D: 'background:#f3f4f6;color:#6b7280',
  }[f] ?? 'background:#f3f4f6;color:#6b7280'
}

// ── Período del nombre del ZIP ──────────────────────────────────────────────────
function extraerPeriodoDeZip(filename) {
  const m = filename.match(/(\d{4}-\d{2})/)
  if (!m) return null
  const mm = parseInt(m[1].split('-')[1])
  return (mm >= 1 && mm <= 12) ? m[1] : null
}

// ── Nombre de archivo por predio ────────────────────────────────────────────────
// [CODIGO_PREDIO]_[YYYY-MM]_[Arrendatario]_[Nombre Proyecto].pdf  (+ _pagoN si aplica)
function nombrePredio(grupo, predio) {
  const sani = s => (s || '').replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()
  const periodo = periodoZip.value || props.periodo
  const arr  = sani(grupo.nombreArrendatario)
  const proy = predio.proyectoId ? sani(predio.proyectoNombre) : 'SIN-MATCH'
  const partes = [predio.codigoPredio, periodo]
  if (arr) partes.push(arr)
  partes.push(proy)
  let base = partes.join('_')
  if (predio.conPago) base += `_pago${grupo.pagoId}`
  return base + '.pdf'
}

// ── Nombre de archivo seguro para enviar al backend ────────────────────────────
// Descarta cualquier componente de directorio de la ruta del ZIP: nunca se usa
// la ruta cruda como nombre de archivo (evita traversal si el backend confía en
// el nombre entregado por el cliente).
function nombreSeguro(rawPath, fallback) {
  const base = getSafeFilePath(rawPath).split('/').pop()
  return base || fallback
}

// ── Selección del archivo principal según prioridad ───────────────────────────
function seleccionarPrincipal(archivos) {
  const cc = archivos.filter(a =>
    a.nombre.toLowerCase().includes('cuenta_cobro') &&
    !a.nombre.toLowerCase().includes('enviada') &&
    !a.nombre.toLowerCase().includes('_env'))
  if (cc.length) return { principal: cc[0], tipoArchivo: 'cuenta_cobro' }

  const factPdf = archivos.filter(a =>
    a.nombre.toLowerCase().includes('factura_electronica') && a.nombre.toLowerCase().endsWith('.pdf'))
  if (factPdf.length) return { principal: factPdf[0], tipoArchivo: 'factura_electronica' }

  const factJpg = archivos.filter(a =>
    a.nombre.toLowerCase().includes('factura_electronica') &&
    (a.nombre.toLowerCase().endsWith('.jpg') || a.nombre.toLowerCase().endsWith('.jpeg')))
  if (factJpg.length) return { principal: factJpg[0], tipoArchivo: 'factura_electronica_jpg' }

  const otroPdf = archivos.filter(a => a.nombre.toLowerCase().endsWith('.pdf') && !a.nombre.toLowerCase().includes('enviada'))
  if (otroPdf.length) return { principal: otroPdf[0], tipoArchivo: 'pdf' }

  return { principal: archivos[0] || null, tipoArchivo: 'desconocido' }
}

function seleccionarSecundario(archivos, principal) {
  return archivos.find(a =>
    a !== principal &&
    a.nombre.toLowerCase().includes('enviada') &&
    a.nombre.toLowerCase().endsWith('.pdf')) ?? null
}

// ── Extracción de texto del PDF → líneas ──────────────────────────────────────
async function extraerLineas(arrayBuffer) {
  try {
    const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const lineas = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const page    = await pdf.getPage(p)
      const content = await page.getTextContent()
      const byY = {}
      for (const item of content.items) {
        if (!item.str?.trim()) continue
        const y = Math.round(item.transform[5])
        if (!byY[y]) byY[y] = []
        byY[y].push({ x: item.transform[4], str: item.str })
      }
      Object.keys(byY).map(Number).sort((a, b) => b - a).forEach(y => {
        const linea = byY[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim()
        if (linea) lineas.push(linea)
      })
    }
    return lineas
  } catch { return [] }
}

// ── Parseo de números (US "1,646,075.85" o CO "1.646.075,85") ─────────────────
function parseValor(s) {
  if (!s) return null
  let t = String(s).replace(/[^\d.,]/g, '')
  if (!t) return null
  const lastComma = t.lastIndexOf(',')
  const lastDot   = t.lastIndexOf('.')
  if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.')
  else                     t = t.replace(/,/g, '')
  const v = parseFloat(t)
  return isNaN(v) ? null : v
}

// ── Código corto de predio ─────────────────────────────────────────────────────
function predioShort(codigo) {
  if (!codigo) return null
  const m = codigo.match(/COL[A-Z0-9]+P\d+/i)
  return m ? m[0].toUpperCase() : null
}

function prediosDeNombre(nombre) {
  const out = [], seen = new Set()
  const re = /COL[A-Z0-9]+P\d+/gi
  let m
  while ((m = re.exec(nombre)) !== null) {
    const s = m[0].toUpperCase()
    if (!seen.has(s)) { seen.add(s); out.push(s) }
  }
  return out
}

function matchPredio(short) {
  if (!short) return null
  return props.proyectos.find(p => predioShort(p.codigo) === short) ?? null
}

// Todas las filas de props.proyectos que corresponden al mismo código de predio.
// Cuando un proyecto de arriendo tiene varios arrendadores, /arriendos/calculo
// entrega una fila por arrendador (mismo código, distinto id/nombreArrendador),
// así que esto puede devolver más de un resultado.
function matchesPredio(short) {
  if (!short) return []
  return props.proyectos.filter(p => predioShort(p.codigo) === short)
}

// Arrendador por defecto para un conjunto de filas ya matcheadas:
// - Varias filas (varios arrendadores reales) → la primera, el usuario podrá cambiarla.
// - Una sola fila y viene de un contrato real (estadoContrato !== 'sin_contrato') → su id
//   ya es un arr_arrendador_id válido, se puede enviar sin pedir selección.
// - Una sola fila "de respaldo" (proyecto sin contrato aún) → su id es sintético
//   (no existe en la tabla de arrendadores), no se envía arr_arrendador_id.
function arrendadorIdDefault(matches) {
  if (matches.length > 1) return matches[0].id
  if (matches.length === 1 && matches[0].estadoContrato !== 'sin_contrato') return matches[0].id
  return null
}

// ── Encabezado: N° de cuenta + arrendatario (DEBE A) ───────────────────────────
function extraerEncabezado(lineas) {
  const texto = lineas.join('\n')
  let numero = null, arrendatario = null

  const mNum = texto.match(/CUENTA\s+DE\s+COBRO[^A-Z0-9]*([A-Z]+-[\d-]+)/i)
  if (mNum) numero = mNum[1].trim()

  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/DEBE\s+A\s*:?\s*(.+)/i)
    if (m && m[1].trim()) { arrendatario = m[1].trim(); break }
    if (/DEBE\s+A\s*:?\s*$/i.test(lineas[i]) && lineas[i + 1]) { arrendatario = lineas[i + 1].trim(); break }
  }
  if (arrendatario) arrendatario = arrendatario.replace(/\s*(C\.?C\.?|NIT)\.?\s*[\d.\-]+.*$/i, '').trim()
  return { numero, arrendatario }
}

// Emisora de una factura de tercero (best-effort)
function extraerEmisora(lineas) {
  for (const l of lineas) {
    const m = l.match(/raz[oó]n\s+social\s*:?\s*(.+)/i)
    if (m && m[1].trim()) return m[1].split(/[,;|]/)[0].trim().slice(0, 80)
  }
  for (const l of lineas) {
    if (/\b(S\.?A\.?S|LTDA|E\.?U|S\.?A)\b/i.test(l) && /[A-Za-z]{4,}/.test(l)) {
      return l.replace(/\s*(NIT|C\.?C)\.?.*$/i, '').trim().slice(0, 80)
    }
  }
  return null
}

// Predios desde la tabla de conceptos (Formato A)
function extraerPrediosTabla(lineas) {
  const predios = []
  const seen = new Set()
  for (const l of lineas) {
    if (!/Arriendo\s+de\s+Proyecto/i.test(l) && !/COL[A-Z0-9]+P\d+/i.test(l)) continue
    const mFull = l.match(/COL[A-Z0-9]+P\d+(?:_[A-Z0-9\-]+)*/i)
    if (!mFull) continue
    const short = predioShort(mFull[0])
    if (!short || seen.has(short)) continue
    const nums  = l.match(/\d[\d.,]*\d/g) || []
    const valor = nums.length ? parseValor(nums[nums.length - 1]) : null
    seen.add(short)
    predios.push({ codigoPredio: short, valor })
  }
  return predios
}

// Monto total (para repartir en Formato B)
function extraerTotal(lineas) {
  for (const l of lineas) {
    if (/total/i.test(l)) {
      const nums = l.match(/\d[\d.,]*\d/g)
      if (nums?.length) { const v = parseValor(nums[nums.length - 1]); if (v) return v }
    }
  }
  let best = null
  for (const l of lineas) {
    for (const n of (l.match(/\d[\d.,]*\d/g) || [])) {
      const v = parseValor(n)
      if (v && (best === null || v > best)) best = v
    }
  }
  return best
}

// ── Procesamiento del ZIP ─────────────────────────────────────────────────────
async function onZipSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''

  procesando.value    = true
  gruposPreview.value = []
  periodoZip.value    = extraerPeriodoDeZip(file.name)

  try {
    const zip = await JSZip.loadAsync(file)

    // ── Validación de seguridad (Zip Slip + allowlist de extensiones) ──────────
    const { valid, errors } = validateZipEntries(zip, { allowedExtensions: EXTENSIONES_PERMITIDAS })
    if (!valid) {
      const primeros = errors.slice(0, 4).map(e => e.message).join(' · ')
      const extra = errors.length > 4 ? ` (+${errors.length - 4} más)` : ''
      toast.error('ZIP rechazado por seguridad', {
        description: `Estructura de archivos inválida o tipo no permitido. ${primeros}${extra}`,
        duration: 8000,
      })
      return
    }

    const carpetas = new Set()
    zip.forEach((path) => {
      const top = path.split('/')[0]
      if (top.toLowerCase().startsWith('pago_')) carpetas.add(top)
    })

    if (!carpetas.size) {
      toast.warning('ZIP sin carpetas pago_*', { duration: 4000 })
      return
    }

    const grupos = []

    for (const carpeta of [...carpetas].sort()) {
      const partes         = carpeta.split('_')
      const pagoId         = parseInt(partes[1]) || 0
      const codigoExtraido = partes.slice(2).join('_')

      const archivos = []
      zip.forEach((path, entry) => {
        if (path.startsWith(carpeta + '/') && !entry.dir) {
          archivos.push({ path, entry, nombre: path.split('/').pop() })
        }
      })
      if (!archivos.length) continue

      const { principal, tipoArchivo } = seleccionarPrincipal(archivos)
      const secundario = seleccionarSecundario(archivos, principal)
      if (!principal) continue

      const esPdf     = principal.nombre.toLowerCase().endsWith('.pdf')
      const esJpg     = !esPdf
      const pdfBuffer = await principal.entry.async('arraybuffer')
      const pdfBlob   = new Blob([pdfBuffer], { type: esPdf ? 'application/pdf' : 'image/jpeg' })

      let pdfSecBlob = null, pdfSecNombre = null
      if (secundario) {
        pdfSecBlob   = new Blob([await secundario.entry.async('arraybuffer')], { type: 'application/pdf' })
        pdfSecNombre = secundario.nombre
      }

      let numeroCuentaCobro = null, nombreArrendatario = null, total = null
      let prediosTabla = []
      let lineas = []
      if (esPdf) {
        lineas = await extraerLineas(pdfBuffer)
        const enc = extraerEncabezado(lineas)
        numeroCuentaCobro  = enc.numero
        nombreArrendatario = enc.arrendatario
        prediosTabla = extraerPrediosTabla(lineas)
        total = extraerTotal(lineas)
      }

      const esCuentaCobro = tipoArchivo === 'cuenta_cobro'

      // Determinar formato y lista de códigos de predio
      let formato, codigosPredio
      if (prediosTabla.length) {
        formato = 'A'
        codigosPredio = prediosTabla.map(p => p.codigoPredio)
      } else {
        codigosPredio = prediosDeNombre(principal.nombre)
        if (esJpg)              formato = 'D'
        else if (esCuentaCobro) formato = 'B'
        else                    formato = 'C'
      }

      // Arrendatario según formato
      if (formato === 'C' && !nombreArrendatario) nombreArrendatario = extraerEmisora(lineas)
      if (formato === 'D') nombreArrendatario = nombreArrendatario || ''

      // Valor por predio
      const valoresTabla = Object.fromEntries(prediosTabla.map(p => [p.codigoPredio, p.valor]))
      const nPredios = codigosPredio.length || 1
      function valorDe(codigo) {
        if (formato === 'A') return valoresTabla[codigo] ?? null
        if (formato === 'B' && total) return Math.round(total / nPredios)
        return null
      }

      const predios = (codigosPredio.length ? codigosPredio : [codigoExtraido]).map(codigo => {
        const short = predioShort(codigo) || codigo
        const matches = matchesPredio(short)
        const m = matches[0] ?? null
        return {
          uid: uid(),
          codigoPredio:   short,
          valor:          valorDe(short),
          proyectoId:     m?.id ?? null,
          // Id real de Proyecto (para documentos, indexados por proyecto_id, no por
          // arr_arrendador_id). Todos los matches del mismo predio comparten proyecto.
          proyectoRealId: m?.proyectoId ?? null,
          proyectoNombre: m?.proyecto ?? null,
          conPago:        false,   // se calcula luego (predio repetido entre pagos)
          yaExiste:       false,
          // Varios arrendadores para el mismo proyecto → selector; si no, null/valor único.
          arrendadorOpciones: matches.map(p => ({ id: p.id, nombre: p.nombreArrendador || p.proyecto })),
          arrArrendadorId: arrendadorIdDefault(matches),
        }
      })

      grupos.push({
        uid: uid(), carpeta, pagoId, codigoExtraido,
        numeroCuentaCobro, nombreArrendatario, tipoArchivo, formato,
        pdfBlob, pdfSecBlob, pdfSecNombre, originalName: principal.nombre, predios,
      })
    }

    if (!grupos.length) {
      toast.warning('No se encontraron documentos procesables', { duration: 4000 })
      return
    }

    // Marcar predios repetidos entre pagos (para el sufijo _pagoN)
    const conteo = {}
    for (const g of grupos) for (const p of g.predios) conteo[p.codigoPredio] = (conteo[p.codigoPredio] || 0) + 1
    for (const g of grupos) for (const p of g.predios) p.conPago = conteo[p.codigoPredio] > 1

    // Advertencia: documentos ya existentes en el período (mismo proyecto + pago)
    try {
      const existentes = await fetchDocsPeriodo(periodoZip.value || props.periodo)
      const clave = new Set(existentes.map(d => `${d.proyecto_id}|${d.pago_id}`))
      for (const g of grupos) for (const p of g.predios) {
        if (p.proyectoRealId && clave.has(`${p.proyectoRealId}|${g.pagoId}`)) p.yaExiste = true
      }
    } catch { /* no bloquea */ }

    gruposPreview.value = grupos
    showDialog.value = true
  } catch (err) {
    logger.error('finanzas', err)
    toast.error('Error al procesar el ZIP', { description: err.message, duration: 5000 })
  } finally {
    procesando.value = false
  }
}

function onProyectoSeleccionado(predio) {
  const p = props.proyectos.find(p => p.id === predio.proyectoId)
  predio.proyectoNombre = p?.proyecto ?? null
  predio.proyectoRealId = p?.proyectoId ?? null
  const matches = p ? props.proyectos.filter(x => x.codigo === p.codigo) : []
  predio.arrendadorOpciones = matches.map(x => ({ id: x.id, nombre: x.nombreArrendador || x.proyecto }))
  predio.arrArrendadorId = arrendadorIdDefault(matches)
}

// ── Confirmar y guardar ───────────────────────────────────────────────────────
async function confirmar() {
  guardando.value = true
  const periodoParse = periodoZip.value || props.periodo
  const asociados = []
  const sinMatch  = []
  let copiasGeneradas    = 0
  let carpetasProcesadas = 0

  try {
    for (const grupo of gruposPreview.value) {
      carpetasProcesadas++
      const filename = `documento_pago${grupo.pagoId}.pdf`   // nombre del archivo original enviado
      try {
        await uploadCuentaCobro({
          file:           new File([grupo.pdfBlob], nombreSeguro(grupo.originalName, filename)),
          fileSecundario: grupo.pdfSecBlob ? new File([grupo.pdfSecBlob], nombreSeguro(grupo.pdfSecNombre, 'enviada.pdf')) : null,
          periodo:        periodoParse,
          pagoId:         grupo.pagoId,
          codigoContrato: grupo.codigoExtraido,
          tipoDocumento:  grupo.tipoArchivo,
          numeroCuentaCobro:  grupo.numeroCuentaCobro,
          nombreArrendatario: grupo.nombreArrendatario,
          predios: grupo.predios.map(p => ({
            arr_proyecto_id:  p.proyectoId,
            proyecto_id:      p.proyectoRealId,
            codigo_predio:    p.codigoPredio,
            valor_individual: p.valor,
            nombre_resultante: nombrePredio(grupo, p),
            // Solo se envía cuando es un arr_arrendador_id real conocido (ver arrendadorIdDefault).
            ...(p.arrArrendadorId != null ? { arr_arrendador_id: p.arrArrendadorId } : {}),
          })),
        })
        for (const p of grupo.predios) {
          copiasGeneradas++
          if (p.proyectoId) asociados.push({ codigo: p.codigoPredio, proyecto: p.proyectoNombre })
          else              sinMatch.push({ codigo: p.codigoPredio, carpeta: grupo.carpeta })
        }
      } catch (uploadErr) {
        logger.error('finanzas', uploadErr)
        toast.warning(`Error al subir ${grupo.carpeta}`, { duration: 4000 })
      }
    }

    resumen.value = { asociados, sinMatch, copiasGeneradas, carpetasProcesadas }
    showDialog.value  = false
    showResumen.value = true
    emit('docs-actualizados', periodoParse)
  } catch (err) {
    logger.error('finanzas', err)
    toast.error('Error al guardar', { description: err.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

function cerrarResumen() {
  showResumen.value = false
  emit('docs-actualizados', periodoZip.value || props.periodo)
}
</script>
