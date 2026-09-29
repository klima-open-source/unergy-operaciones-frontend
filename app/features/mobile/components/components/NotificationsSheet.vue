<template>
  <Teleport to="body">
    <Transition name="nsheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end bg-unergy-deep/45"
        @click.self="close"
      >
        <div
          class="ns-sheet flex max-h-4/5 w-full flex-col rounded-t-3xl bg-card px-4 pt-2.5 shadow-lg"
        >
          <div class="mx-auto mt-1 mb-3 h-1 w-10 rounded-full bg-border" />

          <div class="mb-2.5 flex items-center gap-2.5">
            <span class="flex flex-1 items-center gap-1.5 text-base font-bold text-unergy-deep"
              ><BellIcon class="size-4 text-unergy-purple" /> Notificaciones</span
            >
            <button
              v-if="items.length"
              class="text-sm font-semibold text-unergy-purple"
              @click="marcarTodas"
            >
              Marcar todas
            </button>
            <button class="p-1 text-muted-foreground" @click="close">
              <XIcon class="size-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div v-if="loading" :class="STATE">
              <LoaderCircleIcon class="size-6 animate-spin text-unergy-purple" /> Cargando…
            </div>
            <div v-else-if="!items.length" :class="STATE">
              <CircleCheckIcon class="size-8 text-success" />
              <span>Sin notificaciones hoy</span>
            </div>
            <button
              v-for="n in items"
              :key="n.id"
              :class="[
                'flex w-full items-start gap-3 border-b border-border px-2 py-3 text-left',
                !n.leida && 'bg-unergy-purple/5',
              ]"
              @click="leer(n)"
            >
              <component
                :is="iconFor(n.tipo)"
                class="mt-0.5 size-6 shrink-0"
                :class="colorFor(n.tipo)"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-sm font-bold text-unergy-deep">{{ n.titulo }}</span>
                <span class="text-sm leading-snug text-muted-foreground">{{ n.mensaje }}</span>
                <span class="mt-0.5 text-xs text-muted-foreground">{{
                  timeAgo(n.created_at)
                }}</span>
              </div>
              <span v-if="!n.leida" class="mt-1 size-2 shrink-0 rounded-full bg-unergy-purple" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  BellIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  XIcon,
  ZapIcon,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { Notificacion } from '~/features/notificaciones/types'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'

const props = withDefaults(defineProps<{ open?: boolean }>(), { open: false })
const emit = defineEmits<{ close: []; changed: [] }>()

const STATE =
  'flex flex-col items-center justify-center gap-2.5 py-10 text-sm text-muted-foreground'

const items = ref<Notificacion[]>([])
const loading = ref(false)
const notificacionesService = new NotificacionesService()

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) cargar()
  },
)

async function cargar(): Promise<void> {
  loading.value = true
  try {
    items.value = await notificacionesService.listar(40)
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function leer(n: Notificacion): Promise<void> {
  if (n.leida) return
  try {
    await notificacionesService.marcarLeida(n.id)
    n.leida = true
    emit('changed')
  } catch {
    /* ignore */
  }
}

async function marcarTodas(): Promise<void> {
  try {
    await notificacionesService.marcarTodasLeidas()
    items.value.forEach((n) => {
      n.leida = true
    })
    emit('changed')
  } catch {
    /* ignore */
  }
}

function close(): void {
  emit('close')
}

function iconFor(tipo: string | null | undefined): Component {
  return tipo === 'alerta' ? TriangleAlertIcon : tipo === 'accion' ? ZapIcon : InfoIcon
}
function colorFor(tipo: string | null | undefined): string {
  return tipo === 'alerta'
    ? 'text-destructive'
    : tipo === 'accion'
      ? 'text-unergy-purple'
      : 'text-primary'
}
function timeAgo(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}
</script>

<style scoped>
/* safe-area del dispositivo: env() no tiene utilidad */
.ns-sheet {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}

.nsheet-enter-active,
.nsheet-leave-active {
  transition: opacity 0.2s ease;
}
.nsheet-enter-active .ns-sheet,
.nsheet-leave-active .ns-sheet {
  transition: transform 0.25s ease;
}
.nsheet-enter-from,
.nsheet-leave-to {
  opacity: 0;
}
.nsheet-enter-from .ns-sheet,
.nsheet-leave-to .ns-sheet {
  transform: translateY(100%);
}
</style>
