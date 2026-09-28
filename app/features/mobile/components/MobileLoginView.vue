<template>
  <div class="ml-root">
    <div class="ml-card">
      <img src="/logos/Logo_avena.png" alt="Unergy" class="ml-logo" />
      <h1 class="ml-title">Solar</h1>
      <p class="ml-sub">Monitoreo en tiempo real</p>

      <form class="ml-form" @submit.prevent="onSubmit">
        <label class="ml-label"
          >Correo
          <input
            v-model="email"
            class="ml-input"
            type="email"
            inputmode="email"
            autocomplete="username"
            placeholder="tu@unergy.io"
            required
          />
        </label>
        <label class="ml-label"
          >Contraseña
          <input
            v-model="password"
            class="ml-input"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
          />
        </label>

        <div v-if="error" class="ml-error">
          <TriangleAlertIcon class="size-[1em]" /> {{ error }}
        </div>

        <button class="ml-submit" type="submit" :disabled="loading || !email || !password">
          <LoaderCircleIcon class="size-[1em] animate-spin" v-if="loading" />
          <SunIcon class="size-[1em]" v-else />
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="ml-hint">La sesión se mantiene activa en este dispositivo.</p>

      <!-- Botones de preview solo en desarrollo -->
      <div v-if="isDev" class="ml-preview">
        <p class="ml-preview-label">— Vista previa local —</p>
        <button
          class="ml-preview-btn ml-preview-btn--coord"
          @click="previsualizarComo('coordinador')"
        >
          <BriefcaseIcon class="size-[1em]" /> Ver como Coordinador
        </button>
        <button class="ml-preview-btn ml-preview-btn--tec" @click="previsualizarComo('tecnico')">
          <WrenchIcon class="size-[1em]" /> Ver como Técnico
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BriefcaseIcon,
  LoaderCircleIcon,
  SunIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from '@lucide/vue'
import { normalizeError } from '~/core/errors'
import { UserRole } from '~/types/user'
import { usePwa } from '~/features/mobile/components/usePwa'

const router = useRouter()
const { user, signInMobile, previewLogin } = useAuth()
const { register } = usePwa()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const isDev = import.meta.env.DEV

async function onSubmit(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await signInMobile({ email: email.value.trim(), password: password.value })
    const rol = user.value?.role
    if (rol === UserRole.COORDINADOR) router.replace('/m/coordinador')
    else if (rol === UserRole.TECNICO) router.replace('/m/tecnico')
    else router.replace('/m/solar')
  } catch (err) {
    error.value = normalizeError(err).message
  } finally {
    loading.value = false
  }
}

function previsualizarComo(rol: 'coordinador' | 'tecnico'): void {
  previewLogin(rol)
  router.replace(rol === 'coordinador' ? '/m/coordinador' : '/m/tecnico')
}

onMounted(() => {
  register()
})
</script>

<style scoped>
.ml-root {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: linear-gradient(
    160deg,
    var(--color-unergy-deep) 0%,
    #4c1d95 60%,
    var(--color-unergy-purple) 130%
  );
}
.ml-card {
  width: 100%;
  max-width: 360px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 30px 22px 24px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}
.ml-logo {
  height: 34px;
  margin: 0 auto 18px;
  display: block;
}
.ml-title {
  font-size: 30px;
  font-weight: 800;
  color: #fff;
  margin: 0;
  letter-spacing: -0.5px;
}
.ml-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin: 4px 0 26px;
}

.ml-form {
  text-align: left;
}
.ml-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
}
.ml-input {
  width: 100%;
  margin-top: 7px;
  padding: 14px 15px;
  font-size: 16px;
  border-radius: 13px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.ml-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
.ml-input:focus {
  outline: none;
  border-color: var(--color-unergy-yellow);
  background: rgba(255, 255, 255, 0.12);
}

.ml-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #fecaca;
  background: rgba(220, 38, 38, 0.18);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.ml-submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 15px;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-unergy-deep);
  background: var(--color-unergy-yellow);
  margin-top: 4px;
}
.ml-submit:disabled {
  opacity: 0.5;
}
.ml-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin: 18px 0 0;
}

.ml-preview {
  margin-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}
.ml-preview-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  margin: 0 0 10px;
  letter-spacing: 1px;
}
.ml-preview-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px;
  border: 1.5px solid;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.ml-preview-btn--coord {
  border-color: #93c5fd;
  color: #93c5fd;
  background: rgba(147, 197, 253, 0.1);
}
.ml-preview-btn--tec {
  border-color: #6ee7b7;
  color: #6ee7b7;
  background: rgba(110, 231, 183, 0.1);
}
</style>
