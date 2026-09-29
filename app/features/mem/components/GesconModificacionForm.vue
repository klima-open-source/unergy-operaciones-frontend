<!--
  Registro asistido de una MODIFICACIÓN GESCON.

  Una modificación no es un contrato nuevo: es otra versión del mismo código
  SIC. Lo único que puede cambiar es la fecha de fin, la planta inscrita, su %
  de despacho y su modalidad de suministro. Todo lo demás (contrato interno,
  nombre interno, SIC vendedor/comprador, prioridad, tipo de mercado, % FNCER,
  cédulas, contacto, PPA) lo hereda el backend de la versión vigente del SIC
  — por eso este formulario no lo pide.

  La fecha de entrada es la que manda: la modificación no surte efecto antes de
  ese día (se guarda como fecha_inicio y el resolutor de vigencias recorta la
  versión anterior al día previo).
-->
<script setup lang="ts">
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import type { PayloadAsicModificacion, RespuestaAsicOperacion } from '~/features/contratos/types'
import type { RegistroAsicVigencia } from '~/features/mem/utils/gesconVigencia'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import { ArrowRightLeftIcon, CheckIcon, InfoIcon, LoaderCircleIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Imports explícitos: mismo problema de tipos que `blocks/DataTable`.
import ComboBox from '~/components/blocks/ComboBox.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { PpaService } from '~/features/contratos/services/ppa'
import {
  fmtFecha as fmt,
  modalidadTexto,
  opcionesSicVigentes,
  pctTexto,
  plantasInscritas,
} from '~/features/mem/utils/gesconVigencia'

const ppaService = new PpaService()

const props = withDefaults(
  defineProps<{
    rows?: RegistroAsicVigencia[]
    proyectos?: ProyectoConDetalle[]
    estado?: string
  }>(),
  { rows: () => [], proyectos: () => [], estado: 'publicado' },
)
const emit = defineEmits<{ guardado: [data: RespuestaAsicOperacion]; cancelar: [] }>()

type Modalidad = 'normal' | 'duplicado' | 'uso_recurso'
const MODALIDADES: { label: string; value: Modalidad }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Compra en bolsa', value: 'duplicado' },
  { label: 'Uso del recurso', value: 'uso_recurso' },
]

const codigoSic = ref<string | null>(null)
const proyectoSalienteId = ref<number | null>(null)
const fechaEntrada = ref<string | null>(null)
const requerimiento = ref('')
const fechaFin = ref<string | null>(null)
const proyectoId = ref<number | null>(null)
const porcentajeDespacho = ref<number | null>(null)
const modalidad = ref<Modalidad>('normal')
const fechaSolicitud = ref<string | null>(null)
const linkArchivo = ref('')
const observaciones = ref('')
const guardando = ref(false)
const errores = ref<Record<string, string>>({})

const opcionesSic = computed(() => opcionesSicVigentes(props.rows))
const opcionesSicCombo = computed<ComboBoxOption[]>(() =>
  opcionesSic.value.map((o) => ({
    value: o.sic,
    label: `${o.sic} — ${o.contrato_interno || '(sin contrato)'} · ${o.plantas}`,
  })),
)

// Plantas inscritas en el SIC a la fecha de entrada (ver gesconVigencia.ts:
// hay que descartar por fecha o una planta que ya salió reaparece inscrita).
const inscritas = computed(() => plantasInscritas(props.rows, codigoSic.value, fechaEntrada.value))

const proyectosOptions = computed<ComboBoxOption[]>(() =>
  props.proyectos.map((p) => ({ value: String(p.id), label: p.nombre_comercial })),
)

// Fila base: la versión que esta modificación releva.
const baseContrato = computed<RegistroAsicVigencia>(() => {
  if (inscritas.value.length === 1) return inscritas.value[0]!
  return inscritas.value.find((r) => r.proyecto_id === proyectoSalienteId.value) || {}
})

