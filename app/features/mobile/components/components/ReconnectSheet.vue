<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="rs-backdrop" @click.self="close">
        <div class="rs-sheet">
          <div class="rs-grab" />

          <div class="rs-header">
            <span :class="['rs-badge', accion === 'ON' ? 'rs-badge--on' : 'rs-badge--off']">{{ accion }}</span>
            <span class="rs-title">Reconectador · {{ nombre }}</span>
            <button class="rs-close" @click="close"><XIcon class="size-[1em]" /></button>
          </div>

          <!-- Selector de acción (siempre disponible para que puedas encender o apagar) -->
          <div class="rs-action-sel">
            <button :class="['rs-action-btn', accion === 'ON' && 'rs-action-btn--on']" @click="accion = 'ON'">
              <PowerIcon class="size-[1em]" /> Encender
            </button>
            <button :class="['rs-action-btn', accion === 'OFF' && 'rs-action-btn--off']" @click="accion = 'OFF'">
              <CircleStopIcon class="size-[1em]" /> Apagar
            </button>
          </div>

          <p class="rs-desc">
            Ingresa tus credenciales de Solenium para
            <strong>{{ accion === 'ON' ? 'activar' : 'desactivar' }}</strong> el reconectador.
          </p>

          <label class="rs-label">Usuario
            <input v-model="username" class="rs-input" type="text" inputmode="email"
              placeholder="usuario.solenium" autocomplete="username" />
          </label>
          <label class="rs-label">Contraseña
            <input v-model="password" class="rs-input" type="password" placeholder="••••••••"
              autocomplete="current-password" @keydown.enter="submit" />
          </label>

          <div v-if="error" class="rs-error">
            <TriangleAlertIcon class="size-[1em]" /> {{ error }}
          </div>

          <button
            :class="['rs-submit', accion === 'ON' ? 'rs-submit--on' : 'rs-submit--off']"
            :disabled="loading || !username || !password"
            @click="submit"
          >
            <LoaderCircleIcon class="size-[1em] animate-spin" v-if="loading" />
            <PowerIcon class="size-[1em]" v-else-if="accion === 'ON'" />
            <CircleStopIcon class="size-[1em]" v-else />
            {{ loading ? 'Enviando…' : `Confirmar ${accion}` }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ReconectadoresService } from '~/features/mobile/services/reconectadores'
import { CircleStopIcon, LoaderCircleIcon, PowerIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'

const reconectadoresService = new ReconectadoresService()

const props = defineProps({
  open:       { type: Boolean, default: false },
  proyectoId: { type: [Number, String], default: null },
  nombre:     { type: String, default: '' },
  active:     { type: [Boolean, null], default: null }, // estado actual del relay
})
const emit = defineEmits(['close', 'done'])

const RCN_CREDS_KEY = 'sl_rcn_creds_v1' // solo guarda { [proyecto_id]: username } — nunca la contraseña

const accion   = ref('ON')
const username = ref('')
const password = ref('')
const loading  = ref(false)
const error    = ref('')

function loadCredencial(id) {
  try { return JSON.parse(localStorage.getItem(RCN_CREDS_KEY) || '{}')[id] ?? '' } catch { return '' }
}
function saveCredencial(id, user) {
  try {
    const saved = JSON.parse(localStorage.getItem(RCN_CREDS_KEY) || '{}')
    saved[id] = user
    localStorage.setItem(RCN_CREDS_KEY, JSON.stringify(saved))
  } catch { /* ignore */ }
}

// Al abrir: acción por defecto = la opuesta al estado actual; precarga usuario.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  accion.value   = props.active === true ? 'OFF' : 'ON'
  username.value = loadCredencial(props.proyectoId)
  password.value = ''
  error.value    = ''
  loading.value  = false
})

function close() { emit('close') }

async function submit() {
  if (!username.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await reconectadoresService.enviarComando(props.proyectoId, {
      username:         username.value,
      password:         password.value,
      accion:           accion.value,
      is_interrogating: true,
    })
    saveCredencial(props.proyectoId, username.value)
    emit('done', { active: accion.value === 'ON' })
    emit('close')
  } catch (err) {
    error.value = err.data?.detail || err.message || 'Error desconocido'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.rs-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(28,18,50,0.45);
  display: flex; align-items: flex-end;
}
.rs-sheet {
  width: 100%; background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom)) 20px;
  box-shadow: 0 -8px 30px rgba(0,0,0,0.2);
}
.rs-grab { width: 40px; height: 4px; border-radius: 2px; background: #e5e7eb; margin: 4px auto 14px; }
.rs-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.rs-badge { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 7px; letter-spacing: .5px; }
.rs-badge--on  { background: #dcfce7; color: #15803d; }
.rs-badge--off { background: #fee2e2; color: #b91c1c; }
.rs-title { flex: 1; font-size: 15px; font-weight: 700; color: var(--color-unergy-deep); }
.rs-close { background: none; border: none; color: #9ca3af; font-size: 16px; padding: 4px; }

.rs-action-sel { display: flex; gap: 10px; margin-bottom: 14px; }
.rs-action-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 13px; border-radius: 12px; border: 1.5px solid #e5e7eb; background: #fff;
  font-size: 14px; font-weight: 600; color: #6b5a8a;
}
.rs-action-btn--on  { border-color: #16a34a; background: #f0fdf4; color: #15803d; }
.rs-action-btn--off { border-color: #dc2626; background: #fef2f2; color: #b91c1c; }

.rs-desc { font-size: 13px; color: #6b5a8a; margin: 0 0 14px; line-height: 1.4; }
.rs-label { display: block; font-size: 12px; font-weight: 600; color: #6b5a8a; margin-bottom: 12px; }
.rs-input {
  width: 100%; margin-top: 6px; padding: 13px 14px; font-size: 16px;
  border: 1.5px solid #e8e0f0; border-radius: 12px; color: var(--color-unergy-deep); background: #fff;
}
.rs-input:focus { outline: none; border-color: var(--color-unergy-purple); }

.rs-error {
  display: flex; align-items: center; gap: 8px; font-size: 13px; color: #b91c1c;
  background: #fef2f2; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px;
}
.rs-submit {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 15px; border: none; border-radius: 14px; font-size: 15px; font-weight: 700;
  color: #fff; margin-top: 4px;
}
.rs-submit--on  { background: #16a34a; }
.rs-submit--off { background: #dc2626; }
.rs-submit:disabled { opacity: .5; }

.sheet-enter-active, .sheet-leave-active { transition: opacity .2s ease; }
.sheet-enter-active .rs-sheet, .sheet-leave-active .rs-sheet { transition: transform .25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .rs-sheet, .sheet-leave-to .rs-sheet { transform: translateY(100%); }
</style>
