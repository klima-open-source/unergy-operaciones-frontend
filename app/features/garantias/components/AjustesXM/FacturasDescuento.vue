<script setup lang="ts">
import DatePicker from '~/components/blocks/DatePicker.vue'
import type { DocumentoFactura } from './composables/useFacturasPDF'

interface FilaFactura extends DocumentoFactura {
  marcado: boolean
}

const props = withDefaults(
  defineProps<{
    documentos?: DocumentoFactura[]
    disponible?: number
    fechaObjetivo?: string
  }>(),
  {
    documentos: () => [],
    disponible: 0,
    fechaObjetivo: '',
  },
)
const emit = defineEmits<{
  'update:disponibleAjustado': [valor: number]
  'update:totalDescontado': [valor: number]
}>()

const WARN_MSG: Record<string, string> = {
  multiple_valor: 'Más de un "Valor Total" en la página — revisar',
  sin_valor: 'No se halló "Valor Total" — ingresar manual',
  sin_vencimiento: 'Sin fecha de vencimiento — ingresar manual',
  escaneada: 'Página escaneada (sin texto) — ingresar manual',
}

const filas = ref<FilaFactura[]>([])

function initFilas() {
  filas.value = props.documentos.map((d) => ({
    ...d,
    // Por defecto se marcan solo los DÉBITO (facturas) cuyo vencimiento sea exactamente la fecha objetivo.
    marcado: !!(
      d.descuenta &&
      d.vencimiento &&
      props.fechaObjetivo &&
      d.vencimiento === props.fechaObjetivo
    ),
  }))
}
watch(() => props.documentos, initFilas, { immediate: true })
watch(() => props.fechaObjetivo, initFilas)

// Total NETO: débitos/cargos suman (+), notas crédito y ajustes a favor restan (−).
const totalDescontado = computed(() =>
  filas.value
    .filter((f) => f.marcado)
    .reduce((s, f) => s + (Number(f.valorTotal) || 0) * (f.signo ?? 1), 0),
)
const disponibleAjustado = computed(() => (Number(props.disponible) || 0) - totalDescontado.value)

watch(
  [totalDescontado, disponibleAjustado],
  () => {
    emit('update:totalDescontado', totalDescontado.value)
    emit('update:disponibleAjustado', disponibleAjustado.value)
  },
  { immediate: true },
)

function warnText(f: FilaFactura): string {
  return (f.warnings || []).map((w) => WARN_MSG[w] || w).join(' · ')
}
</script>

<template>
  <div class="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
    <div class="flex items-center justify-between bg-primary/5 px-4 py-2">
      <span class="text-xs font-bold tracking-widest text-primary uppercase"
        >Descuento de facturas</span
      >
      <span class="text-xs text-muted-foreground">{{ filas.length }} documento(s)</span>
    </div>

    <div class="overflow-x-auto">
      <GTable>
        <GTableHeader>
          <GTableRow>
            <GTableHead class="text-center">✓</GTableHead>
            <GTableHead>Número</GTableHead>
            <GTableHead>Tipo</GTableHead>
            <GTableHead>Concepto</GTableHead>
            <GTableHead class="text-right">Valor Total</GTableHead>
            <GTableHead>Vencimiento</GTableHead>
            <GTableHead class="text-center">Pág.</GTableHead>
            <GTableHead />
          </GTableRow>
        </GTableHeader>
        <GTableBody>
          <GTableRow v-for="(f, idx) in filas" :key="idx">
            <GTableCell class="text-center">
              <Checkbox v-model="f.marcado" />
            </GTableCell>
            <GTableCell class="max-w-28 truncate text-foreground" :title="f.numero ?? ''">
              {{ f.numero ?? '—' }}
            </GTableCell>
            <GTableCell>
              <GBadge :color="f.descuenta ? 'destructive' : 'information'">{{ f.tipo }}</GBadge>
            </GTableCell>
            <GTableCell class="text-muted-foreground" :title="f.concepto">{{
              f.concepto
            }}</GTableCell>
            <GTableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <span
                  v-if="f.signo !== 0"
                  class="shrink-0 text-xs font-bold"
                  :class="f.signo < 0 ? 'text-success' : 'text-destructive'"
                  >{{ f.signo < 0 ? '−' : '+' }}</span
                >
                <NumberField
                  v-model="f.valorTotal"
                  :format-options="{ maximumFractionDigits: 2 }"
                  class="w-32"
                >
                  <NumberFieldContent
                    ><NumberFieldInput class="text-right text-xs"
                  /></NumberFieldContent>
                </NumberField>
              </div>
            </GTableCell>
            <GTableCell>
              <DatePicker v-model="f.vencimiento" class="w-full" />
            </GTableCell>
            <GTableCell class="text-center text-muted-foreground">{{ f.pagina }}</GTableCell>
            <GTableCell>
              <GBadge v-if="f.warnings?.length" color="warning" :title="warnText(f)"
                >⚠ revisar</GBadge
              >
            </GTableCell>
          </GTableRow>
        </GTableBody>
      </GTable>
    </div>

    <!-- Pie -->
    <div class="grid grid-cols-3 gap-3 border-t bg-primary/5 px-4 py-3">
      <div class="text-center">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Disponible original
        </p>
        <p class="text-sm font-bold text-foreground">{{ formatCOP(disponible) }}</p>
      </div>
      <div class="text-center">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Total a descontar (neto)
        </p>
        <p class="text-sm font-bold text-destructive">{{ formatCOP(totalDescontado) }}</p>
        <p class="text-xs text-muted-foreground">débitos suman · crédito/favor restan</p>
      </div>
      <div class="text-center">
        <p class="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Disponible ajustado
        </p>
        <p
          class="text-sm font-bold"
          :class="disponibleAjustado < 0 ? 'text-destructive' : 'text-success'"
        >
          {{ formatCOP(disponibleAjustado) }}
        </p>
      </div>
    </div>
  </div>
</template>
