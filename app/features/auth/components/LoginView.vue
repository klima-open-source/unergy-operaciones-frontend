<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue'
import { normalizeError } from '~/core/errors'

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
    await navigateTo('/dashboard')
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-bold">Inicia sesión en tu cuenta</h1>
      <p class="text-sm text-balance text-muted-foreground">
        Ingresa tu correo y contraseña para iniciar sesión.
      </p>
    </div>

    <Alert v-if="error" variant="destructive">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

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
      <Field>
        <div class="flex items-center">
          <FieldLabel for="password">Contraseña</FieldLabel>
          <NuxtLink
            to="/forgot-password"
            class="ml-auto text-sm underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </NuxtLink>
        </div>
        <Input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </Field>
      <Button type="submit" class="w-full" :disabled="loading">
        <LoaderCircleIcon v-if="loading" class="animate-spin" />
        Iniciar sesión
      </Button>
    </FieldGroup>
  </form>
</template>
