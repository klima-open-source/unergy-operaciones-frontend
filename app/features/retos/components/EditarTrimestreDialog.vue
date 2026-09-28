<script setup lang="ts">
/**
 * Editar nombre, descripción y rango del trimestre (spec §7.3).
 * El PATCH lo hace la vista orquestadora; acá solo se arma el payload y se
 * muestran `guardando` y el `detail` del backend bajo el campo que lo provocó.
 */
import type { PayloadEditarTrimestre, Reto } from '~/features/retos/types'
import { CheckIcon, TriangleAlertIcon } from '@lucide/vue'
import DatePicker from '~/components/blocks/DatePicker.vue'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    reto?: Reto | null
    guardando?: boolean
    /** `detail` del backend tras un 400/409, ya normalizado a texto. */
    errorApi?: string
  }>(),
  { visible: false, reto: null, guardando: false, errorApi: '' },
)

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  submit: [payload: PayloadEditarTrimestre]
}>()

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const f = reactive<{
  nombre: string
  descripcion: string
  fechaInicio: string | null
  fechaFin: string | null
}>({
  nombre: '',
  descripcion: '',
  fechaInicio: null,
  fechaFin: null,
})

/**
 * `new Date('2026-07-01')` se interpreta como UTC y en Colombia cae el 30 de
 * junio. Por eso se parsea siempre por componentes, en local — nunca con el
 * constructor de `Date` sobre el string ISO completo.
 */
function isoADateLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [a, m, d] = String(iso).split('-').map(Number)
  if (!a || !m || !d) return null
  return new Date(a, m - 1, d)
}

watch(
  () => props.visible,
  (abierto) => {
    if (!abierto || !props.reto) return
    Object.assign(f, {
      nombre: props.reto.nombre || '',
      descripcion: props.reto.descripcion || '',
      fechaInicio: props.reto.fecha_inicio,
      fechaFin: props.reto.fecha_fin,
    })
  },
  { immediate: true },
)

/** Misma generación de semanas del contrato §3, para la vista previa. */
function semanasDe(inicio: Date, fin: Date) {
  const out: { numero: number; inicio: Date; fin: Date }[] = []
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)) // lunes de esa semana
  let numero = 1
  while (cursor <= fin && numero <= 60) {
    const finSemana = new Date(cursor)
    finSemana.setDate(finSemana.getDate() + 6)
    out.push({ numero, inicio: new Date(cursor), fin: finSemana })
    cursor.setDate(cursor.getDate() + 7)
    numero += 1
  }
  return out
}

const semanas = computed(() => {
  const inicio = isoADateLocal(f.fechaInicio)
  const fin = isoADateLocal(f.fechaFin)
  if (!inicio || !fin || fin <= inicio) return []
  return semanasDe(inicio, fin)
})

function fechaLarga(d: Date) {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

const vistaPrevia = computed(() => {
  const s = semanas.value
  if (!s.length) return ''
  const primera = s[0]!
  const ultima = s[s.length - 1]!
  return (
    `${s.length} ${s.length === 1 ? 'semana' : 'semanas'}. La S1 empieza el ${fechaLarga(primera.inicio)}` +
    ` y la S${ultima.numero} termina el ${fechaLarga(ultima.fin)}.`
  )
})

/** Se anticipan los dos 400 del contrato para no gastar un viaje al servidor. */
const errorLocal = computed(() => {
  const inicio = isoADateLocal(f.fechaInicio)
  const fin = isoADateLocal(f.fechaFin)
  if (!inicio || !fin) return ''
  if (fin <= inicio) return 'La fecha de fin debe ser posterior a la de inicio'
  if (semanas.value.length >= 60) return 'El rango no puede superar 60 semanas'
  return ''
})

const errorMostrado = computed(() => errorLocal.value || props.errorApi || '')

/** El detail cae bajo el campo que lo provocó; los dos del contrato hablan del fin. */
const esErrorDeInicio = computed(() => {
  const t = errorMostrado.value.toLowerCase()
  return t.includes('inicio') && !t.includes('fin')
})

const errorInicio = computed(() => (esErrorDeInicio.value ? errorMostrado.value : ''))
const errorFin = computed(() => (esErrorDeInicio.value ? '' : errorMostrado.value))

const fechasCambiaron = computed(() => {
  if (!props.reto) return false
  return f.fechaInicio !== props.reto.fecha_inicio || f.fechaFin !== props.reto.fecha_fin
})

const avisoValores = computed(
  () => fechasCambiaron.value && (props.reto?.semanas_con_datos ?? 0) > 0,
)

function limpio(txt: string | null | undefined) {
  const t = String(txt ?? '').trim()
  return t === '' ? null : t
}

function enviar() {
  if (errorLocal.value) return
  emit('submit', {
    nombre: limpio(f.nombre),
    descripcion: limpio(f.descripcion),
    fecha_inicio: f.fechaInicio,
    fecha_fin: f.fechaFin,
  })
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar trimestre</DialogTitle>
      </DialogHeader>

      <div class="space-y-3">
        <div class="space-y-1.5">
          <GLabel>Nombre</GLabel>
          <Input v-model="f.nombre" placeholder="Retos Q3 2026" />
        </div>

        <div class="space-y-1.5">
          <GLabel>Descripción</GLabel>
          <Textarea
            v-model="f.descripcion"
            rows="2"
            placeholder="Opcional: en qué se enfoca el trimestre"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <GLabel>Inicio</GLabel>
            <DatePicker v-model="f.fechaInicio" />
            <p v-if="errorInicio" class="text-xs text-destructive">{{ errorInicio }}</p>
          </div>
          <div class="space-y-1.5">
            <GLabel>Fin</GLabel>
            <DatePicker v-model="f.fechaFin" />
            <p v-if="errorFin" class="text-xs text-destructive">{{ errorFin }}</p>
          </div>
        </div>

        <p v-if="vistaPrevia" class="rounded-lg bg-primary/5 p-2.5 text-xs text-muted-foreground">
          {{ vistaPrevia }}
        </p>

        <Alert v-if="avisoValores">
          <TriangleAlertIcon class="text-warning" />
          <AlertDescription>
            Los valores que queden fuera del nuevo rango dejan de mostrarse. No se borran: vuelven a
            aparecer si restauras las fechas.
          </AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="emit('update:visible', false)">Cancelar</Button>
        <Button
          :disabled="guardando || !!errorLocal || !f.fechaInicio || !f.fechaFin"
          @click="enviar"
        >
          <CheckIcon class="size-4" />
          Guardar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
