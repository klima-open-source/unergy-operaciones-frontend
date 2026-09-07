<template>
  <div class="space-y-5">
    <p class="text-sm" style="color: #6b5a8a;">
      Contactos de esta razón social, por área. Cada área puede tener los contactos que necesites.
      Los correos aplican a todos sus proyectos salvo que uno apunte a otro cliente para ese tipo.
    </p>

    <div v-for="tipo in TIPOS" :key="tipo.value" class="rounded-xl p-4 space-y-2" style="background:#f9f7ff;border:1.5px solid #e8e0f0;">
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold uppercase tracking-wide flex items-center gap-2" style="color:var(--color-unergy-purple);">
          <component :is="tipo.icon" class="text-xs size-[1em]" />{{ tipo.label }}
          <span v-if="porTipo[tipo.value].length" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background:#f0ebfd;color:var(--color-unergy-purple);">
            {{ porTipo[tipo.value].length }}
          </span>
        </p>
        <button v-if="nuevoTipo !== tipo.value" type="button" @click="nuevoTipo = tipo.value; nuevo = { email: '', nombre: '', telefono: '' }"
          class="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style="background:var(--color-unergy-purple);color:#fff;">
          <PlusIcon class="text-xs size-[1em]" /> Agregar
        </button>
      </div>

      <div v-if="!porTipo[tipo.value].length && nuevoTipo !== tipo.value" class="text-xs italic py-1" style="color:#c4b3df;">
        Sin contactos configurados
      </div>

      <div v-for="c in porTipo[tipo.value]" :key="c.id" class="flex flex-wrap items-center gap-2">
        <input v-model="c.nombre" type="text" placeholder="Nombre (opcional)"
          @blur="guardarContacto(c)"
          class="flex-1 min-w-32 px-3 py-2 text-sm rounded-lg outline-none"
          style="border:1.5px solid #e8e0f0;background:#fff;" />
        <div class="flex-[2] min-w-48 relative">
          <MailIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-xs size-[1em]" style="color: #9b89b5;" />
          <input v-model="c.email" type="email" placeholder="correo@empresa.com"
            @blur="guardarContacto(c)"
            class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
            :style="emailValido(c.email) ? 'border:1.5px solid #e8e0f0;background:#fff;' : 'border:1.5px solid #fca5a5;background:#fff5f5;'" />
        </div>
        <div class="flex-1 min-w-36 relative">
          <PhoneIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-xs size-[1em]" style="color: #9b89b5;" />
          <input v-model="c.telefono" type="text" placeholder="Teléfono"
            @blur="guardarContacto(c)"
            class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
            style="border:1.5px solid #e8e0f0;background:#fff;" />
        </div>
        <button type="button" @click="enviarPrueba(c.email)" :disabled="!emailValido(c.email)"
          title="Enviar correo de prueba"
          class="p-1.5 rounded-lg transition-colors hover:bg-gray-50 disabled:opacity-40">
          <SendIcon class="text-xs size-[1em]" style="color: var(--color-unergy-purple);" />
        </button>
        <button type="button" @click="eliminarContacto(c)"
          class="p-1.5 rounded-lg transition-colors hover:bg-red-50">
          <Trash2Icon class="text-xs size-[1em]" style="color: #ef4444;" />
        </button>
      </div>

      <div v-if="nuevoTipo === tipo.value" class="flex flex-wrap items-center gap-2">
        <input v-model="nuevo.nombre" type="text" placeholder="Nombre (opcional)"
          @keyup.enter="crearContacto"
          class="flex-1 min-w-32 px-3 py-2 text-sm rounded-lg outline-none"
          style="border:1.5px solid #e8e0f0;background:#fff;" />
        <div class="flex-[2] min-w-48 relative">
          <MailIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-xs size-[1em]" style="color: #9b89b5;" />
          <input v-model="nuevo.email" type="email" placeholder="correo@empresa.com" autofocus
            @keyup.enter="crearContacto"
            class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
            style="border:1.5px solid #e8e0f0;background:#fff;" />
        </div>
        <div class="flex-1 min-w-36 relative">
          <PhoneIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-xs size-[1em]" style="color: #9b89b5;" />
          <input v-model="nuevo.telefono" type="text" placeholder="Teléfono"
            @keyup.enter="crearContacto"
            class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
            style="border:1.5px solid #e8e0f0;background:#fff;" />
        </div>
        <button type="button" @click="crearContacto" class="p-1.5 rounded-lg hover:bg-green-50">
          <CheckIcon class="text-xs size-[1em]" style="color: #16a34a;" />
        </button>
        <button type="button" @click="nuevoTipo = null; nuevo = null" class="p-1.5 rounded-lg hover:bg-gray-50">
          <XIcon class="text-xs size-[1em]" style="color: #9b89b5;" />
        </button>
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
