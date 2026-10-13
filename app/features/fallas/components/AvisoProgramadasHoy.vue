<script setup lang="ts">
/**
 * Aviso de las fallas programadas para hoy, arriba de la lista y del
 * calendario de `MonitoreoView.vue`. Recibe la lista ya filtrada
 * (`utils/programadasHoy.ts`) y avisa al hacer clic en una.
 */
import type { Falla } from '~/features/fallas/types'
import { CalendarClockIcon } from '@lucide/vue'

defineProps<{ fallas: Falla[] }>()
const emit = defineEmits<{ abrir: [falla: Falla] }>()
</script>

<template>
  <Alert v-if="fallas.length" class="border-primary/30 bg-primary/5">
    <CalendarClockIcon class="text-primary" />
    <AlertTitle>
      Hoy hay {{ fallas.length }} falla{{ fallas.length !== 1 ? 's' : '' }} programada{{
        fallas.length !== 1 ? 's' : ''
      }}
    </AlertTitle>
    <AlertDescription>
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="f in fallas"
          :key="f.id"
          variant="outline"
          size="sm"
          @click="emit('abrir', f)"
        >
          {{ f.proyecto?.nombre_comercial || 'Sin proyecto' }}
          <code class="font-mono text-xs text-muted-foreground">{{ f.codigo_interno }}</code>
        </Button>
      </div>
    </AlertDescription>
  </Alert>
</template>
