<template>
  <div class="space-y-5">
    <!-- Stepper header -->
    <div class="flex items-center gap-0">
      <template v-for="(step, idx) in steps" :key="step.key">
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
            :style="stepCircleStyle(idx)"
          >{{ idx + 1 }}</div>
          <span class="text-sm font-medium" :style="activeStep >= idx ? 'color:var(--color-unergy-purple)' : 'color:#9ca3af'">
            {{ step.label }}
          </span>
        </div>
        <div v-if="idx < steps.length - 1" class="flex-1 mx-3 h-px" style="background:#e8e0f0; min-width:24px" />
      </template>
    </div>

    <!-- Step 1: Cargar -->
    <div v-show="activeStep === 0" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="space-y-1">
          <p class="text-xs font-semibold" style="color:#6b5a8a">Garantía Semanal Mensual</p>
          <DropZone
            label="Garantía Semanal Mensual"
            :pattern="PATTERNS.garantia"
            @update:file="files.garantia = $event"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs font-semibold" style="color:#6b5a8a">Saldo Cuenta Custodia</p>
          <DropZone
            label="Saldo Cuenta Custodia"
            :pattern="PATTERNS.saldo"
            @update:file="files.saldo = $event"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs font-semibold" style="color:#6b5a8a">WEB Garantías</p>
          <DropZone
            label="WEB Garantías"
            :pattern="PATTERNS.web"
            @update:file="files.web = $event"
          />
        </div>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-semibold" style="color:#6b5a8a">Facturas XM (PDF) — opcional</p>
        <label class="border-2 border-dashed rounded-xl p-4 flex items-center justify-center gap-2 cursor-pointer text-xs"
          style="border-color:#c4b8d4;background:#fafafa;color:#6b5a8a">
          <FileTextIcon class="size-[1em]" style="color:#D64455" />
          <span v-if="!files.pdfs.length">Arrastra o haz clic para subir uno o varios PDF</span>
          <span v-else>{{ files.pdfs.length }} PDF(s) seleccionado(s)</span>
          <input type="file" accept=".pdf" multiple class="hidden" @change="onPdfsSelect" />
        </label>
      </div>

      <div v-if="parseErrors.length" class="rounded-lg p-3 space-y-1" style="background:#FEF2F2; border:1px solid rgba(214,68,85,0.2)">
        <p v-for="e in parseErrors" :key="e" class="text-xs" style="color:#D64455">{{ e }}</p>
      </div>

      <div class="flex justify-end">
        <Button label="Procesar" :loading="loading" :disabled="!allFilesLoaded" @click="procesar" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
          <template #icon><ZapIcon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <!-- Step 2: Revisar -->
    <div v-show="activeStep === 1" class="space-y-5">
      <div v-if="resultado">
        <!-- Hoja madre (misma vista reutilizada en el Histórico) -->
        <HojaMadreView :data="vistaActual" class="mb-2" />

        <div v-if="facturas?.documentos?.length" class="mt-2">
          <div class="flex items-center gap-2 justify-end mb-1">
            <label class="text-xs font-semibold" style="color:#6b5a8a">Fecha objetivo (viernes):</label>
            <input type="date" v-model="fechaObjetivo" class="rounded px-2 py-1 text-xs" style="border:1px solid #e8e0f0" />
          </div>
          <FacturasDescuento
            :documentos="facturas.documentos"
            :disponible="resultado.custodia?.disponible ?? 0"
            :fechaObjetivo="fechaObjetivo"
            v-model:totalDescontado="totalDescontado"
          />
        </div>

        <div class="flex justify-between mt-4">
          <Button label="Volver" text severity="secondary" @click="activeStep = 0">
            <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
          </Button>
          <div class="flex gap-2">
            <Button label="Exportar Excel" outlined severity="secondary" size="small" @click="exportar">
              <template #icon><FileSpreadsheetIcon class="size-[1em]" /></template>
            </Button>
            <Button label="Guardar en histórico" outlined size="small" :loading="guardando" @click="guardarRegistro" style="color:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
              <template #icon><SaveIcon class="size-[1em]" /></template>
            </Button>
            <Button label="Generar mensaje" icon-pos="right" @click="generarYAvanzar" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
              <template #icon><ArrowRightIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3: Mensaje -->
    <div v-show="activeStep === 2" class="space-y-4">
      <div class="bg-white rounded-xl p-5 shadow-sm space-y-4" style="border:1px solid #e8e0f0">
        <!-- Campos editables -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold uppercase tracking-wide" style="color:#6b5a8a">{{ esNegativo ? 'Recursos que regresan ($)' : 'Total a consignar ($)' }}</label>
            <InputNumber v-model="montoEditable" fluid :max-fraction-digits="0" @update:model-value="actualizarMensaje" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-semibold uppercase tracking-wide" style="color:#6b5a8a">% variación PB</label>
            <InputNumber v-model="variacionPb" fluid :max-fraction-digits="2" suffix="%" @update:model-value="actualizarMensaje" />
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold uppercase tracking-wide" style="color:#6b5a8a">Menciones</label>
          <input
            v-model="mencionesEditable"
            @input="actualizarMensaje"
            class="w-full rounded-lg px-3 py-2 text-sm"
            style="border:1px solid #e8e0f0; outline:none"
            placeholder="@Juan @María"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold uppercase tracking-wide" style="color:#6b5a8a">Nota de contexto (opcional)</label>
          <Textarea v-model="contexto" rows="2" fluid @input="actualizarMensaje" placeholder="Notas adicionales..." />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold uppercase tracking-wide" style="color:#6b5a8a">Frase de tendencia (editable)</label>
          <Textarea v-model="tendencia" rows="2" fluid @input="actualizarMensaje" />
        </div>

        <!-- Mensaje generado -->
        <div class="space-y-1">
          <label class="text-xs font-semibold uppercase tracking-wide" style="color:#6b5a8a">Borrador del mensaje</label>
          <Textarea v-model="mensajeEditable" rows="8" fluid class="font-mono text-xs" />
        </div>
      </div>

      <div class="flex justify-between">
        <Button label="Volver" text severity="secondary" @click="activeStep = 1">
          <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
        </Button>
        <div class="flex gap-2">
          <Button label="Copiar" outlined severity="secondary" @click="copiar">
            <template #icon><CopyIcon class="size-[1em]" /></template>
          </Button>
          <Button label="Confirmar y guardar" :loading="guardando" @click="guardarRegistro" style="background:var(--color-unergy-purple);border-color:var(--color-unergy-purple)">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import { toast } from 'vue-sonner'
