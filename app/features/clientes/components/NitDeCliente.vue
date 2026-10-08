<script setup lang="ts">
/**
 * El NIT de una parte de un contrato, de solo lectura.
 *
 * El contrato ya no guarda el NIT de sus partes: es el de la ficha del cliente
 * que se eligió en `SelectorCliente`. Si está mal, se corrige en la ficha, y
 * queda corregido en todos los contratos de ese cliente a la vez.
 */
defineProps<{ nit?: string | null }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <GLabel>NIT</GLabel>
    <Input :model-value="nit ?? ''" disabled placeholder="—" />
    <p class="text-xs text-muted-foreground">Sale de la ficha del cliente; se corrige allá.</p>
  </div>
</template>
