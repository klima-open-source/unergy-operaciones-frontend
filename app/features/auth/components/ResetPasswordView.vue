<template>
  <div class="flex min-h-screen items-center justify-center bg-unergy-deep">
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        class="absolute -top-40 -right-40 size-96 rounded-full bg-unergy-purple opacity-10"
      ></div>
      <div
        class="absolute -bottom-40 -left-40 size-96 rounded-full bg-unergy-purple opacity-10"
      ></div>
    </div>

    <div class="relative mx-4 w-full max-w-sm">
      <div class="overflow-hidden rounded-2xl bg-unergy-avena shadow-2xl">
        <div class="px-10 pt-10 pb-6 text-center">
          <img
            src="/logos/Stacked_Logo_pupura_energico.png"
            alt="Unergy"
            class="mx-auto h-16 w-auto object-contain"
          />
          <p class="mt-3 text-sm text-unergy-deep/60">Nueva contraseña</p>
        </div>

        <div class="px-10 pb-10">
          <!-- Success state -->
          <div v-if="success" class="space-y-3 text-center">
            <div
              class="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10"
            >
              <CheckIcon class="size-[1em] text-2xl text-success" />
            </div>
            <p class="text-sm text-unergy-deep">Tu contraseña ha sido actualizada exitosamente.</p>
            <RouterLink
              to="/login"
              class="mt-3 inline-block rounded-lg bg-unergy-purple px-6 py-2.5 text-sm font-bold text-unergy-avena"
            >
              Ir al inicio de sesión
            </RouterLink>
          </div>

          <!-- Form state -->
          <form v-else class="space-y-4" @submit.prevent="submit">
            <div>
              <label
                class="mb-1.5 block text-xs font-semibold tracking-wide text-unergy-deep uppercase"
              >
                Nueva contraseña
              </label>
              <input
                v-model="password"
                type="password"
                placeholder="Minimo 8 caracteres"
                required
                minlength="8"
                class="w-full rounded-lg border-[1.5px] border-unergy-purple/30 bg-white px-4 py-2.5 text-sm text-unergy-deep transition-all outline-none focus:border-unergy-purple"
              />
            </div>

            <div>
              <label
                class="mb-1.5 block text-xs font-semibold tracking-wide text-unergy-deep uppercase"
              >
                Confirmar contraseña
              </label>
              <input
                v-model="confirm"
                type="password"
                placeholder="Repite la contraseña"
                required
                minlength="8"
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
                Guardando...
              </span>
              <span v-else>Restablecer contraseña</span>
            </button>

            <div class="text-center">
              <RouterLink to="/login" class="text-xs text-unergy-purple hover:underline">
                Volver al inicio de sesión
              </RouterLink>
            </div>
          </form>
        </div>
      </div>

      <p class="mt-6 text-center text-xs text-unergy-avena/35">
        © {{ new Date().getFullYear() }} Unergy · Operaciones
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckIcon, LoaderCircleIcon } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { normalizeError } from '~/core/errors'
import { RecuperacionPasswordService } from '~/features/auth/services/recuperacion'

const recuperacionService = new RecuperacionPasswordService()
const route = useRoute()
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function submit() {
  if (password.value !== confirm.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres'
    return
  }

  const token = route.params.token
  const tokenStr = Array.isArray(token) ? (token[0] ?? '') : token
  loading.value = true
  error.value = ''
  try {
    await recuperacionService.restablecer(tokenStr, password.value)
    success.value = true
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    loading.value = false
  }
}
</script>
