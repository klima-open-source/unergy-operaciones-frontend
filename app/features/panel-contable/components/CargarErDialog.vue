<script setup lang="ts">
/**
 * Confirma mes, año, tipo de dato y tipo de liquidación ANTES de abrir el
 * selector de archivos ER. Solo recolecta la elección; quien la escucha
 * (`PanelContableView`) decide el período activo, la pestaña y cuándo abrir
 * el input de archivos.
 */
import { ArrowRightIcon } from '@lucide/vue'
import { ANIOS, MESES, OPCIONES_TIPO_LIQUIDACION } from '~/features/panel-contable/constants'
import { TabPanelContable, TipoLiquidacion, TipoPanel } from '~/features/panel-contable/types'

const props = defineProps<{
  open: boolean
  tabActiva: TabPanelContable
  periodoActual: string
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  confirmar: [{ periodo: string; tipo: TipoPanel; tipoCarga: TipoLiquidacion }]
}>()

const dlgMes = ref<number | null>(null)
const dlgAnio = ref<number | null>(null)
const dlgTipo = ref<TipoPanel>(TipoPanel.PRELIQUIDACION)
const dlgTipoCarga = ref<TipoLiquidacion>(TipoLiquidacion.NORMAL)

// Al abrir: preseleccionar el período activo si ya hay uno, y el tipo según la
// pestaña activa (preliquidacion/oficial), si aplica.
watch(
  () => props.open,
  (abierto) => {
    if (!abierto) return
    const [anio = null, mes = null] = props.periodoActual.split('-').map(Number)
    dlgAnio.value = anio
    dlgMes.value = mes
    dlgTipo.value =
      props.tabActiva === TabPanelContable.OFICIAL ? TipoPanel.OFICIAL : TipoPanel.PRELIQUIDACION
    dlgTipoCarga.value = TipoLiquidacion.NORMAL
  },
)

const puedeConfirmar = computed(() => !!dlgMes.value && !!dlgAnio.value)

function confirmar() {
  if (!puedeConfirmar.value || !dlgMes.value || !dlgAnio.value) return
  emit('confirmar', {
    periodo: `${dlgAnio.value}-${String(dlgMes.value).padStart(2, '0')}`,
    tipo: dlgTipo.value,
    tipoCarga: dlgTipoCarga.value,
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>¿A qué período y tipo pertenecen estos ER?</DialogTitle>
        <DialogDescription>
          Confirma el mes, año y tipo de carga. Los ER se cargarán y dividirán según los
          inversionistas activos de ese período.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>Mes</FieldLabel>
            <Select v-model="dlgMes">
              <SelectTrigger class="w-full"
                ><SelectValue placeholder="Seleccionar mes"
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(nombre, i) in MESES" :key="i" :value="i + 1">{{
                  nombre
                }}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Año</FieldLabel>
            <Select v-model="dlgAnio">
              <SelectTrigger class="w-full"
                ><SelectValue placeholder="Seleccionar año"
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="a in ANIOS" :key="a" :value="a">{{ a }}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel>Tipo de carga</FieldLabel>
          <RadioGroup v-model="dlgTipo" class="grid grid-cols-2 gap-2">
            <FieldLabel>
              <Field orientation="horizontal">
                <RadioGroupItem :value="TipoPanel.PRELIQUIDACION" />
                <FieldContent>
                  <FieldTitle>Preliquidación</FieldTitle>
                  <FieldDescription>estimado</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
            <FieldLabel>
              <Field orientation="horizontal">
                <RadioGroupItem :value="TipoPanel.OFICIAL" />
                <FieldContent>
                  <FieldTitle>Liquidación oficial</FieldTitle>
                  <FieldDescription>real</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          </RadioGroup>
        </Field>

        <Field>
          <FieldLabel>Tipo de liquidación</FieldLabel>
          <RadioGroup v-model="dlgTipoCarga" class="grid grid-cols-3 gap-2">
            <FieldLabel v-for="op in OPCIONES_TIPO_LIQUIDACION" :key="op.value">
              <Field orientation="horizontal">
                <RadioGroupItem :value="op.value" />
                <FieldContent>
                  <FieldTitle>{{ op.label }}</FieldTitle>
                </FieldContent>
              </Field>
            </FieldLabel>
          </RadioGroup>
          <FieldDescription>
            Solo se cargarán los proyectos clasificados como
            <b class="text-foreground">{{ dlgTipoCarga.toUpperCase() }}</b> para este período. Los
            demás se reportarán como rechazados.
          </FieldDescription>
        </Field>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancelar</Button>
        <Button :disabled="!puedeConfirmar" @click="confirmar">
          Continuar
          <ArrowRightIcon class="size-4" />
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
