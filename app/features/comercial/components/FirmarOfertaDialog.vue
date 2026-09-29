<!--
  Firmar la oferta = crear su contrato PPA con las tarifas y enlazarlo.

  Cablea POST /comercial/ofertas/{id}/firmar, que no estaba usado en ninguna línea
  del front: la pestaña «Contratos» abría el wizard genérico de PPA, que deja
  `ppa_contrato_id` en NULL y rompe la cadena hacia Cumplimiento, Liquidaciones y
  la vista PPA-céntrica.

  Las condiciones NO se guardan en la oferta: alimentan el contrato, que es donde
  ya viven y donde las leen los demás módulos.
-->
<script setup lang="ts">
import type { Oferta } from '~/features/comercial/types'
import type { UseOfertas } from './useOfertas'
import {
  FileCheckIcon,
  ListIcon,
  LoaderCircleIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: bug conocido de tipos de `blocks/DatePicker`.
import DatePicker from '~/components/blocks/DatePicker.vue'
import {
  aFechaStr,
  aniosDelPeriodo,
  tarifasMensualesQueGenera,
  validarFirma,
  type PrecioAnual,
} from './comercial'

const props = defineProps<{
  visible: boolean
  oferta?: Oferta | null
  acciones: Pick<UseOfertas, 'firmar'>
}>()
const emit = defineEmits<{ 'update:visible': [visible: boolean]; firmada: [] }>()

const MODOS_PRECIO = [
  { label: 'Tarifa única', value: 'unica' },
  { label: 'Tabla por año', value: 'tabla' },
]

const firmando = ref(false)
const errorServidor = ref('')

const f = reactive<{
  numero_codigo_contrato: string
  nombre_interno: string
  fecha_inicio: string | null
  fecha_fin: string | null
  modo_precio: 'unica' | 'tabla'
  tarifa_base: number | null
  precios_anuales: PrecioAnual[]
  indice_indexacion: string
  periodo_indexacion_base: string
  cantidad_minima_kwh_mes: number | null
  carpeta_link: string
}>({
  numero_codigo_contrato: '',
  nombre_interno: '',
  fecha_inicio: null,
  fecha_fin: null,
  modo_precio: 'unica',
  tarifa_base: null,
  precios_anuales: [],
  indice_indexacion: '',
  periodo_indexacion_base: '',
  cantidad_minima_kwh_mes: null,
  carpeta_link: '',
})

const plantas = computed(() => props.oferta?.plantas ?? [])
const errores = computed(() => validarFirma(f))
const filasMensuales = computed(() => tarifasMensualesQueGenera(f))
const aniosPeriodo = computed(() => aniosDelPeriodo(f.fecha_inicio, f.fecha_fin))

watch(
  () => props.visible,
  (abierto) => {
    if (!abierto) return
    const o = props.oferta
    errorServidor.value = ''
    Object.assign(f, {
      // El backend hereda el código de seguimiento si va vacío; se precarga para
      // que se vea qué va a quedar.
      numero_codigo_contrato: o?.codigo_seguimiento ?? '',
      nombre_interno: o?.planta_nombre ?? '',
      fecha_inicio: aFechaStr(o?.fecha_tentativa_inicio),
      fecha_fin: aFechaStr(o?.fecha_fin_tentativa),
      modo_precio: 'unica',
      tarifa_base: null,
      precios_anuales: [],
      indice_indexacion: '',
      periodo_indexacion_base: '',
      cantidad_minima_kwh_mes: null,
      carpeta_link: '',
    })
  },
)

// Al pasar a tabla por año, se precargan los años que cubre el periodo: es lo
// que evita la tabla a mano y los años fuera de rango que el backend descarta.
watch(
  () => f.modo_precio,
  (modo) => {
    if (modo === 'tabla' && !f.precios_anuales.length) llenarAnios()
  },
)

function llenarAnios() {
  const existentes = new Map(f.precios_anuales.filter((p) => p.anio).map((p) => [p.anio, p.precio]))
  f.precios_anuales = aniosPeriodo.value.map((a) => ({
    anio: a,
    precio: existentes.get(a) ?? null,
  }))
}

function cerrar(v: boolean) {
  if (firmando.value) return
  emit('update:visible', v === true)
}

async function firmar() {
  firmando.value = true
  errorServidor.value = ''
  const payload: Record<string, unknown> = {
    numero_codigo_contrato: f.numero_codigo_contrato || null,
    nombre_interno: f.nombre_interno || null,
    fecha_inicio: aFechaStr(f.fecha_inicio),
    fecha_fin: aFechaStr(f.fecha_fin),
    indice_indexacion: f.indice_indexacion || null,
    periodo_indexacion_base: f.periodo_indexacion_base || null,
    cantidad_minima_kwh_mes: f.cantidad_minima_kwh_mes ?? null,
    carpeta_link: f.carpeta_link || null,
  }
  if (f.modo_precio === 'tabla') {
    payload.precios_anuales = f.precios_anuales
      .filter((p) => p.anio && p.precio && p.precio > 0)
      .map((p) => ({ anio: p.anio, precio: p.precio }))
  } else {
    payload.tarifa_base = f.tarifa_base
  }

  const r = await props.acciones.firmar(props.oferta!.id, payload)
  firmando.value = false

  if (!r.ok) {
    errorServidor.value = r.error
    return
  }
  toast.success(`Contrato PPA #${r.ppa_contrato_id} creado`, {
    description: r.plantas_del_contrato
      ? `${r.plantas_del_contrato} planta(s) · ${r.tarifas_creadas} tarifas mensuales`
      : 'Sin plantas: Cumplimiento no podrá medirlo hasta que vincules el proyecto.',
  })

  // El backend ya mandaba `avisos` y esta pantalla los tiraba. Ahí viaja, entre
  // otras cosas, el «ya existe un PPA que cubre esto»: el CRM no puede rechazar
  // la firma --no tiene dónde confirmar "crear igual"-- pero sí tiene que
  // decirlo.
  for (const aviso of r.avisos ?? []) {
    toast.warning('Revisa el contrato', { description: aviso, duration: 8000 })
  }

  emit('firmada')
  emit('update:visible', false)
}
</script>

<template>
  <Dialog :open="visible" @update:open="cerrar">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader v-if="oferta">
        <DialogTitle>Firmar → crear contrato PPA</DialogTitle>
        <DialogDescription>
          {{ oferta.planta_nombre || 'Sin planta' }} · {{ oferta.cliente_razon_social }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="oferta" class="flex flex-col gap-4">
        <!-- Firmar sin plantas es legítimo (la planta puede no existir todavía como
             proyecto) pero Cumplimiento no puede medir ese PPA. Se avisa fuerte. -->
        <Alert v-if="!plantas.length">
          <TriangleAlertIcon class="text-warning" />
          <AlertDescription>
            <strong>Esta oferta no tiene ninguna planta vinculada.</strong>
            El contrato se crearía sin plantas y Cumplimiento no podría medirlo contra la
            generación. Vinculá el proyecto en el panel de la oferta antes de firmar, o seguí si la
            planta todavía no existe en la plataforma.
          </AlertDescription>
        </Alert>
        <div v-else class="rounded-md border bg-primary/5 px-3 py-2">
          <div class="mb-0.5 text-xs font-semibold text-primary">
            {{ plantas.length }} PLANTA(S) AL CONTRATO
          </div>
          <div class="text-xs text-primary">
            {{ plantas.map((p) => p.nombre_comercial).join(' · ') }}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <GLabel>Código del contrato</GLabel>
            <Input v-model.trim="f.numero_codigo_contrato" />
            <p class="mt-1 text-xs text-muted-foreground">
              Si lo dejás vacío hereda el código de seguimiento de la oferta.
            </p>
          </div>
          <div>
            <GLabel>Nombre interno</GLabel>
            <Input v-model.trim="f.nombre_interno" />
          </div>
          <div>
            <GLabel required>Inicio del suministro</GLabel>
            <DatePicker v-model="f.fecha_inicio" clearable />
          </div>
          <div>
            <GLabel required>Fin del suministro</GLabel>
            <DatePicker v-model="f.fecha_fin" clearable />
          </div>
        </div>

        <div>
          <GLabel required>Precio</GLabel>
          <ToggleGroup v-model="f.modo_precio" type="single" variant="outline" class="mb-2">
            <ToggleGroupItem v-for="m in MODOS_PRECIO" :key="m.value" :value="m.value">{{
              m.label
            }}</ToggleGroupItem>
          </ToggleGroup>

          <div v-if="f.modo_precio === 'unica'" class="flex w-56 items-center gap-2">
            <NumberField
              v-model="f.tarifa_base"
              :format-options="{ maximumFractionDigits: 2 }"
              class="w-full"
            >
              <NumberFieldContent><NumberFieldInput placeholder="p. ej. 300" /></NumberFieldContent>
            </NumberField>
            <span class="shrink-0 text-xs text-muted-foreground">$/kWh</span>
          </div>

          <div v-else>
            <div class="mb-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="!aniosPeriodo.length"
                @click="llenarAnios"
              >
                <ListIcon class="size-4" />
                Llenar los años del periodo
              </Button>
              <span class="text-xs text-muted-foreground">
                {{
                  aniosPeriodo.length
                    ? `${aniosPeriodo.length} año(s) entre inicio y fin`
                    : 'Definí las fechas primero'
                }}
              </span>
            </div>
            <div
              v-for="(p, i) in f.precios_anuales"
              :key="i"
              class="mb-1.5 flex items-center gap-2"
            >
              <NumberField v-model="p.anio" :format-options="{ useGrouping: false }" class="w-24">
                <NumberFieldContent><NumberFieldInput placeholder="Año" /></NumberFieldContent>
              </NumberField>
              <NumberField
                v-model="p.precio"
                :format-options="{ maximumFractionDigits: 2 }"
                class="w-40"
              >
                <NumberFieldContent
                  ><NumberFieldInput placeholder="Precio $/kWh"
                /></NumberFieldContent>
              </NumberField>
              <Button variant="ghost" size="icon-sm" @click="f.precios_anuales.splice(i, 1)">
                <Trash2Icon class="size-4 text-destructive" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              @click="f.precios_anuales.push({ anio: null, precio: null })"
            >
              <PlusIcon class="size-4" />
              Agregar año
            </Button>
            <p v-if="filasMensuales" class="mt-1 text-xs text-muted-foreground">
              Se expandirá a <strong>{{ filasMensuales }}</strong> filas mensuales de tarifa,
              recortadas al periodo del suministro.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <GLabel>Índice de indexación</GLabel>
            <Input v-model.trim="f.indice_indexacion" placeholder="IPP / IPC" />
          </div>
          <div>
            <GLabel>Mes base (YYYY-MM)</GLabel>
            <Input v-model.trim="f.periodo_indexacion_base" placeholder="2025-10" />
          </div>
          <div>
            <GLabel>Cantidad mínima (kWh/mes)</GLabel>
            <NumberField
              v-model="f.cantidad_minima_kwh_mes"
              :format-options="{ useGrouping: false }"
            >
              <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
            </NumberField>
          </div>
        </div>

        <div>
          <GLabel>Carpeta de soporte</GLabel>
          <Input v-model.trim="f.carpeta_link" placeholder="https://drive.google.com/…" />
        </div>

        <!-- Las mismas reglas que FirmarOfertaIn, para enterarse antes del 422. -->
        <Alert v-if="errores.length" variant="destructive">
          <AlertDescription>
            <ul class="list-disc pl-4 text-xs">
              <li v-for="e in errores" :key="e">{{ e }}</li>
            </ul>
          </AlertDescription>
        </Alert>
        <Alert v-if="errorServidor" variant="destructive">
          <AlertDescription>{{ errorServidor }}</AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="ghost" :disabled="firmando" @click="cerrar(false)">Cancelar</Button>
        <Button :disabled="firmando || errores.length > 0" @click="firmar">
          <LoaderCircleIcon v-if="firmando" class="animate-spin" />
          <FileCheckIcon v-else class="size-4" />
          Firmar y crear contrato
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
