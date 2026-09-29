<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end bg-unergy-deep/45"
        @click.self="close"
      >
        <div class="rs-sheet w-full rounded-t-3xl bg-card px-5 pt-2.5 shadow-lg">
          <div class="mx-auto mt-1 mb-3.5 h-1 w-10 rounded-full bg-border" />

          <div class="mb-4 flex items-center gap-2.5">
            <span
              :class="[
                'rounded-md px-2 py-0.5 text-xs font-extrabold tracking-wider',
                TONE_SOFT[accion],
              ]"
              >{{ accion }}</span
            >
            <span class="flex-1 text-base font-bold text-unergy-deep"
              >Reconectador · {{ nombre }}</span
            >
            <button class="p-1 text-muted-foreground" @click="close">
              <XIcon class="size-4" />
            </button>
          </div>

          <!-- Selector de acción (siempre disponible para que puedas encender o apagar) -->
          <div class="mb-3.5 flex gap-2.5">
            <button
              :class="[ACTION_BTN, accion === 'ON' ? TONE_ACTIVE.ON : ACTION_BTN_IDLE]"
              @click="accion = 'ON'"
            >
              <PowerIcon class="size-4" /> Encender
            </button>
            <button
              :class="[ACTION_BTN, accion === 'OFF' ? TONE_ACTIVE.OFF : ACTION_BTN_IDLE]"
              @click="accion = 'OFF'"
            >
              <CircleStopIcon class="size-4" /> Apagar
            </button>
          </div>

          <p class="mb-3.5 text-sm leading-snug text-muted-foreground">
            Ingresa tus credenciales de Solenium para
            <strong>{{ accion === 'ON' ? 'activar' : 'desactivar' }}</strong> el reconectador.
          </p>

          <label class="mb-3 block text-xs font-semibold text-muted-foreground"
            >Usuario
            <input
              v-model="username"
              class="mt-1.5 w-full rounded-xl border-2 border-border bg-card px-3.5 py-3 text-base text-unergy-deep focus:border-unergy-purple focus:outline-none"
              type="text"
              inputmode="email"
              placeholder="usuario.solenium"
              autocomplete="username"
            />
          </label>
          <label class="mb-3 block text-xs font-semibold text-muted-foreground"
            >Contraseña
            <input
              v-model="password"
              class="mt-1.5 w-full rounded-xl border-2 border-border bg-card px-3.5 py-3 text-base text-unergy-deep focus:border-unergy-purple focus:outline-none"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              @keydown.enter="submit"
            />
          </label>

          <div
            v-if="error"
            class="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlertIcon class="size-4" /> {{ error }}
          </div>

          <button
            :class="[
              'mt-1 flex w-full items-center justify-center gap-2 rounded-xl p-4 text-base font-bold text-white disabled:opacity-50',
              TONE_SOLID[accion],
            ]"
            :disabled="loading || !username || !password"
            @click="submit"
          >
            <LoaderCircleIcon class="size-4 animate-spin" v-if="loading" />
            <PowerIcon class="size-4" v-else-if="accion === 'ON'" />
            <CircleStopIcon class="size-4" v-else />
            {{ loading ? 'Enviando…' : `Confirmar ${accion}` }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CircleStopIcon, LoaderCircleIcon, PowerIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { ReconectadoresService } from '~/features/mobile/services/reconectadores'

const reconectadoresService = new ReconectadoresService()

const props = withDefaults(
  defineProps<{
    open?: boolean
    proyectoId?: number | string | null
    nombre?: string
    /** Estado actual del relay. */
    active?: boolean | null
  }>(),
  { open: false, proyectoId: null, nombre: '', active: null },
)
const emit = defineEmits<{
  close: []
  done: [payload: { active: boolean }]
}>()

const RCN_CREDS_KEY = 'sl_rcn_creds_v1' // solo guarda { [proyecto_id]: username } — nunca la contraseña

type Accion = 'ON' | 'OFF'

const TONE_SOFT: Record<Accion, string> = {
  ON: 'bg-success/10 text-success',
  OFF: 'bg-destructive/10 text-destructive',
}
const TONE_ACTIVE: Record<Accion, string> = {
  ON: 'border-success bg-success/10 text-success',
  OFF: 'border-destructive bg-destructive/10 text-destructive',
}
const TONE_SOLID: Record<Accion, string> = { ON: 'bg-success', OFF: 'bg-destructive' }
const ACTION_BTN =
  'flex flex-1 items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold'
const ACTION_BTN_IDLE = 'border-border bg-card text-muted-foreground'

const accion = ref<Accion>('ON')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

function loadCredencial(id: number | string | null | undefined): string {
  if (id == null) return ''
  try {
    const saved = JSON.parse(localStorage.getItem(RCN_CREDS_KEY) || '{}') as Record<string, string>
    return saved[id] ?? ''
  } catch {
    return ''
  }
}
function saveCredencial(id: number | string | null | undefined, user: string): void {
  if (id == null) return
  try {
    const saved = JSON.parse(localStorage.getItem(RCN_CREDS_KEY) || '{}') as Record<string, string>
    saved[id] = user
    localStorage.setItem(RCN_CREDS_KEY, JSON.stringify(saved))
  } catch {
    /* ignore */
  }
}

// Al abrir: acción por defecto = la opuesta al estado actual; precarga usuario.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    accion.value = props.active === true ? 'OFF' : 'ON'
    username.value = loadCredencial(props.proyectoId)
    password.value = ''
    error.value = ''
    loading.value = false
  },
)

function close(): void {
  emit('close')
}

async function submit(): Promise<void> {
  if (!username.value || !password.value || props.proyectoId == null) return
  loading.value = true
  error.value = ''
  try {
    await reconectadoresService.enviarComando(props.proyectoId, {
      username: username.value,
      password: password.value,
      accion: accion.value,
      is_interrogating: true,
    })
    saveCredencial(props.proyectoId, username.value)
    emit('done', { active: accion.value === 'ON' })
    emit('close')
  } catch (err) {
    error.value = normalizeError(err).message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* safe-area del dispositivo: env() no tiene utilidad */
.rs-sheet {
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active .rs-sheet,
.sheet-leave-active .rs-sheet {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .rs-sheet,
.sheet-leave-to .rs-sheet {
  transform: translateY(100%);
}
</style>
