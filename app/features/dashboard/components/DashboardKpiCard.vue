<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number | null
    icon: Component
    tone?: 'primary' | 'muted' | 'destructive' | 'warning' | 'success'
    sub?: string | null
    subTone?: 'muted' | 'destructive'
  }>(),
  { tone: 'primary', sub: null, subTone: 'muted' },
)

const TONE_CLASSES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
}
</script>

<template>
  <Card size="sm">
    <CardContent class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ label }}</p>
        <p class="mt-1 text-2xl font-bold text-foreground">{{ value ?? '—' }}</p>
        <p
          v-if="sub"
          class="mt-0.5 text-xs"
          :class="subTone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'"
        >
          {{ sub }}
        </p>
      </div>
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-xl"
        :class="TONE_CLASSES[tone]"
      >
        <component :is="icon" class="size-5" />
      </div>
    </CardContent>
  </Card>
</template>
