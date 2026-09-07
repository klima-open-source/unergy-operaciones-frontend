<template>
  <table class="w-full text-xs border-t border-gray-200">
    <thead>
      <tr class="bg-gray-100 text-gray-600">
        <th class="px-3 py-1.5 text-left w-44">Inversionista</th>
        <th class="px-3 py-1.5 text-left w-24">Doc. contable</th>
        <th class="px-3 py-1.5 text-left">Concepto</th>
        <th class="px-3 py-1.5 text-right w-36">Total</th>
        <th class="px-3 py-1.5 text-left w-36">Ref. Factura / Soporte</th>
        <th class="px-3 py-1.5 text-left w-24">Consecutivo</th>
      </tr>
    </thead>
    <tbody>
      <!-- Fila TOTAL del proyecto (solo si no es modo inversionista) -->
      <template v-if="!modoInversionista">
        <tr class="bg-indigo-50 font-semibold border-b border-indigo-200">
          <td class="px-3 py-1.5 text-indigo-800 font-bold" colspan="2">
            Total
            <span class="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-200 text-indigo-800 tracking-wide">
              100% PROYECTO
            </span>
          </td>
          <td class="px-3 py-1.5 text-indigo-600">Porcentaje de Participación</td>
          <td class="px-3 py-1.5 text-right text-indigo-800">100.00%</td>
          <td colspan="2" />
        </tr>
        <tr v-for="fila in filasTotal" :key="fila.key" :class="bgFila(fila.doc)"
          class="border-b border-gray-100 hover:bg-gray-50">
          <td class="px-3 py-1.5" />
          <td class="px-3 py-1.5"><span :class="colorDoc(fila.doc)">{{ fila.doc }}</span></td>
          <td class="px-3 py-1.5">{{ fila.concepto }}</td>
          <td class="px-3 py-1.5 text-right font-mono" :class="fila.negativo ? 'text-red-600 bg-red-50' : ''">
            {{ fmtCOP(fila.valor) }}
          </td>
          <td class="px-3 py-1.5">
            <a v-if="fila.url" :href="fila.url" target="_blank"
              class="flex items-center gap-1 text-blue-600 hover:underline">
              <FileTextIcon class="text-red-500 text-xs size-[1em]" />{{ fila.ref }}
            </a>
            <span v-else class="text-gray-500">{{ fila.ref }}</span>
          </td>
          <td class="px-3 py-1.5 text-gray-400">{{ fila.consecutivo }}</td>
        </tr>
      </template>

      <!-- Filas por inversionista -->
      <template v-for="inv in inversionistas" :key="inv.inversionista_id">
        <tr class="bg-gray-800 text-white border-t-2 border-gray-600">
          <td class="px-3 py-1.5 font-semibold truncate max-w-[176px]" :title="inv.nombre">
            {{ inv.nombre }}
          </td>
          <td class="px-3 py-1.5 text-gray-300">Información</td>
          <td class="px-3 py-1.5 text-gray-300">Porcentaje de Participación</td>
          <td class="px-3 py-1.5 text-right font-semibold">{{ pct(inv.porcentaje) }}</td>
          <td colspan="2" />
        </tr>
        <tr v-for="fila in inv.filas" :key="fila.key" :class="bgFila(fila.doc)"
          class="border-b border-gray-100 hover:bg-gray-50">
          <td class="px-3 py-1.5" />
          <td class="px-3 py-1.5"><span :class="colorDoc(fila.doc)">{{ fila.doc }}</span></td>
          <td class="px-3 py-1.5">{{ fila.concepto }}</td>
          <td class="px-3 py-1.5 text-right font-mono" :class="fila.negativo ? 'text-red-600 bg-red-50' : ''">
            {{ fmtCOP(fila.valor) }}
          </td>
          <td class="px-3 py-1.5">
            <a v-if="fila.url" :href="fila.url" target="_blank"
              class="flex items-center gap-1 text-blue-600 hover:underline">
              <FileTextIcon class="text-red-500 text-xs size-[1em]" />{{ fila.ref }}
            </a>
            <span v-else class="text-gray-500">{{ fila.ref }}</span>
          </td>
          <td class="px-3 py-1.5 text-gray-400">{{ fila.consecutivo }}</td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from 'vue'
