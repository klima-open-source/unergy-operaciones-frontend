<script setup>
/**
 * `/fallas/lista` nunca fue una vista propia: el router legacy ya la
 * redirigía a `/fallas` (la entrada real es `MonitoreoView`, ver
 * `contexto/inventario-rutas.md`). Se conserva la ruta por si algún enlace
 * viejo sigue apuntando ahí.
 */
definePageMeta({ redirect: '/fallas' })
</script>

<template>
  <div />
</template>
