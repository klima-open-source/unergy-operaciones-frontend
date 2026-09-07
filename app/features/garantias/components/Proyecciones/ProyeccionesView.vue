<template>
  <div class="space-y-4">
    <!-- Controles -->
    <div class="flex flex-wrap items-end gap-4 p-4 rounded-xl" style="background:rgba(145,91,216,0.06)">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a">Plantas nuevas</label>
        <InputNumber v-model="plantasNuevas" :min="0" showButtons buttonLayout="horizontal"
          style="width:9rem" @update:modelValue="cargar" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium" style="color:#6b5a8a">kWh por planta nueva</label>
        <InputNumber v-model="kwhPlantaNueva" :min="0" :step="10" suffix=" kWh"
          style="width:11rem" @update:modelValue="cargar" />
      </div>
      <Button label="Recalcular" :loading="cargando" @click="cargar" outlined>
        <template #icon><RefreshCwIcon class="size-[1em]" /></template>
      </Button>
      <Button label="Guardar snapshot" :loading="guardando" @click="guardar">
        <template #icon><SaveIcon class="size-[1em]" /></template>
      </Button>
      <div v-if="data" class="ml-auto text-xs" style="color:#6b5a8a">
        Corte: <b>{{ data.fecha_corte }}</b> · Precio bolsa:
        <b>{{ data.precio_bolsa_cop_kwh != null ? fmtCOP(data.precio_bolsa_cop_kwh) + '/kWh' : '—' }}</b>
      </div>
    </div>

    <p class="text-[11px] leading-snug" style="color:#8a7aa5">
      La garantía = (ventas − compras en bolsa) × precio de bolsa (prom. 7 días SIMEM) + costo regulatorio del mes anterior.
      El “mes siguiente” usa la proyección de cierre del mes actual como aproximación. El costo regulatorio sale del Cruce de facturas del Drive de Estados de Resultados.
    </p>

    <!-- Tarjetas de las dos ventanas -->
    <div v-if="cargando" class="text-sm" style="color:#6b5a8a">Calculando…</div>
    <div v-else-if="data" class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div v-for="v in data.ventanas" :key="v.clave"
        class="rounded-xl border p-5" style="border-color:rgba(44,32,57,0.10)">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">{{ tituloVentana(v) }}</span>
          <span v-if="v.regulatorio_periodo && v.regulatorio_periodo.fallback"
            class="text-[10px] px-2 py-0.5 rounded-full" style="background:#FEF3C7;color:#92400E"
            title="No había Cruce de facturas del mes; se usó el último disponible">regulatorio: fallback</span>
        </div>
        <div class="text-2xl font-bold mb-4" style="color:var(--color-unergy-purple)">{{ fmtCOP(v.garantia_total) }}</div>
        <dl class="text-xs space-y-1.5" style="color:#4b3f61">
          <div class="flex justify-between"><dt>Neto (ventas − compras)</dt><dd>{{ fmtMWh(v.neto_mwh) }}</dd></div>
          <div class="flex justify-between"><dt>Valor energía</dt><dd>{{ fmtCOP(v.valor_energia) }}</dd></div>
          <div v-if="v.valor_plantas_nuevas" class="flex justify-between">
            <dt>Plantas nuevas</dt><dd>{{ fmtCOP(v.valor_plantas_nuevas) }}</dd></div>
          <div class="flex justify-between"><dt>Costo regulatorio</dt><dd>{{ fmtCOP(v.costo_regulatorio) }}</dd></div>
        </dl>
        <div class="mt-3 pt-3 border-t" style="border-color:rgba(44,32,57,0.10)">
          <div class="flex items-center gap-2 mb-2">
            <label class="text-xs font-medium" style="color:#6b5a8a">Pagado</label>
            <InputNumber v-model="v.pagado" :min="0" mode="currency" currency="COP" locale="es-CO"
              :maxFractionDigits="0" size="small" style="width:11rem"
              @keyup.enter="guardarPagado(v)" />
            <Button label="Calcular saldo" size="small" outlined :loading="v._guardando" @click="guardarPagado(v)">
              <template #icon><CalculatorIcon class="size-[1em]" /></template>
            </Button>
          </div>
          <div v-if="v.saldo != null" class="text-sm font-semibold"
            :style="v.saldo >= 0 ? 'color:#059669' : 'color:#DC2626'">
            Saldo: {{ fmtCOP(v.saldo) }} {{ v.saldo >= 0 ? '· a favor' : '· falta' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Histórico -->
    <div class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Histórico de snapshots</span>
        <Button label="Refrescar" text size="small" @click="cargarHistorial">
          <template #icon><HistoryIcon class="size-[1em]" /></template>
        </Button>
      </div>
      <div v-if="historial.length" class="overflow-x-auto rounded-lg border" style="border-color:rgba(44,32,57,0.10)">
        <table class="w-full text-xs">
          <thead>
            <tr style="background:rgba(145,91,216,0.06);color:#6b5a8a">
              <th class="text-left px-3 py-2">Corte</th><th class="text-left px-3 py-2">Ventana</th>
              <th class="text-left px-3 py-2">Período</th><th class="text-right px-3 py-2">Neto (MWh)</th>
              <th class="text-right px-3 py-2">Precio</th><th class="text-right px-3 py-2">Garantía</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in historial" :key="s.id" class="border-t" style="border-color:rgba(44,32,57,0.06)">
              <td class="px-3 py-2">{{ s.fecha_corte }}</td>
              <td class="px-3 py-2">{{ etiquetaClave(s.clave) }}</td>
              <td class="px-3 py-2">{{ s.mes }}/{{ s.anio }}</td>
              <td class="px-3 py-2 text-right">{{ s.neto_mwh != null ? s.neto_mwh.toFixed(1) : '—' }}</td>
              <td class="px-3 py-2 text-right">{{ s.precio_bolsa != null ? fmtCOP(s.precio_bolsa) : '—' }}</td>
              <td class="px-3 py-2 text-right font-semibold">{{ s.garantia_total != null ? fmtCOP(s.garantia_total) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-xs" style="color:#8a7aa5">Aún no hay snapshots guardados.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { fmtCOP } from '../AjustesXM/utils/formatters.js'
import { ProyeccionesGarantiasService } from '~/features/garantias/services/proyecciones'
import { CalculatorIcon, HistoryIcon, RefreshCwIcon, SaveIcon } from '@lucide/vue'

const proyeccionesApi = new ProyeccionesGarantiasService()

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const plantasNuevas = ref(0)
const kwhPlantaNueva = ref(180)
const data = ref(null)
const historial = ref([])
const cargando = ref(false)
const guardando = ref(false)

function tituloVentana(v) {
  const periodo = `${MESES[v.mes] || v.mes} ${v.anio}`
  return v.clave === 'resto_mes_actual' ? `Resto del mes actual · ${periodo}` : `Mes siguiente · ${periodo}`
}
function etiquetaClave(c) {
  return c === 'resto_mes_actual' ? 'Resto mes actual' : 'Mes siguiente'
}
function fmtMWh(v) {
  return v != null ? `${v.toFixed(1)} MWh` : '—'
}

async function cargar() {
  cargando.value = true
  try {
    data.value = await proyeccionesApi.obtener({
      plantasNuevas: plantasNuevas.value || 0,
      kwhPlantaNueva: kwhPlantaNueva.value || 0,
    })
  } catch (e) {
    toast.error('No se pudo calcular la proyección', {
      description: e.data?.detail || e.message,
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
      description: e.data?.detail || e.message,
      duration: 5000,
    })
  }
}

async function guardarPagado(v) {
  v._guardando = true
  try {
    await proyeccionesApi.registrarPago({ anio: v.anio, mes: v.mes, valor: v.pagado || 0 })
    // Recalcula el saldo en la tarjeta SIN recargar todo (evita el parpadeo y no
    // pierde el foco): saldo = pagado − garantía estimada.
    v.saldo = (v.pagado || 0) - (v.garantia_total || 0)
  } catch (e) {
    toast.error('No se pudo guardar el pagado', {
      description: e.data?.detail || e.message,
      duration: 5000,
    })
  } finally {
    v._guardando = false
  }
}

async function guardar() {
  guardando.value = true
  try {
    await proyeccionesApi.guardarSnapshot({
      plantasNuevas: plantasNuevas.value || 0,
      kwhPlantaNueva: kwhPlantaNueva.value || 0,
    })
    toast.success('Snapshot guardado', { duration: 3000 })
    await cargarHistorial()
  } catch (e) {
    toast.error('No se pudo guardar el snapshot', {
      description: e.data?.detail || e.message,
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
