<script setup lang="ts">
/**
 * «Requiere atención» en el Dashboard: lo que hoy había que buscar en varias
 * pantallas, cada fila con la ficha donde se resuelve. Fase 5 de la propuesta de
 * UX; ver `apps/plataforma/services/atencion.py` en el backend.
 */
import { CalendarClockIcon, CircleAlertIcon, UserXIcon, WrenchIcon } from '@lucide/vue'
import type { Component } from 'vue'
import { DashboardService } from '~/features/dashboard/services/dashboard'
import type { Atencion, ListaAtencion } from '~/features/dashboard/types'

const servicio = new DashboardService()
const consulta = useQuery<Atencion>()
onMounted(() => consulta.run(() => servicio.obtenerAtencion()))

interface Bloque {
  key: 'contratos_por_vencer' | 'plantas_sin_operacion' | 'arrendadores_sin_cliente'
  titulo: string
  vacio: string
  icon: Component
  tono: 'warning' | 'destructive'
}
const bloques = computed<Bloque[]>(() => [
  {
    key: 'contratos_por_vencer',
    titulo: `Contratos que vencen en ${consulta.data?.dias_por_vencer ?? 60} días`,
    vacio: 'Ningún contrato vence pronto.',
    icon: CalendarClockIcon,
    tono: 'warning',
  },
  {
    key: 'plantas_sin_operacion',
    titulo: 'Plantas en operación sin contrato de operación',
    vacio: 'Todas las plantas en operación tienen contrato.',
    icon: WrenchIcon,
    tono: 'destructive',
  },
  {
    key: 'arrendadores_sin_cliente',
    titulo: 'Arrendadores sin ficha de cliente',
    vacio: 'Todos los arrendadores tienen cliente.',
    icon: UserXIcon,
    tono: 'warning',
  },
])

const lista = (key: Bloque['key']): ListaAtencion | null => consulta.data?.[key] ?? null
const TONO: Record<Bloque['tono'], string> = {
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-sm font-bold text-foreground">Requiere atención</h2>

    <div v-if="consulta.isLoading" class="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Skeleton v-for="i in 3" :key="i" class="h-40" />
    </div>

    <p v-else-if="consulta.error" class="flex items-center gap-2 text-sm text-destructive">
      <CircleAlertIcon class="size-4" /> {{ consulta.error.message }}
    </p>

    <div v-else-if="consulta.data" class="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div
        v-for="b in bloques"
        :key="b.key"
        class="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4"
      >
        <div class="flex items-center gap-2">
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-lg"
            :class="TONO[b.tono]"
          >
            <component :is="b.icon" class="size-4" />
          </span>
          <span class="min-w-0 flex-1 text-sm font-semibold text-foreground">{{ b.titulo }}</span>
          <span class="text-lg font-extrabold text-foreground tabular-nums">{{
            lista(b.key)?.total ?? 0
          }}</span>
        </div>
        <p v-if="!lista(b.key)?.total" class="text-xs text-muted-foreground">{{ b.vacio }}</p>
        <ul v-else class="flex flex-col divide-y divide-border">
          <li v-for="item in lista(b.key)!.items" :key="item.id">
            <NuxtLink :to="item.url" class="flex flex-col py-1.5 hover:text-primary">
              <TruncatedText :text="item.titulo" class="text-sm font-medium" />
              <TruncatedText :text="item.detalle" class="text-xs text-muted-foreground" />
            </NuxtLink>
          </li>
        </ul>
        <p
          v-if="(lista(b.key)?.total ?? 0) > (lista(b.key)?.items.length ?? 0)"
          class="text-xs text-muted-foreground"
        >
          y {{ lista(b.key)!.total - lista(b.key)!.items.length }} más
        </p>
      </div>
    </div>
  </section>
</template>
