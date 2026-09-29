<script setup lang="ts">
import { APP_BRANDING, AUTH_HERO_GRADIENT_COLORS, AUTH_ICON, AUTH_LOGO } from '~/config/app'

const colorMode = useColorMode()
const iconSrc = computed(() => (colorMode.value === 'dark' ? AUTH_ICON.dark : AUTH_ICON.light))
</script>

<template>
  <div class="grid min-h-svh lg:grid-cols-2">
    <div class="flex flex-col gap-4 p-6 md:p-10">
      <div class="flex justify-center gap-2 md:justify-start">
        <NuxtLink to="/" class="flex items-center gap-3 font-medium">
          <img :src="iconSrc" alt="Unergy" class="h-8 w-auto" />
          <span class="text-sm text-muted-foreground">Operaciones</span>
        </NuxtLink>
      </div>

      <div id="main-content" class="flex flex-1 items-center justify-center">
        <div class="w-full max-w-xs">
          <slot />
        </div>
      </div>
    </div>

    <div class="relative hidden items-center justify-center lg:flex" aria-hidden="true">
      <GrainientBackground
        class="absolute inset-0"
        :color1="AUTH_HERO_GRADIENT_COLORS.from"
        :color2="AUTH_HERO_GRADIENT_COLORS.via"
        :color3="AUTH_HERO_GRADIENT_COLORS.to"
      />
      <div class="relative flex flex-col items-center gap-3">
        <img :src="AUTH_LOGO" alt="" class="h-14 w-auto" />
        <span class="text-lg font-medium text-white">{{ APP_BRANDING.name }}</span>
      </div>
    </div>
  </div>
</template>
