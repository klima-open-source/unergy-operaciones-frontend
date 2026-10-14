<script setup>
/**
 * Redirección: los PPA de una planta se ven en la pestaña Servicios de su ficha
 * (`?tab=servicios&servicio=ppa`), con las condiciones de cada contrato.
 *
 * Se conserva la ruta porque hay enlaces vivos apuntando acá:
 * `AlertasContratosPPAView.vue` manda a `/proyectos/{id}/ppa` desde las alertas
 * de vencimiento, y están los links que la gente tenga guardados.
 */
const route = useRoute()
await navigateTo(
  { path: `/proyectos/${route.params.id}`, query: { tab: 'servicios', servicio: 'ppa' } },
  { replace: true },
)
</script>

<template>
  <div />
</template>
