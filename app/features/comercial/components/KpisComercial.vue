<!--
  El pulso del mes, derivado de las ofertas que ya están en memoria: no hay
  endpoint de KPIs y no hace falta. Respeta los filtros activos a propósito
  (ver useOfertas.banda): un total que ignora el filtro se lee como el total del
  negocio.
-->
<script setup lang="ts">
import type { Banda } from './comercial'
import { fmtMwh } from './comercial'

const props = defineProps<{
  banda: Banda
  alertaDias?: number | null
}>()
const emit = defineEmits<{ filtrar: [filtro: string] }>()

interface Tarjeta {
  label: string
  valor: string | number
  detalle?: string | null
  claseValor: string
  claseTarjeta?: string
  accionable?: boolean
  filtro?: string
}

const tarjetas = computed<Tarjeta[]>(() => {
  const b = props.banda
  return [
    {
      label: 'Ofertas activas',
      valor: b.activas,
      detalle: b.total > b.activas ? `${b.total - b.activas} cerradas` : null,
      claseValor: 'text-foreground',
    },
    {
      label: 'Energía en juego',
      valor: fmtMwh(b.energiaMwhMes).replace(' MWh/mes', ''),
      detalle: 'MWh/mes estimados de las ofertas abiertas',
      claseValor: 'text-primary',
    },
    {
      label: 'Requieren atención',
      valor: b.alertas,
      detalle: props.alertaDias ? `más de ${props.alertaDias} días sin movimiento` : null,
      claseValor: b.alertas ? 'text-destructive' : 'text-muted-foreground',
      claseTarjeta: b.alertas ? 'bg-destructive/5 border-destructive/20' : '',
      accionable: b.alertas > 0,
      filtro: 'alerta',
    },
    {
      label: 'Enviadas sin respuesta',
      valor: b.sinRespuesta,
      detalle: 'el cliente nunca contestó',
      claseValor: b.sinRespuesta ? 'text-warning' : 'text-muted-foreground',
      accionable: b.sinRespuesta > 0,
      filtro: 'sinRespuesta',
    },
  ]
})

function alClick(t: Tarjeta) {
  if (t.accionable && t.filtro) emit('filtrar', t.filtro)
}
</script>

<template>
  <div class="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:gap-3 lg:grid-cols-4">
    <div
      v-for="k in tarjetas"
      :key="k.label"
      class="rounded-lg border px-3 py-2.5 transition-colors sm:px-4 sm:py-3"
      :class="[k.accionable ? 'cursor-pointer hover:border-primary' : '', k.claseTarjeta]"
      @click="alClick(k)"
    >
      <div class="text-xl leading-none font-semibold sm:text-2xl" :class="k.claseValor">
        {{ k.valor }}
      </div>
      <div class="mt-1.5 text-xs text-muted-foreground">{{ k.label }}</div>
      <!-- El detalle se oculta cuando la tarjeta mide media pantalla: ahí un
           texto como "MWh/mes estimados de las ofertas abiertas" envuelve a
           cuatro líneas, descuadra la fila y empuja el contenido real fuera de
           la primera pantalla. La cifra y su etiqueta se sostienen solas. -->
      <div v-if="k.detalle" class="mt-0.5 hidden text-xs text-muted-foreground sm:block">
        {{ k.detalle }}
      </div>
    </div>
  </div>
</template>
