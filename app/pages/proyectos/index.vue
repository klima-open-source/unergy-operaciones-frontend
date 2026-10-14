<script setup>
/**
 * Las plantas: todas, o las próximas a energizar (`?ver=proximos`).
 *
 * Es uno de los tres ángulos de `ServiciosUnificadoView`, fijo y con su propia
 * entrada en el menú: Proyectos, Clientes y Contratos ya no comparten página.
 */
import View from '~/features/contratos/components/ServiciosUnificadoView.vue'

definePageMeta({ layout: 'legacy' })
</script>

<template>
  <View vista-fija="proyectos" />
</template>
