<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal
    header="Nuevo cliente" :style="{ width: '520px' }" :closable="true">
    <div class="space-y-4 py-2">
      <!-- Aviso de nombre parecido. NO es un error: es la bifurcación que evita
           que nazca el duplicado. Antes el 409 salía como texto rojo bajo el
           nombre y no había salida -- ni vincular al que ya existe, ni crear de
           todos modos -- así que la única forma de seguir era cerrar y escribir
           el nombre a mano, que es justo lo que duplica los clientes. -->
      <div v-if="duplicado" class="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
        <p class="text-sm text-amber-900">
          Ya existe un cliente con un nombre muy parecido:
          <strong>{{ duplicado.candidato_nombre }}</strong> (ID {{ duplicado.candidato_id }}).
        </p>
        <p class="text-xs text-amber-700">
          Si es el mismo, vincúlalo en vez de crear otro: dos fichas de la misma
          empresa parten sus contratos y sus cobros en dos.
        </p>
        <div class="flex gap-2">
          <Button label="Es el mismo, vincularlo" size="small" :loading="vinculando"
            @click="usarCandidato" />
          <Button label="Es otro, crear igual" size="small" outlined severity="secondary"
            :loading="guardando" @click="guardar(true)" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2 flex flex-col gap-1">
          <label class="field-label">Nombre / Razón social <span class="text-red-400">*</span></label>
          <InputText v-model="form.razon_social_nombre" class="w-full" placeholder="Ej: Terpel Energía S.A.S." />
          <p v-if="errores.nombre" class="text-xs text-red-400">{{ errores.nombre }}</p>
        </div>
        <div class="flex flex-col gap-1">
          <label class="field-label">NIT / Cédula <span class="text-red-400">*</span></label>
          <InputText v-model="form.nit_cedula" class="w-full" placeholder="Ej: 900123456-7" />
          <p v-if="errores.nit" class="text-xs text-red-400">{{ errores.nit }}</p>
        </div>
        <div class="flex flex-col gap-1">
          <label class="field-label">Tipo persona</label>
          <Select v-model="form.tipo_persona"
            :options="[{ label: 'Jurídica', value: 'juridica' }, { label: 'Natural', value: 'natural' }]"
            optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
        </div>
      </div>

      <div class="border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Documentos <span class="normal-case font-normal">(links de Google Drive)</span>
        </p>
        <div class="space-y-3">
          <div class="flex flex-col gap-1">
            <label class="field-label">RUT</label>
            <InputText v-model="rut_url" class="w-full" placeholder="https://drive.google.com/…" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Cámara de comercio</label>
            <InputText v-model="cc_url" class="w-full" placeholder="https://drive.google.com/…" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="field-label">Certificación bancaria</label>
            <InputText v-model="cert_url" class="w-full" placeholder="https://drive.google.com/…" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancelar" text severity="secondary" @click="$emit('update:visible', false)" />
      <Button label="Crear cliente" :loading="guardando" :disabled="!!duplicado" @click="guardar(false)">
        <template #icon><CheckIcon class="size-[1em]" /></template>
      </Button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { ClientesService } from '~/features/clientes/services/clientes'
import { mensajeDeError } from '~/utils/mensajeDeError'
import { CheckIcon } from '@lucide/vue'

const clientesService = new ClientesService()

const props = defineProps({
  visible: Boolean,
  /** Lo que el usuario ya escribió en el selector, para no teclearlo dos veces. */
  nombreInicial: { type: String, default: '' },
})
const emit = defineEmits(['update:visible', 'creado'])

const guardando = ref(false)
const vinculando = ref(false)
const errores = reactive({})
const duplicado = ref(null)   // { mensaje, candidato_id, candidato_nombre }
const cc_url = ref('')
const cert_url = ref('')

const form = reactive({
  razon_social_nombre: '',
  nit_cedula: '',
  tipo_persona: null,
})
const rut_url = ref('')

// El diálogo se monta una vez y se reabre muchas: sin esto conserva el nombre,
// el NIT y el aviso de duplicado de la vez anterior, y el segundo cliente nace
// con los datos del primero.
watch(() => props.visible, (abierto) => {
  if (!abierto) return
  form.razon_social_nombre = props.nombreInicial ?? ''
  form.nit_cedula = ''
  form.tipo_persona = null
  rut_url.value = ''
  cc_url.value = ''
  cert_url.value = ''
  duplicado.value = null
  errores.nombre = null
  errores.nit = null
})

/** El aviso de nombre parecido, si el error es ese. `null` para cualquier otro. */
function duplicadoDe(e) {
  const detail = e?.data?.detail ?? e?.response?.data?.detail
  return e?.status === 409 && detail?.duplicado_nombre ? detail : null
}

/** Vincula el cliente que ya existía, en vez de crear otro. */
async function usarCandidato() {
  const { candidato_id, candidato_nombre } = duplicado.value
  vinculando.value = true
  try {
    // Se pide el detalle para traer el NIT: el 409 solo manda id y nombre, y la
    // parte del contrato necesita el NIT para llenar su campo.
    const cliente = await clientesService.obtener(candidato_id)
    emit('creado', cliente)
  } catch {
    emit('creado', { id: candidato_id, razon_social_nombre: candidato_nombre })
  } finally {
    vinculando.value = false
    emit('update:visible', false)
  }
}

async function guardar(forzar) {
  errores.nombre = form.razon_social_nombre.trim() ? null : 'Campo obligatorio'
  errores.nit = form.nit_cedula.trim() ? null : 'Campo obligatorio'
  if (errores.nombre || errores.nit) return

  guardando.value = true
  try {
    const cliente = await clientesService.crear({
      razon_social_nombre: form.razon_social_nombre.trim(),
      nit_cedula: form.nit_cedula.trim(),
      tipo_persona: form.tipo_persona,
    }, forzar)

    const docs = [
      { tipo: 'rut', url: rut_url.value.trim(), nombre: 'RUT' },
      { tipo: 'camara_comercio', url: cc_url.value.trim(), nombre: 'Cámara de comercio' },
      { tipo: 'certificado_bancario', url: cert_url.value.trim(), nombre: 'Certificación bancaria' },
    ].filter(d => d.url)

    for (const d of docs) {
      await clientesService.crearDocumento(cliente.id, {
        tipo: d.tipo,
        nombre: d.nombre,
        numero: null,
        fecha: null,
        estado: 'aceptado',
        archivo_url: d.url,
        archivo_nombre: null,
        notas: null,
      })
    }

    emit('creado', cliente)
    emit('update:visible', false)
  } catch (e) {
    const aviso = duplicadoDe(e)
    if (aviso) {
      duplicado.value = aviso
      return
    }
    // El motivo real: la validacion por campo de DRF no viene en `detail`, y el
    // aviso de nombre parecido lo manda como objeto -- asignado tal cual, el
    // campo mostraba "[object Object]".
    errores.nombre = mensajeDeError(e, 'No se pudo crear el cliente.')
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
/* MIGRACIÓN — Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y no
   ve el tema, así que `@apply` falla con "unknown utility class". `@reference`
   le da acceso al tema sin emitir CSS. Era innecesario en Tailwind 3. */
@reference 'tailwindcss';
.field-label { @apply block text-xs font-medium text-gray-600 mb-1; }
</style>
