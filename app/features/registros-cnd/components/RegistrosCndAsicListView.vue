<template>
  <div class="space-y-4">
    <PageHeader title="Registros CND/ASIC" :subtitle="`${rowsMostrar.length} proyecto(s)`">
      <template #actions>
        <IconField class="flex-1 sm:flex-none">
          <InputIcon><SearchIcon class="size-[1em]" /></InputIcon>
          <InputText v-model="filtroTexto" placeholder="Buscar proyecto…" class="w-full sm:w-64" />
        </IconField>
      </template>
    </PageHeader>

    <p class="text-xs" style="color:#9b89b5;">
      Aparecen todos los proyectos de la plataforma. Abre uno para ir llenando su información;
      su seguimiento se inicia automáticamente con todos los hitos en pendiente.
    </p>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden" style="border:1px solid #e8e0f0;">
      <DataTable :value="rowsMostrar" :loading="loading" class="text-sm" rowHover
        :rows="50" paginator :rowsPerPageOptions="[25, 50, 100]"
        @row-click="irDetalle($event.data)">
        <template #empty>
          <div class="py-12 text-center text-sm" style="color:#9b89b5;">Sin proyectos.</div>
        </template>

        <Column field="nombre_comercial" header="Proyecto" sortable>
          <template #body="{ data }">
            <div class="font-medium" style="color:var(--color-unergy-deep);">{{ data.nombre_comercial }}</div>
            <div class="text-xs" style="color:#9b89b5;">
              {{ [data.codigo_cnd, data.clasificacion_regulatoria, data.tecnologia, data.operador_red].filter(Boolean).join(' · ') || '—' }}
            </div>
          </template>
        </Column>

        <Column header="Avance" style="width:200px" sortable field="avance_pct">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <div class="flex-1 rounded-full overflow-hidden" style="height:8px;background:#ECE7F2;">
                <div :style="`height:100%;width:${Math.min(100, data.avance_pct)}%;background:var(--color-unergy-purple);`"></div>
              </div>
              <span class="text-xs font-semibold" style="color:var(--color-unergy-purple-dark);width:38px;text-align:right;">{{ data.avance_pct }}%</span>
            </div>
          </template>
        </Column>

        <Column header="Siguiente paso">
          <template #body="{ data }">
            <span v-if="data.avance_pct >= 100" class="text-xs"><GBadge color="success" class="text-xs">Completo</GBadge></span>
            <span v-else-if="data.siguiente_paso" class="text-xs" style="color:var(--color-unergy-deep);">
              <span class="font-mono font-semibold" style="color:var(--color-unergy-purple);">{{ data.siguiente_paso.codigo }}</span>
              — {{ data.siguiente_paso.descripcion }}
            </span>
          </template>
        </Column>

        <Column header="" style="width:170px">
          <template #body="{ data }">
            <div class="flex gap-1 justify-end items-center">
              <GBadge v-if="!data.tiene_registro" color="default" class="text-xs">Sin iniciar</GBadge>
              <GBadge v-if="data.alertas_pendientes" color="warning" class="text-xs">⚠ {{ data.alertas_pendientes }}</GBadge>
              <GBadge v-if="data.bloqueos" color="destructive" class="text-xs">⛔ {{ data.bloqueos }}</GBadge>
              <Button text rounded size="small" @click.stop="irDetalle(data)">
                <template #icon><EyeIcon class="size-[1em]" /></template>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { RegistrosCndService } from '~/features/registros-cnd/services/registros-cnd'
import { EyeIcon, SearchIcon } from '@lucide/vue'

const registrosCndService = new RegistrosCndService()

const router = useRouter()

const loading = ref(false)
const rows = ref([])
const rowsMostrar = ref([])
const filtroTexto = ref('')

function filtrar() {
  const q = filtroTexto.value.trim().toLowerCase()
  rowsMostrar.value = q
    ? rows.value.filter(r => (r.nombre_comercial || '').toLowerCase().includes(q)
        || (r.codigo_cnd || '').toLowerCase().includes(q))
    : rows.value.slice()
}
watch([rows, filtroTexto], filtrar)

async function cargar() {
  loading.value = true
  try {
    rows.value = await registrosCndService.listar()
  } catch (e) {
    toast.error('Error al cargar', { description: e.data?.detail ?? '', duration: 5000 })
  } finally {
    loading.value = false
  }
}

function irDetalle(row) {
  router.push(`/registros-cnd-asic/${row.proyecto_id}`)
}

onMounted(cargar)
</script>
