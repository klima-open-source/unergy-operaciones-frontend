<!--
  Bitácora del negocio: gestiones + historial de etapas.

  Novedad (2026-08-19): una gestión puede colgarse de UNA oferta. Antes todas eran
  del cliente, y como la etapa vive en la oferta desde 2026-08-02, registrar la
  llamada por Margaritas 1 apagaba la alerta de Margaritas 2, que seguía muda.
  Dejar el selector en «Todo el cliente» mantiene el comportamiento viejo.
-->
<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-sm font-semibold mb-2" style="color:var(--color-unergy-deep)">Registrar gestión</h3>
      <div class="flex flex-col gap-2 mb-4">
        <div class="flex flex-wrap gap-2">
          <Select v-model="nueva.tipo" :options="TIPOS_GESTION" optionLabel="label" optionValue="value"
                  placeholder="Tipo *" class="w-44" />
          <Select v-model="nueva.oferta_id" :options="opcionesOferta" optionLabel="label"
                  optionValue="value" class="w-64" />
        </div>
        <Textarea v-model.trim="nueva.descripcion" rows="2" autoResize class="w-full"
                  placeholder="Qué se habló / acordó *" />
        <div class="flex items-center gap-2 flex-wrap">
          <Button label="Registrar" size="small" :loading="guardando" :disabled="!nueva.tipo || !nueva.descripcion" @click="registrar">
            <template #icon><SendIcon class="size-[1em]" /></template>
          </Button>
          <small style="color:#9b89b5">
            {{ nueva.oferta_id
                ? 'Apaga la alerta solo de esa oferta.'
                : 'Apaga la alerta de todas las ofertas del cliente.' }}
          </small>
        </div>
      </div>

      <h3 class="text-sm font-semibold mb-2" style="color:var(--color-unergy-deep)">Gestiones</h3>
      <p v-if="!gestiones.length" class="text-sm" style="color:#9b89b5">Sin gestiones registradas.</p>
      <ul class="flex flex-col gap-2">
        <li v-for="g in gestiones" :key="g.id" class="rounded-md p-2 text-sm"
            style="border:1px solid #e8e0f0">
          <div class="flex items-center gap-2 text-xs mb-1 flex-wrap" style="color:#9b89b5">
            <GBadge color="information" class="scale-90">{{ labelGestion(g.tipo) }}</GBadge>
            <span>{{ fmtFechaHora(g.fecha) }}</span>
            <span v-if="g.oferta_id" class="rounded px-1.5 py-0.5 text-[10px]"
                  style="background:#F4EEFB;color:var(--color-unergy-purple-dark)">{{ nombreOferta(g.oferta_id) }}</span>
            <span v-else class="rounded px-1.5 py-0.5 text-[10px]"
                  style="background:#F3F4F6;color:#4B5563">todo el cliente</span>
          </div>
          {{ g.descripcion }}
        </li>
      </ul>
    </div>

    <div>
      <h3 class="text-sm font-semibold mb-2" style="color:var(--color-unergy-deep)">Historial de etapas</h3>
      <p v-if="!historial.length" class="text-sm" style="color:#9b89b5">Sin movimientos.</p>
      <ul class="flex flex-col gap-1.5 text-sm">
        <li v-for="h in historial" :key="h.id" class="flex items-center gap-2 flex-wrap">
          <ArrowRightIcon class="text-xs size-[1em]" style="color:#c4b8d4" />
          <span v-if="h.estado_anterior">
            {{ labelEtapa(h.estado_anterior) }} → <b>{{ labelEtapa(h.estado_nuevo) }}</b>
          </span>
          <span v-else>Creada en <b>{{ labelEtapa(h.estado_nuevo) }}</b></span>
          <!-- Las filas viejas traen oferta_id NULL: son de cuando la etapa era
               del cliente. Se conservan como histórico. -->
          <span v-if="h.oferta_id" class="text-xs" style="color:#9b89b5">
            · {{ nombreOferta(h.oferta_id) }}
          </span>
          <span class="text-xs" style="color:#9b89b5">{{ fmtFechaHora(h.fecha) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { toast } from 'vue-sonner'
import { ComercialService } from '~/features/comercial/services/comercial'
import { TIPOS_GESTION, labelGestion, labelEtapa } from './comercial.js'
import { ArrowRightIcon, SendIcon } from '@lucide/vue'

const props = defineProps({
  oportunidadId: { type: [Number, String], required: true },
  gestiones: { type: Array, default: () => [] },
  historial: { type: Array, default: () => [] },
  ofertas: { type: Array, default: () => [] },
})
const emit = defineEmits(['registrada'])

const comercialService = new ComercialService()
const nueva = reactive({ tipo: null, descripcion: '', oferta_id: null })
const guardando = ref(false)

const opcionesOferta = computed(() => [
  { label: 'Todo el cliente', value: null },
  ...props.ofertas.map((o) => ({
    label: o.planta_nombre || o.codigo_seguimiento || `Oferta #${o.id}`,
    value: o.id,
  })),
])

function nombreOferta(id) {
  const o = props.ofertas.find((x) => x.id === id)
  return o ? (o.planta_nombre || o.codigo_seguimiento || `Oferta #${id}`) : `Oferta #${id}`
}

function fmtFechaHora(v) {
  return v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

async function registrar() {
  guardando.value = true
  try {
    await comercialService.registrarGestion(props.oportunidadId, {
      tipo: nueva.tipo,
      descripcion: nueva.descripcion,
      oferta_id: nueva.oferta_id,
    })
    nueva.tipo = null
    nueva.descripcion = ''
    nueva.oferta_id = null
    emit('registrada')
  } catch (err) {
    toast.error('No se pudo registrar', { description: err.data?.detail ?? '', duration: 5000 })
  } finally {
    guardando.value = false
  }
}
</script>
