<script setup lang="ts">
import type { PayloadUsuario, RolUsuarioAdmin, Usuario } from '~/features/admin/types'
import { EyeIcon, EyeOffIcon } from '@lucide/vue'

const props = defineProps<{ initial?: Usuario | null; saving?: boolean }>()
const emit = defineEmits<{ save: [payload: PayloadUsuario]; cancel: [] }>()

// El backend de `/usuarios` solo acepta estos 7 roles (`RolUsuarioAdmin` en
// `types.ts`) — 'coordinador' y 'tecnico' existen en `UserRole` (roles de
// autenticación) pero no en la API de administración de usuarios.
const ROLES: { label: string; value: RolUsuarioAdmin }[] = [
  { label: 'Admin', value: 'admin' },
  { label: 'Operaciones', value: 'operaciones' },
  { label: 'Monitoreo', value: 'monitoreo' },
  { label: 'Liquidaciones', value: 'liquidaciones' },
  { label: 'CGM', value: 'cgm' },
  { label: 'Solo lectura', value: 'solo_lectura' },
  { label: 'Comercial', value: 'comercial' },
]

function blankForm() {
  return {
    nombre: '',
    email: '',
    rol: 'operaciones' as RolUsuarioAdmin,
    activo: true,
    password: '',
  }
}

const form = reactive(blankForm())
const showPassword = ref(false)

watch(
  () => props.initial,
  (usuario) => {
    Object.assign(form, blankForm())
    if (usuario) {
      Object.assign(form, {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        activo: usuario.activo,
      })
    }
  },
  { immediate: true },
)

function submit() {
  const payload: PayloadUsuario = {
    nombre: form.nombre,
    email: form.email,
    rol: form.rol,
    activo: form.activo,
  }
  if (form.password) payload.password = form.password
  emit('save', payload)
}
</script>

<template>
  <form class="space-y-4 pt-2" @submit.prevent="submit">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2 space-y-1.5">
        <GLabel required>Nombre completo</GLabel>
        <Input v-model="form.nombre" required />
      </div>
      <div class="col-span-2 space-y-1.5">
        <GLabel required>Correo electrónico</GLabel>
        <Input v-model="form.email" type="email" required :disabled="!!initial?.id" />
      </div>
      <div class="space-y-1.5">
        <GLabel required>Rol</GLabel>
        <Select v-model="form.rol">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="rol in ROLES" :key="rol.value" :value="rol.value">
              {{ rol.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1.5">
        <GLabel>Estado</GLabel>
        <div class="flex items-center gap-2 pt-1.5">
          <GSwitch v-model="form.activo" />
          <span class="text-sm" :class="form.activo ? 'text-success' : 'text-destructive'">
            {{ form.activo ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
      </div>
      <div class="col-span-2 space-y-1.5">
        <GLabel :required="!initial?.id">
          {{ initial?.id ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña' }}
        </GLabel>
        <InputGroup>
          <InputGroupInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :required="!initial?.id"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="button" size="icon-xs" @click="showPassword = !showPassword">
              <component :is="showPassword ? EyeOffIcon : EyeIcon" class="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" @click="emit('cancel')">Cancelar</Button>
      <Button type="submit" :disabled="saving">Guardar</Button>
    </div>
  </form>
</template>
