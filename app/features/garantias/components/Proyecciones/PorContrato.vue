<script setup lang="ts">
import { CalculatorIcon, LoaderCircleIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import type { AtribucionGarantia } from '~/features/garantias/types'
import { ProyeccionesGarantiasService } from '~/features/garantias/services/proyecciones'

const props = withDefaults(
  defineProps<{
    /** Fecha de corte a replicar (YYYY-MM-DD); vacío = hoy. */
    corte?: string
  }>(),
  { corte: '' },
)

const MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const proyeccionesApi = new ProyeccionesGarantiasService()
const data = ref<AtribucionGarantia | null>(null)
const cargando = ref(false)

async function calcular() {
  cargando.value = true
  try {
    data.value = await proyeccionesApi.calcularAtribucion(props.corte || undefined)
  } catch (e) {
    toast.error('No se pudo calcular el reparto por contrato', {
      description: normalizeError(e).message,
      duration: 6000,
    })
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <div>
        <span class="text-sm font-semibold text-foreground">Garantía por contrato</span>
        <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
          Reparte la garantía del mes siguiente entre los contratos que la generan: los PLC que no
          cubren su mínimo y los que tienen duplicado. Los demás (PLG sin duplicado) no aportan.
        </p>
      </div>
      <Button variant="outline" size="sm" :disabled="cargando" @click="calcular">
        <LoaderCircleIcon v-if="cargando" class="size-4 animate-spin" />
        <CalculatorIcon v-else class="size-4" />
        Calcular reparto
      </Button>
    </div>

    <div v-if="data" class="overflow-x-auto rounded-lg border">
      <GTable>
        <GTableHeader>
          <GTableRow>
            <GTableHead>Contrato</GTableHead>
            <GTableHead>Cliente</GTableHead>
            <GTableHead>Tipo</GTableHead>
            <GTableHead class="text-right">Déficit (MWh)</GTableHead>
            <GTableHead class="text-right">%</GTableHead>
            <GTableHead class="text-right">Garantía</GTableHead>
          </GTableRow>
        </GTableHeader>
        <GTableBody>
          <GTableRow v-for="c in data.contratos" :key="c.codigo">
            <GTableCell>{{ c.contrato || c.codigo }}</GTableCell>
            <GTableCell>{{ c.comprador || '—' }}</GTableCell>
            <GTableCell>
              <GBadge :color="c.es_plc ? 'action' : 'warning'">{{
                c.es_plc ? 'PLC' : 'Duplicado'
              }}</GBadge>
            </GTableCell>
            <GTableCell class="text-right">{{ c.deficit_mwh.toFixed(1) }}</GTableCell>
            <GTableCell class="text-right">{{ (c.pct * 100).toFixed(1) }}%</GTableCell>
            <GTableCell class="text-right font-semibold">{{ formatCOP(c.monto) }}</GTableCell>
          </GTableRow>
          <TableEmpty v-if="!data.contratos.length" :colspan="6">
            Ningún contrato genera garantía este corte.
          </TableEmpty>
        </GTableBody>
        <GTableFooter v-if="data.contratos.length">
          <GTableRow>
            <GTableCell colspan="5" class="font-semibold text-foreground">
              Total · {{ MESES[data.mes] || data.mes }} {{ data.anio }}
            </GTableCell>
            <GTableCell class="text-right font-semibold text-foreground">{{
              formatCOP(data.total_garantia)
            }}</GTableCell>
          </GTableRow>
        </GTableFooter>
      </GTable>
    </div>
    <div v-else-if="!cargando" class="text-xs text-muted-foreground">
      Aún no se ha calculado el reparto. Usa "Calcular reparto".
    </div>
  </div>
</template>
