<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value?: string | number | boolean | null
    /** Resalta el valor (más peso y color) para el dato más importante de un grupo. */
    highlight?: boolean
  }>(),
  { value: null, highlight: false },
)
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs font-medium text-muted-foreground">{{ label }}</span>
    <span :class="highlight ? 'font-bold text-foreground' : 'text-sm text-foreground'">{{
      value ?? '—'
    }}</span>
  </div>
</template>
