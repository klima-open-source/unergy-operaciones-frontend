<script setup lang="ts">
/**
 * El portafolio de la planta, en la ficha del proyecto (Información › General).
 *
 * Un proyecto está en un solo portafolio (Sara, 15-oct). Cambiarlo se guarda al
 * momento y la saca del que tenía. El catálogo se administra en Proyectos ›
 * Portafolios.
 */
import type { Portafolio } from '~/features/operaciones/types'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { PortafoliosService } from '~/features/operaciones/services/portafolios'
import { aValorSelect, deValorSelect, VALOR_SELECT_VACIO } from '~/utils/select'

const props = defineProps<{
  proyectoId: number
  portafolioId: number | null
}>()

const portafoliosService = new PortafoliosService()
const catalogoPortafolios = useCatalogoPortafolios()

const catalogo = ref<Portafolio[]>([])
const elegido = ref(props.portafolioId != null ? String(props.portafolioId) : '')
const guardando = ref(false)

onMounted(() => {
  catalogoPortafolios
    .cargar()
    .then((data) => {
      catalogo.value = data.portafolios
    })
    .catch(() => {
      catalogo.value = []
    })
})

async function cambiar(valor: unknown) {
  const antes = elegido.value
  const nuevo = deValorSelect(valor)
  elegido.value = nuevo
  guardando.value = true
  try {
    await portafoliosService.asignarProyecto(props.proyectoId, nuevo ? Number(nuevo) : null)
  } catch (err) {
    toast.error('No se pudo cambiar el portafolio', { description: normalizeError(err).message })
    elegido.value = antes
  } finally {
    // Cada portafolio lista sus plantas: el catálogo compartido ya no está al día.
    catalogoPortafolios.invalidar()
    guardando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-xs tracking-wide text-muted-foreground uppercase">Portafolio</p>
      <NuxtLink to="/proyectos?ver=portafolios" class="text-xs text-primary hover:underline">
        Gestionar →
      </NuxtLink>
    </div>
    <Select :model-value="aValorSelect(elegido)" :disabled="guardando" @update:model-value="cambiar">
      <SelectTrigger class="w-full">
        <SelectValue placeholder="Sin portafolio" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="VALOR_SELECT_VACIO">Sin portafolio</SelectItem>
        <SelectItem v-for="p in catalogo" :key="p.id" :value="String(p.id)">
          {{ p.nombre }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
