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
<template>
  <Drawer :visible="visible" position="right" class="!w-full md:!w-[34rem]"
          @update:visible="$emit('update:visible', $event)">
    <template #header>
      <div v-if="oferta" class="min-w-0 pr-2">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs" style="color:#9b89b5">
            {{ oferta.codigo_seguimiento || oferta.numero_oferta || 'sin código' }}
          </span>
          <GBadge v-if="oferta.alerta" color="destructive" class="scale-90">⚠ {{ oferta.dias_sin_respuesta }}d</GBadge>
        </div>
        <h2 class="text-base font-semibold truncate" style="color:var(--color-unergy-deep)">
          {{ oferta.planta_nombre || oferta.ficha?.proyecto_nombre || 'Sin planta' }}
        </h2>
        <router-link :to="`/comercial/oportunidades/${oferta.oportunidad_id}`"
                     class="text-xs underline" style="color:var(--color-unergy-purple)">
          {{ oferta.cliente_razon_social }}
        </router-link>
      </div>
    </template>

    <div v-if="oferta" class="flex flex-col gap-5 text-sm">
      <!-- ── Etapa ───────────────────────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Etapa</h3>
        <Select :modelValue="oferta.estado" :options="ETAPAS" optionLabel="label" optionValue="value"
                class="w-full" :loading="moviendo" @update:modelValue="cambiarEtapa" />
        <p class="ayuda">
          En esta etapa desde hace {{ diasDesde(oferta.estado_desde) ?? '—' }} días.
        </p>
        <Message v-if="puedeFirmarPPA(oferta)" severity="info" :closable="false" class="mt-2">
          <span class="text-xs">
            Cuando se firme, usá <strong>Firmar → crear PPA</strong> (abajo) en vez de mover la etapa a
            mano: así queda el contrato creado y enlazado.
          </span>
        </Message>
      </section>

      <!-- ── Seguimiento del envío ───────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Seguimiento del envío</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="etiqueta">Enviada el</label>
            <DatePicker v-model="f.fecha_oferta" dateFormat="yy-mm-dd" showIcon class="w-full"
                        @update:modelValue="autosave" />
          </div>
          <div>
            <label class="etiqueta">Última respuesta del cliente</label>
            <DatePicker v-model="f.fecha_ultima_respuesta" dateFormat="yy-mm-dd" showIcon class="w-full"
                        @update:modelValue="autosave" />
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 mt-3 rounded-md px-3 py-2"
             style="background:#FAF8FC;border:1px solid #e8e0f0">
          <div class="min-w-0">
            <div class="text-xs font-medium" style="color:var(--color-unergy-deep)">
              {{ oferta.seguimientos || 0 }} toque(s) enviados
            </div>
            <div v-if="sinRespuesta(oferta)" class="text-[11px]" style="color:#D64455">
              El cliente nunca contestó
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <Button label="+1 toque" size="small" outlined :loading="tocando" v-tooltip.top="'Reenvío o llamada de insistencia'" @click="tocar">
              <template #icon><SendIcon class="size-[1em]" /></template>
            </Button>
            <Button label="Respondió" size="small" severity="success" outlined :loading="guardando" v-tooltip.top="'Marca la respuesta de hoy y apaga la alerta'" @click="marcarRespuesta">
              <template #icon><CheckIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>
      </section>

      <!-- ── Comercial ───────────────────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Comercial</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="etiqueta">Tipo de oferta</label>
            <Select v-model="f.tipo" :options="TIPOS_OFERTA" optionLabel="label" optionValue="value"
                    class="w-full" @update:modelValue="autosave" />
          </div>
          <!-- El precio de una compra de energía es una tarifa en $/kWh, no la
               comisión en % de un servicio: la etiqueta y el ejemplo siguen al tipo. -->
          <div>
            <label class="etiqueta">{{ etiquetaPrecio(f.tipo) }}</label>
            <InputText v-model.trim="f.precio_detalle" class="w-full"
                       :placeholder="placeholderPrecio(f.tipo)" @update:modelValue="autosave" />
          </div>
          <div>
            <label class="etiqueta">Inicio tentativo del suministro</label>
            <DatePicker v-model="f.fecha_tentativa_inicio" dateFormat="yy-mm-dd" showIcon class="w-full"
                        @update:modelValue="autosave" />
          </div>
          <div>
            <label class="etiqueta">Fin tentativo</label>
            <DatePicker v-model="f.fecha_fin_tentativa" dateFormat="yy-mm-dd" showIcon class="w-full"
                        @update:modelValue="autosave" />
          </div>
          <div class="sm:col-span-2">
            <label class="etiqueta">Documento de la oferta (link)</label>
            <InputText v-model.trim="f.documento_url" class="w-full" placeholder="https://…"
                       @update:modelValue="autosave" />
          </div>
          <div class="sm:col-span-2">
            <label class="etiqueta">Notas</label>
            <Textarea v-model="f.notas" rows="2" autoResize class="w-full" @update:modelValue="autosave" />
          </div>
        </div>
        <p v-if="ayudaPrecio(f.tipo)" class="ayuda">{{ ayudaPrecio(f.tipo) }}</p>
      </section>

      <!-- ── Plantas ─────────────────────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Plantas de la oferta</h3>
        <p class="ayuda mb-2">
          Son las que pasan al contrato al firmar. Una oferta puede cubrir varias
          («Balmora 1 y 2»).
        </p>
        <label class="etiqueta">Nombre de la planta (texto libre)</label>
        <InputText v-model.trim="f.planta_nombre" class="w-full" @update:modelValue="autosave" />
        <div class="mt-3">
          <div class="flex items-center justify-between mb-1">
            <label class="etiqueta !mb-0">Proyectos vinculados</label>
            <Button label="Crear planta" text size="small" v-tooltip.top="'Crearla en Proyectos y vincularla a esta oferta'" @click="crearProyecto = true">
              <template #icon><PlusIcon class="size-[1em]" /></template>
            </Button>
          </div>
          <MultiSelect v-model="f.proyecto_ids" :options="proyectos" optionLabel="nombre_comercial"
                       :filterFields="['nombre_comercial', 'municipio', 'departamento']"
                       optionValue="id" filter display="chip" class="w-full"
                       :loading="cargandoCatalogos" placeholder="Vincular a proyectos existentes…"
                       filterPlaceholder="Buscar por nombre, municipio o departamento…"
                       @update:modelValue="cambiarPlantas">
            <template #option="{ option }">
              <div class="min-w-0">
                <div class="text-sm" style="color:var(--color-unergy-deep)">{{ option.nombre_comercial }}</div>
                <div class="text-[11px]" style="color:#9b89b5">
                  {{ [option.municipio, option.departamento].filter(Boolean).join(', ') || 'Sin ubicación' }}
                  <span v-if="option.potencia_instalada_kwp">
                    · {{ Number(option.potencia_instalada_kwp).toLocaleString('es-CO', { maximumFractionDigits: 0 }) }} kWp
                  </span>
                </div>
              </div>
            </template>
          </MultiSelect>
          <p v-if="!f.proyecto_ids?.length" class="ayuda" style="color:#D64455">
            Sin ningún proyecto vinculado, el PPA se crearía sin plantas: ni Cumplimiento
            ni <code>/comercial/proyectos-operando</code> pueden ver esta oferta.
          </p>
        </div>
      </section>

      <!-- ── Ficha operativa ─────────────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Ficha operativa</h3>
        <p class="ayuda mb-2">
          Cada dato dice de dónde salió. Lo que manda el proyecto no se edita acá:
          se arregla en el proyecto.
        </p>
        <div class="flex flex-col gap-3">
          <div v-for="c in fichaCampos" :key="c.campo" class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="etiqueta">{{ c.label }}</div>
              <!-- Editable solo cuando el dato es (o sería) el declarado en la
                   oferta: si lo gobierna el proyecto, escribirlo acá no cambiaría
                   nada visible y se leería como un bug. -->
              <InputText v-if="c.editor === 'texto'" v-model.trim="f[c.campo]" class="w-full"
                         @update:modelValue="autosave" />
              <Select v-else-if="c.editor === 'operador'" v-model="f[c.campo]" :options="operadores"
                      optionLabel="nombre" optionValue="id" filter showClear class="w-full"
                      placeholder="Del catálogo…" @update:modelValue="autosave" />
              <InputNumber v-else-if="c.editor === 'numero'" v-model="f[c.campo]" class="w-full"
                           :maxFractionDigits="0" @update:modelValue="autosave" />
              <div v-else class="text-sm" style="color:var(--color-unergy-deep)">{{ c.valor ?? '—' }}</div>
            </div>
            <span v-if="fuente(c.campo)" class="text-[10px] rounded px-1.5 py-0.5 flex-shrink-0 mt-4"
                  :class="fuente(c.campo).clase">{{ fuente(c.campo).label }}</span>
          </div>
        </div>
      </section>

      <!-- ── Contrato ────────────────────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Contrato</h3>
        <div v-if="oferta.ppa_contrato_id" class="rounded-md px-3 py-2"
             style="background:#E6F7F5;border:1px solid #99E0D8">
          <router-link :to="`/contratos/${oferta.ppa_contrato_id}`" class="text-sm font-medium underline"
                       style="color:#0F766E">
            Contrato PPA #{{ oferta.ppa_contrato_id }}
          </router-link>
          <div class="text-xs mt-1" style="color:#0F766E">
            {{ fmtFecha(oferta.ficha?.contrato_fecha_inicio) }} → {{ fmtFecha(oferta.ficha?.contrato_fecha_fin) }}
            <span v-if="oferta.ficha?.contrato_compra_anios">
              · {{ oferta.ficha.contrato_compra_anios }} años ({{ oferta.ficha.contrato_compra_meses }} meses)
            </span>
          </div>
        </div>
        <div v-else-if="puedeFirmarPPA(oferta)">
          <Button label="Firmar → crear PPA" class="w-full" @click="$emit('firmar', oferta)">
            <template #icon><FileCheckIcon class="size-[1em]" /></template>
          </Button>
          <p class="ayuda">Crea el contrato con sus tarifas y lo enlaza a esta oferta.</p>
        </div>
        <div v-else-if="oferta.tipo === 'servicios_operacionales' && f.contrato_servicio_id"
             class="rounded-md px-3 py-2" style="background:#E6F7F5;border:1px solid #99E0D8">
          <router-link :to="`/contratos/${f.contrato_servicio_id}`" class="text-sm font-medium underline"
                       style="color:#0F766E">
            Contrato de Representación #{{ f.contrato_servicio_id }}
          </router-link>
          <div class="mt-1">
            <Button label="Desvincular" text size="small" severity="secondary" @click="desvincularContrato">
              <template #icon><UnlinkIcon class="size-[1em]" /></template>
            </Button>
          </div>
        </div>
        <div v-else-if="oferta.tipo === 'servicios_operacionales'">
          <Button label="Crear contrato de representación" class="w-full" @click="showContratoWizard = true">
            <template #icon><FileCheckIcon class="size-[1em]" /></template>
          </Button>
          <p class="ayuda">Crea el contrato y lo enlaza a esta oferta.</p>
          <div class="mt-2">
            <label class="etiqueta">O vincular uno ya creado</label>
            <Select v-model="f.contrato_servicio_id" :options="contratosServicio" optionLabel="contratante_nombre"
                    optionValue="id" filter showClear class="w-full" :loading="cargandoCatalogos"
                    placeholder="Buscar contrato de representación existente…"
                    @update:modelValue="autosave">
              <template #option="{ option }">
                <div class="min-w-0">
                  <div class="text-sm" style="color:var(--color-unergy-deep)">{{ option.contratante_nombre || '—' }}</div>
                  <div class="text-[11px]" style="color:#9b89b5">{{ option.numero_contrato || 'Sin N° de contrato' }}</div>
                </div>
              </template>
            </Select>
            <p class="ayuda">
              Para un contrato creado desde otro camino (ej. la pestaña Servicios de un
              proyecto), sin pasar por esta oferta.
            </p>
          </div>
        </div>
      </section>

      <!-- ── Bitácora ────────────────────────────────────────────────────── -->
      <section>
        <h3 class="seccion">Bitácora de esta oferta</h3>
        <div class="flex gap-2">
          <Select v-model="gestion.tipo" :options="TIPOS_GESTION" optionLabel="label" optionValue="value"
                  class="w-36" />
          <InputText v-model.trim="gestion.descripcion" class="flex-1"
                     placeholder="Qué pasó…" @keyup.enter="registrarGestion" />
          <Button :disabled="!gestion.descripcion" :loading="guardandoGestion" @click="registrarGestion">
            <template #icon><PlusIcon class="size-[1em]" /></template>
          </Button>
        </div>
        <p class="ayuda">
          Queda colgada de esta oferta y apaga solo su alerta — no la de sus hermanas
          del mismo cliente.
        </p>
      </section>

      <div class="flex items-center justify-between pt-2 border-t" style="border-color:#e8e0f0">
        <span class="text-xs" style="color:#9b89b5">{{ estadoGuardado }}</span>
        <Button label="Eliminar oferta" text severity="danger" size="small" @click="confirmarEliminar">
          <template #icon><Trash2Icon class="size-[1em]" /></template>
        </Button>
      </div>
    </div>

    <ProyectoDesdeCRMDialog v-if="oferta" v-model:visible="crearProyecto"
                            :oportunidad-id="oferta.oportunidad_id" :oferta="oferta"
                            @creado="proyectoCreado" />

    <ContratoServicioWizard v-if="oferta && oferta.tipo === 'servicios_operacionales'"
                            v-model:visible="showContratoWizard" tipo="representacion"
                            :proyecto-id-default="f.proyecto_ids?.[0] ?? null"
                            @creado="contratoCreado" @cerrar="showContratoWizard = false" />
  </Drawer>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { toast } from 'vue-sonner'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import {
  ETAPAS, TIPOS_OFERTA, TIPOS_GESTION, FUENTES, puedeFirmarPPA,
  aFecha, aFechaStr, fmtFecha, diasDesde, sinRespuesta,
  etiquetaPrecio, placeholderPrecio, ayudaPrecio,
} from './comercial.js'
import { cargarProyectos } from './catalogos.js'
import ProyectoDesdeCRMDialog from './ProyectoDesdeCRMDialog.vue'
import ContratoServicioWizard from '~/features/contratos/components/ContratoServicioWizard.vue'
import { CheckIcon, FileCheckIcon, PlusIcon, SendIcon, Trash2Icon, UnlinkIcon } from '@lucide/vue'

