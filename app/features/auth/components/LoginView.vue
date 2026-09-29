<template>
  <div class="flex min-h-screen items-center justify-center bg-unergy-deep">
    <!-- Background accent -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute -top-40 -right-40 size-96 rounded-full bg-unergy-purple opacity-10"
      ></div>
      <div
        class="absolute -bottom-40 -left-40 size-96 rounded-full bg-unergy-purple opacity-10"
      ></div>
    </div>

    <div class="relative mx-4 w-full max-w-sm">
      <!-- Card -->
      <div class="overflow-hidden rounded-2xl bg-unergy-avena shadow-2xl">
        <!-- Header with logo -->
        <div class="px-10 pt-10 pb-6 text-center">
          <img
            src="/logos/Stacked_Logo_pupura_energico.png"
            alt="Unergy"
            class="mx-auto h-16 w-auto object-contain"
          />
          <p class="mt-3 text-sm text-unergy-deep/60">Plataforma de Operaciones</p>
        </div>

        <!-- Form -->
        <div class="px-10 pb-10">
          <form class="space-y-4" @submit.prevent="submit">
            <div>
              <label
                class="mb-1.5 block text-xs font-semibold tracking-wide text-unergy-deep uppercase"
              >
                Correo
              </label>
              <input
                v-model="email"
                type="email"
                placeholder="tu@unergy.io"
                required
                class="w-full rounded-lg border-[1.5px] border-unergy-purple/30 bg-white px-4 py-2.5 text-sm text-unergy-deep transition-all outline-none focus:border-unergy-purple"
              />
            </div>

            <div>
              <label
                class="mb-1.5 block text-xs font-semibold tracking-wide text-unergy-deep uppercase"
              >
                Contraseña
              </label>
              <input
                v-model="password"
                type="password"
                placeholder="••••••••"
                required
                class="w-full rounded-lg border-[1.5px] border-unergy-purple/30 bg-white px-4 py-2.5 text-sm text-unergy-deep transition-all outline-none focus:border-unergy-purple"
              />
            </div>

            <div
              v-if="error"
              class="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="mt-2 w-full rounded-lg bg-unergy-purple py-3 text-sm font-bold tracking-wide text-unergy-avena transition-all enabled:hover:bg-unergy-purple-dark disabled:opacity-60"
            >
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <LoaderCircleIcon class="size-[1em] animate-spin text-xs" />
                Ingresando...
              </span>
              <span v-else>Ingresar</span>
            </button>
          </form>

          <div class="mt-4 text-center">
            <RouterLink to="/forgot-password" class="text-xs text-unergy-purple hover:underline">
              ¿Olvidaste tu contraseña?
            </RouterLink>
          </div>
        </div>
      </div>

      <p class="mt-6 text-center text-xs text-unergy-avena/35">
        © {{ new Date().getFullYear() }} Unergy · Operaciones
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { normalizeError } from '~/core/errors'

const router = useRouter()
const { signIn } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await signIn({ email: email.value, password: password.value })
    router.push('/dashboard')
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    loading.value = false
  }
}
</script>
