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
    <div class="dl-cabecera">
      <button type="button" class="dl-volver" @click="router.push(volver.to)">
        <ArrowLeftIcon class="size-[1em]" /> {{ volver.label }}
      </button>
      <span class="dl-sep">/</span>

      <slot name="titulo">
        <span class="dl-titulo">{{ titulo }}</span>
      </slot>

      <span v-if="codigo" class="dl-codigo">{{ codigo }}</span>
      <slot name="chips" />

      <div class="dl-acciones"><slot name="acciones" /></div>
    </div>

    <!-- Tarjeta unica: barra de pestañas + cuerpo -->
    <div class="dl-card">
      <div class="dl-tabs">
        <button v-for="t in tabsVisibles" :key="t.key" type="button"
                class="dl-tab" :class="{ 'dl-tab--on': tabActiva === t.key }"
                @click="seleccionar(t.key)">
          <component :is="t.icon" class="size-[1em]" v-if="t.icon" />
          <span>{{ t.label }}</span>
          <span v-if="t.badge != null && t.badge !== ''" class="dl-badge">{{ t.badge }}</span>
        </button>
      </div>

      <div class="dl-cuerpo">
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

<style scoped>
/* ── Cabecera ─────────────────────────────────────────────────────────────── */
.dl-cabecera {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 30px;
}
.dl-volver {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 13px; font-weight: 600; color: var(--color-unergy-purple); cursor: pointer;
}
.dl-volver:hover { text-decoration: underline; text-underline-offset: 2px; }
.dl-volver svg { font-size: 10px; }
.dl-sep { color: #c5b9db; }
.dl-titulo {
  font-size: 14px; font-weight: 700; color: var(--color-unergy-deep);
  max-width: 46ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dl-codigo {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: #9b8fb0;
}
.dl-acciones { margin-left: auto; display: flex; align-items: center; gap: 6px; }

/* ── Tarjeta ──────────────────────────────────────────────────────────────── */
.dl-card {
  background: #fff; border: 1px solid #ECE7F2; border-radius: 12px; overflow: hidden;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}

/* ── Barra de pestañas ────────────────────────────────────────────────────────
   Subrayado morado en la activa, igual que el detalle de Cliente. Con muchas
   pestañas la barra scrollea en horizontal: acá sí es aceptable, porque es
   navegacion y no una tabla de datos. */
.dl-tabs {
  display: flex; border-bottom: 1px solid #ECE7F2;
  overflow-x: auto; scrollbar-width: thin;
}
.dl-tabs::-webkit-scrollbar { height: 4px; }
.dl-tabs::-webkit-scrollbar-thumb { background: #E5E2EC; border-radius: 999px; }
.dl-tab {
  display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
  padding: 9px 16px; margin-bottom: -1px;
  font-size: 13px; font-weight: 600; color: #6b5a8a; white-space: nowrap;
  border-bottom: 2px solid transparent; cursor: pointer;
  transition: color .12s, border-color .12s, background .12s;
}
.dl-tab:hover { color: var(--color-unergy-deep); background: #FAF9FC; }
.dl-tab svg { font-size: 11px; }
.dl-tab--on { color: var(--color-unergy-purple); border-bottom-color: var(--color-unergy-purple); }
.dl-tab--on svg { color: var(--color-unergy-purple); }
.dl-badge {
  background: #EEF0F2; color: #6b7280; border-radius: 999px;
  font-size: 10px; font-weight: 800; padding: 0 6px; min-width: 18px; text-align: center;
}
.dl-tab--on .dl-badge { background: #f0ebfd; color: var(--color-unergy-purple); }

.dl-cuerpo { padding: 18px; }
@media (max-width: 640px) {
  .dl-cuerpo { padding: 12px; }
  .dl-tab { padding: 8px 12px; font-size: 12px; }
}
</style>