// Al elegir contrato (o cambiar de planta saliente) se precargan los valores
// actuales: así el usuario solo toca lo que de verdad cambia.
watch(baseContrato, (base) => {
  if (!base?.id) return
  fechaFin.value = (base.fecha_fin_efectiva || base.fecha_fin) ?? null
  proyectoId.value = typeof base.proyecto_id === 'number' ? base.proyecto_id : null
  porcentajeDespacho.value =
    base.porcentaje_despacho != null ? Number((base.porcentaje_despacho * 100).toFixed(2)) : null
  modalidad.value = base.uso_del_recurso
    ? 'uso_recurso'
    : base.es_duplicado
      ? 'duplicado'
      : 'normal'
})

watch(codigoSic, () => {
  errores.value = {}
  const unica = inscritas.value.length === 1 ? inscritas.value[0] : undefined
  proyectoSalienteId.value = typeof unica?.proyecto_id === 'number' ? unica.proyecto_id : null
})

// La modalidad describe a la planta, no al contrato: al entrar otra planta se
// arranca en Normal salvo que el usuario diga lo contrario (igual que el backend).
watch(proyectoId, (nuevo, previo) => {
  if (previo == null || nuevo === previo || !baseContrato.value?.id) return
  if (nuevo !== baseContrato.value.proyecto_id) modalidad.value = 'normal'
})

function etiquetaModalidad(v: Modalidad): string {
  return MODALIDADES.find((m) => m.value === v)?.label || v
}
function nombrePlanta(id: number | null): string {
  return props.proyectos.find((p) => p.id === id)?.nombre_comercial || 'la planta nueva'
}

const resumen = computed(() => {
  const base = baseContrato.value
  if (!base?.id || !fechaEntrada.value) return ''
  const cambios: string[] = []
  if (proyectoId.value !== base.proyecto_id) {
    cambios.push(
      `sale ${base.planta_nombre || 'la planta actual'} y entra ${nombrePlanta(proyectoId.value)}`,
    )
  }
  const pctBase =
    base.porcentaje_despacho != null ? Number((base.porcentaje_despacho * 100).toFixed(2)) : null
  if (porcentajeDespacho.value !== pctBase) {
    cambios.push(
      `despacho ${pctBase != null ? `${pctBase}%` : '—'} → ${porcentajeDespacho.value != null ? `${porcentajeDespacho.value}%` : '—'}`,
    )
  }
  const finBase = base.fecha_fin_efectiva || base.fecha_fin
  if (fechaFin.value !== finBase) {
    cambios.push(`fin ${fmt(finBase)} → ${fmt(fechaFin.value)}`)
  }
  const modBase: Modalidad = base.uso_del_recurso
    ? 'uso_recurso'
    : base.es_duplicado
      ? 'duplicado'
      : 'normal'
  if (modalidad.value !== modBase) {
    cambios.push(`modalidad ${etiquetaModalidad(modBase)} → ${etiquetaModalidad(modalidad.value)}`)
  }
  if (!cambios.length) return `Desde el ${fmt(fechaEntrada.value)}: sin cambios todavía.`
  return `Desde el ${fmt(fechaEntrada.value)}: ${cambios.join('; ')}.`
})

