<script setup>
/**
 * Redirección: los próximos a energizar son ahora un filtro de Proyectos
 * (`/proyectos?ver=proximos`). Se conserva la ruta por los enlaces guardados.
 */
await navigateTo({ path: '/proyectos', query: { ver: 'proximos' } }, { replace: true })
</script>

<template>
  <div />
</template>
