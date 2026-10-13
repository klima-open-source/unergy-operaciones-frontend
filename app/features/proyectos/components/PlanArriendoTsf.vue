<script setup lang="ts">
/**
 * La parte del arriendo de «Sincronizar con TSF»: el contrato y cada arrendador,
 * con su casilla. La usan el modal de la ficha del proyecto y el botón de la
 * pestaña Arriendos. Ver `~/features/proyectos/arriendoTsf`.
 */
import CambioArriendoTsf from '~/features/proyectos/components/CambioArriendoTsf.vue'
import type { AccionArrendador, PlanArriendo } from '~/features/proyectos/arriendoTsf'

const props = defineProps<{ plan: PlanArriendo }>()
const conContrato = defineModel<boolean>('conContrato', { required: true })
const elegidas = defineModel<boolean[]>('elegidas', { required: true })

const TITULO: Record<AccionArrendador['tipo'], string> = {
  crear: 'Nuevo arrendador',
  actualizar: 'Arrendador',
  desactivar: 'Desactivar arrendador',
}
/** Sin contrato en Operaciones, los arrendadores dependen de crearlo. */
const contratoNuevo = computed(() => props.plan.contrato?.id === null)

function marcar(i: number, valor: boolean) {
  const nuevas = [...elegidas.value]
  nuevas[i] = valor
  elegidas.value = nuevas
}
</script>

<template>
  <div class="flex flex-col divide-y divide-border rounded-md border border-border">
    <CambioArriendoTsf
      v-if="plan.contrato"
      v-model="conContrato"
      :titulo="
        contratoNuevo ? 'Crear el contrato de arriendo' : `Contrato de arriendo #${plan.contrato.id}`
      "
      :cambios="plan.contrato.cambios"
      :avisos="plan.contrato.faltan"
    />
    <CambioArriendoTsf
      v-for="(a, i) in plan.arrendadores"
      :key="`${a.tipo}:${a.id ?? a.landlord?.id}`"
      :model-value="!!elegidas[i] && (!contratoNuevo || conContrato)"
      :titulo="`${TITULO[a.tipo]}: ${a.nombre}`"
      :cambios="a.cambios"
      :deshabilitado="contratoNuevo && !conContrato"
      @update:model-value="marcar(i, $event)"
    />
  </div>
</template>
