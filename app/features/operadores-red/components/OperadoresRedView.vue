<template>
  <div class="space-y-4">
    <PageHeader title="Operadores de Red" :subtitle="`${operadores.length} operadores · catálogo y correos de contacto para el reporte CGM`">
      <template #actions>
        <Button label="Nuevo Operador" size="small" @click="abrirCrear">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoaderCircleIcon class="text-3xl size-[1em] animate-spin" style="color: var(--color-unergy-purple);" />
    </div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden" style="border: 1px solid #e8e0f0;">
      <DataTable :value="operadores" rowHover class="text-sm">
        <Column field="nombre_comercial" header="Nombre comercial" sortable>
          <template #body="{ data }">
            <span style="color: var(--color-unergy-deep); font-weight: 600;">{{ data.nombre_comercial || '—' }}</span>
          </template>
        </Column>
        <Column field="nombre_legal" header="Nombre legal" sortable>
          <template #body="{ data }">
            <span style="color: #6b5a8a;">{{ data.nombre_legal }}</span>
          </template>
        </Column>
        <Column header="Correos">
          <template #body="{ data }">
            <span v-if="data.contactos.length" style="color: #6b5a8a;">
              {{ data.contactos.length }} correo{{ data.contactos.length > 1 ? 's' : '' }}
            </span>
            <span v-else class="text-xs italic" style="color: #c4b8d4;">Sin correos</span>
          </template>
        </Column>
        <Column header="Fronteras vinculadas">
          <template #body="{ data }">
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
              style="background: rgba(145,91,216,0.1); color: var(--color-unergy-purple-dark);">
              {{ data.fronteras_vinculadas }}
            </span>
          </template>
        </Column>
        <Column header="" style="width: 100px">
          <template #body="{ data }">
            <Button text rounded size="small" v-tooltip.top="'Editar nombre'" @click="abrirEditar(data)">
              <template #icon><PencilIcon class="size-[1em]" /></template>
            </Button>
            <Button text rounded size="small" v-tooltip.top="'Ver detalle'" @click="$router.push(`/mem/operadores-red/${data.id}`)">
              <template #icon><EyeIcon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Crear / Editar -->
    <Dialog v-model:visible="showForm" :header="editingId ? 'Editar Operador de Red' : 'Nuevo Operador de Red'"
      modal class="w-full max-w-sm">
      <div class="space-y-4 pt-2">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Nombre legal *</label>
          <InputText v-model="form.nombre_legal" class="w-full" placeholder="Ej: Electrificadora del Caribe S.A. E.S.P." />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Nombre comercial</label>
          <InputText v-model="form.nombre_comercial" class="w-full" placeholder="Ej: Afinia" />
        </div>
        <template v-if="!editingId">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Correo de contacto (opcional)</label>
            <InputText v-model="form.contacto_email" class="w-full" placeholder="Ej: reportes@afinia.com.co" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Nombre del contacto (opcional)</label>
            <InputText v-model="form.contacto_nombre" class="w-full" placeholder="Ej: María Pérez" />
          </div>
        </template>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="showForm = false" />
        <Button :label="editingId ? 'Guardar' : 'Crear'" :loading="saving"
          :disabled="!form.nombre_legal?.trim()" @click="guardar" />
      </template>
    </Dialog>

    <!-- Dialog: nombre parecido a un operador existente -->
    <Dialog v-model:visible="duplicadoVisible" header="Operador parecido ya existe" modal class="w-full max-w-sm">
      <p class="text-sm mb-4" style="color: #6b5a8a;">
        Ya existe un operador con un nombre muy parecido:
        <strong>{{ duplicadoInfo?.candidato_nombre }}</strong>
        (ID {{ duplicadoInfo?.candidato_id }}).
        Si de verdad es un operador distinto, puedes crearlo igual.
      </p>
      <div class="flex justify-end gap-2">
        <Button label="Cancelar" severity="secondary" text @click="duplicadoVisible = false" />
        <Button label="Crear de todos modos" :loading="forzando" @click="guardarForzado" />
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'
import { EyeIcon, LoaderCircleIcon, PencilIcon, PlusIcon } from '@lucide/vue'

const operadoresRedService = new OperadoresRedService()

const operadores = ref([])
const loading = ref(true)

async function loadData() {
  loading.value = true
  try {
    operadores.value = await operadoresRedService.listar()
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const saving = ref(false)
const editingId = ref(null)
function blankForm() {
  return { nombre_legal: '', nombre_comercial: '', contacto_email: '', contacto_nombre: '' }
}
const form = ref(blankForm())

// Aviso de nombre parecido (409 estructurado, igual que en Fronteras/Proyectos):
// se puede confirmar y crear igual con forzar=true.
const duplicadoVisible = ref(false)
const duplicadoInfo = ref(null)   // { mensaje, candidato_id, candidato_nombre }
const forzando = ref(false)
const pendingBody = ref(null)

function abrirCrear() {
  editingId.value = null
  form.value = blankForm()
  showForm.value = true
}

function abrirEditar(op) {
  editingId.value = op.id
  form.value = { ...blankForm(), nombre_legal: op.nombre_legal, nombre_comercial: op.nombre_comercial || '' }
  showForm.value = true
}

// Si se diligenció un correo de contacto al crear, lo agrega tras crear el
// operador -- no bloquea la creación si este paso falla, solo avisa aparte.
async function _crearContactoSiAplica(operadorId) {
  const email = form.value.contacto_email?.trim()
  if (!email) return
  try {
    await operadoresRedService.crearContacto(operadorId, {
      email,
      nombre: form.value.contacto_nombre?.trim() || null,
    })
  } catch (e) {
    const detail = e.data?.detail
    toast.warning('Operador creado, pero el contacto no se pudo agregar', {
      description: typeof detail === 'string' ? detail : 'Revísalo desde el detalle del operador',
      duration: 5000,
    })
  }
}

async function guardar() {
  saving.value = true
  const body = {
    nombre_legal: form.value.nombre_legal.trim(),
    nombre_comercial: form.value.nombre_comercial?.trim() || null,
  }
  try {
    if (editingId.value) {
      await operadoresRedService.actualizar(editingId.value, body)
      toast.success('Operador actualizado', { duration: 2000 })
    } else {
      const nuevo = await operadoresRedService.crear(body)
      await _crearContactoSiAplica(nuevo.id)
      toast.success('Operador creado', { duration: 2000 })
    }
    showForm.value = false
    await loadData()
  } catch (e) {
    const detail = e.data?.detail
    // Aviso de nombre parecido (409 estructurado): se puede confirmar y crear
    // igual. Distinto de un choque real de nombre_legal exacto (detail es un string).
    if (e.status === 409 && detail?.duplicado_nombre) {
      duplicadoInfo.value = detail
      pendingBody.value = body
      duplicadoVisible.value = true
      return
    }
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'No se pudo guardar',
      duration: 4000,
    })
  } finally {
    saving.value = false
  }
}

async function guardarForzado() {
  forzando.value = true
  try {
    const nuevo = await operadoresRedService.crear(pendingBody.value, true)
    await _crearContactoSiAplica(nuevo.id)
    toast.success('Operador creado', { duration: 2000 })
    duplicadoVisible.value = false
    showForm.value = false
    await loadData()
  } catch (e) {
    const detail = e.data?.detail
    toast.error('Error', {
      description: typeof detail === 'string' ? detail : 'No se pudo crear',
      duration: 4000,
    })
  } finally {
    forzando.value = false
  }
}

onMounted(loadData)
</script>
