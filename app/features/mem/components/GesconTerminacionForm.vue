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
<template>
  <form @submit.prevent="guardar" class="space-y-5 pt-1">

    <div class="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
      style="background:#FFF7ED; border:1px solid #FED7AA; color:#9A3412;">
      <InfoIcon class="mt-0.5 size-[1em]" />
      <span>Al publicar, los registros de este código SIC dejarán de aportar energía en
        Cumplimiento después de la fecha indicada. El histórico previo se conserva.</span>
    </div>

    <!-- 1 · Contrato a terminar -->
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium" style="color:#6b5a8a;">
        Contrato a terminar <span style="color:#9b89b5;">— por código SIC; de aquí se hereda la identidad</span>
      </label>
      <Select v-model="codigoSic" :options="opcionesSic" optionValue="sic" optionLabel="_label"
        filter showClear placeholder="Buscar por SIC, contrato o planta…" class="w-full"
        :class="{ 'p-invalid': errores.codigoSic }">
        <template #option="{ option }">
          <div class="flex flex-col leading-tight py-0.5">
            <span class="font-medium" style="color:var(--color-unergy-deep);">
              <span class="font-mono" style="color:#5b3fa6;">{{ option.sic }}</span>
              · {{ option.contrato_interno || '(sin contrato)' }}
            </span>
            <span class="text-xs" style="color:#6b5a8a;">{{ option.plantas }}</span>
          </div>
        </template>
      </Select>
      <small v-if="errores.codigoSic" class="text-red-500 text-xs">{{ errores.codigoSic }}</small>
    </div>

    <!-- Qué se hereda y qué se va a cerrar -->
    <div v-if="inscritas.length" class="rounded-lg px-3 py-2.5 space-y-2"
      style="background:#FAF8FD; border:1px solid #ECE4F5;">
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs" style="color:#6b5a8a;">
        <span><b style="color:var(--color-unergy-deep);">{{ identidad.contrato_interno || '—' }}</b> · {{ identidad.nombre_interno || 'sin nombre interno' }}</span>
        <span v-if="identidad.codigo_sic_comprador">Comprador {{ identidad.codigo_sic_comprador }}</span>
        <span v-if="identidad.prioridad_limitacion != null">P.S {{ identidad.prioridad_limitacion }}</span>
      </div>
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr style="color:#9b89b5;">
            <th class="text-left font-medium py-1">Planta que se cierra</th>
            <th class="text-left font-medium py-1 w-28">Fin actual</th>
            <th class="text-left font-medium py-1 w-28">Queda en</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in inscritas" :key="r.id" class="border-t" style="border-color:#ECE4F5;">
            <td class="py-1" style="color:var(--color-unergy-deep);">{{ r.planta_nombre || 'sin planta' }}</td>
            <td class="py-1" style="color:#6b5a8a;">{{ fmt(r.fecha_fin_efectiva || r.fecha_fin) }}</td>
            <td class="py-1" :style="{ color: seRecorta(r) ? 'var(--color-unergy-purple)' : '#9b89b5' }">
              {{ seRecorta(r) ? fmt(toIso(fechaTerminacion)) : 'sin cambio' }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="inscritas.length && !algoSeCierra && fechaTerminacion" class="text-[11px]" style="color:#9a6700;">
        Ningún registro se recorta: todos terminan antes de esa fecha.
      </p>
    </div>

    <!-- 2 · Fecha y requerimiento -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha de terminación *</label>
        <DatePicker v-model="fechaTerminacion" dateFormat="dd/mm/yy" placeholder="dd/mm/aa" showIcon class="w-full"
          :class="{ 'p-invalid': errores.fechaTerminacion }" />
        <small v-if="errores.fechaTerminacion" class="text-red-500 text-xs">{{ errores.fechaTerminacion }}</small>
        <small v-else class="text-xs" style="color:#9b8ab5;">Último día de vigencia del contrato.</small>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a;">N° Requerimiento ASIC</label>
        <InputText v-model="requerimiento" placeholder="20260419002" class="w-full"
          :class="{ 'p-invalid': errores.requerimiento }" />
        <small v-if="errores.requerimiento" class="text-red-500 text-xs">{{ errores.requerimiento }}</small>
        <small v-else class="text-xs" style="color:#9b8ab5;">El SIC se conserva; el requerimiento es propio.</small>
      </div>
    </div>

    <!-- 3 · Cédulas de los agentes (lo que XM exige) -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a;">Cédula agente vendedor</label>
        <InputText v-model="cedulaVendedor" placeholder="1037625350" class="w-full" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a;">Cédula agente comprador</label>
        <InputText v-model="cedulaComprador" placeholder="1107047209" class="w-full" />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium" style="color:#6b5a8a;">Link archivo</label>
      <InputText v-model="linkArchivo" placeholder="https://..." class="w-full" />
    </div>

    <!-- 4 · Resumen -->
    <div v-if="resumen" class="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
      style="background:#F3EEFB; border:1px solid #DCCFF2; color:#4A3570;">
      <FlagIcon class="mt-0.5 size-[1em]" />
      <span>{{ resumen }}</span>
    </div>

    <details class="text-xs">
      <summary class="cursor-pointer select-none" style="color:var(--color-unergy-purple);">Datos de la radicación (opcional)</summary>
      <div class="pt-3 space-y-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha de solicitud</label>
          <DatePicker v-model="fechaSolicitud" dateFormat="dd/mm/yy" placeholder="hoy" showIcon class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Observaciones</label>
          <Textarea v-model="observaciones" rows="2" class="w-full" autoResize />
        </div>
      </div>
    </details>

    <div class="flex justify-end gap-2 pt-2">
      <Button label="Cancelar" severity="secondary" type="button" @click="$emit('cancelar')" />
      <Button label="Registrar terminación" type="submit" :loading="guardando" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
        <template #icon><CheckIcon class="size-[1em]" /></template>
      </Button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { PpaService } from '~/features/contratos/services/ppa'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { toast } from 'vue-sonner'
import { CheckIcon, FlagIcon, InfoIcon } from '@lucide/vue'
import {
  opcionesSicVigentes, plantasInscritas, filaIdentidad,
  toIso, fmtFecha as fmt,
} from './gesconVigencia.js'

const ppaService = new PpaService()

const props = defineProps({
  rows: { type: Array, default: () => [] },
  estado: { type: String, default: 'publicado' },
})
const emit = defineEmits(['guardado', 'cancelar'])

const codigoSic = ref(null)
const fechaTerminacion = ref(null)
const requerimiento = ref('')
const cedulaVendedor = ref('')
const cedulaComprador = ref('')
const linkArchivo = ref('')
const fechaSolicitud = ref(null)
const observaciones = ref('')
const guardando = ref(false)
const errores = ref({})

const opcionesSic = computed(() => opcionesSicVigentes(props.rows))

// Sin filtrar por la fecha de terminación: aquí interesa ver TODAS las plantas
// inscritas hoy, incluso las que ya terminan antes (se listan como "sin cambio").
const inscritas = computed(() => plantasInscritas(props.rows, codigoSic.value))
const identidad = computed(() => filaIdentidad(inscritas.value))

function seRecorta(r) {
  const corte = toIso(fechaTerminacion.value)
  if (!corte) return false
  const fin = r.fecha_fin_efectiva || r.fecha_fin
  return !fin || fin > corte
}
const algoSeCierra = computed(() => inscritas.value.some(seRecorta))

// Las cédulas suelen ser las mismas del registro: se precargan y quedan editables.
watch(identidad, base => {
  if (!base?.id) return
  cedulaVendedor.value = base.cedula_agente_vendedor || ''
  cedulaComprador.value = base.cedula_agente_comprador || ''
})

watch(codigoSic, () => { errores.value = {} })

const resumen = computed(() => {
  if (!identidad.value?.id || !fechaTerminacion.value) return ''
  const etiqueta = identidad.value.contrato_interno || identidad.value.nombre_interno || `SIC ${codigoSic.value}`
  const cierran = inscritas.value.filter(seRecorta)
  const detalle = cierran.length
    ? `se cierra la vigencia de ${cierran.length} registro(s): ${cierran.map(r => r.planta_nombre || 'sin planta').join(', ')}`
    : 'ningún registro se recorta (todos terminan antes)'
  return `${etiqueta} (SIC ${codigoSic.value}) termina el ${fmt(toIso(fechaTerminacion.value))}; ${detalle}.`
})

async function guardar() {
  errores.value = {}
  if (!codigoSic.value) errores.value.codigoSic = 'Elige el contrato a terminar'
  if (!fechaTerminacion.value) errores.value.fechaTerminacion = 'Requerido'
  if (requerimiento.value.trim() && identidad.value?.requerimiento_asic
    && requerimiento.value.trim() === String(identidad.value.requerimiento_asic).trim())
    errores.value.requerimiento = 'Debe ser distinto al del registro vigente'
  if (Object.keys(errores.value).length) return

  guardando.value = true
  try {
    const payload = {
      codigo_sic_contrato: codigoSic.value,
      fecha_terminacion: toIso(fechaTerminacion.value),
      requerimiento_asic: requerimiento.value.trim() || null,
      cedula_agente_vendedor: cedulaVendedor.value || null,
      cedula_agente_comprador: cedulaComprador.value || null,
      estado_solicitud: props.estado || 'publicado',
      fecha_solicitud: toIso(fechaSolicitud.value),
      link_archivo: linkArchivo.value || null,
      observaciones: observaciones.value || null,
    }
    const data = await ppaService.crearTerminacionAsic(payload)
    toast.success('Terminación registrada', { description: data.resumen, duration: 6000 })
    emit('guardado', data)
  } catch (e) {
    toast.error('No se pudo registrar la terminación', {
      description: e.data?.detail || e.message,
      duration: 8000,
    })
  } finally {
    guardando.value = false
  }
}
</script>
