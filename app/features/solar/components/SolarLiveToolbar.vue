<script setup lang="ts">
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
const autoMenuOpen = ref(false)

function selectAuto(ms: number) {
  autoInterval.value = ms
  autoMenuOpen.value = false
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5">
    <div class="relative w-64">
      <SearchIcon
        class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input v-model="filtro" placeholder="Buscar proyecto..." class="pl-8" />
      <button
        v-if="filtro"
        type="button"
        class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Limpiar filtro"
        @click="filtro = ''"
      >
        <XIcon class="size-4" />
      </button>
    </div>

    <ButtonGroup>
      <Button
        v-for="c in COLUMN_OPTIONS"
        :key="c"
        type="button"
        :variant="cols === c ? 'secondary' : 'outline'"
        size="sm"
        :aria-label="`${c} columna${c > 1 ? 's' : ''}`"
        @click="cols = c"
      >
        {{ c }}
      </Button>
    </ButtonGroup>

    <Button variant="outline" size="sm" :disabled="loading" @click="$emit('refresh')">
      <LoaderCircleIcon v-if="loading" class="animate-spin" />
      <RefreshCwIcon v-else />
      Actualizar
    </Button>

    <Popover v-model:open="autoMenuOpen">
      <PopoverTrigger as-child>
        <Button :variant="autoInterval ? 'secondary' : 'outline'" size="sm">
          <ClockIcon />
          <span v-if="autoInterval">{{ autoLabel }}</span>
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" class="w-44 p-1">
        <Button
          variant="ghost"
          size="sm"
          class="w-full justify-start"
          :class="!autoInterval ? 'bg-muted' : ''"
          @click="selectAuto(0)"
        >
          Desactivado
        </Button>
        <Button
          v-for="opt in AUTO_OPTIONS"
          :key="opt.ms"
          variant="ghost"
          size="sm"
          class="w-full justify-start"
          :class="autoInterval === opt.ms ? 'bg-muted' : ''"
          @click="selectAuto(opt.ms)"
        >
          Cada {{ opt.label }}
        </Button>
      </PopoverContent>
    </Popover>
  </div>
</template>
