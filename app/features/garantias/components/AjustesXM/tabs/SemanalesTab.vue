<script setup lang="ts">
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LoaderCircleIcon,
  SaveIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { logger } from '~/core/logger'
import { normalizeError } from '~/core/errors'
import DatePicker from '~/components/blocks/DatePicker.vue'
import DropZone from '../DropZone.vue'
import HojaMadreView from '../HojaMadreView.vue'
import FacturasDescuento from '../FacturasDescuento.vue'
import type { ResultadoFacturas } from '../composables/useFacturasPDF'
import { parseFacturas } from '../composables/useFacturasPDF'
import type { HojaMadre, ResultadoSemanales } from '../composables/useGarantiasParser'
import { parseSemanales } from '../composables/useGarantiasParser'
import { useGarantiasHistorial } from '../composables/useGarantiasHistorial'
import { fmtISODate, viernesDeEstaSemana } from '../utils/formatters'
import { exportHojaMadreExcel } from '../utils/excelExport'

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
const parseErrors = ref<string[]>([])
const resultado = ref<ResultadoSemanales | null>(null)

const facturas = ref<ResultadoFacturas | null>(null)
const fechaObjetivo = ref(fmtISODate(viernesDeEstaSemana()))
const totalDescontado = ref(0)

const files = ref<{ garantia: File | null; saldo: File | null; web: File | null; pdfs: File[] }>({
  garantia: null,
  saldo: null,
  web: null,
  pdfs: [],
})

const allFilesLoaded = computed(
  () => !!(files.value.garantia && files.value.saldo && files.value.web),
)

// Disponible (cuenta custodia, col 9 del Saldo) sin descuento.
const disponibleCrudo = computed(() => resultado.value?.custodia?.disponible ?? null)

// Suma neta de las facturas marcadas para descontar (0 si no hay facturas).
const facturasDescontadas = computed(() =>
  facturas.value?.documentos?.length ? Number(totalDescontado.value) || 0 : 0,
)

// Disponible neto = crudo − facturas descontadas.
const disponibleNeto = computed(() =>
  disponibleCrudo.value == null ? null : disponibleCrudo.value - facturasDescontadas.value,
)

const disponibleAplicacion = computed(() => {
  if (disponibleNeto.value == null) return 0
  // Disponible neto − TOTAL A PAGAR (UNGG+UNGC). Ese total suele ser negativo,
  // por lo que restarlo aumenta el disponible.
  return (
    disponibleNeto.value - ((resultado.value?.totalUNGG ?? 0) + (resultado.value?.totalUNGC ?? 0))
  )
})

const montoEditable = ref(0)
const variacionPb = ref<number | null>(null)
const mencionesEditable = ref('')
const contexto = ref('')
const tendencia = ref('')
const mensajeEditable = ref('')

// El TOTAL A PAGAR (UNGG+UNGC) negativo = devolución de recursos (no se consigna).
const esNegativo = computed(() => (resultado.value?.totalConsignar ?? 0) < 0)

