<template>
  <div>
    <div class="mb-4">
      <h1 class="text-xl font-bold" style="color: var(--color-unergy-deep);">Proyectos próximos a energizarse</h1>
      <p class="text-sm mt-1" style="color: #7a6e8a;">
        Pipeline de TSF sincronizado en la base de operaciones: proyectos en construcción
        cuya fecha de energización aún no ha llegado.
      </p>
    </div>
    <ProyectosProximosEnergizar />
  </div>
</template>

<script setup>
import ProyectosProximosEnergizar from '~/features/proyectos/components/ProyectosProximosEnergizar.vue'
</script>
