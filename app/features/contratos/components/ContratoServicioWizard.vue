<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal
    class="w-full max-w-3xl"
    :header="null" :closable="true" @hide="$emit('cerrar')">

    <!-- Step indicator -->
    <div class="px-6 pt-5 pb-4 border-b border-muted">
      <p class="text-sm font-bold mb-4 text-(--c)" :style="{ '--c': tipoColor }">
        Nuevo contrato · {{ tipoLabel }}
      </p>
      <div class="flex items-start">
        <template v-for="(s, i) in STEPS" :key="i">
          <div class="flex flex-col items-center gap-1.5 flex-1">
            <div class="size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              :style="{ '--c': tipoColor }"
              :class="step >= i ? 'bg-(--c) text-white' : 'bg-muted text-muted-foreground'">
              <CheckIcon class="size-3" v-if="step > i" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-xs text-center leading-tight px-0.5 font-medium"
              :style="{ '--c': tipoColor }"
              :class="step === i ? 'text-(--c)' : step < i ? 'text-muted-foreground/60' : 'text-muted-foreground'">
              {{ s.label }}
            </span>
          </div>
          <div v-if="i < STEPS.length - 1" class="h-0.5 mt-3.5 mx-0.5 transition-all flex-1"
            :style="{ '--c': tipoColorSuave }"
            :class="step > i ? 'bg-(--c)' : 'bg-muted'" />
        </template>
      </div>
    </div>

    <!-- Content -->
    <div class="px-6 py-5 min-h-72">

      <!-- PASO 0 (internet): solo los datos técnicos del servicio -->
      <template v-if="step === 0 && tipo === 'internet'">
        <p class="text-sm font-semibold text-foreground mb-4">Datos del servicio</p>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Plan de datos</label>
              <InputText v-model="form.plan_datos_gb" class="w-full" placeholder="50 GB / Ilimitado" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Velocidad contratada</label>
              <InputNumber v-model="form.velocidad_mbps" suffix=" Mbps" :useGrouping="false" class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Tipo de conexión</label>
            <Select v-model="form.tipo_conexion"
              :options="[{label:'Starlink',value:'Starlink'},{label:'Fibra',value:'Fibra'},{label:'4G',value:'4G'},{label:'Otro',value:'Otro'}]"
              optionLabel="label" optionValue="value" editable placeholder="Selecciona…" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Línea de servicio</label>
              <InputText v-model="form.linea_servicio" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">ID del router</label>
              <InputText v-model="form.id_router" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Número de kit</label>
              <InputText v-model="form.numero_kit" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Latencia</label>
              <InputNumber v-model="form.latencia_ms" suffix=" ms" :useGrouping="false" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Seguridad del wifi</label>
              <Select v-model="form.wifi_seguridad" :options="WIFI_SEGURIDAD_OPTS"
                optionLabel="label" optionValue="value" showClear placeholder="Selecciona…" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Contraseña wifi</label>
              <InputText v-model="form.wifi_password" class="w-full" />
            </div>
          </div>

          <!-- Ubicación del servicio -->
          <div class="rounded-lg border border-border p-3">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-xs font-semibold text-muted-foreground">Ubicación del servicio</p>
                <p class="text-sm text-foreground">Ubicación: {{ ubicacionLabel }}</p>
              </div>
              <Button type="button" :label="editandoUbicacion ? 'Listo' : 'Editar'" text size="small"
                @click="editandoUbicacion = !editandoUbicacion" />
            </div>
            <div v-if="editandoUbicacion" class="grid grid-cols-2 gap-4 mb-2">
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Latitud</label>
                <InputNumber v-model="form.ubicacion_lat" :minFractionDigits="4" :maxFractionDigits="6" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Longitud</label>
                <InputNumber v-model="form.ubicacion_lng" :minFractionDigits="4" :maxFractionDigits="6" class="w-full" />
              </div>
            </div>
            <p v-if="editandoUbicacion" class="text-xs text-muted-foreground mb-2">
              Haz clic en el mapa para ubicar el servicio.
            </p>
            <div ref="ubicacionMapEl" class="rounded-md overflow-hidden h-55 bg-muted"></div>
          </div>
        </div>
      </template>

      <!-- PASO 0: Identificación -->
      <template v-if="step === 0 && tipo !== 'internet'">
        <p class="text-sm font-semibold text-foreground mb-4">Identificación del contrato</p>
        <div class="space-y-4">
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Proyecto asociado <span class="text-muted-foreground">(opcional)</span></label>
            <Select
              v-model="form.proyecto_id"
              :options="todosProyectos"
              optionLabel="nombre_comercial"
              optionValue="id"
              placeholder="Seleccionar proyecto"
              filter
              filterPlaceholder="Buscar…"
              showClear
              class="w-full"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Número de contrato</label>
              <InputText v-model="form.numero_contrato" placeholder="Ej: REP-001-2024" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Estado</label>
              <Select v-model="form.estado" :options="ESTADOS" optionLabel="label" optionValue="value" class="w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha firma <span class="text-muted-foreground">(opcional)</span></label>
              <DatePicker v-model="form.fecha_firma_contrato" dateFormat="yy-mm-dd" class="w-full" showClear />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Estado del pago <span class="text-muted-foreground">(opcional)</span></label>
              <Select v-model="form.estado_pago" :options="[{label:'Pendiente',value:'pendiente'},{label:'Revisado',value:'revisado'},{label:'Aprobado',value:'aprobado'}]"
                optionLabel="label" optionValue="value" placeholder="Seleccionar" showClear class="w-full" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1">Enlace contrato en Drive <span class="text-muted-foreground">(opcional)</span></label>
            <InputText v-model="form.enlace_drive" placeholder="https://drive.google.com/…" class="w-full" />
          </div>
        </div>
      </template>

      <!-- PASO 1: Partes -->
      <template v-if="step === 1 && tipo !== 'internet'">
        <p class="text-sm font-semibold text-foreground mb-4">Partes del contrato</p>
        <div class="grid grid-cols-2 gap-1 mb-1 px-1">
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contratante</span>
          <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prestador</span>
        </div>
        <div class="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted">
          <!-- Contratante -->
          <div class="space-y-3">
            <SelectorCliente
              v-model:id="form.contratante_id"
              v-model:nombre="form.contratante_nombre"
              v-model:nit="form.contratante_nit"
              label="Nombre / Razón social"
              requerido
            />
            <NitDeCliente :nit="form.contratante_nit" />
          </div>
          <!-- Prestador -->
          <div class="space-y-3">
            <SelectorCliente
              v-model:id="form.prestador_id"
              v-model:nombre="form.prestador_nombre"
              v-model:nit="form.prestador_nit"
              label="Nombre / Razón social"
              requerido
            />
            <NitDeCliente :nit="form.prestador_nit" />
          </div>
        </div>

        <!-- Inversionista: solo en representación/CGM, que es donde la tarifa
             varía por inversionista. En una minigranja hay un contrato POR
             inversionista, y sin decir de quién es, el reparto de costos no
             puede saber qué tarifa cobrarle a cada quien. -->
        <template v-if="tipo === 'representacion'">
          <div class="grid grid-cols-1 gap-1 mb-1 mt-4 px-1">
            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inversionista</span>
          </div>
          <div class="p-4 rounded-lg bg-muted">
            <SelectorCliente
              v-model:id="form.inversionista_id"
              v-model:nombre="form.inversionista_nombre"
              label="Nombre / Razón social"
              requerido
            />
            <p class="text-xs text-muted-foreground leading-snug mt-2">
              En minigranjas hay un contrato por inversionista, y cada uno puede
              tener su propia tarifa.
            </p>
          </div>
        </template>
      </template>

      <!-- PASO 2: Términos económicos -->
      <template v-if="step === 2 && tipo !== 'internet'">
        <p class="text-sm font-semibold text-foreground mb-4">Términos económicos</p>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha inicio</label>
              <DatePicker v-model="form.fecha_inicio" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Fecha fin</label>
              <DatePicker v-model="form.fecha_fin" dateFormat="yy-mm-dd" showIcon class="w-full" />
            </div>
          </div>
          <!-- Un contrato de este grupo puede cubrir representación, CGM o las dos.
               Lo dicen las casillas, que viajan como `servicios`; la tarifa ya no
               decide nada (puede llegar después) y solo se pide la de lo marcado. -->
          <div v-if="props.tipo === 'representacion'" class="space-y-3">
            <div class="flex flex-col gap-1">
              <span class="block text-xs font-medium text-muted-foreground mb-1">Servicios que cubre</span>
              <div class="flex items-center gap-6">
                <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="form.cubre_representacion" :binary="true" /> Representación
                </label>
                <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox v-model="form.cubre_cgm" :binary="true" /> CGM
                </label>
              </div>
              <small v-if="sinServicio" class="text-xs text-destructive leading-snug">Marca al menos uno.</small>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div v-if="form.cubre_representacion" class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Tarifa representación (COP/kWh)</label>
                <InputNumber v-model="form.tarifa_representacion" :minFractionDigits="2"
                  :maxFractionDigits="6" class="w-full" />
              </div>
              <div v-if="form.cubre_cgm" class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Tarifa CGM (COP/kWh)</label>
                <InputNumber v-model="form.tarifa_cgm" :minFractionDigits="2"
                  :maxFractionDigits="6" class="w-full" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div v-if="props.tipo !== 'representacion'" class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Tarifa base (COP/kWh)</label>
              <InputNumber v-model="form.tarifa_base" :minFractionDigits="2" :maxFractionDigits="4" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Periodicidad de pago</label>
              <Select v-model="form.periodicidad_pago" :options="PERIODICIDADES"
                optionLabel="label" optionValue="value" showClear class="w-full" />
            </div>
          </div>

          <div class="max-w-xs">
            <div class="flex flex-col gap-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1">Índice de indexación</label>
              <InputText v-model="form.indice_indexacion" placeholder="Ej: IPC, IPP" class="w-full" />
            </div>
          </div>

          <!-- Detalles operacionales y contractuales -->
          <div class="border-t border-muted pt-3">
            <p class="text-xs font-semibold uppercase tracking-wide mb-3 text-(--c)" :style="{ '--c': tipoColor }">
              Detalles operacionales y contractuales
              <span class="normal-case font-normal text-muted-foreground">(opcional)</span>
            </p>
            <div class="space-y-4">
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Alcance del servicio</label>
                <Textarea v-model="form.service_scope" rows="3" autoResize class="w-full"
                  placeholder="Describe el alcance del servicio…" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Términos específicos del servicio</label>
                <Textarea v-model="form.specific_service_terms" rows="3" autoResize class="w-full"
                  placeholder="Términos específicos aplicables al servicio…" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">SLAs (Acuerdos de nivel de servicio)</label>
                <Textarea v-model="form.slas" rows="3" autoResize class="w-full"
                  placeholder="Acuerdos de nivel de servicio, tiempos de respuesta…" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="block text-xs font-medium text-muted-foreground mb-1">Responsabilidades</label>
                <Textarea v-model="form.responsibilities" rows="3" autoResize class="w-full"
                  placeholder="Responsabilidades de las partes…" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- PASO 3: Arrendadores (solo ARRIENDO) -->
      <template v-if="tipo === 'arriendo' && step === STEPS.length - 1">
        <p class="text-sm font-semibold text-foreground mb-4">Arrendadores</p>
        <p class="text-xs text-muted-foreground mb-3">
          El contrato ya se creó. Agrega al menos un arrendador (persona/entidad que recibe el pago) antes de finalizar.
        </p>
        <div class="rounded-xl border border-primary/20">
          <div class="flex items-center justify-between px-4 py-2.5 bg-primary/5">
            <span class="text-xs font-semibold flex items-center gap-1.5 text-primary">
              <UsersIcon class="size-3 text-primary" />Arrendadores
            </span>
            <Button label="Agregar arrendador" size="small" text class="text-primary" @click="openArrendadorDialog('crear')">
              <template #icon><PlusIcon class="size-4" /></template>
            </Button>
          </div>
          <div v-if="!arrendadores.length" class="px-4 py-6 text-center text-xs text-muted-foreground">
            Sin arrendadores registrados.
          </div>
          <div v-else class="divide-y divide-muted">
            <div v-for="a in arrendadores" :key="a.id"
              class="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-semibold text-foreground">{{ a.nombre }}</span>
                <span class="text-sm font-mono tabular-nums text-primary">{{ formatCOP(a.valor_base) }}</span>
                <span v-if="a.responsable_iva" class="text-xs px-1.5 py-0.5 rounded font-bold leading-none bg-primary/10 text-primary">Responsable IVA</span>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <Button size="small" text severity="secondary" @click="openArrendadorDialog('editar', a)">
                  <template #icon><PencilIcon class="size-4" /></template>
                </Button>
                <Button size="small" text severity="danger" @click="eliminarArrendadorWizard(a)">
                  <template #icon><Trash2Icon class="size-4" /></template>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Arrendador (crear/editar) -->
        <Dialog v-model:visible="arrendadorDialog.visible" modal
          :header="arrendadorDialog.modo === 'editar' ? 'Editar arrendador' : 'Agregar arrendador'"
          class="w-full max-w-md">
          <div class="flex flex-col gap-3 pt-2">
            <!-- El arrendador FACTURA, así que necesita NIT y razón social: por
                 eso se vincula a un cliente en vez de escribirse a mano. -->
            <SelectorCliente
              v-model:id="arrendadorDialog.form.cliente_id"
              v-model:nombre="arrendadorDialog.form.nombre"
              label="Nombre / Razón social"
              requerido
            />
            <div>
              <label class="text-xs font-medium text-muted-foreground">Valor base</label>
              <InputNumber v-model="arrendadorDialog.form.valor_base" class="w-full" mode="currency"
                currency="COP" locale="es-CO" :maxFractionDigits="0" />
            </div>
            <div>
              <label class="text-xs font-medium text-muted-foreground">Responsable IVA</label>
              <Select v-model="arrendadorDialog.form.responsable_iva"
                :options="[{label:'Sí',value:true},{label:'No',value:false}]"
                optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Anticipo pagado desde</label>
              <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_desde" dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Anticipo pagado hasta</label>
              <DatePicker v-model="arrendadorDialog.form.anticipo_pagado_hasta" dateFormat="yy-mm-dd" class="w-full" showClear placeholder="aaaa-mm-dd" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-muted-foreground">Observaciones</label>
              <Textarea v-model="arrendadorDialog.form.observaciones" rows="2" class="w-full" />
            </div>
          </div>
          <template #footer>
            <Button label="Cancelar" text severity="secondary" @click="arrendadorDialog.visible = false" />
            <Button label="Guardar" :loading="arrendadorDialog.guardando" @click="guardarArrendadorWizard" />
          </template>
        </Dialog>
      </template>

    </div>

    <!-- Footer -->
    <div class="px-6 py-4 border-t border-muted flex justify-between items-center">
      <Button v-if="step > 0 && !contratoIdCreado" label="Anterior" severity="secondary" outlined @click="step--">
        <template #icon><ArrowLeftIcon class="size-4" /></template>
      </Button>
      <span v-else />
      <div class="flex gap-2">
        <Button label="Cancelar" severity="secondary" text @click="$emit('cerrar')" />
        <Button v-if="tipo === 'arriendo' && step === STEPS.length - 2" label="Crear y continuar" class="flex-row-reverse bg-(--c) border-(--c)"
          :loading="guardando"
          :style="{ '--c': tipoColor }"
          @click="crearYContinuarArriendo">
          <template #icon><ArrowRightIcon class="size-4" /></template>
        </Button>
        <Button v-else-if="tipo === 'arriendo' && step === STEPS.length - 1" label="Finalizar" class="bg-(--c) border-(--c)" :style="{ '--c': tipoColor }" @click="finalizarArriendo">
          <template #icon><CheckIcon class="size-4" /></template>
        </Button>
        <Button v-else-if="step < STEPS.length - 1" label="Siguiente" class="flex-row-reverse bg-(--c) border-(--c)"
          :style="{ '--c': tipoColor }"
          :disabled="(step === 1 && partesPendientes.length > 0) || (step === 2 && sinServicio)"
          v-tooltip="avisoPartes"
          @click="step++">
          <template #icon><ArrowRightIcon class="size-4" /></template>
        </Button>
        <Button v-else label="Crear contrato" class="bg-(--c) border-(--c)" :loading="guardando" :disabled="partesPendientes.length > 0 || sinServicio"
          v-tooltip="avisoPartes"
          :style="{ '--c': tipoColor }" @click="guardar">
          <template #icon><CheckIcon class="size-4" /></template>
        </Button>
      </div>
    </div>

    <!-- Ya hay un contrato vigente de este servicio en esta planta. Avisa y deja
         seguir: la renovación mientras el anterior sigue vigente es un caso
         legítimo, pero enterarse evita otro MGS Naos 2 (tres filas, un solo
         contrato). -->
    <Dialog :visible="!!duplicadoContrato" @update:visible="duplicadoContrato = null"
      header="Ya existe un contrato para este servicio" modal class="w-full max-w-sm">
      <p class="text-sm text-muted-foreground">{{ duplicadoContrato?.mensaje }}</p>
      <p class="text-xs text-muted-foreground mt-2">
        Si es una renovación o un contrato distinto, podés crearlo igual.
      </p>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="duplicadoContrato = null" />
        <Button label="Crear igual" :loading="guardando" @click="crearDeTodosModos" />
      </template>
    </Dialog>

  </Dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import SelectorCliente from '~/features/clientes/components/SelectorCliente.vue'
