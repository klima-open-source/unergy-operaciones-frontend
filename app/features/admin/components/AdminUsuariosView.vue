<script setup lang="ts">
import type { PayloadUsuario, Usuario } from '~/features/admin/types'
import { KeyIcon, PencilIcon, PlusIcon, SearchIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito (no el auto-import de `blocks/`): con auto-import, Nuxt
// sintetiza mal los tipos de props/slots de este componente y `typecheck`
// falla con errores que no tienen que ver con el código real.
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
  type DataTableSort,
} from '~/components/blocks/DataTable.vue'
import { normalizeError } from '~/core/errors'
import { UsuariosService } from '~/features/admin/services/usuarios'
import ApiKeysDialog from './ApiKeysDialog.vue'
import UsuarioForm from './UsuarioForm.vue'

const ROL_LABELS: Record<Usuario['rol'], string> = {
  admin: 'Admin',
  operaciones: 'Operaciones',
  monitoreo: 'Monitoreo',
  liquidaciones: 'Liquidaciones',
  cgm: 'CGM',
  solo_lectura: 'Solo lectura',
  comercial: 'Comercial',
}

const ROL_COLOR: Record<
  Usuario['rol'],
  'destructive' | 'information' | 'warning' | 'success' | 'default'
> = {
  admin: 'destructive',
  operaciones: 'information',
  monitoreo: 'warning',
  liquidaciones: 'success',
  cgm: 'default',
  solo_lectura: 'default',
  comercial: 'information',
}

const columns: DataTableColumn[] = [
  { key: 'nombre', header: 'Nombre', sortable: true },
  { key: 'email', header: 'Correo', sortable: true },
  { key: 'rol', header: 'Rol', sortable: true },
  { key: 'activo', header: 'Estado' },
  { key: 'acciones', header: 'Acciones' },
]

const usuariosService = new UsuariosService()
const usuariosQuery = useQuery<Usuario[]>()

const q = ref('')
const sort = ref<DataTableSort | null>(null)
const pagination = usePagination(20)

const dialogOpen = ref(false)
const editingUser = ref<Usuario | null>(null)
const saving = ref(false)
const apiKeysOpen = ref(false)
const apiKeysUser = ref<Usuario | null>(null)

const filtered = computed(() => {
  const usuarios = usuariosQuery.data ?? []
  if (!q.value.trim()) return usuarios
  const term = q.value.trim().toLowerCase()
  return usuarios.filter(
    (u) => u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
  )
})

const sorted = computed(() => {
  if (!sort.value) return filtered.value
  const { key, direction } = sort.value
  const factor = direction === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const left = String(a[key as keyof Usuario] ?? '')
    const right = String(b[key as keyof Usuario] ?? '')
    return left.localeCompare(right) * factor
  })
})

const pagedUsuarios = computed(() =>
  sorted.value.slice(pagination.offset.value, pagination.offset.value + pagination.pageSize.value),
)

watch(sorted, (rows) => {
  pagination.total.value = rows.length
})

watch(q, () => pagination.reset())

async function load() {
  await usuariosQuery.run(() => usuariosService.listar())
}

onMounted(load)

function openNew() {
  editingUser.value = null
  dialogOpen.value = true
}

function openEdit(usuario: Usuario) {
  editingUser.value = usuario
  dialogOpen.value = true
}

function openApiKeys(usuario: Usuario) {
  apiKeysUser.value = usuario
  apiKeysOpen.value = true
}

function asUsuario(row: DataTableRow): Usuario {
  return row as Usuario
}

async function onSave(payload: PayloadUsuario) {
  saving.value = true
  try {
    if (editingUser.value) {
      await usuariosService.actualizar(editingUser.value.id, payload)
      toast.success('Usuario actualizado')
    } else {
      await usuariosService.crear(payload)
      toast.success('Usuario creado')
    }
    dialogOpen.value = false
    await load()
  } catch (err) {
    toast.error('Error al guardar', { description: normalizeError(err).message })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader title="Gestión de Usuarios">
      <template #actions>
        <Button size="sm" @click="openNew">
          <PlusIcon class="size-4" />
          Nuevo usuario
        </Button>
      </template>
    </PageHeader>

    <AsyncView :query="usuariosQuery">
      <template #default>
        <Card>
          <CardContent class="space-y-4">
            <InputGroup class="max-w-sm">
              <InputGroupAddon>
                <SearchIcon class="size-4" />
              </InputGroupAddon>
              <InputGroupInput v-model="q" placeholder="Buscar por nombre o correo..." />
            </InputGroup>

            <DataTable
              :columns="columns"
              :rows="pagedUsuarios"
              row-key="id"
              :sort="sort"
              :page="pagination.page.value"
              :page-size="pagination.pageSize.value"
              :total="pagination.total.value"
              empty-message="No hay usuarios que coincidan con la búsqueda."
              @update:sort="sort = $event"
              @update:page="pagination.goTo($event)"
            >
              <template #cell="{ row, column }">
                <GBadge v-if="column.key === 'rol'" :color="ROL_COLOR[asUsuario(row).rol]">
                  {{ ROL_LABELS[asUsuario(row).rol] }}
                </GBadge>
                <GBadge
                  v-else-if="column.key === 'activo'"
                  :color="asUsuario(row).activo ? 'success' : 'destructive'"
                >
                  {{ asUsuario(row).activo ? 'Activo' : 'Inactivo' }}
                </GBadge>
                <div v-else-if="column.key === 'acciones'" class="flex items-center gap-1">
                  <GTooltip>
                    <GTooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        @click.stop="openApiKeys(asUsuario(row))"
                      >
                        <KeyIcon class="size-4" />
                      </Button>
                    </GTooltipTrigger>
                    <GTooltipContent>API Keys</GTooltipContent>
                  </GTooltip>
                  <GTooltip>
                    <GTooltipTrigger as-child>
                      <Button variant="ghost" size="icon-sm" @click.stop="openEdit(asUsuario(row))">
                        <PencilIcon class="size-4" />
                      </Button>
                    </GTooltipTrigger>
                    <GTooltipContent>Editar</GTooltipContent>
                  </GTooltip>
                </div>
              </template>
            </DataTable>
          </CardContent>
        </Card>
      </template>
    </AsyncView>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingUser ? 'Editar usuario' : 'Nuevo usuario' }}</DialogTitle>
        </DialogHeader>
        <UsuarioForm
          :initial="editingUser"
          :saving="saving"
          @save="onSave"
          @cancel="dialogOpen = false"
        />
      </DialogContent>
    </Dialog>

    <ApiKeysDialog v-model:open="apiKeysOpen" :usuario="apiKeysUser" />
  </div>
</template>
