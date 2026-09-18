<template>
  <div class="flex flex-col gap-4">
    <!-- ══ HEADER ══ -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <FilePenIcon class="size-4 text-primary" />
        <h1 class="text-lg font-extrabold text-foreground">Informes Mensuales</h1>
        <span class="hidden text-xs text-muted-foreground lg:inline">
          · Generación, revisión y envío al cliente
        </span>
      </div>

      <GTabs :model-value="tab" @update:model-value="(v) => (tab = v)">
        <GTabsList variant="outline">
          <GTabsTrigger value="generar" variant="outline">
            <SettingsIcon class="size-4" /> Generar
          </GTabsTrigger>
          <GTabsTrigger value="pipeline" variant="outline">
            <SendIcon class="size-4" /> Revisión y envío
            <GBadge v-if="badgePipeline" color="destructive" size="sm">{{ badgePipeline }}</GBadge>
          </GTabsTrigger>
          <GTabsTrigger value="portafolios" variant="outline">
            <LayoutGridIcon class="size-4" /> Gestión de portafolios
          </GTabsTrigger>
        </GTabsList>
      </GTabs>
    </div>

    <!-- Wizard de generación -->
    <InformesMensualesPanel v-if="tab === 'generar'" />

    <!-- Pipeline de verificación + envío -->
    <EnvioMensualPanel v-else-if="tab === 'pipeline'" />

    <!-- Gestión de portafolios (drag-and-drop) -->
    <PortafoliosGestionPanel v-else-if="tab === 'portafolios'" />
  </div>
</template>

<script setup>
import { FilePenIcon, LayoutGridIcon, SendIcon, SettingsIcon } from '@lucide/vue'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EnvioMensualPanel from './EnvioMensualPanel.vue'
import InformesMensualesPanel from './InformesMensualesPanel.vue'
import PortafoliosGestionPanel from './PortafoliosGestionPanel.vue'
import { InformesService } from '~/features/operaciones/services/informes'

const informesService = new InformesService()

const route = useRoute()
const router = useRouter()

const _TABS = ['generar', 'pipeline', 'portafolios']
const tab = ref(_TABS.includes(route.query.tab) ? route.query.tab : 'generar')
const badgePipeline = ref(null) // cantidad de informes del mes en curso pendientes/comentados

// Sync con query string para deep-link
function setTab(t) {
  tab.value = t
  const q = { ...route.query }
  if (t === 'generar') delete q.tab
  else q.tab = t
  router.replace({ query: q })
}
// Watcher para sincronizar query con tab activa (cuando cambia desde el UI)
watch(tab, (val) => setTab(val))

// Cuenta informes pendientes/comentados del mes actual para mostrar badge en el tab Pipeline
async function cargarBadge() {
  try {
    const now = new Date()
    const desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const hasta = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
    // ✅ Filtro en backend para no depender del orden/límite
    const data = await informesService.listar({
      periodo_desde_gte: desde,
      periodo_desde_lte: hasta,
      limit: 500,
    })
    const pendientes = (data || []).filter(
      (i) => i.estado !== 'aprobado' || !i.correo_enviado,
    ).length
    badgePipeline.value = pendientes || null
  } catch {
    /* no crítico */
  }
}
onMounted(cargarBadge)
</script>
