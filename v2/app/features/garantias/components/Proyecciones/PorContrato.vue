<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <div>
        <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Garantía por contrato</span>
        <p class="text-[11px] leading-snug mt-0.5" style="color:#8a7aa5">
          Reparte la garantía del mes siguiente entre los contratos que la generan: los PLC que no
          cubren su mínimo y los que tienen duplicado. Los demás (PLG sin duplicado) no aportan.
        </p>
      </div>
      <Button label="Calcular reparto" size="small" :loading="cargando" @click="calcular">
        <template #icon><CalculatorIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <div v-if="data" class="overflow-x-auto rounded-lg border" style="border-color:rgba(44,32,57,0.10)">
      <table class="w-full text-xs">
        <thead>
          <tr style="background:rgba(145,91,216,0.06);color:#6b5a8a">
            <th class="text-left px-3 py-2">Contrato</th>
            <th class="text-left px-3 py-2">Cliente</th>
            <th class="text-left px-3 py-2">Tipo</th>
            <th class="text-right px-3 py-2">Déficit (MWh)</th>
            <th class="text-right px-3 py-2">%</th>
            <th class="text-right px-3 py-2">Garantía</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in data.contratos" :key="c.codigo" class="border-t" style="border-color:rgba(44,32,57,0.06)">
            <td class="px-3 py-2">{{ c.contrato || c.codigo }}</td>
            <td class="px-3 py-2">{{ c.comprador || '—' }}</td>
            <td class="px-3 py-2">
              <span class="text-[10px] px-2 py-0.5 rounded-full"
                :style="c.es_plc ? 'background:#EDE9FE;color:#5B21B6' : 'background:#FEF3C7;color:#92400E'">
                {{ c.es_plc ? 'PLC' : 'Duplicado' }}
              </span>
            </td>
            <td class="px-3 py-2 text-right">{{ c.deficit_mwh.toFixed(1) }}</td>
            <td class="px-3 py-2 text-right">{{ (c.pct * 100).toFixed(1) }}%</td>
            <td class="px-3 py-2 text-right font-semibold">{{ fmtCOP(c.monto) }}</td>
          </tr>
          <tr v-if="!data.contratos.length">
            <td class="px-3 py-4 text-center" style="color:#8a7aa5" colspan="6">
              Ningún contrato genera garantía este corte.
            </td>
          </tr>
        </tbody>
        <tfoot v-if="data.contratos.length">
          <tr class="border-t font-semibold" style="border-color:rgba(44,32,57,0.10);color:var(--color-unergy-deep)">
            <td class="px-3 py-2" colspan="5">Total · {{ MESES[data.mes] || data.mes }} {{ data.anio }}</td>
            <td class="px-3 py-2 text-right">{{ fmtCOP(data.total_garantia) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div v-else-if="!cargando" class="text-xs" style="color:#8a7aa5">
      Aún no se ha calculado el reparto. Usa “Calcular reparto”.
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import { CalculatorIcon } from '@lucide/vue'
import { fmtCOP } from '../AjustesXM/utils/formatters.js'
import { ProyeccionesGarantiasService } from '~/features/garantias/services/proyecciones'

const props = defineProps({
  /** Fecha de corte a replicar (YYYY-MM-DD); vacío = hoy. */
  corte: { type: String, default: '' },
})

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const proyeccionesApi = new ProyeccionesGarantiasService()
const data = ref(null)
const cargando = ref(false)

async function calcular() {
  cargando.value = true
  try {
    data.value = await proyeccionesApi.calcularAtribucion(props.corte || undefined)
  } catch (e) {
    toast.error('No se pudo calcular el reparto por contrato', {
      description: e.response?.data?.detail || e.message,
      duration: 6000,
    })
  } finally {
    cargando.value = false
  }
}
</script>
