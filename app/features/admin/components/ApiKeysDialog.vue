<script setup lang="ts">
import type { ApiKey, Usuario } from '~/features/admin/types'
import {
  CircleCheckIcon,
  CopyIcon,
  KeyIcon,
  PauseIcon,
  PlayIcon,
  ShieldIcon,
  Trash2Icon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { ApiKeysService } from '~/features/admin/services/api-keys'

const props = defineProps<{ usuario: Usuario | null }>()
const open = defineModel<boolean>('open', { default: false })

const apiKeysService = new ApiKeysService()
const confirm = useConfirm()
const keysQuery = useQuery<ApiKey[]>()

const creating = ref(false)
const newKeyName = ref('')
const newKey = ref<string | null>(null)

const baseUrl = window.location.origin

watch(open, async (isOpen) => {
  if (isOpen && props.usuario) {
    newKey.value = null
    newKeyName.value = ''
    await loadKeys()
  }
})

async function loadKeys() {
  if (!props.usuario) return
  const usuarioId = props.usuario.id
  await keysQuery.run(() => apiKeysService.listarPorUsuario(usuarioId))
}

async function createKey() {
  if (!props.usuario) return
  creating.value = true
  try {
    const { api_key: key } = await apiKeysService.crear(props.usuario.id, newKeyName.value.trim())
    newKey.value = key
    newKeyName.value = ''
    toast.success('API Key creada')
    await loadKeys()
  } catch (err) {
    toast.error('Error al crear', { description: normalizeError(err).message })
  } finally {
    creating.value = false
  }
}

async function toggleKey(k: ApiKey) {
  try {
    const actualizada = await apiKeysService.alternarActiva(k.id)
    k.activo = actualizada.activo
    toast.info(actualizada.activo ? 'Key activada' : 'Key desactivada')
  } catch (err) {
    toast.error('Error al cambiar estado', { description: normalizeError(err).message })
  }
}

function confirmDelete(k: ApiKey) {
  confirm({
    title: 'Eliminar API Key',
    description: `¿Eliminar la key "${k.nombre}"? Cualquier integración que la use dejará de funcionar inmediatamente.`,
    confirmLabel: 'Eliminar',
    variant: 'destructive',
    onConfirm: () => doDelete(k),
  })
}

async function doDelete(k: ApiKey) {
  try {
    await apiKeysService.eliminar(k.id)
    toast.success('Key eliminada')
    await loadKeys()
  } catch (err) {
    toast.error('Error al eliminar', { description: normalizeError(err).message })
  }
}

function copyKey() {
  if (!newKey.value) return
  navigator.clipboard.writeText(newKey.value)
  toast.info('Copiado al portapapeles')
}

function formatDate(d: string | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function onOpenChange(value: boolean) {
  open.value = value
  if (!value) newKey.value = null
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>API Keys</DialogTitle>
      </DialogHeader>

      <div v-if="usuario" class="space-y-4">
        <div class="rounded-lg bg-muted p-3 text-sm">
          <span class="font-medium">{{ usuario.nombre }}</span>
          <span class="ml-2 text-muted-foreground">{{ usuario.email }}</span>
        </div>

        <Alert v-if="newKey">
          <CircleCheckIcon />
          <AlertTitle>API Key creada — copia ahora, no se mostrará de nuevo</AlertTitle>
          <AlertDescription class="space-y-2">
            <div class="flex items-center gap-2">
              <code
                class="flex-1 truncate rounded border bg-background px-3 py-2 font-mono text-xs select-all"
                >{{ newKey }}</code
              >
              <GTooltip>
                <GTooltipTrigger as-child>
                  <Button variant="ghost" size="icon-sm" @click="copyKey">
                    <CopyIcon class="size-4" />
                  </Button>
                </GTooltipTrigger>
                <GTooltipContent>Copiar</GTooltipContent>
              </GTooltip>
            </div>
            <p>
              <strong>Uso:</strong> enviar en header <code>X-API-Key: {{ newKey }}</code>
            </p>
            <p>
              <strong>Base URL:</strong> <code>{{ baseUrl }}/api/v1</code>
            </p>
          </AlertDescription>
        </Alert>

        <Alert>
          <ShieldIcon />
          <AlertDescription>
            Trata esta key como una contraseña: concede el rol del usuario. Guárdala en un gestor de
            secretos, nunca en el código ni en repositorios, y revócala desde aquí si se expone.
          </AlertDescription>
        </Alert>

        <div class="flex items-end gap-2">
          <div class="flex-1 space-y-1.5">
            <GLabel>Nombre de la API Key</GLabel>
            <Input v-model="newKeyName" placeholder="ej: Integración Power BI" />
          </div>
          <Button :disabled="creating || !newKeyName.trim()" @click="createKey">
            <KeyIcon class="size-4" />
            Generar
          </Button>
        </div>

        <AsyncView :query="keysQuery">
          <template #loading />
          <template #empty>
            <p class="py-4 text-center text-sm text-muted-foreground">
              Este usuario no tiene API Keys
            </p>
          </template>
          <template #default="{ data: keys }">
            <div class="space-y-2">
              <h4 class="text-sm font-medium">Keys existentes</h4>
              <Item v-for="k in keys" :key="k.id" variant="outline">
                <ItemContent>
                  <ItemTitle class="flex items-center gap-2">
                    {{ k.nombre }}
                    <GBadge :color="k.activo ? 'success' : 'destructive'">
                      {{ k.activo ? 'Activa' : 'Inactiva' }}
                    </GBadge>
                  </ItemTitle>
                  <ItemDescription>
                    <code>{{ k.key_prefix }}...</code>
                    <span class="mx-1">·</span>
                    Creada {{ formatDate(k.created_at) }}
                    <template v-if="k.ultimo_uso">
                      <span class="mx-1">·</span>
                      Último uso {{ formatDate(k.ultimo_uso) }}
                    </template>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <GTooltip>
                    <GTooltipTrigger as-child>
                      <Button variant="ghost" size="icon-sm" @click="toggleKey(k)">
                        <component :is="k.activo ? PauseIcon : PlayIcon" class="size-4" />
                      </Button>
                    </GTooltipTrigger>
                    <GTooltipContent>{{ k.activo ? 'Desactivar' : 'Activar' }}</GTooltipContent>
                  </GTooltip>
                  <GTooltip>
                    <GTooltipTrigger as-child>
                      <Button variant="ghost" size="icon-sm" @click="confirmDelete(k)">
                        <Trash2Icon class="size-4 text-destructive" />
                      </Button>
                    </GTooltipTrigger>
                    <GTooltipContent>Eliminar</GTooltipContent>
                  </GTooltip>
                </ItemActions>
              </Item>
            </div>
          </template>
        </AsyncView>

        <Separator />
        <div class="space-y-2 text-xs text-muted-foreground">
          <p class="font-medium text-foreground">Ejemplo de uso:</p>
          <pre class="overflow-x-auto rounded bg-muted p-3"><code>curl -H "X-API-Key: uop_xxxx..." \
  {{ baseUrl }}/api/v1/proyectos</code></pre>
          <p>
            La API Key hereda el rol y permisos del usuario seleccionado. Todos los endpoints de la
            plataforma están disponibles.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
