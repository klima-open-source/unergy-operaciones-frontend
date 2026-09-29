<template>
  <nav class="mtb flex shrink-0 border-t border-border bg-card">
    <!-- Coordinador y técnico no tienen acceso a generación/resumen -->
    <template v-if="esCoordinadorOTecnico">
      <RouterLink :to="fallasPath" :class="itemClass" active-class="text-primary!">
        <WrenchIcon class="size-5" /><span>Fallas</span>
      </RouterLink>
      <button :class="itemClass" @click="logout">
        <LogOutIcon class="size-5" /><span>Salir</span>
      </button>
    </template>
    <template v-else>
      <RouterLink to="/m/solar" :class="itemClass" active-class="text-primary!">
        <SunIcon class="size-5" /><span>Generación</span>
      </RouterLink>
      <RouterLink to="/m/fallas" :class="itemClass" active-class="text-primary!">
        <WrenchIcon class="size-5" /><span>Fallas</span>
      </RouterLink>
      <RouterLink to="/m/reporte-cgm" :class="itemClass" active-class="text-primary!">
        <MailIcon class="size-5" /><span>CGM</span>
      </RouterLink>
      <RouterLink to="/m/resumen" :class="itemClass" active-class="text-primary!">
        <ChartColumnIcon class="size-5" /><span>Resumen</span>
      </RouterLink>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChartColumnIcon, LogOutIcon, MailIcon, SunIcon, WrenchIcon } from '@lucide/vue'
import { UserRole } from '~/types/user'

const { user, signOut } = useAuth()
const router = useRouter()
const rol = computed(() => user.value?.role)
const esCoordinadorOTecnico = computed(
  () => rol.value === UserRole.COORDINADOR || rol.value === UserRole.TECNICO,
)
const fallasPath = computed(() =>
  rol.value === UserRole.COORDINADOR ? '/m/coordinador' : '/m/tecnico',
)

const itemClass =
  'flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-2 text-xs font-semibold text-muted-foreground no-underline'

function logout(): void {
  signOut()
  router.push('/m/login')
}
</script>

<style scoped>
/* safe-area del dispositivo: env() no tiene utilidad */
.mtb {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
