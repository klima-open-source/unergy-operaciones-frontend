<script setup lang="ts">
/**
 * Los PPA de una planta, con sus condiciones, dentro de la pestaña Servicios del
 * proyecto. Un PPA cubre varias plantas: aquí se ve el contrato completo (partes,
 * vigencia, tarifa, cantidades, facturación) y se abre su ficha para editarlo.
 */
import { ExternalLinkIcon, FolderOpenIcon, ZapIcon } from '@lucide/vue'
import InfoField from '~/components/blocks/InfoField.vue'
import { normalizeError } from '~/core/errors'
import { PpaService } from '~/features/contratos/services/ppa'
import type { ContratoPpa } from '~/features/contratos/types'
import { formatCOP } from '~/utils/currency'
import { hoyColombia } from '~/utils/fecha'

const props = defineProps<{ proyectoId: number }>()

const servicio = new PpaService()
const cargando = ref(true)
const error = ref<string | null>(null)
const contratos = ref<ContratoPpa[]>([])

onMounted(async () => {
  try {
    contratos.value = await servicio.listar({ proyecto_id: props.proyectoId })
  } catch (e) {
    error.value = normalizeError(e).message
  } finally {
    cargando.value = false
  }
})

const hoy = hoyColombia()

type Vigencia = { label: string; color: 'success' | 'warning' | 'default' }
function vigencia(c: ContratoPpa): Vigencia {
  if (c.fecha_inicio && c.fecha_inicio > hoy) return { label: 'Por iniciar', color: 'warning' }
  if (c.fecha_fin && c.fecha_fin < hoy) return { label: 'Vencido', color: 'default' }
  return { label: 'Vigente', color: 'success' }
}

const nombre = (c: ContratoPpa) => c.nombre_interno || c.numero_codigo_contrato || `PPA #${c.id}`
const tipo = (c: ContratoPpa) =>
  c.tipo_contrato === 'compra' ? 'Compra' : c.tipo_contrato === 'venta' ? 'Venta' : (c.tipo_contrato ?? null)
const kwh = (v: number | null | undefined) =>
  v == null ? null : `${Number(v).toLocaleString('es-CO')} kWh/mes`
const tarifa = (c: ContratoPpa) =>
  c.tarifa_base == null ? null : `${formatCOP(c.tarifa_base)}/kWh`
const indexacion = (c: ContratoPpa) =>
  [c.indice_indexacion, c.periodicidad_indexacion].filter(Boolean).join(' · ') || null
const periodo = (c: ContratoPpa) =>
  c.fecha_inicio || c.fecha_fin ? `${c.fecha_inicio ?? '—'} → ${c.fecha_fin ?? 'sin fin'}` : null
</script>

<template>
  <div v-if="cargando" class="flex justify-center py-12"><Spinner class="size-6" /></div>

  <Alert v-else-if="error" variant="destructive">
    <AlertDescription>{{ error }}</AlertDescription>
  </Alert>

  <div
    v-else-if="!contratos.length"
    class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center"
  >
    <ZapIcon class="size-6 text-muted-foreground" />
    <p class="text-sm font-medium text-muted-foreground">Esta planta no está en ningún PPA</p>
    <p class="text-xs text-muted-foreground">Las plantas se agregan desde la ficha de cada PPA.</p>
  </div>

  <div v-else class="flex flex-col gap-4">
    <section
      v-for="c in contratos"
      :key="c.id"
      class="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
    >
      <header class="flex flex-wrap items-center gap-2">
        <ZapIcon class="size-4 text-primary" />
        <h3 class="text-sm font-semibold text-foreground">{{ nombre(c) }}</h3>
        <GBadge v-if="tipo(c)" color="default" class="text-xs">{{ tipo(c) }}</GBadge>
        <GBadge :color="vigencia(c).color" class="text-xs">{{ vigencia(c).label }}</GBadge>
        <div class="ml-auto flex items-center gap-1.5">
          <Button v-if="c.carpeta_link" variant="ghost" size="sm" as-child>
            <a :href="c.carpeta_link" target="_blank" rel="noopener"><FolderOpenIcon class="size-4" /> Carpeta</a>
          </Button>
          <Button variant="outline" size="sm" as-child>
            <NuxtLink :to="`/contratos/${c.id}`"><ExternalLinkIcon class="size-4" /> Ver detalle completo</NuxtLink>
          </Button>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoField label="Comprador" :value="c.comprador_nombre" />
        <InfoField label="Vendedor" :value="c.vendedor_nombre" />
        <InfoField label="Vigencia" :value="periodo(c)" />
        <InfoField label="Plantas en el PPA" :value="c.proyectos?.length ?? null" />
        <InfoField label="Tarifa base" :value="tarifa(c)" />
        <InfoField label="Indexación" :value="indexacion(c)" />
        <InfoField label="Cantidad mínima" :value="kwh(c.cantidad_minima_kwh_mes)" />
        <InfoField label="Cantidad máxima" :value="kwh(c.cantidad_maxima_kwh_mes)" />
        <InfoField label="Facturación" :value="c.periodicidad_facturacion" />
        <InfoField label="Tiempo de pago" :value="c.tiempo_pago" />
        <InfoField label="Código SIC" :value="c.codigo_sic" />
        <InfoField label="Código GESCON" :value="c.gescon_codigo" />
      </div>
    </section>
  </div>
</template>
