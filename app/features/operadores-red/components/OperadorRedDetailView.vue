<template>
  <div class="space-y-4" v-if="operador">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <button @click="$router.push('/mem/operadores-red')"
        class="text-sm flex items-center gap-1 hover:underline" style="color: var(--color-unergy-purple);">
        <ArrowLeftIcon class="text-xs size-[1em]" /> Operadores de Red
      </button>
      <span style="color: #c5b9db;">/</span>
      <span class="text-sm font-semibold" style="color: var(--color-unergy-deep);">{{ operador.nombre_comercial || operador.nombre_legal }}</span>
    </div>

    <div>
      <h1 class="text-lg font-bold" style="color: var(--color-unergy-deep);">{{ operador.nombre_comercial || operador.nombre_legal }}</h1>
      <p class="text-xs mt-0.5" style="color: #9b89b5;">
        {{ operador.nombre_legal }} · {{ operador.fronteras_vinculadas }} frontera{{ operador.fronteras_vinculadas === 1 ? '' : 's' }} vinculada{{ operador.fronteras_vinculadas === 1 ? '' : 's' }}
      </p>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
      <div class="flex border-b" style="border-color: #e8e0f0;">
        <button v-for="tab in tabs" :key="tab.key"
          @click="activeTab = tab.key"
          class="px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px"
          :style="activeTab === tab.key
            ? 'border-color: var(--color-unergy-purple); color: var(--color-unergy-purple);'
            : 'border-color: transparent; color: #6b5a8a;'">
          <component :is="tab.icon" class="mr-1.5 text-xs size-[1em]" />{{ tab.label }}
        </button>
      </div>

      <div class="p-6">
        <!-- ── Tab: Contactos ── -->
        <div v-if="activeTab === 'contactos'" class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm" style="color: #6b5a8a;">Correos que reciben el reporte CGM de las fronteras de este operador.</p>
            <button v-if="!nuevo" type="button" @click="nuevo = { email: '', nombre: '' }"
              class="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style="background:var(--color-unergy-purple);color:#fff;">
              <PlusIcon class="text-xs size-[1em]" /> Agregar contacto
            </button>
          </div>

          <div v-if="!operador.contactos.length && !nuevo" class="text-sm text-center py-8 italic" style="color: #c4b3df;">
            Sin correos configurados
          </div>

          <div v-for="c in operador.contactos" :key="c.id" class="flex items-center gap-2">
            <div class="flex-1 relative">
              <MailIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-xs size-[1em]" style="color: #9b89b5;" />
              <input v-model="c.email" type="email" placeholder="correo@empresa.com"
                @blur="guardarContacto(c)"
                class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
                :style="emailValido(c.email) ? 'border:1.5px solid #e8e0f0;background:#fff;' : 'border:1.5px solid #fca5a5;background:#fff5f5;'" />
            </div>
            <input v-model="c.nombre" type="text" placeholder="Nombre (opcional)"
              @blur="guardarContacto(c)"
              class="w-40 px-3 py-2 text-sm rounded-lg outline-none"
              style="border:1.5px solid #e8e0f0;background:#fff;" />
            <button type="button" @click="eliminarContacto(c)"
              class="p-1.5 rounded-lg transition-colors hover:bg-red-50">
              <Trash2Icon class="text-xs size-[1em]" style="color: #ef4444;" />
            </button>
          </div>

          <div v-if="nuevo" class="flex items-center gap-2">
            <div class="flex-1 relative">
              <MailIcon class="absolute left-3 top-1/2 -translate-y-1/2 text-xs size-[1em]" style="color: #9b89b5;" />
              <input v-model="nuevo.email" type="email" placeholder="correo@empresa.com" autofocus
                @blur="crearContacto"
                class="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
                style="border:1.5px solid #e8e0f0;background:#fff;" />
            </div>
            <input v-model="nuevo.nombre" type="text" placeholder="Nombre (opcional)"
              @blur="crearContacto"
              class="w-40 px-3 py-2 text-sm rounded-lg outline-none"
              style="border:1.5px solid #e8e0f0;background:#fff;" />
            <button type="button" @click="nuevo = null" class="p-1.5 rounded-lg hover:bg-gray-50">
              <XIcon class="text-xs size-[1em]" style="color: #9b89b5;" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="flex items-center justify-center py-20">
    <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { ArrowLeftIcon, LoaderCircleIcon, MailIcon, PlusIcon, Trash2Icon, XIcon } from '@lucide/vue'

const operadoresRedService = new OperadoresRedService()

const route = useRoute()
const operador = ref(null)
const activeTab = ref('contactos')
const nuevo = ref(null)

// Solo hay una pestaña hoy (Contactos) -- se deja como arreglo para agregar
// más información del operador (zonas, SLAs, documentos...) sin rehacer la vista.
const tabs = [
  { key: 'contactos', label: 'Contactos', icon: MailIcon },
]

function emailValido(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')
}

async function cargar() {
  operador.value = await operadoresRedService.obtener(route.params.id)
}

async function crearContacto() {
  if (!nuevo.value || !emailValido(nuevo.value.email)) return
  try {
    const contacto = await operadoresRedService.crearContacto(operador.value.id, {
      email: nuevo.value.email.trim().toLowerCase(),
      nombre: nuevo.value.nombre?.trim() || null,
    })
    operador.value.contactos.push(contacto)
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
    await operadoresRedService.actualizarContacto(contacto.id, {
      email: contacto.email.trim().toLowerCase(),
      nombre: contacto.nombre?.trim() || null,
    })
  } catch (e) {
    toast.error('Error', {
      description: e.data?.detail || 'No se pudo guardar el contacto',
      duration: 4000,
    })
  }
}

async function eliminarContacto(contacto) {
  try {
    await operadoresRedService.eliminarContacto(contacto.id)
    operador.value.contactos = operador.value.contactos.filter(c => c.id !== contacto.id)
  } catch (e) {
    toast.error('Error', { description: 'No se pudo eliminar el contacto', duration: 4000 })
  }
}

onMounted(cargar)
</script>