const props = defineProps({
  visible: Boolean,
  oferta: { type: Object, default: null },
  /**
   * Las mutaciones de useOfertas(), inyectadas por la vista dueña del estado.
   * Se pasan como objeto en vez de emitir eventos con callback porque el drawer
   * necesita el RESULTADO de cada acción (para el "Guardado ✓" y para revertir),
   * y un emit no devuelve nada.
   */
  acciones: { type: Object, required: true },
})
const emit = defineEmits(['update:visible', 'firmar'])

const confirm = useConfirm()
const operadoresRedService = new OperadoresRedService()
const contratosServicioService = new ContratosServicioService()

const moviendo = ref(false)
const tocando = ref(false)
const guardando = ref(false)
const guardandoGestion = ref(false)
const estadoGuardado = ref('')
const proyectos = ref([])
const operadores = ref([])
const contratosServicio = ref([])
const cargandoCatalogos = ref(false)
const crearProyecto = ref(false)
const showContratoWizard = ref(false)
let temporizador = null

/**
 * La planta recién creada ya viene vinculada del backend (`?oferta_id=`). Acá
 * solo se refleja en el selector para que se vea sin recargar; NO se reenvía la
 * M2M, porque el backend ya la escribió y mandarla otra vez la reescribiría.
 */
function proyectoCreado(p) {
  proyectos.value = [...proyectos.value, {
    id: p.id,
    nombre_comercial: p.nombre_comercial,
    municipio: p.municipio ?? null,
    departamento: p.departamento ?? null,
    estado: p.estado ?? null,
    potencia_instalada_kwp: p.potencia_instalada_kwp ?? null,
  }].sort((a, b) => (a.nombre_comercial || '').localeCompare(b.nombre_comercial || '', 'es'))
  if (!f.proyecto_ids?.includes(p.id)) f.proyecto_ids = [...(f.proyecto_ids ?? []), p.id]
}

