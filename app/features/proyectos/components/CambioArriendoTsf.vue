<script setup lang="ts">
/**
 * Una fila de la parte del arriendo en «Sincronizar con TSF»: el contrato o un
 * arrendador, con sus campos valor actual → valor de TSF y una casilla para
 * elegir si se aplica.
 */
import type { CampoArriendo } from '~/features/proyectos/arriendoTsf'

defineProps<{
  titulo: string
  cambios: CampoArriendo[]
  /** Por qué no se puede aplicar; con alguno, la casilla queda deshabilitada. */
  avisos?: string[]
  deshabilitado?: boolean
}>()
const marcado = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="flex items-start gap-3 px-3 py-2 text-sm">
    <Checkbox
      :model-value="marcado"
      :disabled="deshabilitado || !!avisos?.length"
      class="mt-0.5"
      @update:model-value="marcado = $event === true"
    />
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="font-medium">{{ titulo }}</span>
      <span
        v-for="c in cambios"
        :key="c.clave"
        class="flex flex-wrap items-center gap-1.5 text-xs"
      >
        <span class="text-muted-foreground">{{ c.etiqueta }}:</span>
        <TruncatedText :text="c.actualTexto" class="max-w-xs text-muted-foreground line-through" />
        <span class="text-muted-foreground">→</span>
        <TruncatedText :text="c.propuestoTexto" class="max-w-xs text-foreground" />
      </span>
      <span v-for="a in avisos" :key="a" class="text-xs text-destructive">{{ a }}</span>
    </span>
  </label>
</template>
