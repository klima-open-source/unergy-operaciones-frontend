<template>
  <div class="space-y-5">
    <PageHeader title="Reporte de Energía" />

    <GTabs :model-value="tab" @update:model-value="(v) => (tab = v as Tab)">
      <GTabsList>
        <GTabsTrigger value="automatizacion">
          <SettingsIcon class="size-4" /> Reporte ASIC
        </GTabsTrigger>
        <GTabsTrigger value="cgm">
          <MailIcon class="size-4" /> Reporte CGM
        </GTabsTrigger>
      </GTabsList>
    </GTabs>

    <!-- v-show, no GTabsContent/v-if: las dos vistas cargan sus propios datos al
         montar -- cambiar de pestaña no debe perder el estado ni repetir la carga. -->
    <div class="pt-1">
      <ReporteEnergiaAutomatizacionView v-show="tab === 'automatizacion'" />
      <ReporteCGMView v-show="tab === 'cgm'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { MailIcon, SettingsIcon } from '@lucide/vue'
import ReporteEnergiaAutomatizacionView from '~/features/fronteras/components/ReporteEnergiaAutomatizacionView.vue'
import ReporteCGMView from '~/features/operadores-red/components/ReporteCGMView.vue'

type Tab = 'automatizacion' | 'cgm'

const tab = ref<Tab>('automatizacion')
</script>
