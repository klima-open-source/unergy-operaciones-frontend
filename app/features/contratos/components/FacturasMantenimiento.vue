<template>
  <template v-if="contratoId">

    <!-- ══ SECCIÓN 1: Facturas Solenium ══════════════════════════════════════════ -->
    <div class="rounded-xl border bg-white overflow-hidden" style="border-color:#e5e7eb">

      <!-- Header colapsable -->
      <button type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors duration-150 text-left select-none"
        @click="openSol = !openSol">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style="background:#fef3c7">
            <ReceiptIcon class="text-sm size-[1em]" style="color:#f59e0b" />
          </div>
          <div>
            <p class="text-xs text-gray-400 leading-none mb-0.5">Proveedor O&amp;M</p>
            <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Facturas Solenium</span>
          </div>
          <span class="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 py-0.5 leading-none ml-1"
            style="background:#fef3c7; color:#d97706">
            {{ facturasSol.length }}
          </span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span v-if="facturasSol.length" class="text-xs text-gray-400 hidden sm:block">
            Total: <strong style="color:#d97706">{{ formatCOP(totalSol) }}</strong>
          </span>
          <ChevronDownIcon class="text-xs text-gray-400 transition-transform duration-200 size-[1em]" :style="openSol ? 'transform:rotate(180deg)' : ''" />
        </div>
      </button>

      <!-- Contenido colapsable -->
      <div class="factura-collapse" :class="{ open: openSol }">
        <div class="border-t border-gray-100">

          <!-- Barra de filtros + botón agregar -->
          <div class="flex flex-wrap items-center gap-2 px-5 py-3 bg-gray-50/60 border-b border-gray-100">
            <FilterIcon class="text-xs text-gray-400 size-[1em]" />
            <span class="text-xs text-gray-400 font-medium mr-1">Filtrar:</span>
            <Select v-model="filtroSol.año" :options="AÑOS_OPT" placeholder="Año"
              showClear class="text-sm" style="height:32px;min-width:88px" />
            <Select v-model="filtroSol.mes" :options="MESES_OPT"
              optionLabel="label" optionValue="value" placeholder="Mes"
              showClear class="text-sm" style="height:32px;min-width:108px" />
            <button v-if="filtroSol.año || filtroSol.mes" type="button"
              class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded hover:bg-gray-100"
              style="background:none;border:none;cursor:pointer"
              @click="filtroSol.año = null; filtroSol.mes = null">
              <XIcon class="text-xs size-[1em]" /> Limpiar
            </button>
            <span v-if="filtroSol.año || filtroSol.mes"
              class="text-xs text-gray-400">
              {{ solFiltradas.length }} resultado{{ solFiltradas.length !== 1 ? 's' : '' }}
            </span>
            <div class="ml-auto">
              <Button label="+ Agregar factura" size="small" text
                style="color:#f59e0b; font-weight:600; padding:4px 10px"
                :disabled="loading"
                @click="abrirModal('solenium')" />
            </div>
          </div>

          <!-- Tabla -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-gray-100" style="background:#fafafa">
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Fecha</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">N° Factura</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">Monto</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 whitespace-nowrap" style="width:80px">Soporte</th>
                  <th class="px-4 py-2.5" style="width:44px"></th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading -->
                <tr v-if="loading">
                  <td colspan="5" class="px-4 py-8 text-center text-gray-400 text-xs">
                    <LoaderCircleIcon class="mr-1 size-[1em] animate-spin" />Cargando…
                  </td>
                </tr>
                <!-- Empty state -->
                <tr v-else-if="!solFiltradas.length">
                  <td colspan="5" class="px-4 py-10 text-center">
                    <div class="flex flex-col items-center gap-2.5">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:#fef3c7">
                        <ReceiptIcon class="text-lg size-[1em]" style="color:#f59e0b" />
                      </div>
                      <p class="text-sm font-medium text-gray-500">
                        {{ facturasSol.length ? 'Sin resultados para los filtros aplicados' : 'Sin facturas Solenium registradas' }}
                      </p>
                      <Button v-if="!facturasSol.length" label="Agregar primera factura" size="small"
                        style="background:#f59e0b;border-color:#f59e0b;margin-top:2px"
                        @click="abrirModal('solenium')" />
                    </div>
                  </td>
                </tr>
                <!-- Filas -->
                <tr v-for="fac in solFiltradas" :key="fac.id"
                  class="border-b border-gray-50 transition-colors duration-100"
                  :class="isPending(fac) ? 'fila-pendiente' : 'hover:bg-amber-50/30'">
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-[13px]" style="color:var(--color-unergy-deep)">{{ fac.fecha }}</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm" style="color:#374151">{{ fac.numero_factura || '—' }}</span>
                      <span v-if="isPending(fac)"
                        class="inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 leading-none flex-shrink-0"
                        style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa">
                        Pendiente
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-semibold tabular-nums text-sm" style="color:var(--color-unergy-deep)">
                      {{ formatCOP(fac.monto) }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <a v-if="fac.enlace_soporte"
                      :href="fac.enlace_soporte" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium hover:underline transition-colors"
                      style="color:#f59e0b">
                      <ExternalLinkIcon class="text-xs size-[1em]" />Ver
                    </a>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <button type="button"
                      class="w-7 h-7 rounded-lg inline-flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      style="background:none;border:none;cursor:pointer"
                      @click="eliminarFactura('solenium', fac.id)">
                      <Trash2Icon class="text-xs size-[1em]" />
                    </button>
                  </td>
                </tr>
              </tbody>
              <!-- Fila de totales -->
              <tfoot v-if="!loading && solFiltradas.length">
                <tr style="background:#fffbeb;border-top:1px solid #fde68a">
                  <td colspan="2" class="px-4 py-2.5">
                    <span class="text-xs font-semibold text-gray-500">
                      Total {{ filtroSol.año || filtroSol.mes ? 'filtrado' : '' }}
                      · {{ solFiltradas.length }} factura{{ solFiltradas.length !== 1 ? 's' : '' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-bold tabular-nums text-sm" style="color:#d97706">
                      {{ formatCOP(totalSolFiltrado) }}
                    </span>
                  </td>
                  <td colspan="2" />
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      </div>
    </div>

    <!-- ══ SECCIÓN 2: Facturas Inversionistas ════════════════════════════════════ -->
    <div class="rounded-xl border bg-white overflow-hidden" style="border-color:#e5e7eb">

      <!-- Header colapsable -->
      <button type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors duration-150 text-left select-none"
        @click="openInv = !openInv">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style="background:#eff6ff">
            <UsersIcon class="text-sm size-[1em]" style="color:#3b82f6" />
          </div>
          <div>
            <p class="text-xs text-gray-400 leading-none mb-0.5">Cobros a clientes</p>
            <span class="text-sm font-semibold" style="color:var(--color-unergy-deep)">Facturas Inversionistas</span>
          </div>
          <span class="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 py-0.5 leading-none ml-1"
            style="background:#dbeafe; color:#3b82f6">
            {{ facturasInv.length }}
          </span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span v-if="facturasInv.length" class="text-xs text-gray-400 hidden sm:block">
            Total: <strong style="color:#3b82f6">{{ formatCOP(totalInv) }}</strong>
          </span>
          <ChevronDownIcon class="text-xs text-gray-400 transition-transform duration-200 size-[1em]" :style="openInv ? 'transform:rotate(180deg)' : ''" />
        </div>
      </button>

      <!-- Contenido colapsable -->
      <div class="factura-collapse" :class="{ open: openInv }">
        <div class="border-t border-gray-100">

          <!-- Barra de filtros + botón agregar -->
          <div class="flex flex-wrap items-center gap-2 px-5 py-3 bg-gray-50/60 border-b border-gray-100">
            <FilterIcon class="text-xs text-gray-400 size-[1em]" />
            <span class="text-xs text-gray-400 font-medium mr-1">Filtrar:</span>
            <Select v-model="filtroInv.año" :options="AÑOS_OPT" placeholder="Año"
              showClear class="text-sm" style="height:32px;min-width:88px" />
            <Select v-model="filtroInv.mes" :options="MESES_OPT"
              optionLabel="label" optionValue="value" placeholder="Mes"
              showClear class="text-sm" style="height:32px;min-width:108px" />
            <button v-if="filtroInv.año || filtroInv.mes" type="button"
              class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded hover:bg-gray-100"
              style="background:none;border:none;cursor:pointer"
              @click="filtroInv.año = null; filtroInv.mes = null">
              <XIcon class="text-xs size-[1em]" /> Limpiar
            </button>
            <span v-if="filtroInv.año || filtroInv.mes"
              class="text-xs text-gray-400">
              {{ invFiltradas.length }} resultado{{ invFiltradas.length !== 1 ? 's' : '' }}
            </span>
            <div class="ml-auto">
              <Button label="+ Agregar factura" size="small" text
                style="color:#3b82f6; font-weight:600; padding:4px 10px"
                :disabled="loading"
                @click="abrirModal('inversionistas')" />
            </div>
          </div>

          <!-- Tabla -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-gray-100" style="background:#fafafa">
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Fecha</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Inversionista</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">N° Factura</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">Monto</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 whitespace-nowrap" style="width:80px">Soporte</th>
                  <th class="px-4 py-2.5" style="width:44px"></th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading -->
                <tr v-if="loading">
                  <td colspan="6" class="px-4 py-8 text-center text-gray-400 text-xs">
                    <LoaderCircleIcon class="mr-1 size-[1em] animate-spin" />Cargando…
                  </td>
                </tr>
                <!-- Empty state -->
                <tr v-else-if="!invFiltradas.length">
                  <td colspan="6" class="px-4 py-10 text-center">
                    <div class="flex flex-col items-center gap-2.5">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:#dbeafe">
                        <UsersIcon class="text-lg size-[1em]" style="color:#3b82f6" />
                      </div>
                      <p class="text-sm font-medium text-gray-500">
                        {{ facturasInv.length ? 'Sin resultados para los filtros aplicados' : 'Sin facturas de inversionistas registradas' }}
                      </p>
                      <Button v-if="!facturasInv.length" label="Agregar primera factura" size="small"
                        style="background:#3b82f6;border-color:#3b82f6;margin-top:2px"
                        @click="abrirModal('inversionistas')" />
                    </div>
                  </td>
                </tr>
                <!-- Filas -->
                <tr v-for="fac in invFiltradas" :key="fac.id"
                  class="border-b border-gray-50 transition-colors duration-100"
                  :class="isPending(fac) ? 'fila-pendiente' : 'hover:bg-blue-50/30'">
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-[13px]" style="color:var(--color-unergy-deep)">{{ fac.fecha }}</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <span class="text-sm" style="color:#374151">{{ fac.inversionista || '—' }}</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm" style="color:#374151">{{ fac.numero_factura || '—' }}</span>
                      <span v-if="isPending(fac)"
                        class="inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 leading-none flex-shrink-0"
                        style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe">
                        Pendiente
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-semibold tabular-nums text-sm" style="color:var(--color-unergy-deep)">
                      {{ formatCOP(fac.monto) }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <a v-if="fac.enlace_soporte"
                      :href="fac.enlace_soporte" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium hover:underline transition-colors"
                      style="color:#3b82f6">
                      <ExternalLinkIcon class="text-xs size-[1em]" />Ver
                    </a>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <button type="button"
                      class="w-7 h-7 rounded-lg inline-flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      style="background:none;border:none;cursor:pointer"
                      @click="eliminarFactura('inversionistas', fac.id)">
                      <Trash2Icon class="text-xs size-[1em]" />
                    </button>
                  </td>
                </tr>
              </tbody>
              <!-- Fila de totales -->
              <tfoot v-if="!loading && invFiltradas.length">
                <tr style="background:#eff6ff;border-top:1px solid #bfdbfe">
                  <td colspan="3" class="px-4 py-2.5">
                    <span class="text-xs font-semibold text-gray-500">
                      Total {{ filtroInv.año || filtroInv.mes ? 'filtrado' : '' }}
                      · {{ invFiltradas.length }} factura{{ invFiltradas.length !== 1 ? 's' : '' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-bold tabular-nums text-sm" style="color:#3b82f6">
                      {{ formatCOP(totalInvFiltrado) }}
                    </span>
                  </td>
                  <td colspan="2" />
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      </div>
    </div>

    <!-- ══ MODAL: Agregar factura ════════════════════════════════════════════════ -->
    <Dialog v-model:visible="modal.visible" modal :style="{ width: '440px' }"
      :breakpoints="{ '500px': '95vw' }">
      <template #header>
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            :style="modal.tipo === 'solenium' ? 'background:#fef3c7' : 'background:#dbeafe'">
            <ReceiptIcon class="text-xs size-[1em]" :style="modal.tipo === 'solenium' ? 'color:#f59e0b' : 'color:#3b82f6'" />
          </div>
          <span class="font-semibold text-sm" style="color:var(--color-unergy-deep)">
            Agregar factura — {{ modal.tipo === 'solenium' ? 'Solenium' : 'Inversionistas' }}
          </span>
        </div>
      </template>
      <div class="space-y-4 pt-1">
        <!-- Fecha + N° Factura -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">
              Fecha (YYYY-MM) <span class="text-red-400">*</span>
            </label>
            <InputText v-model="modal.form.fecha"
              placeholder="2026-01" class="w-full"
              :class="{ 'p-invalid': modal.errores.fecha }" />
            <p v-if="modal.errores.fecha" class="text-xs text-red-400">{{ modal.errores.fecha }}</p>
            <p v-else class="text-xs text-gray-400">Ej: 2026-03</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-600">N° Factura</label>
            <InputText v-model="modal.form.numero_factura"
              placeholder="FE-001234" class="w-full" />
          </div>
        </div>
        <!-- Inversionista (solo para sección inversionistas) -->
        <div v-if="modal.tipo === 'inversionistas'" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Inversionista</label>
          <InputText v-model="modal.form.inversionista"
            placeholder="Nombre del inversionista" class="w-full" />
        </div>
        <!-- Monto -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">
            Monto (COP) <span class="text-red-400">*</span>
          </label>
          <InputNumber v-model="modal.form.monto"
            mode="currency" currency="COP" locale="es-CO" :maxFractionDigits="0"
            class="w-full" placeholder="$ 0"
            :class="{ 'p-invalid': modal.errores.monto }" />
          <p v-if="modal.errores.monto" class="text-xs text-red-400">{{ modal.errores.monto }}</p>
        </div>
        <!-- Link soporte -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Link de soporte (Drive)</label>
          <InputText v-model="modal.form.enlace_soporte"
            placeholder="https://drive.google.com/…" class="w-full"
            :class="{ 'p-invalid': modal.errores.enlace_soporte }" />
          <p v-if="modal.errores.enlace_soporte" class="text-xs text-red-400">
            {{ modal.errores.enlace_soporte }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="modal.visible = false" />
        <Button label="Agregar factura" :loading="saving" :style="modal.tipo === 'solenium'
            ? 'background:#f59e0b;border-color:#f59e0b'
            : 'background:#3b82f6;border-color:#3b82f6'" @click="guardarFactura">
          <template #icon><CheckIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </Dialog>

  </template>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { toast } from 'vue-sonner'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { formatCOP } from '~/utils/currency'
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, FilterIcon, LoaderCircleIcon, ReceiptIcon, Trash2Icon, UsersIcon, XIcon } from '@lucide/vue'

const contratosServicioService = new ContratosServicioService()

// ── Props ──────────────────────────────────────────────────────────────────────
const props = defineProps({
  contratoId: { type: Number, default: null },
})


// ── Catálogos ──────────────────────────────────────────────────────────────────
const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MESES_OPT = MESES_NOMBRES.slice(1).map((m, i) => ({ label: m, value: i + 1 }))
const AÑO_ACTUAL = new Date().getFullYear()
const AÑOS_OPT   = Array.from({ length: AÑO_ACTUAL - 2020 + 2 }, (_, i) => 2020 + i)

// ── Estado ─────────────────────────────────────────────────────────────────────
const facturasSol = ref([])
const facturasInv = ref([])
const loading     = ref(false)
const saving      = ref(false)
const openSol     = ref(false)
const openInv     = ref(false)

const filtroSol = reactive({ año: null, mes: null })
const filtroInv = reactive({ año: null, mes: null })

const modal = reactive({
  visible: false,
  tipo: 'solenium',
  form: { fecha: '', numero_factura: '', monto: null, enlace_soporte: '' },
  errores: {},
})

/**
 * Una fila está "pendiente" si no tiene número de factura, monto ni soporte.
 */
function isPending(fac) {
  return !fac.numero_factura && fac.monto == null && !fac.enlace_soporte
}

// ── Computed ───────────────────────────────────────────────────────────────────
function filtrarPeriodo(lista, f) {
  let r = lista
  if (f.año) r = r.filter(x => x.fecha?.startsWith(String(f.año)))
  if (f.mes) {
    const mm = String(f.mes).padStart(2, '0')
    r = r.filter(x => x.fecha?.slice(5, 7) === mm)
  }
  return r
}

const solFiltradas       = computed(() => filtrarPeriodo(facturasSol.value, filtroSol))
const invFiltradas       = computed(() => filtrarPeriodo(facturasInv.value, filtroInv))
const totalSol           = computed(() => facturasSol.value.reduce((s, f) => s + (f.monto || 0), 0))
const totalInv           = computed(() => facturasInv.value.reduce((s, f) => s + (f.monto || 0), 0))
const totalSolFiltrado   = computed(() => solFiltradas.value.reduce((s, f) => s + (f.monto || 0), 0))
const totalInvFiltrado   = computed(() => invFiltradas.value.reduce((s, f) => s + (f.monto || 0), 0))

// ── Carga ──────────────────────────────────────────────────────────────────────
async function load() {
  if (!props.contratoId) return
  loading.value = true
  try {
    const data = await contratosServicioService.listarFacturas(props.contratoId)
    facturasSol.value = data.filter(f => f.tipo === 'solenium')
    facturasInv.value = data.filter(f => f.tipo === 'inversionista')
  } catch (e) {
    toast.error('Error al cargar facturas', { description: e.data?.detail || e.message, duration: 4000 })
  } finally {
    loading.value = false
  }
}

onMounted(() => { if (props.contratoId) load() })
watch(() => props.contratoId, (id) => { if (id) load() })

// ── Modal ──────────────────────────────────────────────────────────────────────
function abrirModal(tipo) {
  modal.tipo    = tipo
  modal.form    = { fecha: '', inversionista: '', numero_factura: '', monto: null, enlace_soporte: '' }
  modal.errores = {}
  modal.visible = true
}

function validarModal() {
  const e = {}
  const fecha = modal.form.fecha?.trim()
  if (!fecha) {
    e.fecha = 'Campo requerido'
  } else if (!/^\d{4}-\d{2}$/.test(fecha)) {
    e.fecha = 'Formato YYYY-MM requerido (ej: 2026-03)'
  } else {
    const mes = parseInt(fecha.slice(5, 7), 10)
    if (mes < 1 || mes > 12) e.fecha = 'Mes inválido (01–12)'
  }
  if (modal.form.monto == null || modal.form.monto === '') {
    e.monto = 'Campo requerido'
  }
  const link = modal.form.enlace_soporte?.trim()
  if (link && !link.startsWith('http')) {
    e.enlace_soporte = 'Debe ser una URL válida (debe comenzar con http)'
  }
  modal.errores = e
  return Object.keys(e).length === 0
}

async function guardarFactura() {
  if (!validarModal()) return
  saving.value = true
  try {
    const payload = {
      tipo:           modal.tipo === 'solenium' ? 'solenium' : 'inversionista',
      fecha:          modal.form.fecha.trim(),
      inversionista:  modal.form.inversionista?.trim() || null,
      numero_factura: modal.form.numero_factura?.trim() || null,
      monto:          modal.form.monto ?? null,
      enlace_soporte: modal.form.enlace_soporte?.trim() || null,
    }
    const data = await contratosServicioService.crearFactura(props.contratoId, payload)

    if (modal.tipo === 'solenium') facturasSol.value = [...facturasSol.value, data]
    else facturasInv.value = [...facturasInv.value, data]

    modal.visible = false
    toast.success('Factura agregada', { duration: 2500 })
  } catch (e) {
    toast.error('Error al guardar', { description: e.data?.detail ?? e.message, duration: 4000 })
  } finally {
    saving.value = false
  }
}

async function eliminarFactura(tipo, id) {
  if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return
  try {
    await contratosServicioService.eliminarFactura(props.contratoId, id)
    if (tipo === 'solenium') facturasSol.value = facturasSol.value.filter(f => f.id !== id)
    else facturasInv.value = facturasInv.value.filter(f => f.id !== id)
    toast.success('Factura eliminada', { duration: 2000 })
  } catch (e) {
    toast.error('Error al eliminar', { description: e.data?.detail || e.message, duration: 3000 })
  }
}

</script>

<style scoped>
.factura-collapse {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.38s ease-out;
}
.factura-collapse.open {
  max-height: 3600px;
  transition: max-height 0.45s ease-in;
}

/* Filas pendientes (sin factura, monto ni soporte) */
.fila-pendiente {
  opacity: 0.48;
}
.fila-pendiente:hover {
  opacity: 0.72;
  background-color: #fffbeb;
}
</style>