import { logger } from '~/core/logger'
import DropZone from '../DropZone.vue'
import HojaMadreView from '../HojaMadreView.vue'
import FacturasDescuento from '../FacturasDescuento.vue'
import { parseFacturas, viernesDeEstaSemana } from '../composables/useFacturasPDF.js'
import { parseSemanales } from '../composables/useGarantiasParser.js'
import { useGarantiasHistorial } from '../composables/useGarantiasHistorial.js'
import { fmtCOP, fmtISODate } from '../utils/formatters.js'
import { exportHojaMadreExcel } from '../utils/excelExport.js'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon, FileSpreadsheetIcon, FileTextIcon, SaveIcon, ZapIcon } from '@lucide/vue'

const store = useGarantiasHistorial()

const PATTERNS = {
  garantia: /garanti[aá]\s*semanal\s*mensual/i,
  saldo: /saldo\s*cuenta\s*custodia/i,
  web: /web[\s_-]*garant(i[ea]s?)/i,
}

const steps = [
  { key: 'cargar', label: 'Cargar' },
  { key: 'revisar', label: 'Revisar' },
  { key: 'mensaje', label: 'Mensaje' },
]

const activeStep = ref(0)
const loading = ref(false)
const guardando = ref(false)
const parseErrors = ref([])
const resultado = ref(null)

const facturas = ref(null)
const fechaObjetivo = ref(fmtISODate(viernesDeEstaSemana()))
const totalDescontado = ref(0)

const files = ref({ garantia: null, saldo: null, web: null, pdfs: [] })

