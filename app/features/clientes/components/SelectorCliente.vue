<script setup lang="ts">
/**
 * La parte de un contrato: contratante, prestador, comprador, vendedor o
 * inversionista.
 *
 * **O eliges un cliente existente, o lo creas acá mismo.** Nunca queda un
 * nombre suelto: esa era la fuga que llenó la base de partes sin `cliente_id`,
 * y que obliga a los cálculos por cliente a adivinar emparejando por texto.
 *
 * Los cinco campos compartían el mismo bloque copiado en cada wizard —
 * autocompletado, botón de crear, aviso de vinculado— y el emparejamiento se
 * hacía comparando el nombre EXACTO contra la lista (`find(c => c.nombre ===
 * texto)`): un espacio de más y el id quedaba nulo sin avisar. Acá la búsqueda
 * sugiere el OBJETO cliente, así que lo que se elige es el cliente, no su
 * nombre.
 */
import type { Cliente } from '~/types/cliente'
import { LinkIcon, PlusIcon } from '@lucide/vue'
import {
  agregar as agregarAlCatalogo,
  clientes as cargarClientes,
} from '~/features/clientes/services/catalogoClientes'
import NuevoClienteDialog from './NuevoClienteDialog.vue'

const props = withDefaults(
  defineProps<{
    /** El `*_id` del contrato: la única prueba de que la parte está vinculada. */
    id?: number | null
    nombre?: string | null
    nit?: string | null
    label: string
    requerido?: boolean
    disabled?: boolean
    inputId?: string
    placeholder?: string
  }>(),
  {
    id: null,
    nombre: null,
    nit: null,
    requerido: false,
    disabled: false,
    inputId: undefined,
    placeholder: 'Buscar cliente existente…',
  },
)
const emit = defineEmits<{
  'update:id': [id: number | null]
  'update:nombre': [nombre: string | null]
  'update:nit': [nit: string]
}>()

const open = ref(false)
const creando = ref(false)
const catalogo = ref<Cliente[]>([])

cargarClientes()
  .then((filas) => {
    catalogo.value = filas
  })
  .catch(() => {
    catalogo.value = []
  })

/** Lo que muestra el campo: el cliente vinculado, o el texto que quedó escrito. */
const query = computed({
  get: () => props.nombre ?? '',
  set: (valor: string) => alCambiar(valor),
})

/** El cliente vinculado, para que la lista lo marque como elegido. */
const seleccionado = computed(() => catalogo.value.find((c) => c.id === props.id) ?? null)

/** El nombre escrito que no corresponde a ningún cliente vinculado. */
const textoSuelto = computed(() => (props.id ? '' : (props.nombre ?? '').trim()))

const sugerencias = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return []
  return catalogo.value.filter((c) =>
    `${c.razon_social_nombre ?? ''} ${c.nit_cedula ?? ''}`.toLowerCase().includes(q),
  )
})

/**
 * Elegir de la lista vincula (manda el objeto); teclear libre deja la parte
 * sin `id`, que es lo que el aviso de abajo señala.
 */
function alCambiar(valor: string | Cliente) {
  if (valor && typeof valor === 'object') {
    emit('update:id', valor.id)
    emit('update:nombre', valor.razon_social_nombre ?? null)
    emit('update:nit', valor.nit_cedula ?? '')
    open.value = false
    return
  }
  emit('update:id', null)
  emit('update:nombre', valor || null)
  emit('update:nit', '')
  open.value = true
}

function abrirCreacion() {
  creando.value = true
}

function alCrear(cliente: Cliente) {
  agregarAlCatalogo(cliente)
  catalogo.value = [...catalogo.value.filter((c) => c.id !== cliente.id), cliente]
  alCambiar(cliente)
}

// Si el contrato se recarga con otra parte (abrir otro contrato en el mismo
// diálogo), la búsqueda vieja no debe quedar abierta.
watch(
  () => props.id,
  () => {
    open.value = false
  },
)
</script>

<template>
  <div class="flex flex-col gap-1">
    <GLabel :required="requerido">{{ label }}</GLabel>
    <div class="flex gap-2">
      <!-- `ignore-filter`: el filtro es `sugerencias` (por nombre y NIT, y
           vacío sin búsqueda). Sin reset del término: lo escrito es el nombre
           de la parte, no una búsqueda que se descarta al salir del campo. -->
      <Combobox
        v-model:open="open"
        :model-value="seleccionado"
        by="id"
        open-on-click
        open-on-focus
        ignore-filter
        :reset-search-term-on-blur="false"
        :reset-search-term-on-select="false"
        :disabled="disabled"
        class="flex-1"
        @update:model-value="(c) => c && alCambiar(c as Cliente)"
      >
        <ComboboxAnchor>
          <ComboboxInput :id="inputId" v-model="query" :placeholder="placeholder" />
        </ComboboxAnchor>
        <ComboboxList align="start">
          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
          <ComboboxViewport>
            <ComboboxItem v-for="c in sugerencias" :key="c.id" :value="c">
              <div class="flex flex-col">
                <span>{{ c.razon_social_nombre }}</span>
                <span v-if="c.nit_cedula" class="text-xs text-muted-foreground"
                  >NIT {{ c.nit_cedula }}</span
                >
              </div>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxList>
      </Combobox>
      <GTooltip>
        <GTooltipTrigger as-child>
          <Button variant="outline" size="icon" :disabled="disabled" @click="abrirCreacion">
            <PlusIcon class="size-4" />
          </Button>
        </GTooltipTrigger>
        <GTooltipContent>Crear nuevo cliente</GTooltipContent>
      </GTooltip>
    </div>

    <div v-if="id" class="flex items-center gap-1 text-xs text-success">
      <LinkIcon class="size-3.5" /> Cliente vinculado (id {{ id }})
    </div>
    <!-- Sin vínculo pero con texto: el caso que venía pasando en silencio. Un
         contrato guardado así nombra a alguien que el sistema no reconoce, y
         todo lo que se calcula por cliente lo deja por fuera. -->
    <div
      v-else-if="textoSuelto"
      class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warning"
    >
      <span>«{{ textoSuelto }}» no está registrado como cliente.</span>
      <button
        type="button"
        class="font-medium underline hover:text-warning/80"
        @click="abrirCreacion"
      >
        Crear este cliente
      </button>
    </div>
  </div>

  <NuevoClienteDialog v-model:visible="creando" :nombre-inicial="textoSuelto" @creado="alCrear" />
</template>
