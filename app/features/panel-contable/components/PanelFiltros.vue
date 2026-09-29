<script setup lang="ts">
/** Barra de filtros de la lista de proyectos, compartida por Preliquidación, Oficial y Selección. */
import { SearchIcon } from '@lucide/vue'
import {
  OPCIONES_DOCUMENTO,
  OPCIONES_ESTADO_LIQUIDACION,
  OPCIONES_MARCADOR,
  OPCIONES_TIPO_LIQUIDACION,
} from '~/features/panel-contable/constants'
import type {
  DocumentoContable,
  FiltroEstadoLiquidacion,
  FiltroMarcador,
  TipoLiquidacion,
} from '~/features/panel-contable/types'

defineProps<{
  inversionistas: string[]
  total: number
  mostrando: number
}>()

const proyecto = defineModel<string>('proyecto', { default: '' })
const tipo = defineModel<TipoLiquidacion | ''>('tipo', { default: '' })
const estado = defineModel<FiltroEstadoLiquidacion | ''>('estado', { default: '' })
const marcador = defineModel<FiltroMarcador | ''>('marcador', { default: '' })
const inversionista = defineModel<string>('inversionista', { default: '' })
const bloque = defineModel<DocumentoContable | ''>('bloque', { default: '' })

const hayFiltro = computed(
  () =>
    !!(
      proyecto.value ||
      tipo.value ||
      estado.value ||
      marcador.value ||
      inversionista.value ||
      bloque.value
    ),
)

function limpiar() {
  proyecto.value = ''
  tipo.value = ''
  estado.value = ''
  marcador.value = ''
  inversionista.value = ''
  bloque.value = ''
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3">
    <InputGroup class="min-w-52 flex-1">
      <InputGroupAddon><SearchIcon class="size-4" /></InputGroupAddon>
      <InputGroupInput v-model="proyecto" placeholder="Buscar proyecto…" />
    </InputGroup>

    <Select
      :model-value="aValorSelect(tipo)"
      @update:model-value="(v) => (tipo = deValorSelect(v))"
    >
      <SelectTrigger class="shrink-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
      <SelectContent>
        <SelectItem :value="VALOR_SELECT_VACIO">Tipo: todos</SelectItem>
        <SelectItem v-for="op in OPCIONES_TIPO_LIQUIDACION" :key="op.value" :value="op.value">{{
          op.label
        }}</SelectItem>
      </SelectContent>
    </Select>

    <Select
      :model-value="aValorSelect(estado)"
      @update:model-value="(v) => (estado = deValorSelect(v))"
    >
      <SelectTrigger class="shrink-0"><SelectValue placeholder="Estado" /></SelectTrigger>
      <SelectContent>
        <SelectItem :value="VALOR_SELECT_VACIO">Estado: todos</SelectItem>
        <SelectItem v-for="op in OPCIONES_ESTADO_LIQUIDACION" :key="op.value" :value="op.value">{{
          op.label
        }}</SelectItem>
      </SelectContent>
    </Select>

    <Select
      :model-value="aValorSelect(marcador)"
      @update:model-value="(v) => (marcador = deValorSelect(v))"
    >
      <SelectTrigger class="shrink-0"><SelectValue placeholder="Marcador" /></SelectTrigger>
      <SelectContent>
        <SelectItem :value="VALOR_SELECT_VACIO">Marcador: todos</SelectItem>
        <SelectItem v-for="op in OPCIONES_MARCADOR" :key="op.value" :value="op.value">{{
          op.label
        }}</SelectItem>
      </SelectContent>
    </Select>

    <Select
      :model-value="aValorSelect(inversionista)"
      @update:model-value="(v) => (inversionista = deValorSelect(v))"
    >
      <SelectTrigger class="shrink-0"><SelectValue placeholder="Inversionista" /></SelectTrigger>
      <SelectContent>
        <SelectItem :value="VALOR_SELECT_VACIO">Inversionista: todos</SelectItem>
        <SelectItem v-for="nom in inversionistas" :key="nom" :value="nom">{{ nom }}</SelectItem>
      </SelectContent>
    </Select>

    <Select
      :model-value="aValorSelect(bloque)"
      @update:model-value="(v) => (bloque = deValorSelect(v))"
    >
      <SelectTrigger class="shrink-0"><SelectValue placeholder="Documento" /></SelectTrigger>
      <SelectContent>
        <SelectItem :value="VALOR_SELECT_VACIO">Documento: todos</SelectItem>
        <SelectItem v-for="op in OPCIONES_DOCUMENTO" :key="op.value" :value="op.value">{{
          op.label
        }}</SelectItem>
      </SelectContent>
    </Select>

    <span class="text-xs text-muted-foreground">{{ mostrando }} / {{ total }}</span>
    <Button v-if="hayFiltro" variant="outline" size="sm" @click="limpiar">Limpiar</Button>
  </div>
</template>
