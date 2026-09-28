<script setup lang="ts">
import AjustesXMView from './AjustesXM/AjustesXMView.vue'
import ProyeccionesView from './Proyecciones/ProyeccionesView.vue'
import ModeloPredictivoView from './ModeloPredictivo/ModeloPredictivoView.vue'

type TabKey = 'ajustes' | 'proyecciones' | 'modelo'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ajustes', label: 'Ajustes XM' },
  { key: 'proyecciones', label: 'Proyecciones' },
  { key: 'modelo', label: 'Modelo Predictivo' },
]

const activeTab = ref<TabKey>('ajustes')
</script>

<template>
  <div class="space-y-4">
    <GTabs :model-value="activeTab" @update:model-value="(v) => (activeTab = v as TabKey)">
      <GTabsList>
        <GTabsTrigger v-for="tab in tabs" :key="tab.key" :value="tab.key">{{
          tab.label
        }}</GTabsTrigger>
      </GTabsList>
    </GTabs>

    <AjustesXMView v-if="activeTab === 'ajustes'" />
    <ProyeccionesView v-else-if="activeTab === 'proyecciones'" />
    <ModeloPredictivoView v-else-if="activeTab === 'modelo'" />
  </div>
</template>
