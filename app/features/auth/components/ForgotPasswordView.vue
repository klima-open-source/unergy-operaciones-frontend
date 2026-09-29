<script setup lang="ts">
import { CheckIcon, LoaderCircleIcon } from '@lucide/vue'
import { RecuperacionPasswordService } from '~/features/auth/services/recuperacion'

const recuperacionService = new RecuperacionPasswordService()

const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  loading.value = true
  try {
    await recuperacionService.solicitar(email.value)
  } catch {
    // No se distingue del éxito: evita que alguien confirme por este medio
    // si un correo existe o no en el sistema (enumeración de cuentas).
  } finally {
    sent.value = true
    loading.value = false
  }
}
</script>

<template>
  <div v-if="sent" class="flex flex-col items-center gap-4 text-center">
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <CheckIcon class="size-6" />
    </div>
    <h1 class="text-2xl font-bold">Revisa tu correo</h1>
    <p class="text-sm text-balance text-muted-foreground">
      Si existe una cuenta con <strong class="text-foreground">{{ email }}</strong
      >, recibirás un correo con las instrucciones para restablecer tu contraseña.
    </p>
    <Button as-child variant="outline" class="w-full">
      <NuxtLink to="/login">Volver al inicio de sesión</NuxtLink>
    </Button>
  </div>

  <form v-else class="flex flex-col gap-6" @submit.prevent="submit">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Recuperar contraseña</h1>
      <p class="text-sm text-balance text-muted-foreground">
        Ingresa tu correo y te enviaremos un enlace para restablecerla.
      </p>
    </div>

    <FieldGroup>
      <Field>
        <FieldLabel for="email">Correo electrónico</FieldLabel>
        <Input
          id="email"
          v-model="email"
          type="email"
          placeholder="tu@unergy.io"
          autocomplete="email"
          required
        />
      </Field>
      <Button type="submit" class="w-full" :disabled="loading">
        <LoaderCircleIcon v-if="loading" class="animate-spin" />
        Enviar enlace
      </Button>
      <Button as-child variant="link" class="w-full">
        <NuxtLink to="/login">Volver al inicio de sesión</NuxtLink>
      </Button>
    </FieldGroup>
  </form>
</template>