async function guardar() {
  errores.value = {}
  if (!codigoSic.value) errores.value.codigoSic = 'Elige el contrato a modificar'
  if (!fechaEntrada.value) errores.value.fechaEntrada = 'Requerido'
  if (!requerimiento.value.trim()) errores.value.requerimiento = 'Requerido'
  else if (
    baseContrato.value?.requerimiento_asic &&
    requerimiento.value.trim() === String(baseContrato.value.requerimiento_asic).trim()
  )
    errores.value.requerimiento = 'Debe ser distinto al de la versión vigente'
  if (inscritas.value.length > 1 && proyectoSalienteId.value == null)
    errores.value.proyectoSalienteId = 'Indica cuál planta modifica esta solicitud'
  if (Object.keys(errores.value).length) return

  guardando.value = true
  try {
    const payload: PayloadAsicModificacion = {
      // Ya validado arriba (errores.codigoSic): siempre hay un valor en este punto.
      codigo_sic_contrato: codigoSic.value!,
      fecha_entrada: fechaEntrada.value,
      requerimiento_asic: requerimiento.value.trim(),
      fecha_fin: fechaFin.value,
      proyecto_id: proyectoId.value,
      // El backend guarda el despacho como fracción 0-1; el form lo edita 0-100.
      porcentaje_despacho:
        porcentajeDespacho.value != null
          ? Number((porcentajeDespacho.value / 100).toFixed(4))
          : null,
      modalidad: modalidad.value,
      proyecto_saliente_id: inscritas.value.length > 1 ? proyectoSalienteId.value : null,
      estado_solicitud: props.estado || 'publicado',
      fecha_solicitud: fechaSolicitud.value,
      link_archivo: linkArchivo.value || null,
      observaciones: observaciones.value || null,
    }
    const data = await ppaService.crearModificacionAsic(payload)
    toast.success('Modificación registrada', { description: data.resumen, duration: 6000 })
    emit('guardado', data)
  } catch (err) {
    toast.error('No se pudo registrar la modificación', {
      description: normalizeError(err).message,
      duration: 8000,
    })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <form class="space-y-5 pt-1" @submit.prevent="guardar">
    <!-- 1 · Contrato a modificar -->
    <div class="flex flex-col gap-1.5">
      <GLabel
        >Contrato a modificar
        <span class="font-normal text-muted-foreground"
          >— por código SIC; de aquí se hereda todo lo demás</span
        ></GLabel
      >
      <ComboBox
        v-model="codigoSic"
        :options="opcionesSicCombo"
        placeholder="Buscar por SIC, contrato o planta…"
      />
      <p v-if="errores.codigoSic" class="text-xs text-destructive">{{ errores.codigoSic }}</p>
    </div>

    <!-- Estado actual del contrato (solo lectura: es lo que se hereda) -->
    <div v-if="inscritas.length" class="space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5">
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span
          ><b class="text-foreground">{{ baseContrato.contrato_interno || '—' }}</b> ·
          {{ baseContrato.nombre_interno || 'sin nombre interno' }}</span
        >
      </div>
      <table class="w-full text-xs">
        <thead>
          <tr class="text-muted-foreground">
            <th class="py-1 text-left font-medium">Planta inscrita</th>
            <th class="py-1 text-right font-medium">Despacho</th>
            <th class="py-1 pl-3 text-left font-medium">Fin</th>
            <th class="py-1 text-left font-medium">Modalidad</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in inscritas" :key="r.id ?? undefined" class="border-t">
            <td
              class="py-1"
              :class="
                r.id === baseContrato.id ? 'font-semibold text-foreground' : 'text-muted-foreground'
              "
            >
              {{ r.planta_nombre || 'sin planta' }}
              <span
                v-if="inscritas.length > 1 && r.id === baseContrato.id"
                class="text-xs font-normal text-primary"
                >— la que se modifica</span
              >
            </td>
            <td class="py-1 text-right text-muted-foreground">
              {{ r.porcentaje_despacho != null ? pctTexto(r.porcentaje_despacho) : '—' }}
            </td>
            <td class="py-1 pl-3 text-muted-foreground">
              {{ fmt(r.fecha_fin_efectiva || r.fecha_fin) }}
            </td>
            <td class="py-1 text-muted-foreground">{{ modalidadTexto(r) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cuál planta sale, si el SIC tiene varias a la vez -->
    <div v-if="inscritas.length > 1" class="flex flex-col gap-1.5">
      <GLabel required class="inline-flex items-center gap-1.5">
        Planta que modifica esta solicitud
        <GTooltip>
          <GTooltipTrigger as-child
            ><InfoIcon class="size-3.5 cursor-help text-muted-foreground"
          /></GTooltipTrigger>
          <GTooltipContent
            >Este SIC tiene varias plantas inscritas a la vez. Las demás siguen intactas: solo se
            releva la que elijas aquí.</GTooltipContent
          >
        </GTooltip>
      </GLabel>
      <Select
        :model-value="proyectoSalienteId != null ? String(proyectoSalienteId) : undefined"
        @update:model-value="(v) => (proyectoSalienteId = v ? Number(v) : null)"
      >
        <SelectTrigger class="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="r in inscritas"
            :key="String(r.proyecto_id)"
            :value="String(r.proyecto_id)"
            >{{ r.planta_nombre }}</SelectItem
          >
        </SelectContent>
      </Select>
      <p v-if="errores.proyectoSalienteId" class="text-xs text-destructive">
        {{ errores.proyectoSalienteId }}
      </p>
    </div>

    <!-- 2 · Cuándo entra en vigencia + requerimiento nuevo -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <GLabel required>Entra en vigencia el</GLabel>
        <DatePicker v-model="fechaEntrada" clearable />
        <p v-if="errores.fechaEntrada" class="text-xs text-destructive">
          {{ errores.fechaEntrada }}
        </p>
        <p v-else class="text-xs text-muted-foreground">Antes de ese día no cambia nada.</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <GLabel required>N° Requerimiento ASIC</GLabel>
        <Input v-model="requerimiento" placeholder="20260819007" />
        <p v-if="errores.requerimiento" class="text-xs text-destructive">
          {{ errores.requerimiento }}
        </p>
        <p v-else class="text-xs text-muted-foreground">Nuevo: el código SIC sí se conserva.</p>
      </div>
    </div>

    <!-- 3 · Lo único modificable -->
    <div class="space-y-4 rounded-lg border px-3 py-3">
      <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Qué cambia</p>

      <div class="grid grid-cols-3 gap-4">
        <div class="flex flex-col gap-1.5">
          <GLabel>Nueva fecha de fin</GLabel>
          <DatePicker v-model="fechaFin" clearable :disabled="!codigoSic" />
        </div>
        <div class="flex flex-col gap-1.5">
          <GLabel>Planta inscrita</GLabel>
          <ComboBox
            :model-value="proyectoId != null ? String(proyectoId) : null"
            :options="proyectosOptions"
            placeholder="Seleccionar"
            :disabled="!codigoSic"
            @update:model-value="(v) => (proyectoId = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <GLabel>% Despacho</GLabel>
          <div class="flex items-center gap-2">
            <NumberField
              v-model="porcentajeDespacho"
              :min="0"
              :max="100"
              class="flex-1"
              :disabled="!codigoSic"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
            <span class="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <GLabel class="inline-flex items-center gap-1.5">
          Modalidad de suministro de la planta
          <GTooltip>
            <GTooltipTrigger as-child
              ><InfoIcon class="size-3.5 cursor-help text-muted-foreground"
            /></GTooltipTrigger>
            <GTooltipContent
              >Normal: suministro propio de la planta. Compra en bolsa: la planta ya está
              comprometida en otro contrato; su aporte aquí se cubre comprando en bolsa (genera
              garantías). Uso del recurso: el cliente está en bolsa y se le paga su generación a
              precio bolsa (sin garantías).</GTooltipContent
            >
          </GTooltip>
        </GLabel>
        <ToggleGroup v-model="modalidad" type="single" variant="outline" :disabled="!codigoSic">
          <ToggleGroupItem v-for="op in MODALIDADES" :key="op.value" :value="op.value">{{
            op.label
          }}</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>

    <!-- 4 · Resumen de lo que va a pasar -->
    <div
      v-if="resumen"
      class="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground"
    >
      <ArrowRightLeftIcon class="mt-0.5 size-3 text-primary" />
      <span>{{ resumen }}</span>
    </div>

    <!-- 5 · Lo opcional, plegado -->
    <details class="text-xs">
      <summary class="cursor-pointer text-primary select-none">
        Datos de la radicación (opcional)
      </summary>
      <div class="space-y-4 pt-3">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <GLabel>Fecha de solicitud</GLabel>
            <DatePicker v-model="fechaSolicitud" clearable />
          </div>
          <div class="flex flex-col gap-1.5">
            <GLabel>Link archivo</GLabel>
            <Input v-model="linkArchivo" placeholder="https://..." />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <GLabel>Observaciones</GLabel>
          <Textarea v-model="observaciones" rows="2" />
        </div>
      </div>
    </details>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" @click="emit('cancelar')">Cancelar</Button>
      <Button type="submit" :disabled="guardando">
        <LoaderCircleIcon v-if="guardando" class="animate-spin" />
        <CheckIcon v-else />
        Registrar modificación
      </Button>
    </div>
  </form>
</template>
