<script setup lang="ts">
import { CalculatorIcon, HistoryIcon, LoaderCircleIcon, RefreshCwIcon, SaveIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import DatePicker from '~/components/blocks/DatePicker.vue'
import type { Proyecciones, SnapshotGarantias, VentanaProyeccion } from '~/features/garantias/types'
import { ProyeccionesGarantiasService } from '~/features/garantias/services/proyecciones'
import PorContrato from './PorContrato.vue'

const proyeccionesApi = new ProyeccionesGarantiasService()

const MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const plantasNuevas = ref(0)
const kwhPlantaNueva = ref(180)
const corte = ref('')
const data = ref<Proyecciones | null>(null)
const historial = ref<SnapshotGarantias[]>([])
const cargando = ref(false)
const guardando = ref(false)
const guardandoVentana = ref<string | null>(null)

function tituloVentana(v: VentanaProyeccion): string {
  const periodo = `${MESES[v.mes] || v.mes} ${v.anio}`
  return v.clave === 'resto_mes_actual'
    ? `Resto del mes actual · ${periodo}`
    : `Mes siguiente · ${periodo}`
}
function etiquetaClave(c: string): string {
  return c === 'resto_mes_actual' ? 'Resto mes actual' : 'Mes siguiente'
}
function fmtMWh(v: number | null): string {
  return v != null ? `${v.toFixed(1)} MWh` : '—'
}

async function cargar() {
  cargando.value = true
  try {
    data.value = await proyeccionesApi.obtener({
      plantasNuevas: plantasNuevas.value || 0,
      kwhPlantaNueva: kwhPlantaNueva.value || 0,
      corte: corte.value || undefined,
    })
  } catch (e) {
    toast.error('No se pudo calcular la proyección', {
      description: normalizeError(e).message,
      duration: 6000,
    })
  } finally {
    cargando.value = false
  }
}

async function cargarHistorial() {
  try {
    const r = await proyeccionesApi.obtenerHistorial()
    historial.value = r.snapshots || []
  } catch (e) {
    toast.error('No se pudo cargar el histórico', {
      description: normalizeError(e).message,
      duration: 5000,
    })
  }
}

async function guardarPagado(v: VentanaProyeccion) {
  guardandoVentana.value = v.clave
  try {
    await proyeccionesApi.registrarPago({ anio: v.anio, mes: v.mes, valor: v.pagado || 0 })
    // Recalcula el saldo en la tarjeta SIN recargar todo (evita el parpadeo y no
    // pierde el foco): saldo = pagado − garantía estimada.
    v.saldo = (v.pagado || 0) - (v.garantia_total || 0)
  } catch (e) {
    toast.error('No se pudo guardar el pagado', {
      description: normalizeError(e).message,
      duration: 5000,
    })
  } finally {
    guardandoVentana.value = null
  }
}

async function guardar() {
  guardando.value = true
  try {
    await proyeccionesApi.guardarSnapshot({
      plantasNuevas: plantasNuevas.value || 0,
      kwhPlantaNueva: kwhPlantaNueva.value || 0,
      corte: corte.value || undefined,
    })
    toast.success('Snapshot guardado', { duration: 3000 })
    await cargarHistorial()
  } catch (e) {
    toast.error('No se pudo guardar el snapshot', {
      description: normalizeError(e).message,
      duration: 6000,
    })
  } finally {
    guardando.value = false
  }
}

onMounted(() => {
  cargar()
  cargarHistorial()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Controles -->
    <div class="flex flex-wrap items-end gap-4 rounded-xl bg-primary/5 p-4">
      <div class="flex flex-col gap-1">
        <GLabel>Plantas nuevas</GLabel>
        <NumberField v-model="plantasNuevas" :min="0" class="w-36" @update:model-value="cargar">
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>
      <div class="flex flex-col gap-1">
        <GLabel>kWh por planta nueva</GLabel>
        <NumberField
          v-model="kwhPlantaNueva"
          :min="0"
          :step="10"
          class="w-44"
          @update:model-value="cargar"
        >
          <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
        </NumberField>
      </div>
      <div class="flex flex-col gap-1">
        <GLabel>Fecha de corte (opcional)</GLabel>
        <DatePicker v-model="corte" clearable class="w-40" @update:model-value="cargar" />
      </div>
      <Button variant="outline" :disabled="cargando" @click="cargar">
        <LoaderCircleIcon v-if="cargando" class="size-4 animate-spin" />
        <RefreshCwIcon v-else class="size-4" />
        Recalcular
      </Button>
      <Button :disabled="guardando" @click="guardar">
        <SaveIcon class="size-4" />
        Guardar snapshot
      </Button>
      <div v-if="data" class="ml-auto text-xs text-muted-foreground">
        Corte: <b>{{ data.fecha_corte }}</b> · Precio bolsa:
        <b>{{
          data.precio_bolsa_cop_kwh != null ? formatCOP(data.precio_bolsa_cop_kwh) + '/kWh' : '—'
        }}</b>
      </div>
    </div>

    <p class="text-[11px] leading-snug text-muted-foreground">
      La garantía = (ventas − compras en bolsa) × precio de bolsa (prom. 7 días SIMEM) + costo
      regulatorio del mes anterior. El "mes siguiente" usa la proyección de cierre del mes actual
      como aproximación. El costo regulatorio sale del Cruce de facturas del Drive de Estados de
      Resultados.
    </p>

    <!-- Tarjetas de las dos ventanas -->
    <div v-if="cargando" class="text-sm text-muted-foreground">Calculando…</div>
    <div
      v-else-if="data"
      class="grid gap-4"
      style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))"
    >
      <div v-for="v in data.ventanas" :key="v.clave" class="rounded-xl border bg-card p-5">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-foreground">{{ tituloVentana(v) }}</span>
          <GBadge
            v-if="v.regulatorio_periodo?.fallback"
            color="warning"
            title="No había Cruce de facturas del mes; se usó el último disponible"
          >
            regulatorio: fallback
          </GBadge>
        </div>
        <div class="mb-4 text-2xl font-bold text-primary">{{ formatCOP(v.garantia_total) }}</div>
        <dl class="space-y-1.5 text-xs text-muted-foreground">
          <div class="flex justify-between">
            <dt>Neto (ventas − compras)</dt>
            <dd>{{ fmtMWh(v.neto_mwh) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Valor energía</dt>
            <dd>{{ formatCOP(v.valor_energia) }}</dd>
          </div>
          <div v-if="v.valor_plantas_nuevas" class="flex justify-between">
            <dt>Plantas nuevas</dt>
            <dd>{{ formatCOP(v.valor_plantas_nuevas) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Costo regulatorio</dt>
            <dd>{{ formatCOP(v.costo_regulatorio) }}</dd>
          </div>
        </dl>
        <div class="mt-3 border-t pt-3">
          <div class="mb-2 flex items-center gap-2">
            <GLabel>Pagado</GLabel>
            <NumberField
              v-model="v.pagado"
              :min="0"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-44"
            >
              <NumberFieldContent
                ><NumberFieldInput @keyup.enter="guardarPagado(v)"
              /></NumberFieldContent>
            </NumberField>
            <Button
              variant="outline"
              size="sm"
              :disabled="guardandoVentana === v.clave"
              @click="guardarPagado(v)"
            >
              <CalculatorIcon class="size-4" />
              Calcular saldo
            </Button>
          </div>
          <div
            v-if="v.saldo != null"
            class="text-sm font-semibold"
            :class="v.saldo >= 0 ? 'text-success' : 'text-destructive'"
          >
            Saldo: {{ formatCOP(v.saldo) }} {{ v.saldo >= 0 ? '· a favor' : '· falta' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Reparto de la garantía por contrato -->
    <div class="mt-6 border-t pt-6">
      <PorContrato :corte="corte" />
    </div>

    <!-- Histórico -->
    <div class="mt-6">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-semibold text-foreground">Histórico de snapshots</span>
        <Button variant="ghost" size="sm" @click="cargarHistorial">
          <HistoryIcon class="size-4" />
          Refrescar
        </Button>
      </div>
      <div v-if="historial.length" class="overflow-x-auto rounded-lg border">
        <GTable>
          <GTableHeader>
            <GTableRow>
              <GTableHead>Corte</GTableHead>
              <GTableHead>Ventana</GTableHead>
              <GTableHead>Período</GTableHead>
              <GTableHead class="text-right">Neto (MWh)</GTableHead>
              <GTableHead class="text-right">Precio</GTableHead>
              <GTableHead class="text-right">Garantía</GTableHead>
            </GTableRow>
          </GTableHeader>
          <GTableBody>
            <GTableRow v-for="s in historial" :key="s.id">
              <GTableCell>{{ s.fecha_corte }}</GTableCell>
              <GTableCell>{{ etiquetaClave(s.clave) }}</GTableCell>
              <GTableCell>{{ s.mes }}/{{ s.anio }}</GTableCell>
              <GTableCell class="text-right">{{
                s.neto_mwh != null ? s.neto_mwh.toFixed(1) : '—'
              }}</GTableCell>
              <GTableCell class="text-right">{{
                s.precio_bolsa != null ? formatCOP(s.precio_bolsa) : '—'
              }}</GTableCell>
              <GTableCell class="text-right font-semibold">
                {{ s.garantia_total != null ? formatCOP(s.garantia_total) : '—' }}
              </GTableCell>
            </GTableRow>
          </GTableBody>
        </GTable>
      </div>
      <div v-else class="text-xs text-muted-foreground">Aún no hay snapshots guardados.</div>
    </div>
  </div>
</template>
