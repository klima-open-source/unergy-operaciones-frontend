<!--
  Registro asistido de una TERMINACIÓN GESCON.

  Misma dinámica que la modificación: se elige el código SIC y la identidad del
  contrato (contrato interno, nombre interno, SIC vendedor/comprador, prioridad,
  PPA) se hereda en el backend en vez de pedirse — antes no se guardaba nada de
  eso y las terminaciones salían en blanco en la tabla y en el Excel.

  Lo que NO se hereda es la planta: una terminación se guarda sin proyecto_id a
  propósito. Con planta, Cumplimiento borra la planta del mes de la terminación
  en vez de prorratearla hasta la fecha. La planta se muestra derivándola del
  SIC (display-only).
-->
<script setup lang="ts">
import type { ComboBoxOption } from '~/components/blocks/ComboBox.vue'
import type { PayloadAsicTerminacion, RespuestaAsicOperacion } from '~/features/contratos/types'
import type { RegistroAsicVigencia } from '~/features/mem/utils/gesconVigencia'
import { CheckIcon, FlagIcon, InfoIcon, LoaderCircleIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Imports explícitos: mismo problema de tipos que `blocks/DataTable`.
import ComboBox from '~/components/blocks/ComboBox.vue'
import DatePicker from '~/components/blocks/DatePicker.vue'
import { normalizeError } from '~/core/errors'
import { PpaService } from '~/features/contratos/services/ppa'
import {
  filaIdentidad,
  fmtFecha as fmt,
  opcionesSicVigentes,
  plantasInscritas,
} from '~/features/mem/utils/gesconVigencia'

const ppaService = new PpaService()

const props = withDefaults(defineProps<{ rows?: RegistroAsicVigencia[]; estado?: string }>(), {
  rows: () => [],
  estado: 'publicado',
})
const emit = defineEmits<{ guardado: [data: RespuestaAsicOperacion]; cancelar: [] }>()

const codigoSic = ref<string | null>(null)
const fechaTerminacion = ref<string | null>(null)
const requerimiento = ref('')
const cedulaVendedor = ref('')
const cedulaComprador = ref('')
const linkArchivo = ref('')
const fechaSolicitud = ref<string | null>(null)
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

// Sin filtrar por la fecha de terminación: aquí interesa ver TODAS las plantas
// inscritas hoy, incluso las que ya terminan antes (se listan como "sin cambio").
const inscritas = computed(() => plantasInscritas(props.rows, codigoSic.value))
const identidad = computed(() => filaIdentidad(inscritas.value))

function seRecorta(r: RegistroAsicVigencia): boolean {
  const corte = fechaTerminacion.value
  if (!corte) return false
  const fin = r.fecha_fin_efectiva || r.fecha_fin
  return !fin || fin > corte
}
const algoSeCierra = computed(() => inscritas.value.some(seRecorta))

// Las cédulas suelen ser las mismas del registro: se precargan y quedan editables.
watch(identidad, (base) => {
  if (!base?.id) return
  cedulaVendedor.value = base.cedula_agente_vendedor || ''
  cedulaComprador.value = base.cedula_agente_comprador || ''
})

watch(codigoSic, () => {
  errores.value = {}
})

const resumen = computed(() => {
  if (!identidad.value?.id || !fechaTerminacion.value) return ''
  const etiqueta =
    identidad.value.contrato_interno || identidad.value.nombre_interno || `SIC ${codigoSic.value}`
  const cierran = inscritas.value.filter(seRecorta)
  const detalle = cierran.length
    ? `se cierra la vigencia de ${cierran.length} registro(s): ${cierran.map((r) => r.planta_nombre || 'sin planta').join(', ')}`
    : 'ningún registro se recorta (todos terminan antes)'
  return `${etiqueta} (SIC ${codigoSic.value}) termina el ${fmt(fechaTerminacion.value)}; ${detalle}.`
})

async function guardar() {
  errores.value = {}
  if (!codigoSic.value) errores.value.codigoSic = 'Elige el contrato a terminar'
  if (!fechaTerminacion.value) errores.value.fechaTerminacion = 'Requerido'
  if (
    requerimiento.value.trim() &&
    identidad.value?.requerimiento_asic &&
    requerimiento.value.trim() === String(identidad.value.requerimiento_asic).trim()
  )
    errores.value.requerimiento = 'Debe ser distinto al del registro vigente'
  if (Object.keys(errores.value).length) return

  guardando.value = true
  try {
    const payload: PayloadAsicTerminacion = {
      // Ya validado arriba (errores.codigoSic): siempre hay un valor en este punto.
      codigo_sic_contrato: codigoSic.value!,
      fecha_terminacion: fechaTerminacion.value,
      requerimiento_asic: requerimiento.value.trim() || null,
      cedula_agente_vendedor: cedulaVendedor.value || null,
      cedula_agente_comprador: cedulaComprador.value || null,
      estado_solicitud: props.estado || 'publicado',
      fecha_solicitud: fechaSolicitud.value,
      link_archivo: linkArchivo.value || null,
      observaciones: observaciones.value || null,
    }
    const data = await ppaService.crearTerminacionAsic(payload)
    toast.success('Terminación registrada', { description: data.resumen, duration: 6000 })
    emit('guardado', data)
  } catch (err) {
    toast.error('No se pudo registrar la terminación', {
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
    <div
      class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-foreground"
    >
      <InfoIcon class="mt-0.5 size-3 text-warning" />
      <span
        >Al publicar, los registros de este código SIC dejarán de aportar energía en Cumplimiento
        después de la fecha indicada. El histórico previo se conserva.</span
      >
    </div>

    <!-- 1 · Contrato a terminar -->
    <div class="flex flex-col gap-1.5">
      <GLabel
        >Contrato a terminar
        <span class="font-normal text-muted-foreground"
          >— por código SIC; de aquí se hereda la identidad</span
        ></GLabel
      >
      <ComboBox
        v-model="codigoSic"
        :options="opcionesSicCombo"
        placeholder="Buscar por SIC, contrato o planta…"
      />
      <p v-if="errores.codigoSic" class="text-xs text-destructive">{{ errores.codigoSic }}</p>
    </div>

    <!-- Qué se hereda y qué se va a cerrar -->
    <div v-if="inscritas.length" class="space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5">
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span
          ><b class="text-foreground">{{ identidad.contrato_interno || '—' }}</b> ·
          {{ identidad.nombre_interno || 'sin nombre interno' }}</span
        >
      </div>
      <table class="w-full text-xs">
        <thead>
          <tr class="text-muted-foreground">
            <th class="py-1 text-left font-medium">Planta que se cierra</th>
            <th class="py-1 text-left font-medium">Fin actual</th>
            <th class="py-1 text-left font-medium">Queda en</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in inscritas" :key="r.id ?? undefined" class="border-t">
            <td class="py-1 text-foreground">{{ r.planta_nombre || 'sin planta' }}</td>
            <td class="py-1 text-muted-foreground">
              {{ fmt(r.fecha_fin_efectiva || r.fecha_fin) }}
            </td>
            <td class="py-1" :class="seRecorta(r) ? 'text-primary' : 'text-muted-foreground'">
              {{ seRecorta(r) ? fmt(fechaTerminacion) : 'sin cambio' }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="inscritas.length && !algoSeCierra && fechaTerminacion" class="text-xs text-warning">
        Ningún registro se recorta: todos terminan antes de esa fecha.
      </p>
    </div>

    <!-- 2 · Fecha y requerimiento -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <GLabel required>Fecha de terminación</GLabel>
        <DatePicker v-model="fechaTerminacion" clearable />
        <p v-if="errores.fechaTerminacion" class="text-xs text-destructive">
          {{ errores.fechaTerminacion }}
        </p>
        <p v-else class="text-xs text-muted-foreground">Último día de vigencia del contrato.</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <GLabel>N° Requerimiento ASIC</GLabel>
        <Input v-model="requerimiento" placeholder="20260419002" />
        <p v-if="errores.requerimiento" class="text-xs text-destructive">
          {{ errores.requerimiento }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          El SIC se conserva; el requerimiento es propio.
        </p>
      </div>
    </div>

    <!-- 3 · Cédulas de los agentes (lo que XM exige) -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1.5">
        <GLabel>Cédula agente vendedor</GLabel>
        <Input v-model="cedulaVendedor" placeholder="1037625350" />
      </div>
      <div class="flex flex-col gap-1.5">
        <GLabel>Cédula agente comprador</GLabel>
        <Input v-model="cedulaComprador" placeholder="1107047209" />
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <GLabel>Link archivo</GLabel>
      <Input v-model="linkArchivo" placeholder="https://..." />
    </div>

    <!-- 4 · Resumen -->
    <div
      v-if="resumen"
      class="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground"
    >
      <FlagIcon class="mt-0.5 size-3 text-primary" />
      <span>{{ resumen }}</span>
    </div>

    <details class="text-xs">
      <summary class="cursor-pointer text-primary select-none">
        Datos de la radicación (opcional)
      </summary>
      <div class="space-y-4 pt-3">
        <div class="flex flex-col gap-1.5">
          <GLabel>Fecha de solicitud</GLabel>
          <DatePicker v-model="fechaSolicitud" clearable />
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
        Registrar terminación
      </Button>
    </div>
  </form>
</template>
