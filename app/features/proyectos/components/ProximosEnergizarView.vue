<template>
  <div>
    <div class="mb-4">
      <h1 class="text-xl font-bold text-foreground">Proyectos próximos a energizarse</h1>
      <p class="text-sm mt-1 text-muted-foreground">
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
