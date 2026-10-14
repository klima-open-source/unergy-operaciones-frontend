<script setup>
/**
 * Los contratos: PPA, representación y CGM, y operación (`?srv=`).
 *
 * Es uno de los tres ángulos de `ServiciosUnificadoView`, fijo y con su propia
 * entrada en el menú: Proyectos, Clientes y Contratos ya no comparten página.
 */
import View from '~/features/contratos/components/ServiciosUnificadoView.vue'

definePageMeta({ layout: 'legacy' })
</script>

<template>
  <View vista-fija="servicios" />
</template>
