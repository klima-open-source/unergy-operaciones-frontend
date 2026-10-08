<!--
  Aviso y revisión de los proyectos que las fuentes externas proponen.

  Sun Factory, Quoia y la API de Unergy reportan plantas que acá no están, o que
  están con el estado o la fase desincronizados. **Nada se crea solo**: esto lo
  propone y una persona confirma o ignora.

  Vive en su propio componente desde el 2026-09-15, y no por prolijidad: estaba
  dentro de `ProyectosListView.vue`, la pantalla de `/proyectos` que **salió del
  menú** cuando llegó la vista unificada. La funcionalidad siguió existiendo y
  el backend siguió calculándola, pero nadie podía llegar a ella salvo
  escribiendo la URL a mano -- y eso no se noto por semanas.

  Una planta ignorada no se vuelve a proponer: el backend la recuerda en
  `proyectos_pendientes_ignorados`. Por eso el botón de ignorar no pide
  confirmación pero tampoco se deshace desde acá.
-->
<template>
  <div v-if="pendientes.length" class="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-destructive/5 border border-destructive/25">
    <span class="text-sm font-medium text-destructive">
      <TriangleAlertIcon class="mr-1.5 size-3" />
      Proyectos pendientes ({{ pendientes.length }})
    </span>
    <Button variant="ghost" size="sm" class="text-destructive" @click="abrir">Revisar</Button>
  </div>

  <Dialog v-model:open="visible">
    <DialogContent class="sm:max-w-3xl" @open-auto-focus.prevent>
    <DialogHeader>
      <DialogTitle>Proyectos pendientes</DialogTitle>
      <DialogDescription>
        Sun Factory, Quoia y la API de Unergy reportan estos proyectos. Confirma
        para crearlos o actualizar el registro existente, o ignóralos si no
        aplican.
      </DialogDescription>
    </DialogHeader>
    <div v-if="cargando" class="flex items-center justify-center py-8">
      <LoaderCircleIcon class="size-6 animate-spin text-primary" />
    </div>
    <div v-else-if="!pendientes.length" class="text-center py-8 text-sm text-muted-foreground">
      No hay proyectos pendientes por revisar.
    </div>
    <div v-else class="space-y-3 max-h-96 overflow-y-auto pr-1">
      <div v-for="p in pendientes" :key="p.clave" class="rounded-xl p-3 border">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span
                class="inline-block text-xs font-bold rounded-full px-2 py-0.5"
                :class="p.tipo_sugerencia === 'crear' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'"
              >
                {{ p.tipo_sugerencia === 'crear' ? 'Nuevo' : 'Actualizar' }}
              </span>
              <span class="text-xs text-muted-foreground">{{ p.fuentes.join(' + ') }}</span>
            </div>
            <TruncatedText :text="p.proyecto_nombre_actual || p.nombre_sugerido" class="text-sm font-semibold text-foreground" />
            <p v-if="p.tipo_sugerencia === 'actualizar' && p.proyecto_nombre_actual" class="text-xs text-muted-foreground">
              Sugerido: {{ p.nombre_sugerido }}
            </p>
          </div>
          <GTooltip>
            <GTooltipTrigger as-child>
              <Button variant="ghost" size="icon-sm" :disabled="p._loading === 'ignorar'" aria-label="Ignorar" @click="ignorar(p)">
                <Spinner v-if="p._loading === 'ignorar'" class="size-4" /><XIcon v-else class="size-4" />
              </Button>
            </GTooltipTrigger>
            <GTooltipContent>Ignorar</GTooltipContent>
          </GTooltip>
        </div>

        <!-- Cambios sugeridos -->
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3 text-muted-foreground">
          <span v-if="p.estado_sugerido && p.estado_sugerido !== p.estado_actual">
            Estado: <b>{{ p.estado_actual ? `${ESTADO_LABELS[p.estado_actual] || p.estado_actual} → ` : '' }}{{ ESTADO_LABELS[p.estado_sugerido] || p.estado_sugerido }}</b>
          </span>
          <span v-if="p.fase_construccion_sugerida && p.fase_construccion_sugerida !== p.fase_construccion_actual">
            Fase: <b>{{ p.fase_construccion_sugerida }}</b>
          </span>
          <span v-if="p.potencia_ac_kw">Potencia AC: <b>{{ p.potencia_ac_kw.toFixed(1) }} kW</b></span>
          <span v-if="p.capacidad_instalada_kwp">Capacidad instalada: <b>{{ p.capacidad_instalada_kwp.toFixed(1) }} kWp</b></span>
          <span v-if="p.municipio">{{ p.municipio }}<span v-if="p.departamento">, {{ p.departamento }}</span></span>
        </div>

        <!-- Overrides editables (solo aplican al crear) -->
        <div v-if="p.tipo_sugerencia === 'crear'" class="flex flex-wrap gap-2 items-end">
          <div>
            <label class="block text-xs font-semibold text-muted-foreground mb-1">Nombre comercial</label>
            <Input v-model="p._nombre" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-muted-foreground mb-1">Tipo</label>
            <Select :model-value="aValorSelect(p._tipo)" @update:model-value="p._tipo = deValorSelect($event) || null">
              <SelectTrigger class="min-w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in TIPOS_PROYECTO" :key="t" :value="t">{{ t }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" :disabled="p._loading === 'confirmar' || !p._nombre" @click="confirmar(p)">
            <Spinner v-if="p._loading === 'confirmar'" class="size-4" /><CheckIcon v-else class="size-4" /> Crear
          </Button>
        </div>
        <div v-else class="flex justify-end">
          <Button size="sm" :disabled="p._loading === 'confirmar'" @click="confirmar(p)">
            <Spinner v-if="p._loading === 'confirmar'" class="size-4" /><CheckIcon v-else class="size-4" /> Actualizar
          </Button>
        </div>
      </div>
    </div>
    </DialogContent>
  </Dialog>

  <!-- El mismo aviso de "nombre parecido" que el alta manual: evita que dos
       candidatos distintos (p. ej. un duplicado de Sun Factory) creen el mismo
       proyecto dos veces sin que nadie se entere. -->
  <Dialog v-model:open="duplicadoVisible">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Proyecto parecido ya existe</DialogTitle>
        <DialogDescription>
          {{ duplicadoInfo?.mensaje }}
          <strong>{{ duplicadoInfo?.candidato_nombre }}</strong>
          (ID {{ duplicadoInfo?.candidato_id }}).
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="duplicadoVisible = false">Cancelar</Button>
        <Button :disabled="forzando" @click="duplicadoConfirmAction && duplicadoConfirmAction()">
          <Spinner v-if="forzando" class="size-4" /> Crear de todos modos
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { aValorSelect, deValorSelect } from '~/utils/select'
import { toast } from 'vue-sonner'
import { ProyectosService } from '~/features/proyectos/services/proyectos'
import { CheckIcon, LoaderCircleIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'

/** Que la lista de la pantalla se refresque cuando algo se crea o actualiza. */
const emit = defineEmits(['cambio'])

const proyectosService = new ProyectosService()

const TIPOS_PROYECTO = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica']
const ESTADO_LABELS = {
  en_operacion: 'En operación',
  en_desarrollo: 'En desarrollo',
  suspendido: 'Suspendido',
  cancelado: 'Cancelado',
  en_construccion: 'En construcción',
}

const pendientes = ref([])
const cargando = ref(false)
const visible = ref(false)

const duplicadoVisible = ref(false)
const duplicadoInfo = ref(null) // { mensaje, candidato_id, candidato_nombre }
const duplicadoConfirmAction = ref(null)
const forzando = ref(false)

async function cargar() {
  try {
    const data = await proyectosService.listarPendientes()
    pendientes.value = data.map((p) => ({
      ...p,
      _nombre: p.nombre_sugerido,
      _tipo: p.tipo_proyecto_sugerido || null,
      _loading: null,
    }))
  } catch {
    // Alguna fuente sin configurar u otro error: el aviso no aparece y la
    // pantalla sigue funcionando. No es bloqueante.
    pendientes.value = []
  }
}

function abrir() {
  visible.value = true
  cargando.value = true
  cargar().finally(() => {
    cargando.value = false
  })
}

async function confirmar(p, forzar = false) {
  p._loading = 'confirmar'
  try {
    await proyectosService.confirmarPendiente(
      p.clave,
      {
        nombre_comercial: p.tipo_sugerencia === 'crear' ? p._nombre : undefined,
        tipo_proyecto: p.tipo_sugerencia === 'crear' ? p._tipo : undefined,
      },
      forzar,
    )
    pendientes.value = pendientes.value.filter((x) => x.clave !== p.clave)
    duplicadoVisible.value = false
    toast.success(p.tipo_sugerencia === 'crear' ? 'Proyecto creado' : 'Proyecto actualizado', {
      duration: 3000,
    })
    emit('cambio')
  } catch (e) {
    const detail = e.data?.detail
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      duplicadoConfirmAction.value = async () => {
        forzando.value = true
        try {
          await confirmar(p, true)
        } finally {
          forzando.value = false
        }
      }
      duplicadoVisible.value = true
      return
    }
    toast.error('No se pudo confirmar', {
      description: typeof detail === 'string' ? detail : detail?.mensaje || e.message,
      duration: 5000,
    })
  } finally {
    p._loading = null
  }
}

function ignorar(p) {
  p._loading = 'ignorar'
  proyectosService
    .ignorarPendiente(p.clave)
    .then(() => {
      pendientes.value = pendientes.value.filter((x) => x.clave !== p.clave)
    })
    .catch((e) => {
      toast.error('No se pudo ignorar', {
        description: e.data?.detail || e.message,
        duration: 5000,
      })
    })
    .finally(() => {
      p._loading = null
    })
}

onMounted(cargar)
</script>