const gestion = reactive({ tipo: 'llamada', descripcion: '' })

// Copia editable. Se rearma cada vez que cambia la oferta abierta para que un
// autosave pendiente nunca escriba los datos de una oferta sobre otra.
const f = reactive({})

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

function cargarFormulario(o) {
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

watch(() => props.oferta?.id, () => {
  clearTimeout(temporizador)
  cargarFormulario(props.oferta)
}, { immediate: true })

// Los catálogos se cargan la primera vez que se abre el drawer, no al montar la
// vista: son más de mil proyectos que la mayoría de las sesiones no necesita.
watch(() => props.visible, async (abierto) => {
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
    toast.warning('No se pudo cargar la lista de proyectos', { duration: 4000 })
  }
  if (op.status === 'fulfilled') {
    operadores.value = op.value.map((o) => ({ id: o.id, nombre: o.nombre_comercial || o.nombre_legal }))
  }
  if (cs.status === 'fulfilled') {
    contratosServicio.value = cs.value
  }
  cargandoCatalogos.value = false
})

// ── Ficha operativa: valor + procedencia por campo ──────────────────────────
function fuente(campo) {
  const clave = props.oferta?.ficha?.fuentes?.[campo]
  return clave ? FUENTES[clave] : null
}

// Si el dato lo gobierna el proyecto, escribir la oferta no cambiaría lo que se
// ve: el campo se muestra de solo lectura con su chip de procedencia.
const gobiernaProyecto = (campo) => props.oferta?.ficha?.fuentes?.[campo] === 'proyecto'

