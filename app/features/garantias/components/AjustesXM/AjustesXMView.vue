<script setup lang="ts">
import { SettingsIcon } from '@lucide/vue'
import SemanalesTab from './tabs/SemanalesTab.vue'
import TxrTab from './tabs/TxrTab.vue'
import MensualesTab from './tabs/MensualesTab.vue'
import TxfTab from './tabs/TxfTab.vue'
import HistoricoTab from './tabs/HistoricoTab.vue'
import AjustesDialog from './AjustesDialog.vue'

type TabKey = 'semanales' | 'txr' | 'mensuales' | 'txf' | 'historico'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'semanales', label: 'Semanales' },
  { key: 'txr', label: 'TXR' },
  { key: 'mensuales', label: 'Mensuales' },
  { key: 'txf', label: 'TXF' },
  { key: 'historico', label: 'Histórico' },
]

const activeTab = ref<TabKey>('semanales')
const showAjustes = ref(false)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <GTabs
        :model-value="activeTab"
        class="flex-1"
        @update:model-value="(v) => (activeTab = v as TabKey)"
      >
        <GTabsList>
          <GTabsTrigger v-for="tab in tabs" :key="tab.key" :value="tab.key">{{
            tab.label
          }}</GTabsTrigger>
        </GTabsList>
      </GTabs>
      <Button variant="ghost" size="icon" class="ml-3" @click="showAjustes = true">
        <SettingsIcon class="size-4" />
      </Button>
    </div>

    <SemanalesTab v-if="activeTab === 'semanales'" />
    <TxrTab v-else-if="activeTab === 'txr'" />
    <MensualesTab v-else-if="activeTab === 'mensuales'" />
    <TxfTab v-else-if="activeTab === 'txf'" />
    <HistoricoTab v-else-if="activeTab === 'historico'" />

    <AjustesDialog :visible="showAjustes" @close="showAjustes = false" />
  </div>
</template>
