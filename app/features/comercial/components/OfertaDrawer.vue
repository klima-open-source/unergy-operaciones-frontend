<!--
  Todo lo de UNA oferta en un panel lateral, sin salir del tablero.

  Reemplaza el salto a /comercial/oportunidades/:id, que te llevaba a la ficha
  del CLIENTE con 7 pestañas: clickeabas una oferta y perdías de vista cuál era.

  Lo que aparece acá y antes no se mostraba en ningún lado:
  · la ficha operativa con la PROCEDENCIA de cada dato (ficha.fuentes)
  · el contrato en el que desembocó la oferta (ppa_contrato_id)
  · las plantas de la oferta, que son las que se firman
  · el botón de firmar, que cablea POST /comercial/ofertas/{id}/firmar
-->
<script setup lang="ts">
import type { Oferta } from '~/features/comercial/types'
import type { OperadorRed } from '~/features/operadores-red/types'
import type { ContratoServicio } from '~/features/contratos/types'
import type { UseOfertas } from './useOfertas'
import {
  CheckIcon,
  FileCheckIcon,
  LoaderCircleIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UnlinkIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: bug conocido de tipos de `blocks/DatePicker`.
import DatePicker from '~/components/blocks/DatePicker.vue'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { cargarProyectos, type ProyectoCatalogo } from './catalogos'
import {
  aFecha,
  aFechaStr,
  ayudaPrecio,
  diasDesde,
  ETAPAS,
  etiquetaPrecio,
  fmtFecha,
  FUENTES,
  placeholderPrecio,
  puedeFirmarPPA,
  sinRespuesta,
  TIPOS_GESTION,
  TIPOS_OFERTA,
} from './comercial'
import ProyectoDesdeCRMDialog from './ProyectoDesdeCRMDialog.vue'
import VersionesOferta from './VersionesOferta.vue'

const props = defineProps<{
  visible: boolean
  oferta?: Oferta | null
  /**
   * Las mutaciones de useOfertas(), inyectadas por la vista dueña del estado.
   * Se pasan como objeto en vez de emitir eventos con callback porque el drawer
   * necesita el RESULTADO de cada acción (para el "Guardado ✓" y para revertir),
   * y un emit no devuelve nada.
   */
  acciones: Pick<UseOfertas, 'guardarOferta' | 'moverEtapa' | 'registrarSeguimiento' | 'registrarGestion' | 'eliminarOferta'>
}>()
const emit = defineEmits<{ 'update:visible': [visible: boolean]; firmar: [oferta: Oferta] }>()

const confirm = useConfirm()
const operadoresRedService = new OperadoresRedService()
const contratosServicioService = new ContratosServicioService()

const moviendo = ref(false)
const tocando = ref(false)
const guardando = ref(false)
const guardandoGestion = ref(false)
const estadoGuardado = ref('')
const proyectos = ref<ProyectoCatalogo[]>([])
const operadores = ref<{ id: number; nombre?: string }[]>([])
const contratosServicio = ref<ContratoServicio[]>([])
const cargandoCatalogos = ref(false)
const crearProyecto = ref(false)
const showContratoWizard = ref(false)
let temporizador: ReturnType<typeof setTimeout> | undefined

/**
 * La planta recién creada ya viene vinculada del backend (`?oferta_id=`). Acá
 * solo se refleja en el selector para que se vea sin recargar; NO se reenvía la
 * M2M, porque el backend ya la escribió y mandarla otra vez la reescribiría.
 */
function proyectoCreado(p: { id: number; nombre_comercial: string; municipio?: string | null; departamento?: string | null; estado?: string | null; potencia_ac_kw?: number | null }) {
  proyectos.value = [
    ...proyectos.value,
    {
      id: p.id,
      nombre_comercial: p.nombre_comercial,
      municipio: p.municipio ?? null,
      departamento: p.departamento ?? null,
      estado: p.estado ?? null,
      potencia_ac_kw: p.potencia_ac_kw ?? null,
    },
  ].sort((a, b) => (a.nombre_comercial || '').localeCompare(b.nombre_comercial || '', 'es'))
  if (!f.proyecto_ids?.includes(p.id)) f.proyecto_ids = [...(f.proyecto_ids ?? []), p.id]
}

const DIRECCIONES = [
  { label: 'Escribimos', value: 'saliente' },
  { label: 'Nos respondió', value: 'entrante' },
]

const gestion = reactive({ tipo: 'llamada', descripcion: '', direccion: 'saliente' })

interface FormularioOferta {
  tipo: string | null
  planta_nombre: string
  precio_detalle: string
  notas: string
  documento_url: string
  fecha_oferta: Date | null
  fecha_ultima_respuesta: Date | null
  fecha_tentativa_inicio: Date | null
  fecha_fin_tentativa: Date | null
  proyecto_ids: number[]
  municipio: string
  departamento: string
  operador_red_id: number | null
  energia_promedio_kwh_mes: number | null
  contrato_servicio_id: number | null
}

// Copia editable. Se rearma cada vez que cambia la oferta abierta para que un
// autosave pendiente nunca escriba los datos de una oferta sobre otra.
const f = reactive<FormularioOferta>({
  tipo: null,
  planta_nombre: '',
  precio_detalle: '',
  notas: '',
  documento_url: '',
  fecha_oferta: null,
  fecha_ultima_respuesta: null,
  fecha_tentativa_inicio: null,
  fecha_fin_tentativa: null,
  proyecto_ids: [],
  municipio: '',
  departamento: '',
  operador_red_id: null,
  energia_promedio_kwh_mes: null,
  contrato_servicio_id: null,
})

/**
 * Las plantas solo se envían si de verdad se tocó el selector.
 *
 * `f.proyecto_ids` se inicializa con `oferta.plantas`, que el backend resuelve
 * ignorando los proyectos borrados. Mandarlo en cada autosave haría que el primer
 * guardado de cualquier campo (una nota, un precio) reescribiera la M2M y borrara
 * el vínculo a un proyecto eliminado — una desvinculación silenciosa que nadie
 * pidió.
 */
const plantasTocadas = ref(false)

function cargarFormulario(o: Oferta | null | undefined) {
  Object.assign(f, {
    tipo: o?.tipo ?? null,
    planta_nombre: o?.planta_nombre ?? '',
    precio_detalle: o?.precio_detalle ?? '',
    notas: o?.notas ?? '',
    documento_url: o?.documento_url ?? '',
    fecha_oferta: aFecha(o?.fecha_oferta),
    fecha_ultima_respuesta: aFecha(o?.fecha_ultima_respuesta),
    fecha_tentativa_inicio: aFecha(o?.fecha_tentativa_inicio),
    fecha_fin_tentativa: aFecha(o?.fecha_fin_tentativa),
    proyecto_ids: (o?.plantas ?? []).map((p) => p.id),
    municipio: o?.municipio ?? '',
    departamento: o?.departamento ?? '',
    operador_red_id: o?.operador_red_id ?? null,
    energia_promedio_kwh_mes: o?.energia_promedio_kwh_mes ?? null,
    contrato_servicio_id: o?.contrato_servicio_id ?? null,
  })
  plantasTocadas.value = false
  estadoGuardado.value = ''
}

watch(
  () => props.oferta?.id,
  () => {
    clearTimeout(temporizador)
    cargarFormulario(props.oferta)
  },
  { immediate: true },
)

// Los catálogos se cargan la primera vez que se abre el drawer, no al montar la
// vista: son más de mil proyectos que la mayoría de las sesiones no necesita.
watch(
  () => props.visible,
  async (abierto) => {
    if (!abierto || proyectos.value.length || operadores.value.length) return
    cargandoCatalogos.value = true
    const [pr, op, cs] = await Promise.allSettled([
      cargarProyectos(),
      operadoresRedService.listar(),
      contratosServicioService.listar({ tipo: 'representacion' }),
    ])
    if (pr.status === 'fulfilled') {
      proyectos.value = pr.value
    } else {
      toast.warning('No se pudo cargar la lista de proyectos')
    }
    if (op.status === 'fulfilled') {
      operadores.value = op.value.map((o: OperadorRed) => ({ id: o.id, nombre: o.nombre_comercial || o.nombre_legal }))
    }
    if (cs.status === 'fulfilled') {
      contratosServicio.value = cs.value
    }
    cargandoCatalogos.value = false
  },
)

// ── Ficha operativa: valor + procedencia por campo ──────────────────────────
function fuente(campo: string) {
  const clave = props.oferta?.ficha?.fuentes?.[campo]
  return clave ? FUENTES[clave] : null
}

// Si el dato lo gobierna el proyecto, escribir la oferta no cambiaría lo que se
// ve: el campo se muestra de solo lectura con su chip de procedencia.
const gobiernaProyecto = (campo: string) => props.oferta?.ficha?.fuentes?.[campo] === 'proyecto'

interface CampoFicha {
  campo: string
  label: string
  valor?: string | null
  editor: 'texto' | 'operador' | 'numero' | null
}

const fichaCampos = computed<CampoFicha[]>(() => {
  const ficha = props.oferta?.ficha ?? {}
  const kwh = ficha.energia_promedio_kwh_mes
  return [
    {
      campo: 'municipio',
      label: 'Municipio',
      valor: ficha.municipio,
      editor: gobiernaProyecto('municipio') ? null : 'texto',
    },
    {
      campo: 'departamento',
      label: 'Departamento',
      valor: ficha.departamento,
      editor: gobiernaProyecto('departamento') ? null : 'texto',
    },
    {
      campo: 'operador_red_id',
      label: 'Operador de red',
      valor: ficha.operador_red,
      editor: gobiernaProyecto('operador_red') ? null : 'operador',
    },
    {
      campo: 'energia_promedio_kwh_mes',
      label: 'Energía promedio estimada (kWh/mes)',
      valor: typeof kwh === 'number' ? kwh.toLocaleString('es-CO') : null,
      editor: gobiernaProyecto('energia_promedio_kwh_mes') ? null : 'numero',
    },
    {
      campo: 'energia_real_kwh_mes',
      label: 'Energía medida (último mes cerrado)',
      valor:
        typeof ficha.energia_real_kwh_mes === 'number'
          ? `${ficha.energia_real_kwh_mes.toLocaleString('es-CO')} kWh · ${ficha.energia_real_periodo}`
          : null,
      editor: null,
    },
    {
      campo: 'fecha_inicio_operacion',
      label: 'Inicio de operación',
      valor: ficha.fecha_inicio_operacion ? fmtFecha(ficha.fecha_inicio_operacion) : null,
      editor: null,
    },
  ]
})

// Los únicos editores 'texto' de la ficha operativa son municipio/departamento
// (ver `fichaCampos`); acceder por nombre de campo dinámico exige este puente
// en vez de un `v-model="f[c.campo]"` directo, que TS no puede tipar.
function valorCampoTexto(campo: string): string {
  return ((f as unknown as Record<string, unknown>)[campo] as string | undefined) ?? ''
}
function setCampoTexto(campo: string, valor: string) {
  ;(f as unknown as Record<string, unknown>)[campo] = valor
  autosave()
}

// ── Guardado ────────────────────────────────────────────────────────────────
function cambiarPlantas(v: number[]) {
  f.proyecto_ids = v
  plantasTocadas.value = true
  autosave()
}

function cambios() {
  const c: Record<string, unknown> = {
    tipo: f.tipo,
    planta_nombre: f.planta_nombre || null,
    precio_detalle: f.precio_detalle || null,
    notas: f.notas || null,
    documento_url: f.documento_url || null,
    fecha_oferta: aFechaStr(f.fecha_oferta),
    fecha_ultima_respuesta: aFechaStr(f.fecha_ultima_respuesta),
    fecha_tentativa_inicio: aFechaStr(f.fecha_tentativa_inicio),
    fecha_fin_tentativa: aFechaStr(f.fecha_fin_tentativa),
    municipio: f.municipio || null,
    departamento: f.departamento || null,
    operador_red_id: f.operador_red_id ?? null,
    energia_promedio_kwh_mes: f.energia_promedio_kwh_mes ?? null,
    contrato_servicio_id: f.contrato_servicio_id ?? null,
  }
  if (plantasTocadas.value) c.proyecto_ids = f.proyecto_ids ?? []
  return c
}

/** El wizard crea el contrato y acá se enlaza a esta oferta (mismo autosave
 * que el resto del panel) -- el equivalente de "Firmar → crear PPA" para
 * servicios_operacionales, que no tiene un /firmar propio porque los
 * contratos de representación se crean por su wizard genérico. */
function contratoCreado(data: ContratoServicio) {
  if (!data?.id) return
  if (!contratosServicio.value.some((c) => c.id === data.id)) {
    contratosServicio.value = [...contratosServicio.value, data]
  }
  f.contrato_servicio_id = data.id
  autosave()
}

function desvincularContrato() {
  f.contrato_servicio_id = null
  autosave()
}

async function guardarAhora() {
  const id = props.oferta?.id
  if (!id) return { ok: false, error: 'sin oferta' }
  guardando.value = true
  const r = await props.acciones.guardarOferta(id, cambios())
  guardando.value = false
  estadoGuardado.value = r.ok ? 'Guardado ✓' : `No se guardó: ${r.error}`
  return r
}

function autosave() {
  if (!props.oferta?.id) return
  estadoGuardado.value = 'Guardando…'
  clearTimeout(temporizador)
  temporizador = setTimeout(guardarAhora, 700)
}

async function cambiarEtapa(estado: string) {
  if (!estado || estado === props.oferta?.estado || !props.oferta) return
  moviendo.value = true
  const r = await props.acciones.moverEtapa(props.oferta, estado)
  moviendo.value = false
  if (!r.ok) {
    toast.error('No se pudo cambiar la etapa', { description: r.error })
  }
}

async function tocar() {
  if (!props.oferta) return
  tocando.value = true
  const r = await props.acciones.registrarSeguimiento(props.oferta.id)
  tocando.value = false
  if (!r.ok) {
    toast.error('No se pudo registrar el toque', { description: r.error })
  }
}

/**
 * Marcar la respuesta hace DOS cosas: guarda la fecha (el dato) y registra la
 * gestión — que es lo que de verdad apaga la alerta, porque calcular_alerta mira
 * la última gestión de la bitácora y no esta columna.
 */
async function marcarRespuesta() {
  if (!props.oferta) return
  f.fecha_ultima_respuesta = new Date()
  clearTimeout(temporizador)
  const r = await guardarAhora()
  if (!r.ok) return
  await props.acciones.registrarGestion(props.oferta.oportunidad_id!, {
    tipo: 'correo',
    descripcion: 'El cliente respondió la oferta',
    ofertaId: props.oferta.id,
  })
  toast.success('Respuesta registrada')
}

async function registrarGestion() {
  if (!gestion.descripcion || !props.oferta) return
  guardandoGestion.value = true
  const r = await props.acciones.registrarGestion(props.oferta.oportunidad_id!, {
    tipo: gestion.tipo,
    descripcion: gestion.descripcion,
    // Quien hablo. Esta nota rapida la escribe el comercial, asi que por defecto
    // es saliente; el selector deja marcar que fue el cliente quien respondio.
    // De eso depende que la alerta no se reinicie con nuestras propias
    // insistencias (DOMINIO_COMERCIAL.md, P-9).
    direccion: gestion.direccion,
    ofertaId: props.oferta.id,
  })
  guardandoGestion.value = false
  if (r.ok) {
    gestion.descripcion = ''
    toast.success('Gestión registrada')
  } else {
    toast.error('No se pudo registrar', { description: r.error })
  }
}

function confirmarEliminar() {
  if (!props.oferta) return
  const nombre = props.oferta.planta_nombre || props.oferta.codigo_seguimiento || 'esta oferta'
  confirm({
    title: 'Eliminar oferta',
    description: `Se elimina «${nombre}» y su histórico de etapas. No se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      const r = await props.acciones.eliminarOferta(props.oferta!.id)
      if (r.ok) emit('update:visible', false)
      else toast.error('No se pudo eliminar', { description: r.error })
    },
  })
}

// Evita que un autosave pendiente dispare tras cerrar la vista.
onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<template>
  <Sheet :open="visible" @update:open="(v) => emit('update:visible', v)">
    <SheetContent class="w-full sm:max-w-lg">
      <SheetHeader v-if="oferta" class="border-b">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-muted-foreground">
            {{ oferta.codigo_seguimiento || oferta.numero_oferta || 'sin código' }}
          </span>
          <GBadge v-if="oferta.alerta" color="destructive" class="scale-90">⚠ {{ oferta.dias_sin_respuesta }}d</GBadge>
        </div>
        <SheetTitle class="truncate">{{ oferta.planta_nombre || oferta.ficha?.proyecto_nombre || 'Sin planta' }}</SheetTitle>
        <SheetDescription>
          <NuxtLink :to="`/comercial/oportunidades/${oferta.oportunidad_id}`" class="text-primary underline">
            {{ oferta.cliente_razon_social }}
          </NuxtLink>
        </SheetDescription>
      </SheetHeader>

      <div v-if="oferta" class="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 text-sm">
        <!-- ── Etapa ───────────────────────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Etapa</h3>
          <Select :model-value="oferta.estado" :disabled="moviendo" @update:model-value="(v) => cambiarEtapa(v as string)">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="e in ETAPAS" :key="e.value" :value="e.value">{{ e.label }}</SelectItem>
            </SelectContent>
          </Select>
          <p class="mt-1.5 text-[11px] text-muted-foreground">
            En esta etapa desde hace {{ diasDesde(oferta.estado_desde) ?? '—' }} días.
          </p>
          <Alert v-if="puedeFirmarPPA(oferta)" class="mt-2">
            <AlertDescription class="text-xs">
              Cuando se firme, usá <strong>Firmar → crear PPA</strong> (abajo) en vez de mover la etapa a
              mano: así queda el contrato creado y enlazado.
            </AlertDescription>
          </Alert>
        </section>

        <!-- ── Seguimiento del envío ───────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Seguimiento del envío
          </h3>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <GLabel>Enviada el</GLabel>
              <DatePicker
                :model-value="f.fecha_oferta ? aFechaStr(f.fecha_oferta) : null"
                clearable
                @update:model-value="
                  (v) => {
                    f.fecha_oferta = aFecha(v)
                    autosave()
                  }
                "
              />
            </div>
            <div>
              <GLabel>Última respuesta del cliente</GLabel>
              <DatePicker
                :model-value="f.fecha_ultima_respuesta ? aFechaStr(f.fecha_ultima_respuesta) : null"
                clearable
                @update:model-value="
                  (v) => {
                    f.fecha_ultima_respuesta = aFecha(v)
                    autosave()
                  }
                "
              />
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <div class="min-w-0">
              <div class="text-xs font-medium text-foreground">{{ oferta.seguimientos || 0 }} toque(s) enviados</div>
              <div v-if="sinRespuesta(oferta)" class="text-[11px] text-destructive">El cliente nunca contestó</div>
            </div>
            <div class="flex flex-shrink-0 items-center gap-1">
              <GTooltip>
                <GTooltipTrigger as-child>
                  <Button variant="outline" size="sm" :disabled="tocando" @click="tocar">
                    <LoaderCircleIcon v-if="tocando" class="animate-spin" />
                    <SendIcon v-else class="size-4" />
                    +1 toque
                  </Button>
                </GTooltipTrigger>
                <GTooltipContent>Reenvío o llamada de insistencia</GTooltipContent>
              </GTooltip>
              <GTooltip>
                <GTooltipTrigger as-child>
                  <Button variant="outline" size="sm" :disabled="guardando" @click="marcarRespuesta">
                    <CheckIcon class="size-4 text-success" />
                    Respondió
                  </Button>
                </GTooltipTrigger>
                <GTooltipContent>Marca la respuesta de hoy y apaga la alerta</GTooltipContent>
              </GTooltip>
            </div>
          </div>
        </section>

        <!-- ── Comercial ───────────────────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Comercial</h3>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <GLabel>Tipo de oferta</GLabel>
              <Select
                :model-value="f.tipo ?? undefined"
                @update:model-value="
                  (v) => {
                    f.tipo = v as string
                    autosave()
                  }
                "
              >
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in TIPOS_OFERTA" :key="t.value" :value="t.value">{{ t.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <!-- El precio de una compra de energía es una tarifa en $/kWh, no la
                 comisión en % de un servicio: la etiqueta y el ejemplo siguen al tipo. -->
            <div>
              <GLabel>{{ etiquetaPrecio(f.tipo) }}</GLabel>
              <Input v-model.trim="f.precio_detalle" :placeholder="placeholderPrecio(f.tipo)" @update:model-value="autosave" />
            </div>
            <div>
              <GLabel>Inicio tentativo del suministro</GLabel>
              <DatePicker
                :model-value="f.fecha_tentativa_inicio ? aFechaStr(f.fecha_tentativa_inicio) : null"
                clearable
                @update:model-value="
                  (v) => {
                    f.fecha_tentativa_inicio = aFecha(v)
                    autosave()
                  }
                "
              />
            </div>
            <div>
              <GLabel>Fin tentativo</GLabel>
              <DatePicker
                :model-value="f.fecha_fin_tentativa ? aFechaStr(f.fecha_fin_tentativa) : null"
                clearable
                @update:model-value="
                  (v) => {
                    f.fecha_fin_tentativa = aFecha(v)
                    autosave()
                  }
                "
              />
            </div>
            <div class="sm:col-span-2">
              <GLabel>Documento de la oferta (link)</GLabel>
              <Input v-model.trim="f.documento_url" placeholder="https://…" @update:model-value="autosave" />
            </div>
            <div class="sm:col-span-2">
              <GLabel>Notas</GLabel>
              <Textarea v-model="f.notas" rows="2" @update:model-value="autosave" />
            </div>
          </div>
          <p v-if="ayudaPrecio(f.tipo)" class="mt-1.5 text-[11px] text-muted-foreground">{{ ayudaPrecio(f.tipo) }}</p>
        </section>

        <!-- ── Propuestas (versiones) ──────────────────────────────────────── -->
        <!--
          El campo "Documento de la oferta" de arriba es el de la oferta entera y
          se sobrescribe al reofertar. Las propuestas son el historial: cada
          reoferta deja su documento y su tabla de precios, y la ACEPTADA es de la
          que nacera el contrato al firmar.
        -->
        <VersionesOferta v-if="oferta?.id" :oferta-id="oferta.id" />

        <!-- ── Plantas ─────────────────────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Plantas de la oferta</h3>
          <p class="mb-2 text-[11px] text-muted-foreground">
            Son las que pasan al contrato al firmar. Una oferta puede cubrir varias
            («Balmora 1 y 2»).
          </p>
          <GLabel>Nombre de la planta (texto libre)</GLabel>
          <Input v-model.trim="f.planta_nombre" @update:model-value="autosave" />
          <div class="mt-3">
            <div class="mb-1 flex items-center justify-between">
              <GLabel class="!mb-0">Proyectos vinculados</GLabel>
              <GTooltip>
                <GTooltipTrigger as-child>
                  <Button variant="ghost" size="sm" @click="crearProyecto = true">
                    <PlusIcon class="size-4" />
                    Crear planta
                  </Button>
                </GTooltipTrigger>
                <GTooltipContent>Crearla en Proyectos y vincularla a esta oferta</GTooltipContent>
              </GTooltip>
            </div>
            <MultiComboBox
              :model-value="f.proyecto_ids.map(String)"
              :options="
                proyectos.map((p) => ({
                  label: [p.nombre_comercial, [p.municipio, p.departamento].filter(Boolean).join(', ')]
                    .filter(Boolean)
                    .join(' — '),
                  value: String(p.id),
                }))
              "
              :placeholder="cargandoCatalogos ? 'Cargando…' : 'Vincular a proyectos existentes…'"
              @update:model-value="(v) => cambiarPlantas(v.map(Number))"
            />
            <p v-if="!f.proyecto_ids?.length" class="mt-1.5 text-[11px] text-destructive">
              Sin ningún proyecto vinculado, el PPA se crearía sin plantas: ni Cumplimiento
              ni <code>/comercial/proyectos-operando</code> pueden ver esta oferta.
            </p>
          </div>
        </section>

        <!-- ── Ficha operativa ─────────────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Ficha operativa</h3>
          <p class="mb-2 text-[11px] text-muted-foreground">
            Cada dato dice de dónde salió. Lo que manda el proyecto no se edita acá:
            se arregla en el proyecto.
          </p>
          <div class="flex flex-col gap-3">
            <div v-for="c in fichaCampos" :key="c.campo" class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <GLabel>{{ c.label }}</GLabel>
                <!-- Editable solo cuando el dato es (o sería) el declarado en la
                     oferta: si lo gobierna el proyecto, escribirlo acá no cambiaría
                     nada visible y se leería como un bug. -->
                <Input
                  v-if="c.editor === 'texto'"
                  :model-value="valorCampoTexto(c.campo)"
                  @update:model-value="(v) => setCampoTexto(c.campo, String(v).trim())"
                />
                <Select
                  v-else-if="c.editor === 'operador'"
                  :model-value="f.operador_red_id !== null ? String(f.operador_red_id) : ''"
                  @update:model-value="
                    (v) => {
                      f.operador_red_id = v ? Number(v) : null
                      autosave()
                    }
                  "
                >
                  <SelectTrigger class="w-full"><SelectValue placeholder="Del catálogo…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin operador</SelectItem>
                    <SelectItem v-for="o in operadores" :key="o.id" :value="String(o.id)">{{ o.nombre }}</SelectItem>
                  </SelectContent>
                </Select>
                <NumberField
                  v-else-if="c.editor === 'numero'"
                  v-model="f.energia_promedio_kwh_mes"
                  :format-options="{ maximumFractionDigits: 0 }"
                  @update:model-value="autosave"
                >
                  <NumberFieldContent><NumberFieldInput /></NumberFieldContent>
                </NumberField>
                <div v-else class="text-sm text-foreground">{{ c.valor ?? '—' }}</div>
              </div>
              <span v-if="fuente(c.campo)" class="mt-4 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px]" :class="fuente(c.campo)!.clase">{{
                fuente(c.campo)!.label
              }}</span>
            </div>
          </div>
        </section>

        <!-- ── Contrato ────────────────────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Contrato</h3>
          <div v-if="oferta.ppa_contrato_id" class="rounded-md border border-success/30 bg-success/10 px-3 py-2">
            <NuxtLink :to="`/contratos/${oferta.ppa_contrato_id}`" class="text-sm font-medium text-success underline">
              Contrato PPA #{{ oferta.ppa_contrato_id }}
            </NuxtLink>
            <div class="mt-1 text-xs text-success">
              {{ fmtFecha(oferta.ficha?.contrato_fecha_inicio) }} → {{ fmtFecha(oferta.ficha?.contrato_fecha_fin) }}
              <span v-if="oferta.ficha?.contrato_compra_anios">
                · {{ oferta.ficha.contrato_compra_anios }} años ({{ oferta.ficha.contrato_compra_meses }} meses)
              </span>
            </div>
          </div>
          <div v-else-if="puedeFirmarPPA(oferta)">
            <Button class="w-full" @click="emit('firmar', oferta)">
              <FileCheckIcon class="size-4" />
              Firmar → crear PPA
            </Button>
            <p class="mt-1.5 text-[11px] text-muted-foreground">Crea el contrato con sus tarifas y lo enlaza a esta oferta.</p>
          </div>
          <div
            v-else-if="oferta.tipo === 'servicios_operacionales' && f.contrato_servicio_id"
            class="rounded-md border border-success/30 bg-success/10 px-3 py-2"
          >
            <NuxtLink :to="`/contratos/${f.contrato_servicio_id}`" class="text-sm font-medium text-success underline">
              Contrato de Representación #{{ f.contrato_servicio_id }}
            </NuxtLink>
            <div class="mt-1">
              <Button variant="ghost" size="sm" @click="desvincularContrato">
                <UnlinkIcon class="size-4" />
                Desvincular
              </Button>
            </div>
          </div>
          <div v-else-if="oferta.tipo === 'servicios_operacionales'">
            <Button class="w-full" @click="showContratoWizard = true">
              <FileCheckIcon class="size-4" />
              Crear contrato de representación
            </Button>
            <p class="mt-1.5 text-[11px] text-muted-foreground">Crea el contrato y lo enlaza a esta oferta.</p>
            <div class="mt-2">
              <GLabel>O vincular uno ya creado</GLabel>
              <Select
                :model-value="f.contrato_servicio_id !== null ? String(f.contrato_servicio_id) : ''"
                @update:model-value="
                  (v) => {
                    f.contrato_servicio_id = v ? Number(v) : null
                    autosave()
                  }
                "
              >
                <SelectTrigger class="w-full"><SelectValue placeholder="Buscar contrato de representación existente…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguno</SelectItem>
                  <SelectItem v-for="c in contratosServicio" :key="c.id" :value="String(c.id)">
                    {{ c.contratante_nombre || '—' }} — {{ c.numero_contrato || 'Sin N° de contrato' }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="mt-1.5 text-[11px] text-muted-foreground">
                Para un contrato creado desde otro camino (ej. la pestaña Servicios de un
                proyecto), sin pasar por esta oferta.
              </p>
            </div>
          </div>
        </section>

        <!-- ── Bitácora ────────────────────────────────────────────────────── -->
        <section>
          <h3 class="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Bitácora de esta oferta</h3>
          <div class="flex flex-wrap gap-2">
            <Select v-model="gestion.tipo">
              <SelectTrigger class="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in TIPOS_GESTION" :key="t.value" :value="t.value">{{ t.label }}</SelectItem>
              </SelectContent>
            </Select>
            <ToggleGroup v-model="gestion.direccion" type="single" variant="outline">
              <ToggleGroupItem v-for="d in DIRECCIONES" :key="d.value" :value="d.value">{{ d.label }}</ToggleGroupItem>
            </ToggleGroup>
            <Input v-model.trim="gestion.descripcion" class="flex-1" placeholder="Qué pasó…" @keyup.enter="registrarGestion" />
            <Button :disabled="!gestion.descripcion || guardandoGestion" @click="registrarGestion">
              <LoaderCircleIcon v-if="guardandoGestion" class="animate-spin" />
              <PlusIcon v-else class="size-4" />
            </Button>
          </div>
          <p class="mt-1.5 text-[11px] text-muted-foreground">
            Queda colgada de esta oferta y apaga solo su alerta — no la de sus hermanas
            del mismo cliente. <strong>Solo «Nos respondió» apaga la alerta</strong>:
            insistir no cuenta como respuesta.
          </p>
        </section>

        <div class="flex items-center justify-between border-t pt-2">
          <span class="text-xs text-muted-foreground">{{ estadoGuardado }}</span>
          <Button variant="ghost" size="sm" class="text-destructive" @click="confirmarEliminar">
            <Trash2Icon class="size-4" />
            Eliminar oferta
          </Button>
        </div>
      </div>

      <ProyectoDesdeCRMDialog
        v-if="oferta"
        v-model:visible="crearProyecto"
        :oportunidad-id="oferta.oportunidad_id!"
        :oferta="oferta"
        @creado="proyectoCreado"
      />

      <ContratoServicioWizard
        v-if="oferta && oferta.tipo === 'servicios_operacionales'"
        v-model:visible="showContratoWizard"
        tipo="representacion"
        :proyecto-id-default="f.proyecto_ids?.[0]"
        @creado="contratoCreado"
        @cerrar="showContratoWizard = false"
      />
    </SheetContent>
  </Sheet>
</template>