import NitDeCliente from '~/features/clientes/components/NitDeCliente.vue'
import { ContratosServicioService } from '~/features/contratos/services/contratos-servicio'
import { formatCOP } from '~/utils/currency'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from '@lucide/vue'

const contratosServicioService = new ContratosServicioService()
// El catalogo de plantas se pide UNA vez para toda la aplicacion:
// ver ~/composables/useProyectosCatalogo.
const catalogoProyectos = useProyectosCatalogo()

const props = defineProps({
  visible: Boolean,
  tipo: { type: String, required: true }, // representacion | mantenimiento | arriendo | internet | rec
  proyectoIdDefault: { type: Number, default: null },
})
const emit = defineEmits(['update:visible', 'cerrar', 'creado'])

const step = ref(0)
const guardando = ref(false)
const todosProyectos = ref([])

const TIPO_CONFIG = {
  representacion: { label: 'Representación', color: 'var(--chart-3)' },
  mantenimiento:  { label: 'Mantenimiento',   color: 'var(--warning)' },
  arriendo:       { label: 'Arriendo',        color: 'var(--primary)' },
  internet:       { label: 'Internet',        color: 'var(--chart-2)' },
}

const tipoColor = computed(() => TIPO_CONFIG[props.tipo]?.color ?? 'var(--muted-foreground)')
const tipoColorSuave = computed(() => `color-mix(in oklab, ${tipoColor.value} 38%, transparent)`)
const tipoLabel = computed(() => TIPO_CONFIG[props.tipo]?.label ?? props.tipo)

