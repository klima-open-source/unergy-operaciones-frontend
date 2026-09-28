<script setup lang="ts">
/**
 * Crear / editar una métrica (spec §7.1).
 * El diálogo NO llama a la API: emite `submit` con el payload del contrato y
 * la vista orquestadora hace el POST/PATCH. `guardando` viene de vuelta.
 */
import type {
  DireccionMetrica,
  MetricaReto,
  PayloadMetricaReto,
  TipoAgregacionMetrica,
} from '~/features/retos/types'
import { CheckIcon } from '@lucide/vue'
import { DIRECCIONES, fmtValor, TIPOS_AGREGACION } from './retosUi'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    /** Métrica a editar; `null` = creación. */
    metrica?: MetricaReto | null
    totalSemanas?: number
    guardando?: boolean
  }>(),
  { visible: false, metrica: null, totalSemanas: 0, guardando: false },
)

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  submit: [payload: PayloadMetricaReto]
}>()

const UNIDADES = ['MWh', 'kWh', '%', '#', 'COP', 'h']

function blanco() {
  return {
    nombre: '',
    descripcion: '',
    unidad: '',
    meta: null as number | null,
    tipo_agregacion: 'suma' as TipoAgregacionMetrica,
    direccion: 'mayor_mejor' as DireccionMetrica,
    decimales: 0,
    responsable: '',
  }
}

const f = reactive(blanco())
const tocado = ref(false)

const esEdicion = computed(() => !!props.metrica)
const nombreValido = computed(() => !!String(f.nombre || '').trim())

watch(
  () => props.visible,
  (abierto) => {
    if (!abierto) return
    tocado.value = false
    const m = props.metrica
    Object.assign(f, blanco(), {
      ...(m
        ? {
            nombre: m.nombre || '',
            descripcion: m.descripcion || '',
            unidad: m.unidad || '',
            meta: m.meta === null || m.meta === undefined ? null : Number(m.meta),
            tipo_agregacion: m.tipo_agregacion || 'suma',
            direccion: m.direccion || 'mayor_mejor',
            decimales: m.decimales ?? 0,
            responsable: m.responsable || '',
          }
        : {}),
    })
  },
  { immediate: true },
)

/**
 * Explica en prosa qué va a calcular el tablero. Se omite la parte de la meta
 * cuando no hay meta, para no inventar cifras.
 */
const vistaPrevia = computed(() => {
  const dec = Number(f.decimales) || 0
  const unidad = (f.unidad || '').trim()
  const meta = f.meta === null || f.meta === undefined ? null : Number(f.meta)
  const total = props.totalSemanas || 0

  let base: string
  switch (f.tipo_agregacion) {
    case 'promedio':
      base = 'El consolidado será el promedio de las semanas con dato.'
      break
    case 'ultimo':
      base = 'El consolidado será el valor de la última semana con dato.'
      break
    case 'maximo':
      base = 'El consolidado será el valor más alto de las semanas.'
      break
    default:
      base = `El consolidado será la suma de las ${total} semanas.`
  }

  if (meta === null || !Number.isFinite(meta)) return base

  const metaTxt = fmtValor(meta, dec, unidad)
  if (f.tipo_agregacion === 'suma' && total > 0) {
    const porSemana = fmtValor(meta / total, Math.max(dec, 1), unidad)
    return `${base} Meta ${metaTxt}, equivalente a ${porSemana} por semana.`
  }
  return `${base} Meta ${metaTxt}.`
})

function cerrar(v: boolean) {
  emit('update:visible', !!v)
}

function limpio(txt: string | null | undefined) {
  const t = String(txt ?? '').trim()
  return t === '' ? null : t
}

function enviar() {
  tocado.value = true
  if (!nombreValido.value) return
  emit('submit', {
    nombre: String(f.nombre).trim(),
    descripcion: limpio(f.descripcion),
    unidad: limpio(f.unidad),
    meta: f.meta === null || f.meta === undefined ? null : Number(f.meta),
    tipo_agregacion: f.tipo_agregacion,
    direccion: f.direccion,
    decimales: Math.min(Math.max(Number(f.decimales) || 0, 0), 4),
    responsable: limpio(f.responsable),
  })
}
</script>

<template>
  <Dialog :open="visible" @update:open="cerrar">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ esEdicion ? 'Editar métrica' : 'Nueva métrica' }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-3">
        <div class="space-y-1.5">
          <GLabel required>Nombre</GLabel>
          <Input
            v-model="f.nombre"
            :aria-invalid="tocado && !nombreValido"
            placeholder="MWh comercializados"
            autofocus
            @blur="tocado = true"
          />
          <p v-if="tocado && !nombreValido" class="text-xs text-destructive">
            El nombre es obligatorio.
          </p>
        </div>

        <div class="space-y-1.5">
          <GLabel>Descripción</GLabel>
          <Textarea
            v-model="f.descripcion"
            rows="2"
            placeholder="Opcional: cómo se mide y de dónde sale el dato"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <GLabel>Unidad</GLabel>
            <Input v-model="f.unidad" list="rq-unidades" placeholder="Sin unidad" />
            <datalist id="rq-unidades">
              <option v-for="u in UNIDADES" :key="u" :value="u" />
            </datalist>
          </div>
          <div class="space-y-1.5">
            <GLabel>Meta del trimestre</GLabel>
            <NumberField v-model="f.meta" :format-options="{ maximumFractionDigits: 4 }">
              <NumberFieldContent><NumberFieldInput placeholder="Opcional" /></NumberFieldContent>
            </NumberField>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <GLabel>Agregación</GLabel>
            <Select v-model="f.tipo_agregacion">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in TIPOS_AGREGACION" :key="t.value" :value="t.value">{{
                  t.label
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <GLabel>Dirección</GLabel>
            <ToggleGroup v-model="f.direccion" type="single" variant="outline" class="w-full">
              <ToggleGroupItem
                v-for="d in DIRECCIONES"
                :key="d.value"
                :value="d.value"
                class="flex-1 text-xs"
              >
                {{ d.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <GLabel>Decimales</GLabel>
            <NumberField v-model="f.decimales" :min="0" :max="4" class="w-28">
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
          </div>
          <div class="space-y-1.5">
            <GLabel>Responsable</GLabel>
            <Input v-model="f.responsable" placeholder="Nombre de quien reporta" />
          </div>
        </div>

        <p class="rounded-lg bg-primary/5 p-2.5 text-xs text-muted-foreground">{{ vistaPrevia }}</p>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="cerrar(false)">Cancelar</Button>
        <Button :disabled="!nombreValido || guardando" @click="enviar">
          <CheckIcon class="size-4" />
          {{ esEdicion ? 'Guardar cambios' : 'Crear métrica' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
