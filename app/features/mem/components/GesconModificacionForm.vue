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
<template>
  <form @submit.prevent="guardar" class="space-y-5 pt-1">

    <!-- 1 · Contrato a modificar -->
    <div class="flex flex-col gap-1">
      <label class="text-xs font-medium" style="color:#6b5a8a;">
        Contrato a modificar <span style="color:#9b89b5;">— por código SIC; de aquí se hereda todo lo demás</span>
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

    <!-- Estado actual del contrato (solo lectura: es lo que se hereda) -->
    <div v-if="inscritas.length" class="rounded-lg px-3 py-2.5 space-y-2"
      style="background:#FAF8FD; border:1px solid #ECE4F5;">
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs" style="color:#6b5a8a;">
        <span><b style="color:var(--color-unergy-deep);">{{ baseContrato.contrato_interno || '—' }}</b> · {{ baseContrato.nombre_interno || 'sin nombre interno' }}</span>
        <span v-if="baseContrato.codigo_sic_comprador">Comprador {{ baseContrato.codigo_sic_comprador }}</span>
        <span v-if="baseContrato.prioridad_limitacion != null">P.S {{ baseContrato.prioridad_limitacion }}</span>
      </div>
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr style="color:#9b89b5;">
            <th class="text-left font-medium py-1">Planta inscrita</th>
            <th class="text-right font-medium py-1 w-20">Despacho</th>
            <th class="text-left font-medium py-1 w-28 pl-3">Fin</th>
            <th class="text-left font-medium py-1 w-32">Modalidad</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in inscritas" :key="r.id" class="border-t" style="border-color:#ECE4F5;">
            <td class="py-1" :style="{ color: r.id === baseContrato.id ? 'var(--color-unergy-deep)' : '#9b89b5', fontWeight: r.id === baseContrato.id ? 600 : 400 }">
              {{ r.planta_nombre || 'sin planta' }}
              <span v-if="inscritas.length > 1 && r.id === baseContrato.id" class="text-[10px] font-normal" style="color:var(--color-unergy-purple);">— la que se modifica</span>
            </td>
            <td class="py-1 text-right" style="color:#6b5a8a;">{{ r.porcentaje_despacho != null ? pctTexto(r.porcentaje_despacho) : '—' }}</td>
            <td class="py-1 pl-3" style="color:#6b5a8a;">{{ fmt(r.fecha_fin_efectiva || r.fecha_fin) }}</td>
            <td class="py-1" style="color:#6b5a8a;">{{ modalidadTexto(r) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cuál planta sale, si el SIC tiene varias a la vez -->
    <div v-if="inscritas.length > 1" class="flex flex-col gap-1">
      <label class="text-xs font-medium" style="color:#6b5a8a;">
        Planta que modifica esta solicitud *
        <InfoIcon class="text-xs cursor-help size-[1em]" style="color:#9b89b5;" v-tooltip.top="'Este SIC tiene varias plantas inscritas a la vez. Las demás siguen intactas: solo se releva la que elijas aquí.'" />
      </label>
      <Select v-model="proyectoSalienteId" :options="inscritas" optionValue="proyecto_id"
        optionLabel="planta_nombre" placeholder="Seleccionar" class="w-full"
        :class="{ 'p-invalid': errores.proyectoSalienteId }" />
      <small v-if="errores.proyectoSalienteId" class="text-red-500 text-xs">{{ errores.proyectoSalienteId }}</small>
    </div>

    <!-- 2 · Cuándo entra en vigencia + requerimiento nuevo -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a;">Entra en vigencia el *</label>
        <DatePicker v-model="fechaEntrada" dateFormat="dd/mm/yy" placeholder="dd/mm/aa" showIcon class="w-full"
          :class="{ 'p-invalid': errores.fechaEntrada }" />
        <small v-if="errores.fechaEntrada" class="text-red-500 text-xs">{{ errores.fechaEntrada }}</small>
        <small v-else class="text-xs" style="color:#9b8ab5;">Antes de ese día no cambia nada.</small>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a;">N° Requerimiento ASIC *</label>
        <InputText v-model="requerimiento" placeholder="20260819007" class="w-full"
          :class="{ 'p-invalid': errores.requerimiento }" />
        <small v-if="errores.requerimiento" class="text-red-500 text-xs">{{ errores.requerimiento }}</small>
        <small v-else class="text-xs" style="color:#9b8ab5;">Nuevo: el código SIC sí se conserva.</small>
      </div>
    </div>

    <!-- 3 · Lo único modificable -->
    <div class="rounded-lg px-3 py-3 space-y-4" style="border:1px solid #ECE4F5;">
      <p class="text-[11px] font-semibold uppercase tracking-wide" style="color:#9b89b5;">Qué cambia</p>

      <div class="grid grid-cols-3 gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Nueva fecha de fin</label>
          <DatePicker v-model="fechaFin" dateFormat="dd/mm/yy" placeholder="dd/mm/aa" showIcon class="w-full"
            :disabled="!codigoSic" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Planta inscrita</label>
          <Select v-model="proyectoId" :options="proyectos" optionLabel="nombre_comercial" optionValue="id"
            placeholder="Seleccionar" filter class="w-full" :disabled="!codigoSic" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">% Despacho</label>
          <InputNumber v-model="porcentajeDespacho" :min="0" :max="100" :minFractionDigits="0"
            :maxFractionDigits="2" suffix="%" locale="en-US" class="w-full" inputClass="w-full"
            :disabled="!codigoSic" />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Modalidad de suministro de la planta</label>
          <InfoIcon class="text-xs cursor-help size-[1em]" style="color:#9b89b5;" v-tooltip.top="'Normal: suministro propio de la planta. Compra en bolsa: la planta ya está comprometida en otro contrato; su aporte aquí se cubre comprando en bolsa (genera garantías). Uso del recurso: el cliente está en bolsa y se le paga su generación a precio bolsa (sin garantías).'" />
        </div>
        <SelectButton v-model="modalidad" :options="MODALIDADES" optionLabel="label" optionValue="value"
          :allowEmpty="false" :disabled="!codigoSic"
          :pt="{ button: { style: 'font-size:12px; padding:5px 12px;' } }" />
      </div>
    </div>

    <!-- 4 · Resumen de lo que va a pasar -->
    <div v-if="resumen" class="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
      style="background:#F3EEFB; border:1px solid #DCCFF2; color:#4A3570;">
      <ArrowRightLeftIcon class="mt-0.5 size-[1em]" />
      <span>{{ resumen }}</span>
    </div>

    <!-- 5 · Lo opcional, plegado -->
    <details class="text-xs">
      <summary class="cursor-pointer select-none" style="color:var(--color-unergy-purple);">Datos de la radicación (opcional)</summary>
      <div class="pt-3 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Fecha de solicitud</label>
            <DatePicker v-model="fechaSolicitud" dateFormat="dd/mm/yy" placeholder="hoy" showIcon class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium" style="color:#6b5a8a;">Link archivo</label>
            <InputText v-model="linkArchivo" placeholder="https://..." class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium" style="color:#6b5a8a;">Observaciones</label>
          <Textarea v-model="observaciones" rows="2" class="w-full" autoResize />
        </div>
      </div>
    </details>

    <div class="flex justify-end gap-2 pt-2">
      <Button label="Cancelar" severity="secondary" type="button" @click="$emit('cancelar')" />
      <Button label="Registrar modificación" type="submit" :loading="guardando" style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);">
        <template #icon><CheckIcon class="size-[1em]" /></template>
      </Button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { PpaService } from '~/features/contratos/services/ppa'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { toast } from 'vue-sonner'
import { ArrowRightLeftIcon, CheckIcon, InfoIcon } from '@lucide/vue'
import {
  opcionesSicVigentes, plantasInscritas,
  toIso, parseIso, fmtFecha as fmt, pctTexto, modalidadTexto,
} from './gesconVigencia.js'

const ppaService = new PpaService()

const props = defineProps({
  rows: { type: Array, default: () => [] },
  proyectos: { type: Array, default: () => [] },
  estado: { type: String, default: 'publicado' },
})
const emit = defineEmits(['guardado', 'cancelar'])

const MODALIDADES = [
  { label: 'Normal', value: 'normal' },
  { label: 'Compra en bolsa', value: 'duplicado' },
  { label: 'Uso del recurso', value: 'uso_recurso' },
]

const codigoSic = ref(null)
const proyectoSalienteId = ref(null)
const fechaEntrada = ref(null)
const requerimiento = ref('')
const fechaFin = ref(null)
const proyectoId = ref(null)
const porcentajeDespacho = ref(null)
const modalidad = ref('normal')
const fechaSolicitud = ref(null)
const linkArchivo = ref('')
const observaciones = ref('')
const guardando = ref(false)
const errores = ref({})

const opcionesSic = computed(() => opcionesSicVigentes(props.rows))

// Plantas inscritas en el SIC a la fecha de entrada (ver gesconVigencia.js:
// hay que descartar por fecha o una planta que ya salió reaparece inscrita).
const inscritas = computed(() =>
  plantasInscritas(props.rows, codigoSic.value, toIso(fechaEntrada.value)))

// Fila base: la versión que esta modificación releva.
const baseContrato = computed(() => {
  if (inscritas.value.length === 1) return inscritas.value[0]
  return inscritas.value.find(r => r.proyecto_id === proyectoSalienteId.value) || {}
})

// Al elegir contrato (o cambiar de planta saliente) se precargan los valores
// actuales: así el usuario solo toca lo que de verdad cambia.
watch(baseContrato, base => {
  if (!base?.id) return
  fechaFin.value = parseIso(base.fecha_fin_efectiva || base.fecha_fin)
  proyectoId.value = base.proyecto_id ?? null
  porcentajeDespacho.value = base.porcentaje_despacho != null
    ? Number((base.porcentaje_despacho * 100).toFixed(2)) : null
  modalidad.value = base.uso_del_recurso ? 'uso_recurso' : base.es_duplicado ? 'duplicado' : 'normal'
})

watch(codigoSic, () => {
  errores.value = {}
  proyectoSalienteId.value = inscritas.value.length === 1 ? inscritas.value[0].proyecto_id : null
})

// La modalidad describe a la planta, no al contrato: al entrar otra planta se
// arranca en Normal salvo que el usuario diga lo contrario (igual que el backend).
watch(proyectoId, (nuevo, previo) => {
  if (previo == null || nuevo === previo || !baseContrato.value?.id) return
  if (nuevo !== baseContrato.value.proyecto_id) modalidad.value = 'normal'
})

const resumen = computed(() => {
  const base = baseContrato.value
  if (!base?.id || !fechaEntrada.value) return ''
  const cambios = []
  if (proyectoId.value !== base.proyecto_id) {
    cambios.push(`sale ${base.planta_nombre || 'la planta actual'} y entra ${nombrePlanta(proyectoId.value)}`)
  }
  const pctBase = base.porcentaje_despacho != null ? Number((base.porcentaje_despacho * 100).toFixed(2)) : null
  if (porcentajeDespacho.value !== pctBase) {
    cambios.push(`despacho ${pctBase != null ? pctBase + '%' : '—'} → ${porcentajeDespacho.value != null ? porcentajeDespacho.value + '%' : '—'}`)
  }
  const finBase = base.fecha_fin_efectiva || base.fecha_fin
  if (toIso(fechaFin.value) !== finBase) {
    cambios.push(`fin ${fmt(finBase)} → ${fmt(toIso(fechaFin.value))}`)
  }
  const modBase = base.uso_del_recurso ? 'uso_recurso' : base.es_duplicado ? 'duplicado' : 'normal'
  if (modalidad.value !== modBase) {
    cambios.push(`modalidad ${etiquetaModalidad(modBase)} → ${etiquetaModalidad(modalidad.value)}`)
  }
  if (!cambios.length) return `Desde el ${fmt(toIso(fechaEntrada.value))}: sin cambios todavía.`
  return `Desde el ${fmt(toIso(fechaEntrada.value))}: ${cambios.join('; ')}.`
})

async function guardar() {
  errores.value = {}
  if (!codigoSic.value) errores.value.codigoSic = 'Elige el contrato a modificar'
  if (!fechaEntrada.value) errores.value.fechaEntrada = 'Requerido'
  if (!requerimiento.value.trim()) errores.value.requerimiento = 'Requerido'
  else if (baseContrato.value?.requerimiento_asic
    && requerimiento.value.trim() === String(baseContrato.value.requerimiento_asic).trim())
    errores.value.requerimiento = 'Debe ser distinto al de la versión vigente'
  if (inscritas.value.length > 1 && !proyectoSalienteId.value)
    errores.value.proyectoSalienteId = 'Indica cuál planta modifica esta solicitud'
  if (Object.keys(errores.value).length) return

  guardando.value = true
  try {
    const payload = {
      codigo_sic_contrato: codigoSic.value,
      fecha_entrada: toIso(fechaEntrada.value),
      requerimiento_asic: requerimiento.value.trim(),
      fecha_fin: toIso(fechaFin.value),
      proyecto_id: proyectoId.value,
      // El backend guarda el despacho como fracción 0-1; el form lo edita 0-100.
      porcentaje_despacho: porcentajeDespacho.value != null
        ? Number((porcentajeDespacho.value / 100).toFixed(4)) : null,
      modalidad: modalidad.value,
      proyecto_saliente_id: inscritas.value.length > 1 ? proyectoSalienteId.value : null,
      estado_solicitud: props.estado || 'publicado',
      fecha_solicitud: toIso(fechaSolicitud.value),
      link_archivo: linkArchivo.value || null,
      observaciones: observaciones.value || null,
    }
    const data = await ppaService.crearModificacionAsic(payload)
    toast.success('Modificación registrada', { description: data.resumen, duration: 6000 })
    emit('guardado', data)
  } catch (e) {
    toast.error('No se pudo registrar la modificación', {
      description: e.data?.detail || e.message,
      duration: 8000,
    })
  } finally {
    guardando.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function etiquetaModalidad(v) { return MODALIDADES.find(m => m.value === v)?.label || v }
function nombrePlanta(id) {
  return props.proyectos.find(p => p.id === id)?.nombre_comercial || 'la planta nueva'
}
</script>
