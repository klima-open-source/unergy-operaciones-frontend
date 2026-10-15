<script setup lang="ts">
import FallaFormPage from '~/features/fallas/components/FallaFormPage.vue'

definePageMeta({
  layout: 'default',
  // Un id que no es un entero positivo es un 404, no un `GET /fallas/NaN`.
  validate: (route) => {
    const id = Number(route.params.id)
    return Number.isInteger(id) && id > 0
  },
})

const route = useRoute()
const fallaId = computed(() => Number(route.params.id))
</script>

<template>
  <FallaFormPage :key="fallaId" :falla-id="fallaId" />
</template>