const STEPS = computed(() => {
  if (props.tipo === 'internet') return [{ label: 'Datos del servicio' }]
  const base = [
    { label: 'Identificación' },
    { label: 'Partes' },
    { label: 'Términos' },
  ]
  if (props.tipo === 'arriendo') return [...base, { label: 'Arrendadores' }]
  return base
})

// Solo lo que una persona decide. 'Vigente' y 'Vencido' salieron de acá: los
// calcula el backend desde la fecha fin, y ofrecerlos dejaba marcar un contrato
// como vigente cuando su fecha ya había pasado (8 contratos así en producción).
const ESTADOS = [
  { label: 'Firmado',       value: 'firmado' },
  { label: 'En renovación', value: 'en_renovacion' },
  { label: 'Terminado',     value: 'terminado' },
]

const PERIODICIDADES = [
  { label: 'Mensual',    value: 'mensual' },
  { label: 'Bimestral',  value: 'bimestral' },
  { label: 'Trimestral', value: 'trimestral' },
  { label: 'Anual',      value: 'anual' },
]

const form = reactive({
  proyecto_id: null,
  numero_contrato: '',
  estado: 'firmado',
  contratante_id: null,
  contratante_nombre: null,
  contratante_nit: '',
  prestador_id: null,
  prestador_nombre: null,
  prestador_nit: '',
  // Solo lo pide representación/CGM: es el que decide qué tarifa se le cobra a
  // cada inversionista de una minigranja.
  inversionista_id: null,
  inversionista_nombre: null,
  fecha_inicio: null,
  fecha_fin: null,
  tarifa_base: null,
  tarifa_representacion: null,
  tarifa_cgm: null,
  // Representación/CGM: qué servicios cubre el contrato. Viajan como `servicios`.
  cubre_representacion: true,
  cubre_cgm: false,
  periodicidad_pago: null,
  indice_indexacion: '',
  fecha_firma_contrato: null,
  enlace_drive: '',
  estado_pago: null,
  service_scope: '',
  specific_service_terms: '',
  slas: '',
  responsibilities: '',
  plan_datos_gb: '',
  velocidad_mbps: null,
  tipo_conexion: null,
  linea_servicio: '',
  id_router: '',
  numero_kit: '',
  latencia_ms: null,
  wifi_seguridad: null,
  wifi_password: '',
  ubicacion_lat: null,
  ubicacion_lng: null,
})

