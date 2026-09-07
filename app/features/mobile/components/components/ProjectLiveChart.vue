<template>
  <div class="plc-wrap" @click="flashNowLabel" @touchstart.passive="flashNowLabel">
    <Line v-if="hasData" ref="chartRef" :data="chartData" :options="chartOptions" :plugins="[nowLinePlugin]" />
    <div v-else class="plc-empty">
      <ChartLineIcon class="size-[1em]" />
      <span>Sin datos de potencia hoy</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Legend, Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { TIME_LABELS, inverterSeries, meterSeries } from '~/features/solar/serieSolar'
import { ChartLineIcon } from '@lucide/vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Legend, Filler)

const props = defineProps({
  detail: { type: Object, default: null },
})

const inv = computed(() => inverterSeries(props.detail))
const med = computed(() => meterSeries(props.detail))
const hasData = computed(() => !!(inv.value || med.value))

const chartData = computed(() => {
  const datasets = []
  if (inv.value) {
    datasets.push({
      label: 'Inversores',
      data: inv.value,
      borderColor: '#915BD8',
      backgroundColor: 'rgba(145,91,216,0.12)',
      fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
    })
  }
  if (med.value) {
    datasets.push({
      label: 'Medidor',
      data: med.value,
      borderColor: '#14B8A6',
      backgroundColor: 'rgba(20,184,166,0.10)',
      fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
    })
  }
  return { labels: TIME_LABELS, datasets }
})

// ── Línea amarilla "ahora" ──────────────────────────────────────────────────
// Marca la hora actual de Colombia (UTC-5) con una vertical amarilla.
// La etiqueta "ahora HH:MM" solo se muestra al tocar la gráfica y se oculta
// sola a los 3 segundos, para no tapar la curva.
function colombiaSlot() {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const col = new Date(utcMs - 5 * 3600000)
  const slot = col.getHours() * 12 + Math.floor(col.getMinutes() / 5)
  const label = `${String(col.getHours()).padStart(2, '0')}:${String(col.getMinutes()).padStart(2, '0')}`
  return { slot: Math.max(0, Math.min(287, slot)), label }
}

const chartRef = ref(null)
const nowFlag = { show: false } // objeto plano: el plugin lo lee en cada draw
let hideTimer = null

function flashNowLabel() {
  nowFlag.show = true
  chartRef.value?.chart?.update('none')
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    nowFlag.show = false
    chartRef.value?.chart?.update('none')
  }, 3000)
}

onBeforeUnmount(() => clearTimeout(hideTimer))

const nowLinePlugin = {
  id: 'nowLine',
  afterDatasetsDraw(chart) {
    const xScale = chart.scales.x
    if (!xScale) return
    const { slot, label } = colombiaSlot()
    const px = xScale.getPixelForValue(slot)
    if (px == null || isNaN(px)) return
    const { ctx, chartArea: { top, bottom } } = chart

    ctx.save()
    // línea vertical
    ctx.beginPath()
    ctx.moveTo(px, top)
    ctx.lineTo(px, bottom)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#EAB308' // amarillo, visible sobre el fondo blanco
    ctx.stroke()

    // etiqueta "ahora HH:MM" — solo tras un toque del usuario
    if (nowFlag.show) {
      const text = `ahora ${label}`
      ctx.font = '600 11px system-ui, sans-serif'
      const tw = ctx.measureText(text).width + 14
      let bx = px - tw / 2
      bx = Math.max(xScale.left, Math.min(bx, xScale.right - tw))
      const by = top + 2
      ctx.fillStyle = '#EAB308'
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, tw, 18, 6); ctx.fill() }
      else ctx.fillRect(bx, by, tw, 18)
      ctx.fillStyle = '#2C2039'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(text, bx + tw / 2, by + 9)
    }
    ctx.restore()
  },
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  // sin tooltip: tocar la gráfica solo muestra la etiqueta "ahora" 3 s
  events: [],
  layout: { padding: { top: 6 } },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'start',
      labels: {
        boxWidth: 7, boxHeight: 7, usePointStyle: true, pointStyle: 'circle',
        font: { size: 11.5, weight: '500' }, color: '#787774', padding: 12,
      },
    },
    tooltip: { enabled: false },
  },
  scales: {
    x: {
      ticks: { font: { size: 10 }, color: '#9b9a97', maxTicksLimit: 6, autoSkip: true, maxRotation: 0 },
      grid: { display: false },
      border: { display: false },
    },
    y: {
      beginAtZero: true,
      ticks: { font: { size: 10 }, color: '#9b9a97', maxTicksLimit: 5, padding: 6 },
      grid: { color: 'rgba(28,18,50,0.045)' },
      border: { display: false },
    },
  },
}
</script>

<style scoped>
.plc-wrap { position: relative; width: 100%; height: 100%; }
.plc-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; height: 100%; color: #9ca3af; font-size: 14px;
}
.plc-empty svg { font-size: 32px; color: #d1d5db; }
</style>
