<script setup lang="ts">
import {
  CheckIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ZapIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { FilaTabla, ResultadoTxr } from '../composables/useGarantiasParser'
import { parseTxr } from '../composables/useGarantiasParser'
import { useGarantiasHistorial } from '../composables/useGarantiasHistorial'
import { fmtISODate } from '../utils/formatters'
import { exportTablaExcel } from '../utils/excelExport'

const store = useGarantiasHistorial()

const esCodigo = (col: string): boolean => /^c[oó]digo$/i.test(col)
const esUNGC = (row: FilaTabla): boolean => {
  const k = Object.keys(row).find((h) => /^c[oó]digo$/i.test(h))
  return !!k && String(row[k]).trim().toUpperCase() === 'UNGC'
}
const fmtCell = (v: FilaTabla[string]): string =>
  v == null || v === '' ? '—' : typeof v === 'number' ? formatCOP(v) : String(v)

const pendingFile = ref<File | null>(null)
const dragging = ref(false)
const loading = ref(false)
const errors = ref<string[]>([])
const resultado = ref<ResultadoTxr | null>(null)

const montoEditable = ref(0)
const contexto = ref('')
const mensajeEditable = ref('')

const fechaVencimiento = computed(() => {
  if (resultado.value?.fechaVencimiento) return resultado.value.fechaVencimiento
  // Respaldo: próximo jueves (día 4)
  const d = new Date()
  const diff = (4 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return fmtISODate(d)
})

function onSelect(e: Event) {
  const input = e.target as HTMLInputElement
  pendingFile.value = input.files?.[0] || null
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  pendingFile.value = e.dataTransfer?.files[0] || null
}

async function procesar() {
  if (!pendingFile.value) return
  loading.value = true
  errors.value = []
  try {
    const res = await parseTxr(pendingFile.value)
    if (res.errors.length) errors.value = res.errors
    if (res.rows.length || !res.errors.length) {
      resultado.value = res
      montoEditable.value = res.totalAjuste
      generarMensaje()
    }
  } catch (e) {
    errors.value = [`Error inesperado: ${normalizeError(e).message}`]
  } finally {
    loading.value = false
  }
}

function reset() {
  resultado.value = null
  pendingFile.value = null
  errors.value = []
}

function generarMensaje() {
  mensajeEditable.value = `Ajuste TXR — vencimiento ${fechaVencimiento.value}

El monto a consignar es de ${formatCOP(montoEditable.value)}.${contexto.value ? '\n\n' + contexto.value : ''}`
}

async function copiar() {
  await navigator.clipboard.writeText(mensajeEditable.value)
  toast.success('Copiado', { duration: 2000 })
}

function exportar() {
  if (!resultado.value) return
  exportTablaExcel(resultado.value.rows, 'txr.xlsx')
}

async function guardarRegistro() {
  try {
    await store.guardar({
      tipo: 'txr',
      fecha: fmtISODate(new Date()),
      pb: null,
      restricciones: null,
      stn: null,
      trm: null,
      ptb: null,
      totalUNGC: null,
      totalUNGG: null,
      totalConsignar: null,
      disponibleCustodia: null,
      congelado: null,
      saldo: null,
      totalAjusteTXR: montoEditable.value,
      snapshot: null,
    })
    toast.success('Guardado en historial', { duration: 3000 })
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message, duration: 4000 })
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Upload area -->
    <div v-if="!resultado" class="space-y-4">
      <label
        class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
        :class="dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 bg-muted/40'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".xlsx,.xls" class="hidden" @change="onSelect" />
        <FileSpreadsheetIcon class="size-8 text-muted-foreground/60" />
        <p class="text-sm font-medium text-muted-foreground">Archivo TXR — hoja "Ajuste"</p>
        <p class="text-xs text-muted-foreground/70">Arrastra o haz clic para seleccionar</p>
        <p v-if="pendingFile" class="text-xs font-medium text-foreground">{{ pendingFile.name }}</p>
      </label>

      <Alert v-if="errors.length" variant="destructive">
        <AlertDescription>
          <p v-for="e in errors" :key="e">{{ e }}</p>
        </AlertDescription>
      </Alert>

      <div class="flex justify-end">
        <Button :disabled="!pendingFile || loading" @click="procesar">
          <LoaderCircleIcon v-if="loading" class="size-4 animate-spin" />
          <ZapIcon v-else class="size-4" />
          Procesar
        </Button>
      </div>
    </div>

    <!-- Results -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-foreground">
          Ajuste TXR — {{ resultado.rows.length }} filas (UNGC + UNGG)
        </h3>
        <Button variant="ghost" size="sm" @click="reset">
          <RefreshCwIcon class="size-4" />
          Nuevo archivo
        </Button>
      </div>

      <!-- Tabla scrollable (columnas dinámicas según el archivo) -->
      <div class="overflow-x-auto rounded-xl border shadow-sm">
        <GTable>
          <GTableHeader>
            <GTableRow>
              <GTableHead v-for="col in resultado.headers" :key="col" class="whitespace-nowrap">{{
                col
              }}</GTableHead>
            </GTableRow>
          </GTableHeader>
          <GTableBody>
            <GTableRow
              v-for="(row, idx) in resultado.rows"
              :key="idx"
              :class="esUNGC(row) ? 'bg-primary/5' : ''"
            >
              <GTableCell
                v-for="col in resultado.headers"
                :key="col"
                class="whitespace-nowrap tabular-nums"
              >
                <GBadge v-if="esCodigo(col)" :color="esUNGC(row) ? 'action' : 'information'">{{
                  row[col]
                }}</GBadge>
                <span v-else class="text-foreground">{{ fmtCell(row[col]) }}</span>
              </GTableCell>
            </GTableRow>
          </GTableBody>
        </GTable>
      </div>

      <!-- Mensaje -->
      <div class="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <GLabel>Monto a consignar ($)</GLabel>
            <NumberField
              v-model="montoEditable"
              :format-options="{ maximumFractionDigits: 0 }"
              @update:model-value="generarMensaje"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1">
            <GLabel>Fecha vencimiento</GLabel>
            <Input :model-value="fechaVencimiento" readonly class="bg-muted" />
          </div>
        </div>

        <div class="space-y-1">
          <GLabel>Contexto adicional</GLabel>
          <Textarea
            v-model="contexto"
            rows="2"
            placeholder="Notas opcionales..."
            @input="generarMensaje"
          />
        </div>

        <div class="space-y-1">
          <GLabel>Mensaje</GLabel>
          <Textarea v-model="mensajeEditable" rows="5" class="font-mono text-xs" />
        </div>

        <div class="flex justify-end gap-2">
          <Button variant="outline" size="sm" @click="exportar">
            <FileSpreadsheetIcon class="size-4" />
            Exportar Excel
          </Button>
          <Button variant="outline" @click="copiar">
            <CopyIcon class="size-4" />
            Copiar
          </Button>
          <Button @click="guardarRegistro">
            <CheckIcon class="size-4" />
            Confirmar y guardar
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
