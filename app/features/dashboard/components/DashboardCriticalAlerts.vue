<script setup lang="ts">
import type { Component } from 'vue'
import { ChevronRightIcon, TriangleAlertIcon } from '@lucide/vue'

export interface DashboardAlert {
  key: string
  title: string
  detail: string
  icon: Component
  tone: 'destructive' | 'warning'
  to: string
}

defineProps<{ alerts: DashboardAlert[] }>()

const TONE_CLASSES: Record<DashboardAlert['tone'], string> = {
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
}
</script>

<template>
  <div v-if="alerts.length" class="overflow-hidden rounded-xl border border-border bg-card">
    <div class="flex items-center gap-2 border-b border-border px-4 py-3">
      <TriangleAlertIcon class="size-4 text-destructive" />
      <h2 class="text-sm font-semibold text-foreground">Alertas operacionales</h2>
      <Badge variant="destructive" class="ml-auto">{{ alerts.length }}</Badge>
    </div>
    <ul class="divide-y divide-border">
      <li v-for="alert in alerts" :key="alert.key">
        <NuxtLink
          :to="alert.to"
          class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg"
            :class="TONE_CLASSES[alert.tone]"
          >
            <component :is="alert.icon" class="size-4" />
          </span>
          <span class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground">{{ alert.title }}</p>
            <p class="truncate text-xs text-muted-foreground">{{ alert.detail }}</p>
          </span>
          <ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
