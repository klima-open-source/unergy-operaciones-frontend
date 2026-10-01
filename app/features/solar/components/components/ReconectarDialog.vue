<template>
  <Dialog :open="open" @update:open="(v: boolean) => !v && !loading && emit('update:open', false)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <PowerIcon class="size-4" /> Reconectador · {{ nombre }}
        </DialogTitle>
        <DialogDescription>
          Estado actual:
          <strong
            :class="active === true ? 'text-success' : active === false ? 'text-destructive' : ''"
          >
            {{ active === true ? 'ON' : active === false ? 'OFF' : 'desconocido' }}
          </strong>
        </DialogDescription>
      </DialogHeader>

      <!-- Siempre se puede elegir: a veces hay que reenviar el mismo estado. -->
      <div class="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          :class="[ACTION_BTN, accion === 'ON' ? TONE_ACTIVE.ON : ACTION_BTN_IDLE]"
          @click="accion = 'ON'"
        >
          <PowerIcon class="size-4" /> Encender
        </button>
        <button
          type="button"
          :class="[ACTION_BTN, accion === 'OFF' ? TONE_ACTIVE.OFF : ACTION_BTN_IDLE]"
          @click="accion = 'OFF'"
        >
          <CircleStopIcon class="size-4" /> Apagar
        </button>
      </div>

      <p class="text-sm leading-snug text-muted-foreground">
        Vas a <strong>{{ accion === 'ON' ? 'activar' : 'desactivar' }}</strong> el reconectador de
        <strong>{{ nombre }}</strong
        >.
        <template v-if="accion === 'OFF'">Esto deja la planta fuera de línea.</template>
        La acción queda registrada a tu nombre.
      </p>

      <div
        v-if="error"
        class="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        <TriangleAlertIcon class="size-4 shrink-0" /> {{ error }}
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">
          Cancelar
        </Button>
        <Button
          :variant="accion === 'OFF' ? 'destructive' : 'default'"
          :disabled="loading"
          @click="submit"
        >
          <LoaderCircleIcon v-if="loading" class="animate-spin" />
          <PowerIcon v-else-if="accion === 'ON'" />
          <CircleStopIcon v-else />
          {{ loading ? 'Enviando…' : `Confirmar ${accion}` }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CircleStopIcon, LoaderCircleIcon, PowerIcon, TriangleAlertIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { ReconectadoresService } from '~/features/mobile/services/reconectadores'

const reconectadoresService = new ReconectadoresService()

const props = withDefaults(
  defineProps<{
    open?: boolean
    proyectoId?: number | null
    nombre?: string
    /** Estado actual del relay. */
    active?: boolean | null
  }>(),
  { open: false, proyectoId: null, nombre: '', active: null },
)
const emit = defineEmits<{
  'update:open': [value: boolean]
  done: [payload: { active: boolean }]
}>()

type Accion = 'ON' | 'OFF'

const TONE_ACTIVE: Record<Accion, string> = {
  ON: 'border-success bg-success/10 text-success',
  OFF: 'border-destructive bg-destructive/10 text-destructive',
}
const ACTION_BTN =
  'flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition-colors'
const ACTION_BTN_IDLE = 'border-border bg-card text-muted-foreground hover:bg-muted'

const accion = ref<Accion>('ON')
const loading = ref(false)
const error = ref('')

// Al abrir: acción por defecto = la opuesta al estado actual.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    accion.value = props.active === true ? 'OFF' : 'ON'
    error.value = ''
    loading.value = false
  },
)

async function submit(): Promise<void> {
  if (props.proyectoId == null) return
  loading.value = true
  error.value = ''
  try {
    await reconectadoresService.enviarComando(props.proyectoId, { accion: accion.value })
    emit('done', { active: accion.value === 'ON' })
    emit('update:open', false)
  } catch (err) {
    error.value = normalizeError(err).message
  } finally {
    loading.value = false
  }
}
</script>
