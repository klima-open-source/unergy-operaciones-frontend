<template>
  <div class="flex flex-col gap-1">
    <label class="field-label">
      {{ label }} <span v-if="requerido" class="text-red-400">*</span>
    </label>
    <div class="flex gap-2">
      <AutoComplete
        :modelValue="seleccion"
        @update:modelValue="alCambiar"
        :suggestions="sugerencias"
        optionLabel="razon_social_nombre"
        @complete="buscar"
        :placeholder="placeholder"
        :disabled="disabled"
        class="flex-1"
        inputClass="w-full"
        :inputId="inputId"
      >
        <template #option="{ option }">
          <div class="flex flex-col">
            <span>{{ option.razon_social_nombre }}</span>
            <span v-if="option.nit_cedula" class="text-xs text-gray-400">
              NIT {{ option.nit_cedula }}
            </span>
          </div>
        </template>
      </AutoComplete>
      <Button severity="secondary" outlined size="small" :disabled="disabled"
        v-tooltip="'Crear nuevo cliente'" @click="abrirCreacion">
        <template #icon><PlusIcon class="size-[1em]" /></template>
      </Button>
    </div>

    <div v-if="id" class="flex items-center gap-1 text-xs text-green-600">
      <LinkIcon class="text-xs size-[1em]" /> Cliente vinculado (id {{ id }})
    </div>
    <!-- Sin vínculo pero con texto: el caso que venía pasando en silencio. Un
         contrato guardado así nombra a alguien que el sistema no reconoce, y
         todo lo que se calcula por cliente lo deja por fuera. -->
    <div v-else-if="textoSuelto" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-600">
      <span>«{{ textoSuelto }}» no está registrado como cliente.</span>
      <button type="button" class="underline font-medium hover:text-amber-700"
        @click="abrirCreacion">
        Crear este cliente
      </button>
    </div>
  </div>

  <NuevoClienteDialog
    v-model:visible="creando"
    :nombre-inicial="textoSuelto"
    @creado="alCrear"
  />
</template>

<script setup>
/**
 * La parte de un contrato: contratante, prestador, comprador, vendedor o
 * inversionista.
 *
 * **O eliges un cliente existente, o lo creas acá mismo.** Nunca queda un
 * nombre suelto: esa era la fuga que llenó la base de partes sin `cliente_id`,
 * y que obliga a los cálculos por cliente a adivinar emparejando por texto.
 *
 * Los cinco campos compartían el mismo bloque copiado en cada wizard --
 * autocompletado, botón de crear, aviso de vinculado-- y el emparejamiento se
 * hacía comparando el nombre EXACTO contra la lista (`find(c => c.nombre ===
 * texto)`): un espacio de más y el id quedaba nulo sin avisar. Acá el
 * autocompletado sugiere el OBJETO cliente, así que lo que se elige es el
 * cliente, no su nombre.
 */
import { computed, ref, watch } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import { PlusIcon, LinkIcon } from '@lucide/vue'
import NuevoClienteDialog from '~/features/clientes/components/NuevoClienteDialog.vue'
import { clientes as cargarClientes, agregar as agregarAlCatalogo } from '~/features/clientes/services/catalogoClientes'

const props = defineProps({
  /** El `*_id` del contrato: la única prueba de que la parte está vinculada. */
  id: { type: Number, default: null },
  nombre: { type: String, default: null },
  nit: { type: String, default: null },
  label: { type: String, required: true },
  requerido: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  inputId: { type: String, default: undefined },
  placeholder: { type: String, default: 'Buscar cliente existente…' },
})
const emit = defineEmits(['update:id', 'update:nombre', 'update:nit'])

const sugerencias = ref([])
const creando = ref(false)
const catalogo = ref([])

cargarClientes()
  .then((filas) => { catalogo.value = filas })
  .catch(() => { catalogo.value = [] })

/**
 * Lo que muestra el campo: el cliente vinculado, o el texto que quedó escrito.
 *
 * Un contrato viejo llega con nombre y sin id; se muestra el nombre para que se
 * vea de quién se trata, y el aviso de abajo pide resolverlo.
 */
const seleccion = computed(() => {
  if (props.id) {
    return { id: props.id, razon_social_nombre: props.nombre, nit_cedula: props.nit }
  }
  return props.nombre ?? ''
})

/** El nombre escrito que no corresponde a ningún cliente vinculado. */
const textoSuelto = computed(() => (props.id ? '' : (props.nombre ?? '').trim()))

function buscar(event) {
  const q = (event.query ?? '').toLowerCase().trim()
  sugerencias.value = catalogo.value.filter((c) =>
    `${c.razon_social_nombre ?? ''} ${c.nit_cedula ?? ''}`.toLowerCase().includes(q),
  )
}

/**
 * El AutoComplete manda un string mientras se teclea y el OBJETO al elegir de la
 * lista. Solo el objeto vincula: teclear siempre deja la parte sin `id`, que es
 * lo que el aviso señala.
 */
function alCambiar(valor) {
  if (valor && typeof valor === 'object') {
    emit('update:id', valor.id)
    emit('update:nombre', valor.razon_social_nombre ?? null)
    emit('update:nit', valor.nit_cedula ?? '')
    return
  }
  emit('update:id', null)
  emit('update:nombre', valor || null)
  emit('update:nit', '')
}

function abrirCreacion() {
  creando.value = true
}

function alCrear(cliente) {
  agregarAlCatalogo(cliente)
  catalogo.value = [...catalogo.value.filter((c) => c.id !== cliente.id), cliente]
  alCambiar(cliente)
}

// Si el contrato se recarga con otra parte (abrir otro contrato en el mismo
// diálogo), las sugerencias viejas no deben quedar colgando.
watch(() => props.id, () => { sugerencias.value = [] })
</script>

<style scoped>
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
