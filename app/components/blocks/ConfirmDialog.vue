<script setup lang="ts">
import { TriangleAlertIcon } from '@lucide/vue'

// Composición directa sobre `ui/`: Gandalf todavía no envuelve AlertDialog
// (ver app/components/gandalf/README.md).
const state = useConfirmState()

// Cerrar el diálogo es cancelar, salvo que el cierre venga de Confirmar: quien
// pidió la confirmación puede tener que seguir por el otro camino (`onCancel`).
let confirmado = false

const open = computed({
  get: () => state.value.open,
  set: (value: boolean) => {
    if (!value && state.value.open && !confirmado) state.value.options?.onCancel?.()
    confirmado = false
    state.value = { ...state.value, open: value }
  },
})

function onConfirm() {
  confirmado = true
  state.value.options?.onConfirm()
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent v-if="state.options">
      <AlertDialogHeader>
        <AlertDialogMedia
          :class="
            state.options.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : ''
          "
        >
          <TriangleAlertIcon />
        </AlertDialogMedia>
        <AlertDialogTitle>{{ state.options.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="state.options.description">
          {{ state.options.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ state.options.cancelLabel ?? 'Cancelar' }}</AlertDialogCancel>
        <AlertDialogAction :variant="state.options.variant ?? 'default'" @click="onConfirm">
          {{ state.options.confirmLabel ?? 'Confirmar' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
