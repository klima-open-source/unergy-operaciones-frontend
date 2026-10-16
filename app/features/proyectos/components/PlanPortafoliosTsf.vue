<script setup lang="ts">
/**
 * La parte de los portafolios en «Sincronizar con TSF», con una casilla para
 * todo. La planta está en UN portafolio: si TSF la tiene en uno, va a ese; si
 * está en uno creado en Operaciones, o TSF la tiene en varios, no se mueve y se
 * dice por qué. Ver `apps/proyectos/services/portafolios_originabot.py`.
 */
import type { PlanPortafoliosTsf } from '~/features/proyectos/types'

const props = defineProps<{ plan: PlanPortafoliosTsf }>()
const marcado = defineModel<boolean>({ required: true })

const destino = computed(() => props.plan.agregar[0] ?? null)
const sale = computed(() => props.plan.quitar[0] ?? null)

/** Una línea por acción, en el orden en que se leen mejor. */
const lineas = computed(() => {
  const d = destino.value
  const q = sale.value
  const enDestino = (p: { originabot_portfolio_id: number | null }) =>
    d != null && d.originabot_portfolio_id === p.originabot_portfolio_id
  const lista = [
    ...props.plan.crear.map((p) => ({
      clave: `c${p.originabot_portfolio_id}`,
      texto: enDestino(p) ? `Crear «${p.nombre}» y mover la planta ahí` : `Crear «${p.nombre}»`,
      nuevo: true,
    })),
    ...props.plan.vincular.map((p) => ({ clave: `v${p.portafolio_id}`, texto: `Vincular «${p.nombre}» con su portafolio de TSF`, nuevo: false })),
    ...props.plan.renombrar.map((p) => ({ clave: `r${p.portafolio_id}`, texto: `Renombrar «${p.nombre_anterior}» → «${p.nombre}»`, nuevo: false })),
  ]
  if (d && d.portafolio_id != null) {
    lista.push({ clave: `a${d.portafolio_id}`, texto: `Mover la planta a «${d.nombre}»`, nuevo: false })
  }
  if (q) {
    lista.push({
      clave: `q${q.portafolio_id}`,
      texto: d ? `Sale de «${q.nombre}»` : `Sacar la planta de «${q.nombre}» (ya no está en TSF)`,
      nuevo: false,
    })
  }
  return lista
})
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
      <span v-if="plan.no_se_mueve" class="text-xs text-muted-foreground">
        La planta sigue en «{{ plan.no_se_mueve.nombre }}»: es un portafolio de Operaciones y la
        sincronización no la saca de ahí. Para moverla, cámbiala en la ficha.
      </span>
      <span v-else-if="plan.varios_en_tsf.length" class="text-xs text-muted-foreground">
        En TSF la planta está en {{ plan.varios_en_tsf.length }} portafolios y aquí va en uno solo: no
        se mueve. Escoge el portafolio en la ficha.
      </span>
    </span>
  </label>
</template>
