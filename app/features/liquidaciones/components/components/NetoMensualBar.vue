<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'vue-chartjs'
import { fmtCompact } from '~/features/liquidaciones/utils/liquidaciones'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export interface BarraNetoMensual {
  label: string
  neto: number
}

const props = withDefaults(defineProps<{ bars?: BarraNetoMensual[] }>(), {
  bars: () => [],
})

const data = computed<ChartData<'bar'>>(() => ({
  labels: props.bars.map((b) => b.label),
  datasets: [
    {
      data: props.bars.map((b) => b.neto),
      backgroundColor: props.bars.map((b) => (b.neto >= 0 ? '#915BD8' : '#ef4444')),
      borderRadius: 4,
      maxBarThickness: 28,
    },
  ],
}))

const options: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c) => fmtCompact(c.parsed.y) } },
  },
  scales: {
    x: { ticks: { font: { size: 10 }, color: '#9ca3af' }, grid: { display: false } },
    y: {
      ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v) => fmtCompact(Number(v)) },
      grid: { color: 'rgba(0,0,0,0.05)' },
    },
  },
}
</script>

<template>
  <div style="height: 200px">
    <Bar :data="data" :options="options" />
  </div>
</template>
