<script setup lang="ts">
import FallaFormPage from '~/features/fallas/components/FallaFormPage.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const fallaId = computed(() => Number(route.params.id))
</script>

<template>
  <FallaFormPage :key="fallaId" :falla-id="fallaId" />
</template>