const fichaCampos = computed(() => {
  const ficha = props.oferta?.ficha ?? {}
  const kwh = ficha.energia_promedio_kwh_mes
  return [
    { campo: 'municipio', label: 'Municipio', valor: ficha.municipio,
      editor: gobiernaProyecto('municipio') ? null : 'texto' },
    { campo: 'departamento', label: 'Departamento', valor: ficha.departamento,
      editor: gobiernaProyecto('departamento') ? null : 'texto' },
    { campo: 'operador_red_id', label: 'Operador de red', valor: ficha.operador_red,
      editor: gobiernaProyecto('operador_red') ? null : 'operador' },
    { campo: 'energia_promedio_kwh_mes', label: 'Energía promedio estimada (kWh/mes)',
      valor: typeof kwh === 'number' ? kwh.toLocaleString('es-CO') : null,
      editor: gobiernaProyecto('energia_promedio_kwh_mes') ? null : 'numero' },
    { campo: 'energia_real_kwh_mes', label: 'Energía medida (último mes cerrado)',
      valor: typeof ficha.energia_real_kwh_mes === 'number'
        ? `${ficha.energia_real_kwh_mes.toLocaleString('es-CO')} kWh · ${ficha.energia_real_periodo}`
        : null,
      editor: null },
    { campo: 'fecha_inicio_operacion', label: 'Inicio de operación',
      valor: ficha.fecha_inicio_operacion ? fmtFecha(ficha.fecha_inicio_operacion) : null,
      editor: null },
  ]
})

