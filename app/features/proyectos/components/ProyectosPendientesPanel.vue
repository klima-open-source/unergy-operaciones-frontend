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
  <div v-if="pendientes.length" class="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
       style="background: rgba(214,68,85,0.06); border: 1.5px solid rgba(214,68,85,0.25);">
    <span class="text-sm font-medium" style="color: #D64455;">
      <TriangleAlertIcon class="text-xs mr-1.5 size-[1em]" />
      Proyectos pendientes ({{ pendientes.length }})
    </span>
    <Button label="Revisar" size="small" text style="color: #D64455;" @click="abrir" />
  </div>

  <Dialog v-model:visible="visible" header="Proyectos pendientes" modal class="w-full max-w-3xl">
    <p class="text-sm mb-4" style="color: #6b5a8a;">
      Sun Factory, Quoia y la API de Unergy reportan estos proyectos. Confirma
      para crearlos o actualizar el registro existente, o ignóralos si no
      aplican.
    </p>
    <div v-if="cargando" class="flex items-center justify-center py-8">
      <LoaderCircleIcon class="text-2xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>
    <div v-else-if="!pendientes.length" class="text-center py-8 text-sm" style="color: #9b89b5;">
      No hay proyectos pendientes por revisar.
    </div>
    <div v-else class="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
      <div v-for="p in pendientes" :key="p.clave" class="rounded-xl p-3" style="border: 1.5px solid #e8e0f0;">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="chip" :class="p.tipo_sugerencia === 'crear' ? 'chip-new' : 'chip-update'">
                {{ p.tipo_sugerencia === 'crear' ? 'Nuevo' : 'Actualizar' }}
              </span>
              <span class="text-xs" style="color:#9b89b5;">{{ p.fuentes.join(' + ') }}</span>
            </div>
            <p class="text-sm font-semibold truncate" style="color:var(--color-unergy-deep);">
              {{ p.proyecto_nombre_actual || p.nombre_sugerido }}
            </p>
            <p v-if="p.tipo_sugerencia === 'actualizar' && p.proyecto_nombre_actual" class="text-xs" style="color:#9b89b5;">
              Sugerido: {{ p.nombre_sugerido }}
            </p>
          </div>
          <Button text severity="secondary" size="small" :loading="p._loading === 'ignorar'"
                  v-tooltip="'Ignorar'" @click="ignorar(p)">
            <template #icon><XIcon class="size-[1em]" /></template>
          </Button>
        </div>

        <!-- Cambios sugeridos -->
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style="color:#6b5a8a;">
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
            <label class="field-label">Nombre comercial</label>
            <InputText v-model="p._nombre" class="w-56" />
          </div>
          <div>
            <label class="field-label">Tipo</label>
            <Select v-model="p._tipo" :options="TIPOS_PROYECTO" class="w-40" placeholder="Tipo" />
          </div>
          <Button label="Crear" size="small" :loading="p._loading === 'confirmar'" :disabled="!p._nombre"
                  style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);"
                  @click="confirmar(p)">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
        <div v-else class="flex justify-end">
          <Button label="Actualizar" size="small" :loading="p._loading === 'confirmar'"
                  style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);"
                  @click="confirmar(p)">
            <template #icon><CheckIcon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
    </div>
  </Dialog>

  <!-- El mismo aviso de "nombre parecido" que el alta manual: evita que dos
       candidatos distintos (p. ej. un duplicado de Sun Factory) creen el mismo
       proyecto dos veces sin que nadie se entere. -->
  <Dialog v-model:visible="duplicadoVisible" header="Proyecto parecido ya existe" modal class="w-full max-w-sm">
    <p class="text-sm mb-4" style="color:#6b5a8a;">
      {{ duplicadoInfo?.mensaje }}
      <strong>{{ duplicadoInfo?.candidato_nombre }}</strong>
      (ID {{ duplicadoInfo?.candidato_id }}).
    </p>
    <div class="flex justify-end gap-2">
      <Button label="Cancelar" severity="secondary" @click="duplicadoVisible = false" />
      <Button label="Crear de todos modos" :loading="forzando"
              style="background:var(--color-unergy-purple); border-color:var(--color-unergy-purple);"
              @click="duplicadoConfirmAction && duplicadoConfirmAction()" />
    </div>
  </Dialog>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
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

<style scoped>
/* MIGRACION -- Fase 1: en Tailwind 4 cada bloque <style> se procesa aislado y
   no ve el tema, asi que `@apply` falla con "unknown utility class".
   `@reference` se lo trae. Mismo criterio que el resto de las vistas. */
@reference 'tailwindcss';

.chip {
  @apply inline-block text-[10px] font-bold rounded-full px-2 py-0.5;
}
.chip-new {
  background: rgba(145, 91, 216, 0.12);
  color: var(--color-unergy-purple);
}
.chip-update {
  background: rgba(214, 68, 85, 0.12);
  color: #d64455;
}
.field-label {
  @apply block text-xs font-semibold mb-1;
  color: #6b5a8a;
}
</style>
