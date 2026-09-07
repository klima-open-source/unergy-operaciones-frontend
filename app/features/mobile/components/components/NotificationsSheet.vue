<template>
  <Teleport to="body">
    <Transition name="nsheet">
      <div v-if="open" class="ns-backdrop" @click.self="close">
        <div class="ns-sheet">
          <div class="ns-grab" />

          <div class="ns-header">
            <span class="ns-title"><BellIcon class="size-[1em]" /> Notificaciones</span>
            <button v-if="items.length" class="ns-readall" @click="marcarTodas">Marcar todas</button>
            <button class="ns-close" @click="close"><XIcon class="size-[1em]" /></button>
          </div>

          <div class="ns-body">
            <div v-if="loading" class="ns-state"><LoaderCircleIcon class="size-[1em] animate-spin" /> Cargando…</div>
            <div v-else-if="!items.length" class="ns-state">
              <CircleCheckIcon class="size-[1em]" style="font-size:30px;color:#22c55e" />
              <span>Sin notificaciones hoy</span>
            </div>
            <button v-for="n in items" :key="n.id"
              :class="['ns-item', !n.leida && 'ns-item--unread']" @click="leer(n)">
              <component :is="iconFor(n.tipo)" class="size-[1em]" :style="{ color: colorFor(n.tipo) }" />
              <div class="ns-item-text">
                <span class="ns-item-title">{{ n.titulo }}</span>
                <span class="ns-item-msg">{{ n.mensaje }}</span>
                <span class="ns-item-time">{{ timeAgo(n.created_at) }}</span>
              </div>
              <span v-if="!n.leida" class="ns-dot" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import { BellIcon, CircleCheckIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon, XIcon, ZapIcon } from '@lucide/vue'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close', 'changed'])

const items = ref([])
const loading = ref(false)
const notificacionesService = new NotificacionesService()

watch(() => props.open, (isOpen) => { if (isOpen) cargar() })

async function cargar() {
  loading.value = true
  try {
    items.value = await notificacionesService.listar(40)
  } catch { items.value = [] } finally {
    loading.value = false
  }
}

async function leer(n) {
  if (n.leida) return
  try {
    await notificacionesService.marcarLeida(n.id)
    n.leida = true
    emit('changed')
  } catch { /* ignore */ }
}

async function marcarTodas() {
  try {
    await notificacionesService.marcarTodasLeidas()
    items.value.forEach((n) => { n.leida = true })
    emit('changed')
  } catch { /* ignore */ }
}

function close() { emit('close') }

function iconFor(tipo) {
  return tipo === 'alerta' ? TriangleAlertIcon
    : tipo === 'accion' ? ZapIcon : InfoIcon
}
function colorFor(tipo) {
  return tipo === 'alerta' ? '#dc2626' : tipo === 'accion' ? '#915BD8' : '#0ea5e9'
}
function timeAgo(s) {
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
.ns-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(28,18,50,0.45); display: flex; align-items: flex-end; }
.ns-sheet {
  width: 100%; max-height: 80vh; display: flex; flex-direction: column; background: #fff;
  border-radius: 22px 22px 0 0; padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(0,0,0,0.2);
}
.ns-grab { width: 40px; height: 4px; border-radius: 2px; background: #e5e7eb; margin: 4px auto 12px; }
.ns-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ns-title { flex: 1; font-size: 16px; font-weight: 700; color: var(--color-unergy-deep); }
.ns-title svg { color: var(--color-unergy-purple); margin-right: 6px; }
.ns-readall { background: none; border: none; color: var(--color-unergy-purple); font-size: 13px; font-weight: 600; }
.ns-close { background: none; border: none; color: #9ca3af; font-size: 16px; padding: 4px; }

.ns-body { overflow-y: auto; flex: 1; }
.ns-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 0; color: #6b5a8a; font-size: 14px; }
.ns-state svg { font-size: 22px; color: var(--color-unergy-purple); }

.ns-item {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
  padding: 13px 8px; border: none; background: none; border-bottom: 1px solid #f3f0f7;
}
.ns-item--unread { background: rgba(145,91,216,0.05); }
.ns-item > svg { font-size: 18px; margin-top: 2px; flex-shrink: 0; }
.ns-item-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.ns-item-title { font-size: 14.5px; font-weight: 700; color: var(--color-unergy-deep); }
.ns-item-msg { font-size: 13px; color: #4b5563; line-height: 1.35; }
.ns-item-time { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.ns-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--color-unergy-purple); flex-shrink: 0; margin-top: 5px; }

.nsheet-enter-active, .nsheet-leave-active { transition: opacity .2s ease; }
.nsheet-enter-active .ns-sheet, .nsheet-leave-active .ns-sheet { transition: transform .25s ease; }
.nsheet-enter-from, .nsheet-leave-to { opacity: 0; }
.nsheet-enter-from .ns-sheet, .nsheet-leave-to .ns-sheet { transform: translateY(100%); }
</style>
