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
  <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
    <div class="flex items-center justify-between gap-2">
      <div
        class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
      >
        <span class="size-2 shrink-0 rounded-full" :class="dotClass" />
        {{ title }}
        <span
          v-if="badge"
          class="rounded bg-background px-1 py-px text-[9px] font-bold text-muted-foreground"
        >
          {{ badge }}
        </span>
      </div>
    </div>

    <div class="flex items-baseline gap-2">
      <span
        class="font-mono text-xl font-bold tabular-nums"
        :class="valueMuted ? 'text-muted-foreground' : 'text-foreground'"
      >
        {{ value }}
      </span>
      <span v-if="hasta" class="text-[10px] text-muted-foreground">
        hasta {{ hasta }}
        <template v-if="haceCuanto">· {{ haceCuanto }}</template>
      </span>
    </div>

    <div v-if="chartData?.labels?.length" class="relative h-[180px]">
      <Line :data="chartData" :options="chartOptions" :plugins="[crosshairPlugin]" />
    </div>
    <div
      v-else
      class="flex h-[180px] items-center justify-center text-sm font-semibold text-muted-foreground/60"
    >
      {{ emptyLabel }}
    </div>
  </div>
</template>