import { fmtCOP } from '~/features/liquidaciones/utils/liquidaciones'
import { FileTextIcon } from '@lucide/vue'

const props = defineProps({
  liquidacion: { type: Object, required: true },
  modoInversionista: { type: Boolean, default: false },
})

const ETIQUETAS = {
  ingreso_bruto: 'Ingreso Bruto',
  ajuste_xm: 'Ajuste Xm',
  ajuste_unergy: 'Ajuste Unergy',
  ajuste_comercializacion: 'Comercialización',
  intereses: 'Intereses',
  otro_ingreso: 'Otro Ingreso',
  despacho: 'Despacho',
  ventas_en_bolsa: 'Ventas en Bolsa',
  compras_en_bolsa: 'Compras en Bolsa',
  redistribucion_ingresos: 'Redistribución de Ingresos de acuerdo al Protocolo',
  mantenimiento: 'Mantenimiento',
  arriendo: 'Arriendo',
  servicio_internet: 'Servicio de Internet',
  iva_internet: 'IVA Internet',   // Bug 2
  poliza_cumplimiento: 'Póliza de Cumplimiento',
  servicios_publicos_consumo: 'Servicios Públicos Consumo de energía',
  cambio_equipos_medida: 'Cambio Equipos de Medida',
  seguro: 'Seguro',
  otro_costo: 'Otro Costo',
  comercializacion: 'Comercialización',
  representacion: 'Representación',
  cgm: 'CGM',
  administracion: 'Administración',
  iva: 'IVA',
  retencion_fuente: 'Retención en la Fuente',
  reteica: 'Reteica',
  ica_opex: 'ICA OPEX',
  otro_impuesto: 'Otro Impuesto',
  porcentaje_participacion: 'Porcentaje de Participación',
  valor_a_pagar: 'Valor a Pagar',
}

// Bug 1: conceptos que pertenecen SOLO a la sección Factura
const TIPOS_FACTURA = new Set(['representacion', 'cgm', 'administracion', 'administracion_operacion'])

const COSTOS_NEG = new Set([
  'ajuste_comercializacion', 'arriendo', 'mantenimiento', 'servicio_internet',
  'poliza_cumplimiento', 'servicios_publicos_consumo', 'cambio_equipos_medida',
  'seguro', 'otro_costo', 'compras_en_bolsa', 'comercializacion',
  'representacion', 'cgm', 'administracion', 'iva', 'retencion_fuente',
  'reteica', 'ica_opex', 'otro_impuesto',
])

function etiquetaLinea(l) {
  // Bug 2: iva_internet tiene su propia etiqueta
  if (ETIQUETAS[l.tipo_linea]) return ETIQUETAS[l.tipo_linea]
  return l.concepto
}

function mandatosAFilas(mandatos, docLabel, consecutivoBase) {
  const filas = []
  for (const m of (mandatos || [])) {
    for (const l of (m.lineas || [])) {
      // Bug 1: filtrar conceptos de Factura que no corresponden a Mandato/Costos
      if (docLabel === 'Mandato' && TIPOS_FACTURA.has(l.tipo_linea)) continue
      filas.push({
        key: `${m.id}_${l.id}`,
        doc: docLabel,
        concepto: etiquetaLinea(l),
        valor: l.valor_cop,
        negativo: COSTOS_NEG.has(l.tipo_linea),
        ref: l.referencia_factura,
        url: null,
        consecutivo: m.consecutivo ?? consecutivoBase,
      })
    }
  }
  return filas
}

