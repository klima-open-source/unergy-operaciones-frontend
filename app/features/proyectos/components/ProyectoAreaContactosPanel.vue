<template>
  <div class="space-y-3">
    <div>
      <p class="text-sm text-muted-foreground">
        Por defecto cada área usa los contactos de los inversionistas vigentes de este proyecto.
        Si para este proyecto la comunicación de alguna área la lleva otro cliente en particular, apúntala abajo.
      </p>

      <div v-if="inversionistasConId.length" class="flex flex-wrap gap-1.5 mt-2">
        <RouterLink v-for="inv in inversionistasConId" :key="inv.cliente_id"
          :to="`/clientes/${inv.cliente_id}?tab=contactos`"
          class="text-xs font-medium px-2.5 py-1 rounded-full no-underline bg-secondary text-unergy-purple">
          {{ inv.cliente_nombre }}
        </RouterLink>
      </div>
      <p v-else class="text-xs italic mt-2 text-muted-foreground/60">
        Este proyecto aún no tiene inversionistas registrados, así que ningún tipo tendrá contacto por defecto.
      </p>
    </div>

    <div v-for="tipo in TIPOS" :key="tipo.value" class="flex items-center gap-2 py-1.5">
      <span class="w-32 text-sm font-medium text-unergy-deep">{{ tipo.label }}</span>

      <template v-if="overrides[tipo.value] && editando !== tipo.value">
        <span class="text-sm flex-1 text-muted-foreground">
          <ArrowRightLeftIcon class="mr-1 size-3 text-unergy-purple" />
          <RouterLink :to="`/clientes/${overrides[tipo.value].cliente_id}?tab=contactos`" class="underline text-unergy-purple">
            {{ overrides[tipo.value].cliente_nombre }}
          </RouterLink>
        </span>
        <button type="button" @click="editando = tipo.value"
          class="text-xs px-2 py-1 rounded hover:bg-muted text-unergy-purple">Cambiar</button>
        <button type="button" @click="quitarOverride(tipo.value)"
          class="p-1.5 rounded-lg transition-colors hover:bg-destructive/10">
          <Trash2Icon class="size-3 text-destructive" />
        </button>
      </template>

      <template v-else-if="editando === tipo.value">
        <Select v-model="clienteSeleccionado" :options="clientesOptions" optionLabel="razon_social_nombre"
          optionValue="id" class="flex-1" filter showClear placeholder="Buscar cliente..." />
        <button type="button" @click="guardarOverride(tipo.value)" :disabled="!clienteSeleccionado"
          class="p-1.5 rounded-lg hover:bg-success/10 disabled:opacity-40">
          <CheckIcon class="size-3 text-success" />
        </button>
        <button type="button" @click="editando = null" class="p-1.5 rounded-lg hover:bg-muted">
          <XIcon class="size-3 text-muted-foreground" />
        </button>
      </template>

      <template v-else>
        <span class="flex-1"></span>
        <button type="button" @click="editando = tipo.value; clienteSeleccionado = null"
          class="text-xs px-2 py-1 rounded hover:bg-muted text-unergy-purple">Usar otro cliente</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Select from 'primevue/select'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { ArrowRightLeftIcon, CheckIcon, Trash2Icon, XIcon } from '@lucide/vue'

const proyectosService = new ProyectosService()

const props = defineProps({
  proyectoId: { type: [Number, String], required: true },
  inversionistas: { type: Array, default: () => [] },
  clientesOptions: { type: Array, default: () => [] },
})

const inversionistasConId = computed(() => {
  const hoy = new Date().toISOString().slice(0, 10)
  return (props.inversionistas || []).filter(inv =>
    inv.cliente_id && inv.cliente_nombre && (!inv.fecha_fin || inv.fecha_fin >= hoy)
  )
})

const TIPOS = [
  { value: 'operacional', label: 'Operacional' },
  { value: 'cgm', label: 'CGM' },
  { value: 'liquidacion', label: 'Liquidación' },
]

const overrides = ref({})
const editando = ref(null)
const clienteSeleccionado = ref(null)

async function cargar() {
  if (!props.proyectoId) return
  const data = await proyectosService.listarAreaContactos(props.proyectoId)
  overrides.value = Object.fromEntries(data.map(a => [a.tipo, a]))
}

async function guardarOverride(tipo) {
  if (!clienteSeleccionado.value) return
  try {
    const data = await proyectosService.guardarAreaContacto(props.proyectoId, tipo, {
      cliente_id: clienteSeleccionado.value,
    })
    overrides.value = { ...overrides.value, [tipo]: data }
    editando.value = null
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'No se pudo guardar', duration: 4000 })
  }
}

async function quitarOverride(tipo) {
  try {
    await proyectosService.eliminarAreaContacto(props.proyectoId, tipo)
    const rest = { ...overrides.value }
    delete rest[tipo]
    overrides.value = rest
  } catch (e) {
    toast.error('Error', { description: 'No se pudo quitar el puntero', duration: 4000 })
  }
}

watch(() => props.proyectoId, cargar, { immediate: true })
</script>