const WIFI_SEGURIDAD_OPTS = [
  { label: 'WPA2',            value: 'WPA2' },
  { label: 'WPA3',            value: 'WPA3' },
  { label: 'WPA2/WPA3',       value: 'WPA2/WPA3' },
  { label: 'WPA3-OWE',        value: 'WPA3-OWE' },
  { label: 'Remoto RADIUS',   value: 'Remoto RADIUS' },
  { label: 'A bordo RADIUS',  value: 'A bordo RADIUS' },
  { label: 'Abierta',         value: 'Abierta' },
]

// ── Mapa de ubicación (solo servicio de internet) ─────────────────────────────
const editandoUbicacion = ref(false)
const ubicacionMapEl = ref(null)
let ubicacionMap = null
let ubicacionMarker = null
let ubicacionMapRO = null

const ubicacionLabel = computed(() => {
  if (form.ubicacion_lat == null || form.ubicacion_lng == null) return 'Sin definir'
  return `${form.ubicacion_lat},${form.ubicacion_lng}`
})

async function initUbicacionMap() {
  if (!ubicacionMapEl.value || ubicacionMap) return
  const { default: maplibregl } = await import('maplibre-gl')
  await import('maplibre-gl/dist/maplibre-gl.css')
  if (!ubicacionMapEl.value || ubicacionMap) return   // pudo cerrarse el diálogo mientras cargaba

  const centro = (form.ubicacion_lat != null && form.ubicacion_lng != null)
    ? [form.ubicacion_lng, form.ubicacion_lat]
    : [-74.297, 4.571]   // centro de Colombia por defecto

  ubicacionMap = new maplibregl.Map({
    container: ubicacionMapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: centro,
    zoom: (form.ubicacion_lat != null && form.ubicacion_lng != null) ? 12 : 5,
    attributionControl: false,
  })

  if (form.ubicacion_lat != null && form.ubicacion_lng != null) {
    ubicacionMarker = new maplibregl.Marker({ color: 'var(--chart-2)' })
      .setLngLat([form.ubicacion_lng, form.ubicacion_lat])
      .addTo(ubicacionMap)
  }

  ubicacionMap.on('click', (e) => {
    if (!editandoUbicacion.value) return
    const { lng, lat } = e.lngLat
    form.ubicacion_lat = Number(lat.toFixed(6))
    form.ubicacion_lng = Number(lng.toFixed(6))
    if (ubicacionMarker) {
      ubicacionMarker.setLngLat([lng, lat])
    } else {
      ubicacionMarker = new maplibregl.Marker({ color: 'var(--chart-2)' }).setLngLat([lng, lat]).addTo(ubicacionMap)
    }
  })

  ubicacionMapRO = new ResizeObserver(() => ubicacionMap?.resize())
  ubicacionMapRO.observe(ubicacionMapEl.value)
}