// Vista completa de la hoja madre (se muestra en vivo y se guarda como snapshot).
const vistaActual = computed<HojaMadre | null>(() => {
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

function stepCircleClass(idx: number): string {
  if (activeStep.value > idx) return 'bg-success text-white'
  if (activeStep.value === idx) return 'bg-primary text-primary-foreground'
  return 'bg-muted text-muted-foreground'
}

function onPdfsSelect(e: Event) {
  const input = e.target as HTMLInputElement
  files.value.pdfs = Array.from(input.files || [])
  input.value = ''
}

async function procesar() {
  if (!files.value.garantia || !files.value.saldo || !files.value.web) return
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
        parseErrors.value = [
          ...parseErrors.value,
          `Error leyendo PDFs: ${normalizeError(e).message}`,
        ]
      }
    } else {
      facturas.value = null
    }
    activeStep.value = 1
  } catch (e) {
    parseErrors.value = [`Error inesperado: ${normalizeError(e).message}`]
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
    variacionPb.value = parseFloat((((pbActual - pbAnterior) / pbAnterior) * 100).toFixed(2))
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
function variacionTexto(): string {
  const v = variacionPb.value
  if (v == null) return ''
  const abs = Math.abs(v).toFixed(2)
  return v >= 0 ? `Aumento del ${abs}%` : `Disminución del ${abs}%`
}

function actualizarMensaje() {
  if (!resultado.value) return
  const pb = resultado.value.precios?.pb
  const pbFmt =
    pb != null
      ? new Intl.NumberFormat('es-CO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(pb)
      : '—'
  const variStr = variacionTexto()
  const pbLinea = `Precio de bolsa del cálculo: $${pbFmt}${variStr ? ` (${variStr})` : ''}`
  const tendLinea = tendencia.value ? `\n${tendencia.value}` : ''
  const menc = mencionesEditable.value ? `\n\n${mencionesEditable.value}` : ''
  const nota = contexto.value ? ` ${contexto.value}` : ''
  const monto = formatCOP(montoEditable.value)

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
  exportHojaMadreExcel(
    {
      ungc: resultado.value.ungc,
      ungg: resultado.value.ungg,
      totalConsignar: resultado.value.totalConsignar,
      custodia: resultado.value.custodia,
      disponibleCrudo: disponibleCrudo.value,
      facturasDescontadas: facturasDescontadas.value,
      disponibleNeto: disponibleNeto.value,
      disponibleAplicacion: disponibleAplicacion.value,
    },
    `garantias_semanal_${resultado.value.fechaNombre || 'resultado'}.xlsx`,
  )
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
    logger.error('garantias', e)
    toast.error('No se pudo guardar', { description: normalizeError(e).message, duration: 6000 })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Stepper header -->
    <div class="flex items-center gap-0">
      <template v-for="(step, idx) in steps" :key="step.key">
        <div class="flex items-center gap-2">
          <div
            class="flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors"
            :class="stepCircleClass(idx)"
          >
            {{ idx + 1 }}
          </div>
          <span
            class="text-sm font-medium"
            :class="activeStep >= idx ? 'text-primary' : 'text-muted-foreground'"
          >
            {{ step.label }}
          </span>
        </div>
        <div v-if="idx < steps.length - 1" class="mx-3 h-px min-w-6 flex-1 bg-border" />
      </template>
    </div>

    <!-- Step 1: Cargar -->
    <div v-show="activeStep === 0" class="space-y-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="space-y-1">
          <p class="text-xs font-semibold text-muted-foreground">Garantía Semanal Mensual</p>
          <DropZone
            label="Garantía Semanal Mensual"
            :pattern="PATTERNS.garantia"
            @update:file="files.garantia = $event"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs font-semibold text-muted-foreground">Saldo Cuenta Custodia</p>
          <DropZone
            label="Saldo Cuenta Custodia"
            :pattern="PATTERNS.saldo"
            @update:file="files.saldo = $event"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs font-semibold text-muted-foreground">WEB Garantías</p>
          <DropZone
            label="WEB Garantías"
            :pattern="PATTERNS.web"
            @update:file="files.web = $event"
          />
        </div>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-semibold text-muted-foreground">Facturas XM (PDF) — opcional</p>
        <label
          class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/40 p-4 text-xs text-muted-foreground"
        >
          <FileTextIcon class="size-4 text-destructive" />
          <span v-if="!files.pdfs.length">Arrastra o haz clic para subir uno o varios PDF</span>
          <span v-else>{{ files.pdfs.length }} PDF(s) seleccionado(s)</span>
          <input type="file" accept=".pdf" multiple class="hidden" @change="onPdfsSelect" />
        </label>
      </div>

      <Alert v-if="parseErrors.length" variant="destructive">
        <AlertDescription>
          <p v-for="e in parseErrors" :key="e">{{ e }}</p>
        </AlertDescription>
      </Alert>

      <div class="flex justify-end">
        <Button :disabled="!allFilesLoaded || loading" @click="procesar">
          <LoaderCircleIcon v-if="loading" class="size-4 animate-spin" />
          <ZapIcon v-else class="size-4" />
          Procesar
        </Button>
      </div>
    </div>

    <!-- Step 2: Revisar -->
    <div v-show="activeStep === 1" class="space-y-5">
      <div v-if="resultado">
        <!-- Hoja madre (misma vista reutilizada en el Histórico) -->
        <HojaMadreView :data="vistaActual" class="mb-2" />

        <div v-if="facturas?.documentos?.length" class="mt-2">
          <div class="mb-1 flex items-center justify-end gap-2">
            <label class="text-xs font-semibold text-muted-foreground"
              >Fecha objetivo (viernes):</label
            >
            <DatePicker v-model="fechaObjetivo" class="w-40" />
          </div>
          <FacturasDescuento
            v-model:total-descontado="totalDescontado"
            :documentos="facturas.documentos"
            :disponible="resultado.custodia?.disponible ?? 0"
            :fecha-objetivo="fechaObjetivo"
          />
        </div>

        <div class="mt-4 flex justify-between">
          <Button variant="ghost" @click="activeStep = 0">
            <ArrowLeftIcon class="size-4" />
            Volver
          </Button>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" @click="exportar">
              <FileSpreadsheetIcon class="size-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" size="sm" :disabled="guardando" @click="guardarRegistro">
              <SaveIcon class="size-4" />
              Guardar en histórico
            </Button>
            <Button @click="generarYAvanzar">
              Generar mensaje
              <ArrowRightIcon class="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 3: Mensaje -->
    <div v-show="activeStep === 2" class="space-y-4">
      <div class="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <GLabel>{{
              esNegativo ? 'Recursos que regresan ($)' : 'Total a consignar ($)'
            }}</GLabel>
            <NumberField
              v-model="montoEditable"
              :format-options="{ maximumFractionDigits: 0 }"
              @update:model-value="actualizarMensaje"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1">
            <GLabel>% variación PB</GLabel>
            <NumberField
              v-model="variacionPb"
              :format-options="{ maximumFractionDigits: 2 }"
              @update:model-value="actualizarMensaje"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </div>
        </div>

        <div class="space-y-1">
          <GLabel>Menciones</GLabel>
          <Input
            v-model="mencionesEditable"
            placeholder="@Juan @María"
            @input="actualizarMensaje"
          />
        </div>

        <div class="space-y-1">
          <GLabel>Nota de contexto (opcional)</GLabel>
          <Textarea
            v-model="contexto"
            rows="2"
            placeholder="Notas adicionales..."
            @input="actualizarMensaje"
          />
        </div>

        <div class="space-y-1">
          <GLabel>Frase de tendencia (editable)</GLabel>
          <Textarea v-model="tendencia" rows="2" @input="actualizarMensaje" />
        </div>

        <!-- Mensaje generado -->
        <div class="space-y-1">
          <GLabel>Borrador del mensaje</GLabel>
          <Textarea v-model="mensajeEditable" rows="8" class="font-mono text-xs" />
        </div>
      </div>

      <div class="flex justify-between">
        <Button variant="ghost" @click="activeStep = 1">
          <ArrowLeftIcon class="size-4" />
          Volver
        </Button>
        <div class="flex gap-2">
          <Button variant="outline" @click="copiar">
            <CopyIcon class="size-4" />
            Copiar
          </Button>
          <Button :disabled="guardando" @click="guardarRegistro">
            <CheckIcon class="size-4" />
            Confirmar y guardar
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
