<script setup>
/**
 * Redirección: la vista unificada se separó en /proyectos, /clientes y
 * /contratos, cada una con su entrada en el menú. Se conserva la ruta por los
 * enlaces guardados; la búsqueda y los filtros de la URL viajan con ella.
 */
const route = useRoute()
const { vista, ...resto } = route.query
const destino = { clientes: '/clientes', servicios: '/contratos' }[vista] ?? '/proyectos'
await navigateTo({ path: destino, query: resto }, { replace: true })
</script>

<template>
  <div />
</template>