watch(step, async (s) => {
  if (s === 0 && props.tipo === 'internet') {
    await nextTick()
    await initUbicacionMap()
  }
})

onBeforeUnmount(() => {
  ubicacionMapRO?.disconnect()
  ubicacionMap?.remove()
  ubicacionMap = null
})

/**
 * Las partes que quedaron sin cliente vinculado.
 *
 * Guardar con un nombre suelto deja un contrato que nombra a alguien que el
 * sistema no reconoce: no aparece en el panel del cliente, y los cálculos por
 * cliente lo dejan por fuera. Por eso bloquea, en vez de avisar.
 *
 * Internet no tiene paso de partes.
 */
/** Representación/CGM sin ninguna casilla marcada: no se puede crear. */
const sinServicio = computed(() =>
  props.tipo === 'representacion' && !form.cubre_representacion && !form.cubre_cgm)

/** La lista `servicios` del contrato; solo la manda representación/CGM. */
function serviciosElegidos() {
  if (props.tipo !== 'representacion') return undefined
  return [
    ...(form.cubre_representacion ? ['representacion'] : []),
    ...(form.cubre_cgm ? ['cgm'] : []),
  ]
}

const partesPendientes = computed(() => {
  if (props.tipo === 'internet') return []
  const faltan = []
  if (!form.contratante_id) faltan.push('el contratante')
  if (!form.prestador_id) faltan.push('el prestador')
  if (props.tipo === 'representacion' && !form.inversionista_id) {
    faltan.push('el inversionista')
  }
  return faltan
})

