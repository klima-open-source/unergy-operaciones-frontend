<script setup lang="ts">
/**
 * `layout: 'legacy'` es intencional, no un resabio: es el único layout que
 * pinta esta ruta a pantalla completa, sin el padding del contenido normal
 * (ver `app/layouts/legacy.vue`). `SolarLiveView` maneja su propio scroll y
 * su propia pestaña histórica de ancho completo.
 */
import SolarLiveView from '~/features/solar/components/SolarLiveView.vue'

definePageMeta({ layout: 'legacy' })
</script>

<template>
  <SolarLiveView />
</template>
