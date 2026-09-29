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
  const tokenStr = (Array.isArray(token) ? token[0] : token) ?? ''
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

<template>
  <div v-if="success" class="flex flex-col items-center gap-4 text-center">
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <CheckIcon class="size-6" />
    </div>
    <h1 class="text-2xl font-bold">Contraseña actualizada</h1>
    <p class="text-sm text-balance text-muted-foreground">
      Tu contraseña ha sido actualizada exitosamente.
    </p>
    <Button as-child class="w-full">
      <NuxtLink to="/login">Ir al inicio de sesión</NuxtLink>
    </Button>
  </div>

  <form v-else class="flex flex-col gap-6" @submit.prevent="submit">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Nueva contraseña</h1>
      <p class="text-sm text-balance text-muted-foreground">
        Elige una contraseña de al menos 8 caracteres.
      </p>
    </div>

    <Alert v-if="error" variant="destructive">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <FieldGroup>
      <Field>
        <FieldLabel for="password">Nueva contraseña</FieldLabel>
        <Input
          id="password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </Field>
      <Field>
        <FieldLabel for="confirm">Confirmar contraseña</FieldLabel>
        <Input
          id="confirm"
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </Field>
      <Button type="submit" class="w-full" :disabled="loading">
        <LoaderCircleIcon v-if="loading" class="animate-spin" />
        Restablecer contraseña
      </Button>
      <Button as-child variant="link" class="w-full">
        <NuxtLink to="/login">Volver al inicio de sesión</NuxtLink>
      </Button>
    </FieldGroup>
  </form>
</template>