// ── Guardado ────────────────────────────────────────────────────────────────
function cambiarPlantas() {
  plantasTocadas.value = true
  autosave()
}

function cambios() {
  const c = {
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
function contratoCreado(data) {
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

async function cambiarEtapa(estado) {
  if (!estado || estado === props.oferta?.estado) return
  moviendo.value = true
  const r = await props.acciones.moverEtapa(props.oferta, estado)
  moviendo.value = false
  if (!r.ok) {
    toast.error('No se pudo cambiar la etapa', { description: r.error, duration: 5000 })
  }
}

async function tocar() {
  tocando.value = true
  const r = await props.acciones.registrarSeguimiento(props.oferta.id)
  tocando.value = false
  if (!r.ok) {
    toast.error('No se pudo registrar el toque', { description: r.error, duration: 5000 })
  }
}

/**
 * Marcar la respuesta hace DOS cosas: guarda la fecha (el dato) y registra la
 * gestión — que es lo que de verdad apaga la alerta, porque calcular_alerta mira
 * la última gestión de la bitácora y no esta columna.
 */
async function marcarRespuesta() {
  f.fecha_ultima_respuesta = new Date()
  clearTimeout(temporizador)
  const r = await guardarAhora()
  if (!r.ok) return
  await props.acciones.registrarGestion(props.oferta.oportunidad_id, {
    tipo: 'correo',
    descripcion: 'El cliente respondió la oferta',
    ofertaId: props.oferta.id,
  })
  toast.success('Respuesta registrada', { duration: 2500 })
}

async function registrarGestion() {
  if (!gestion.descripcion) return
  guardandoGestion.value = true
  const r = await props.acciones.registrarGestion(props.oferta.oportunidad_id, {
    tipo: gestion.tipo, descripcion: gestion.descripcion, ofertaId: props.oferta.id,
  })
  guardandoGestion.value = false
  if (r.ok) {
    gestion.descripcion = ''
    toast.success('Gestión registrada', { duration: 2500 })
  } else {
    toast.error('No se pudo registrar', { description: r.error, duration: 5000 })
  }
}

function confirmarEliminar() {
  const nombre = props.oferta.planta_nombre || props.oferta.codigo_seguimiento || 'esta oferta'
  confirm({
    title: 'Eliminar oferta',
    description: `Se elimina «${nombre}» y su histórico de etapas. No se puede deshacer.`,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'destructive',
    onConfirm: async () => {
      const r = await props.acciones.eliminarOferta(props.oferta.id)
      if (r.ok) emit('update:visible', false)
      else toast.error('No se pudo eliminar', { description: r.error, duration: 5000 })
    },
  })
}

// Evita que un autosave pendiente dispare tras cerrar la vista.
onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<style scoped>
.seccion {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #7a6e8a;
  margin-bottom: 0.5rem;
}
.etiqueta {
  display: block;
  font-size: 11px;
  color: #7a6e8a;
  margin-bottom: 0.15rem;
}
.ayuda {
  font-size: 11px;
  color: #9b89b5;
  margin-top: 0.35rem;
}
</style>