const allFilesLoaded = computed(
  () => files.value.garantia && files.value.saldo && files.value.web,
)

// Disponible (cuenta custodia, col 9 del Saldo) sin descuento.
const disponibleCrudo = computed(() => resultado.value?.custodia?.disponible ?? null)

// Suma neta de las facturas marcadas para descontar (0 si no hay facturas).
const facturasDescontadas = computed(() =>
  facturas.value?.documentos?.length ? (Number(totalDescontado.value) || 0) : 0,
)

// Disponible neto = crudo − facturas descontadas.
const disponibleNeto = computed(() =>
  disponibleCrudo.value == null ? null : disponibleCrudo.value - facturasDescontadas.value,
)

const disponibleAplicacion = computed(() => {
  if (disponibleNeto.value == null) return 0
  // Disponible neto − TOTAL A PAGAR (UNGG+UNGC). Ese total suele ser negativo,
  // por lo que restarlo aumenta el disponible.
  return disponibleNeto.value - ((resultado.value?.totalUNGG ?? 0) + (resultado.value?.totalUNGC ?? 0))
})

const montoEditable = ref(0)
const variacionPb = ref(null)
const mencionesEditable = ref('')
const contexto = ref('')
const tendencia = ref('')
const mensajeEditable = ref('')

// El TOTAL A PAGAR (UNGG+UNGC) negativo = devolución de recursos (no se consigna).
const esNegativo = computed(() => (resultado.value?.totalConsignar ?? 0) < 0)

// Vista completa de la hoja madre (se muestra en vivo y se guarda como snapshot).
const vistaActual = computed(() => {
  if (!resultado.value) return null
  return {
    fechaNombre: resultado.value.fechaNombre,
    precios: resultado.value.precios,
    ungc: resultado.value.ungc,
    ungg: resultado.value.ungg,
    totalUNGC: resultado.value.totalUNGC,
    totalUNGG: resultado.value.totalUNGG,
    totalConsignar: resultado.value.totalConsignar,
    disponibleCrudo: disponibleCrudo.value,
    facturasDescontadas: facturasDescontadas.value,
    disponibleNeto: disponibleNeto.value,
    disponibleAplicacion: disponibleAplicacion.value,
    congelado: resultado.value.custodia?.congelado ?? null,
    saldo: resultado.value.custodia?.saldo ?? null,
    pb: resultado.value.precios?.pb ?? null,
    variacionPb: variacionPb.value,
  }
})

function stepCircleStyle(idx) {
  if (activeStep.value > idx)
    return 'background:#10B981; color:white'
  if (activeStep.value === idx)
    return 'background:#915BD8; color:white'
  return 'background:#e8e0f0; color:#9ca3af'
}

function onPdfsSelect(e) {
  files.value.pdfs = Array.from(e.target.files || [])
  e.target.value = ''
}

async function procesar() {
  loading.value = true
  parseErrors.value = []
  try {
    const res = await parseSemanales(files.value.garantia, files.value.saldo, files.value.web)
    if (res.errors.length) {
      parseErrors.value = res.errors
    }
    resultado.value = res
    if (files.value.pdfs.length) {
      try {
        const f = await parseFacturas(files.value.pdfs)
        facturas.value = f
        if (f.errors.length) parseErrors.value = [...parseErrors.value, ...f.errors]
      } catch (e) {
        parseErrors.value = [...parseErrors.value, `Error leyendo PDFs: ${e.message}`]
      }
    } else {
      facturas.value = null
    }
    activeStep.value = 1
  } catch (e) {
    parseErrors.value = [`Error inesperado: ${e.message}`]
  } finally {
    loading.value = false
  }
}

function generarYAvanzar() {
  if (!resultado.value) return
  montoEditable.value = Math.abs(resultado.value.totalConsignar || 0)
  const pbAnterior = store.getPbAnterior()
  const pbActual = resultado.value.precios?.pb
  if (pbAnterior != null && pbActual != null && pbAnterior !== 0) {
    variacionPb.value = parseFloat(((pbActual - pbAnterior) / pbAnterior * 100).toFixed(2))
  } else {
    variacionPb.value = null
  }
  tendencia.value = esNegativo.value
    ? 'la bolsa presenta una tendencia a la baja, que se refleja en las garantías por precio'
    : 'la bolsa presenta una tendencia al alza, que se refleja en las garantías por precio'
  mencionesEditable.value = store.getMenciones()
  contexto.value = ''
  actualizarMensaje()
  activeStep.value = 2
}

