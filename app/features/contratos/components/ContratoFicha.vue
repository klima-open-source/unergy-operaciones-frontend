<script setup lang="ts">
/**
 * `/contratos/{id}`: la ficha de cualquier contrato. Fase 2 de la propuesta de UX
 * del 2026-10-14.
 *
 * PPA, representación y operación viven en la misma tabla `contratos`, pero un id
 * responde en UNO solo de sus endpoints (`/ppa/{id}` o `/contratos-servicio/{id}`),
 * así que se piden los dos y manda el que conteste. Un PPA abre su ficha de
 * siempre; uno de servicio, la vista de su grupo (representación u operación)
 * mostrando solo ese contrato, con su planta y sus partes enlazadas arriba.
 */
import { BuildingIcon, ExternalLinkIcon, FileTextIcon, ZapIcon } from '@lucide/vue'
import DetalleLayout from '~/components/blocks/DetalleLayout.vue'
import { normalizeError } from '~/core/errors'
import ContratoDetailView from '~/features/contratos/components/ContratoDetailView.vue'
import OperacionView from '~/features/contratos/components/OperacionView.vue'
import RepresentacionView from '~/features/contratos/components/RepresentacionView.vue'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { PpaService } from '~/features/contratos/services/ppa'
import type { ContratoServicio } from '~/features/contratos/types'

const route = useRoute()
const id = Number(route.params.id)

const cargando = ref(true)
const error = ref<string | null>(null)
const esPpa = ref(false)
const contrato = ref<ContratoServicio | null>(null)

const SERVICIOS: Record<string, { label: string; grupo: 'representacion' | 'operacion' }> = {
  representacion: { label: 'Representación', grupo: 'representacion' },
  cgm: { label: 'CGM', grupo: 'representacion' },
  mantenimiento: { label: 'Mantenimiento', grupo: 'operacion' },
  arriendo: { label: 'Arriendo', grupo: 'operacion' },
  internet: { label: 'Internet', grupo: 'operacion' },
}
const ESTADOS: Record<string, 'success' | 'warning' | 'default'> = {
  firmado: 'success',
  en_tramite: 'warning',
  terminado: 'default',
}

const servicio = computed(() => SERVICIOS[contrato.value?.servicio_aplica ?? ''] ?? null)
const titulo = computed(() => {
  const c = contrato.value
  if (!c) return ''
  const planta = c.proyecto ? ` · ${(c.proyecto as { nombre_comercial?: string }).nombre_comercial}` : ''
  return `${servicio.value?.label ?? c.servicio_aplica}${planta}`
})
const volver = computed(() => ({
  to: `/contratos?srv=${servicio.value?.grupo ?? 'operacion'}`,
  label: 'Contratos',
}))

/** Las partes del contrato, con su papel según el servicio (en un arriendo, el prestador es el arrendador). */
const partes = computed(() => {
  const c = contrato.value
  if (!c) return []
  const arriendo = c.servicio_aplica === 'arriendo'
  return [
    { rol: arriendo ? 'Arrendatario' : 'Contratante', id: c.contratante_id, nombre: c.contratante_nombre },
    { rol: arriendo ? 'Arrendador' : 'Prestador', id: c.prestador_id, nombre: c.prestador_nombre },
    { rol: 'Inversionista', id: c.inversionista_id, nombre: c.inversionista_nombre },
  ].filter((p) => p.id != null || p.nombre)
})

onMounted(async () => {
  const [servicioRes, ppaRes] = await Promise.allSettled([
    new ContratosServicioService().obtener(id),
    new PpaService().obtener(id),
  ])
  if (servicioRes.status === 'fulfilled') contrato.value = servicioRes.value
  else if (ppaRes.status === 'fulfilled') esPpa.value = true
  else error.value = normalizeError(servicioRes.reason).message
  cargando.value = false
})
</script>

<template>
  <div v-if="cargando" class="flex justify-center py-20"><Spinner class="size-8" /></div>

  <Alert v-else-if="error" variant="destructive">
    <AlertDescription>No se encontró el contrato #{{ id }}: {{ error }}</AlertDescription>
  </Alert>

  <!-- PPA: su ficha de siempre (condiciones, plantas, tarifas, compromisos, TSF). -->
  <ContratoDetailView v-else-if="esPpa" />

  <DetalleLayout
    v-else-if="contrato"
    :volver="volver"
    :titulo="titulo"
    :codigo="contrato.numero_contrato || ''"
    :tabs="[{ key: 'contrato', label: 'Contrato', icon: FileTextIcon }]"
  >
    <template #chips>
      <GBadge v-if="contrato.estado" :color="ESTADOS[contrato.estado] ?? 'default'" class="text-xs">
        {{ contrato.estado }}
      </GBadge>
    </template>

    <template #default>
      <!-- Con quién tiene que ver el contrato: cada uno lleva a su ficha. -->
      <div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <span class="text-xs font-semibold text-muted-foreground">Planta</span>
        <NuxtLink
          v-if="contrato.proyecto_id"
          :to="`/proyectos/${contrato.proyecto_id}?tab=servicios&servicio=${servicio?.grupo ?? 'operacion'}`"
          class="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          <ZapIcon class="size-3.5" />
          {{ (contrato.proyecto as { nombre_comercial?: string } | undefined)?.nombre_comercial ?? `#${contrato.proyecto_id}` }}
        </NuxtLink>
        <span v-else class="text-muted-foreground">Sin planta</span>

        <template v-for="p in partes" :key="p.rol">
          <span class="ml-3 text-xs font-semibold text-muted-foreground">{{ p.rol }}</span>
          <NuxtLink
            v-if="p.id != null"
            :to="`/clientes/${p.id}`"
            class="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <BuildingIcon class="size-3.5" /> {{ p.nombre || `Cliente #${p.id}` }}
          </NuxtLink>
          <span v-else class="inline-flex items-center gap-1">
            {{ p.nombre }}
            <GBadge color="warning" class="text-xs">sin vincular</GBadge>
          </span>
        </template>

        <a
          v-if="contrato.enlace_drive?.startsWith('http')"
          :href="contrato.enlace_drive"
          target="_blank"
          rel="noopener"
          class="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLinkIcon class="size-3.5" /> Documento
        </a>
      </div>

      <RepresentacionView
        v-if="servicio?.grupo === 'representacion'"
        embebido
        :proyecto-id="contrato.proyecto_id"
        :contrato-id="contrato.id"
      />
      <OperacionView
        v-else
        embebido
        :proyecto-id="contrato.proyecto_id"
        :contrato-id="contrato.id"
        :tipo="contrato.servicio_aplica"
      />
    </template>
  </DetalleLayout>
</template>
