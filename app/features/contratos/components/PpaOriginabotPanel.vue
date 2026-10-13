<script setup lang="ts">
/**
 * La unión del PPA con originabot (TSF), en la pestaña de plantas.
 *
 * Operaciones crea y configura el PPA; cada cambio de plantas se lleva a
 * originabot desde el backend (`apps/ppa/services/originabot_sync.py`) con el
 * token de Unergy Auth de quien lo hizo. Aquí se ve si llegó y, si no, se
 * reintenta. Un PPA sin vínculo se crea allá con su primera planta (si su
 * comprador tiene off taker), o se vincula a mano a uno que ya existe.
 */
import { LinkIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { PpaService } from '~/features/contratos/services/ppa'
import type {
  ContratoPpa,
  OpcionesOriginabot,
  PayloadSyncOriginabot,
} from '~/features/contratos/types'

const props = defineProps<{ contrato: ContratoPpa }>()
const emit = defineEmits<{ actualizado: [contrato: ContratoPpa] }>()

const servicio = new PpaService()

const ESTADOS = {
  sincronizado: { label: 'Sincronizado', color: 'success' },
  pendiente: { label: 'Pendiente', color: 'warning' },
  error: { label: 'Error', color: 'destructive' },
} as const

const estado = computed(() => {
  const e = props.contrato.originabot_sync_estado
  if (e) return ESTADOS[e]
  return props.contrato.originabot_ppa_id
    ? ESTADOS.sincronizado
    : { label: 'Sin vínculo', color: 'default' as const }
})

const vinculado = computed(() => !!props.contrato.originabot_ppa_id)

const sincronizando = ref(false)
const opciones = ref<OpcionesOriginabot | null>(null)
const cargandoOpciones = ref(false)
const ppaElegido = ref<string | null>(null)
const offTakerElegido = ref<string | null>(null)

const opcionesPpa = computed(() =>
  (opciones.value?.ppas ?? [])
    // Uno ya vinculado a otro contrato no se ofrece: dos se pisarían las minigranjas.
    .filter((p) => p.contrato_id === null || p.contrato_id === props.contrato.id)
    .map((p) => ({ value: String(p.id), label: `${p.nombre} · ${p.minigranjas} minigranjas` })),
)
const opcionesOfftaker = computed(() =>
  (opciones.value?.offtakers ?? []).map((o) => ({ value: String(o.id), label: o.nombre })),
)

async function cargarOpciones() {
  cargandoOpciones.value = true
  try {
    opciones.value = await servicio.opcionesOriginabot()
  } catch (e) {
    toast.error('No se pudo leer originabot', { description: normalizeError(e).message })
  } finally {
    cargandoOpciones.value = false
  }
}

async function sincronizar(payload: PayloadSyncOriginabot = {}) {
  sincronizando.value = true
  try {
    const contrato = await servicio.sincronizarOriginabot(props.contrato.id, payload)
    emit('actualizado', contrato)
    if (contrato.originabot_sync_estado === 'sincronizado') {
      toast.success('PPA sincronizado con originabot')
      opciones.value = null
    } else {
      toast.warning('originabot no quedó al día', {
        description: contrato.originabot_sync_detalle ?? undefined,
      })
    }
  } catch (e) {
    toast.error('Error', { description: normalizeError(e).message })
  } finally {
    sincronizando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-bold tracking-wide text-foreground uppercase">originabot</span>
      <GBadge :color="estado.color" class="text-xs">{{ estado.label }}</GBadge>
      <span class="text-xs text-muted-foreground">
        {{ vinculado ? `PPA #${contrato.originabot_ppa_id} en originabot` : 'Aún no existe en originabot' }}
      </span>
      <div class="ml-auto flex items-center gap-1.5">
        <Button
          v-if="!vinculado && !opciones"
          variant="outline"
          size="sm"
          :disabled="cargandoOpciones"
          @click="cargarOpciones"
        >
          <LoaderCircleIcon v-if="cargandoOpciones" class="size-4 animate-spin" />
          <LinkIcon v-else class="size-4" />
          Vincular o crear
        </Button>
        <Button
          v-if="vinculado || contrato.originabot_sync_estado"
          variant="outline"
          size="sm"
          :disabled="sincronizando"
          @click="sincronizar()"
        >
          <RefreshCwIcon class="size-4" :class="sincronizando ? 'animate-spin' : undefined" />
          Sincronizar
        </Button>
      </div>
    </div>

    <p v-if="contrato.originabot_sync_detalle" class="text-xs text-muted-foreground">
      {{ contrato.originabot_sync_detalle }}
    </p>

    <div v-if="!vinculado && opciones" class="grid gap-3 border-t border-border pt-2.5 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <GLabel>Vincular a un PPA que ya existe allá</GLabel>
        <ComboBox v-model="ppaElegido" :options="opcionesPpa" placeholder="PPA de originabot…" />
        <p class="text-xs text-muted-foreground">Solo se le agregan las plantas de este contrato.</p>
        <Button
          size="sm"
          variant="outline"
          :disabled="!ppaElegido || sincronizando"
          @click="sincronizar({ originabot_ppa_id: Number(ppaElegido) })"
        >
          <LinkIcon class="size-4" /> Vincular
        </Button>
      </div>
      <div class="flex flex-col gap-1.5">
        <GLabel>O crearlo en originabot</GLabel>
        <ComboBox v-model="offTakerElegido" :options="opcionesOfftaker" placeholder="Off taker (comprador)…" />
        <p class="text-xs text-muted-foreground">originabot lo exige; queda guardado en el comprador.</p>
        <Button
          size="sm"
          :disabled="!offTakerElegido || sincronizando"
          @click="sincronizar({ off_taker_id: Number(offTakerElegido) })"
        >
          <PlusIcon class="size-4" /> Crear en originabot
        </Button>
      </div>
    </div>
  </div>
</template>