// Variación del PB: "Aumento del X%" / "Disminución del X%" (abs, 2 decimales).
function variacionTexto() {
  const v = variacionPb.value
  if (v == null) return ''
  const abs = Math.abs(v).toFixed(2)
  return v >= 0 ? `Aumento del ${abs}%` : `Disminución del ${abs}%`
}

function actualizarMensaje() {
  if (!resultado.value) return
  const pb = resultado.value.precios?.pb
  const pbFmt = pb != null
    ? new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pb)
    : '—'
  const variStr = variacionTexto()
  const pbLinea = `Precio de bolsa del cálculo: $${pbFmt}${variStr ? ` (${variStr})` : ''}`
  const tendLinea = tendencia.value ? `\n${tendencia.value}` : ''
  const menc = mencionesEditable.value ? `\n\n${mencionesEditable.value}` : ''
  const nota = contexto.value ? ` ${contexto.value}` : ''
  const monto = fmtCOP(montoEditable.value)

  if (esNegativo.value) {
    mensajeEditable.value = `Para esta semana nos están regresando recursos ${monto}, por lo que no hay valor a consignar.${nota}

${pbLinea}${tendLinea}${menc}`
  } else {
    mensajeEditable.value = `Para esta semana el total a consignar es de ${monto}${nota}.

Les recuerdo que este dinero debe estar en la cuenta custodia a más tardar el viernes.

${pbLinea}${tendLinea}${menc}`
  }
}

async function copiar() {
  await navigator.clipboard.writeText(mensajeEditable.value)
  toast.success('Mensaje copiado', { duration: 2000 })
}

function exportar() {
  if (!resultado.value) return
  exportHojaMadreExcel({
    ungc: resultado.value.ungc,
    ungg: resultado.value.ungg,
    totalConsignar: resultado.value.totalConsignar,
    custodia: resultado.value.custodia,
    disponibleCrudo: disponibleCrudo.value,
    facturasDescontadas: facturasDescontadas.value,
    disponibleNeto: disponibleNeto.value,
    disponibleAplicacion: disponibleAplicacion.value,
  }, `garantias_semanal_${resultado.value.fechaNombre || 'resultado'}.xlsx`)
}

async function guardarRegistro() {
  if (!resultado.value) return
  const p = resultado.value.precios
  // Fecha REAL de la semana (del nombre del archivo); si no se pudo extraer, hoy.
  const fecha = resultado.value.fecha || fmtISODate(new Date())
  guardando.value = true
  try {
    await store.guardar({
      tipo: 'semanal',
      fecha,
      pb: p?.pb ?? null,
      restricciones: p?.restricciones ?? null,
      stn: p?.stn ?? null,
      trm: p?.trm ?? null,
      ptb: p?.ptb ?? null,
      totalUNGC: resultado.value.totalUNGC,
      totalUNGG: resultado.value.totalUNGG,
      // Total con su signo real (negativo = devolución), independiente de lo editado en el mensaje.
      totalConsignar: resultado.value.totalConsignar,
      disponibleCustodia: resultado.value.custodia?.disponible ?? null,
      congelado: resultado.value.custodia?.congelado ?? null,
      saldo: resultado.value.custodia?.saldo ?? null,
      totalAjusteTXR: null,
      snapshot: vistaActual.value,
    })
    if (p?.pb != null) store.setPbAnterior(p.pb)
    toast.success('Guardado en historial', { description: `Reporte del ${fecha}`, duration: 3000 })
  } catch (e) {
    const detalle = e?.data?.detail || e?.message || 'Error desconocido'
    logger.error('garantias', e)
    toast.error('No se pudo guardar', { description: String(detalle), duration: 6000 })
  } finally {
    guardando.value = false
  }
}
</script>