const avisoPartes = computed(() =>
  partesPendientes.value.length
    ? `Falta vincular ${partesPendientes.value.join(' y ')} a un cliente registrado.`
    : undefined,
)

function formatFecha(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// ── Arrendadores (solo tipo === 'arriendo') ──────────────────────────────────
const contratoIdCreado = ref(null)
const arrendadores = ref([])
const arrendadorDialog = reactive({
  visible: false,
  modo: 'crear',
  editId: null,
  guardando: false,
  form: {
    nombre: '', cliente_id: null, valor_base: null, responsable_iva: false,
    activo: true, anticipo_pagado_desde: null, anticipo_pagado_hasta: null,
    observaciones: '',
  },
})

async function cargarArrendadoresWizard() {
  if (!contratoIdCreado.value) { arrendadores.value = []; return }
  try {
    arrendadores.value = await contratosServicioService.listarArrendadores(contratoIdCreado.value)
  } catch {
    arrendadores.value = []
  }
}

function openArrendadorDialog(modo, arrendador = null) {
  arrendadorDialog.modo = modo
  arrendadorDialog.editId = arrendador?.id ?? null
  arrendadorDialog.form.nombre = arrendador?.nombre || ''
  arrendadorDialog.form.cliente_id = arrendador?.cliente_id ?? null
  arrendadorDialog.form.valor_base = arrendador?.valor_base ?? null
  arrendadorDialog.form.responsable_iva = arrendador?.responsable_iva ?? false
  arrendadorDialog.form.activo = arrendador?.activo ?? true
  arrendadorDialog.form.anticipo_pagado_desde = arrendador?.anticipo_pagado_desde ? new Date(arrendador.anticipo_pagado_desde) : null
  arrendadorDialog.form.anticipo_pagado_hasta = arrendador?.anticipo_pagado_hasta ? new Date(arrendador.anticipo_pagado_hasta) : null
  arrendadorDialog.form.observaciones = arrendador?.observaciones || ''
  arrendadorDialog.visible = true
}

async function guardarArrendadorWizard() {
  if (!contratoIdCreado.value) return
  // El arrendador factura: sin cliente vinculado no hay NIT con que emitir la
  // factura, y el nombre suelto no basta.
  if (!arrendadorDialog.form.cliente_id) {
    toast.error('Vincula el arrendador a un cliente registrado', { duration: 3500 })
    return
  }
  arrendadorDialog.guardando = true
  try {
    const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : (d || null)
    const payload = {
      nombre: arrendadorDialog.form.nombre.trim(),
      cliente_id: arrendadorDialog.form.cliente_id,
      valor_base: arrendadorDialog.form.valor_base,
      responsable_iva: arrendadorDialog.form.responsable_iva ?? false,
      activo: arrendadorDialog.form.activo ?? true,
      anticipo_pagado_desde: toISO(arrendadorDialog.form.anticipo_pagado_desde),
      anticipo_pagado_hasta: toISO(arrendadorDialog.form.anticipo_pagado_hasta),
      observaciones: arrendadorDialog.form.observaciones?.trim() || null,
    }
    if (arrendadorDialog.modo === 'editar' && arrendadorDialog.editId) {
      await contratosServicioService.actualizarArrendador(arrendadorDialog.editId, payload)
    } else {
      await contratosServicioService.crearArrendador(contratoIdCreado.value, payload)
    }
    arrendadorDialog.visible = false
    await cargarArrendadoresWizard()
    toast.success('Arrendador guardado', { duration: 2500 })
  } catch (e) {
    toast.error('Error al guardar arrendador', { description: e.data?.detail, duration: 3500 })
  } finally {
    arrendadorDialog.guardando = false
  }
}

async function eliminarArrendadorWizard(arrendador) {
  if (!confirm(`¿Eliminar al arrendador "${arrendador.nombre}"?`)) return
  try {
    await contratosServicioService.eliminarArrendador(arrendador.id)
    await cargarArrendadoresWizard()
  } catch (e) {
    toast.error('Error al eliminar', { description: e.data?.detail, duration: 3500 })
  }
}

async function crearContrato() {
  const payload = {
      servicio_aplica: props.tipo,
      proyecto_id: form.proyecto_id ?? null,
      numero_contrato: form.numero_contrato?.trim() || null,
      estado: form.estado ?? 'firmado',
      // Las partes viajan solo como cliente: nombre y NIT son los de su ficha.
      contratante_id: form.contratante_id ?? null,
      prestador_id: form.prestador_id ?? null,
      inversionista_id: form.inversionista_id ?? null,
      inversionista_nombre: form.inversionista_nombre || null,
      fecha_firma_contrato: formatFecha(form.fecha_firma_contrato),
      enlace_drive: form.enlace_drive?.trim() || null,
      estado_pago: form.estado_pago ?? null,
      fecha_inicio: formatFecha(form.fecha_inicio),
      fecha_fin: formatFecha(form.fecha_fin),
      tarifa_base: form.tarifa_base ?? null,
      // En este grupo `servicio_aplica` es siempre 'representacion' (nombra al
      // grupo); lo que cubre el contrato lo dice `servicios`.
      servicios: serviciosElegidos(),
      tarifa_representacion: form.cubre_representacion ? (form.tarifa_representacion ?? null) : null,
      tarifa_cgm: form.cubre_cgm ? (form.tarifa_cgm ?? null) : null,
      periodicidad_pago: form.periodicidad_pago ?? null,
      indice_indexacion: form.indice_indexacion?.trim() || null,
      service_scope: form.service_scope?.trim() || null,
      specific_service_terms: form.specific_service_terms?.trim() || null,
      slas: form.slas?.trim() || null,
      responsibilities: form.responsibilities?.trim() || null,
      plan_datos_gb: props.tipo === 'internet' ? (form.plan_datos_gb?.trim() || null) : null,
      velocidad_mbps: props.tipo === 'internet' ? (form.velocidad_mbps ?? null) : null,
      tipo_conexion: props.tipo === 'internet' ? (form.tipo_conexion || null) : null,
      linea_servicio: props.tipo === 'internet' ? (form.linea_servicio?.trim() || null) : null,
      id_router: props.tipo === 'internet' ? (form.id_router?.trim() || null) : null,
      numero_kit: props.tipo === 'internet' ? (form.numero_kit?.trim() || null) : null,
      latencia_ms: props.tipo === 'internet' ? (form.latencia_ms ?? null) : null,
      wifi_seguridad: props.tipo === 'internet' ? (form.wifi_seguridad || null) : null,
      wifi_password: props.tipo === 'internet' ? (form.wifi_password?.trim() || null) : null,
      ubicacion_lat: props.tipo === 'internet' ? (form.ubicacion_lat ?? null) : null,
      ubicacion_lng: props.tipo === 'internet' ? (form.ubicacion_lng ?? null) : null,
    }
  return contratosServicioService.crear(payload, forzarDuplicado.value)
}

/**
 * El aviso de "esta planta ya tiene un contrato vigente de este servicio".
 *
 * No bloquea: hay razones reales para dos contratos parecidos --una renovación
 * mientras el anterior sigue vigente, por ejemplo--. Lo que no puede pasar es
 * que nadie se entere, que es como MGS Naos 2 terminó con tres filas siendo un
 * solo contrato.
 */
const duplicadoContrato = ref(null)
const forzarDuplicado = ref(false)

function duplicadoDe(e) {
  const detail = e?.data?.detail ?? e?.response?.data?.detail
  return e?.status === 409 && detail?.duplicado_contrato ? detail : null
}

async function guardar() {
  guardando.value = true
  try {
    const data = await crearContrato()
    toast.success('Contrato creado', { duration: 2500 })
    emit('creado', data)
    emit('cerrar')
  } catch (e) {
    const aviso = duplicadoDe(e)
    if (aviso) {
      duplicadoContrato.value = aviso
      return
    }
    toast.error('Error', { description: e.data?.detail ?? e.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

async function crearDeTodosModos() {
  forzarDuplicado.value = true
  duplicadoContrato.value = null
  try {
    await guardar()
  } finally {
    forzarDuplicado.value = false
  }
}

async function crearYContinuarArriendo() {
  guardando.value = true
  try {
    const data = await crearContrato()
    contratoIdCreado.value = data.id
    toast.success('Contrato creado — agrega los arrendadores', { duration: 3000 })
    step.value++
  } catch (e) {
    toast.error('Error', { description: e.data?.detail ?? e.message, duration: 4000 })
  } finally {
    guardando.value = false
  }
}

function finalizarArriendo() {
  emit('creado', { id: contratoIdCreado.value })
  emit('cerrar')
}

onMounted(async () => {
  // Los clientes ya no se piden acá: cada SelectorCliente los toma del catálogo
  // compartido, que hace UNA petición para toda la pantalla.
  todosProyectos.value = await catalogoProyectos.cargar()
  if (props.proyectoIdDefault) form.proyecto_id = props.proyectoIdDefault
  if (props.tipo === 'internet') {
    await nextTick()
    await initUbicacionMap()
  }
})
</script>
