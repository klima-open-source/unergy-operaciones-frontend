<!--
  Chasis compartido de las vistas de detalle (cliente / proyecto / contrato).

  Las tres miran la misma realidad y antes cada una inventaba su propio marco:
  Cliente traía migas + barra de pestañas subrayada dentro de una tarjeta;
  Proyecto y Contrato usaban <TabView> de PrimeVue suelto, con título grande y
  botones distintos. Además Proyecto necesitaba un TAB_INDEX que traducía
  ?tab=nombre a un índice numérico -- y los índices se corrían cuando la
  pestaña Fronteras no aplicaba. Acá la pestaña es una LLAVE DE TEXTO, así que
  ese problema desaparece.

  El diseño que manda es el de Cliente, que es el que el equipo prefiere.

  Uso:
    <DetalleLayout :volver="{ to: '/servicios-unificado?vista=proyectos', label: 'Proyectos' }"
                   :titulo="proyecto.nombre_comercial"
                   :codigo="proyecto.codigo_tsf"
                   :tabs="TABS" v-model="tab">
      <template #chips> <GBadge ... /> </template>
      <template #acciones> <Button ... /> </template>
      <template #default="{ tab }">
        <div v-if="tab === 'general'"> ... </div>
      </template>
    </DetalleLayout>
-->
<template>
  <div class="space-y-3">
    <!-- Migas: volver / titulo / codigo / chips ............ acciones -->
    <div class="flex min-h-8 flex-wrap items-center gap-2">
      <button
        type="button"
        class="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-primary hover:underline hover:underline-offset-2"
        @click="router.push(volver.to)">
        <ArrowLeftIcon class="size-3" /> {{ volver.label }}
      </button>
      <span class="text-muted-foreground/60">/</span>

      <slot name="titulo">
        <TruncatedText :text="titulo" class="max-w-sm text-sm font-bold text-foreground" />
      </slot>

      <span v-if="codigo" class="font-mono text-xs text-muted-foreground">{{ codigo }}</span>
      <slot name="chips" />

      <div class="ml-auto flex items-center gap-1.5"><slot name="acciones" /></div>
    </div>

    <!-- Tarjeta unica: barra de pestañas + cuerpo -->
    <div class="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div
        class="flex scrollbar-thin overflow-x-auto border-b [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
      >
        <button v-for="t in tabsVisibles" :key="t.key" type="button"
                class="-mb-px inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-150 sm:px-4 sm:py-2.5 sm:text-sm"
                :class="tabActiva === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
                @click="seleccionar(t.key)">
          <component :is="t.icon" class="size-3" v-if="t.icon" />
          <span>{{ t.label }}</span>
          <span
            v-if="t.badge != null && t.badge !== ''"
            class="min-w-4.5 rounded-full px-1.5 text-center text-xs font-extrabold"
            :class="tabActiva === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
          >{{ t.badge }}</span>
        </button>
      </div>

      <div class="p-3 sm:p-4">
        <slot :tab="tabActiva" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeftIcon } from '@lucide/vue'

const props = defineProps({
  // { to: '/servicios-unificado?vista=clientes', label: 'Clientes' }
  volver: { type: Object, required: true },
  titulo: { type: String, default: '' },
  codigo: { type: String, default: '' },
  // [{ key, label, icon?, badge?, oculta? }]
  tabs: { type: Array, required: true },
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const route = useRoute()

const tabsVisibles = computed(() => props.tabs.filter(t => !t.oculta))

function esValida(key) {
  return tabsVisibles.value.some(t => t.key === key)
}

// Prioridad: ?tab= de la URL -> v-model -> primera pestaña visible.
function inicial() {
  const q = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (esValida(q)) return q
  if (esValida(props.modelValue)) return props.modelValue
  return tabsVisibles.value[0]?.key || ''
}

const tabActiva = ref(inicial())

function seleccionar(key) {
  if (key === tabActiva.value) return
  tabActiva.value = key
  emit('update:modelValue', key)
  // Merge, no reemplazo: hay vistas que llevan otros parametros en la URL
  // (por ejemplo ?edit=true en el detalle de proyecto).
  router.replace({ query: { ...route.query, tab: key } })
}

// La lista de pestañas puede llegar despues de cargar los datos (el caso de
// Fronteras, que solo aparece si la planta tiene). Cuando eso pasa hay que
// reevaluar: puede que la de la URL ya sea valida, o que la activa deje de serlo.
watch(tabsVisibles, () => {
  const q = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (esValida(q) && q !== tabActiva.value) {
    tabActiva.value = q
    emit('update:modelValue', q)
    return
  }
  if (!esValida(tabActiva.value)) {
    const primera = tabsVisibles.value[0]?.key || ''
    tabActiva.value = primera
    emit('update:modelValue', primera)
  }
})

// Navegar hacia atras/adelante tambien cambia de pestaña.
watch(() => route.query.tab, (t) => {
  if (typeof t === 'string' && esValida(t) && t !== tabActiva.value) {
    tabActiva.value = t
    emit('update:modelValue', t)
  }
})

watch(() => props.modelValue, (v) => {
  if (v && esValida(v) && v !== tabActiva.value) seleccionar(v)
})
</script>
