<script setup lang="ts">
import type {
  DuplicadoOperadorRed,
  OperadorRed,
  PayloadOperadorRed,
} from '~/features/operadores-red/types'
import { EyeIcon, PencilIcon, PlusIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de
// `DataTable` y `typecheck` falla (ver `AdminUsuariosView.vue`).
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from '~/components/blocks/DataTable.vue'
import { isFetchError, normalizeError } from '~/core/errors'
import { OperadoresRedService } from '~/features/operadores-red/services/operadores-red'

const columns: DataTableColumn[] = [
  { key: 'nombre_comercial', header: 'Nombre comercial', sortable: true },
  { key: 'nombre_legal', header: 'Nombre legal', sortable: true },
  { key: 'correos', header: 'Correos' },
  { key: 'fronteras', header: 'Fronteras vinculadas' },
  { key: 'acciones', header: '' },
]

const operadoresRedService = new OperadoresRedService()
const confirm = useConfirm()
const router = useRouter()

const query = useQuery<OperadorRed[]>()

async function loadData() {
  await query.run(() => operadoresRedService.listar())
}
onMounted(loadData)

const showForm = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

function blankForm() {
  return { nombre_legal: '', nombre_comercial: '', contacto_email: '', contacto_nombre: '' }
}
const form = reactive(blankForm())

function abrirCrear() {
  editingId.value = null
  Object.assign(form, blankForm())
  showForm.value = true
}

function abrirEditar(op: OperadorRed) {
  editingId.value = op.id
  Object.assign(form, blankForm(), {
    nombre_legal: op.nombre_legal,
    nombre_comercial: op.nombre_comercial || '',
  })
  showForm.value = true
}

// Si se diligenció un correo de contacto al crear, lo agrega tras crear el
// operador — no bloquea la creación si este paso falla, solo avisa aparte.
async function crearContactoSiAplica(operadorId: number) {
  const email = form.contacto_email.trim()
  if (!email) return
  try {
    await operadoresRedService.crearContacto(operadorId, {
      email,
      nombre: form.contacto_nombre.trim() || null,
    })
  } catch (err) {
    toast.warning('Operador creado, pero el contacto no se pudo agregar', {
      description: normalizeError(err).message,
    })
  }
}

async function guardar(body: PayloadOperadorRed, forzar = false) {
  saving.value = true
  try {
    if (editingId.value) {
      await operadoresRedService.actualizar(editingId.value, body)
      toast.success('Operador actualizado')
    } else {
      const nuevo = await operadoresRedService.crear(body, forzar)
      await crearContactoSiAplica(nuevo.id)
      toast.success('Operador creado')
    }
    showForm.value = false
    await loadData()
  } catch (err) {
    // Aviso de nombre parecido (409 estructurado): se puede confirmar y crear
    // igual. Distinto de un choque real de nombre_legal exacto.
    if (
      isFetchError<{ detail?: DuplicadoOperadorRed }>(err) &&
      err.status === 409 &&
      err.data?.detail?.duplicado_nombre
    ) {
      const { candidato_id, candidato_nombre } = err.data.detail
      confirm({
        title: 'Operador parecido ya existe',
        description: `Ya existe un operador con un nombre muy parecido: "${candidato_nombre}" (ID ${candidato_id}). Si de verdad es un operador distinto, puedes crearlo igual.`,
        confirmLabel: 'Crear de todos modos',
        onConfirm: () => guardar(body, true),
      })
      return
    }
    toast.error('Error', { description: normalizeError(err).message })
  } finally {
    saving.value = false
  }
}

function onGuardar() {
  guardar({
    nombre_legal: form.nombre_legal.trim(),
    nombre_comercial: form.nombre_comercial.trim() || null,
  })
}

// `OperadorRed` no tiene índice de firma abierta (a diferencia de `Usuario`),
// así que `DataTable` — genérico a propósito — necesita este cast explícito.
function asOperador(row: DataTableRow): OperadorRed {
  return row as unknown as OperadorRed
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader
      title="Operadores de Red"
      :subtitle="`${query.data?.length ?? 0} operadores · catálogo y correos de contacto para el reporte CGM`"
    >
      <template #actions>
        <Button size="sm" @click="abrirCrear">
          <PlusIcon class="size-4" />
          Nuevo Operador
        </Button>
      </template>
    </PageHeader>

    <AsyncView :query="query">
      <template #default="{ data: operadores }">
        <DataTable :columns="columns" :rows="operadores as unknown as DataTableRow[]" row-key="id">
          <template #cell="{ row: rawRow, column }">
            <span v-if="column.key === 'nombre_comercial'" class="font-semibold">
              {{ asOperador(rawRow).nombre_comercial || '—' }}
            </span>
            <span v-else-if="column.key === 'nombre_legal'" class="text-muted-foreground">
              {{ asOperador(rawRow).nombre_legal }}
            </span>
            <span v-else-if="column.key === 'correos'" class="text-muted-foreground">
              <template v-if="asOperador(rawRow).contactos.length">
                {{ asOperador(rawRow).contactos.length }} correo{{
                  asOperador(rawRow).contactos.length > 1 ? 's' : ''
                }}
              </template>
              <span v-else class="text-xs italic">Sin correos</span>
            </span>
            <GBadge v-else-if="column.key === 'fronteras'">{{
              asOperador(rawRow).fronteras_vinculadas
            }}</GBadge>
            <div v-else-if="column.key === 'acciones'" class="flex items-center gap-1">
              <GTooltip>
                <GTooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    @click.stop="abrirEditar(asOperador(rawRow))"
                  >
                    <PencilIcon class="size-4" />
                  </Button>
                </GTooltipTrigger>
                <GTooltipContent>Editar nombre</GTooltipContent>
              </GTooltip>
              <GTooltip>
                <GTooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    @click.stop="router.push(`/mem/operadores-red/${asOperador(rawRow).id}`)"
                  >
                    <EyeIcon class="size-4" />
                  </Button>
                </GTooltipTrigger>
                <GTooltipContent>Ver detalle</GTooltipContent>
              </GTooltip>
            </div>
          </template>
        </DataTable>
      </template>
    </AsyncView>

    <!-- Crear / Editar -->
    <Dialog v-model:open="showForm">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{
            editingId ? 'Editar Operador de Red' : 'Nuevo Operador de Red'
          }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <GLabel required>Nombre legal</GLabel>
            <Input
              v-model="form.nombre_legal"
              placeholder="Ej: Electrificadora del Caribe S.A. E.S.P."
            />
          </div>
          <div class="space-y-1.5">
            <GLabel>Nombre comercial</GLabel>
            <Input v-model="form.nombre_comercial" placeholder="Ej: Afinia" />
          </div>
          <template v-if="!editingId">
            <div class="space-y-1.5">
              <GLabel>Correo de contacto (opcional)</GLabel>
              <Input v-model="form.contacto_email" placeholder="Ej: reportes@afinia.com.co" />
            </div>
            <div class="space-y-1.5">
              <GLabel>Nombre del contacto (opcional)</GLabel>
              <Input v-model="form.contacto_nombre" placeholder="Ej: María Pérez" />
            </div>
          </template>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="showForm = false">Cancelar</Button>
          <Button :disabled="!form.nombre_legal.trim() || saving" @click="onGuardar">
            {{ editingId ? 'Guardar' : 'Crear' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
