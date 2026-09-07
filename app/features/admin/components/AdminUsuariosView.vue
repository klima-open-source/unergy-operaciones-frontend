<template>
  <div class="space-y-4">
    <PageHeader title="Gestión de Usuarios">
      <template #actions>
        <Button label="Nuevo usuario" size="small" @click="openNew">
          <template #icon><PlusIcon class="size-[1em]" /></template>
        </Button>
      </template>
    </PageHeader>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b border-gray-100">
        <IconField>
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="q" placeholder="Buscar por nombre o correo..." class="w-72" @input="onSearch" />
        </IconField>
      </div>

      <DataTable :value="filtered" :loading="loading" :rows="20" paginator rowHover class="text-sm"
        :globalFilterFields="['nombre', 'email']">
        <Column field="nombre" header="Nombre" sortable />
        <Column field="email" header="Correo" sortable />
        <Column field="rol" header="Rol" sortable style="width: 140px">
          <template #body="{ data }">
            <GBadge :color="ROL_SEVERITY[data.rol] || 'default'">{{ ROL_LABELS[data.rol] || data.rol }}</GBadge>
          </template>
        </Column>
        <Column field="activo" header="Estado" style="width: 100px">
          <template #body="{ data }">
            <GBadge :color="data.activo ? 'success' : 'destructive'">{{ data.activo ? 'Activo' : 'Inactivo' }}</GBadge>
          </template>
        </Column>
        <Column header="Acciones" style="width: 140px">
          <template #body="{ data }">
            <Button text rounded size="small" v-tooltip.top="'API Keys'" @click="openApiKeys(data)">
              <template #icon><KeyIcon class="size-[1em]" /></template>
            </Button>
            <Button text rounded size="small" v-tooltip.top="'Editar'" @click="openEdit(data)">
              <template #icon><PencilIcon class="size-[1em]" /></template>
            </Button>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialogVisible" :header="editingId ? 'Editar usuario' : 'Nuevo usuario'"
      modal class="w-full max-w-lg">
      <UsuarioForm :initial="form" @save="onSave" @cancel="dialogVisible = false" />
    </Dialog>

    <ApiKeysDialog v-model:visible="apiKeysVisible" :usuario="apiKeysUser" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { toast } from 'vue-sonner'
import { UsuariosService } from '~/features/admin/services/usuarios'
import UsuarioForm from './UsuarioForm.vue'
import ApiKeysDialog from './ApiKeysDialog.vue'
import { KeyIcon, PencilIcon, PlusIcon, SearchIcon } from '@lucide/vue'

const usuariosService = new UsuariosService()

const items = ref([])
const loading = ref(false)
const q = ref('')
const dialogVisible = ref(false)
const editingId = ref(null)
const form = ref({})
const apiKeysVisible = ref(false)
const apiKeysUser = ref(null)

const ROL_LABELS = {
  admin: 'Admin',
  operaciones: 'Operaciones',
  monitoreo: 'Monitoreo',
  liquidaciones: 'Liquidaciones',
  cgm: 'CGM',
  solo_lectura: 'Solo lectura',
  comercial: 'Comercial',
}

const ROL_SEVERITY = {
  admin: 'destructive',
  operaciones: 'information',
  monitoreo: 'warning',
  liquidaciones: 'success',
  cgm: 'default',
  solo_lectura: 'default',
  comercial: 'information',
}

const filtered = computed(() => {
  if (!q.value) return items.value
  const term = q.value.toLowerCase()
  return items.value.filter(u =>
    u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
  )
})

async function load() {
  loading.value = true
  try {
    items.value = await usuariosService.listar()
  } finally {
    loading.value = false
  }
}

onMounted(load)

let searchTimer
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {}, 350)
}

function openNew() {
  editingId.value = null
  form.value = {}
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

function openApiKeys(row) {
  apiKeysUser.value = row
  apiKeysVisible.value = true
}

async function onSave(payload) {
  try {
    if (editingId.value) {
      await usuariosService.actualizar(editingId.value, payload)
      toast.success('Usuario actualizado', { duration: 3000 })
    } else {
      await usuariosService.crear(payload)
      toast.success('Usuario creado', { duration: 3000 })
    }
    dialogVisible.value = false
    load()
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'Error al guardar', duration: 4000 })
  }
}
</script>
