<template>
  <Dialog v-model:visible="visible" header="API Keys" modal class="w-full max-w-2xl" @hide="onHide">
    <div v-if="usuario" class="space-y-4">
      <div class="bg-gray-50 rounded-lg p-3 text-sm">
        <span class="font-medium">{{ usuario.nombre }}</span>
        <span class="text-gray-500 ml-2">{{ usuario.email }}</span>
      </div>

      <!-- New key revealed (only once) -->
      <div v-if="newKey" class="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
        <div class="flex items-center gap-2 text-green-800 font-medium text-sm">
          <CircleCheckIcon class="size-[1em]" />
          API Key creada — copia ahora, no se mostrará de nuevo
        </div>
        <div class="flex items-center gap-2">
          <code class="flex-1 bg-white border rounded px-3 py-2 text-xs font-mono break-all select-all">{{ newKey }}</code>
          <Button text rounded size="small" v-tooltip.top="'Copiar'" @click="copyKey">
            <template #icon><CopyIcon class="size-[1em]" /></template>
          </Button>
        </div>
        <div class="text-xs text-gray-500 mt-2 space-y-1">
          <p><strong>Uso:</strong> Enviar en header <code class="bg-gray-100 px-1 rounded">X-API-Key: {{ newKey }}</code></p>
          <p><strong>Base URL:</strong> <code class="bg-gray-100 px-1 rounded">{{ baseUrl }}/api/v1</code></p>
        </div>
        <div class="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
          <ShieldIcon class="mt-0.5 size-[1em]" />
          <span>
            Trata esta key como una contraseña: concede el rol del usuario.
            Guárdala en un gestor de secretos, nunca en el código ni en repositorios,
            y revócala desde aquí si se expone.
          </span>
        </div>
      </div>

      <!-- Create new key form -->
      <div class="flex items-end gap-2">
        <div class="flex-1">
          <label class="block text-xs font-medium text-gray-600 mb-1">Nombre de la API Key</label>
          <InputText v-model="newKeyName" placeholder="ej: Integración Power BI" class="w-full" />
        </div>
        <Button label="Generar" :loading="creating" @click="createKey" :disabled="!newKeyName.trim()">
          <template #icon><KeyIcon class="size-[1em]" /></template>
        </Button>
      </div>

      <!-- Existing keys -->
      <div v-if="keys.length > 0" class="space-y-2">
        <h4 class="text-sm font-medium text-gray-700">Keys existentes</h4>
        <div v-for="k in keys" :key="k.id"
          class="flex items-center gap-3 bg-white border rounded-lg px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">{{ k.nombre }}</span>
              <GBadge :color="k.activo ? 'success' : 'destructive'" class="text-xs">{{ k.activo ? 'Activa' : 'Inactiva' }}</GBadge>
            </div>
            <div class="text-xs text-gray-400 mt-1">
              <code>{{ k.key_prefix }}...</code>
              <span class="mx-1">·</span>
              Creada {{ formatDate(k.created_at) }}
              <template v-if="k.ultimo_uso">
                <span class="mx-1">·</span>
                Último uso {{ formatDate(k.ultimo_uso) }}
              </template>
            </div>
          </div>
          <Button text rounded size="small"
            v-tooltip.top="k.activo ? 'Desactivar' : 'Activar'" @click="toggleKey(k)">
            <template #icon><component :is="k.activo ? PauseIcon : PlayIcon" class="size-[1em]" /></template>
          </Button>
          <Button text rounded size="small" severity="danger" v-tooltip.top="'Eliminar'" @click="confirmDelete(k)">
            <template #icon><Trash2Icon class="size-[1em]" /></template>
          </Button>
        </div>
      </div>
      <div v-else-if="!loadingKeys" class="text-center text-sm text-gray-400 py-4">
        Este usuario no tiene API Keys
      </div>

      <!-- Usage info -->
      <Divider />
      <div class="text-xs text-gray-500 space-y-2">
        <p class="font-medium text-gray-700">Ejemplo de uso:</p>
        <pre class="bg-gray-50 rounded p-3 overflow-x-auto"><code>curl -H "X-API-Key: uop_xxxx..." \
  {{ baseUrl }}/api/v1/proyectos</code></pre>
        <p>La API Key hereda el rol y permisos del usuario seleccionado. Todos los endpoints de la plataforma están disponibles.</p>
      </div>
    </div>
  </Dialog>

  <Dialog v-model:visible="deleteConfirmVisible" header="Eliminar API Key" modal class="w-full max-w-sm">
    <p class="text-sm">
      ¿Eliminar la key <strong>{{ deletingKey?.nombre }}</strong>?
      Cualquier integración que la use dejará de funcionar inmediatamente.
    </p>
    <template #footer>
      <Button label="Cancelar" severity="secondary" @click="deleteConfirmVisible = false" />
      <Button label="Eliminar" severity="danger" :loading="deleting" @click="doDelete" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Divider from 'primevue/divider'
import { toast } from 'vue-sonner'
import { ApiKeysService } from '~/features/admin/services/api-keys'
import { CircleCheckIcon, CopyIcon, KeyIcon, PauseIcon, PlayIcon, ShieldIcon, Trash2Icon } from '@lucide/vue'

const apiKeysService = new ApiKeysService()

const props = defineProps({ usuario: Object })
const visible = defineModel('visible', { type: Boolean })

const keys = ref([])
const loadingKeys = ref(false)
const creating = ref(false)
const newKeyName = ref('')
const newKey = ref(null)
const deleteConfirmVisible = ref(false)
const deletingKey = ref(null)
const deleting = ref(false)

const baseUrl = window.location.origin

watch(visible, async (v) => {
  if (v && props.usuario) {
    newKey.value = null
    newKeyName.value = ''
    await loadKeys()
  }
})

async function loadKeys() {
  loadingKeys.value = true
  try {
    keys.value = await apiKeysService.listarPorUsuario(props.usuario.id)
  } catch {
    keys.value = []
  } finally {
    loadingKeys.value = false
  }
}

async function createKey() {
  creating.value = true
  try {
    const { api_key: key } = await apiKeysService.crear(props.usuario.id, newKeyName.value.trim())
    newKey.value = key
    newKeyName.value = ''
    toast.success('API Key creada', { duration: 3000 })
    await loadKeys()
  } catch (e) {
    toast.error('Error', { description: e.data?.detail || 'Error al crear', duration: 4000 })
  } finally {
    creating.value = false
  }
}

async function toggleKey(k) {
  try {
    const actualizada = await apiKeysService.alternarActiva(k.id)
    k.activo = actualizada.activo
    toast.info(actualizada.activo ? 'Key activada' : 'Key desactivada', { duration: 2000 })
  } catch {
    toast.error('Error al cambiar estado', { duration: 3000 })
  }
}

function confirmDelete(k) {
  deletingKey.value = k
  deleteConfirmVisible.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await apiKeysService.eliminar(deletingKey.value.id)
    deleteConfirmVisible.value = false
    toast.success('Key eliminada', { duration: 3000 })
    await loadKeys()
  } catch {
    toast.error('Error al eliminar', { duration: 3000 })
  } finally {
    deleting.value = false
  }
}

function copyKey() {
  navigator.clipboard.writeText(newKey.value)
  toast.info('Copiado al portapapeles', { duration: 2000 })
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function onHide() {
  newKey.value = null
}
</script>
