<template>
  <div class="flex flex-col gap-4">
    <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ShieldIcon class="size-4 text-primary" />
        <h1 class="text-lg font-extrabold text-foreground">Pólizas</h1>
        <Badge variant="secondary">{{ filas.length }}</Badge>
      </div>
      <Button variant="outline" size="sm" :disabled="loading" @click="cargar">
        <LoaderCircleIcon v-if="loading" class="animate-spin" />
        <RefreshCwIcon v-else />
        Actualizar
      </Button>
    </div>

    <!-- ══ BANNER 30 DÍAS ═══════════════════════════════════════════════════ -->
    <button
      v-if="venceEn30.length && filtroEstado !== 'proxima'"
      type="button"
      class="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-left text-sm font-medium text-warning"
      @click="filtroEstado = 'proxima'"
    >
      <TriangleAlertIcon class="size-4 shrink-0" />
      {{ venceEn30.length }} {{ venceEn30.length === 1 ? 'póliza vence' : 'pólizas vencen' }} en los
      próximos 30 días
    </button>

    <!-- ══ STATS BAR ════════════════════════════════════════════════════════ -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card size="sm">
        <CardContent>
          <p class="text-xs text-muted-foreground">Total pólizas</p>
          <p class="text-xl font-extrabold text-foreground">{{ conDatos.length }}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <p class="text-xs text-muted-foreground">Próximas a vencer</p>
          <p class="text-xl font-extrabold text-warning">{{ contarPorEstado('proxima') }}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <p class="text-xs text-muted-foreground">Vencidas</p>
          <p class="text-xl font-extrabold text-destructive">{{ contarPorEstado('vencida') }}</p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent>
          <p class="text-xs text-muted-foreground">Valor asegurado total</p>
          <p class="text-xl font-extrabold text-primary">{{ formatCurrency(totalAsegurado) }}</p>
        </CardContent>
      </Card>
    </div>

    <!-- ══ FILTROS ══════════════════════════════════════════════════════════ -->
    <div class="flex flex-wrap items-center gap-2">
      <InputGroup class="w-64">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput v-model="busqueda" placeholder="Buscar por proyecto o ciudad…" />
      </InputGroup>
      <Select v-model="filtroTipo">
        <SelectTrigger size="sm" class="w-36">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in OPCIONES_TIPO" :key="o.value" :value="o.value">{{
            o.label
          }}</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filtroEstado">
        <SelectTrigger size="sm" class="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in OPCIONES_ESTADO" :key="o.value" :value="o.value">{{
            o.label
          }}</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filtroOm">
        <SelectTrigger size="sm" class="w-32">
          <SelectValue placeholder="Póliza O&M" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="o in OPCIONES_OM" :key="String(o.value)" :value="o.value">{{
            o.label
          }}</SelectItem>
        </SelectContent>
      </Select>
      <Button v-if="hayFiltros" variant="ghost" size="sm" @click="limpiarFiltros">
        <XIcon /> Limpiar
      </Button>
    </div>

    <!-- ══ GRID DE TARJETAS ═══════════════════════════════════════════════════ -->
    <div v-if="ordenadas.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="fila in ordenadas"
        :key="fila.proyecto_id"
        class="cursor-pointer transition-colors hover:border-primary"
        @click="abrirEdicion(fila)"
      >
        <CardHeader>
          <CardTitle class="truncate text-sm">{{ fila.nombre_comercial }}</CardTitle>
          <CardAction>
            <GBadge :color="estadoColor(estadoDe(fila))" size="sm">
              {{ ESTADO_LABELS[estadoDe(fila)] }}
            </GBadge>
          </CardAction>
        </CardHeader>
        <CardContent class="flex flex-col gap-2 text-sm">
          <div class="flex items-center justify-between gap-2">
            <GBadge :color="tipoColor(fila.tipo_proyecto)" size="sm">
              {{ TIPO_LABELS[fila.tipo_proyecto] || '—' }}
            </GBadge>
            <span class="text-xs text-muted-foreground">{{ ciudad(fila) }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-border pt-2">
            <span class="text-xs text-muted-foreground">Vencimiento</span>
            <span class="font-medium text-foreground">{{
              fila.fecha_vencimiento ? formatFecha(fila.fecha_vencimiento) : '—'
            }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted-foreground">Valor póliza</span>
            <span class="font-medium text-foreground">{{ formatCurrency(fila.valor_poliza) }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
    <div v-else class="flex flex-col items-center gap-2 py-16 text-muted-foreground">
      <InboxIcon class="size-8 text-muted-foreground/50" />
      <p class="text-sm">Sin resultados</p>
    </div>

    <!-- ══ PANEL: VER + EDITAR ═════════════════════════════════════════════════ -->
    <Sheet :open="!!edicion" @update:open="(v) => !v && cerrarEdicion()">
      <SheetContent class="w-full gap-0 sm:max-w-md">
        <SheetHeader class="border-b border-border">
          <SheetTitle>{{ edicion?.nombre_comercial }}</SheetTitle>
          <SheetDescription>{{ edicion ? ciudad(edicion) : '' }}</SheetDescription>
        </SheetHeader>

        <div v-if="edicion" class="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <!-- Datos generales (solo lectura) -->
          <section class="flex flex-col gap-1.5">
            <h4 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Datos generales
            </h4>
            <p class="text-sm"><strong>Dirección:</strong> {{ edicion.direccion_vereda || '—' }}</p>
            <p class="text-sm">
              <strong>Estudio de suelos actual:</strong>
              <a
                v-if="edicion.link_estudio_suelos"
                :href="edicion.link_estudio_suelos"
                target="_blank"
                rel="noopener"
                class="text-primary hover:underline"
                >Ver enlace</a
              >
              <span v-else>—</span>
            </p>
          </section>

          <!-- Detalles del sistema (solo lectura) -->
          <section class="flex flex-col gap-1.5 border-t border-border pt-4">
            <h4 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Detalles del sistema
            </h4>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <p><strong>Paneles:</strong> {{ edicion.marca_paneles || '—' }}</p>
              <p><strong>Cant. paneles:</strong> {{ edicion.cantidad_total_paneles ?? '—' }}</p>
              <p><strong>Inversores:</strong> {{ edicion.marca_inversores || '—' }}</p>
              <p><strong>Cant. inversores:</strong> {{ edicion.cantidad_inversores ?? '—' }}</p>
              <p>
                <strong>Capacidad:</strong>
                {{
                  edicion.capacidad_instalada_kwp != null
                    ? edicion.capacidad_instalada_kwp + ' kWp'
                    : '—'
                }}
              </p>
              <p><strong>Operador de red:</strong> {{ edicion.operador_red || '—' }}</p>
              <p><strong>Voltaje de red:</strong> {{ edicion.voltaje_red || '—' }}</p>
              <p>
                <strong>Potencia AC:</strong>
                {{ edicion.potencia_ac_kw != null ? edicion.potencia_ac_kw + ' kW' : '—' }}
              </p>
            </div>
          </section>

          <!-- Póliza (editable) -->
          <section class="flex flex-col gap-2 border-t border-border pt-4">
            <h4 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">Póliza</h4>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">N° póliza</Label>
              <Input v-model="form.numero_poliza" />
            </div>
            <label class="flex items-center gap-2 text-sm">
              <Switch v-model="form.poliza_om" /> Póliza O&M
            </label>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Fecha de vencimiento</Label>
              <Input v-model="form.fecha_vencimiento" type="date" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Valor de la póliza (COP)</Label>
              <Input v-model.number="form.valor_poliza" type="number" />
            </div>
          </section>

          <!-- Presupuesto (editable) -->
          <section class="flex flex-col gap-2 border-t border-border pt-4">
            <h4 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Presupuesto
            </h4>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Mano de obra</Label>
                <Input v-model.number="form.mano_obra" type="number" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Estructura</Label>
                <Input v-model.number="form.estructura" type="number" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Paneles</Label>
                <Input v-model.number="form.paneles" type="number" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Inversores</Label>
                <Input v-model.number="form.inversores" type="number" />
              </div>
              <div class="col-span-2 flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Otros</Label>
                <Input v-model.number="form.otros" type="number" />
              </div>
            </div>
            <p class="text-sm font-medium text-foreground">
              Total: {{ formatCurrency(totalPresupuestoForm) }}
            </p>
          </section>

          <!-- Estudio de suelos (editable) -->
          <section class="flex flex-col gap-2 border-t border-border pt-4">
            <h4 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Estudio de suelos
            </h4>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Link</Label>
              <Input v-model="form.link_estudio_suelos" placeholder="https://…" />
            </div>
          </section>

          <!-- Cálculo IPP (editable) -->
          <section class="flex flex-col gap-2 border-t border-border pt-4">
            <h4 class="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Cálculo IPP
            </h4>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">IPP base</Label>
                <Input v-model.number="form.ipp_base" type="number" step="0.0001" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Fecha IPP base</Label>
                <Input v-model="form.ipp_base_fecha" type="date" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">IPP provisional</Label>
                <Input v-model.number="form.ipp_provisional" type="number" step="0.0001" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Fecha IPP provisional</Label>
                <Input v-model="form.ipp_provisional_fecha" type="date" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Tarifa base</Label>
                <Input v-model.number="form.tarifa_base" type="number" />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs text-muted-foreground">Generación anual P90 (kWh)</Label>
                <Input v-model.number="form.generacion_anual_p90_kwh" type="number" />
              </div>
            </div>
            <p class="text-sm text-foreground">
              % indexación:
              {{ pctIndexacionForm != null ? (pctIndexacionForm * 100).toFixed(2) + '%' : '—' }}
              <br />
              Tarifa indexada:
              {{ tarifaIndexadaForm != null ? formatCurrency(tarifaIndexadaForm) : '—' }}
              <br />
              Lucro cesante estimado:
              {{ lucroCesanteForm != null ? formatCurrency(lucroCesanteForm) : '—' }}
            </p>
          </section>
        </div>

        <SheetFooter class="flex-row justify-end border-t border-border">
          <Button variant="outline" @click="cerrarEdicion">Cancelar</Button>
          <Button :disabled="guardando" @click="guardar">
            <LoaderCircleIcon v-if="guardando" class="animate-spin" />
            <CheckIcon v-else />
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { PolizasService } from '~/features/operaciones/services/polizas'
import { formatCurrency } from '~/features/operaciones/utils/financialCalculations'
import {
  CheckIcon,
  InboxIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldIcon,
  TriangleAlertIcon,
  XIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'

const polizasService = new PolizasService()

const TIPO_LABELS = {
  minigranja: 'Minigranja',
  autoconsumo: 'Autoconsumo',
  gd: 'GD',
  movilidad_electrica: 'Movilidad',
  otro: 'Otro',
}
const TIPO_COLOR = {
  minigranja: 'success',
  autoconsumo: 'action',
  gd: 'information',
  movilidad_electrica: 'warning',
  otro: 'default',
}
const ESTADO_LABELS = {
  vigente: 'Vigente',
  proxima: 'Próxima a vencer',
  vencida: 'Vencida',
  sin_datos: 'Sin datos',
}
const ESTADO_COLOR = {
  vigente: 'success',
  proxima: 'warning',
  vencida: 'destructive',
  sin_datos: 'default',
}
const OPCIONES_TIPO = Object.entries(TIPO_LABELS).map(([value, label]) => ({ value, label }))
const OPCIONES_ESTADO = Object.entries(ESTADO_LABELS).map(([value, label]) => ({ value, label }))
const OPCIONES_OM = [
  { value: true, label: 'Sí' },
  { value: false, label: 'No' },
]

const filas = ref([])
const loading = ref(false)
const busqueda = ref('')
const filtroTipo = ref(null)
const filtroEstado = ref(null)
const filtroOm = ref(null)

async function cargar() {
  loading.value = true
  try {
    filas.value = await polizasService.listar()
  } catch {
    toast.error('Error', { description: 'No se pudieron cargar las pólizas', duration: 4000 })
  } finally {
    loading.value = false
  }
}
onMounted(cargar)

function ciudad(fila) {
  const partes = [fila.municipio, fila.departamento].filter(Boolean)
  return partes.length ? partes.join(', ') : '—'
}

function diasHastaVencimiento(fechaVencimiento) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVencimiento + 'T00:00:00')
  return Math.round((venc - hoy) / (1000 * 60 * 60 * 24))
}

function estadoDe(fila) {
  if (!fila.fecha_vencimiento) return 'sin_datos'
  const dias = diasHastaVencimiento(fila.fecha_vencimiento)
  if (dias < 0) return 'vencida'
  if (dias <= 60) return 'proxima'
  return 'vigente'
}

function tipoColor(tipo) {
  return TIPO_COLOR[tipo] || TIPO_COLOR.otro
}
function estadoColor(estado) {
  return ESTADO_COLOR[estado] || ESTADO_COLOR.sin_datos
}

function formatFecha(f) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const conDatos = computed(() => filas.value.filter((f) => f.fecha_vencimiento))
const totalAsegurado = computed(() =>
  filas.value.reduce((acc, f) => acc + (f.valor_poliza || 0), 0),
)

function contarPorEstado(estado) {
  return filas.value.filter((f) => estadoDe(f) === estado).length
}

const venceEn30 = computed(() =>
  filas.value.filter(
    (f) =>
      f.fecha_vencimiento &&
      diasHastaVencimiento(f.fecha_vencimiento) >= 0 &&
      diasHastaVencimiento(f.fecha_vencimiento) <= 30,
  ),
)

const hayFiltros = computed(
  () => !!(busqueda.value || filtroTipo.value || filtroEstado.value || filtroOm.value !== null),
)
function limpiarFiltros() {
  busqueda.value = ''
  filtroTipo.value = null
  filtroEstado.value = null
  filtroOm.value = null
}

const filtradas = computed(() => {
  return filas.value.filter((f) => {
    if (busqueda.value) {
      const q = busqueda.value.toLowerCase()
      const texto = `${f.nombre_comercial} ${ciudad(f)}`.toLowerCase()
      if (!texto.includes(q)) return false
    }
    if (filtroTipo.value && f.tipo_proyecto !== filtroTipo.value) return false
    if (filtroEstado.value && estadoDe(f) !== filtroEstado.value) return false
    if (filtroOm.value !== null && !!f.poliza_om !== filtroOm.value) return false
    return true
  })
})

const ordenadas = computed(() => {
  return [...filtradas.value].sort((a, b) => {
    if (!a.fecha_vencimiento && !b.fecha_vencimiento) return 0
    if (!a.fecha_vencimiento) return 1
    if (!b.fecha_vencimiento) return -1
    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)
  })
})

// ── Edición ──────────────────────────────────────────────────────────────────
const edicion = ref(null)
const guardando = ref(false)
const form = ref({})

function abrirEdicion(fila) {
  edicion.value = fila
  form.value = {
    numero_poliza: fila.numero_poliza,
    poliza_om: fila.poliza_om,
    fecha_vencimiento: fila.fecha_vencimiento || null,
    valor_poliza: fila.valor_poliza,
    mano_obra: fila.mano_obra,
    estructura: fila.estructura,
    paneles: fila.paneles,
    inversores: fila.inversores,
    otros: fila.otros,
    link_estudio_suelos: fila.link_estudio_suelos,
    ipp_base: fila.ipp_base,
    ipp_base_fecha: fila.ipp_base_fecha || null,
    ipp_provisional: fila.ipp_provisional,
    ipp_provisional_fecha: fila.ipp_provisional_fecha || null,
    tarifa_base: fila.tarifa_base,
    generacion_anual_p90_kwh: fila.generacion_anual_p90_kwh,
  }
}
function cerrarEdicion() {
  edicion.value = null
}

const totalPresupuestoForm = computed(() => {
  const c = [
    form.value.mano_obra,
    form.value.estructura,
    form.value.paneles,
    form.value.inversores,
    form.value.otros,
  ]
  const presentes = c.filter((v) => v != null)
  return presentes.length ? presentes.reduce((a, b) => a + b, 0) : null
})
const pctIndexacionForm = computed(() => {
  if (!form.value.ipp_base || form.value.ipp_provisional == null) return null
  return form.value.ipp_provisional / form.value.ipp_base
})
const tarifaIndexadaForm = computed(() => {
  const pct = pctIndexacionForm.value
  if (pct == null || form.value.tarifa_base == null) return null
  return form.value.tarifa_base * pct
})
const lucroCesanteForm = computed(() => {
  const pct = pctIndexacionForm.value
  if (pct == null || form.value.tarifa_base == null || form.value.generacion_anual_p90_kwh == null)
    return null
  return form.value.tarifa_base * pct * form.value.generacion_anual_p90_kwh
})

async function guardar() {
  if (!edicion.value) return
  guardando.value = true
  try {
    const body = { ...form.value }
    await polizasService.guardar(edicion.value.proyecto_id, body)
    await cargar()
    cerrarEdicion()
  } catch {
    toast.error('Error', { description: 'No se pudo guardar la póliza', duration: 4000 })
  } finally {
    guardando.value = false
  }
}
</script>