const filasTotal = computed(() => {
  const liq = props.liquidacion
  const filas = []
  const ingSrc = liq.mandatos_total_ingresos ?? liq.mandatos_ingresos
  const cosSrc = liq.mandatos_total_costos  ?? liq.mandatos_costos

  const vistosIng = new Set()
  for (const m of (ingSrc || [])) {
    for (const l of (m.lineas || [])) {
      if (TIPOS_FACTURA.has(l.tipo_linea)) continue
      if (vistosIng.has(l.tipo_linea)) continue
      vistosIng.add(l.tipo_linea)
      filas.push({
        key: `ing_${l.tipo_linea}`,
        doc: 'Mandato',
        concepto: etiquetaLinea(l),
        valor: l.valor_cop,
        negativo: COSTOS_NEG.has(l.tipo_linea),
        ref: l.referencia_factura,
        url: null,
        consecutivo: m.consecutivo ?? liq.consecutivo_inicial_ingresos,
      })
    }
  }

  const vistosCos = new Set()
  for (const m of (cosSrc || [])) {
    for (const l of (m.lineas || [])) {
      if (vistosCos.has(l.tipo_linea)) continue
      vistosCos.add(l.tipo_linea)
      filas.push({
        key: `cos_${l.tipo_linea}`,
        doc: 'Costos',
        concepto: etiquetaLinea(l),
        valor: l.valor_cop,
        negativo: true,
        ref: l.referencia_factura,
        url: null,
        consecutivo: m.consecutivo ?? liq.consecutivo_inicial_costos,
      })
    }
  }

  const vistosFac = new Set()
  for (const f of (liq.facturas_servicio || [])) {
    if (vistosFac.has(f.tipo_servicio)) continue
    vistosFac.add(f.tipo_servicio)
    filas.push({
      key: `f_${f.tipo_servicio}`,
      doc: 'Factura',
      concepto: {
        representacion: 'Representación',
        cgm: 'CGM',
        administracion_operacion: 'Administración',
      }[f.tipo_servicio] || f.tipo_servicio,
      valor: f.valor_cop,
      negativo: false,
      ref: f.numero_factura || f.nro_soporte,
      url: f.soporte_url,
      consecutivo: null,
    })
  }
  return filas
})

const inversionistas = computed(() => {
  const liq = props.liquidacion
  const map = {}

  const allMandatos = [
    ...(liq.mandatos_ingresos || []),
    ...(liq.mandatos_costos || []),
    // Vista por proyecto usa liq.inversionistas
  ]

  // Vista por proyecto: liq.inversionistas tiene la estructura completa
  if (liq.inversionistas) {
    for (const inv of liq.inversionistas) {
      if (!map[inv.inversionista_id]) {
        map[inv.inversionista_id] = {
          inversionista_id: inv.inversionista_id,
          nombre: inv.inversionista_nombre,
          porcentaje: inv.porcentaje_participacion,
          filas: [],
        }
      }
      map[inv.inversionista_id].filas.push(
        ...mandatosAFilas(inv.mandatos_ingresos, 'Mandato', liq.consecutivo_inicial_ingresos),
        ...mandatosAFilas(inv.mandatos_costos, 'Costos', liq.consecutivo_inicial_costos),
      )
    }
    return Object.values(map)
  }

  // Vista por inversionista: liq ya es el proyecto de un inversionista
  return [{
    inversionista_id: 0,
    nombre: '',
    porcentaje: liq.porcentaje_participacion,
    filas: [
      ...mandatosAFilas(liq.mandatos_ingresos, 'Mandato', null),
      ...mandatosAFilas(liq.mandatos_costos, 'Costos', null),
      ...(liq.facturas_servicio || []).map(f => ({
        key: `f_${f.id}`,
        doc: 'Factura',
        concepto: { representacion: 'Representación', cgm: 'CGM', administracion_operacion: 'Administración' }[f.tipo_servicio] || f.tipo_servicio,
        valor: f.valor_cop,
        negativo: false,
        ref: f.numero_factura || f.nro_soporte,
        url: f.soporte_url,
        consecutivo: null,
      })),
    ],
  }]
})

function pct(v) {
  if (v == null) return '—'
  return (v * 100).toFixed(4) + '%'
}

function bgFila(doc) {
  return { Mandato: 'bg-green-50', Costos: 'bg-pink-50', Factura: 'bg-yellow-50' }[doc] || ''
}

function colorDoc(doc) {
  return {
    Mandato: 'text-green-700 font-medium',
    Costos: 'text-pink-700 font-medium',
    Factura: 'text-yellow-700 font-medium',
  }[doc] || ''
}
</script>
