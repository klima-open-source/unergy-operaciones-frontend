<script setup>
/**
 * Los clientes, con sus plantas y servicios.
 *
 * Es uno de los tres ángulos de `ServiciosUnificadoView`, fijo y con su propia
 * entrada en el menú: Proyectos, Clientes y Contratos ya no comparten página.
 */
import View from '~/features/contratos/components/ServiciosUnificadoView.vue'

definePageMeta({ layout: 'legacy' })
</script>

<template>
  <View vista-fija="clientes" />
</template>
