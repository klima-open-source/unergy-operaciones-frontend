<script setup lang="ts">
/**
 * La parte de los portafolios en «Sincronizar con TSF»: qué cambia para que la
 * planta quede en los mismos portafolios que en TSF, con una casilla para todo.
 * Los portafolios creados en Operaciones no aparecen: la sincronización no los
 * toca. Ver `apps/proyectos/services/portafolios_originabot.py` en el backend.
 */
import type { PlanPortafoliosTsf } from '~/features/proyectos/types'

const props = defineProps<{ plan: PlanPortafoliosTsf }>()
const marcado = defineModel<boolean>({ required: true })

/** Una línea por acción, en el orden en que se leen mejor. */
const lineas = computed(() => [
  ...props.plan.crear.map((p) => ({ clave: `c${p.originabot_portfolio_id}`, texto: `Crear «${p.nombre}» y agregar la planta`, nuevo: true })),
  ...props.plan.vincular.map((p) => ({ clave: `v${p.portafolio_id}`, texto: `Vincular «${p.nombre}» con su portafolio de TSF`, nuevo: false })),
  ...props.plan.agregar.map((p) => ({ clave: `a${p.portafolio_id}`, texto: `Agregar la planta a «${p.nombre}»`, nuevo: false })),
  ...props.plan.renombrar.map((p) => ({ clave: `r${p.portafolio_id}`, texto: `Renombrar «${p.nombre_anterior}» → «${p.nombre}»`, nuevo: false })),
  ...props.plan.quitar.map((p) => ({ clave: `q${p.portafolio_id}`, texto: `Sacar la planta de «${p.nombre}» (ya no está en TSF)`, nuevo: false })),
])
</script>

<template>
  <label class="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
    <Checkbox :model-value="marcado" class="mt-0.5" @update:model-value="marcado = $event === true" />
    <span class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="font-medium">
        En TSF: {{ plan.de_tsf.map((p) => p.nombre).join(', ') || 'en ningún portafolio' }}
      </span>
      <span v-for="l in lineas" :key="l.clave" class="flex items-center gap-1.5 text-xs">
        <TruncatedText :text="l.texto" class="max-w-md text-foreground" />
        <GBadge v-if="l.nuevo" color="warning" class="text-xs">nuevo</GBadge>
      </span>
    </span>
  </label>
</template>
