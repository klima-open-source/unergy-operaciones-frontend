<script setup lang="ts">
/**
 * Los portafolios de la planta, en la ficha del proyecto (pestaña General).
 *
 * Una planta puede estar en varios. Cada cambio se guarda al momento: agregar un
 * chip la mete en ese portafolio, quitarlo la saca solo de ese. El catálogo
 * completo se administra en Proyectos › Portafolios.
 */
import type { Portafolio, PortafolioDeProyecto } from '~/features/operaciones/types'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'

const props = defineProps<{
  proyectoId: number
  portafolios: PortafolioDeProyecto[]
}>()

const portafoliosService = new PortafoliosService()

const catalogo = ref<Portafolio[]>([])
const elegidos = ref<string[]>(props.portafolios.map((p) => String(p.id)))
const guardando = ref(false)

onMounted(() => {
  portafoliosService
    .listar()
    .then((data) => {
      catalogo.value = data.portafolios
    })
    .catch(() => {
      catalogo.value = []
    })
})

const opciones = computed(() => {
  const lista = catalogo.value.length ? catalogo.value : props.portafolios
  return lista.map((p) => ({ value: String(p.id), label: p.nombre }))
})

async function cambiar(nuevos: string[]) {
  const antes = new Set(elegidos.value)
  const despues = new Set(nuevos)
  elegidos.value = nuevos
  guardando.value = true
  try {
    for (const id of despues) {
      if (!antes.has(id)) await portafoliosService.asignarProyecto(props.proyectoId, Number(id), true)
    }
    for (const id of antes) {
      if (!despues.has(id)) await portafoliosService.asignarProyecto(props.proyectoId, Number(id), false)
    }
  } catch (err) {
    toast.error('No se pudo cambiar el portafolio', { description: normalizeError(err).message })
    elegidos.value = [...antes]
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-xs tracking-wide text-muted-foreground uppercase">Portafolios</p>
      <NuxtLink
        to="/proyectos?ver=portafolios"
        class="text-xs text-primary hover:underline"
      >
        Gestionar →
      </NuxtLink>
    </div>
    <MultiComboBox
      :model-value="elegidos"
      :options="opciones"
      :disabled="guardando"
      placeholder="Agregar a un portafolio…"
      empty-message="Sin portafolios."
      @update:model-value="cambiar"
    />
  </div>
</template>
