<template>
  <div class="space-y-5">
    <p class="text-sm text-muted-foreground">
      Contactos de esta razón social, por área. Cada área puede tener los contactos que necesites.
      Los correos aplican a todos sus proyectos salvo que uno apunte a otro cliente para ese tipo.
    </p>

    <div v-for="tipo in TIPOS" :key="tipo.value" class="rounded-xl border bg-muted/30 p-4 space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold uppercase tracking-wide flex items-center gap-2 text-primary">
          <component :is="tipo.icon" class="size-3" />{{ tipo.label }}
          <Badge v-if="porTipo[tipo.value].length" variant="secondary">
            {{ porTipo[tipo.value].length }}
          </Badge>
        </p>
        <Button v-if="nuevoTipo !== tipo.value" type="button" size="xs" @click="nuevoTipo = tipo.value; nuevo = { email: '', nombre: '', telefono: '' }">
          <PlusIcon /> Agregar
        </Button>
      </div>

      <div v-if="!porTipo[tipo.value].length && nuevoTipo !== tipo.value" class="text-xs italic py-1 text-muted-foreground">
        Sin contactos configurados
      </div>

      <div v-for="c in porTipo[tipo.value]" :key="c.id" class="flex flex-wrap items-center gap-2">
        <Input v-model="c.nombre" type="text" placeholder="Nombre (opcional)"
          class="flex-1 min-w-32"
          @blur="guardarContacto(c)" />
        <div class="flex-1 min-w-48 relative">
          <MailIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input v-model="c.email" type="email" placeholder="correo@empresa.com"
            class="pl-8"
            :aria-invalid="!emailValido(c.email)"
            @blur="guardarContacto(c)" />
        </div>
        <div class="flex-1 min-w-36 relative">
          <PhoneIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input v-model="c.telefono" type="text" placeholder="Teléfono"
            class="pl-8"
            @blur="guardarContacto(c)" />
        </div>
        <Button type="button" variant="ghost" size="icon-sm" title="Enviar correo de prueba"
          :disabled="!emailValido(c.email)"
          @click="enviarPrueba(c.email)">
          <SendIcon class="text-primary" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" @click="eliminarContacto(c)">
          <Trash2Icon class="text-destructive" />
        </Button>
      </div>

      <div v-if="nuevoTipo === tipo.value" class="flex flex-wrap items-center gap-2">
        <Input v-model="nuevo.nombre" type="text" placeholder="Nombre (opcional)"
          class="flex-1 min-w-32"
          @keyup.enter="crearContacto" />
        <div class="flex-1 min-w-48 relative">
          <MailIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input v-model="nuevo.email" type="email" placeholder="correo@empresa.com" autofocus
            class="pl-8"
            @keyup.enter="crearContacto" />
        </div>
        <div class="flex-1 min-w-36 relative">
          <PhoneIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input v-model="nuevo.telefono" type="text" placeholder="Teléfono"
            class="pl-8"
            @keyup.enter="crearContacto" />
        </div>
        <Button type="button" variant="ghost" size="icon-sm" @click="crearContacto">
          <CheckIcon class="text-success" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" @click="nuevoTipo = null; nuevo = null">
          <XIcon class="text-muted-foreground" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { ClientesService } from '~/features/clientes/services/clientes'
import { BookIcon, BriefcaseIcon, CalculatorIcon, CheckIcon, MailIcon, PhoneIcon, PlusIcon, SendIcon, SettingsIcon, Trash2Icon, XIcon, ZapIcon } from '@lucide/vue'

const props = defineProps({ clienteId: { type: [Number, String], required: true } })
const clientesService = new ClientesService()
const contactos = ref([])
const nuevoTipo = ref(null)
const nuevo = ref(null)

// Orden pedido por Operaciones: Liquidaciones, Operaciones, Comercial, CGM, Contable.
// El valor 'operacional' se conserva (dato existente) aunque se etiquete "Operaciones".
const TIPOS = [
  { value: 'liquidacion', label: 'Liquidaciones', icon: CalculatorIcon },
  { value: 'operacional', label: 'Operaciones', icon: SettingsIcon },
  { value: 'comercial', label: 'Comercial', icon: BriefcaseIcon },
  { value: 'cgm', label: 'CGM', icon: ZapIcon },
  { value: 'contable', label: 'Contable', icon: BookIcon },
]

const porTipo = computed(() => {
  const grupos = Object.fromEntries(TIPOS.map(t => [t.value, []]))
  for (const c of contactos.value) {
    if (grupos[c.tipo]) grupos[c.tipo].push(c)
  }
  return grupos
})

function emailValido(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')
}

async function cargar() {
  if (!props.clienteId) return
  contactos.value = await clientesService.listarContactos(props.clienteId)
}

async function crearContacto() {
  if (!nuevo.value || !emailValido(nuevo.value.email) || !nuevoTipo.value) return
  try {
    const data = await clientesService.crearContacto(props.clienteId, {
      tipo: nuevoTipo.value,
      email: nuevo.value.email.trim().toLowerCase(),
      nombre: nuevo.value.nombre?.trim() || null,
      telefono: nuevo.value.telefono?.trim() || null,
    })
    contactos.value.push(data)
    nuevoTipo.value = null
    nuevo.value = null
  } catch (e) {
    toast.error('Error', {
      description: e.data?.detail || 'No se pudo agregar el contacto',
      duration: 4000,
    })
  }
}

async function guardarContacto(contacto) {
  if (!emailValido(contacto.email)) return
  try {
    await clientesService.actualizarContacto(props.clienteId, contacto.id, {
      email: contacto.email.trim().toLowerCase(),
      nombre: contacto.nombre?.trim() || null,
      telefono: contacto.telefono?.trim() || null,
    })
  } catch (e) {
    toast.error('Error', {
      description: e.data?.detail || 'No se pudo guardar el contacto',
      duration: 4000,
    })
    cargar()
  }
}

async function eliminarContacto(contacto) {
  try {
    await clientesService.eliminarContacto(props.clienteId, contacto.id)
    contactos.value = contactos.value.filter(c => c.id !== contacto.id)
  } catch (e) {
    toast.error('Error', { description: 'No se pudo eliminar el contacto', duration: 4000 })
  }
}

async function enviarPrueba(email) {
  if (!emailValido(email)) return
  try {
    await clientesService.enviarCorreoPrueba(props.clienteId, email)
    toast.success('Correo de prueba enviado', { description: `✓ Enviado a ${email}`, duration: 4000 })
  } catch (e) {
    toast.error('Error al enviar', { description: e.data?.detail || e.message, duration: 5000 })
  }
}

watch(() => props.clienteId, cargar, { immediate: true })
</script>
