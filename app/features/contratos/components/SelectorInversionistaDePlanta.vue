<script setup lang="ts">
/**
 * El inversionista de un contrato de representación: uno de los inversionistas
 * de la planta.
 *
 * Desde la rama de inversionistas (2026-10-13) el contrato no guarda un cliente
 * cualquiera: apunta a la participación de ese inversionista en la planta, y la
 * API rechaza con 400 a un cliente que no participe en ella. Por eso aquí solo se
 * ofrecen los inversionistas registrados en la ficha del proyecto, y si la planta
 * no tiene ninguno se dice dónde cargarlos.
 */
import { ExternalLinkIcon } from '@lucide/vue'
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import ComboBox from '~/components/blocks/ComboBox.vue'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import type { InversionistaProyecto } from '~/features/proyectos/types'

const props = withDefaults(
  defineProps<{
    /** La planta del contrato. Sin ella no hay a quién ofrecer. */
    proyectoId?: number | null
    /** El cliente del inversionista (`inversionista_id` del contrato). */
    id?: number | null
    label?: string
    requerido?: boolean
    disabled?: boolean
  }>(),
  { proyectoId: null, id: null, label: 'Inversionista', requerido: false, disabled: false },
)
const emit = defineEmits<{
  'update:id': [id: number | null]
  'update:nombre': [nombre: string | null]
}>()

const proyectosService = new ProyectosService()
const inversionistas = ref<InversionistaProyecto[]>([])
const cargando = ref(false)

const opciones = computed<ComboBoxOption[]>(() =>
  inversionistas.value.map((inv) => ({
    value: String(inv.cliente_id),
    label: inv.cliente_nombre || `Cliente ${inv.cliente_id}`,
  })),
)

const valor = computed({
  get: () => (props.id != null ? String(props.id) : null),
  set: (v: string | null) => {
    const elegido = inversionistas.value.find((inv) => String(inv.cliente_id) === v)
    emit('update:id', elegido ? Number(elegido.cliente_id) : null)
    emit('update:nombre', elegido?.cliente_nombre ?? null)
  },
})

/** El inversionista guardado que no está entre los de la planta (dato viejo). */
const fueraDeLaPlanta = computed(
  () => props.id != null && !cargando.value && props.proyectoId != null
    && !inversionistas.value.some((inv) => inv.cliente_id === props.id),
)

async function cargar(proyectoId: number | null, alCambiarPlanta: boolean) {
  if (proyectoId == null) {
    inversionistas.value = []
    if (alCambiarPlanta && props.id != null) valor.value = null
    return
  }
  cargando.value = true
  try {
    inversionistas.value = await proyectosService.listarInversionistas(proyectoId)
  } catch {
    inversionistas.value = []
  } finally {
    cargando.value = false
  }
  // Otra planta: el inversionista anterior solo se conserva si también está aquí.
  // Si la planta tiene uno solo, es ese (la misma regla que aplica el backend).
  if (alCambiarPlanta) {
    const sigue = inversionistas.value.some((inv) => inv.cliente_id === props.id)
    if (!sigue) {
      const unico = inversionistas.value.length === 1 ? inversionistas.value[0] : null
      valor.value = unico ? String(unico.cliente_id) : null
    }
  }
}

watch(() => props.proyectoId, (nuevo, anterior) => cargar(nuevo ?? null, anterior !== undefined), {
  immediate: true,
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <GLabel :required="requerido">{{ label }}</GLabel>
    <ComboBox
      v-model="valor"
      :options="opciones"
      :disabled="disabled || proyectoId == null || cargando"
      :placeholder="proyectoId == null ? 'Escoge primero la planta' : 'Inversionista de la planta…'"
      empty-message="Sin coincidencias."
    />
    <p v-if="proyectoId == null" class="text-xs text-muted-foreground leading-snug">
      El inversionista es uno de los inversionistas de la planta: escógela primero.
    </p>
    <p
      v-else-if="!cargando && !inversionistas.length"
      class="text-xs text-warning leading-snug"
    >
      Esta planta no tiene inversionistas registrados.
      <NuxtLink :to="`/proyectos/${proyectoId}`" target="_blank" class="inline-flex items-center gap-0.5 underline">
        Cárgalos en la ficha del proyecto <ExternalLinkIcon class="size-3" />
      </NuxtLink>
    </p>
    <p v-else-if="fueraDeLaPlanta" class="text-xs text-warning leading-snug">
      El inversionista guardado no está entre los de esta planta: escoge uno de la lista.
    </p>
  </div>
</template>
