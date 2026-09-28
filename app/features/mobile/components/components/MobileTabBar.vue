<template>
  <nav class="mtb">
    <!-- Coordinador y técnico no tienen acceso a generación/resumen -->
    <template v-if="esCoordinadorOTecnico">
      <RouterLink :to="fallasPath" class="mtb-item" active-class="mtb-item--active">
        <WrenchIcon class="size-[1em]" /><span>Fallas</span>
      </RouterLink>
      <button class="mtb-item mtb-item--logout" @click="logout">
        <LogOutIcon class="size-[1em]" /><span>Salir</span>
      </button>
    </template>
    <template v-else>
      <RouterLink to="/m/solar" class="mtb-item" active-class="mtb-item--active">
        <SunIcon class="size-[1em]" /><span>Generación</span>
      </RouterLink>
      <RouterLink to="/m/fallas" class="mtb-item" active-class="mtb-item--active">
        <WrenchIcon class="size-[1em]" /><span>Fallas</span>
      </RouterLink>
      <RouterLink to="/m/reporte-cgm" class="mtb-item" active-class="mtb-item--active">
        <MailIcon class="size-[1em]" /><span>CGM</span>
      </RouterLink>
      <RouterLink to="/m/resumen" class="mtb-item" active-class="mtb-item--active">
        <ChartColumnIcon class="size-[1em]" /><span>Resumen</span>
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

function logout(): void {
  signOut()
  router.push('/m/login')
}
</script>

<style scoped>
.mtb {
  display: flex;
  flex-shrink: 0;
  background: #fff;
  border-top: 1px solid #eceaf2;
  padding-bottom: env(safe-area-inset-bottom);
}
.mtb-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 9px 0 7px;
  text-decoration: none;
  color: #9b8db5;
  font-size: 11px;
  font-weight: 600;
}
.mtb-item svg {
  font-size: 20px;
}
.mtb-item--active {
  color: var(--color-unergy-purple);
}
</style>
