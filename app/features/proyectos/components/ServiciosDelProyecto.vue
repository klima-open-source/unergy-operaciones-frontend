<script setup lang="ts">
/**
 * La pestaña Servicios del proyecto: los tres grupos de servicio (PPA,
 * Representación y CGM, Operación) con su detalle, sin salir de la ficha.
 *
 * Representación y Operación son las mismas vistas de `/proyectos/{id}/…`
 * (que siguen existiendo para los enlaces viejos), montadas sin sus migas. El
 * punto junto a cada nombre dice si la planta tiene ese servicio según sus
 * contratos vigentes. `?servicio=` abre directo uno de los tres.
 */
import { FilePenIcon, WrenchIcon, ZapIcon } from '@lucide/vue'
import OperacionView from '~/features/contratos/components/OperacionView.vue'
import RepresentacionView from '~/features/contratos/components/RepresentacionView.vue'
import PpaDelProyecto from '~/features/proyectos/components/PpaDelProyecto.vue'

const props = defineProps<{
  proyectoId: number
  /** `proyecto.servicios`: qué servicios tiene según sus contratos vigentes. */
  activos: Record<string, boolean | undefined>
}>()

const SERVICIOS = [
  { key: 'ppa', label: 'PPA', icon: ZapIcon },
  { key: 'representacion', label: 'Representación y CGM', icon: FilePenIcon },
  { key: 'operacion', label: 'Operación', icon: WrenchIcon },
] as const
type Servicio = (typeof SERVICIOS)[number]['key']

const route = useRoute()
const router = useRouter()

const inicial = SERVICIOS.find((s) => s.key === route.query.servicio)?.key
const servicio = ref<Servicio>(inicial ?? 'ppa')

// En la URL, para que recargar o compartir el enlace abra el mismo servicio.
watch(servicio, (s) => {
  router.replace({ query: { ...route.query, tab: 'servicios', servicio: s } })
})

const activo = (key: Servicio) =>
  key === 'representacion' ? !!(props.activos.representacion || props.activos.cgm) : !!props.activos[key]
</script>

<template>
  <GTabs v-model="servicio">
    <GTabsList>
      <GTabsTrigger v-for="s in SERVICIOS" :key="s.key" :value="s.key">
        <component :is="s.icon" class="size-3" />
        {{ s.label }}
        <span
          class="size-1.5 rounded-full"
          :class="activo(s.key) ? 'bg-success' : 'bg-border'"
          :title="activo(s.key) ? 'Con contrato vigente' : 'Sin contrato vigente'"
        />
      </GTabsTrigger>
    </GTabsList>

    <!-- Se monta solo el servicio abierto: cada vista carga sus contratos al montarse. -->
    <div class="pt-4">
      <PpaDelProyecto v-if="servicio === 'ppa'" :proyecto-id="proyectoId" />
      <RepresentacionView v-else-if="servicio === 'representacion'" embebido />
      <OperacionView v-else embebido />
    </div>
  </GTabs>
</template>
