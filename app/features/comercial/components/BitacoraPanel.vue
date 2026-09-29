<!--
  Bitácora del negocio: gestiones + historial de etapas.

  Novedad (2026-08-19): una gestión puede colgarse de UNA oferta. Antes todas eran
  del cliente, y como la etapa vive en la oferta desde 2026-08-02, registrar la
  llamada por Margaritas 1 apagaba la alerta de Margaritas 2, que seguía muda.
  Dejar el selector en «Todo el cliente» mantiene el comportamiento viejo.
-->
<script setup lang="ts">
import type { GestionComercial, HistorialEtapaOferta, Oferta } from '~/features/comercial/types'
import { ArrowRightIcon, LoaderCircleIcon, SendIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { readDetail } from '~/core/errors'
import { ComercialService } from '~/features/comercial/services/comercial'
import { labelEtapa, labelGestion, TIPOS_GESTION } from './comercial'

const props = withDefaults(
  defineProps<{
    oportunidadId: number
    gestiones?: GestionComercial[]
    historial?: HistorialEtapaOferta[]
    ofertas?: Oferta[]
  }>(),
  { gestiones: () => [], historial: () => [], ofertas: () => [] },
)
const emit = defineEmits<{ registrada: [] }>()

const comercialService = new ComercialService()
// «Saliente» por defecto: la mayoria de las entradas las escribe el comercial
// despues de haber escrito el. Lo importante es que la ENTRANTE se marque, que
// es la que apaga la alerta.
const DIRECCIONES = [
  { label: 'Escribimos', value: 'saliente' },
  { label: 'Nos respondió', value: 'entrante' },
]

const nueva = reactive({
  tipo: null as string | null,
  descripcion: '',
  oferta_id: null as number | null,
  direccion: 'saliente',
})
const guardando = ref(false)

const opcionesOferta = computed(() => [
  { label: 'Todo el cliente', value: '' },
  ...props.ofertas.map((o) => ({
    label: o.planta_nombre || o.codigo_seguimiento || `Oferta #${o.id}`,
    value: String(o.id),
  })),
])

function nombreOferta(id: number): string {
  const o = props.ofertas.find((x) => x.id === id)
  return o ? o.planta_nombre || o.codigo_seguimiento || `Oferta #${id}` : `Oferta #${id}`
}

function fmtFechaHora(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

async function registrar() {
  if (!nueva.tipo || !nueva.descripcion) return
  guardando.value = true
  try {
    await comercialService.registrarGestion(props.oportunidadId, {
      tipo: nueva.tipo,
      descripcion: nueva.descripcion,
      direccion: nueva.direccion,
      oferta_id: nueva.oferta_id,
    })
    nueva.tipo = null
    nueva.descripcion = ''
    nueva.oferta_id = null
    nueva.direccion = 'saliente'
    emit('registrada')
  } catch (err) {
    const e = err as { data?: unknown }
    toast.error('No se pudo registrar', { description: readDetail(e.data) ?? '' })
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="mb-2 text-sm font-semibold text-foreground">Registrar gestión</h3>
      <div class="mb-4 flex flex-col gap-2">
        <div class="flex flex-wrap gap-2">
          <Select
            :model-value="nueva.tipo ?? undefined"
            @update:model-value="(v) => (nueva.tipo = v as string)"
          >
            <SelectTrigger class="w-44"><SelectValue placeholder="Tipo *" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in TIPOS_GESTION" :key="t.value" :value="t.value">{{
                t.label
              }}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="nueva.oferta_id !== null ? String(nueva.oferta_id) : ''"
            @update:model-value="(v) => (nueva.oferta_id = v ? Number(v) : null)"
          >
            <SelectTrigger class="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in opcionesOferta" :key="o.value" :value="o.value">{{
                o.label
              }}</SelectItem>
            </SelectContent>
          </Select>
          <!--
            Quien hablo. Es obligatorio y no es burocracia: de este campo depende
            que la alerta cuente "hace cuanto que no nos responden" y no "hace
            cuanto que no pasa nada". Sin el, insistirle al cliente reinicia el
            contador aunque siga mudo.
          -->
          <ToggleGroup v-model="nueva.direccion" type="single" variant="outline">
            <ToggleGroupItem v-for="d in DIRECCIONES" :key="d.value" :value="d.value">
              {{ d.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Textarea
          v-model.trim="nueva.descripcion"
          rows="2"
          class="w-full"
          placeholder="Qué se habló / acordó *"
        />
        <div class="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            :disabled="!nueva.tipo || !nueva.descripcion || !nueva.direccion || guardando"
            @click="registrar"
          >
            <LoaderCircleIcon v-if="guardando" class="animate-spin" />
            <SendIcon v-else class="size-4" />
            Registrar
          </Button>
          <small class="text-muted-foreground">
            {{
              nueva.oferta_id
                ? 'Apaga la alerta solo de esa oferta.'
                : 'Apaga la alerta de todas las ofertas del cliente.'
            }}
          </small>
        </div>
      </div>

      <h3 class="mb-2 text-sm font-semibold text-foreground">Gestiones</h3>
      <p v-if="!gestiones.length" class="text-sm text-muted-foreground">
        Sin gestiones registradas.
      </p>
      <ul class="flex flex-col gap-2">
        <li v-for="g in gestiones" :key="g.id" class="rounded-md border p-2 text-sm">
          <div class="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <GBadge color="information" class="scale-90">{{ labelGestion(g.tipo) }}</GBadge>
            <span>{{ fmtFechaHora(g.fecha) }}</span>
            <span
              v-if="g.oferta_id"
              class="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              >{{ nombreOferta(g.oferta_id) }}</span
            >
            <span v-else class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >todo el cliente</span
            >
          </div>
          {{ g.descripcion }}
        </li>
      </ul>
    </div>

    <div>
      <h3 class="mb-2 text-sm font-semibold text-foreground">Historial de etapas</h3>
      <p v-if="!historial.length" class="text-sm text-muted-foreground">Sin movimientos.</p>
      <ul class="flex flex-col gap-1.5 text-sm">
        <li v-for="h in historial" :key="h.id" class="flex flex-wrap items-center gap-2">
          <ArrowRightIcon class="size-3.5 text-muted-foreground" />
          <span v-if="h.estado_anterior">
            {{ labelEtapa(h.estado_anterior) }} → <b>{{ labelEtapa(h.estado_nuevo) }}</b>
          </span>
          <span v-else
            >Creada en <b>{{ labelEtapa(h.estado_nuevo) }}</b></span
          >
          <!-- Las filas viejas traen oferta_id NULL: son de cuando la etapa era
               del cliente. Se conservan como histórico. -->
          <span v-if="h.oferta_id" class="text-xs text-muted-foreground">
            · {{ nombreOferta(h.oferta_id) }}
          </span>
          <span class="text-xs text-muted-foreground">{{ fmtFechaHora(h.fecha) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
