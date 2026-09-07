<script setup>
/**
 * MobileTecnicoFallasView.vue dependía 100% de asignado_a_id (mostraba "mis
 * fallas asignadas") -- eliminado junto con el campo (auditoría 2026-09-02,
 * sin adopción real: solo 3/6444 fallas lo tenían poblado, y los únicos
 * usuarios con rol tecnico/coordinador eran cuentas de prueba). La ruta
 * /m/tecnico se conserva -- reutiliza la misma vista general de gestión de
 * fallas que /m/coordinador.
 */
import View from '~/features/mobile/components/MobileCoordinadorFallasView.vue'

definePageMeta({ layout: 'legacy-blank', mobile: true })
</script>

<template>
  <View />
</template>
