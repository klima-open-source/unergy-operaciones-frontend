<script setup lang="ts">
import type { ChartData, ChartOptions, Plugin } from 'chart.js'
import { Line } from 'vue-chartjs'

defineProps<{
  title: string
  dotClass: string
  badge?: string | null
  value: string
  valueMuted: boolean
  hasta?: string | null
  haceCuanto?: string
  chartData: ChartData<'line'> | null
  chartOptions: ChartOptions<'line'>
  emptyLabel: string
}>()

/** Línea vertical bajo el cursor: sin ella, comparar el mismo instante entre las dos gráficas de la tarjeta es a ojo. */
const crosshairPlugin: Plugin<'line'> = {
  id: 'crosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? []
    if (!active.length) return
    const x = active[0]!.element.x
    const { ctx, chartArea } = chart
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(28,18,50,0.18)'
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.restore()
  },
}
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-col gap-2">
      <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span class="size-2 shrink-0 rounded-full" :class="dotClass" />
        {{ title }}
        <Badge v-if="badge" variant="outline">{{ badge }}</Badge>
      </div>

      <div class="flex items-baseline gap-2">
        <span
          class="text-xl font-bold"
          :class="valueMuted ? 'text-muted-foreground' : 'text-foreground'"
        >
          {{ value }}
        </span>
        <span v-if="hasta" class="text-xs text-muted-foreground">
          hasta {{ hasta }}
          <template v-if="haceCuanto">· {{ haceCuanto }}</template>
        </span>
      </div>

      <div v-if="chartData?.labels?.length" class="relative h-45">
        <Line :data="chartData" :options="chartOptions" :plugins="[crosshairPlugin]" />
      </div>
      <div v-else class="flex h-45 items-center justify-center text-sm text-muted-foreground">
        {{ emptyLabel }}
      </div>
    </CardContent>
  </Card>
</template>
