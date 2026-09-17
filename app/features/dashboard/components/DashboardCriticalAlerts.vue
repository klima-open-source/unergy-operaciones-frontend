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
    <ItemGroup class="gap-0 p-2">
      <template v-for="(alert, index) in alerts" :key="alert.key">
        <ItemSeparator v-if="index > 0" class="my-0" />
        <Item as-child size="sm">
          <NuxtLink :to="alert.to">
            <ItemMedia variant="icon" :class="[TONE_CLASSES[alert.tone], 'size-8 rounded-lg']">
              <component :is="alert.icon" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{{ alert.title }}</ItemTitle>
              <ItemDescription>{{ alert.detail }}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon class="size-4 text-muted-foreground" />
            </ItemActions>
          </NuxtLink>
        </Item>
      </template>
    </ItemGroup>
  </div>
</template>
