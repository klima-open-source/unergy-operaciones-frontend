<script setup lang="ts">
import { ClockIcon, LoaderCircleIcon, RefreshCwIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { AgenteGarantia, EsquemaModelo } from '~/features/garantias/types'
import { useModeloPredictivo } from './composables/useModeloPredictivo'
import FrescuraBanner from './FrescuraBanner.vue'
import TotalesHeader from './TotalesHeader.vue'
import SemanalesTabla from './SemanalesTabla.vue'
import MensualCard from './MensualCard.vue'
import DetalleDialog from './DetalleDialog.vue'

const {
  agente,
  esquema,
  cuantil,
  horizonte,
  data,
  cargando,
  error,
  semanales,
  mensuales,
  detalle,
  detalleCargando,
  detalleAbierto,
  detalleError,
  cargar,
  abrirDetalle,
  cerrarDetalle,
} = useModeloPredictivo()

// El plan es la carga que sostiene toda la vista: si falla, el toast avisa Y
// queda el mensaje en pantalla (ver bloque `v-if="error"` abajo) porque la
// página se queda vacía. El detalle vive en un diálogo sobre una tabla que
// sigue intacta, así que ese error solo se avisa por toast.
watch(error, (msg) => {
  if (msg)
    toast.error('No se pudo cargar el plan de garantías', { description: msg, duration: 6000 })
})
watch(detalleError, (msg) => {
  if (msg) toast.error('No se pudo cargar el detalle', { description: msg, duration: 5000 })
})

const opcionesEsquema = [
  { label: 'Semanal', value: EsquemaModelo.SEMANAL },
  { label: 'Mensual', value: EsquemaModelo.MENSUAL },
]

const cuantilPct = computed({
  get: () => Math.round(cuantil.value * 100),
  set: (v: number) => {
    cuantil.value = v / 100
  },
})

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}

onMounted(cargar)
</script>

<template>
  <div class="space-y-4">
    <FrescuraBanner :frescura="data?.frescura ?? null" />

    <div class="flex flex-wrap items-end gap-4 rounded-xl bg-primary/5 p-4">
      <div class="flex flex-col gap-1">
        <GLabel>Agente</GLabel>
        <ToggleGroup v-model="agente" type="single" variant="outline" @update:model-value="cargar">
          <ToggleGroupItem :value="AgenteGarantia.UNGG">UNGG</ToggleGroupItem>
          <ToggleGroupItem :value="AgenteGarantia.UNGC">UNGC</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="flex flex-col gap-1">
        <GLabel>Esquema</GLabel>
        <ToggleGroup v-model="esquema" type="single" variant="outline" @update:model-value="cargar">
          <ToggleGroupItem v-for="op in opcionesEsquema" :key="op.value" :value="op.value">
            {{ op.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="flex flex-col gap-1">
        <GLabel>Percentil (%)</GLabel>
        <NumberField
          v-model="cuantilPct"
          :min="50"
          :max="99"
          class="w-28"
          @update:model-value="cargar"
        >
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div v-if="esquema === EsquemaModelo.SEMANAL" class="flex flex-col gap-1">
        <GLabel>Semanas</GLabel>
        <NumberField
          v-model="horizonte"
          :min="1"
          :max="12"
          class="w-32"
          @update:model-value="cargar"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>
      <Button variant="outline" :disabled="cargando" @click="cargar">
        <LoaderCircleIcon v-if="cargando" class="size-4 animate-spin" />
        <RefreshCwIcon v-else class="size-4" />
        Recalcular
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">
      <ClockIcon class="size-4" />
      <AlertTitle>Todavía no hay datos que mostrar</AlertTitle>
      <AlertDescription>
        <p>
          El motor de cálculo del Modelo Predictivo aún no está publicado. Esta pestaña queda
          operativa en cuanto lo esté; hasta entonces no hay estimaciones que consultar y
          <b>Recalcular</b> va a seguir fallando.
        </p>
        <p class="text-xs">{{ error }}</p>
      </AlertDescription>
    </Alert>

    <div v-if="cargando" class="text-sm text-muted-foreground">Calculando…</div>

    <template v-else-if="data">
      <TotalesHeader :totales="data.totales" />

      <SemanalesTabla
        v-if="esquema === EsquemaModelo.SEMANAL"
        :filas="semanales"
        @detalle="abrirDetalle"
      />

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MensualCard v-for="m in mensuales" :key="m.id" :item="m" @detalle="abrirDetalle" />
        <p v-if="!mensuales.length" class="text-sm text-muted-foreground">
          No hay garantías mensuales en el horizonte.
        </p>
      </div>

      <p v-if="data.backtest" class="border-t pt-3 text-xs text-muted-foreground">
        Cobertura histórica:
        <b>{{ pct(data.backtest.cobertura_semanal) }}</b> semanal ·
        <b>{{ pct(data.backtest.cobertura_mensual) }}</b> mensual — ancho mediano
        <b>{{ formatCOP(data.backtest.ancho_mediano) }}</b> vs. baseline
        <b>{{ formatCOP(data.backtest.ancho_baseline) }}</b> sobre
        {{ data.backtest.n_vencimientos }} vencimientos.
      </p>
    </template>

    <DetalleDialog
      :abierto="detalleAbierto"
      :detalle="detalle"
      :cargando="detalleCargando"
      @cerrar="cerrarDetalle"
    />
  </div>
</template>
