<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import {
  ChevronDownIcon,
  ClockIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from '@lucide/vue'

defineProps<{
  loading: boolean
}>()

defineEmits<{ refresh: [] }>()

const filtro = defineModel<string>('filtro', { required: true })
const cols = defineModel<number>('cols', { required: true })
const autoInterval = defineModel<number>('autoInterval', { required: true })

const COLUMN_OPTIONS = [1, 2, 4] as const

const AUTO_OPTIONS = [
  { ms: 60000, label: '1 min' },
  { ms: 300000, label: '5 min' },
  { ms: 900000, label: '15 min' },
  { ms: 1800000, label: '30 min' },
] as const

const autoLabel = computed(() => AUTO_OPTIONS.find((o) => o.ms === autoInterval.value)?.label ?? '')

function onColsChange(value: AcceptableValue | AcceptableValue[]) {
  if (typeof value === 'string' && value) cols.value = Number(value)
}

function onAutoChange(value: AcceptableValue) {
  if (typeof value === 'string') autoInterval.value = Number(value)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5">
    <InputGroup class="w-[260px]">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput v-model="filtro" placeholder="Buscar proyecto..." />
      <InputGroupAddon v-if="filtro" align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Limpiar filtro" @click="filtro = ''">
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>

    <ToggleGroup
      type="single"
      :model-value="String(cols)"
      variant="outline"
      @update:model-value="onColsChange"
    >
      <ToggleGroupItem
        v-for="c in COLUMN_OPTIONS"
        :key="c"
        :value="String(c)"
        :aria-label="`${c} columna${c > 1 ? 's' : ''}`"
        class="w-9"
      >
        {{ c }}
      </ToggleGroupItem>
    </ToggleGroup>

    <Button variant="outline" size="sm" :disabled="loading" @click="$emit('refresh')">
      <LoaderCircleIcon v-if="loading" class="animate-spin" />
      <RefreshCwIcon v-else />
      Actualizar
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="outline"
          size="sm"
          :class="autoInterval ? 'border-primary/40 bg-primary/5 text-primary' : ''"
        >
          <ClockIcon />
          <span v-if="autoInterval">{{ autoLabel }}</span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          :model-value="String(autoInterval)"
          @update:model-value="onAutoChange"
        >
          <DropdownMenuRadioItem value="0">Desactivado</DropdownMenuRadioItem>
          <DropdownMenuRadioItem v-for="opt in AUTO_OPTIONS" :key="opt.ms" :value="String(opt.ms)">
            Cada {{ opt.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
