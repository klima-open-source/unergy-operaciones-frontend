<script setup>
/**
 * Redirección: los PPA de una planta se ven en la vista unificada de Servicios.
 *
 * Esta ruta servía `PPAView.vue`, una página puente de la fase 1 de la
 * migración — la que decía "desaparece cuando su página real se escriba". Su
 * reemplazo es la pestaña PPA de `/servicios-unificado`, que muestra los tres
 * grupos de servicio con sus filtros y su exportación.
 *
 * Se conserva la ruta en vez de borrarla porque hay enlaces vivos apuntando
 * acá: `AlertasContratosPPAView.vue` manda a `/proyectos/{id}/ppa` desde las
 * alertas de vencimiento, y están los links que la gente tenga guardados.
 *
 * El nombre de la planta va en `?q=`: el buscador de la pestaña PPA mira, entre
 * otros campos, el `nombre_comercial` de las plantas de cada contrato, así que
 * el usuario llega viendo los PPA de SU planta y no la lista entera. Si el
 * nombre no se puede resolver se redirige igual, sin filtro — llegar a la lista
 * completa es mejor que quedarse en una página que ya no existe.
 */
import { ProyectosService } from '~/features/proyectos/services/proyectos'

const route = useRoute()

const destino = { path: '/servicios-unificado', query: { vista: 'servicios', srv: 'ppa' } }

try {
  const proyecto = await new ProyectosService().obtener(Number(route.params.id))
  if (proyecto?.nombre_comercial) destino.query.q = proyecto.nombre_comercial
}
catch {
  // Sin nombre no se filtra, pero la redirección ocurre igual.
}

await navigateTo(destino, { replace: true })
</script>

<template>
  <div />
</template>
