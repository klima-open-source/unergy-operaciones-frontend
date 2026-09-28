<script setup lang="ts">
/**
 * Copiar la definición de métricas desde otro trimestre (spec §7.2).
 * El diálogo solo elige el origen; el POST lo hace la vista orquestadora.
 */
import type { RetoResumen } from '~/features/retos/types'
import { CopyIcon } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    /** RetoResumen de los otros trimestres del año (el actual ya viene filtrado). */
    retos?: RetoResumen[]
    /** Nombres de las métricas que ya existen en el trimestre destino. */
    nombresDestino?: string[]
    guardando?: boolean
  }>(),
  { visible: false, retos: () => [], nombresDestino: () => [], guardando: false },
)

const emit = defineEmits<{ 'update:visible': [visible: boolean]; submit: [origenId: number] }>()

const origenId = ref<string | null>(null)

watch(
  () => props.visible,
  (abierto) => {
    if (abierto) origenId.value = null
  },
)

const opciones = computed(() =>
  props.retos.map((r) => {
    const n = r.total_metricas ?? (r.metricas || []).length
    return {
      id: String(r.id),
      label: `${r.nombre || `Retos Q${r.trimestre} ${r.anio}`} · ${n} ${n === 1 ? 'métrica' : 'métricas'}`,
      deshabilitada: n === 0,
    }
  }),
)

const origen = computed(() => props.retos.find((r) => String(r.id) === origenId.value) || null)

const metricasOrigen = computed(() =>
  (origen.value?.metricas || [])
    .filter((m) => m.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
)

/** Comparación laxa: el backend deduplica por nombre, acá solo se anticipa. */
const setDestino = computed(
  () =>
    new Set(
      props.nombresDestino.map((n) =>
        String(n || '')
          .trim()
          .toLowerCase(),
      ),
    ),
)

function yaExiste(nombre: string) {
  return setDestino.value.has(
    String(nombre || '')
      .trim()
      .toLowerCase(),
  )
}

const hayRepetidas = computed(() => metricasOrigen.value.some((m) => yaExiste(m.nombre)))

function onSubmit() {
  if (origenId.value) emit('submit', Number(origenId.value))
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Copiar métricas</DialogTitle>
      </DialogHeader>

      <div class="space-y-3">
        <div class="space-y-1.5">
          <GLabel>Trimestre de origen</GLabel>
          <Select v-model="origenId">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Elige el trimestre de origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="op in opciones"
                :key="op.id"
                :value="op.id"
                :disabled="op.deshabilitada"
              >
                {{ op.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="origen" class="flex flex-wrap gap-1.5">
          <GBadge
            v-for="m in metricasOrigen"
            :key="m.id"
            :class="yaExiste(m.nombre) ? 'text-muted-foreground line-through' : ''"
          >
            {{ m.nombre }}
          </GBadge>
        </div>
        <p v-if="origen && hayRepetidas" class="-mt-1 text-xs text-muted-foreground">
          Ya existe en este trimestre
        </p>

        <p class="text-xs text-muted-foreground">
          Se copian solo las métricas activas, sin los valores semanales. Las métricas con un nombre
          que ya existe aquí no se duplican.
        </p>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="emit('update:visible', false)">Cancelar</Button>
        <Button :disabled="!origenId || guardando" @click="onSubmit">
          <CopyIcon class="size-4" />
          Copiar métricas
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
