<template>
  <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
    <div class="flex min-w-0 items-center gap-2.5">
      <slot name="lead" />
      <div class="min-w-0">
        <h1
          class="text-base font-extrabold whitespace-normal text-foreground sm:overflow-hidden sm:text-lg sm:leading-tight sm:text-ellipsis sm:whitespace-nowrap"
        >
          {{ title }}
        </h1>
        <p v-if="subtitle || $slots.subtitle" class="mt-px text-xs text-muted-foreground">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; subtitle?: string }>(), { subtitle: '' })
</script>
