<template>
  <template v-if="contratoId">

    <!-- ══ SECCIÓN 1: Facturas Solenium ══════════════════════════════════════ -->
    <div class="rounded-xl border border-border bg-card overflow-hidden">

      <!-- Header colapsable -->
      <button type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors duration-150 text-left select-none"
        @click="openSol = !openSol">
        <div class="flex items-center gap-2.5">
          <div class="size-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-warning/15 text-warning">
            <ReceiptIcon class="size-4" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground leading-none mb-0.5">Proveedor O&amp;M</p>
            <span class="text-sm font-semibold text-unergy-deep">Facturas Solenium</span>
          </div>
          <span class="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 py-0.5 leading-none ml-1 bg-warning/15 text-warning">
            {{ facturasSol.length }}
          </span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span v-if="facturasSol.length" class="text-xs text-muted-foreground hidden sm:block">
            Total: <strong class="text-warning">{{ formatCOP(totalSol) }}</strong>
          </span>
          <ChevronDownIcon class="size-3 text-muted-foreground transition-transform duration-200" :class="{ 'rotate-180': openSol }" />
        </div>
      </button>

      <!-- Contenido colapsable -->
      <div
        class="overflow-hidden transition-all"
        :class="openSol ? 'max-h-900 duration-500 ease-in' : 'max-h-0 duration-300 ease-out'"
      >
        <div class="border-t border-border">

          <!-- Barra de filtros + botón agregar -->
          <div class="flex flex-wrap items-center gap-2 px-5 py-3 bg-muted/60 border-b border-border">
            <FilterIcon class="size-3 text-muted-foreground" />
            <span class="text-xs text-muted-foreground font-medium mr-1">Filtrar:</span>
            <Select v-model="filtroSol.año" :options="AÑOS_OPT" placeholder="Año"
              showClear class="text-sm" />
            <Select v-model="filtroSol.mes" :options="MESES_OPT"
              optionLabel="label" optionValue="value" placeholder="Mes"
              showClear class="text-sm" />
            <Button v-if="filtroSol.año || filtroSol.mes" variant="ghost" size="xs"
              class="text-muted-foreground"
              @click="filtroSol.año = null; filtroSol.mes = null">
              <XIcon /> Limpiar
            </Button>
            <span v-if="filtroSol.año || filtroSol.mes"
              class="text-xs text-muted-foreground">
              {{ solFiltradas.length }} resultado{{ solFiltradas.length !== 1 ? 's' : '' }}
            </span>
            <div class="ml-auto text-warning">
              <Button variant="ghost" size="sm" class="font-semibold"
                :disabled="loading"
                @click="abrirModal('solenium')">
                + Agregar factura
              </Button>
            </div>
          </div>

          <!-- Tabla -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-border bg-muted/40">
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Fecha</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">N° Factura</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Monto</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">Soporte</th>
                  <th class="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading -->
                <tr v-if="loading">
                  <td colspan="5" class="px-4 py-8 text-center text-muted-foreground text-xs">
                    <LoaderCircleIcon class="mr-1 inline size-3 animate-spin" />Cargando…
                  </td>
                </tr>
                <!-- Empty state -->
                <tr v-else-if="!solFiltradas.length">
                  <td colspan="5" class="px-4 py-10 text-center">
                    <div class="flex flex-col items-center gap-2.5">
                      <div class="size-10 rounded-full flex items-center justify-center bg-warning/15 text-warning">
                        <ReceiptIcon class="size-5" />
                      </div>
                      <p class="text-sm font-medium text-muted-foreground">
                        {{ facturasSol.length ? 'Sin resultados para los filtros aplicados' : 'Sin facturas Solenium registradas' }}
                      </p>
                      <Button v-if="!facturasSol.length" size="sm" class="mt-0.5"
                        @click="abrirModal('solenium')">
                        Agregar primera factura
                      </Button>
                    </div>
                  </td>
                </tr>
                <!-- Filas -->
                <tr v-for="fac in solFiltradas" :key="fac.id"
                  class="border-b border-border/50 transition-colors duration-100"
                  :class="isPending(fac) ? 'opacity-50 hover:opacity-70 hover:bg-warning/10' : 'hover:bg-warning/5'">
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-sm text-unergy-deep">{{ fac.fecha }}</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-foreground">{{ fac.numero_factura || '—' }}</span>
                      <span v-if="isPending(fac)"
                        class="inline-flex items-center rounded-full text-xs font-semibold px-1.5 py-0.5 leading-none flex-shrink-0 border border-warning/30 bg-warning/10 text-warning">
                        Pendiente
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-semibold tabular-nums text-sm text-unergy-deep">
                      {{ formatCOP(fac.monto) }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <a v-if="fac.enlace_soporte"
                      :href="fac.enlace_soporte" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline transition-colors">
                      <ExternalLinkIcon class="size-3" />Ver
                    </a>
                    <span v-else class="text-muted-foreground/50 text-xs">—</span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <Button variant="ghost" size="icon-xs"
                      class="text-destructive/60 hover:text-destructive"
                      @click="eliminarFactura('solenium', fac.id)">
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              </tbody>
              <!-- Fila de totales -->
              <tfoot v-if="!loading && solFiltradas.length">
                <tr class="border-t border-warning/30 bg-warning/10">
                  <td colspan="2" class="px-4 py-2.5">
                    <span class="text-xs font-semibold text-muted-foreground">
                      Total {{ filtroSol.año || filtroSol.mes ? 'filtrado' : '' }}
                      · {{ solFiltradas.length }} factura{{ solFiltradas.length !== 1 ? 's' : '' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-bold tabular-nums text-sm text-warning">
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

    <!-- ══ SECCIÓN 2: Facturas Inversionistas ══════════════════════════════════════ -->
    <div class="rounded-xl border border-border bg-card overflow-hidden">

      <!-- Header colapsable -->
      <button type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/60 transition-colors duration-150 text-left select-none"
        @click="openInv = !openInv">
        <div class="flex items-center gap-2.5">
          <div class="size-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
            <UsersIcon class="size-4" />
          </div>
          <div>
            <p class="text-xs text-muted-foreground leading-none mb-0.5">Cobros a clientes</p>
            <span class="text-sm font-semibold text-unergy-deep">Facturas Inversionistas</span>
          </div>
          <span class="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 py-0.5 leading-none ml-1 bg-primary/15 text-primary">
            {{ facturasInv.length }}
          </span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span v-if="facturasInv.length" class="text-xs text-muted-foreground hidden sm:block">
            Total: <strong class="text-primary">{{ formatCOP(totalInv) }}</strong>
          </span>
          <ChevronDownIcon class="size-3 text-muted-foreground transition-transform duration-200" :class="{ 'rotate-180': openInv }" />
        </div>
      </button>

      <!-- Contenido colapsable -->
      <div
        class="overflow-hidden transition-all"
        :class="openInv ? 'max-h-900 duration-500 ease-in' : 'max-h-0 duration-300 ease-out'"
      >
        <div class="border-t border-border">

          <!-- Barra de filtros + botón agregar -->
          <div class="flex flex-wrap items-center gap-2 px-5 py-3 bg-muted/60 border-b border-border">
            <FilterIcon class="size-3 text-muted-foreground" />
            <span class="text-xs text-muted-foreground font-medium mr-1">Filtrar:</span>
            <Select v-model="filtroInv.año" :options="AÑOS_OPT" placeholder="Año"
              showClear class="text-sm" />
            <Select v-model="filtroInv.mes" :options="MESES_OPT"
              optionLabel="label" optionValue="value" placeholder="Mes"
              showClear class="text-sm" />
            <Button v-if="filtroInv.año || filtroInv.mes" variant="ghost" size="xs"
              class="text-muted-foreground"
              @click="filtroInv.año = null; filtroInv.mes = null">
              <XIcon /> Limpiar
            </Button>
            <span v-if="filtroInv.año || filtroInv.mes"
              class="text-xs text-muted-foreground">
              {{ invFiltradas.length }} resultado{{ invFiltradas.length !== 1 ? 's' : '' }}
            </span>
            <div class="ml-auto text-primary">
              <Button variant="ghost" size="sm" class="font-semibold"
                :disabled="loading"
                @click="abrirModal('inversionistas')">
                + Agregar factura
              </Button>
            </div>
          </div>

          <!-- Tabla -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-border bg-muted/40">
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Fecha</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Inversionista</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">N° Factura</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Monto</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">Soporte</th>
                  <th class="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading -->
                <tr v-if="loading">
                  <td colspan="6" class="px-4 py-8 text-center text-muted-foreground text-xs">
                    <LoaderCircleIcon class="mr-1 inline size-3 animate-spin" />Cargando…
                  </td>
                </tr>
                <!-- Empty state -->
                <tr v-else-if="!invFiltradas.length">
                  <td colspan="6" class="px-4 py-10 text-center">
                    <div class="flex flex-col items-center gap-2.5">
                      <div class="size-10 rounded-full flex items-center justify-center bg-primary/15 text-primary">
                        <UsersIcon class="size-5" />
                      </div>
                      <p class="text-sm font-medium text-muted-foreground">
                        {{ facturasInv.length ? 'Sin resultados para los filtros aplicados' : 'Sin facturas de inversionistas registradas' }}
                      </p>
                      <Button v-if="!facturasInv.length" size="sm" class="mt-0.5"
                        @click="abrirModal('inversionistas')">
                        Agregar primera factura
                      </Button>
                    </div>
                  </td>
                </tr>
                <!-- Filas -->
                <tr v-for="fac in invFiltradas" :key="fac.id"
                  class="border-b border-border/50 transition-colors duration-100"
                  :class="isPending(fac) ? 'opacity-50 hover:opacity-70 hover:bg-warning/10' : 'hover:bg-primary/5'">
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-sm text-unergy-deep">{{ fac.fecha }}</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <!-- `inversionista_nombre`: la API mandaba `inversionista_id`
                         (que ni existía) y nunca el nombre, así que esta columna
                         mostraba "—" aunque el dato estuviera guardado. -->
                    <span class="text-sm text-foreground">{{ fac.inversionista_nombre || '—' }}</span>
                  </td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-foreground">{{ fac.numero_factura || '—' }}</span>
                      <span v-if="isPending(fac)"
                        class="inline-flex items-center rounded-full text-xs font-semibold px-1.5 py-0.5 leading-none flex-shrink-0 border border-primary/30 bg-primary/10 text-primary">
                        Pendiente
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-semibold tabular-nums text-sm text-unergy-deep">
                      {{ formatCOP(fac.monto) }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <a v-if="fac.enlace_soporte"
                      :href="fac.enlace_soporte" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-colors">
                      <ExternalLinkIcon class="size-3" />Ver
                    </a>
                    <span v-else class="text-muted-foreground/50 text-xs">—</span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <Button variant="ghost" size="icon-xs"
                      class="text-destructive/60 hover:text-destructive"
                      @click="eliminarFactura('inversionistas', fac.id)">
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              </tbody>
              <!-- Fila de totales -->
              <tfoot v-if="!loading && invFiltradas.length">
                <tr class="border-t border-primary/30 bg-primary/10">
                  <td colspan="3" class="px-4 py-2.5">
                    <span class="text-xs font-semibold text-muted-foreground">
                      Total {{ filtroInv.año || filtroInv.mes ? 'filtrado' : '' }}
                      · {{ invFiltradas.length }} factura{{ invFiltradas.length !== 1 ? 's' : '' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="font-bold tabular-nums text-sm text-primary">
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
    <Dialog v-model:visible="modal.visible" modal class="w-full max-w-md">
      <template #header>
        <div class="flex items-center gap-2.5">
          <div class="size-7 rounded-lg flex items-center justify-center flex-shrink-0"
            :class="modal.tipo === 'solenium' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'">
            <ReceiptIcon class="size-3" />
          </div>
          <span class="font-semibold text-sm text-unergy-deep">
            Agregar factura — {{ modal.tipo === 'solenium' ? 'Solenium' : 'Inversionistas' }}
          </span>
        </div>
      </template>
      <div class="space-y-4 pt-1">
        <!-- Fecha + N° Factura -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">
              Fecha (YYYY-MM) <span class="text-destructive">*</span>
            </label>
            <InputText v-model="modal.form.fecha"
              placeholder="2026-01" class="w-full"
              :invalid="!!modal.errores.fecha" />
            <p v-if="modal.errores.fecha" class="text-xs text-destructive">{{ modal.errores.fecha }}</p>
            <p v-else class="text-xs text-muted-foreground">Ej: 2026-03</p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-muted-foreground">N° Factura</label>
            <InputText v-model="modal.form.numero_factura"
              placeholder="FE-001234" class="w-full" />
          </div>
        </div>
        <!-- Inversionista (solo para sección inversionistas) -->
        <!-- La factura se le emite a alguien: sin cliente vinculado no hay NIT
             ni razón social con que emitirla. -->
        <SelectorCliente v-if="modal.tipo === 'inversionistas'"
          v-model:id="modal.form.inversionista_id"
          v-model:nombre="modal.form.inversionista_nombre"
          label="Inversionista"
          requerido
        />
        <!-- Monto -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">
            Monto (COP) <span class="text-destructive">*</span>
          </label>
          <InputNumber v-model="modal.form.monto"
            mode="currency" currency="COP" locale="es-CO" :maxFractionDigits="0"
            class="w-full" placeholder="$ 0"
            :invalid="!!modal.errores.monto" />
          <p v-if="modal.errores.monto" class="text-xs text-destructive">{{ modal.errores.monto }}</p>
        </div>
        <!-- Link soporte -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-muted-foreground">Link de soporte (Drive)</label>
          <InputText v-model="modal.form.enlace_soporte"
            placeholder="https://drive.google.com/…" class="w-full"
            :invalid="!!modal.errores.enlace_soporte" />
          <p v-if="modal.errores.enlace_soporte" class="text-xs text-destructive">
            {{ modal.errores.enlace_soporte }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" @click="modal.visible = false">Cancelar</Button>
        <Button :disabled="saving" @click="guardarFactura">
          <LoaderCircleIcon v-if="saving" class="animate-spin" />
          <CheckIcon v-else />
          Agregar factura
        </Button>
      </template>
    </Dialog>

  </template>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { toast } from 'vue-sonner'
import SelectorCliente from '~/features/clientes/components/SelectorCliente.vue'
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
  modal.form    = {
    fecha: '', inversionista_id: null, inversionista_nombre: '',
    numero_factura: '', monto: null, enlace_soporte: '',
  }
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
  // La factura se le emite a alguien: sin cliente no hay NIT con que emitirla.
  if (modal.tipo === 'inversionistas' && !modal.form.inversionista_id) {
    e.inversionista = 'Vincula el inversionista a un cliente registrado'
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
      inversionista_id: modal.form.inversionista_id ?? null,
      inversionista_nombre: modal.form.inversionista_nombre?.trim() || null,
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
