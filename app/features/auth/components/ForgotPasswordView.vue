<template>
  <div class="min-h-screen flex items-center justify-center" style="background-color: var(--color-unergy-deep);">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10" style="background: var(--color-unergy-purple);"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10" style="background: var(--color-unergy-purple);"></div>
    </div>

    <div class="relative w-full max-w-sm mx-4">
      <div class="rounded-2xl shadow-2xl overflow-hidden" style="background-color: var(--color-unergy-avena);">
        <div class="px-10 pt-10 pb-6 text-center">
          <img src="/logos/Stacked_Logo_pupura_energico.png" alt="Unergy" class="h-16 w-auto mx-auto object-contain" />
          <p class="text-sm mt-3" style="color: #6b5a8a;">Recuperar contraseña</p>
        </div>

        <div class="px-10 pb-10">
          <!-- Success state -->
          <div v-if="sent" class="text-center space-y-3">
            <div class="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style="background: rgba(16,185,129,0.1);">
              <CheckIcon class="text-2xl size-[1em]" style="color: #10B981;" />
            </div>
            <p class="text-sm" style="color: var(--color-unergy-deep);">
              Si existe una cuenta con <strong>{{ email }}</strong>, recibirás un correo con las instrucciones para restablecer tu contraseña.
            </p>
            <RouterLink to="/login" class="block text-xs mt-4 hover:underline" style="color: var(--color-unergy-purple);">
              Volver al inicio de sesión
            </RouterLink>
          </div>

          <!-- Form state -->
          <form v-else @submit.prevent="submit" class="space-y-4">
            <p class="text-xs" style="color: #6b5a8a;">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div>
              <label class="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style="color: var(--color-unergy-deep);">Correo</label>
              <input
                v-model="email"
                type="email"
                placeholder="tu@unergy.io"
                required
                class="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style="border: 1.5px solid #d4c8e8; background: white; color: var(--color-unergy-deep);"
                onfocus="this.style.borderColor='var(--color-unergy-purple)'"
                onblur="this.style.borderColor='#d4c8e8'"
              />
            </div>

            <div v-if="error" class="text-xs px-3 py-2 rounded-lg" style="background: #fde8e8; color: #c0392b;">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 rounded-lg text-sm font-bold tracking-wide transition-all mt-2"
              style="background-color: var(--color-unergy-purple); color: var(--color-unergy-avena);"
              onmouseover="if(!this.disabled) this.style.backgroundColor='#7a46c0'"
              onmouseout="if(!this.disabled) this.style.backgroundColor='var(--color-unergy-purple)'"
            >
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <LoaderCircleIcon class="text-xs size-[1em] animate-spin" />
                Enviando...
              </span>
              <span v-else>Enviar enlace</span>
            </button>

            <div class="text-center">
              <RouterLink to="/login" class="text-xs hover:underline" style="color: var(--color-unergy-purple);">
                Volver al inicio de sesión
              </RouterLink>
            </div>
          </form>
        </div>
      </div>

      <p class="text-center text-xs mt-6" style="color: rgba(253,250,247,0.35);">
        © {{ new Date().getFullYear() }} Unergy · Operaciones
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RecuperacionPasswordService } from '~/features/auth/services/recuperacion'
import { CheckIcon, LoaderCircleIcon } from '@lucide/vue'

const recuperacionService = new RecuperacionPasswordService()

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await recuperacionService.solicitar(email.value)
    sent.value = true
  } catch (e) {
    // Always show success to prevent email enumeration
    sent.value = true
  } finally {
    loading.value = false
  }
}
</script>
