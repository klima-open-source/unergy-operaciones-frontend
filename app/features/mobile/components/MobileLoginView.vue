<template>
  <div
    class="flex min-h-dvh w-full max-w-full items-center justify-center overflow-x-hidden bg-linear-160 from-foreground from-0% via-primary via-60% to-primary to-100% p-4"
  >
    <div
      class="w-full max-w-90 rounded-3xl border border-white/12 bg-white/6 px-6 pt-8 pb-6 text-center shadow-lg backdrop-blur-md"
    >
      <img src="/logos/Logo_avena.png" alt="Unergy" class="mx-auto mb-5 block h-8" />
      <h1 class="text-3xl font-extrabold tracking-tight text-white">Solar</h1>
      <p class="mt-1 mb-6 text-sm text-white/60">Monitoreo en tiempo real</p>

      <form class="text-left" @submit.prevent="onSubmit">
        <label class="mb-4 block text-xs font-semibold text-white/70"
          >Correo
          <input
            v-model="email"
            class="mt-2 w-full rounded-xl border-2 border-white/15 bg-white/8 px-4 py-3.5 text-base text-white placeholder:text-white/40 focus:border-highlight focus:bg-white/12 focus:outline-none"
            type="email"
            inputmode="email"
            autocomplete="username"
            placeholder="tu@unergy.io"
            required
          />
        </label>
        <label class="mb-4 block text-xs font-semibold text-white/70"
          >Contraseña
          <input
            v-model="password"
            class="mt-2 w-full rounded-xl border-2 border-white/15 bg-white/8 px-4 py-3.5 text-base text-white placeholder:text-white/40 focus:border-highlight focus:bg-white/12 focus:outline-none"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
          />
        </label>

        <div
          v-if="error"
          class="mb-3.5 flex items-center gap-2 rounded-lg bg-destructive/20 px-3 py-2.5 text-sm text-white/90"
        >
          <TriangleAlertIcon class="size-4" /> {{ error }}
        </div>

        <button
          class="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-highlight p-4 text-base font-bold text-foreground disabled:opacity-50"
          type="submit"
          :disabled="loading || !email || !password"
        >
          <LoaderCircleIcon class="size-4 animate-spin" v-if="loading" />
          <SunIcon class="size-4" v-else />
          {{ loading ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="mt-4 text-xs text-white/45">La sesión se mantiene activa en este dispositivo.</p>

      <!-- Botones de preview solo en desarrollo -->
      <div v-if="isDev" class="mt-5 border-t border-white/10 pt-4">
        <p class="mb-2.5 text-center text-xs tracking-widest text-white/35">
          — Vista previa local —
        </p>
        <button
          class="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-chart-2 bg-chart-2/10 p-3 text-sm font-semibold text-chart-2"
          @click="previsualizarComo('coordinador')"
        >
          <BriefcaseIcon class="size-3" /> Ver como Coordinador
        </button>
        <button
          class="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-success bg-success/10 p-3 text-sm font-semibold text-success"
          @click="previsualizarComo('tecnico')"
        >
          <WrenchIcon class="size-4" /> Ver como Técnico
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
