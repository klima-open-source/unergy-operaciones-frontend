<script setup lang="ts">
import type { Notificacion } from '~/features/notificaciones/types'
import { BellIcon, BellOffIcon, InfoIcon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'

const {
  items: notifications,
  unreadCount,
  cargar,
  marcarLeida,
  marcarTodasLeidas,
} = useNotificaciones()

// Mismos 3 valores reales de TipoNotificacionEnum (alerta/info/accion) y los
// mismos colores/íconos que ya usa NotificationsSheet.vue (móvil) -- antes
// esto leía `n.severidad` (un campo que el backend nunca envía) contra un
// mapa de 4 valores ('critica'/'alta'/'media'/'baja') que tampoco existen,
// así que toda notificación caía siempre al ícono/color genérico.
const TIPO_CLASES: Record<string, string> = {
  alerta: 'bg-destructive/10 text-destructive',
  accion: 'bg-primary/10 text-primary',
}
const TIPO_CLASE_DEFAULT = 'bg-sky-600/10 text-sky-600'

function tipoClase(tipo?: string | null): string {
  return (tipo && TIPO_CLASES[tipo]) || TIPO_CLASE_DEFAULT
}
function tipoIcon(tipo?: string | null) {
  const map: Record<string, typeof TriangleAlertIcon> = {
    alerta: TriangleAlertIcon,
    accion: ZapIcon,
  }
  return (tipo && map[tipo]) || InfoIcon
}

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

/** `preventDefault` en `@select` es lo que evita que marcar una notificación cierre el menú. */
function onSelectNotificacion(e: Event, n: Notificacion) {
  e.preventDefault()
  marcarLeida(n)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="relative" title="Notificaciones" @click="cargar">
        <BellIcon />
        <span
          v-if="unreadCount > 0"
          class="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.75 text-xs leading-none font-bold text-white"
        >
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent class="w-80" align="end">
      <div class="flex items-center justify-between px-2 py-1.5">
        <span class="text-sm font-semibold">Notificaciones</span>
        <button
          v-if="unreadCount > 0"
          class="text-xs font-medium text-primary hover:underline"
          @click="marcarTodasLeidas"
        >
          Marcar todas leídas
        </button>
      </div>
      <DropdownMenuSeparator />

      <div class="max-h-80 overflow-y-auto">
        <div v-if="notifications.length === 0" class="py-8 text-center">
          <BellOffIcon class="mx-auto mb-2 size-6 text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Sin notificaciones</p>
        </div>

        <DropdownMenuItem
          v-for="n in notifications"
          :key="n.id"
          class="items-start gap-3 py-2"
          @select="onSelectNotificacion($event, n)"
        >
          <div
            class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
            :class="tipoClase(n.tipo)"
          >
            <component :is="tipoIcon(n.tipo)" class="size-3.5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm leading-snug" :class="n.leida ? 'font-normal' : 'font-semibold'">
              {{ n.titulo || n.mensaje }}
            </p>
            <p v-if="n.titulo && n.mensaje" class="mt-0.5 text-xs text-muted-foreground">
              {{ n.mensaje }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatTimeAgo(n.created_at) }}</p>
          </div>
          <div v-if="!n.leida" class="mt-2 size-2 shrink-0 rounded-full bg-primary" />
        </DropdownMenuItem>
      </div>

      <DropdownMenuSeparator />
      <DropdownMenuItem as-child>
        <NuxtLink to="/alertas" class="justify-center text-xs font-medium text-primary">
          Ver todas las alertas
        </NuxtLink>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
